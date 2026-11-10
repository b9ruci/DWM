# Unidad 1 — Front-end responsivo · Chocolatería Chocomanía

## Caso, actor, flujo y concerns

- **Actor principal:** cliente de la chocolatería (también visitante y administración).
- **Objetivo:** encontrar chocolates, agregarlos al carrito y confirmar un pedido; o solicitar una orden especial.
- **Flujo principal:** inicio (carrusel + destacados) → catálogo con filtros → agregar → carrito → confirmar → pago → "Mis pedidos".
- **Concerns de front-end:** responsividad (el mockup es de escritorio; en móvil se reordena), rendimiento (dependencias autoalojadas, imágenes SVG livianas, carga diferida), accesibilidad (etiquetas, `aria-live`, foco visible, "Saltar al contenido"), comunicación con servicios (un único cliente `api.js` con plazo máximo e identificador de correlación) y resiliencia (estados de carga, vacío, error con "Reintentar").
- **Tensión resuelta:** el mockup pide menús desplegables "cuando pase el cursor"; en pantallas táctiles no existe *hover*. Decisión: hover solo con `@media (min-width: 992px) and (hover: hover)`; en móvil, clic dentro del menú colapsado.

## Diseño previo → implementación

El diseño previo es el boceto a mano [`docs/diseno/mockup-chocolateria.jpeg`](diseno/mockup-chocolateria.jpeg).

| Elemento del mockup | Implementación | Archivo |
|---|---|---|
| Recuadro "Logo" a la izquierda ocupando dos filas | columna `col-auto col-md-2 col-xl-1` con `.brand-logo` (aspect-ratio 1, `max-width: 120px`) | `includes/header.php`, `styles.css` |
| Título "CHOCOLATERÍA CHOCOMANÍA" | `.brand-title` con `clamp()` para escalar | idem |
| Ícono de usuario (círculo) y caja superior derecha | botón circular `.icon-btn` con menú de cuenta + buscador (la caja garabateada se interpretó como búsqueda) | idem |
| Botones INICIO · CATÁLOGO · NOSOTROS · SERVICIOS, "dropdown cuando pase cursor" | `navbar-expand-lg` + dropdowns abiertos por hover en escritorio; categorías del catálogo cargadas desde la API | `header.php`, `header.js` |
| Carrito con contador (1) | `.icon-btn` + `.cart-badge` actualizado por evento `choco:cart` | `cart.js`, `header.js` |
| Carrusel con flechas circulares laterales, imagen izq., "BARRA CHOCOLATE DUBAI LABUBU", "100.000 venta por kilo", puntos abajo | `.hero-shell` (flex: flecha · carrusel · flecha), slide en grid `col-md-5/col-md-7`, `.price-tag`, `.hero-dots` fuera de la imagen; datos de `GET /promotions` | `index.php`, `home.js` |
| "PRODUCTOS DESTACADOS" con línea | `.section-title` (flex + `::after` que ocupa el resto) | `styles.css` |
| Tarjetas CHOCO MIAU / CHOCO WAU / FLOR CHOCOLATE con "$$$ x un [1]" y 4ª tarjeta cortada "…" | riel horizontal `.product-rail` con scroll-snap (3 tarjetas + la 4ª asomando en escritorio) y tarjeta final "••• Ver todo el catálogo"; precio, unidad, cantidad y botón por tarjeta | `home.js`, `ui.js` |
| "ÓRDENES ESPECIALES" texto izq. + caja "Orden a pedido customizado" + "¡CONTÁCTANOS!" | grid `col-lg-7 / col-lg-5`, `.special-box`, botón a `contacto.php?tipo=ORDEN_ESPECIAL` | `index.php` |

Diferencias justificadas: en móvil las flechas del carrusel se ocultan (se desliza con el dedo y quedan los puntos); el riel muestra 1 tarjeta y fracción para sugerir desplazamiento; el carrito pasa junto al botón de menú para quedar siempre visible.

## Reglas responsivas (grid, box model, flexbox)

| Región | < 576 | 576–767 | 768–991 | 992–1399 | ≥ 1400 |
|---|---|---|---|---|---|
| Header | logo 64 px, menú colapsado, carrito y usuario visibles | igual | logo col-2 | menú horizontal + buscador | igual |
| Carrusel | imagen arriba / texto abajo | igual | imagen 5/12 · texto 7/12, flechas | igual | igual |
| Destacados (riel) | 82 % por tarjeta | 50 % | 50 % | 28 % (3 + la 4ª asomando) | 25 % |
| Catálogo (grid) | 1 col | 2 col | 3 col | 3 col + filtros a la izquierda (3/12) | 4 col |
| Órdenes especiales | apilado | apilado | apilado | 7/12 + 5/12 | igual |

- **Grid:** Bootstrap 5.3.8 para la macroestructura (`row`, `col-*`, `row-cols-*`).
- **Box model:** `box-sizing: border-box` global; bordes de 2 px coherentes con el trazo del boceto; `padding` interno de tarjetas/paneles; `max-width` en logo y buscador; `min-width: 0` en el carrusel flexible; `aspect-ratio` en imágenes.
- **Flexbox:** header (título ↔ acciones), fila de compra de la tarjeta, títulos de sección con línea, riel de destacados, carrusel con flechas, líneas del carrito, tarjetas de pedido, estados operacionales.

## DOM y servicios

Todo el contenido de negocio se genera en tiempo de ejecución con `createElement`/`textContent` (sin `innerHTML` con datos): carrusel, destacados, catálogo, categorías del menú, carrito, pedidos, perfil y administración. Eventos con `addEventListener`, cambios de clases/atributos (`is-invalid`, `active`, `aria-pressed`, `data-state`). Para la entrega U1 los datos provienen de la **API simulada** `frontend/mock-api/` (`node frontend/mock-api/server.js`), que responde desde archivos JSON con el mismo contrato que el backend; en la U2/U3 el mismo código consume el **API Gateway real** (`assets/js/core/api.js`), sin cambios en las páginas. La API simulada permite forzar latencia (`MOCK_DELAY_MS`) y fallos (`MOCK_FAIL=products`) para mostrar los estados. Contenido puramente informativo (equipo, canales, servicios) se lee de `assets/data/*.json` por HTTP.

Estados: `showLoading` (spinner), `showEmpty` (con acción), `showError` (mensaje comprensible, referencia de correlación y botón "Reintentar"), mensajes de formulario y *toasts*.

## Evidencia responsiva en cuatro anchos

Generada automáticamente por la prueba P28 (sin desborde horizontal; menú colapsado < 992 px; columnas 1/3/3/4): capturas de página completa en
[`evidencias/RUN-06/P28/`](../evidencias/RUN-06/P28/) (ejecución de la versión final) — 360 px, 768 px, 1024 px y 1440 px para inicio, catálogo y carrito.

| Ancho | Qué escala, refluye o se transforma |
|---|---|
| 360 px | logo 64 px; menú hamburguesa; carrusel apilado sin flechas; riel 1 tarjeta + fracción; catálogo 1 columna; filtros sobre la grilla |
| 768 px | carrusel en dos columnas con flechas; riel 2 tarjetas; catálogo 3 columnas; footer en 3 columnas |
| 1024 px | menú horizontal con dropdowns por hover; buscador visible; filtros a la izquierda |
| 1440 px | catálogo 4 columnas; riel 4 tarjetas |
