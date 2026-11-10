'use strict';
// API Gateway (único punto público del backend).
// Responsabilidades: lista blanca de rutas, CORS restringido, límite de solicitudes,
// validación del JWT (RS256, iss, aud, exp) y de la sesión (revocación), autorización
// gruesa por rol, descarte de cabeceras de identidad aportadas por el navegador,
// propagación de identidad verificada con credencial de servicio, tiempos de espera,
// errores controlados y logs con identificador de correlación sin secretos.
const http = require('node:http');
const crypto = require('node:crypto');
const { boot } = require('../../lib/boot');
const { verifyJwt } = require('../../lib/jwt');
const { HttpError, UUID_RE } = require('../../lib/http');
const ROUTES = require('./routes');

const NAME = 'gateway';
const PORT = Number(process.env.PORT || 8080);
const ORIGINS = (process.env.FRONTEND_ORIGINS || 'http://localhost:8000,http://127.0.0.1:8000').split(',');
const LIMITS = { default: Number(process.env.RATE_LIMIT_DEFAULT || 300), strict: Number(process.env.RATE_LIMIT_STRICT || 20) };
const BODY_LIMIT = 32 * 1024;
const TIMEOUTS = { payments: 9000, graphql: 6000, default: 4000 };
const SESSION_CACHE_MS = 5000;

const compiled = ROUTES.map((r) => {
  const keys = [];
  const re = new RegExp('^' + r.path.replace(/\/:([a-zA-Z]+)/g, (_, k) => (keys.push(k), '/([A-Za-z0-9_-]{1,64})')) + '$');
  return { ...r, re, keys };
});

