# CARGA-01 — Prueba de carga

- **id:** CARGA-01
- **tipo:** MEDICIÓN (no proyección)
- **fecha:** 2026-11-09T22:51:54.096Z
- **commit:** cc0519c
- **entorno:** Linux 6.18.44-fc-v310, 4 vCPU (Intel(R) Xeon(R) Processor @ 2.10GHz), 15.7 GiB RAM, Node v22.23.4; generador de carga en la MISMA máquina (compite por CPU)
- **datos:** Semillas ficticias (9 productos) + 5 pedidos de clienteA (2 pagados)
- **configuracion:** RATE_LIMIT_DEFAULT elevado solo para la medición; resto igual al modo local
- **concurrencia:** 20
- **duracionPorEscenarioS:** 20

| Escenario | Solicitudes | req/s | p50 ms | p95 ms | p99 ms | Errores | ¿Cumple p95<300 y 0 errores? |
|---|---|---|---|---|---|---|---|
| L1 GET /products (anónimo) | 53289 | 2663.7 | 6.7 | 13.7 | 19 | 0 (0.00 %) | sí |
| L2 GraphQL misPedidos (orders+inventory+payments+clients) | 9848 | 491.6 | 38.4 | 60.2 | 84.2 | 0 (0.00 %) | sí |
| L3 GraphQL resumenVentas (ADMIN) | 23117 | 1155.6 | 16.6 | 26.6 | 33.6 | 0 (0.00 %) | sí |

**CPU promedio y RSS pico por proceso:**

- L1 GET /products (anónimo): CPU {"secrets":"0.1 %","clients":"0.2 %","inventory":"63.1 %","auth":"0.3 %","orders":"0.3 %","payments":"0.2 %","graphql":"0.2 %","payment-sandbox":"0.3 %","gateway":"112.2 %"} · RSS MB {"secrets":50.6,"clients":71.7,"inventory":113.9,"auth":72.1,"orders":73.7,"payments":66,"graphql":67.9,"payment-sandbox":68.9,"gateway":190.7}
- L2 GraphQL misPedidos (orders+inventory+payments+clients): CPU {"secrets":"0.0 %","clients":"16.8 %","inventory":"16.8 %","auth":"0.1 %","orders":"26.4 %","payments":"20.2 %","graphql":"107.1 %","payment-sandbox":"0.0 %","gateway":"51.3 %"} · RSS MB {"secrets":49.8,"clients":82.2,"inventory":114.6,"auth":71.8,"orders":84.2,"payments":79.2,"graphql":194.4,"payment-sandbox":66.7,"gateway":191.3}
- L3 GraphQL resumenVentas (ADMIN): CPU {"secrets":"0.0 %","clients":"0.0 %","inventory":"0.0 %","auth":"0.1 %","orders":"42.8 %","payments":"0.0 %","graphql":"96.6 %","payment-sandbox":"0.0 %","gateway":"89.0 %"} · RSS MB {"secrets":49.8,"clients":82.2,"inventory":114.6,"auth":75,"orders":88.5,"payments":79.3,"graphql":201.3,"payment-sandbox":66.7,"gateway":191.4}
