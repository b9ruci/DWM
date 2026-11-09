# P04 — Registro de cuenta desde el frontend y persistencia en auth y clients (RUN-02)

| Campo | Valor |
|---|---|
| Ejecución | RUN-02 · inicio 2026-11-09T19:48:01−03:00 (America/Santiago) · 2.1 s |
| Flujo / requisito / criterio | F03 / R02 / CA04 |
| Tipo de escenario | éxito |
| Versión | commit cc0519c (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Correo no registrado (generado por ejecución).

**Procedimiento:**
1. Abrir inicio, menú de usuario → Crear cuenta
2. Completar nombre, correo y contraseña válida
3. Enviar
4. En sesión nueva (cliente API) iniciar sesión con la cuenta
5. Leer perfil GET /me/profile
6. Inspeccionar auth.db (hash) y clients.db (perfil)

**Resultado esperado:** La interfaz confirma la cuenta y muestra el nombre en el menú; un login independiente funciona; auth guarda hash scrypt (no la contraseña) y clients guarda el perfil con el mismo id.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | nombre visible en el menú | `"Carla Prueba (ficticia)"` | `"Carla Prueba (ficticia)"` | sí |
| 2 | perfil disponible en clients | `200` | `200` | sí |
| 3 | auth guarda hash scrypt, no la contraseña | `true` | `true` | sí |
| 4 | rol asignado por el servidor | `"CLIENTE"` | `"CLIENTE"` | sí |
| 5 | clients usa el mismo id que auth | `"c3b67af2-8123-4677-98ef-08309dbf610d"` | `"c3b67af2-8123-4677-98ef-08309dbf610d"` | sí |

**Verificación / fuentes:** Captura + red + login independiente + lectura SQLite de solo lectura.

**Evidencias:**
- P04-E01 (captura): [P04/01-escritorio-registrado.png](../P04/01-escritorio-registrado.png) — Sesión iniciada tras el registro (escritorio 1366x768)
- P04-E02 (datos): [P04/02-persistencia.json](../P04/02-persistencia.json) — Lectura SQLite de auth.db y clients.db (sin hash ni contraseña)
- P04-E03 (red): [P04/03-red.json](../P04/03-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P04-E04 (traza): [P04/04-traza-backend.jsonl](../P04/04-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (20 líneas)

**Vinculación:** 7 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** La cuenta queda creada; el reinicio de datos (base nueva por ejecución) la elimina.
