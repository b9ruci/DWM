# P07 — Stock insuficiente: el servidor rechaza y no crea pedido ni descuenta stock (RUN-05)

| Campo | Valor |
|---|---|
| Ejecución | RUN-05 · inicio 2026-11-09T20:04:11-03:00 (America/Santiago) · 1.7 s |
| Flujo / requisito / criterio | F04 / R03 / CA07 · recorrido crítico C2 |
| Tipo de escenario | rechazo / límite |
| Versión | commit a5c99b7 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Mezcla Chocolate Caliente (p-008) con stock 3. Carrito local con 5 unidades (carrito desactualizado; la UI limita a 3, por eso se precarga en localStorage).

**Procedimiento:**
1. Iniciar sesión como clienteB
2. Precargar carrito {p-008: 5}
3. Abrir carrito, completar despacho y confirmar

**Resultado esperado:** HTTP 409 STOCK_INSUFICIENTE; mensaje "No hay stock suficiente…" con detalle disponible=3; no se crea pedido para clienteB y el stock sigue en 3.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | mensaje de stock insuficiente | `true` | `true` | sí |
| 2 | no se crea pedido | `0` | `0` | sí |
| 3 | stock sin cambios | `3` | `3` | sí |

**Verificación / fuentes:** Captura + red + conteo SQLite de pedidos de clienteB + stock vía API.

**Evidencias:**
- P07-E01 (captura): [P07/01-escritorio-sin-stock.png](../P07/01-escritorio-sin-stock.png) — Rechazo por stock insuficiente (escritorio 1366x768)
- P07-E02 (red): [P07/02-red.json](../P07/02-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P07-E03 (traza): [P07/03-traza-backend.jsonl](../P07/03-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (25 líneas)

**Vinculación:** 11 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** No modifica datos.
