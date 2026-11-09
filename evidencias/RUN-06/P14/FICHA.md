# P14 — Límites y autorización por campo en GraphQL (RUN-06)

| Campo | Valor |
|---|---|
| Ejecución | RUN-06 · inicio 2026-11-09T20:06:06-03:00 (America/Santiago) · 0.6 s |
| Flujo / requisito / criterio | F06 / R05,R11 / CA14 · recorrido crítico C3 |
| Tipo de escenario | límite |
| Versión | commit 955ad38 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: no aplica (API) |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Sesiones de clienteA y admin. Límites configurados: costo 500, profundidad 5, 4000 caracteres, limite ≤ 20, introspección deshabilitada.

**Procedimiento:**
1. Consulta con 2 alias de misPedidos(limite:20) (amplificación)
2. Consulta de introspección
3. Campo notasInternas como cliente y como admin
4. resumenVentas como cliente
5. misPedidos(limite: 50)
6. Consulta de más de 4000 caracteres

**Resultado esperado:** 400 QUERY_TOO_COMPLEX; 400 por introspección; cliente recibe notasInternas=null con error FORBIDDEN y admin sin error; resumenVentas FORBIDDEN para cliente; BAD_USER_INPUT; 400 QUERY_TOO_LARGE.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | amplificación por alias rechazada | `[400,"QUERY_TOO_COMPLEX"]` | `[400,"QUERY_TOO_COMPLEX"]` | sí |
| 2 | introspección deshabilitada | `400` | `400` | sí |
| 3 | cliente: notasInternas null + FORBIDDEN | `[null,"FORBIDDEN"]` | `[null,"FORBIDDEN"]` | sí |
| 4 | admin: campo autorizado sin errores | `["f7c342de-1d38-4f23-9fff-190ec40c227d",null]` | `["f7c342de-1d38-4f23-9fff-190ec40c227d",null]` | sí |
| 5 | resumenVentas denegado a cliente | `[null,"FORBIDDEN"]` | `[null,"FORBIDDEN"]` | sí |
| 6 | paginación acotada | `"BAD_USER_INPUT"` | `"BAD_USER_INPUT"` | sí |
| 7 | consulta demasiado grande | `[400,"QUERY_TOO_LARGE"]` | `[400,"QUERY_TOO_LARGE"]` | sí |

**Verificación / fuentes:** Respuestas API + traza graphql (graphql_limit).

**Evidencias:**
- P14-E01 (red): [P14/01-red.json](../P14/01-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P14-E02 (traza): [P14/02-traza-backend.jsonl](../P14/02-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (34 líneas)

**Vinculación:** 10 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** No modifica datos.
