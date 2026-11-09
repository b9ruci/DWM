'use strict';
// JWT RS256 mínimo (sin dependencias). Solo se acepta alg=RS256 para evitar
// ataques de confusión de algoritmo ("none" o HS256 con la clave pública).
const crypto = require('node:crypto');

const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

function signJwt(payload, privateKeyPem, { kid = 'auth-1' } = {}) {
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const data = `${b64u(header)}.${b64u(payload)}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(data), privateKeyPem).toString('base64url');
  return `${data}.${sig}`;
}

/** @returns {{ok:true, payload:object}|{ok:false, code:string}} */
function verifyJwt(token, publicKeyPem, { issuer, audience, clockSkew = 5 } = {}) {
  if (typeof token !== 'string') return { ok: false, code: 'TOKEN_INVALID' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, code: 'TOKEN_INVALID' };
  let header, payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return { ok: false, code: 'TOKEN_INVALID' };
  }
  if (header.alg !== 'RS256') return { ok: false, code: 'TOKEN_INVALID' };
  const valid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKeyPem,
    Buffer.from(parts[2], 'base64url'),
  );
  if (!valid) return { ok: false, code: 'TOKEN_INVALID' };
  const now = Math.floor(Date.now() / 1000);
  if (issuer && payload.iss !== issuer) return { ok: false, code: 'TOKEN_INVALID' };
  if (audience && payload.aud !== audience) return { ok: false, code: 'TOKEN_INVALID' };
  if (typeof payload.exp !== 'number' || payload.exp + clockSkew < now) return { ok: false, code: 'TOKEN_EXPIRED' };
  return { ok: true, payload };
}

module.exports = { signJwt, verifyJwt };
