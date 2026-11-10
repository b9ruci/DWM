# Unidad 3 — Integración frontend–backend y validación basada en evidencias

**Caso:** Chocolatería Chocomanía. **Integrantes:** Bruno Martínez (Sección 8481) — *completar con el resto del equipo y sus aportes (sección 7.2)*.

**Versión final evaluada:** código de la aplicación en el commit `cc0519c`; protocolo de pruebas v1.3 en `955ad38`. **Ejecuciones de la versión final:** `RUN-06` y `RUN-07` (independientes, cada una desde bases de datos nuevas). **Reproducción desde un clon limpio:** `RUN-08` sobre `7dd2c2e`, que agrega al repositorio tres archivos JSON informativos que faltaban (I-03) y no modifica el código.

> **Declaración sobre quién ejecutó.** La implementación y las ejecuciones RUN-01…RUN-08 y CARGA-01 fueron realizadas por un agente automatizado (Claude Code) en un contenedor cloud, a pedido del equipo, el 2026-11-09 (hora de Chile). El equipo debe revisar el expediente, re-ejecutar al menos una corrida con un ID nuevo, p. ej. `node tests/runner.mjs --run RUN-09 --executor "Nombre"` y completar las secciones marcadas *completar*. Que quien implementó sea quien ejecutó es una amenaza a la validez (sección 6.4).

Regla central aplicada: **Requisito → criterio → prueba → ejecución → evidencia → conclusión**, materializada en [`docs/trazabilidad.csv`](trazabilidad.csv) y en una `FICHA.md` por prueba y ejecución (`evidencias/RUN-xx/Pyy/FICHA.md`).

---

## Etapa 1 — Línea base y alcance

### 1.1 Ficha del entorno y versiones

| Elemento | Valor |
|---|---|
| Línea base (inicio U3) | commit `1087c34`: 5 páginas PHP con datos `resAPI` locales, plantilla genérica (ferretería), login sin función, sin backend |
| Versión final | aplicación `cc0519c` · protocolo `955ad38` · frontend v3.0.0 |
| Runtime | Node.js v22.23.4 (`node:sqlite`), PHP 8.3.6 (servidor embebido), graphql-js 16.11.0 |
| Navegador de prueba | Chromium 153.0.8010.12 (Playwright 1.63, headless) |
| Viewports | escritorio 1366×768; móvil **emulado** Pixel 7 (412×839, DPR 2,625, táctil); responsivo 360/768/1024/1440 px |
| SO | Linux 6.18 (contenedor cloud) |
| Configuración | sin secretos en el repositorio; `node backend/scripts/init-secrets.js` genera `.secrets/` (ignorado por git) |
| Migraciones / datos | `backend/services/*/migrations/*.sql` + semillas ficticias (9 productos, 4 promociones, 3 cuentas) |
| Cuentas por rol | `admin@chocomania.test` (ADMIN), `ana.cliente@…` (clienteA), `bruno.cliente@…` (clienteB); contraseñas aleatorias en `.secrets/seed-accounts.json` |
| Inicio | `node backend/scripts/start-local.js` (verificado) · `docker compose up --build` (no verificado, ver R14) |
| Restauración | `node backend/scripts/reset-data.js`; el arnés usa además una carpeta de datos nueva por ejecución |

### 1.2 Estado inicial de los flujos (línea base `1087c34`)

| Flujo | Estado inicial | Problema conocido |
|---|---|---|
| Catálogo | tarjetas de "Martillo/Tijera/Destornillador" desde objeto local | no corresponde al caso; sin API |
| Carrusel | imágenes externas desde objeto local | sin relación con productos |
| Login | modal sin acción | no autentica |
| Contacto | `console.log` + alerta local | no persiste |
| Carrito, pedidos, pagos, perfil, admin | inexistentes | — |

### 1.3 Inventario de flujos (riesgo y prioridad)

