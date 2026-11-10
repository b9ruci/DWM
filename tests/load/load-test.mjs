#!/usr/bin/env node
// Prueba de carga reproducible (Módulo 9 / ADR-001). MEDICIÓN en entorno local, no proyección.
// Escenarios (concurrencia fija, duración fija, cliente HTTP de Node):
//   L1 catálogo anónimo       GET  /api/v1/products              (lectura más frecuente)
//   L2 agregación GraphQL     POST /api/v1/graphql misPedidos    (gateway → graphql → 4 servicios)
//   L3 resumen de ventas      POST /api/v1/graphql resumenVentas (consulta "analítica" sobre orders)
// Objetivo declarado ANTES de medir: p95 < 300 ms y 0 % de errores con 20 usuarios concurrentes
// (≈ 10× el pico proyectado de la tienda: 2.000 visitas/día, pico ~2 solicitudes/s).
// Uso: node tests/load/load-test.mjs [--id CARGA-01] [--concurrency 20] [--seconds 20]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createStack, ROOT } = require('../../backend/scripts/stack.js');
const args = process.argv.slice(2);
const arg = (n, d) => (args.indexOf(`--${n}`) >= 0 ? args[args.indexOf(`--${n}`) + 1] : d);
const ID = arg('id', 'CARGA-01');
const CONC = Number(arg('concurrency', 20));
const SECS = Number(arg('seconds', 20));
const outDir = path.join(ROOT, 'evidencias', ID);
if (fs.existsSync(outDir)) {
  console.error(`${ID} ya existe`);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
const dataDir = path.join(ROOT, '.tmp', 'runs', ID, 'data');
const API = 'http://127.0.0.1:8080/api/v1';
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, '.secrets', 'seed-accounts.json'), 'utf8'));

// El límite por IP del gateway se eleva SOLO para esta medición (todas las solicitudes salen de 127.0.0.1).
const stack = createStack({ dataDir, logDir: path.join(outDir, 'logs-backend'), quiet: true, env: { RATE_LIMIT_DEFAULT: '1000000', RATE_LIMIT_STRICT: '1000' } });

function procStats(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
    const ticks = Number(stat[11]) + Number(stat[12]);
    const rssKb = Number(fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1]);
    return { ticks, rssKb };
  } catch {
    return null;
  }
}
const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.ceil((p / 100) * arr.length) - 1)];

async function scenario(name, makeRequest) {
  const lat = [];
  let errors = 0;
  const statuses = {};
  const pids = Object.fromEntries(Object.entries(stack.procs).map(([k, c]) => [k, c.pid]));
  const before = Object.fromEntries(Object.entries(pids).map(([k, pid]) => [k, procStats(pid)]));
  const peakRss = {};
  const sampler = setInterval(() => {
    for (const [k, pid] of Object.entries(pids)) {
      const s = procStats(pid);
      if (s) peakRss[k] = Math.max(peakRss[k] || 0, s.rssKb);
    }
  }, 500);
  const end = Date.now() + SECS * 1000;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (Date.now() < end) {
      const s = performance.now();
      try {
        const r = await makeRequest();
        statuses[r.status] = (statuses[r.status] || 0) + 1;
        await r.arrayBuffer();
        if (r.status >= 400) errors++;
      } catch {
        errors++;
        statuses.network = (statuses.network || 0) + 1;
      }
      lat.push(performance.now() - s);
    }
  }));
  clearInterval(sampler);
  const elapsed = (Date.now() - t0) / 1000;
  const hz = 100; // USER_HZ habitual en Linux
  const cpu = {};
  for (const [k, pid] of Object.entries(pids)) {
    const a = before[k];
    const b = procStats(pid);
    if (a && b) cpu[k] = `${(((b.ticks - a.ticks) / hz / elapsed) * 100).toFixed(1)} %`;
  }
  lat.sort((a, b) => a - b);
  const r = {
    escenario: name, concurrencia: CONC, duracionS: Math.round(elapsed * 10) / 10, solicitudes: lat.length,
    throughputRps: Math.round((lat.length / elapsed) * 10) / 10, errores: errors, tasaErrores: `${((errors / lat.length) * 100).toFixed(2)} %`, estados: statuses,
    latenciaMs: { p50: +pct(lat, 50).toFixed(1), p95: +pct(lat, 95).toFixed(1), p99: +pct(lat, 99).toFixed(1), max: +lat[lat.length - 1].toFixed(1) },
    cpuPromedioPorProceso: cpu, rssPicoMB: Object.fromEntries(Object.entries(peakRss).map(([k, v]) => [k, +(v / 1024).toFixed(1)])),
  };
  r.objetivo = 'p95 < 300 ms y 0 % errores';
  r.cumpleObjetivo = r.latenciaMs.p95 < 300 && errors === 0;
  console.log(`${name}: ${r.solicitudes} req, ${r.throughputRps} req/s, p95 ${r.latenciaMs.p95} ms, errores ${errors} → ${r.cumpleObjetivo ? 'CUMPLE' : 'NO CUMPLE'}`);
  return r;
}

