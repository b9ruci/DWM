// Catálogo: filtros por categoría y búsqueda (consultas a inventory vía API Gateway).
import { api } from '../core/api.js';
import { cart } from '../core/cart.js';
import { el, productCard, showLoading, showEmpty, showError, toast } from '../core/ui.js';

const params = new URLSearchParams(location.search);
const state = { categoria: params.get('categoria') || '', q: params.get('q') || '' };
const container = document.getElementById('catalogo');
const resumen = document.getElementById('resumen');
const form = document.getElementById('filtros');
const input = document.getElementById('buscar');
input.value = state.q;

function syncUrl() {
  const p = new URLSearchParams();
  if (state.categoria) p.set('categoria', state.categoria);
  if (state.q) p.set('q', state.q);
  history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}`);
}

async function loadChips() {
  const chips = document.getElementById('chips');
  const r = await api('/categories');
  const cats = r.ok ? r.data.data : [];
  const chip = (nombre, label) =>
    el('button', {
      type: 'button', class: `btn btn-sm ${state.categoria === nombre ? 'btn-choco' : 'btn-outline-choco'}`, 'aria-pressed': String(state.categoria === nombre), text: label,
      dataset: { categoria: nombre },
      onclick: () => {
        state.categoria = nombre;
        loadChips();
        loadProducts();
      },
    });
  chips.replaceChildren(chip('', 'Todas'), ...cats.map((c) => chip(c.nombre, `${c.nombre} (${c.total})`)));
}

let seq = 0;
async function loadProducts() {
  const mine = ++seq; // descarta respuestas antiguas si el usuario cambia el filtro rápido
  syncUrl();
  showLoading(container, 'Cargando catálogo…');
  resumen.textContent = '';
  const qs = new URLSearchParams();
  if (state.categoria) qs.set('categoria', state.categoria);
  if (state.q) qs.set('q', state.q);
  const r = await api(`/products${qs.toString() ? `?${qs}` : ''}`);
  if (mine !== seq) return;
  if (!r.ok) return showError(container, r, loadProducts);
  const list = r.data.data;
  if (list.length === 0) {
    return showEmpty(container, 'No encontramos productos con esos filtros.', el('button', {
      class: 'btn btn-outline-choco btn-sm', type: 'button', text: 'Limpiar filtros',
      onclick: () => {
        state.categoria = '';
        state.q = '';
        input.value = '';
        loadChips();
        loadProducts();
      },
    }));
  }
  resumen.textContent = `${list.length} producto${list.length === 1 ? '' : 's'}${state.categoria ? ` en ${state.categoria}` : ''}${state.q ? ` para “${state.q}”` : ''}.`;
  container.replaceChildren(
    el('div', { class: 'row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-4 g-3', dataset: { testid: 'product-grid' } },
      list.map((p) => el('div', { class: 'col' }, [productCard(p, (prod, n) => {
        cart.add(prod.id, n, prod.stock);
        toast(`${n} × ${prod.nombre} agregado al carrito.`);
      })])),
    ),
  );
}

let debounce;
input.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    form.classList.add('was-validated');
    if (!input.checkValidity()) return;
    state.q = input.value.trim();
    loadProducts();
  }, 350);
});
form.addEventListener('submit', (e) => e.preventDefault());

loadChips();
loadProducts();