| ID | Req. | Objetivo del usuario | Rol | Pantalla | Servicios / protocolo | Datos afectados | Criticidad (justificación) | Estado inicial | Dependencia externa | Criterios |
|---|---|---|---|---|---|---|---|---|---|---|
| F01 | R01 | ver y filtrar productos | visitante | catalogo.php | GW→inventory REST | lectura catálogo | **Alta** (puerta de venta; error = no hay ventas) | local | — | CA01–CA03, CA25 |
| F02 | R01 | ver promociones y destacados | visitante | index.php | GW→inventory REST | lectura | Media | local | — | CA30 |
| F03 | R02 | crear cuenta / ingresar | visitante | modal | GW→auth→clients | cuentas, perfil | Alta (identidad) | sin función | — | CA04, CA05, CA17 |
| F04 | R03 | confirmar pedido | CLIENTE | carrito.php | GW→orders→inventory | pedido, stock | **Crítica** (dinero y stock) | inexistente | — | CA06–CA09 |
| F05 | R04 | pagar | CLIENTE | pasarela, pedidos.php | GW→payments→proveedor; webhook | pago, estado del pedido | **Crítica** | inexistente | proveedor de pagos → **doble de prueba** | CA06, CA10, CA11, CA26 |
| F06 | R05 | ver mis pedidos | CLIENTE | pedidos.php | GW→GraphQL→orders+inventory+payments+clients | lectura PII | **Alta** (privacidad) | inexistente | — | CA12–CA15 |
| F07 | R06 | cancelar pedido | CLIENTE | pedidos.php | GW→orders→inventory | estado, stock | Media | inexistente | — | CA20 |
| F08 | R07 | mantener perfil | CLIENTE | perfil.php | GW→clients | PII cifrada | Media-alta (PII) | inexistente | — | CA21 |
| F09 | R08 | pedir orden especial | visitante | contacto.php | GW→clients | solicitud | Media | local | — | CA22, CA27 |
| F10 | R09 | administrar productos | ADMIN | admin.php | GW→inventory | catálogo | Alta (precios) | inexistente | — | CA23, CA18 |
| F11 | R10 | gestionar pedidos, resumen, clientes | ADMIN | admin.php | GW→orders, GraphQL, clients | estados, PII | Alta | inexistente | — | CA24, CA31, CA18 |
| F12 | R11 | control de acceso transversal | todos | — | gateway, auth, servicios, secrets | — | **Crítica** | inexistente | — | CA16–CA19, CA29 |

Requisitos R01–R14: ver `docs/unidad2-informe.md`. R12 (resiliencia), R13 (responsivo) y R14 (despliegue) son transversales.

### 1.4 Recorridos críticos seleccionados (validación profunda)

| ID | Recorrido | Cubre | Escenarios |
|---|---|---|---|
| **C1** | Consultar catálogo (lectura) | inventory | éxito P01 · límite P02 · fallo/recuperación P03 |
| **C2** | Comprar y pagar (cambio persistente de estado) | orders, inventory, payments | éxito P06 · rechazo/límite P07 · recuperación por reintento P08 · rechazo de pago y recuperación P10 |
| **C3** | Consultar pedidos propios vía GraphQL (acceso protegido) | orders, inventory, payments, clients | éxito P12 · recurso ajeno P13 · límites P14 · fallo de dependencia P15 |

Justificación: C2 concentra dinero, stock e integración externa; C3 concentra datos personales y la agregación; C1 es el flujo de mayor tráfico. Los demás flujos siguen en el alcance (P04–P05, P09, P11, P16–P31).

### 1.5 Clasificación de dependencias y componentes condicionales

| Componente | Tipo |
|---|---|
| API Gateway, Auth, administrador de secretos, GraphQL Gateway, inventory, orders, clients, payments, frontend | **reales** (propios, ejecutados en cada corrida) |
| Proveedor de pagos | **doble de prueba** declarado (`payment-sandbox`): limita las conclusiones al contrato simulado |
| Analítica y gRPC | **no aplican** — se mantiene ADR-001 (U2); revalidado con CARGA-01 |

Cambios de arquitectura respecto del diseño U2 durante la integración: (1) dependencias de interfaz **autoalojadas** (Bootstrap, iconos y fuentes) porque el navegador de pruebas no alcanzaba los CDN; (2) campo GraphQL `PaginaPedidos.items` renombrado a `pedidos` para que la regla de costo distinga la página de los ítems; (3) el gateway invalida su caché de sesión al cerrar sesión (I-01).

### 1.6 Recorrido de las solicitudes

```mermaid
flowchart LR
  UI[Pantalla + api.js<br/>genera X-Correlation-Id] -->|HTTP + JWT| GW[API Gateway<br/>ruta GWxx · JWT · sesión · rol · límite]
  GW -->|token HMAC gateway→svc<br/>mismo X-Correlation-Id| SVC[Servicio dueño<br/>identidad · propiedad · reglas]
  GW --> GQL[GraphQL Gateway]
  GQL -->|batch + 2 s| SVC
  SVC --> DB[(SQLite del servicio)]
  SVC -.log JSON con cid.-> LOG[logs-backend/*.log]
  GW -.log JSON con cid.-> LOG
```

### 1.7 Limitaciones iniciales

Sin demonio Docker en el entorno (compose no ejecutable); comunicación en loopback sin TLS; proveedor de pagos simulado; dispositivos móviles solo emulados; datos sintéticos pequeños.

---

## Etapa 2 — Criterios y protocolos

Las 32 fichas de prueba (identificación, precondiciones, procedimiento, resultado esperado, verificación y restauración) están **definidas en el código** antes de ejecutar (`tests/suites/*.mjs`) y se imprimen con el resultado en cada `FICHA.md`. Cada ficha separa el **esperado** de las **comprobaciones observadas**, que se registran antes de clasificar.

