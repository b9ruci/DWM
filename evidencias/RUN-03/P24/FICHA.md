# P24 — Administración de estados: PAGADO → EN_PREPARACION y transición inválida (RUN-03)

| Campo | Valor |
|---|---|
| Ejecución | RUN-03 · inicio 2026-11-09T19:49:51−03:00 (America/Santiago) · 1.9 s |
| Flujo / requisito / criterio | F11 / R10 / CA24 |
| Tipo de escenario | éxito y rechazo |
| Versión | commit cc0519c (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Pedido PAGADO de clienteA (precondición por API + sandbox).

**Procedimiento:**
1. Admin abre Pedidos y cambia el pedido a EN_PREPARACION
2. PUT directo EN_PREPARACION → ENTREGADO
3. clienteA consulta su pedido por GraphQL

**Resultado esperado:** La tabla muestra En preparación; la transición inválida recibe 409; el cliente ve EN_PREPARACION; historial con actor admin.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | transición inválida rechazada | `409` | `409` | sí |
| 2 | cliente ve el nuevo estado | `"EN_PREPARACION"` | `"EN_PREPARACION"` | sí |
| 3 | historial con actor admin | `["cliente","payments","admin"]` | `["cliente","payments","admin"]` | sí |

**Verificación / fuentes:** Captura + red + SQLite order_events + GraphQL del cliente.

**Evidencias:**
- P24-E01 (captura): [P24/01-escritorio-en-preparacion.png](../P24/01-escritorio-en-preparacion.png) — Pedido cambiado a En preparación (escritorio 1366x768)
- P24-E02 (red): [P24/02-red.json](../P24/02-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P24-E03 (traza): [P24/03-traza-backend.jsonl](../P24/03-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (52 líneas)

**Vinculación:** 19 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Base nueva por ejecución.
