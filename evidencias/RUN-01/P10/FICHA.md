# P10 — Pago rechazado por el proveedor y nuevo intento aprobado (RUN-01)

| Campo | Valor |
|---|---|
| Ejecución | RUN-01 · inicio 2026-11-09T19:46:57−03:00 (America/Santiago) · 3 s |
| Flujo / requisito / criterio | F05 / R04 / CA10 · recorrido crítico C2 |
| Tipo de escenario | rechazo y recuperación |
| Versión | commit ac929d3 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** clienteB; Flor de Chocolate (p-004) con stock.

**Procedimiento:**
1. Comprar 1 Flor de Chocolate desde la interfaz
2. En la pasarela pulsar "Rechazar pago"
3. Observar resultado en Mis pedidos
4. Pulsar "Pagar ahora" y aprobar

**Resultado esperado:** Tras el rechazo la interfaz informa "El pago fue rechazado"; pedido PENDIENTE_PAGO y pago RECHAZADO en la base; tras el nuevo intento el pedido queda PAGADO con un segundo pago APROBADO.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | interfaz informa rechazo | `"rejected"` | `"rejected"` | sí |
| 2 | pedido sigue PENDIENTE_PAGO | `"PENDIENTE_PAGO"` | `"PENDIENTE_PAGO"` | sí |
| 3 | pago RECHAZADO registrado | `["RECHAZADO"]` | `["RECHAZADO"]` | sí |
| 4 | pedido PAGADO | `"PAGADO"` | `"PAGADO"` | sí |
| 5 | historial de pagos | `["APROBADO","RECHAZADO"]` | `["APROBADO","RECHAZADO"]` | sí |

**Verificación / fuentes:** Capturas + red + SQLite payments/orders.

**Evidencias:**
- P10-E01 (captura): [P10/01-escritorio-rechazado.png](../P10/01-escritorio-rechazado.png) — Pago rechazado (escritorio 1366x768)
- P10-E02 (captura): [P10/02-escritorio-aprobado.png](../P10/02-escritorio-aprobado.png) — Segundo intento aprobado (escritorio 1366x768)
- P10-E03 (red): [P10/03-red.json](../P10/03-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P10-E04 (traza): [P10/04-traza-backend.jsonl](../P10/04-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (71 líneas)

**Vinculación:** 18 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Base nueva por ejecución.