| Criterio | Enunciado observable (resumen) | Prueba |
|---|---|---|
| CA01 | La grilla muestra la misma cantidad de productos y precios que inventory, solo campos públicos | P01 |
| CA02 | Categoría filtra; búsqueda sin coincidencias muestra estado vacío; filtro inválido → 400 | P02 |
| CA03 | Con inventory caído: error comprensible con referencia, sin datos falsos; "Reintentar" recupera | P03 |
| CA04 | Registro desde UI; login independiente; hash scrypt; perfil con el mismo id | P04 |
| CA05 | Login inválido: mensaje genérico sin token; contraseña débil 400; duplicado 409 | P05 |
| CA06 | Compra: monto calculado por el servidor; UI confirma; consulta independiente PAGADO/APROBADO; stock −n; reserva CONFIRMADA | P06 |
| CA07 | Stock insuficiente: 409, sin pedido ni descuento | P07 |
| CA08 | Reintento tras respuesta perdida: misma clave, un solo pedido, stock una vez | P08 |
| CA09 | Precio/monto/estado del navegador no se aceptan | P09 |
| CA10 | Pago rechazado se informa y no paga el pedido; nuevo intento aprobado | P10 |
| CA11 | Notificación duplicada sin efecto; firma falsa 401 | P11 |
| CA12 | Pantalla de pedidos = orders; agregación de 4 subsistemas en la traza | P12 |
| CA13 | Pedido ajeno: UI "no encontrado" sin datos; 404 en ver/pagar/cancelar; sin cambios | P13 |
| CA14 | GraphQL: costo, introspección, campo restringido, rol, paginación y tamaño | P14 |
| CA15 | GraphQL con inventory caído: `completo=false`, advertencia visible, recuperación | P15 |
| CA16 | Sin sesión: 401 y la UI pide iniciar sesión; sin efectos | P16 |
| CA17 | Token expirado 401 y aviso en UI; token revocado rechazado **inmediatamente** | P17 |
| CA18 | Rol cliente en rutas admin: 403 y sin modificaciones | P18 |
| CA19 | Acceso directo a servicios/secretos sin identidad o fuera de ACL: rechazado | P19 |
| CA20 | Cancelar: estado CANCELADO, stock restaurado, historial conservado, 2ª cancelación 409 | P20 |
| CA21 | RUT con DV inválido rechazado por el servidor; datos persistidos y cifrados en reposo | P21 |
| CA22 | Orden especial desde "¡Contáctanos!"; validación UI y servidor; admin la ve | P22 |
| CA23 | Alta y baja lógica de producto reflejadas en catálogo público | P23 |
| CA24 | Transición válida desde UI admin; inválida 409; cliente ve el estado | P24 |
| CA25 | Demora de 5 s: corte en ≈4 s con mensaje (< 6 s) y recuperación | P25 |
| CA26 | Proveedor caído: mensaje, pedido sigue reservado, recuperación | P26 |
| CA27 | Límite de solicitudes: 429 + Retry-After, sin registros | P27 |
| CA28 | 4 anchos sin desborde; menú colapsado < 992 px; columnas 1/3/3/4 | P28 |
| CA29 | Evidencias y logs sin secretos ni JWT | P29 |
| CA30 | Carrusel y destacados = inventory; agregar desde el carrusel actualiza el contador | P30 |
| CA31 | KPI de pagados = referencia + 1; clientes enmascarados | P31 |
| CA32 | `docker compose up` levanta el sistema y solo publica 8000/8080/8090 | P32 (manual) |

**Verificación de datos:** consulta autorizada posterior en **sesión nueva** (cliente API) y/o lectura SQLite de **solo lectura** de la base del servicio dueño — independiente de la pantalla que ejecutó la acción.

**Rendimiento:** solo se concluye sobre lo medido en CARGA-01 (objetivo fijado antes: p95 < 300 ms, 0 % errores, 20 concurrentes). No hay conclusiones de rendimiento de escritura.

**Repeticiones e intermitencias (definido antes de resumir):** una prueba distinta se considera *aprobada* en una versión solo si aprueba en **ambas** ejecuciones independientes de esa versión; si falla en alguna, cuenta como *fallida* (intermitente) hasta que su causa se resuelva y se repitan dos ejecuciones.

**Versiones del protocolo:**

