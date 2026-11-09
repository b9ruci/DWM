# P29 — Las evidencias y logs de la ejecución no contienen secretos ni contraseñas (RUN-05)

| Campo | Valor |
|---|---|
| Ejecución | RUN-05 · inicio 2026-11-09T20:05:04-03:00 (America/Santiago) · 0.3 s |
| Flujo / requisito / criterio | Transversal / R11 / CA29 |
| Tipo de escenario | control de protección |
| Versión | commit a5c99b7 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: no aplica (API) |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Todas las demás pruebas ejecutadas.

**Procedimiento:**
1. Obtener los valores secretos del entorno de prueba (.secrets)
2. Buscar cada valor en todos los archivos de texto de la ejecución (evidencias y logs)
3. Buscar patrones de JWT ("eyJ…") en las evidencias

**Resultado esperado:** 0 coincidencias.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | valores secretos en evidencias | `0` | `0` | sí |
| 2 | tokens JWT en evidencias | `0` | `0` | sí |

**Verificación / fuentes:** Reporte de búsqueda (sin imprimir los valores).

**Evidencias:**
- P29-E01 (datos): [P29/01-busqueda.json](../P29/01-busqueda.json) — Resultado de la búsqueda de secretos

**Vinculación:** 0 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** No requiere.
