# P19 — Acceso directo a servicios privados y al administrador de secretos (RUN-02)

| Campo | Valor |
|---|---|
| Ejecución | RUN-02 · inicio 2026-11-09T19:48:33−03:00 (America/Santiago) · 0.3 s |
| Flujo / requisito / criterio | F12 / R11 / CA19 |
| Tipo de escenario | rechazo (acceso directo) |
| Versión | commit cc0519c (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: no aplica (API) |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Servicios privados en 127.0.0.1:7000-7006 (modo local). El arnés actúa como atacante en la red interna.

**Procedimiento:**
1. GET directo a cada servicio privado sin identidad de servicio
2. Llamada con x-internal-auth falsificado
3. GET /v1/secrets/... sin identidad
4. GET de la clave de firma JWT presentando la identidad del gateway (consumidor no autorizado para esa referencia)
5. Enviar al gateway cabeceras x-internal-auth/x-user falsas sin JWT

**Resultado esperado:** 401 SERVICE_AUTH_REQUIRED en cada servicio; 401 en secretos sin identidad; 403 por ACL; el gateway responde 401 AUTH_REQUIRED (ignora cabeceras de identidad del navegador).

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | inventory sin identidad de servicio | `401` | `401` | sí |
| 2 | orders sin identidad de servicio | `401` | `401` | sí |
| 3 | clients sin identidad de servicio | `401` | `401` | sí |
| 4 | payments sin identidad de servicio | `401` | `401` | sí |
| 5 | graphql sin identidad de servicio | `401` | `401` | sí |
| 6 | auth sin identidad de servicio | `401` | `401` | sí |
| 7 | token interno falsificado | `401` | `401` | sí |
| 8 | secretos sin identidad | `401` | `401` | sí |
| 9 | ACL impide al gateway leer la clave de firma | `403` | `403` | sí |
| 10 | gateway ignora cabeceras de identidad del cliente | `[401,"AUTH_REQUIRED"]` | `[401,"AUTH_REQUIRED"]` | sí |

**Verificación / fuentes:** Respuestas + traza (internal_auth_rejected, secret_access denied).

**Evidencias:**
- P19-E01 (red): [P19/01-red.json](../P19/01-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P19-E02 (traza): [P19/02-traza-backend.jsonl](../P19/02-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (15 líneas)

**Vinculación:** 10 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** No modifica datos.
