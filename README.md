# Chocolatería Chocomanía — aplicación integrada (Unidades 1, 2 y 3)

Caso: tienda en línea de una chocolatería artesanal (catálogo, carrito, pedidos, pagos, órdenes especiales y administración).
Integrante registrado: Bruno Martínez (Sección 8481).

El diseño parte del mockup hecho a mano: [`docs/diseno/mockup-chocolateria.jpeg`](docs/diseno/mockup-chocolateria.jpeg).

| Unidad | Qué contiene | Documento |
|---|---|---|
| 1 — Front-end responsivo | Bootstrap (grid), box model, flexbox, DOM dinámico, estados de carga/vacío/error | [`docs/unidad1-frontend.md`](docs/unidad1-frontend.md) |
| 2 — Backend seguro | API Gateway, Auth, gestor de secretos, GraphQL Gateway, inventory, orders, clients, payments | [`docs/unidad2-informe.md`](docs/unidad2-informe.md) |
| 3 — Integración y validación | Protocolo, ejecuciones, evidencias, incidencias, indicadores y conclusiones | [`docs/unidad3-informe.md`](docs/unidad3-informe.md) |

## Arquitectura (resumen)

```
Navegador ──► Frontend PHP :8000 (HTML/CSS/JS, sin secretos)
   │
   └──► API Gateway :8080  (único backend público: lista blanca de rutas, JWT RS256, revocación,
          │                  límites de solicitudes, timeouts, CORS, X-Correlation-Id)
          ├─► auth       (credenciales scrypt, sesiones, JWT)
          ├─► inventory  (catálogo, stock, reservas)          ┐
          ├─► orders     (pedidos y transiciones)            │ servicios privados: exigen
          ├─► clients    (perfil cifrado, solicitudes)       │ identidad de servicio HMAC
          ├─► payments   (pagos, webhooks firmados) ──► payment-sandbox :8090 (DOBLE DE PRUEBA)
          └─► graphql    (agregación orders+inventory+payments+clients)
   secrets (administrador de secretos con ACL por consumidor) ◄── todos los servicios al arrancar
```

## Requisitos

- Node.js ≥ 22.13 (usa `node:sqlite`), PHP ≥ 8.1 (servidor embebido), npm.
- Opcional: Docker + Docker Compose (`docker-compose.yml`, separación de redes).
- Para las pruebas E2E: Playwright con Chromium (`npm i playwright && npx playwright install chromium` si no está instalado).

## Inicio rápido (modo local, verificado)

```bash
cd backend && npm ci && cd ..
```

```bash
node backend/scripts/init-secrets.js
```

```bash
node backend/scripts/start-local.js
```

Abrir http://localhost:8000. Las cuentas de prueba ficticias (admin, clienteA, clienteB) tienen contraseñas
aleatorias generadas en `.secrets/seed-accounts.json` (no se versiona; no compartir).

Restaurar los datos al estado inicial (con el sistema detenido):

```bash
node backend/scripts/reset-data.js
```

## Docker Compose (alternativa)

```bash
node backend/scripts/init-secrets.js
```

```bash
docker compose up --build
```

Publica solo :8000, :8080 y :8090; los servicios privados y el gestor de secretos quedan en una red `internal`.
**Limitación:** este archivo no pudo verificarse en el entorno donde se desarrolló (sin demonio Docker).

## Pruebas y evidencias

```bash
node tests/runner.mjs --run RUN-04
```

Cada ejecución arranca el sistema con bases de datos nuevas, ejecuta P01–P29 (escritorio y móvil emulado) y guarda en
`evidencias/RUN-04/` fichas, capturas, red con credenciales enmascaradas, trazas del backend por `X-Correlation-Id`
y comprobaciones de persistencia. Las ejecuciones existentes no se sobrescriben.

Prueba de carga (ADR-001):

```bash
node tests/load/load-test.mjs
```

## Estructura

```
frontend/        páginas PHP + assets (css, js/core, js/pages, img, vendor autoalojado)
backend/         lib compartida, services/<servicio>, scripts (init-secrets, start-local, reset-data, rotate-secret)
tests/           runner.mjs (arnés), suites/, lib/, load/
evidencias/      RUN-01, RUN-02, RUN-03 … (resultados originales, incluidos fallos)
docs/            informes U1–U3, diagramas (Mermaid), ADR, trazabilidad
```

## Línea base e historial

La versión inicial (prototipo PHP en la raíz con datos `resAPI` locales, commit `1087c34`) se conserva en el historial
de git; su análisis está en `docs/unidad3-informe.md` (Etapa 1).

Nota heredada sobre los PR: el primer PR figura como cerrado sin merge porque en la segunda semana se crearon archivos
PHP en clases cuya estructura no coincidía con los HTML de la primera semana; el `index.html` original sigue en el PR 1.
