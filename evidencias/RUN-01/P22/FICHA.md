# P22 — Solicitud de orden especial desde "¡Contáctanos!" (móvil) (RUN-01)

| Campo | Valor |
|---|---|
| Ejecución | RUN-01 · inicio 2026-11-09T19:47:18−03:00 (America/Santiago) · 1.1 s |
| Flujo / requisito / criterio | F09 / R08 / CA22 |
| Tipo de escenario | éxito y validación |
| Versión | commit ac929d3 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: movil |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Visitante anónimo. Admin para la verificación.

**Procedimiento:**
1. Desde el inicio pulsar "¡Contáctanos!"
2. Enviar con mensaje de 5 caracteres
3. Completar mensaje válido y enviar
4. Admin consulta GET /admin/contact-requests
5. POST directo con mensaje corto

**Resultado esperado:** Tipo preseleccionado ORDEN_ESPECIAL; el mensaje corto no se envía (validación de interfaz); el válido muestra N° de solicitud; el admin la ve con estado NUEVA; el POST directo corto recibe 400.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | tipo preseleccionado | `"ORDEN_ESPECIAL"` | `"ORDEN_ESPECIAL"` | sí |
| 2 | validación de interfaz bloquea mensaje corto | `[true,0]` | `[true,0]` | sí |
| 3 | admin ve la solicitud | `["ORDEN_ESPECIAL","NUEVA"]` | `["ORDEN_ESPECIAL","NUEVA"]` | sí |
| 4 | servidor también valida | `400` | `400` | sí |

**Verificación / fuentes:** Capturas + red + respuesta admin.

**Evidencias:**
- P22-E01 (captura): [P22/01-movil-validacion.png](../P22/01-movil-validacion.png) — Mensaje demasiado corto (móvil Pixel 7 emulado 412x839 (DPR 2.625, táctil))
- P22-E02 (captura): [P22/02-movil-enviado.png](../P22/02-movil-enviado.png) — Solicitud enviada (móvil Pixel 7 emulado 412x839 (DPR 2.625, táctil))
- P22-E03 (red): [P22/03-red.json](../P22/03-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P22-E04 (traza): [P22/04-traza-backend.jsonl](../P22/04-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (19 líneas)

**Vinculación:** 8 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Base nueva por ejecución.