| Versión | Cambio | Motivo | Pruebas repetidas |
|---|---|---|---|
| v1.0 → v1.1 (antes de RUN-01) | P12: total esperado $29.970 (no $25.980) y traza con auth | error de cálculo del autor del protocolo detectado en un ensayo en seco | todas (RUN-01 completo) |
| v1.2 (`a5c99b7`) | +P30, +P31 | huecos de cobertura en R01 (inicio) y R10 (resumen/clientes) | todas (RUN-04, RUN-05) |
| v1.3 (`955ad38`) | P12 deja de exigir auth en la traza de la consulta de detalle | I-02 (oráculo dependiente del orden de dos consultas concurrentes y de la caché de diseño de 5 s) | todas (RUN-06, RUN-07) |

Los ensayos en seco del arnés (depuración de los propios scripts de prueba) se hicieron fuera del paquete de evidencias y **no se conservaron**; por eso no se usan para ninguna conclusión. *Pendiente del equipo:* revisión cruzada del protocolo por un integrante distinto del autor.

---

## Etapa 3 — Integración incremental (bitácora)

| Inc. | Fecha | Versión | Flujo | Diferencia de contrato / problema encontrado | Cambio realizado | Prueba asociada | Estado | Siguiente acción |
|---|---|---|---|---|---|---|---|---|
| 0 | 2026-11-09 | `1087c34` | todos | datos locales `resAPI`, dominio ajeno al caso | línea base registrada | — | — | construir backend |
| 1 | 2026-11-09 | trabajo previo a `ac929d3` | F01–F06 (API) | — | servicios, gateway, secretos; prueba de humo por API (cliente directo, solo diagnóstico) | humo API | OK | GraphQL |
| 2 | 2026-11-09 | idem | F06 | la regla de costo contaba escalares y confundía la lista de la página con la de ítems: la consulta legítima del frontend costaba 9.011 > 300 | costo solo para objetos/listas; `items`→`pedidos`; máximo 500 | P14 | OK | frontend |
| 3 | 2026-11-09 | idem | todos | el navegador de pruebas no alcanzaba los CDN (Bootstrap → `bootstrap` indefinido, carrusel roto) | dependencias autoalojadas y versionadas | P28, P30 | OK | E2E |
| 4 | 2026-11-09 | `ac929d3` | todos | — | primera versión integrada completa | RUN-01 (29) | 28/29 | I-01 |
| 5 | 2026-11-09 | `cc0519c` | F12 | revocación de sesión tardía (I-01) | invalidación de caché al cerrar sesión | P17 + regresión completa RUN-02/03 | 29/29 ×2 | cobertura |
| 6 | 2026-11-09 | `a5c99b7` | F02, F11 | cobertura | P30, P31 (sin cambios de aplicación) | RUN-04/05 | 31/31 y 30/31 | I-02 |
| 7 | 2026-11-09 | `955ad38` | F06 | oráculo intermitente (I-02) | protocolo v1.3 | RUN-06/07 | 31/31 ×2 | empaquetado |
| 8 | 2026-11-10 | `7dd2c2e` | entrega | `.gitignore` excluía `frontend/assets/data/*.json`, la API simulada de U1 y los logs de evidencia (I-03) | se versionan; API simulada `frontend/mock-api/` para U1 | RUN-08 desde clon limpio | 31/31 | cierre |

Los incrementos 1–3 ocurrieron antes del primer commit integrado: el historial de git no los separa; quedan registrados aquí como notas de desarrollo. Contratos actualizados: `backend/services/gateway/routes.js`, `backend/services/graphql/schema.graphql`, `docs/unidad2-informe.md` (Módulo 1). Código de integración: `frontend/assets/js/core/api.js` y `frontend/assets/js/pages/*.js`.

Comprobado para cada flujo en la interfaz: **carga** (spinner), **éxito**, **ausencia de datos** (P02, carrito vacío), **rechazo** (P05, P07, P13, P18), **fallo de comunicación** (P03, P25, P26), **sesión expirada** (P17) y **reintentos** (P08 y botones "Reintentar"). Secretos: cada servicio obtiene sus claves del gestor al arrancar (líneas `secret_loaded` con referencia y versión, sin valor, en `logs-backend/*.log`); P19 prueba que la ACL niega lo no autorizado.

---

## Etapa 4 — Registro de ejecuciones

