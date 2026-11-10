// Inicio: carrusel de promociones y riel de destacados generados desde el backend.
import { api } from '../core/api.js';
import { cart } from '../core/cart.js';
import { el, clp, unidadTexto, productCard, showLoading, showEmpty, showError, toast } from '../core/ui.js';

async function loadPromotions() {
  const inner = document.getElementById('promoSlides');
  const dots = document.getElementById('promoDots');
  const r = await api('/promotions');
  if (!r.ok || r.data.data.length === 0) {
    const box = el('div', { class: 'hero-slide' });
    inner.replaceChildren(el('div', { class: 'carousel-item active' }, [box]));
    if (!r.ok) showError(box, r, loadPromotions);
    else showEmpty(box, 'Pronto tendremos nuevas promociones.');
    dots.replaceChildren();
    return;
  }
  const promos = r.data.data;
  inner.replaceChildren(
    ...promos.map((p, i) =>
      el('div', { class: `carousel-item${i === 0 ? ' active' : ''}`, dataset: { promo: p.id } }, [
        el('div', { class: 'hero-slide' }, [
          el('div', { class: 'row g-0 h-100' }, [
            el('div', { class: 'col-12 col-md-5 col-lg-5' }, [el('div', { class: 'hero-img' }, [el('img', { src: p.imagen, alt: p.titulo, width: '280', height: '280' })])]),
            el('div', { class: 'col-12 col-md-7 col-lg-7' }, [
              el('div', { class: 'hero-copy' }, [
                el('h2', { text: p.titulo }),
                el('p', { class: 'mb-0 fs-5', text: p.subtitulo }),
                el('div', { class: 'price-tag' }, [el('strong', { text: clp(p.precio) }), el('span', { class: 'fs-5', text: unidadTexto(p.unidad) })]),
                el('div', { class: 'd-flex gap-2 flex-wrap' }, [
                  el('button', {
                    class: 'btn btn-choco', type: 'button', disabled: !p.disponible, dataset: { testid: `promo-add-${p.productoId}` },
                    onclick: () => {
                      cart.add(p.productoId, 1);
                      toast(`${p.titulo} agregado al carrito.`);
                    },
                  }, [el('i', { class: 'bi bi-cart-plus me-1' }), p.disponible ? 'Agregar al carrito' : 'Agotado']),
                  el('a', { class: 'btn btn-outline-choco', href: '/catalogo.php', text: 'Ver catálogo' }),
                ]),
              ]),
            ]),
          ]),
        ]),
      ]),
    ),
  );
  dots.replaceChildren(
    ...promos.map((p, i) =>
      el('button', { type: 'button', 'data-bs-target': '#promoCarousel', 'data-bs-slide-to': String(i), class: i === 0 ? 'active' : '', 'aria-current': i === 0 ? 'true' : undefined, 'aria-label': `Promoción ${i + 1}` }),
    ),
  );
  window.bootstrap.Carousel.getOrCreateInstance(document.getElementById('promoCarousel')).cycle();
}

async function loadFeatured() {
  const rail = document.getElementById('destacados');
  showLoading(rail, 'Cargando productos destacados…');
  const r = await api('/products?destacado=true');
  if (!r.ok) return showError(rail, r, loadFeatured);
  const list = r.data.data;
  if (list.length === 0) return showEmpty(rail, 'No hay productos destacados por ahora.');
  rail.replaceChildren(
    ...list.map((p) =>
      el('div', { class: 'rail-item' }, [
        productCard(p, (prod, n) => {
          cart.add(prod.id, n, prod.stock);
          toast(`${n} × ${prod.nombre} agregado al carrito.`);
        }),
      ]),
    ),
    el('div', { class: 'rail-item' }, [
      el('a', { class: 'rail-more', href: '/catalogo.php' }, [el('span', { class: 'dots', text: '•••' }), 'Ver todo el catálogo']),
    ]),
  );
}

loadPromotions();
loadFeatured();
