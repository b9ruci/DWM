# P18 — Cliente intenta operaciones de administración (RUN-07)

| Campo | Valor |
|---|---|
| Ejecución | RUN-07 · inicio 2026-11-09T20:07:20-03:00 (America/Santiago) · 1.6 s |
| Flujo / requisito / criterio | F10-F11 / R09,R10,R11 / CA18 |
| Tipo de escenario | rechazo (rol sin permiso) |
| Versión | commit 955ad38 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Sesión de clienteA.

**Procedimiento:**
1. POST /admin/products
2. DELETE /admin/products/p-002
3. GET /admin/orders y GET /admin/clients
4. Abrir /admin.php con sesión de cliente

**Resultado esperado:** 403 FORBIDDEN en todas; p-002 sigue activo; la página muestra "No tienes permisos…" sin datos administrativos.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | POST /admin/products como cliente | `403` | `403` | sí |
| 2 | DELETE /admin/products/p-002 como cliente | `403` | `403` | sí |
| 3 | GET /admin/orders como cliente | `403` | `403` | sí |
| 4 | GET /admin/clients como cliente | `403` | `403` | sí |
| 5 | p-002 sigue activo | `1` | `1` | sí |
| 6 | no se creó HACK-1 | `undefined` | `undefined` | sí |
| 7 | admin.php denegado en la interfaz | `"FORBIDDEN"` | `"FORBIDDEN"` | sí |

**Verificación / fuentes:** Respuestas API + SQLite inventory + captura.

**Evidencias:**
- P18-E01 (captura): [P18/01-escritorio-admin-denegado.png](../P18/01-escritorio-admin-denegado.png) — Cliente en /admin.php (escritorio 1366x768)
- P18-E02 (red): [P18/02-red.json](../P18/02-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P18-E03 (traza): [P18/03-traza-backend.jsonl](../P18/03-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (19 líneas)

**Vinculación:** 10 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** No modifica datos.
