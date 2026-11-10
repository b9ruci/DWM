'use strict';
// Logger estructurado (JSON por línea). Nunca registra cabeceras ni cuerpos completos.
// Cualquier campo cuyo nombre sugiera una credencial se reemplaza por "[REDACTED]".
const fs = require('node:fs');
const path = require('node:path');

const SENSITIVE = /pass|token|secret|authorization|cookie|signature|key|rut|telefono|direccion/i;

function redact(value, depth = 0) {
  if (value === null || typeof value !== 'object' || depth > 4) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE.test(k) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

function createLogger(service) {
  let stream = null;
  if (process.env.LOG_DIR) {
    fs.mkdirSync(process.env.LOG_DIR, { recursive: true });
    stream = fs.createWriteStream(path.join(process.env.LOG_DIR, `${service}.log`), { flags: 'a' });
  }
  function write(level, msg, fields = {}) {
    const line = JSON.stringify({ ts: new Date().toISOString(), svc: service, level, msg, ...redact(fields) });
    if (stream) stream.write(line + '\n');
    if (process.env.LOG_STDOUT !== 'false') process.stdout.write(line + '\n');
  }
  return {
    info: (msg, f) => write('info', msg, f),
    warn: (msg, f) => write('warn', msg, f),
    error: (msg, f) => write('error', msg, f),
  };
}

module.exports = { createLogger, redact };
