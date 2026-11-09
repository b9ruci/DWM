# P26 — Proveedor de pagos (sandbox) indisponible al iniciar el pago (RUN-06)

| Campo | Valor |
|---|---|
| Ejecución | RUN-06 · inicio 2026-11-09T20:06:28-03:00 (America/Santiago) · 2.1 s |
| Flujo / requisito / criterio | F05 / R04,R12 / CA26 |
| Tipo de escenario | fallo y recuperación |
| Versión | commit 955ad38 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Pedido PENDIENTE_PAGO de clienteB. Se detiene payment-sandbox.

**Procedimiento:**
1. Crear pedido por API
2. Detener sandbox
3. En Mis pedidos pulsar "Pagar ahora"
4. Reiniciar sandbox y pulsar de nuevo

**Resultado esperado:** Mensaje "El proveedor de pagos no está disponible…" (503) y el pedido sigue PENDIENTE_PAGO con el stock reservado; tras reiniciar, el botón redirige a la pasarela.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | mensaje de proveedor no disponible | `true` | `true` | sí |
| 2 | pedido sigue pendiente | `"PENDIENTE_PAGO"` | `"PENDIENTE_PAGO"` | sí |
| 3 | intento registrado como ERROR | `["ERROR"]` | `["ERROR"]` | sí |
| 4 | recuperación: llega a la pasarela | `true` | `true` | sí |

**Verificación / fuentes:** Captura + red + SQLite (payments ERROR, orders PENDIENTE_PAGO).

**Evidencias:**
- P26-E01 (captura): [P26/01-escritorio-proveedor-caido.png](../P26/01-escritorio-proveedor-caido.png) — Pago con proveedor indisponible (escritorio 1366x768)
- P26-E02 (red): [P26/02-red.json](../P26/02-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P26-E03 (traza): [P26/03-traza-backend.jsonl](../P26/03-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (43 líneas)

**Vinculación:** 11 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Sandbox reiniciado (también en caso de error).
