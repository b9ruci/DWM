'use strict';
// Identidad entre servicios: token HMAC-SHA256 de vida corta, ligado a
// emisor (caller), destino (audience), verbo y ruta. Cada par caller->target
// tiene su propia clave (referencia "internal/<caller>--<target>" en el gestor de secretos).
// El token también transporta el contexto de usuario YA VERIFICADO por el API Gateway
// (sub, role, sid), de modo que los servicios privados puedan comprobar propiedad.
const crypto = require('node:crypto');

const TTL_SECONDS = 30;
const b64u = (buf) => Buffer.from(buf).toString('base64url');

function sign({ key, caller, target, method, path, user, cid }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: caller,
    aud: target,
    m: method.toUpperCase(),
    p: path,
    iat: now,
    exp: now + TTL_SECONDS,
    cid: cid || null,
    usr: user ? { sub: user.sub, role: user.role, sid: user.sid || null } : null,
  };
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', key).update(`v1.${body}`).digest('base64url');
  return `v1.${body}.${sig}`;
}

/**
 * Verifica un token interno.
 * @param {string} token
 * @param {(caller:string)=>Buffer|string|undefined} keyFor  clave para un caller dado
 * @param {{target:string, method:string, path:string}} expected
 * @returns {{ok:true, caller:string, user:object|null, cid:string|null}|{ok:false, reason:string}}
 */
function verify(token, keyFor, expected) {
  if (typeof token !== 'string') return { ok: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return { ok: false, reason: 'malformed' };
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const key = keyFor(payload.iss);
  if (!key) return { ok: false, reason: 'unknown_caller' };
  const expectedSig = crypto.createHmac('sha256', key).update(`v1.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], 'base64url');
  if (given.length !== expectedSig.length || !crypto.timingSafeEqual(given, expectedSig)) {
    return { ok: false, reason: 'bad_signature' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return { ok: false, reason: 'expired' };
  if (payload.aud !== expected.target) return { ok: false, reason: 'wrong_audience' };
  if (payload.m !== expected.method.toUpperCase() || payload.p !== expected.path) {
    return { ok: false, reason: 'request_mismatch' };
  }
  return { ok: true, caller: payload.iss, user: payload.usr, cid: payload.cid };
}

module.exports = { sign, verify };
