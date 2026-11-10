# P11 — Notificación duplicada del proveedor y notificación con firma inválida (RUN-04)

| Campo | Valor |
|---|---|
| Ejecución | RUN-04 · inicio 2026-11-09T20:03:10-03:00 (America/Santiago) · 0.5 s |
| Flujo / requisito / criterio | F05 / R04,R11 / CA11 |
| Tipo de escenario | rechazo / duplicado |
| Versión | commit a5c99b7 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: no aplica (API) |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Pedido de clienteB pagado mediante el sandbox (precondición por API).

**Procedimiento:**
1. Crear pedido y aprobar el pago en el sandbox
2. Solicitar al sandbox reenviar el MISMO evento
3. Enviar al webhook una notificación con firma falsa

**Resultado esperado:** El reenvío responde 200 con duplicado=true; webhook_events tiene un único registro y el historial del pedido una sola transición a PAGADO; firma falsa → 401 sin cambios.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | sandbox reenvía el evento | `200` | `200` | sí |
| 2 | eventos registrados para el pago | `1` | `1` | sí |
| 3 | transiciones a PAGADO | `1` | `1` | sí |
| 4 | firma falsa rechazada | `401` | `401` | sí |

**Verificación / fuentes:** Respuestas + SQLite payments.webhook_events + orders.order_events + traza (webhook_duplicate).

**Evidencias:**
- P11-E01 (red): [P11/01-red.json](../P11/01-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P11-E02 (traza): [P11/02-traza-backend.jsonl](../P11/02-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (16 líneas)

**Vinculación:** 6 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Base nueva por ejecución.