| Ejecución | Fecha y hora (America/Santiago) | Versión app · protocolo | Pruebas | Resultado | Comprobaciones | Evidencias |
|---|---|---|---|---|---|---|
| [RUN-01](../evidencias/RUN-01/RESULTADOS.md) | 2026-11-09 19:46:36 −03:00 | `ac929d3` · v1.1 | 29 | 28 aprobadas · **1 fallida (P17)** | 168/169 | 107 |
| [RUN-02](../evidencias/RUN-02/RESULTADOS.md) | 2026-11-09 19:47:55 −03:00 | `cc0519c` · v1.1 | 29 | 29 aprobadas | 169/169 | 107 |
| [RUN-03](../evidencias/RUN-03/RESULTADOS.md) | 2026-11-09 19:49:06 −03:00 | `cc0519c` · v1.1 | 29 | 29 aprobadas | 169/169 | 107 |
| [RUN-04](../evidencias/RUN-04/RESULTADOS.md) | 2026-11-09 20:02:46 −03:00 | `cc0519c` · v1.2 | 31 | 31 aprobadas | 183/183 | 115 |
| [RUN-05](../evidencias/RUN-05/RESULTADOS.md) | 2026-11-09 20:03:55 −03:00 | `cc0519c` · v1.2 | 31 | 30 aprobadas · **1 fallida (P12, intermitente)** | 181/183 | 115 |
| [**RUN-06**](../evidencias/RUN-06/RESULTADOS.md) | 2026-11-09 20:05:32 −03:00 | `cc0519c` · **v1.3** | 31 | **31 aprobadas** | 183/183 | 115 |
| [**RUN-07**](../evidencias/RUN-07/RESULTADOS.md) | 2026-11-09 20:06:44 −03:00 | `cc0519c` · **v1.3** | 31 | **31 aprobadas** | 183/183 | 115 |
| [RUN-08](../evidencias/RUN-08/RESULTADOS.md) | 2026-11-09 23:14:38 −03:00 | `7dd2c2e` · v1.3, **clon limpio con secretos nuevos** | 31 | 31 aprobadas | 183/183 | 115 |
| [CARGA-01](../evidencias/CARGA-01/RESULTADO.md) | 2026-11-09 | `cc0519c` | 3 escenarios | cumplen objetivo | — | — |

Ejecutor: agente automatizado (ver declaración). Navegador Chromium 153 headless; viewports por prueba en cada ficha. P32 (Docker Compose, manual) **bloqueada** en todas: el entorno no tiene demonio Docker.

Cada ficha de ejecución incluye contexto, preparación, esperado, observado, estado, fuentes y **vinculación**: el frontend genera `X-Correlation-Id` por acción; el gateway lo propaga en el token interno y en la cabecera; todos los servicios lo registran. El arnés extrae de `logs-backend/` las líneas con esos identificadores (`*-traza-backend.jsonl`) y guarda la red (`*-red.json`) con `Authorization`, contraseñas y tokens **enmascarados**.

Cobertura mínima de escenarios:

| Ámbito | Pruebas |
|---|---|
| Funcionalidad y datos (consulta, cambio, persistencia en sesión nueva, consistencia pantalla-backend) | P01, P04, P06, P12, P20, P21, P23, P24, P30, P31 |
| Reglas del negocio (inválido/límite, duplicado por reintento) | P05, P07, P08, P09, P11, P21, P22 |
| Identidad y permisos (sin sesión, expirada, rol, recurso ajeno, sin modificación) | P13, P16, P17, P18, P19 |
| Fallo y recuperación (indisponible, demorado) | P03, P15, P25, P26 |
| GraphQL (agregación, autorización de campo, errores parciales, límite) | P12, P13, P14, P15 |
| Servicios condicionales | no aplican: ADR-001 + CARGA-01 |
| Frontend responsivo (escritorio y móvil, mismo backend) | P01, P06, P12, P13, P22, P30 (escritorio + móvil emulado) y P28 (4 anchos) |
| Repetibilidad | todas en 2 ejecuciones independientes de la versión final (RUN-06, RUN-07) |

Ejemplo de cadena probatoria (P06, RUN-06): `RUN-06/P06/FICHA.md` → capturas `01…07` (carrito, pasarela con $11.970 CLP, confirmación) → `09-red.json` (POST /orders 201 con total 11970, POST /payments 201, POST /graphql) → `10-traza-backend.jsonl` (`order_created`, `stock_reserved`, `payment_started`, `webhook_processed`, `order_paid`, `stock_confirmed` con los mismos `cid`) → `04/08-persistencia-*.json` (orders PAGADO, payments APROBADO 11970, reserva CONFIRMADA ×2, GraphQL en sesión nueva).

---

## Etapa 5 — Incidencias y correcciones

