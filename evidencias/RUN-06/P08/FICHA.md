# P08 — Reintento tras perder la respuesta de POST /orders no duplica el pedido (RUN-06)

| Campo | Valor |
|---|---|
| Ejecución | RUN-06 · inicio 2026-11-09T20:05:50-03:00 (America/Santiago) · 3.8 s |
| Flujo / requisito / criterio | F04 / R03 / CA08 · recorrido crítico C2 |
| Tipo de escenario | recuperación (reintento) |
| Versión | commit 955ad38 (0 archivos sin commit en backend/frontend/tests) |
| Entorno | local (backend/scripts/stack.js): servicios privados en 127.0.0.1, gateway :8080, frontend :8000, sandbox :8090; Chromium 153.0.8010.12 (Playwright, headless); viewports: escritorio |
| Ejecutor | Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo |
| **Estado** | **APROBADA** |

**Precondiciones:** clienteB; Tableta 70% (p-007) con stock ≥ 1. Se intercepta la primera respuesta de POST /orders en el navegador: el servidor la procesa pero el navegador recibe un error de red (fallo controlado).

**Procedimiento:**
1. Iniciar sesión y agregar 1 Tableta 70%
2. Confirmar pedido (la respuesta se pierde)
3. Observar mensaje de error de red
4. Pulsar nuevamente "Confirmar pedido y pagar"

**Resultado esperado:** El segundo intento reutiliza la misma Idempotency-Key: el gateway responde 200 con idempotent-replay=true y el mismo pedido; existe un único pedido nuevo y el stock baja una sola vez.

**Resultado observado (comprobaciones registradas antes de clasificar):**

| # | Comprobación | Esperado | Observado | ¿Cumple? |
|---|---|---|---|---|
| 1 | misma Idempotency-Key en ambos intentos | `true` | `true` | sí |
| 2 | un único pedido nuevo | `1` | `1` | sí |
| 3 | stock descontado una vez | `49` | `49` | sí |

**Verificación / fuentes:** Red (dos POST con la misma clave) + traza (order_created una vez, order_replay una vez) + SQLite.

**Evidencias:**
- P08-E01 (captura): [P08/01-escritorio-respuesta-perdida.png](../P08/01-escritorio-respuesta-perdida.png) — Error de red tras el primer envío (escritorio 1366x768)
- P08-E02 (captura): [P08/02-escritorio-pasarela.png](../P08/02-escritorio-pasarela.png) — El reintento continúa al pago (escritorio 1366x768)
- P08-E03 (red): [P08/03-red.json](../P08/03-red.json) — Solicitudes y respuestas (navegador y cliente API) con credenciales enmascaradas
- P08-E04 (traza): [P08/04-traza-backend.jsonl](../P08/04-traza-backend.jsonl) — Logs de gateway y servicios con los mismos identificadores de correlación (32 líneas)

**Vinculación:** 12 identificadores de correlación (X-Correlation-Id) presentes en red y traza.


**Restauración:** Base nueva por ejecución.
