# P02 — Filtro por categoría y búsqueda sin resultados (estado vacío) (RUN-05)

| Campo | Valor |
|---|---|
| Ejecución | RUN-05 · inicio 2026-11-09T20:03:59-03:00 (America/Santiago) · 1.3 s |
| Flujo / requisito / criterio | F01 / R01 / CA02 · recorrido crítico C1 |
| Tipo de escenario | límite |
| Versión | commit a5c99b7 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Datos semilla. Visitante anónimo.

**Procedimiento:**
1. Abrir /catalogo.php?categoria=Bombones
2. Contar tarjetas
3. Buscar "zzzz" en el campo de búsqueda
4. Observar estado vacío
5. Consultar GET /products?categoria=Inválida

**Resultado esperado:** Bombones muestra 2 productos; búsqueda sin coincidencias muestra estado vacío con acción "Limpiar filtros"; una categoría inválida es rechazada con 400 por inventory.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | tarjetas en categoría Bombones | `2` | `2` | sí |
| 2 | estado vacío visible | `true` | `true` | sí |
| 3 | categoría inválida rechazada | `400` | `400` | sí |

**Verificación / fuentes:** Capturas + red + respuesta 400 del cliente API.

**Evidencias:**
- P02-E01 (captura): [P02/01-escritorio-vacio.png](../P02/01-escritorio-vacio.png) — Estado vacío al buscar sin coincidencias (escritorio 1366x768)
- P02-E02 (red): [P02/02-red.json](../P02/02-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P02-E03 (traza): [P02/03-traza-backend.jsonl](../P02/03-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (10 líneas)

**Vinculación:** 5 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** No requiere.