| ID | Ejecución / evidencia de origen | Síntoma | Impacto y prioridad | Causa | Corrección / versión | Nueva ejecución | Regresión | Estado |
|---|---|---|---|---|---|---|---|---|
| **I-01** | RUN-01 / `P17` comprobación 6; `P17/03-traza-backend.jsonl` | Tras `POST /auth/logout` (200), el mismo token obtuvo 200 en `GET /orders` | Seguridad: un token robado seguiría usable hasta 5 s tras cerrar sesión. **Alta** | **Confirmada** en la traza: a las 22:47:12.150 (UTC) logout; a las 12.153 el gateway atendió `GET /orders` **sin** consultar `auth /internal/sessions` (caché de 5 s con `active=true`) | El gateway marca la sesión como inactiva en su caché al completar el logout · `cc0519c` | RUN-02, RUN-03, RUN-04, RUN-06, RUN-07: P17 aprobada | completa en cada corrida (29/29, 31/31) | **Cerrada**, con riesgo residual: otra instancia del gateway mantendría hasta 5 s de caché |
| **I-02** | RUN-05 / `P12` comprobaciones 4 y 8; `RUN-05/logs-backend/gateway.log` | La traza de la consulta de detalle no contenía `auth` | Protocolo (no afecta a usuarios); provocaba un falso negativo intermitente. **Media** | **Confirmada**: `pedidos.php` lanza dos consultas GraphQL concurrentes (cid `a957c2db` y `d8459e42`); la primera validó la sesión en auth y la segunda, 1 ms después, usó la caché (comportamiento de diseño, Módulo 6) | Protocolo v1.3: se exigen los servicios de la agregación; auth puede venir de caché · `955ad38` | RUN-06, RUN-07: P12 aprobada | completa (31/31 ×2) | **Cerrada** |

No se atribuyó al backend un error visible en el navegador sin evidencia: en I-02 la interfaz y los datos eran correctos y la causa estaba en el oráculo de la prueba. | **I-03** | Al preparar los paquetes de entrega (2026-11-10): el zip U1 no arrancaba (`Cannot find module './data/products.json'`) | Reproducibilidad: en un clon limpio de `cc0519c` faltaban `frontend/assets/data/*.json` (equipo, servicios y canales mostrarían su estado de error) y los `logs-backend/` referenciados como evidencia. **Alta** para la entrega; sin efecto en los resultados, porque las ejecuciones usaron la copia de trabajo, donde sí existían | **Confirmada**: las reglas `data/` y `*.log` de `.gitignore` excluían esas rutas, y el control de cambios sin commit del arnés no veía archivos ignorados | `.gitignore` corregido y archivos versionados · `7dd2c2e`. Los logs de CARGA-01 (65 MB) siguen fuera y se declaran | RUN-08 desde un clon limpio: 31/31 | completa | **Cerrada**. Mejora pendiente: que el arnés también registre los archivos ignorados que usa la aplicación |
| **I-04** | Revisión de integridad pedida por el equipo (2026-11-10), sin re-ejecutar pruebas | Los comandos de reproducción del README (`--run RUN-04`), de este informe y de ENTREGA-U3 (`--run RUN-08`) y el de la prueba de carga (`CARGA-01` por omisión) fallaban con "ya existe"; el informe U2 citaba evidencia de RUN-03 (no final) que no viene en el paquete U2; en el paquete U1 la ficha de P28 tenía enlaces rotos | Reproducibilidad de la entrega. **Alta** (un tercero no podía repetir la observación con las instrucciones). No afecta a ningún resultado | **Confirmada** ejecutando los comandos documentados: el arnés rechaza IDs existentes por diseño (integridad), pero la documentación no se actualizó al crear nuevas ejecuciones; además, los paquetes se armaron sin verificar enlaces | IDs nuevos en las instrucciones (RUN-09, CARGA-02); referencias a RUN-06; el paquete U1 conserva la ruta original `evidencias/RUN-06/P28/`; verificación automática de enlaces en los tres paquetes | no requiere: no hubo cambios de código ni de pruebas | — | **Cerrada** |

Los resultados de RUN-01 y RUN-05 se conservan sin modificar.

**Incidencias abiertas:** ninguna de sistema detectada por las pruebas. **Bloqueo abierto:** P32 (Docker). La ausencia de más fallos se acredita con 19 pruebas de rechazo, límite o fallo controlado y regresión completa en 6 corridas; no prueba ausencia de defectos fuera de lo probado.

---

## Etapa 6 — Resultados, indicadores y conclusiones

### 6.1 Conteos (versión final: RUN-06 y RUN-07)

| | Pruebas distintas |
|---|---|
| Planificadas | 32 (P01–P32) |
| Aprobadas (en ambas ejecuciones) | 31 |
| Fallidas | 0 |
| Bloqueadas | 1 (P32, sin demonio Docker) |
| No ejecutadas | 0 |
| Repeticiones | 2 × 31 = 62 ejecuciones de prueba, 366 comprobaciones, 366 cumplidas |

Evolución (no se suman versiones): línea base 0 flujos integrados → `ac929d3` 28/29 → `cc0519c` 29/29 ×2 (v1.1) → 31/31 ×2 (v1.3).

### 6.2 Indicadores

