# P03 — inventory indisponible: mensaje comprensible y recuperación con "Reintentar" (RUN-07)

| Campo | Valor |
|---|---|
| Ejecución | RUN-07 · inicio 2026-11-09T20:06:49-03:00 (America/Santiago) · 0.9 s |
| Flujo / requisito / criterio | F01 / R12 / CA03 · recorrido crítico C1 |
| Tipo de escenario | fallo y recuperación |
| Versión | commit 955ad38 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Sistema completo en ejecución. Se detiene el proceso inventory (fallo controlado).

**Procedimiento:**
1. Detener inventory
2. Abrir /catalogo.php
3. Observar estado de error
4. Reiniciar inventory
5. Pulsar "Reintentar"

**Resultado esperado:** Con inventory detenido la pantalla muestra "El servicio no está disponible…" con referencia de correlación (HTTP 503 SERVICE_UNAVAILABLE), sin datos falsos; tras reiniciar, "Reintentar" carga la grilla.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | código de error presentado | `"SERVICE_UNAVAILABLE"` | `"SERVICE_UNAVAILABLE"` | sí |
| 2 | referencia de correlación visible | `true` | `true` | sí |
| 3 | no se muestran productos | `0` | `0` | sí |
| 4 | recupera la grilla tras reintentar | `true` | `true` | sí |

**Verificación / fuentes:** Capturas antes/después + red (503 y luego 200) + traza gateway (downstream_failure).

**Evidencias:**
- P03-E01 (captura): [P03/01-escritorio-error.png](../P03/01-escritorio-error.png) — Catálogo con inventory detenido (escritorio 1366x768)
- P03-E02 (captura): [P03/02-escritorio-recuperado.png](../P03/02-escritorio-recuperado.png) — Catálogo recuperado tras reiniciar inventory (escritorio 1366x768)
- P03-E03 (red): [P03/03-red.json](../P03/03-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P03-E04 (traza): [P03/04-traza-backend.jsonl](../P03/04-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (8 líneas)

**Vinculación:** 4 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** inventory reiniciado al final de la prueba (también en caso de error).
