#!/usr/bin/env node
'use strict';
// Genera los secretos del entorno LOCAL/PRUEBA en ./.secrets (ignorado por git).
// No existe ningún valor secreto en el repositorio: cada equipo/entorno los genera.
// Uso: node scripts/init-secrets.js [--force]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const dir = process.env.SECRETS_DIR || path.join(__dirname, '..', '..', '.secrets');
const force = process.argv.includes('--force');
const storeFile = path.join(dir, 'store.json');

if (fs.existsSync(storeFile) && !force) {
  console.log(`[init-secrets] ya existen secretos en ${dir} (use --force para regenerarlos)`);
  process.exit(0);
}

const rand = (n = 32) => crypto.randomBytes(n).toString('base64url');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const now = new Date().toISOString();

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Pares llamador -> destino autorizados (cada uno con su propia clave HMAC).
const PAIRS = [
  ['gateway', 'auth'], ['gateway', 'inventory'], ['gateway', 'orders'], ['gateway', 'clients'],
  ['gateway', 'payments'], ['gateway', 'graphql'],
  ['graphql', 'inventory'], ['graphql', 'orders'], ['graphql', 'clients'], ['graphql', 'payments'],
  ['auth', 'clients'], ['orders', 'inventory'], ['payments', 'orders'],
];

const providerApiKey = `sk_test_${rand(24)}`;
const webhookSecret = `whsec_${rand(24)}`;

const secrets = {
  'auth/jwt-signing-key': privateKey,
  'auth/jwt-public-key': publicKey,
  'clients/pii-encryption-key': crypto.randomBytes(32).toString('base64'),
  'payments/provider-api-key': providerApiKey,
  'payments/webhook-signing-secret': webhookSecret,
};
for (const [a, b] of PAIRS) secrets[`internal/${a}--${b}`] = rand(32);

const acl = {
  gateway: ['auth/jwt-public-key'],
  auth: ['auth/jwt-signing-key'],
  graphql: [],
  inventory: [],
  orders: [],
  clients: ['clients/pii-encryption-key'],
  payments: ['payments/provider-api-key', 'payments/webhook-signing-secret'],
};
for (const [a, b] of PAIRS) {
  acl[a].push(`internal/${a}--${b}`);
  acl[b].push(`internal/${a}--${b}`);
}

fs.mkdirSync(path.join(dir, 'identities'), { recursive: true, mode: 0o700 });
fs.mkdirSync(path.join(dir, 'provider'), { recursive: true, mode: 0o700 });
const identities = {};
for (const consumer of Object.keys(acl)) {
  const token = rand(32);
  identities[consumer] = sha(token); // el gestor solo guarda el hash del token de identidad
  fs.writeFileSync(path.join(dir, 'identities', `${consumer}.token`), token + '\n', { mode: 0o600 });
}

const store = {
  generatedAt: now,
  secrets: Object.fromEntries(Object.entries(secrets).map(([k, value]) => [k, { value, version: 1, updatedAt: now }])),
  acl,
  identities,
};
fs.writeFileSync(storeFile, JSON.stringify(store, null, 2), { mode: 0o600 });

// Configuración del lado del PROVEEDOR (doble de prueba). En un proveedor real estas
// credenciales las emite el proveedor; aquí se generan para el sandbox local.
fs.writeFileSync(
  path.join(dir, 'provider', 'sandbox.json'),
  JSON.stringify({ apiKey: providerApiKey, webhookSecret }, null, 2),
  { mode: 0o600 },
);

// Cuentas ficticias por rol con contraseñas aleatorias (no se versionan).
const seed = {
  admin: { email: 'admin@chocomania.test', password: `Adm-${rand(9)}1`, nombre: 'Administración Chocomanía' },
  clienteA: { email: 'ana.cliente@chocomania.test', password: `Cli-${rand(9)}1`, nombre: 'Ana Pérez (ficticia)' },
  clienteB: { email: 'bruno.cliente@chocomania.test', password: `Cli-${rand(9)}2`, nombre: 'Bruno Soto (ficticio)' },
};
fs.writeFileSync(path.join(dir, 'seed-accounts.json'), JSON.stringify(seed, null, 2), { mode: 0o600 });

console.log(`[init-secrets] secretos generados en ${dir}`);
console.log('[init-secrets] cuentas de prueba: ver .secrets/seed-accounts.json (no compartir ni versionar)');
