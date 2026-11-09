'use strict';
// Orquestador local del sistema completo (alternativa a docker-compose cuando no hay Docker).
// Lo usan `npm start` y el arnés de pruebas (que además detiene/reinicia servicios para
// inyectar fallos controlados).
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const SECRETS = process.env.SECRETS_DIR || path.join(ROOT, '.secrets');

const SERVICES = {
  secrets: { port: 7000, dir: 'secrets' },
  auth: { port: 7001, dir: 'auth' },
  graphql: { port: 7002, dir: 'graphql' },
  inventory: { port: 7003, dir: 'inventory' },
  orders: { port: 7004, dir: 'orders' },
  clients: { port: 7005, dir: 'clients' },
  payments: { port: 7006, dir: 'payments' },
  'payment-sandbox': { port: 8090, dir: 'payment-sandbox' },
  gateway: { port: 8080, dir: 'gateway' },
};
const ORDER = ['secrets', 'clients', 'inventory', 'auth', 'orders', 'payments', 'graphql', 'payment-sandbox', 'gateway'];

async function waitHealthy(url, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (r.ok) return true;
    } catch {
      /* aún no responde */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timeout esperando ${url}`);
}

function createStack({ dataDir = path.join(ROOT, 'backend', 'data'), logDir, env = {}, frontendPort = 8000, quiet = false } = {}) {
  const procs = {};

  function envFor(name, extra = {}) {
    const s = SERVICES[name];
    return {
      ...process.env,
      PORT: String(s.port),
      DATA_DIR: dataDir,
      LOG_DIR: logDir || '',
      LOG_STDOUT: quiet ? 'false' : 'true',
      SECRETS_STORE_FILE: path.join(SECRETS, 'store.json'),
      SECRETS_IDENTITY_FILE: path.join(SECRETS, 'identities', `${name}.token`),
      SEED_ACCOUNTS_FILE: path.join(SECRETS, 'seed-accounts.json'),
      SANDBOX_CONFIG_FILE: path.join(SECRETS, 'provider', 'sandbox.json'),
      PAYMENTS_RETURN_URL: `http://localhost:${frontendPort}/pedidos.php`,
      NODE_NO_WARNINGS: '1',
      ...env,
      ...extra,
    };
  }

  async function start(name, extraEnv = {}) {
    if (procs[name]) return;
    const s = SERVICES[name];
    const child = spawn(process.execPath, [path.join(ROOT, 'backend', 'services', s.dir, 'index.js')], {
      env: envFor(name, extraEnv),
      stdio: quiet ? ['ignore', 'ignore', 'pipe'] : 'inherit',
    });
    if (quiet) child.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
    procs[name] = child;
    child.on('exit', () => {
      if (procs[name] === child) delete procs[name];
    });
    await waitHealthy(`http://127.0.0.1:${s.port}/health`);
  }

  async function stop(name) {
    const child = procs[name];
    if (!child) return;
    delete procs[name];
    await new Promise((resolve) => {
      child.once('exit', resolve);
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 3000).unref();
    });
  }

  async function startFrontend() {
    if (procs.frontend) return;
    const child = spawn('php', ['-S', `127.0.0.1:${frontendPort}`, '-t', path.join(ROOT, 'frontend')], {
      env: { ...process.env, API_BASE_URL: env.API_BASE_URL || 'http://localhost:8080/api/v1' },
      stdio: 'ignore',
    });
    procs.frontend = child;
    await waitHealthy(`http://127.0.0.1:${frontendPort}/index.php`);
  }

  async function startAll({ frontend = true } = {}) {
    if (!fs.existsSync(path.join(SECRETS, 'store.json'))) {
      throw new Error('No hay secretos locales. Ejecute primero: node backend/scripts/init-secrets.js');
    }
    for (const name of ORDER) await start(name);
    if (frontend) await startFrontend();
  }

  async function stopAll() {
    for (const name of Object.keys(procs).reverse()) await stop(name);
  }

  return { start, stop, startAll, stopAll, startFrontend, procs, SERVICES };
}

module.exports = { createStack, SERVICES, ROOT };
