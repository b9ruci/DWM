# P25 — inventory con respuesta demorada 5 s: el gateway corta a los 4 s y la interfaz lo comunica (RUN-03)

| Campo | Valor |
|---|---|
| Ejecución | RUN-03 · inicio 2026-11-09T19:49:53−03:00 (America/Santiago) · 5.6 s |
| Flujo / requisito / criterio | F01 / R12 / CA25 |
| Tipo de escenario | fallo (demora controlada) |
| Versión | commit cc0519c (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** inventory reiniciado con FAULT_DELAY_MS=5000 (inyección de fallos de prueba).

**Procedimiento:**
1. Reiniciar inventory con demora
2. Abrir /catalogo.php
3. Medir tiempo hasta el mensaje
4. Reiniciar inventory sin demora y reintentar

**Resultado esperado:** Error UPSTREAM_TIMEOUT (504) "El servicio tardó demasiado…" en ≈4 s (< 6 s); tras restablecer, "Reintentar" carga el catálogo.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | código UPSTREAM_TIMEOUT | `"UPSTREAM_TIMEOUT"` | `"UPSTREAM_TIMEOUT"` | sí |
| 2 | mensaje en menos de 6 s | `"< 6 s"` | `"4.4 s"` | sí |
| 3 | recupera tras restablecer | `true` | `true` | sí |

**Verificación / fuentes:** Captura + red (504) + traza (downstream_failure timeout=true).

**Evidencias:**
- P25-E01 (captura): [P25/01-escritorio-demora.png](../P25/01-escritorio-demora.png) — Catálogo con inventory demorado (escritorio 1366x768)
- P25-E02 (red): [P25/02-red.json](../P25/02-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P25-E03 (traza): [P25/03-traza-backend.jsonl](../P25/03-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (8 líneas)

**Vinculación:** 4 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** inventory reiniciado sin demora (también en caso de error).
