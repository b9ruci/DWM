# ADR-001 — Aplicabilidad de un servicio de analítica separado y de comunicación gRPC

- **Estado:** aceptada (Unidad 2), ratificada en Unidad 3 con la medición `evidencias/CARGA-01`.
- **Fecha:** 2026-11-09

## Contexto

Chocomanía es una chocolatería artesanal con una tienda en línea pequeña. Caracterización (proyección declarada, no medición):

| Dimensión | Valor proyectado | Fundamento |
|---|---|---|
| Visitas | ~2.000/día; pico ~2 solicitudes/s | negocio local, campañas estacionales (San Valentín, Pascua) |
| Pedidos | ~30–80/día; pico ~300 en fechas especiales | capacidad de producción artesanal |
| Catálogo | < 100 productos | elaboración manual |
| Tamaño de mensajes | < 10 KB (JSON) | listas paginadas (máx. 20) |
| Latencia esperada | interacción < 1 s | experiencia de compra |
| Streaming | no hay eventos continuos que el usuario deba recibir; el estado del pago se confirma con un webhook y la UI consulta | flujo de pago hospedado |
| Reportes | resumen de ventas de 30 días para la administración | volumen de miles de filas por año |

## Alternativas

1. **Servicio de analítica separado** (réplica/ETL hacia almacén analítico, procesamiento por lotes).
2. **gRPC interno** entre GraphQL Gateway y servicios (tipado, streaming).
3. **Alternativa elegida:** agregación SQL en `orders` (`GET /internal/reports/sales`, solo ADMIN, expuesta como `resumenVentas` en GraphQL) y comunicación REST/JSON interna con identidad de servicio HMAC, plazos y batching.

## Decisión

No se implementa servicio de analítica separado ni gRPC. Los reportes requeridos son agregaciones pequeñas sobre datos que `orders` ya posee; no hay requisito de streaming, de mensajes grandes ni de alta concurrencia que justifique un contrato binario o un pipeline analítico. Un reporte diario/mensual pequeño "puede resolverse sin big data" (guía U2, Módulo 9).

## Consecuencias

- (+) Menos componentes, menos secretos y menos superficie de ataque; la autoridad de los datos de venta sigue en `orders`.
- (+) El GraphQL Gateway ya combina servicios REST con batching y plazos (2 s por dependencia).
- (−) Las consultas de reporte se ejecutan sobre la base transaccional; si crecen (p. ej. > 100.000 pedidos/año o reportes pesados) competirán con la operación. **Disparadores para revisar el ADR:** p95 de `resumenVentas` > 300 ms con la carga objetivo, necesidad de reportes históricos multi-año o de notificar estados de despacho en tiempo real (en ese caso se evaluaría streaming de servidor gRPC hacia un adaptador SSE/WebSocket compatible con el navegador).

## Evidencia de que la alternativa satisface la carga

Medición reproducible `node tests/load/load-test.mjs` → `evidencias/CARGA-01/RESULTADO.md` (20 usuarios concurrentes, 20 s por escenario, generador en la misma máquina). Objetivo declarado antes de medir: p95 < 300 ms y 0 % errores (≈ 10× el pico proyectado).

| Escenario | req/s | p95 | Errores | Cumple |
|---|---|---|---|---|
| L1 catálogo anónimo | 2.663,7 | 13,7 ms | 0 | sí |
| L2 GraphQL misPedidos (4 servicios) | 491,6 | 60,2 ms | 0 | sí |
| L3 GraphQL resumenVentas (analítica) | 1.155,6 | 26,6 ms | 0 | sí |

Límites de interpretación: entorno local de un solo host, datos sintéticos pequeños, sin red real entre servicios; no equivale a capacidad de producción.
