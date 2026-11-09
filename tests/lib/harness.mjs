// Arnés de ejecución y evidencias (Unidad 3).
// Cada prueba recibe un contexto que:
//  - registra comprobaciones (esperado vs. observado) ANTES de clasificar el resultado;
//  - captura solicitudes/respuestas del navegador y de las llamadas API (enmascarando credenciales);
//  - extrae de los logs del backend las líneas con los mismos identificadores de correlación;
//  - permite verificar persistencia con una lectura independiente (API en sesión nueva o SQLite de solo lectura);
//  - guarda capturas de pantalla numeradas.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');
export const { chromium, devices } = require('playwright');

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
export const API = 'http://127.0.0.1:8080/api/v1';
export const WEB = 'http://localhost:8000';
export const SANDBOX = 'http://127.0.0.1:8090';
export const VIEWPORTS = {
  escritorio: { label: 'escritorio 1366x768', options: { viewport: { width: 1366, height: 768 } } },
  movil: { label: 'móvil Pixel 7 emulado 412x839 (DPR 2.625, táctil)', options: { ...devices['Pixel 7'] } },
};

export class Blocked extends Error {}

const MASK = '[ENMASCARADO]';
const SECRET_KEYS = /^(authorization|password|accesstoken|token|cookie|set-cookie|x-internal-auth|x-sandbox-signature)$/i;
export function sanitize(value, depth = 0) {
  if (value === null || typeof value !== 'object' || depth > 8) return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = SECRET_KEYS.test(k) ? MASK : sanitize(v, depth + 1);
  return out;
}
function parseMaybe(text) {
  if (text === null || text === undefined || text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return String(text).slice(0, 500);
  }
}

export function readSeed() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, '.secrets', 'seed-accounts.json'), 'utf8'));
}

