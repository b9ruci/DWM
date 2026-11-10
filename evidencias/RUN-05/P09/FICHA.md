# P09 — Datos alterados por el navegador: precio, monto y estado de pago no son confiables (RUN-05)

| Campo | Valor |
|---|---|
| Ejecución | RUN-05 · inicio 2026-11-09T20:04:15-03:00 (America/Santiago) · 0.4 s |
| Flujo / requisito / criterio | F04-F05 / R03,R04,R11 / CA09 |
| Tipo de escenario | rechazo |
| Versión | commit a5c99b7 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: no aplica (API) |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** clienteA con sesión (cliente API, equivalente a modificar la solicitud desde las herramientas del navegador).

**Procedimiento:**
1. POST /orders con items[].precio = 1
2. POST /payments con monto = 1
3. PUT /admin/orders/{id}/status {estado: PAGADO} como cliente
4. Consultar el pedido

**Resultado esperado:** El total del pedido usa el precio de inventory (2×3.990+3.990 = 11.970); monto en POST /payments → 400 (campo no permitido); cambio de estado → 403; el pedido sigue PENDIENTE_PAGO.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | pedido creado con precio del servidor | `[201,11970]` | `[201,11970]` | sí |
| 2 | monto enviado por el navegador rechazado | `400` | `400` | sí |
| 3 | cliente no puede marcar PAGADO | `403` | `403` | sí |
| 4 | pedido sigue pendiente | `"PENDIENTE_PAGO"` | `"PENDIENTE_PAGO"` | sí |

**Verificación / fuentes:** Respuestas API + SQLite orders.

**Evidencias:**
- P09-E01 (red): [P09/01-red.json](../P09/01-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P09-E02 (traza): [P09/02-traza-backend.jsonl](../P09/02-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (12 líneas)

**Vinculación:** 4 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Deja un pedido PENDIENTE_PAGO (base nueva por ejecución).
