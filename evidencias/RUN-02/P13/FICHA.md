# P13 — Un cliente no puede ver, pagar ni cancelar el pedido de otro cliente (RUN-02)

| Campo | Valor |
|---|---|
| Ejecución | RUN-02 · inicio 2026-11-09T19:48:24−03:00 (America/Santiago) · 3.1 s |
| Flujo / requisito / criterio | F06 / R05,R11 / CA13 · recorrido crítico C3 |
| Tipo de escenario | rechazo (recurso ajeno) |
| Versión | commit cc0519c (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio, movil |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Pedido PENDIENTE_PAGO de clienteA (creado por API). clienteB con sesión.

**Procedimiento:**
1. clienteA crea un pedido
2. clienteB abre /pedidos.php?pedido={id de A}
3. clienteB intenta GET /orders/{id}, POST /payments y POST /orders/{id}/cancel
4. Verificar que el pedido no cambió

**Resultado esperado:** La interfaz muestra "Pedido no encontrado" sin dirección ni nombre de A; GraphQL devuelve pedido=null; REST 404 en las tres operaciones; el pedido sigue PENDIENTE_PAGO.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | [escritorio] GraphQL devuelve pedido null | `null` | `null` | sí |
| 2 | [escritorio] mensaje "Pedido no encontrado" | `true` | `true` | sí |
| 3 | [escritorio] no se revelan datos de A | `false` | `false` | sí |
| 4 | [movil] GraphQL devuelve pedido null | `null` | `null` | sí |
| 5 | [movil] mensaje "Pedido no encontrado" | `true` | `true` | sí |
| 6 | [movil] no se revelan datos de A | `false` | `false` | sí |
| 7 | GET pedido ajeno | `404` | `404` | sí |
| 8 | pagar pedido ajeno | `404` | `404` | sí |
| 9 | cancelar pedido ajeno | `404` | `404` | sí |
| 10 | pedido sin modificaciones | `"PENDIENTE_PAGO"` | `"PENDIENTE_PAGO"` | sí |

**Verificación / fuentes:** Capturas + red (respuesta GraphQL) + respuestas API + SQLite.

**Evidencias:**
- P13-E01 (captura): [P13/01-escritorio-ajeno.png](../P13/01-escritorio-ajeno.png) — clienteB intentando ver un pedido de clienteA (escritorio 1366x768)
- P13-E02 (captura): [P13/02-movil-ajeno.png](../P13/02-movil-ajeno.png) — clienteB intentando ver un pedido de clienteA (móvil Pixel 7 emulado 412x839 (DPR 2.625, táctil))
- P13-E03 (red): [P13/03-red.json](../P13/03-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P13-E04 (traza): [P13/04-traza-backend.jsonl](../P13/04-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (66 líneas)

**Vinculación:** 20 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Base nueva por ejecución.