| Indicador | Cálculo | Valor | Interpretación |
|---|---|---|---|
| Cobertura del diseño | 14 requisitos con criterio y prueba / 14 | **100 %** | mide planificación, no logro |
| Ejecución del plan | 31 pruebas con resultado / 32 planificadas | **96,9 %** | P32 bloqueada se reporta aparte, no se elimina del plan |
| Aprobación observada | 31 aprobadas / 31 ejecutadas (regla: aprobar en ambas corridas) | **100 %** | en el entorno local evaluado |
| Logro demostrado | 11 requisitos / 14 | **78,6 %** | R04, R10 y R14 solo parcialmente demostrados |

Los porcentajes no equivalen a probabilidad de éxito en producción.

### 6.3 Matriz de conclusiones

| Req./flujo | Afirmación | Criterios | Ejecuciones y evidencias | Resultado | Límite de validez | Riesgo pendiente | Próxima acción |
|---|---|---|---|---|---|---|---|
| R01 F01–F02 | El catálogo, el carrusel y los destacados muestran lo que devuelve inventory, con estados vacío/error/recuperación | CA01–03, 25, 30 | RUN-06/07: P01–P03, P25, P30 | **Demostrado** en el entorno evaluado | 9 productos sintéticos | catálogos grandes sin paginación en UI | paginar catálogo si crece |
| R02 F03 | Registro, login y cierre de sesión funcionan; sesión expirada/revocada se rechaza y la UI lo comunica | CA04, 05, 17 | P04, P05, P17 | **Demostrado** | token expirado fabricado por el arnés | bloqueo por intentos es por cuenta (DoS dirigido) | evaluar bloqueo progresivo |
| R03 F04 | El pedido usa precios y stock del servidor, no se duplica por reintento y rechaza stock insuficiente | CA06–09 | P06–P09 | **Demostrado** | concurrencia masiva no probada | compras simultáneas del último ítem | prueba concurrente de reservas |
| R04 F05 | El pago se inicia, confirma, rechaza y reintenta correctamente; notificaciones duplicadas o falsas no tienen efecto | CA06, 10, 11, 26 | P06, P10, P11, P26 | **Parcialmente demostrado** | solo contra el **doble de prueba**; no hay interoperabilidad con un proveedor real | contrato real puede diferir | integrar el sandbox oficial de un proveedor |
| R05 F06 | Mis pedidos agrega 4 subsistemas, solo muestra pedidos propios y advierte información parcial | CA12–15 | P12–P15 | **Demostrado** | — | — | — |
| R06 F07 | Cancelar libera stock y conserva historial | CA20 | P20 | **Demostrado** | — | — | — |
| R07 F08 | El perfil valida RUT en servidor y cifra PII en reposo | CA21 | P21 | **Demostrado** | rotación de la clave PII no probada | re-cifrado manual | automatizar rotación |
| R08 F09 | Las órdenes especiales se registran y la administración las ve | CA22, 27 | P22, P27 | **Demostrado** | cambio de estado de solicitudes en UI no probado | — | agregar a P22 |
| R09 F10 | Alta y baja lógica de productos se reflejan en el catálogo | CA23, 18 | P23, P18 | **Demostrado** | edición (PUT) solo por código, no por prueba | — | agregar edición a P23 |
| R10 F11 | Estados, resumen y clientes enmascarados en admin | CA24, 31, 18 | P24, P31, P18 | **Parcialmente demostrado** | la gestión de solicitudes en la UI admin no se probó | — | ampliar P31 |
| R11 F12 | Se cumplen los controles de acceso probados (sin sesión, expirada, rol, ajeno, acceso directo, ACL de secretos, datos alterados, límites) | CA09, 11, 13, 14, 16–19, 27, 29 | P09, P11, P13, P14, P16–P19, P27, P29 | **Demostrado para esos controles** — no se concluye "sistema seguro" | sin TLS local; sin pruebas de penetración | caché de sesión multi-instancia; límites en memoria | TLS, límite distribuido |
| R12 | Fallos de inventory y del proveedor se comunican y se recuperan | CA03, 15, 25, 26 | P03, P15, P25, P26 | **Demostrado** para esas dependencias | caídas de orders/clients/payments/auth no inyectadas | — | ampliar inyección de fallos |
| R13 | La interfaz se adapta de 360 a 1440 px y las acciones críticas funcionan en móvil | CA28 + móvil en P01/06/12/13/22/30 | P28 y variantes móviles | **Demostrado en emulación** | no se usaron dispositivos físicos ni Safari/Firefox | diferencias de motor | prueba manual en un teléfono real |
| R14 | El sistema se inicia de forma reproducible con separación pública/privada | CA32 | cada RUN arranca con `stack.js`; P19 (servicios privados exigen identidad); P32 bloqueada | **Parcialmente demostrado** | compose no ejecutado; en modo local la "red privada" es loopback | compose con errores no detectados | ejecutar P32 con Docker |

