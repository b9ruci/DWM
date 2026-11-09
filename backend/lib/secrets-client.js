'use strict';
// Cliente del administrador de secretos. Cada servicio se presenta con su
// propio token de identidad de arranque (archivo montado, nunca en el repositorio)
// y solo puede leer las referencias que su ACL permite.
const fs = require('node:fs');

function createSecretsClient({ service, logger }) {
  const url = process.env.SECRETS_URL || 'http://127.0.0.1:7000';
  const identityFile = process.env.SECRETS_IDENTITY_FILE;
  if (!identityFile) throw new Error('SECRETS_IDENTITY_FILE no definido');
  const identity = fs.readFileSync(identityFile, 'utf8').trim();
  const cache = new Map();

  async function get(ref, { retries = 8 } = {}) {
    if (cache.has(ref)) return cache.get(ref);
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(`${url}/v1/secrets/${encodeURIComponent(ref)}`, {
          headers: { authorization: `Bearer ${identity}`, 'x-consumer': service },
          signal: AbortSignal.timeout(2000),
        });
        if (res.status === 200) {
          const body = await res.json();
          cache.set(ref, body.value);
          logger.info('secret_loaded', { ref, version: body.version });
          return body.value;
        }
        // 403/404 no se reintenta: es una decisión de autorización, no un fallo transitorio.
        if (res.status === 403 || res.status === 404) {
          throw Object.assign(new Error(`secreto ${ref} denegado (${res.status})`), { fatal: true });
        }
        lastErr = new Error(`secretos respondió ${res.status}`);
      } catch (err) {
        if (err.fatal) throw err;
        lastErr = err;
      }
      const wait = Math.min(250 * 2 ** attempt, 4000);
      logger.warn('secrets_retry', { ref, attempt, waitMs: wait, error: String(lastErr && lastErr.message) });
      await new Promise((r) => setTimeout(r, wait));
    }
    throw new Error(`No fue posible obtener el secreto ${ref}: ${lastErr && lastErr.message}`);
  }

  return { get };
}

module.exports = { createSecretsClient };