async function main() {
  const { logger, secrets, client } = await boot({ name: NAME, outbound: ['auth', 'inventory', 'orders', 'clients', 'payments', 'graphql'] });
  const publicKey = await secrets.get('auth/jwt-public-key');

  const windows = new Map(); // `${ip}|${routeId}` -> {start, count}
  setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [k, w] of windows) if (w.start < cutoff) windows.delete(k);
  }, 60_000).unref();
  function rateLimited(ip, route) {
    const limit = LIMITS[route.limit || 'default'];
    const key = `${ip}|${route.id}`;
    const now = Date.now();
    const w = windows.get(key);
    if (!w || now - w.start >= 60_000) {
      windows.set(key, { start: now, count: 1 });
      return 0;
    }
    w.count += 1;
    return w.count > limit ? Math.ceil((w.start + 60_000 - now) / 1000) : 0;
  }

  const sessionCache = new Map(); // sid -> {active, at}
  async function sessionActive(sid, cid) {
    const c = sessionCache.get(sid);
    if (c && Date.now() - c.at < SESSION_CACHE_MS) return c.active;
    const r = await client.call('auth', 'GET', `/internal/sessions/${sid}`, { cid, timeoutMs: 2000 });
    if (r.status !== 200) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'No fue posible validar la sesión');
    sessionCache.set(sid, { active: r.data.data.active, at: Date.now() });
    return r.data.data.active;
  }

  async function authenticate(req, cid) {
    const h = req.headers.authorization;
    if (!h) return { user: null, code: 'AUTH_REQUIRED' };
    if (!h.startsWith('Bearer ')) return { user: null, code: 'TOKEN_INVALID' };
    const v = verifyJwt(h.slice(7), publicKey, { issuer: 'chocomania-auth', audience: 'chocomania-api' });
    if (!v.ok) return { user: null, code: v.code };
    const { sub, role, sid } = v.payload;
    if (!(await sessionActive(sid, cid))) return { user: null, code: 'SESSION_REVOKED' };
    return { user: { sub, role, sid } };
  }

  function corsHeaders(origin) {
    if (!origin || !ORIGINS.includes(origin)) return {};
    return {
      'access-control-allow-origin': origin,
      vary: 'Origin',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type,idempotency-key,x-correlation-id',
      'access-control-expose-headers': 'x-correlation-id,idempotent-replay,retry-after',
      'access-control-max-age': '600',
    };
  }

  const AUTH_MESSAGES = {
    AUTH_REQUIRED: 'Debes iniciar sesión para continuar',
    TOKEN_EXPIRED: 'Tu sesión expiró. Inicia sesión nuevamente',
    TOKEN_INVALID: 'La sesión no es válida. Inicia sesión nuevamente',
    SESSION_REVOKED: 'Tu sesión fue cerrada. Inicia sesión nuevamente',
  };

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, 'http://gateway');
    const inCid = req.headers['x-correlation-id'];
    const cid = typeof inCid === 'string' && UUID_RE.test(inCid) ? inCid : crypto.randomUUID();
    const ip = req.socket.remoteAddress;
    const cors = corsHeaders(req.headers.origin);
    let status = 500;
    let route = null;
    let user = null;
    const reply = (code, body, extra = {}) => {
      status = code;
      res.writeHead(code, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'referrer-policy': 'no-referrer',
        'x-correlation-id': cid,
        ...cors,
        ...extra,
      });
      res.end(body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body));
    };
    const fail = (code, errCode, message, extra) => reply(code, { error: { code: errCode, message, correlationId: cid } }, extra);

    try {
      if (url.pathname === '/health' && req.method === 'GET') return reply(200, { status: 'ok', service: NAME });
      if (req.method === 'OPTIONS') return reply(cors['access-control-allow-origin'] ? 204 : 403);

      const candidates = compiled.filter((r) => r.re.test(url.pathname));
      if (!candidates.length) return fail(404, 'NOT_FOUND', 'Ruta no encontrada');
      route = candidates.find((r) => r.method === req.method);
      if (!route) return fail(405, 'METHOD_NOT_ALLOWED', 'Método no permitido para esta ruta');

      const wait = rateLimited(ip, route);
      if (wait) return fail(429, 'RATE_LIMITED', 'Demasiadas solicitudes. Espera un momento e intenta nuevamente', { 'retry-after': String(wait) });

      // Identidad: solo se confía en el JWT validado; cabeceras de identidad del navegador se descartan.
      if (route.access === 'user' || route.access === 'admin') {
        const a = await authenticate(req, cid);
        if (!a.user) return fail(401, a.code, AUTH_MESSAGES[a.code]);
        user = a.user;
        if (route.access === 'admin' && user.role !== 'ADMIN') return fail(403, 'FORBIDDEN', 'No tienes permisos para esta operación');
      } else if (route.optionalUser && req.headers.authorization) {
        user = (await authenticate(req, cid)).user;
      }

      // Construcción de la ruta interna: parámetros validados y query en lista blanca.
      const m = route.re.exec(url.pathname);
      let target = route.to;
      route.keys.forEach((k, i) => (target = target.replace(`:${k}`, encodeURIComponent(m[i + 1]))));
      const qs = new URLSearchParams();
      for (const k of route.query || []) {
        const val = url.searchParams.get(k);
        if (val !== null) {
          if (val.length > 100) return fail(400, 'VALIDATION_ERROR', `Parámetro ${k} demasiado largo`);
          qs.set(k, val);
        }
      }
      if ([...qs].length) target += `?${qs.toString()}`;

      let body;
      if (req.method === 'POST' || req.method === 'PUT') {
        const chunks = [];
        let size = 0;
        for await (const c of req) {
          size += c.length;
          if (size > BODY_LIMIT) return fail(413, 'PAYLOAD_TOO_LARGE', 'El cuerpo de la solicitud es demasiado grande');
          chunks.push(c);
        }
        body = Buffer.concat(chunks);
        if (!route.raw && body.length && !/^application\/json/.test(req.headers['content-type'] || '')) {
          return fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'Se requiere Content-Type: application/json');
        }
        if (!body.length) body = undefined;
      }
      const headers = {};
      for (const h of route.forward || []) if (req.headers[h]) headers[h] = String(req.headers[h]).slice(0, 200);

      const r = await client.call(route.target, req.method, target, {
        body, user, cid, headers, timeoutMs: TIMEOUTS[route.target] || TIMEOUTS.default,
      });
      // I-01 (RUN-01/P17): al cerrar sesión se invalida la caché local de la sesión; de lo contrario
      // el token revocado seguía aceptándose hasta SESSION_CACHE_MS en esta instancia del gateway.
      if (route.id === 'GW07' && r.status === 200 && user) sessionCache.set(user.sid, { active: false, at: Date.now() });
      const extra = {};
      const replay = r.headers.get('idempotent-replay');
      if (replay) extra['idempotent-replay'] = replay;
      // Si un servicio interno rechaza la identidad de servicio, el navegador no ve el detalle.
      if (r.status === 401 && r.data && r.data.error && r.data.error.code === 'SERVICE_AUTH_REQUIRED') {
        logger.error('service_auth_misconfigured', { cid, target: route.target });
        return fail(502, 'BAD_GATEWAY', 'Error de comunicación interna');
      }
      return reply(r.status, r.data === null ? undefined : r.data, extra);
    } catch (err) {
      if (err instanceof HttpError) {
        const msg = err.code === 'DEPENDENCY_TIMEOUT'
          ? 'El servicio tardó demasiado en responder. Intenta nuevamente.'
          : err.code === 'DEPENDENCY_UNAVAILABLE'
            ? 'El servicio no está disponible en este momento. Intenta nuevamente en unos minutos.'
            : err.message;
        return fail(err.status, err.code === 'DEPENDENCY_TIMEOUT' ? 'UPSTREAM_TIMEOUT' : err.code === 'DEPENDENCY_UNAVAILABLE' ? 'SERVICE_UNAVAILABLE' : err.code, msg);
      }
      logger.error('gateway_error', { cid, error: err && err.message });
      return fail(500, 'INTERNAL_ERROR', 'Error interno');
    } finally {
      logger.info('request', {
        cid, route: route ? route.id : null, method: req.method, path: url.pathname, status,
        ms: Date.now() - started, sub: user ? user.sub : null, role: user ? user.role : null, ip,
      });
    }
  });

  server.listen(PORT, process.env.BIND_HOST || '127.0.0.1', () => logger.info('listening', { port: PORT }));
}

main().catch((err) => {
  console.error(`[${NAME}] error fatal de arranque:`, err.message);
  process.exit(1);
});
