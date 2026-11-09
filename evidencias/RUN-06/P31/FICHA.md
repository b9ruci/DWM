# P31 — Administración: resumen de ventas (GraphQL) y listado de clientes enmascarado (RUN-06)

| Campo | Valor |
|---|---|
| Ejecución | RUN-06 · inicio 2026-11-09T20:06:41-03:00 (America/Santiago) · 2 s |
| Flujo / requisito / criterio | F11 / R10 / CA31 |
| Tipo de escenario | éxito |
| Versión | commit 955ad38 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Un pedido pagado nuevo de clienteA (precondición por API + sandbox). Cuenta admin.

**Procedimiento:**
1. Admin consulta resumenVentas por API (valor de referencia)
2. Crear y pagar un pedido de 1 Choco Wau
3. Admin abre /admin.php (Resumen)
4. Comparar "Pedidos pagados" con referencia + 1
5. Abrir pestaña Clientes y revisar RUT/teléfono

**Resultado esperado:** El KPI de pedidos pagados aumenta exactamente en 1 respecto de la referencia y coincide con la API; en Clientes, el RUT y teléfono aparecen enmascarados (con *), sin valores completos.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | KPI pedidos pagados = referencia + 1 | `"7"` | `"7"` | sí |
| 2 | RUT y teléfono enmascarados | `[true,false,false]` | `[true,false,false]` | sí |

**Verificación / fuentes:** Captura + red GraphQL + respuesta API.

**Evidencias:**
- P31-E01 (captura): [P31/01-escritorio-resumen.png](../P31/01-escritorio-resumen.png) — Resumen de ventas en administración (escritorio 1366x768)
- P31-E02 (captura): [P31/02-escritorio-clientes.png](../P31/02-escritorio-clientes.png) — Clientes con datos enmascarados (escritorio 1366x768)
- P31-E03 (red): [P31/03-red.json](../P31/03-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P31-E04 (traza): [P31/04-traza-backend.jsonl](../P31/04-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (49 líneas)

**Vinculación:** 16 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Base nueva por ejecución.
