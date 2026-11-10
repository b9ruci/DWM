# P27 — Límite de solicitudes en una ruta anónima sensible (contact-requests) (RUN-02)

| Campo | Valor |
|---|---|
| Ejecución | RUN-02 · inicio 2026-11-09T19:48:50−03:00 (America/Santiago) · 0.5 s |
| Flujo / requisito / criterio | F09 / R11 / CA27 |
| Tipo de escenario | límite |
| Versión | commit cc0519c (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: no aplica (API) |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Límite estricto configurado en la ejecución (RATE_LIMIT_STRICT, ver run.json).

**Procedimiento:**
1. Enviar límite+5 solicitudes inválidas seguidas desde la misma IP

**Resultado esperado:** Las primeras reciben 400; al superar el límite, 429 RATE_LIMITED con Retry-After; no se crean registros.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | se alcanza 429 | `true` | `true` | sí |
| 2 | cabecera Retry-After presente | `true` | `true` | sí |
| 3 | sin registros creados | `1` | `1` | sí |

**Verificación / fuentes:** Conteo de estados + SQLite.

**Evidencias:**
- P27-E01 (datos): [P27/01-estados.json](../P27/01-estados.json) — Conteo de códigos HTTP
- P27-E02 (red): [P27/02-red.json](../P27/02-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P27-E03 (traza): [P27/03-traza-backend.jsonl](../P27/03-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (123 líneas)

**Vinculación:** 65 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** La ventana se reinicia al minuto.
