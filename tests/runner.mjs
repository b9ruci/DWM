#!/usr/bin/env node
// Ejecutor del protocolo de pruebas (Unidad 3).
// Uso: node tests/runner.mjs --run RUN-02 [--only P01,P06] [--executor "Nombre"]
// - Parte SIEMPRE de un estado inicial controlado: bases de datos nuevas para la ejecución
//   (migraciones + semillas ficticias) y secretos locales existentes.
// - No sobrescribe ejecuciones anteriores (integridad: los resultados originales se conservan).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createRun, chromium, ROOT, Blocked, VIEWPORTS } from './lib/harness.mjs';
import funcionales from './suites/funcionales.mjs';
import controles, { protection } from './suites/controles.mjs';

const require = createRequire(import.meta.url);
const { createStack } = require('../backend/scripts/stack.js');

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const runId = arg('run');
if (!runId || !/^RUN-\d{2,}[A-Za-z0-9-]*$/.test(runId)) {
  console.error('Uso: node tests/runner.mjs --run RUN-NN [--only P01,P02] [--executor "Nombre"]');
  process.exit(1);
}
const only = arg('only') ? arg('only').split(',') : null;
const executor = arg('executor', process.env.TEST_EXECUTOR || 'Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo');
// --scratch: ejecución de depuración del propio arnés (no forma parte del paquete de evidencias).
const runDir = args.includes('--scratch') ? path.join(ROOT, '.tmp', 'scratch', runId) : path.join(ROOT, 'evidencias', runId);
if (fs.existsSync(runDir)) {
  console.error(`La ejecución ${runId} ya existe; use un nuevo ID (los resultados previos no se sobrescriben).`);
  process.exit(1);
}
const dataDir = path.join(ROOT, '.tmp', 'runs', runId, 'data');
const logDir = path.join(runDir, 'logs-backend');
fs.mkdirSync(dataDir, { recursive: true });

const TZ = 'America/Santiago';
function localIso(d = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'longOffset' }).format(d);
  const [date, time, off] = parts.split(' ');
  return `${date}T${time}${off.replace('GMT', '').replace('\u2212', '-') || '+00:00'} (${TZ})`;
}
const sh = (c) => {
  try {
    return execSync(c, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'desconocido';
  }
};

const RATE_LIMIT_STRICT = 60;
const TESTS = [...funcionales, ...controles];
const selected = TESTS.filter((t) => !only || only.includes(t.id));

const stack = createStack({ dataDir, logDir, quiet: true, env: { RATE_LIMIT_STRICT: String(RATE_LIMIT_STRICT) } });
const meta = {
  ejecucion: runId,
  inicio: localIso(),
  ejecutor: executor,
  version: { commit: sh('git rev-parse --short HEAD'), rama: sh('git rev-parse --abbrev-ref HEAD'), cambiosSinCommit: sh('git status --porcelain -- backend frontend tests').split('\n').filter(Boolean).length },
  entorno: { so: `${os.type()} ${os.release()}`, node: process.version, php: sh('php -r "echo PHP_VERSION;"'), modo: 'local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090' },
  navegador: null,
  viewports: Object.fromEntries(Object.entries(VIEWPORTS).map(([k, v]) => [k, v.label])),
  estadoInicial: `Bases SQLite nuevas en ${path.relative(ROOT, dataDir)} (migraciones + semillas ficticias). Cuentas: admin, clienteA, clienteB (contraseñas fuera del repositorio).`,
  configuracion: { RATE_LIMIT_STRICT, ACCESS_TOKEN_TTL_SECONDS: 900, GRAPHQL_MAX_COST: 500, GRAPHQL_MAX_DEPTH: 5, timeoutGatewayMs: 4000 },
  dependencias: { 'payment-sandbox': 'DOBLE DE PRUEBA del proveedor de pagos (no demuestra interoperabilidad con un proveedor real)', resto: 'servicios propios reales' },
  pruebasSeleccionadas: selected.map((t) => t.id).concat(only && !only.includes('P29') ? [] : ['P29']),
};

const results = [];
let browser;
try {
  console.log(`[${runId}] iniciando sistema…`);
  await stack.startAll();
  browser = await chromium.launch();
  meta.navegador = `Chromium ${browser.version()} (Playwright, headless)`;
  const run = createRun({ runId, runDir, dataDir, logDir });
  const env = { stack, browser, runDir, rateLimitStrict: RATE_LIMIT_STRICT };

  const execOne = async (t) => {
    const started = localIso();
    const t0 = Date.now();
    const { ctx, finish } = run.createContext(t, browser);
    let status;
    let error = null;
    try {
      await Promise.race([t.run.call(t, ctx, env), new Promise((_, rej) => setTimeout(() => rej(new Error('Tiempo máximo de la prueba (180 s) excedido')), 180000))]);
      status = 'PENDIENTE';
    } catch (err) {
      if (err instanceof Blocked) {
        status = 'BLOQUEADA';
        error = err.message;
      } else {
        status = 'FALLIDA';
        error = err.message.split('\n')[0];
      }
    }
    const out = await finish(status, error);
    if (status === 'PENDIENTE') status = out.checks.length && out.checks.every((c) => c.pass) ? 'APROBADA' : 'FALLIDA';
    const r = { ...pick(t), inicio: started, duracionS: Math.round((Date.now() - t0) / 100) / 10, estado: status, error, comprobaciones: out.checks, evidencias: out.evidences, notas: out.notes, correlaciones: out.cids.length };
    results.push(r);
    writeFicha(r);
    console.log(`[${runId}] ${t.id} ${status.padEnd(9)} ${r.duracionS}s  ${t.titulo}${error ? `  → ${error}` : ''}`);
  };

  for (const t of selected) await execOne(t);
  if (!only || only.includes('P29')) await execOne(protection);
} catch (err) {
  console.error(`[${runId}] error del arnés:`, err);
  meta.errorArnes = err.message;
} finally {
  if (browser) await browser.close();
  await stack.stopAll();
}
// Pruebas planificadas que no llegaron a ejecutarse por un error del arnés.
for (const t of [...selected, protection]) {
  if ((!only || only.includes(t.id)) && !results.find((r) => r.id === t.id)) results.push({ ...pick(t), estado: 'NO_EJECUTADA', error: meta.errorArnes || 'no ejecutada', comprobaciones: [], evidencias: [], notas: [] });
}
meta.fin = localIso();
const resumen = results.reduce((acc, r) => ((acc[r.estado] = (acc[r.estado] || 0) + 1), acc), {});
fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({ ...meta, resumen, resultados: results }, null, 2));
fs.writeFileSync(path.join(runDir, 'RESULTADOS.md'), report(meta, resumen, results));
console.log(`[${runId}] resumen:`, resumen);
process.exit(0);

