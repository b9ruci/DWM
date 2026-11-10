# P21 — Perfil: validación de RUT en servidor y datos personales cifrados en reposo (RUN-06)

| Campo | Valor |
|---|---|
| Ejecución | RUN-06 · inicio 2026-11-09T20:06:15-03:00 (America/Santiago) · 1.9 s |
| Flujo / requisito / criterio | F08 / R07 / CA21 |
| Tipo de escenario | rechazo y éxito |
| Versión | commit 955ad38 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** clienteB con sesión.

**Procedimiento:**
1. Abrir /perfil.php
2. Ingresar RUT 12.345.678-9 (dígito verificador inválido) y guardar
3. Corregir a 12.345.678-5 y teléfono +56 9 3333 4444, guardar
4. Recargar la página
5. Leer clients.db

**Resultado esperado:** Primer guardado: mensaje de error del servidor (rut: RUT inválido); segundo: "Perfil actualizado"; tras recargar se muestran los valores; en la base rut/teléfono están cifrados (prefijo v1:, sin texto plano).

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | servidor rechaza RUT inválido | `true` | `true` | sí |
| 2 | valores persistidos tras recargar | `["12.345.678-5","+56 9 3333 4444"]` | `["12.345.678-5","+56 9 3333 4444"]` | sí |
| 3 | RUT y teléfono cifrados en reposo | `true` | `true` | sí |

**Verificación / fuentes:** Capturas + red + SQLite.

**Evidencias:**
- P21-E01 (captura): [P21/01-escritorio-rut-invalido.png](../P21/01-escritorio-rut-invalido.png) — RUT con dígito verificador inválido (escritorio 1366x768)
- P21-E02 (captura): [P21/02-escritorio-perfil-guardado.png](../P21/02-escritorio-perfil-guardado.png) — Perfil tras recargar (escritorio 1366x768)
- P21-E03 (red): [P21/03-red.json](../P21/03-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P21-E04 (traza): [P21/04-traza-backend.jsonl](../P21/04-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (23 líneas)

**Vinculación:** 10 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Base nueva por ejecución.
