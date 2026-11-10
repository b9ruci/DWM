#!/usr/bin/env node
'use strict';
// Rotación / revocación de un secreto del gestor local.
// Uso: node scripts/rotate-secret.js <ref> [--revoke]
// Tras rotar una clave interna, reinicie los dos servicios que la comparten.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ref = process.argv[2];
const revoke = process.argv.includes('--revoke');
if (!ref) {
  console.error('Uso: node scripts/rotate-secret.js <ref> [--revoke]');
  process.exit(1);
}
const file = path.join(process.env.SECRETS_DIR || path.join(__dirname, '..', '..', '.secrets'), 'store.json');
const store = JSON.parse(fs.readFileSync(file, 'utf8'));
const s = store.secrets[ref];
if (!s) {
  console.error(`No existe la referencia ${ref}`);
  process.exit(1);
}
if (revoke) {
  s.revoked = true;
} else {
  if (ref.startsWith('auth/') || ref.startsWith('payments/')) {
    console.error('Esta referencia requiere un procedimiento manual (par de claves o coordinación con el proveedor). Ver docs.');
    process.exit(1);
  }
  s.value = ref === 'clients/pii-encryption-key' ? crypto.randomBytes(32).toString('base64') : crypto.randomBytes(32).toString('base64url');
  s.version += 1;
  delete s.revoked;
}
s.updatedAt = new Date().toISOString();
fs.writeFileSync(file, JSON.stringify(store, null, 2), { mode: 0o600 });
console.log(`${ref}: ${revoke ? 'revocado' : `rotado a versión ${s.version}`}`);
