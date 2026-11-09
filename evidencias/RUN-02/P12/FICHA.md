# P12 — Mis pedidos: agregación GraphQL (orders + inventory + payments + clients) en pantalla real (RUN-02)

| Campo | Valor |
|---|---|
| Ejecución | RUN-02 · inicio 2026-11-09T19:48:20−03:00 (America/Santiago) · 3.9 s |
| Flujo / requisito / criterio | F06 / R05 / CA12 · recorrido crítico C3 |
| Tipo de escenario | éxito |
| Versión | commit cc0519c (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio, movil |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** clienteA con un pedido pagado creado en la prueba (por API).

**Procedimiento:**
1. Crear pedido (2 Bombones) y aprobar pago (precondición)
2. Abrir /pedidos.php?pedido={id} con sesión de clienteA
3. Leer total, estados y titular
4. Comparar con GET /orders/{id} (REST) y con la traza del backend

**Resultado esperado:** La pantalla muestra total $29.970 (2×12.990 + despacho 3.990), estado Pagado, pago aprobado y titular "Ana Pérez (ficticia)"; coincide con orders; la traza muestra que, con el mismo identificador de correlación, el gateway validó la sesión en auth y graphql consultó orders, inventory, payments y clients.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | [escritorio] total en pantalla = orders | `"$29.970"` | `"$29.970"` | sí |
| 2 | [escritorio] estados visibles | `["PAGADO","APROBADO"]` | `["PAGADO","APROBADO"]` | sí |
| 3 | [escritorio] titular desde clients | `true` | `true` | sí |
| 4 | [escritorio] servicios en la traza de la consulta GraphQL (cid 1cfcc9c5) | `["auth","clients","gateway","graphql","inventory","orders","payments"]` | `["auth","clients","gateway","graphql","inventory","orders","payments"]` | sí |
| 5 | [movil] total en pantalla = orders | `"$29.970"` | `"$29.970"` | sí |
| 6 | [movil] estados visibles | `["PAGADO","APROBADO"]` | `["PAGADO","APROBADO"]` | sí |
| 7 | [movil] titular desde clients | `true` | `true` | sí |
| 8 | [movil] servicios en la traza de la consulta GraphQL (cid 8bb59556) | `["auth","clients","gateway","graphql","inventory","orders","payments"]` | `["auth","clients","gateway","graphql","inventory","orders","payments"]` | sí |
| 9 | total REST | `29970` | `29970` | sí |

**Verificación / fuentes:** Capturas + red (POST /graphql) + REST independiente + traza backend.

**Evidencias:**
- P12-E01 (captura): [P12/01-escritorio-detalle.png](../P12/01-escritorio-detalle.png) — Detalle agregado del pedido (escritorio 1366x768)
- P12-E02 (captura): [P12/02-movil-detalle.png](../P12/02-movil-detalle.png) — Detalle agregado del pedido (móvil Pixel 7 emulado 412x839 (DPR 2.625, táctil))
- P12-E03 (red): [P12/03-red.json](../P12/03-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P12-E04 (traza): [P12/04-traza-backend.jsonl](../P12/04-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (67 líneas)

**Vinculación:** 19 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Base nueva por ejecución.
