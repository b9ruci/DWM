# P30 — Inicio según el mockup: carrusel de promociones y destacados consistentes con inventory (RUN-07)

| Campo | Valor |
|---|---|
| Ejecución | RUN-07 · inicio 2026-11-09T20:07:48-03:00 (America/Santiago) · 1 s |
| Flujo / requisito / criterio | F02 / R01 / CA30 |
| Tipo de escenario | éxito |
| Versión | commit 955ad38 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio, movil |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Datos semilla (4 promociones activas, 5 productos destacados). Visitante anónimo.

**Procedimiento:**
1. Abrir /index.php
2. Contar diapositivas e indicadores del carrusel
3. Leer título y precio de la primera promoción
4. Contar tarjetas del riel de destacados
5. Comparar con GET /promotions y GET /products?destacado=true
6. Agregar la promoción al carrito y verificar el contador

**Resultado esperado:** 4 diapositivas y 4 puntos; primera promoción "Barra Chocolate Dubái Labubu" a $100.000 "venta por kilo"; 5 tarjetas destacadas + tarjeta "Ver todo el catálogo"; el contador del carrito pasa a 1.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | [escritorio] diapositivas = promociones de la API | `4` | `4` | sí |
| 2 | [escritorio] puntos del carrusel | `4` | `4` | sí |
| 3 | [escritorio] primera promoción | `["Barra Chocolate Dubái Labubu","$100.000","venta por kilo"]` | `["Barra Chocolate Dubái Labubu","$100.000","venta por kilo"]` | sí |
| 4 | [escritorio] tarjetas destacadas = API | `5` | `5` | sí |
| 5 | [escritorio] tarjeta "Ver todo el catálogo" | `1` | `1` | sí |
| 6 | [escritorio] contador del carrito | `"1"` | `"1"` | sí |
| 7 | [movil] diapositivas = promociones de la API | `4` | `4` | sí |
| 8 | [movil] puntos del carrusel | `4` | `4` | sí |
| 9 | [movil] primera promoción | `["Barra Chocolate Dubái Labubu","$100.000","venta por kilo"]` | `["Barra Chocolate Dubái Labubu","$100.000","venta por kilo"]` | sí |
| 10 | [movil] tarjetas destacadas = API | `5` | `5` | sí |
| 11 | [movil] tarjeta "Ver todo el catálogo" | `1` | `1` | sí |
| 12 | [movil] contador del carrito | `"1"` | `"1"` | sí |

**Verificación / fuentes:** Capturas + red + respuestas API independientes.

**Evidencias:**
- P30-E01 (captura): [P30/01-escritorio-inicio.png](../P30/01-escritorio-inicio.png) — Inicio: carrusel y destacados (escritorio 1366x768)
- P30-E02 (captura): [P30/02-movil-inicio.png](../P30/02-movil-inicio.png) — Inicio: carrusel y destacados (móvil Pixel 7 emulado 412x839 (DPR 2.625, táctil))
- P30-E03 (red): [P30/03-red.json](../P30/03-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P30-E04 (traza): [P30/04-traza-backend.jsonl](../P30/04-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (16 líneas)

**Vinculación:** 8 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Carrito local por contexto de navegador (se descarta al cerrar).
