'use strict';
// Mini framework HTTP compartido por los servicios privados.
// - Enrutamiento explícito (lista blanca de verbo + ruta).
// - Autenticación entre servicios obligatoria (salvo /health).
// - Identificador de correlación propagado y registrado.
// - Errores controlados: nunca se devuelve la traza interna al llamador.
const http = require('node:http');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const internalAuth = require('./internal-auth');

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function compile(pathPattern) {
  const keys = [];
  const re = new RegExp(
    '^' +
      pathPattern.replace(/\/:([a-zA-Z]+)/g, (_, k) => {
        keys.push(k);
        return '/([^/]+)';
      }) +
      '$',
  );
  return { re, keys };
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'PAYLOAD_TOO_LARGE', 'El cuerpo de la solicitud excede el límite'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(payload);
}

/**
 * @param {object} opts
 * @param {string} opts.name
 * @param {number} opts.port
 * @param {string} [opts.host]
 * @param {Array} opts.routes  [{method, path, callers?:string[], user?:'none'|'optional'|'required'|'admin', public?:boolean, raw?:boolean, handler}]
 * @param {(caller:string)=>string|undefined} [opts.keyFor] clave interna por caller entrante
 * @param {object} opts.logger
 */
function createService({ name, port, host, routes, keyFor, logger, bodyLimit = 64 * 1024 }) {
  const compiled = routes.map((r) => ({ ...r, ...compile(r.path) }));
  const faultDelay = Number(process.env.FAULT_DELAY_MS || 0);

  const server = http.createServer(async (req, res) => {
    const started = process.hrtime.bigint();
    const url = new URL(req.url, 'http://internal');
    const incomingCid = req.headers['x-correlation-id'];
    const cid = typeof incomingCid === 'string' && UUID_RE.test(incomingCid) ? incomingCid : crypto.randomUUID();
    let status = 500;
    let caller = null;
    let user = null;
    let routeId = null;
    res.setHeader('x-correlation-id', cid);
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        status = 200;
        return send(res, 200, { status: 'ok', service: name });
      }
      if (faultDelay > 0) await new Promise((r) => setTimeout(r, faultDelay)); // inyección de fallos (solo pruebas)

      const candidates = compiled.filter((r) => r.re.test(url.pathname));
      if (candidates.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Recurso no encontrado');
      const route = candidates.find((r) => r.method === req.method);
      if (!route) throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Método no permitido');
      routeId = `${route.method} ${route.path}`;
      const match = route.re.exec(url.pathname);
      const params = {};
      route.keys.forEach((k, i) => (params[k] = decodeURIComponent(match[i + 1])));

      // Autenticación entre servicios (rechaza acceso directo sin identidad autorizada).
      if (!route.public) {
        const token = req.headers['x-internal-auth'];
        const pathWithQuery = url.pathname + url.search;
        const v = internalAuth.verify(token, keyFor || (() => undefined), {
          target: name,
          method: req.method,
          path: pathWithQuery,
        });
        if (!v.ok) {
          logger.warn('internal_auth_rejected', { cid, reason: v.reason, path: url.pathname });
          throw new HttpError(401, 'SERVICE_AUTH_REQUIRED', 'Identidad de servicio no válida');
        }
        if (!route.callers || !route.callers.includes(v.caller)) {
          logger.warn('caller_not_allowed', { cid, caller: v.caller, route: routeId });
          throw new HttpError(403, 'CALLER_FORBIDDEN', 'Servicio llamador no autorizado para esta operación');
        }
        caller = v.caller;
        user = v.user;
      }
      const userReq = route.user || 'none';
      if ((userReq === 'required' || userReq === 'admin') && !user) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Se requiere un usuario autenticado');
      }
      if (userReq === 'admin' && user.role !== 'ADMIN') {
        throw new HttpError(403, 'FORBIDDEN', 'No tienes permisos para esta operación');
      }

      let body = null;
      let rawBody = null;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        rawBody = await readBody(req, bodyLimit);
        if (!route.raw && rawBody.length > 0) {
          try {
            body = JSON.parse(rawBody.toString('utf8'));
          } catch {
            throw new HttpError(400, 'INVALID_JSON', 'El cuerpo no es JSON válido');
          }
        }
      }
      const query = Object.fromEntries(url.searchParams.entries());
      const result = await route.handler({ params, query, body, rawBody, user, caller, cid, headers: req.headers, logger });
      status = result.status || 200;
      if (result.html !== undefined) {
        res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...(result.headers || {}) });
        return res.end(result.html);
      }
      return send(res, status, result.body, result.headers);
    } catch (err) {
      if (err instanceof HttpError) {
        status = err.status;
        return send(res, err.status, { error: { code: err.code, message: err.message, details: err.details, correlationId: cid } });
      }
      status = 500;
      logger.error('unhandled_error', { cid, error: err && err.message, stack: err && err.stack });
      return send(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servicio', correlationId: cid } });
    } finally {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      if (url.pathname !== '/health') {
        logger.info('request', { cid, method: req.method, path: url.pathname, route: routeId, status, ms: Math.round(ms * 10) / 10, caller, sub: user && user.sub });
      }
    }
  });

  return {
    server,
    listen: () =>
      new Promise((resolve) => {
        server.listen(port, host || process.env.BIND_HOST || '127.0.0.1', () => {
          logger.info('listening', { port });
          resolve();
        });
      }),
  };
}

/**
 * Cliente para invocar otros servicios privados con identidad de servicio.
 * targets: { inventory: { url, key } }
 */
function createServiceClient({ caller, targets, logger }) {
  async function call(target, method, path, { body, user, cid, timeoutMs = 3000, headers = {} } = {}) {
    const t = targets[target];
    if (!t) throw new Error(`Destino interno no configurado: ${target}`);
    const token = internalAuth.sign({ key: t.key, caller, target, method, path, user, cid });
    const started = Date.now();
    try {
      const res = await fetch(t.url + path, {
        method,
        headers: {
          'x-internal-auth': token,
          'x-correlation-id': cid || '',
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        body: body !== undefined ? (Buffer.isBuffer(body) ? body : JSON.stringify(body)) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      return { status: res.status, data, headers: res.headers };
    } catch (err) {
      const timeout = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
      logger.warn('downstream_failure', { cid, target, path, timeout, ms: Date.now() - started, error: err && err.message });
      throw new HttpError(
        timeout ? 504 : 503,
        timeout ? 'DEPENDENCY_TIMEOUT' : 'DEPENDENCY_UNAVAILABLE',
        `El servicio ${target} no respondió`,
        { dependency: target },
      );
    }
  }
  return { call };
}

module.exports = { createService, createServiceClient, HttpError, UUID_RE };
