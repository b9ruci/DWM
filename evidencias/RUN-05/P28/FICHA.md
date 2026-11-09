# P28 — Comportamiento responsivo en 4 anchos (inicio, catálogo, carrito) (RUN-05)

| Campo | Valor |
|---|---|
| Ejecución | RUN-05 · inicio 2026-11-09T20:04:51-03:00 (America/Santiago) · 9.9 s |
| Flujo / requisito / criterio | F01-F04 / R13 / CA28 |
| Tipo de escenario | responsivo |
| Versión | commit a5c99b7 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: 360, 768, 1024, 1440 |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Visitante anónimo con 1 producto en el carrito.

**Procedimiento:**
1. Para 360, 768, 1024 y 1440 px abrir inicio, catálogo y carrito
2. Medir desborde horizontal
3. Verificar menú colapsado bajo 992 px y columnas del catálogo

**Resultado esperado:** Sin desborde horizontal; botón de menú visible en 360/768 y oculto en 1024/1440; columnas del catálogo 1/3/3/4.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | 360px index: sin desborde horizontal | `0` | `0` | sí |
| 2 | 360px: botón de menú visible | `true` | `true` | sí |
| 3 | 360px catalogo: sin desborde horizontal | `0` | `0` | sí |
| 4 | 360px: columnas del catálogo | `1` | `1` | sí |
| 5 | 360px carrito: sin desborde horizontal | `0` | `0` | sí |
| 6 | 768px index: sin desborde horizontal | `0` | `0` | sí |
| 7 | 768px: botón de menú visible | `true` | `true` | sí |
| 8 | 768px catalogo: sin desborde horizontal | `0` | `0` | sí |
| 9 | 768px: columnas del catálogo | `3` | `3` | sí |
| 10 | 768px carrito: sin desborde horizontal | `0` | `0` | sí |
| 11 | 1024px index: sin desborde horizontal | `0` | `0` | sí |
| 12 | 1024px: botón de menú visible | `false` | `false` | sí |
| 13 | 1024px catalogo: sin desborde horizontal | `0` | `0` | sí |
| 14 | 1024px: columnas del catálogo | `3` | `3` | sí |
| 15 | 1024px carrito: sin desborde horizontal | `0` | `0` | sí |
| 16 | 1440px index: sin desborde horizontal | `0` | `0` | sí |
| 17 | 1440px: botón de menú visible | `false` | `false` | sí |
| 18 | 1440px catalogo: sin desborde horizontal | `0` | `0` | sí |
| 19 | 1440px: columnas del catálogo | `4` | `4` | sí |
| 20 | 1440px carrito: sin desborde horizontal | `0` | `0` | sí |

**Verificación / fuentes:** Capturas de página completa + mediciones.

**Evidencias:**
- P28-E01 (captura): [P28/01-360px-index.png](../P28/01-360px-index.png) — index.php a 360px (página completa)
- P28-E02 (captura): [P28/02-360px-catalogo.png](../P28/02-360px-catalogo.png) — catalogo.php a 360px (página completa)
- P28-E03 (captura): [P28/03-360px-carrito.png](../P28/03-360px-carrito.png) — carrito.php a 360px (página completa)
- P28-E04 (captura): [P28/04-768px-index.png](../P28/04-768px-index.png) — index.php a 768px (página completa)
- P28-E05 (captura): [P28/05-768px-catalogo.png](../P28/05-768px-catalogo.png) — catalogo.php a 768px (página completa)
- P28-E06 (captura): [P28/06-768px-carrito.png](../P28/06-768px-carrito.png) — carrito.php a 768px (página completa)
- P28-E07 (captura): [P28/07-1024px-index.png](../P28/07-1024px-index.png) — index.php a 1024px (página completa)
- P28-E08 (captura): [P28/08-1024px-catalogo.png](../P28/08-1024px-catalogo.png) — catalogo.php a 1024px (página completa)
- P28-E09 (captura): [P28/09-1024px-carrito.png](../P28/09-1024px-carrito.png) — carrito.php a 1024px (página completa)
- P28-E10 (captura): [P28/10-1440px-index.png](../P28/10-1440px-index.png) — index.php a 1440px (página completa)
- P28-E11 (captura): [P28/11-1440px-catalogo.png](../P28/11-1440px-catalogo.png) — catalogo.php a 1440px (página completa)
- P28-E12 (captura): [P28/12-1440px-carrito.png](../P28/12-1440px-carrito.png) — carrito.php a 1440px (página completa)

**Vinculación:** 0 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** No requiere.