try {
  await stack.startAll({ frontend: false });
  const login = async (a) => (await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: a.email, password: a.password }) })).json()).data.accessToken;
  const tA = await login(seed.clienteA);
  const tAdm = await login(seed.admin);
  // Datos para que la agregación tenga contenido: 5 pedidos de clienteA (2 pagados vía sandbox).
  for (let i = 0; i < 5; i++) {
    const o = await (await fetch(`${API}/orders`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tA}`, 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify({ items: [{ productId: 'p-002', cantidad: 1 }, { productId: 'p-005', cantidad: 1 }], despacho: { direccion: 'Calle Bombón 123', comuna: 'Providencia' } }) })).json();
    if (i < 2) {
      const p = await (await fetch(`${API}/payments`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tA}` }, body: JSON.stringify({ pedidoId: o.data.id }) })).json();
      await fetch(`${new URL(p.data.checkoutUrl).pathname.replace(/^/, 'http://127.0.0.1:8090')}/approve`, { method: 'POST', redirect: 'manual' });
    }
  }
  const gq = (token, query) => () => fetch(`${API}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ query }) });
  const results = [];
  results.push(await scenario('L1 GET /products (anónimo)', () => fetch(`${API}/products`)));
  results.push(await scenario('L2 GraphQL misPedidos (orders+inventory+payments+clients)', gq(tA, '{ misPedidos(limite:5){ total pedidos{ id estado total completo items{ nombre producto{ nombre } } pago{ estado } cliente{ nombre } } } }')));
  results.push(await scenario('L3 GraphQL resumenVentas (ADMIN)', gq(tAdm, '{ resumenVentas(dias:30){ pedidosPagados ingresos porEstado{ estado cantidad } topProductos{ nombre unidades } } }')));
  const meta = {
    id: ID, tipo: 'MEDICIÓN (no proyección)', fecha: new Date().toISOString(),
    commit: execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(),
    entorno: `${os.type()} ${os.release()}, ${os.cpus().length} vCPU (${os.cpus()[0].model}), ${(os.totalmem() / 2 ** 30).toFixed(1)} GiB RAM, Node ${process.version}; generador de carga en la MISMA máquina (compite por CPU)`,
    datos: 'Semillas ficticias (9 productos) + 5 pedidos de clienteA (2 pagados)',
    configuracion: 'RATE_LIMIT_DEFAULT elevado solo para la medición; resto igual al modo local',
    concurrencia: CONC, duracionPorEscenarioS: SECS,
  };
  fs.writeFileSync(path.join(outDir, 'resultado.json'), JSON.stringify({ ...meta, resultados: results }, null, 2));
  const md = [`# ${ID} — Prueba de carga`, '', ...Object.entries(meta).map(([k, v]) => `- **${k}:** ${v}`), '',
    '| Escenario | Solicitudes | req/s | p50 ms | p95 ms | p99 ms | Errores | ¿Cumple p95<300 y 0 errores? |', '|---|---|---|---|---|---|---|---|',
    ...results.map((r) => `| ${r.escenario} | ${r.solicitudes} | ${r.throughputRps} | ${r.latenciaMs.p50} | ${r.latenciaMs.p95} | ${r.latenciaMs.p99} | ${r.errores} (${r.tasaErrores}) | ${r.cumpleObjetivo ? 'sí' : 'no'} |`),
    '', '**CPU promedio y RSS pico por proceso:**', '',
    ...results.map((r) => `- ${r.escenario}: CPU ${JSON.stringify(r.cpuPromedioPorProceso)} · RSS MB ${JSON.stringify(r.rssPicoMB)}`), ''].join('\n');
  fs.writeFileSync(path.join(outDir, 'RESULTADO.md'), md);
} finally {
  await stack.stopAll();
}
