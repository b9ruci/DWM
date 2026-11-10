# Resultados RUN-04

- Inicio: 2026-11-09T20:02:46-03:00 (America/Santiago) · Fin: 2026-11-09T20:03:55-03:00 (America/Santiago)
- Ejecutor: Agente automatizado (Claude Code) en contenedor cloud — revisar y re-ejecutar por el equipo
- Versión: commit `a5c99b7` (rama claude/blissful-dirac-hdjhek; 0 archivos sin commit en backend/frontend/tests)
- Navegador: Chromium 153.0.8010.12 (Playwright, headless)
- Viewports: escritorio 1366x768 · móvil Pixel 7 emulado 412x839 (DPR 2.625, táctil)
- Estado inicial: Bases SQLite nuevas en .tmp/runs/RUN-04/data (migraciones + semillas ficticias). Cuentas: admin, clienteA, clienteB (contraseñas fuera del repositorio).
- Dependencias: DOBLE DE PRUEBA del proveedor de pagos (no demuestra interoperabilidad con un proveedor real); servicios propios reales


**Resumen:** APROBADA: 31 (total 31 pruebas distintas)

| Prueba | Flujo | Req. | Crítico | Tipo | Estado | Compr. OK | Evidencias |
|---|---|---|---|---|---|---|---|
| [P01](P01/FICHA.md) Consultar catálogo desde el frontend con datos reales de inventory | F01 | R01 | C1 | éxito | **APROBADA** | 5/5 | 4 |
| [P02](P02/FICHA.md) Filtro por categoría y búsqueda sin resultados (estado vacío) | F01 | R01 | C1 | límite | **APROBADA** | 3/3 | 3 |
| [P03](P03/FICHA.md) inventory indisponible: mensaje comprensible y recuperación con "Reintentar" | F01 | R12 | C1 | fallo y recuperación | **APROBADA** | 4/4 | 4 |
| [P04](P04/FICHA.md) Registro de cuenta desde el frontend y persistencia en auth y clients | F03 | R02 |  | éxito | **APROBADA** | 5/5 | 4 |
| [P05](P05/FICHA.md) Credenciales inválidas y contraseña débil | F03 | R02 |  | rechazo | **APROBADA** | 4/4 | 3 |
| [P06](P06/FICHA.md) Compra completa: carrito → pedido → pago aprobado en sandbox → PAGADO | F04-F05 | R03,R04 | C2 | éxito | **APROBADA** | 20/20 | 10 |
| [P07](P07/FICHA.md) Stock insuficiente: el servidor rechaza y no crea pedido ni descuenta stock | F04 | R03 | C2 | rechazo / límite | **APROBADA** | 3/3 | 3 |
| [P08](P08/FICHA.md) Reintento tras perder la respuesta de POST /orders no duplica el pedido | F04 | R03 | C2 | recuperación (reintento) | **APROBADA** | 3/3 | 4 |
| [P09](P09/FICHA.md) Datos alterados por el navegador: precio, monto y estado de pago no son confiables | F04-F05 | R03,R04,R11 |  | rechazo | **APROBADA** | 4/4 | 2 |
| [P10](P10/FICHA.md) Pago rechazado por el proveedor y nuevo intento aprobado | F05 | R04 | C2 | rechazo y recuperación | **APROBADA** | 5/5 | 4 |
| [P11](P11/FICHA.md) Notificación duplicada del proveedor y notificación con firma inválida | F05 | R04,R11 |  | rechazo / duplicado | **APROBADA** | 4/4 | 2 |
| [P12](P12/FICHA.md) Mis pedidos: agregación GraphQL (orders + inventory + payments + clients) en pantalla real | F06 | R05 | C3 | éxito | **APROBADA** | 9/9 | 4 |
| [P13](P13/FICHA.md) Un cliente no puede ver, pagar ni cancelar el pedido de otro cliente | F06 | R05,R11 | C3 | rechazo (recurso ajeno) | **APROBADA** | 10/10 | 4 |
| [P14](P14/FICHA.md) Límites y autorización por campo en GraphQL | F06 | R05,R11 | C3 | límite | **APROBADA** | 7/7 | 2 |
| [P15](P15/FICHA.md) GraphQL con inventory caído: información parcial advertida y recuperación | F06 | R05,R12 | C3 | fallo y recuperación | **APROBADA** | 4/4 | 4 |
| [P16](P16/FICHA.md) Operaciones protegidas sin sesión | F12 | R11 |  | rechazo | **APROBADA** | 6/6 | 3 |
| [P17](P17/FICHA.md) Sesión expirada y sesión cerrada (revocada) | F12 | R02,R11 |  | rechazo (sesión expirada/revocada) | **APROBADA** | 6/6 | 3 |
| [P18](P18/FICHA.md) Cliente intenta operaciones de administración | F10-F11 | R09,R10,R11 |  | rechazo (rol sin permiso) | **APROBADA** | 7/7 | 3 |
| [P19](P19/FICHA.md) Acceso directo a servicios privados y al administrador de secretos | F12 | R11 |  | rechazo (acceso directo) | **APROBADA** | 10/10 | 2 |
| [P20](P20/FICHA.md) Cancelar un pedido pendiente desde la interfaz libera el stock | F07 | R06 |  | éxito | **APROBADA** | 5/5 | 3 |
| [P21](P21/FICHA.md) Perfil: validación de RUT en servidor y datos personales cifrados en reposo | F08 | R07 |  | rechazo y éxito | **APROBADA** | 3/3 | 4 |
| [P22](P22/FICHA.md) Solicitud de orden especial desde "¡Contáctanos!" (móvil) | F09 | R08 |  | éxito y validación | **APROBADA** | 4/4 | 4 |
| [P23](P23/FICHA.md) Administración de productos: alta y baja lógica reflejadas en el catálogo público | F10 | R09 |  | éxito | **APROBADA** | 3/3 | 3 |
| [P24](P24/FICHA.md) Administración de estados: PAGADO → EN_PREPARACION y transición inválida | F11 | R10 |  | éxito y rechazo | **APROBADA** | 3/3 | 3 |
| [P25](P25/FICHA.md) inventory con respuesta demorada 5 s: el gateway corta a los 4 s y la interfaz lo comunica | F01 | R12 |  | fallo (demora controlada) | **APROBADA** | 3/3 | 3 |
| [P26](P26/FICHA.md) Proveedor de pagos (sandbox) indisponible al iniciar el pago | F05 | R04,R12 |  | fallo y recuperación | **APROBADA** | 4/4 | 3 |
| [P27](P27/FICHA.md) Límite de solicitudes en una ruta anónima sensible (contact-requests) | F09 | R11 |  | límite | **APROBADA** | 3/3 | 3 |
| [P28](P28/FICHA.md) Comportamiento responsivo en 4 anchos (inicio, catálogo, carrito) | F01-F04 | R13 |  | responsivo | **APROBADA** | 20/20 | 12 |
| [P30](P30/FICHA.md) Inicio según el mockup: carrusel de promociones y destacados consistentes con inventory | F02 | R01 |  | éxito | **APROBADA** | 12/12 | 4 |
| [P31](P31/FICHA.md) Administración: resumen de ventas (GraphQL) y listado de clientes enmascarado | F11 | R10 |  | éxito | **APROBADA** | 2/2 | 4 |
| [P29](P29/FICHA.md) Las evidencias y logs de la ejecución no contienen secretos ni contraseñas | Transversal | R11 |  | control de protección | **APROBADA** | 2/2 | 1 |

Los logs completos del backend de esta ejecución están en `logs-backend/` (JSON por línea, sin secretos).
