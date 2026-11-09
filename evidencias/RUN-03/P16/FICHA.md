# P16 — Operaciones protegidas sin sesión (RUN-03)

| Campo | Valor |
|---|---|
| Ejecución | RUN-03 · inicio 2026-11-09T19:49:40−03:00 (America/Santiago) · 0.9 s |
| Flujo / requisito / criterio | F12 / R11 / CA16 |
| Tipo de escenario | rechazo |
| Versión | commit cc0519c (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Visitante sin sesión.

**Procedimiento:**
1. GET /orders, POST /orders y POST /graphql sin token
2. Abrir /pedidos.php sin sesión
3. Intentar confirmar un carrito sin sesión

**Resultado esperado:** 401 AUTH_REQUIRED en las tres; la interfaz pide iniciar sesión y abre el modal al confirmar el carrito; no se crea pedido.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | GET /orders sin sesión | `[401,"AUTH_REQUIRED"]` | `[401,"AUTH_REQUIRED"]` | sí |
| 2 | POST /orders sin sesión | `[401,"AUTH_REQUIRED"]` | `[401,"AUTH_REQUIRED"]` | sí |
| 3 | POST /graphql sin sesión | `[401,"AUTH_REQUIRED"]` | `[401,"AUTH_REQUIRED"]` | sí |
| 4 | pedidos.php pide iniciar sesión | `true` | `true` | sí |
| 5 | se abre modal de inicio de sesión | `true` | `true` | sí |
| 6 | no se crearon pedidos | `10` | `10` | sí |

**Verificación / fuentes:** Respuestas API + capturas.

**Evidencias:**
- P16-E01 (captura): [P16/01-escritorio-requiere-login.png](../P16/01-escritorio-requiere-login.png) — Confirmación de carrito sin sesión (escritorio 1366x768)
- P16-E02 (red): [P16/02-red.json](../P16/02-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P16-E03 (traza): [P16/03-traza-backend.jsonl](../P16/03-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (9 líneas)

**Vinculación:** 6 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** No modifica datos.