**Conclusión global.** En la versión `cc0519c`, ejecutada localmente, los 12 flujos del caso operan desde el frontend hasta los servicios reales con persistencia, permisos y agregación verificables; las 31 pruebas ejecutables aprobaron en dos ejecuciones independientes desde un estado inicial controlado, en escritorio y móvil emulado. Quedan **no demostrados**: interoperabilidad con un proveedor de pagos real, despliegue con Docker Compose, comportamiento en dispositivos físicos, concurrencia de escritura y operación con TLS. No se afirma que el sistema esté "listo para producción".

### 6.4 Amenazas a la validez

Datos pequeños y sintéticos · móvil emulado · proveedor de pagos simulado · entorno local de un solo host (servicios en loopback, sin TLS, generador de carga compitiendo por CPU) · el mismo agente implementó, escribió el protocolo y ejecutó (sesgo del observador; mitigado parcialmente con oráculos automáticos y verificación independiente de la pantalla) · token expirado fabricado con la clave de prueba · protocolo ajustado tres veces (registrado, con repetición completa) · ensayos en seco no conservados · P32 bloqueada.

### 6.5 Acciones pendientes (por riesgo)

1. Ejecutar P32 con Docker y registrar RUN-09 por un integrante (riesgo: despliegue).
2. Sandbox oficial de un proveedor de pagos (R04).
3. TLS en el gateway y límite de solicitudes/caché de sesión compartidos si hay varias instancias.
4. Prueba concurrente de reserva del último ítem; inyección de fallos en orders/payments/auth.
5. Ampliar P23 (edición) y P31 (solicitudes); prueba en teléfono físico.
6. Procedimiento de eliminación de cuenta y plazos de retención.

---

## Etapa 7 — Entrega y defensa

### 7.1 Entregables

| Entregable | Ubicación |
|---|---|
| Aplicación integrada | `frontend/`, `backend/`, `docker-compose.yml`, `README.md` |
| Informe | este documento + `docs/unidad2-informe.md` + `docs/unidad1-frontend.md` + `docs/adr/ADR-001-analitica-grpc.md` |
| Matriz de trazabilidad | `docs/trazabilidad.csv` (editable) |
| Paquete de evidencias | `evidencias/INDICE.md`, `evidencias/RUN-01…08`, `evidencias/CARGA-01` (sin sus logs de 65 MB) |
| Pruebas y reproducción | `tests/runner.mjs`, `tests/suites/`, `tests/load/`, `backend/scripts/reset-data.js`; P32 es manual |
| Bitácora y contribuciones | Etapa 3 de este informe, historial de git, sección 7.2 |

### 7.2 Contribuciones (*completar por el equipo*)

| Integrante | Aportes | Respaldo (commits, ejecuciones, revisiones) |
|---|---|---|
| Bruno Martínez | prototipo U1 (PHP, carrusel/cards dinámicos), mockup a mano | commits hasta `1087c34` |
| *(integrante)* | | |
| Asistencia de IA (Claude Code) | implementación U2/U3, arnés, ejecuciones RUN-01…08 y CARGA-01, borradores de informes | commits `ac929d3`, `cc0519c`, `a5c99b7`, `955ad38` y posteriores |

### 7.3 Guion sugerido de defensa

1. Versión `cc0519c`, entorno local, proveedor simulado y limitaciones (Etapa 1).
2. Flujo crítico en vivo, p. ej. C2: comprar 2 Choco Miau → pasarela → aprobar; mostrar `X-Correlation-Id` en la red y buscarlo en `logs-backend/` y la fila en `orders.db`.
3. Fallo controlado: detener inventory (P03/P15) y mostrar mensaje, "Información parcial" y recuperación.
4. Reconstruir una conclusión: R03 → CA08 → P08 → RUN-06/07 → `P08/*-red.json` (misma Idempotency-Key) → conclusión.
5. Corrección: I-01 (traza de RUN-01/P17 → `cc0519c` → P17 aprobada en RUN-02…07).
6. Cualquier cambio durante la defensa se registra como una nueva versión y una nueva ejecución (RUN-09 en adelante).

### 7.4 Control final

- ¿Se inicia con las instrucciones? Sí, modo local (README); compose no verificado.
- ¿Servicios propios reales? Sí; solo el proveedor de pagos es doble de prueba.
- ¿Cada conclusión tiene pruebas y evidencias localizables? Sí (`trazabilidad.csv`).
- ¿Se conservaron fallos? Sí: RUN-01 (P17) y RUN-05 (P12).
- ¿Capturas y logs sin credenciales? P29 aprobada en las 8 corridas (0 coincidencias); las capturas no muestran contraseñas (campos tipo password).
- ¿Resultados de la versión final? RUN-06 y RUN-07 sobre `cc0519c` con protocolo v1.3, y RUN-08 reproducida desde un clon limpio de `7dd2c2e` (I-03).
