# P20 — Cancelar un pedido pendiente desde la interfaz libera el stock (RUN-01)

| Campo | Valor |
|---|---|
| Ejecución | RUN-01 · inicio 2026-11-09T19:47:14−03:00 (America/Santiago) · 1.8 s |
| Flujo / requisito / criterio | F07 / R06 / CA20 |
| Tipo de escenario | éxito |
| Versión | commit ac929d3 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Pedido PENDIENTE_PAGO de clienteA con 2 Trufas (p-006), creado por API.

**Procedimiento:**
1. Registrar stock de p-006
2. Crear pedido
3. Abrir el detalle y pulsar "Cancelar pedido" (aceptar confirmación)
4. Intentar cancelar nuevamente por API

**Resultado esperado:** La interfaz muestra estado Cancelado; stock vuelve al valor inicial; reserva LIBERADA; segundo intento 409 TRANSICION_INVALIDA; el pedido no se borra (historial conservado).

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | stock reservado | `15` | `15` | sí |
| 2 | stock restaurado | `17` | `17` | sí |
| 3 | reserva liberada | `"LIBERADA"` | `"LIBERADA"` | sí |
| 4 | historial conservado | `["PENDIENTE_PAGO","CANCELADO"]` | `["PENDIENTE_PAGO","CANCELADO"]` | sí |
| 5 | segunda cancelación rechazada | `[409,"TRANSICION_INVALIDA"]` | `[409,"TRANSICION_INVALIDA"]` | sí |

**Verificación / fuentes:** Captura + red + SQLite (orders, order_events, reservations) + stock API.

**Evidencias:**
- P20-E01 (captura): [P20/01-escritorio-cancelado.png](../P20/01-escritorio-cancelado.png) — Pedido cancelado (escritorio 1366x768)
- P20-E02 (red): [P20/02-red.json](../P20/02-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P20-E03 (traza): [P20/03-traza-backend.jsonl](../P20/03-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (61 líneas)

**Vinculación:** 16 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Base nueva por ejecución.
