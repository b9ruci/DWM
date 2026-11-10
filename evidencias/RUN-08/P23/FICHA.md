# P23 — Administración de productos: alta y baja lógica reflejadas en el catálogo público (RUN-08)

| Campo | Valor |
|---|---|
| Ejecución | RUN-08 · inicio 2026-11-09T23:15:21-03:00 (America/Santiago) · 2.6 s |
| Flujo / requisito / criterio | F10 / R09 / CA23 |
| Tipo de escenario | éxito |
| Versión | commit 7dd2c2e (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) — ejecución desde clon limpio con secretos nuevos |
| **Estado** | **APROBADA** |

**Precondiciones:** Cuenta admin. SKU único por ejecución.

**Procedimiento:**
1. Admin abre /admin.php → Productos → Nuevo producto
2. Completa y guarda
3. Visitante consulta catálogo (API sin sesión)
4. Admin da de baja el producto
5. Visitante vuelve a consultar

**Resultado esperado:** El producto aparece en la tabla y en el catálogo público; tras la baja deja de aparecer en el catálogo, pero sigue en la base con activo=0.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | visible en catálogo público | `1` | `1` | sí |
| 2 | oculto del catálogo tras la baja | `0` | `0` | sí |
| 3 | conservado en la base como inactivo | `0` | `0` | sí |

**Verificación / fuentes:** Capturas + red + API anónima + SQLite.

**Evidencias:**
- P23-E01 (captura): [P23/01-escritorio-creado.png](../P23/01-escritorio-creado.png) — Producto creado en administración (escritorio 1366x768)
- P23-E02 (red): [P23/02-red.json](../P23/02-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P23-E03 (traza): [P23/03-traza-backend.jsonl](../P23/03-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (39 líneas)

**Vinculación:** 16 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Producto queda inactivo (base nueva por ejecución).
