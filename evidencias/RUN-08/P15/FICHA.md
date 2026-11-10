# P15 — GraphQL con inventory caído: información parcial advertida y recuperación (RUN-08)

| Campo | Valor |
|---|---|
| Ejecución | RUN-08 · inicio 2026-11-09T23:15:10-03:00 (America/Santiago) · 2 s |
| Flujo / requisito / criterio | F06 / R05,R12 / CA15 · recorrido crítico C3 |
| Tipo de escenario | fallo y recuperación |
| Versión | commit 7dd2c2e (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) — ejecución desde clon limpio con secretos nuevos |
| **Estado** | **APROBADA** |

**Precondiciones:** Pedido de clienteA (por API). Se detiene inventory.

**Procedimiento:**
1. Crear pedido
2. Detener inventory
3. Abrir /pedidos.php?pedido={id}
4. Observar advertencia
5. Reiniciar inventory y pulsar "Actualizar"

**Resultado esperado:** Pantalla muestra "Información parcial" y el nombre del producto guardado en el pedido; GraphQL responde completo=false con error DEPENDENCY_UNAVAILABLE en items.producto; tras reiniciar, la advertencia desaparece (completo=true).

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | GraphQL marca completo=false | `false` | `false` | sí |
| 2 | error parcial tipificado | `true` | `true` | sí |
| 3 | nombre del producto (instantánea de orders) visible | `true` | `true` | sí |
| 4 | advertencia desaparece tras recuperación | `0` | `0` | sí |

**Verificación / fuentes:** Capturas + red GraphQL + traza (downstream_failure en graphql).

**Evidencias:**
- P15-E01 (captura): [P15/01-escritorio-parcial.png](../P15/01-escritorio-parcial.png) — Detalle con advertencia de información parcial (escritorio 1366x768)
- P15-E02 (captura): [P15/02-escritorio-recuperado.png](../P15/02-escritorio-recuperado.png) — Detalle completo tras reiniciar inventory (escritorio 1366x768)
- P15-E03 (red): [P15/03-red.json](../P15/03-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P15-E04 (traza): [P15/04-traza-backend.jsonl](../P15/04-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (48 líneas)

**Vinculación:** 11 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** inventory reiniciado (también en caso de error).