function pick(t) {
  return { id: t.id, titulo: t.titulo, flujo: t.flujo, requisito: t.requisito, criterio: t.criterio, critico: t.critico || null, tipo: t.tipo, viewports: t.viewports, precondiciones: t.precondiciones, pasos: t.pasos, esperado: t.esperado, verificacion: t.verificacion, restauracion: t.restauracion };
}
function fmt(v) {
  return v === undefined ? 'undefined' : JSON.stringify(v);
}
function writeFicha(r) {
  const dir = path.join(runDir, r.id);
  fs.mkdirSync(dir, { recursive: true });
  const lines = [
    `# ${r.id} — ${r.titulo} (${runId})`,
    '',
    `| Campo | Valor |`, `|---|---|`,
    `| Ejecución | ${runId} · inicio ${r.inicio} · ${r.duracionS} s |`,
    `| Flujo / requisito / criterio | ${r.flujo} / ${r.requisito} / ${r.criterio}${r.critico ? ` · recorrido crítico ${r.critico}` : ''} |`,
    `| Tipo de escenario | ${r.tipo} |`,
    `| Versión | commit ${meta.version.commit} (${meta.version.cambiosSinCommit} archivos sin commit en backend/frontend/tests) |`,
    `| Entorno | ${meta.entorno.modo}; ${meta.navegador}; viewports: ${(r.viewports || []).join(', ') || 'no aplica (API)'} |`,
    `| Ejecutor | ${meta.ejecutor} |`,
    `| **Estado** | **${r.estado}**${r.error ? ` — ${r.error}` : ''} |`,
    '',
    `**Precondiciones:** ${r.precondiciones}`,
    '',
    '**Procedimiento:**',
    ...(r.pasos || []).map((p, i) => `${i + 1}. ${p}`),
    '',
    `**Resultado esperado:** ${r.esperado}`,
    '',
    '**Resultado observado (comprobaciones registradas antes de clasificar):**',
    '',
    '| # | Comprobación | Esperado | Observado | ¿Cumple? |', '|---|---|---|---|---|',
    ...r.comprobaciones.map((c, i) => `| ${i + 1} | ${c.label} | \`${fmt(c.expected)}\` | \`${fmt(c.observed)}\` | ${c.pass ? 'sí' : '**NO**'} |`),
    '',
    `**Verificación / fuentes:** ${r.verificacion}`,
    '',
    '**Evidencias:**',
    ...r.evidencias.map((e) => `- ${e.id} (${e.kind}): [${e.file}](../${e.file.replace(/ /g, '%20')}) — ${e.description}`),
    '',
    `**Vinculación:** ${r.correlaciones} identificadores de correlación (X-Correlation-Id) presentes en red y traza.`,
    r.notas && r.notas.length ? `\n**Notas:** ${r.notas.join(' · ')}` : '',
    '',
    `**Restauración:** ${r.restauracion}`,
    '',
  ];
  fs.writeFileSync(path.join(dir, 'FICHA.md'), lines.join('\n'));
}
function report(m, s, rs) {
  return [
    `# Resultados ${m.ejecucion}`,
    '',
    `- Inicio: ${m.inicio} · Fin: ${m.fin}`,
    `- Ejecutor: ${m.ejecutor}`,
    `- Versión: commit \`${m.version.commit}\` (rama ${m.version.rama}; ${m.version.cambiosSinCommit} archivos sin commit en backend/frontend/tests)`,
    `- Navegador: ${m.navegador}`,
    `- Viewports: ${Object.values(m.viewports).join(' · ')}`,
    `- Estado inicial: ${m.estadoInicial}`,
    `- Dependencias: ${m.dependencias['payment-sandbox']}; ${m.dependencias.resto}`,
    m.errorArnes ? `- **Error del arnés:** ${m.errorArnes}` : '',
    '',
    `**Resumen:** ${Object.entries(s).map(([k, v]) => `${k}: ${v}`).join(' · ')} (total ${rs.length} pruebas distintas)`,
    '',
    '| Prueba | Flujo | Req. | Crítico | Tipo | Estado | Compr. OK | Evidencias |', '|---|---|---|---|---|---|---|---|',
    ...rs.map((r) => `| [${r.id}](${r.id}/FICHA.md) ${r.titulo} | ${r.flujo} | ${r.requisito} | ${r.critico || ''} | ${r.tipo} | **${r.estado}** | ${r.comprobaciones.filter((c) => c.pass).length}/${r.comprobaciones.length} | ${r.evidencias.length} |`),
    '',
    'Los logs completos del backend de esta ejecución están en `logs-backend/` (JSON por línea, sin secretos).',
    '',
  ].join('\n');
}
