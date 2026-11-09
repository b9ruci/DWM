# P17 — Sesión expirada y sesión cerrada (revocada) (RUN-03)

| Campo | Valor |
|---|---|
| Ejecución | RUN-03 · inicio 2026-11-09T19:49:41−03:00 (America/Santiago) · 1 s |
| Flujo / requisito / criterio | F12 / R02,R11 / CA17 |
| Tipo de escenario | rechazo (sesión expirada/revocada) |
| Versión | commit cc0519c (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** Token expirado FABRICADO por el arnés con la clave del entorno de prueba (declarado: evita esperar 15 min). Cuenta clienteA.

**Procedimiento:**
1. GET /orders con token expirado
2. Cargar el token expirado en la sesión del navegador y abrir /pedidos.php
3. Iniciar sesión por API, cerrar sesión (logout) y reutilizar el mismo token inmediatamente

**Resultado esperado:** 401 TOKEN_EXPIRED; la interfaz limpia la sesión y abre el modal "Tu sesión expiró…"; tras logout, el token reutilizado recibe 401 SESSION_REVOKED de inmediato.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | token expirado rechazado | `[401,"TOKEN_EXPIRED"]` | `[401,"TOKEN_EXPIRED"]` | sí |
| 2 | aviso de sesión expirada | `true` | `true` | sí |
| 3 | sesión local eliminada | `null` | `null` | sí |
| 4 | token válido antes de logout | `200` | `200` | sí |
| 5 | logout | `200` | `200` | sí |
| 6 | token revocado rechazado inmediatamente | `[401,"SESSION_REVOKED"]` | `[401,"SESSION_REVOKED"]` | sí |

**Verificación / fuentes:** Respuestas API + captura + traza.

**Evidencias:**
- P17-E01 (captura): [P17/01-escritorio-expirada.png](../P17/01-escritorio-expirada.png) — Aviso de sesión expirada (escritorio 1366x768)
- P17-E02 (red): [P17/02-red.json](../P17/02-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P17-E03 (traza): [P17/03-traza-backend.jsonl](../P17/03-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (20 líneas)

**Vinculación:** 10 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** No modifica datos de negocio.
