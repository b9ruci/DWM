# P01 — Consultar catálogo desde el frontend con datos reales de inventory (RUN-01)

| Campo | Valor |
|---|---|
| Ejecución | RUN-01 · inicio 2026-11-09T19:46:39−03:00 (America/Santiago) · 0.9 s |
| Flujo / requisito / criterio | F01 / R01 / CA01 · recorrido crítico C1 |
| Tipo de escenario | éxito |
| Versión | commit ac929d3 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio, movil |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Datos semilla (9 productos, 9 activos). Visitante anónimo. inventory disponible.

**Procedimiento:**
1. Abrir /catalogo.php
2. Esperar la grilla de productos
3. Leer cantidad de tarjetas y precio de "Choco Miau"
4. Consultar GET /api/v1/products con un cliente API independiente
5. Repetir en móvil

**Resultado esperado:** La grilla muestra la misma cantidad de productos que devuelve inventory y el precio de Choco Miau ($3.990) coincide; la solicitud pasa por el API Gateway (ruta GW01) con correlación registrada en gateway e inventory.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | [escritorio] tarjetas en pantalla = productos de la API | `9` | `9` | sí |
| 2 | [escritorio] precio Choco Miau en pantalla | `"$3.990"` | `"$3.990"` | sí |
| 3 | [movil] tarjetas en pantalla = productos de la API | `9` | `9` | sí |
| 4 | [movil] precio Choco Miau en pantalla | `"$3.990"` | `"$3.990"` | sí |
| 5 | API devuelve solo campos públicos (sin sku/activo) | `false` | `false` | sí |

**Verificación / fuentes:** Captura + red del navegador + respuesta de cliente API + traza backend por X-Correlation-Id.

**Evidencias:**
- P01-E01 (captura): [P01/01-escritorio-catalogo.png](../P01/01-escritorio-catalogo.png) — Catálogo cargado desde inventory (escritorio 1366x768)
- P01-E02 (captura): [P01/02-movil-catalogo.png](../P01/02-movil-catalogo.png) — Catálogo cargado desde inventory (móvil Pixel 7 emulado 412x839 (DPR 2.625, táctil))
- P01-E03 (red): [P01/03-red.json](../P01/03-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P01-E04 (traza): [P01/04-traza-backend.jsonl](../P01/04-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (14 líneas)

**Vinculación:** 7 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Solo lectura; no requiere.
