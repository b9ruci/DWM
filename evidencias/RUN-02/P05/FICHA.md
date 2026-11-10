# P05 — Credenciales inválidas y contraseña débil (RUN-02)

| Campo | Valor |
|---|---|
| Ejecución | RUN-02 · inicio 2026-11-09T19:48:03−03:00 (America/Santiago) · 1.4 s |
| Flujo / requisito / criterio | F03 / R02 / CA05 |
| Tipo de escenario | rechazo |
| Versión | commit cc0519c (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Cuenta semilla clienteA existente.

**Procedimiento:**
1. Intentar login en la interfaz con contraseña errónea
2. Observar mensaje
3. POST /auth/register con contraseña "abc" (cliente API)
4. POST /auth/register con correo existente

**Resultado esperado:** Mensaje genérico "Correo o contraseña incorrectos" (401) sin token; registro débil 400 VALIDATION_ERROR; correo existente 409.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | mensaje genérico | `true` | `true` | sí |
| 2 | no se guarda sesión | `null` | `null` | sí |
| 3 | contraseña débil rechazada | `400` | `400` | sí |
| 4 | correo duplicado rechazado | `409` | `409` | sí |

**Verificación / fuentes:** Captura + red + respuestas API.

**Evidencias:**
- P05-E01 (captura): [P05/01-escritorio-login-fallido.png](../P05/01-escritorio-login-fallido.png) — Login con contraseña incorrecta (escritorio 1366x768)
- P05-E02 (red): [P05/02-red.json](../P05/02-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P05-E03 (traza): [P05/03-traza-backend.jsonl](../P05/03-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (16 líneas)

**Vinculación:** 7 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Un intento fallido queda contado (se reinicia al siguiente login correcto).
