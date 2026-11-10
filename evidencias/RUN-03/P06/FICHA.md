# P06 — Compra completa: carrito → pedido → pago aprobado en sandbox → PAGADO (RUN-03)

| Campo | Valor |
|---|---|
| Ejecución | RUN-03 · inicio 2026-11-09T19:49:15−03:00 (America/Santiago) · 5.9 s |
| Flujo / requisito / criterio | F04-F05 / R03,R04 / CA06 · recorrido crítico C2 |
| Tipo de escenario | éxito |
| Versión | commit cc0519c (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio, movil |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** clienteA; stock de Choco Miau (p-002) ≥ 2; payments y sandbox disponibles (sandbox = doble de prueba declarado).

**Procedimiento:**
1. Abrir catálogo e iniciar sesión como clienteA
2. Cantidad 2 en Choco Miau → Agregar
3. Ir al carrito, completar despacho
4. Confirmar pedido y pagar
5. En la pasarela sandbox verificar monto y aprobar
6. Volver a Mis pedidos y esperar confirmación
7. Verificar en sesión nueva (GraphQL) y en SQLite de orders, payments e inventory

**Resultado esperado:** Monto en pasarela $11.970 (2×3.990 + despacho 3.990, calculado por el servidor); la interfaz muestra "¡Pago confirmado!"; consulta independiente: pedido PAGADO, pago APROBADO; stock de p-002 disminuye exactamente 2 y la reserva queda CONFIRMADA.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | [escritorio] total estimado en carrito | `"$11.970"` | `"$11.970"` | sí |
| 2 | [escritorio] monto informado por el proveedor | `"$11.970 CLP"` | `"$11.970 CLP"` | sí |
| 3 | [escritorio] la interfaz informa pago aprobado | `"approved"` | `"approved"` | sí |
| 4 | [escritorio] GraphQL (sesión nueva): estado | `"PAGADO"` | `"PAGADO"` | sí |
| 5 | [escritorio] GraphQL: pago | `"APROBADO"` | `"APROBADO"` | sí |
| 6 | [escritorio] GraphQL: total | `11970` | `11970` | sí |
| 7 | [escritorio] orders.db estado | `"PAGADO"` | `"PAGADO"` | sí |
| 8 | [escritorio] payments.db estado y monto | `["APROBADO",11970]` | `["APROBADO",11970]` | sí |
| 9 | [escritorio] inventory.db reserva | `["CONFIRMADA",2]` | `["CONFIRMADA",2]` | sí |
| 10 | [escritorio] stock p-002 disminuye en 2 | `38` | `38` | sí |
| 11 | [movil] total estimado en carrito | `"$11.970"` | `"$11.970"` | sí |
| 12 | [movil] monto informado por el proveedor | `"$11.970 CLP"` | `"$11.970 CLP"` | sí |
| 13 | [movil] la interfaz informa pago aprobado | `"approved"` | `"approved"` | sí |
| 14 | [movil] GraphQL (sesión nueva): estado | `"PAGADO"` | `"PAGADO"` | sí |
| 15 | [movil] GraphQL: pago | `"APROBADO"` | `"APROBADO"` | sí |
| 16 | [movil] GraphQL: total | `11970` | `11970` | sí |
| 17 | [movil] orders.db estado | `"PAGADO"` | `"PAGADO"` | sí |
| 18 | [movil] payments.db estado y monto | `["APROBADO",11970]` | `["APROBADO",11970]` | sí |
| 19 | [movil] inventory.db reserva | `["CONFIRMADA",2]` | `["CONFIRMADA",2]` | sí |
| 20 | [movil] stock p-002 disminuye en 2 | `36` | `36` | sí |

**Verificación / fuentes:** Capturas por paso + red (POST /orders, POST /payments, webhook) + traza por correlación + consulta GraphQL en sesión nueva + lectura SQLite.

**Evidencias:**
- P06-E01 (captura): [P06/01-escritorio-carrito.png](../P06/01-escritorio-carrito.png) — Carrito con 2 Choco Miau (escritorio 1366x768)
- P06-E02 (captura): [P06/02-escritorio-pasarela.png](../P06/02-escritorio-pasarela.png) — Pasarela sandbox con monto calculado por el servidor (escritorio 1366x768)
- P06-E03 (captura): [P06/03-escritorio-confirmado.png](../P06/03-escritorio-confirmado.png) — Pedido confirmado en Mis pedidos (escritorio 1366x768)
- P06-E04 (datos): [P06/04-persistencia-escritorio.json](../P06/04-persistencia-escritorio.json) — Comprobación independiente (escritorio)
- P06-E05 (captura): [P06/05-movil-carrito.png](../P06/05-movil-carrito.png) — Carrito con 2 Choco Miau (móvil Pixel 7 emulado 412x839 (DPR 2.625, táctil))
- P06-E06 (captura): [P06/06-movil-pasarela.png](../P06/06-movil-pasarela.png) — Pasarela sandbox con monto calculado por el servidor (móvil Pixel 7 emulado 412x839 (DPR 2.625, táctil))
- P06-E07 (captura): [P06/07-movil-confirmado.png](../P06/07-movil-confirmado.png) — Pedido confirmado en Mis pedidos (móvil Pixel 7 emulado 412x839 (DPR 2.625, táctil))
- P06-E08 (datos): [P06/08-persistencia-movil.json](../P06/08-persistencia-movil.json) — Comprobación independiente (movil)
- P06-E09 (red): [P06/09-red.json](../P06/09-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P06-E10 (traza): [P06/10-traza-backend.jsonl](../P06/10-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (122 líneas)

**Vinculación:** 34 identificadores de correlación (X-Correlation-Id) presentes en red y traza.

**Notas:** [escritorio] pedido 1d4a44c1-ffc2-4cc7-a2b4-d1591bf142b4 · [movil] pedido e2648893-c54d-429a-b080-806d109115cf

**Restauración:** Base nueva por ejecución (scripts/reset-data.js).
