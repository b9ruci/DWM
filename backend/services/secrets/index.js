'use strict';
// Administrador de secretos (privado). Custodia claves de firma, claves internas
// entre servicios, clave de cifrado de datos personales y credenciales del proveedor
// de pagos. Cada consumidor se autentica con su token de identidad y solo puede leer
// las referencias indicadas en su ACL (mínimo privilegio). Toda lectura queda auditada
// SIN registrar valores.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { createLogger } = require('../../lib/logger');

const logger = createLogger('secrets');
const storeFile = process.env.SECRETS_STORE_FILE || path.join(__dirname, '..', '..', '..', '.secrets', 'store.json');
const port = Number(process.env.PORT || 7000);

function loadStore() {
  return JSON.parse(fs.readFileSync(storeFile, 'utf8'));
}
let store = loadStore();
// Recarga en caliente para soportar rotación/revocación sin reiniciar el gestor.
fs.watchFile(storeFile, { interval: 1000 }, () => {
  try {
    store = loadStore();
    logger.info('store_reloaded', {});
  } catch (err) {
    logger.error('store_reload_failed', { error: err.message });
  }
});

const sha256 = (s) => crypto.createHash('sha256').update(s).digest();

function identify(req) {
  const consumer = req.headers['x-consumer'];
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const expected = consumer && store.identities[consumer];
  if (!expected || !token) return null;
  const a = sha256(token);
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? consumer : null;
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://secrets');
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { status: 'ok', service: 'secrets' });
  const m = /^\/v1\/secrets\/(.+)$/.exec(url.pathname);
  if (req.method !== 'GET' || !m) return json(res, 404, { error: { code: 'NOT_FOUND' } });
  const ref = decodeURIComponent(m[1]);
  const consumer = identify(req);
  if (!consumer) {
    logger.warn('secret_access', { consumer: req.headers['x-consumer'] || null, ref, decision: 'unauthenticated' });
    return json(res, 401, { error: { code: 'UNAUTHENTICATED' } });
  }
  const allowed = (store.acl[consumer] || []).includes(ref);
  if (!allowed) {
    logger.warn('secret_access', { consumer, ref, decision: 'denied' });
    return json(res, 403, { error: { code: 'FORBIDDEN' } });
  }
  const s = store.secrets[ref];
  if (!s || s.revoked) {
    logger.warn('secret_access', { consumer, ref, decision: 'not_found_or_revoked' });
    return json(res, 404, { error: { code: 'NOT_FOUND' } });
  }
  logger.info('secret_access', { consumer, ref, decision: 'granted', version: s.version });
  return json(res, 200, { ref, version: s.version, value: s.value });
});

server.listen(port, process.env.BIND_HOST || '127.0.0.1', () => logger.info('listening', { port }));