export function createRun({ runId, runDir, dataDir, logDir }) {
  fs.mkdirSync(runDir, { recursive: true });

  function db(service) {
    return new DatabaseSync(path.join(dataDir, `${service}.db`), { readOnly: true });
  }

  function backendTrace(cids) {
    const lines = [];
    if (!fs.existsSync(logDir)) return lines;
    for (const f of fs.readdirSync(logDir)) {
      for (const line of fs.readFileSync(path.join(logDir, f), 'utf8').split('\n')) {
        if (!line) continue;
        for (const cid of cids) {
          if (line.includes(cid)) {
            lines.push(line);
            break;
          }
        }
      }
    }
    return lines.sort();
  }

  function createContext(test, browser) {
    const dir = path.join(runDir, test.id);
    fs.mkdirSync(dir, { recursive: true });
    const checks = [];
    const network = [];
    const evidences = [];
    const notes = [];
    const cids = new Set();
    let evN = 0;
    const pages = [];

    const evidence = (kind, file, description) => {
      evN += 1;
      const id = `${test.id}-E${String(evN).padStart(2, '0')}`;
      evidences.push({ id, kind, file: path.relative(runDir, path.join(dir, file)), description });
      return id;
    };

    const ctx = {
      test,
      seed: readSeed(),
      db,
      note: (t) => notes.push(t),
      trace: (cid) => backendTrace([cid]),
      cids,
      /** Comprobación: registra esperado y observado; no detiene la prueba. */
      check(label, expected, observed, pass = JSON.stringify(expected) === JSON.stringify(observed)) {
        checks.push({ label, expected, observed, pass: Boolean(pass) });
        return Boolean(pass);
      },
      saveJson(name, data, description) {
        const file = `${String(evN + 1).padStart(2, '0')}-${name}.json`;
        fs.writeFileSync(path.join(dir, file), JSON.stringify(sanitize(data), null, 2));
        return evidence('datos', file, description);
      },
      /** Llamada directa al API Gateway (cliente de API: diagnóstico y verificación independiente). */
      async api(p, { method = 'GET', body, token, headers = {}, base = API, raw } = {}) {
        const cid = crypto.randomUUID();
        cids.add(cid);
        const h = { 'x-correlation-id': cid, ...headers };
        if (body !== undefined) h['content-type'] = 'application/json';
        if (token) h.authorization = `Bearer ${token}`;
        const started = Date.now();
        let res;
        try {
          res = await fetch(base + p, { method, headers: h, body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(15000) });
        } catch (err) {
          network.push({ origen: 'cliente-api', ts: new Date().toISOString(), method, url: base + p, error: err.message, cid });
          return { status: 0, data: null, cid, error: err.message };
        }
        const text = await res.text();
        const data = parseMaybe(text);
        const rcid = res.headers.get('x-correlation-id');
        if (rcid) cids.add(rcid);
        network.push(sanitize({ origen: 'cliente-api', ts: new Date().toISOString(), ms: Date.now() - started, method, url: base + p, requestHeaders: h, requestBody: body, status: res.status, responseCid: rcid, responseBody: data }));
        return { status: res.status, data, cid: rcid || cid, headers: res.headers };
      },
      async login(account) {
        const r = await ctx.api('/auth/login', { method: 'POST', body: { email: account.email, password: account.password } });
        if (r.status !== 200) throw new Blocked(`No fue posible iniciar sesión con ${account.email} (HTTP ${r.status})`);
        return r.data.data.accessToken;
      },
      /** Abre una página del navegador (escritorio o móvil) con captura de red. */
      async page(vp = 'escritorio') {
        const context = await browser.newContext({ ...VIEWPORTS[vp].options, locale: 'es-CL', timezoneId: 'America/Santiago' });
        const page = await context.newPage();
        page.vpName = vp;
        page.on('request', (req) => {
          const c = req.headers()['x-correlation-id'];
          if (c) cids.add(c);
        });
        page.on('response', async (res) => {
          const url = res.url();
          if (!url.includes(':8080/api/') && !url.includes(':8090/')) return;
          const req = res.request();
          if (req.method() === 'OPTIONS') return;
          let body = null;
          try {
            body = parseMaybe(await res.text());
          } catch {
            body = null;
          }
          const rcid = res.headers()['x-correlation-id'];
          if (rcid) cids.add(rcid);
          network.push(sanitize({ origen: `navegador-${vp}`, ts: new Date().toISOString(), method: req.method(), url, requestHeaders: { 'x-correlation-id': req.headers()['x-correlation-id'], 'idempotency-key': req.headers()['idempotency-key'], authorization: req.headers().authorization ? 'Bearer …' : undefined }, requestBody: parseMaybe(req.postData()), status: res.status(), responseCid: rcid, responseBody: body }));
        });
        page.on('pageerror', (e) => notes.push(`Error JS en página (${vp}): ${e.message}`));
        pages.push(context);
        return page;
      },
      async shot(page, name, description) {
        const file = `${String(evN + 1).padStart(2, '0')}-${page.vpName}-${name}.png`;
        await page.screenshot({ path: path.join(dir, file), fullPage: false });
        return evidence('captura', file, `${description} (${VIEWPORTS[page.vpName].label})`);
      },
      async shotFull(page, name, description) {
        const file = `${String(evN + 1).padStart(2, '0')}-${name}.png`;
        await page.screenshot({ path: path.join(dir, file), fullPage: true });
        return evidence('captura', file, description);
      },
      async loginUi(page, account) {
        await page.locator('[data-testid=user-menu]').click();
        await page.locator('[data-testid=menu-login]').click();
        await page.locator('#loginEmail').fill(account.email);
        await page.locator('#loginPassword').fill(account.password);
        await page.locator('[data-testid=login-submit]').click();
        await page.locator('#authModal').waitFor({ state: 'hidden' });
      },
    };

    async function finish(status, error) {
      for (const c of pages) await c.close().catch(() => {});
      if (network.length) {
        const file = `${String(evN + 1).padStart(2, '0')}-red.json`;
        fs.writeFileSync(path.join(dir, file), JSON.stringify(network, null, 2));
        evidence('red', file, 'Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas');
      }
      await new Promise((r) => setTimeout(r, 300)); // deja que los logs se escriban
      const trace = backendTrace([...cids]);
      if (trace.length) {
        const file = `${String(evN + 1).padStart(2, '0')}-traza-backend.jsonl`;
        fs.writeFileSync(path.join(dir, file), trace.join('\n') + '\n');
        evidence('traza', file, `Logs de gateway y servicios con los mismos identificadores de correlación (${trace.length} líneas)`);
      }
      return { checks, evidences, notes, cids: [...cids], status, error };
    }

    return { ctx, finish };
  }

  return { createContext, db };
}

/** Firma un JWT con la clave del ENTORNO DE PRUEBA (solo para fabricar un token expirado). */
export function forgeExpiredToken(sub, role) {
  const store = JSON.parse(fs.readFileSync(path.join(ROOT, '.secrets', 'store.json'), 'utf8'));
  const key = store.secrets['auth/jwt-signing-key'].value;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: 'chocomania-auth', aud: 'chocomania-api', sub, role, sid: crypto.randomUUID(), iat: now - 1200, exp: now - 300 })}`;
  return `${data}.${crypto.sign('RSA-SHA256', Buffer.from(data), key).toString('base64url')}`;
}

export function allSecretValues() {
  const store = JSON.parse(fs.readFileSync(path.join(ROOT, '.secrets', 'store.json'), 'utf8'));
  const vals = Object.values(store.secrets).map((s) => s.value);
  for (const f of fs.readdirSync(path.join(ROOT, '.secrets', 'identities'))) vals.push(fs.readFileSync(path.join(ROOT, '.secrets', 'identities', f), 'utf8').trim());
  for (const a of Object.values(readSeed())) vals.push(a.password);
  // Para claves PEM se busca un fragmento distintivo del cuerpo.
  return vals.map((v) => (v.includes('BEGIN') ? v.split('\n')[3] : v)).filter((v) => v && v.length >= 12);
}
