// Carrito y confirmación del pedido.
// Flujo: POST /orders (con Idempotency-Key) → POST /payments → redirección al checkout del proveedor.
// La clave de idempotencia se conserva mientras el pedido no se confirme: si la red falla y el
// usuario reintenta, el backend devuelve el mismo pedido en lugar de crear uno duplicado.
import { api, newId } from '../core/api.js';
import { cart } from '../core/cart.js';
import { session } from '../core/session.js';
import { openAuth } from '../core/auth-ui.js';
import { el, clp, unidadTexto, showLoading, showEmpty, showError, formMessage, setBusy, validateForm } from '../core/ui.js';

const lineas = document.getElementById('lineas');
const resumen = document.getElementById('resumenCarrito');
const form = document.getElementById('checkoutForm');
const btn = document.getElementById('btnConfirmar');
const IDEM_KEY = 'choco.checkout.idem';
let catalogo = new Map();

function idemKey() {
  let k = null;
  try {
    k = sessionStorage.getItem(IDEM_KEY);
    if (!k) {
      k = newId();
      sessionStorage.setItem(IDEM_KEY, k);
    }
  } catch {
    k = k || newId();
  }
  return k;
}
const resetIdem = () => {
  try {
    sessionStorage.removeItem(IDEM_KEY);
  } catch {
    /* noop */
  }
};

function render() {
  const lines = cart.lines();
  if (lines.length === 0) {
    showEmpty(lineas, 'Tu carrito está vacío.', el('a', { class: 'btn btn-choco btn-sm', href: '/catalogo.php', text: 'Ir al catálogo' }));
    resumen.replaceChildren();
    btn.disabled = true;
    return;
  }
  btn.disabled = false;
  let subtotal = 0;
  const rows = lines.map((l) => {
    const p = catalogo.get(l.productId);
    if (!p) {
      return el('div', { class: 'cart-line', dataset: { productId: l.productId } }, [
        el('div', { class: 'info' }, [el('strong', { text: 'Producto no disponible' }), el('div', { class: 'small text-danger', text: 'Ya no está en el catálogo; quítalo para continuar.' })]),
        el('button', { class: 'btn btn-sm btn-outline-danger', type: 'button', text: 'Quitar', onclick: () => (cart.remove(l.productId), render()) }),
      ]);
    }
    subtotal += p.precio * l.cantidad;
    const qty = el('input', { type: 'number', class: 'form-control form-control-sm qty', min: '1', max: String(Math.min(p.stock, 50)), value: String(l.cantidad), 'aria-label': `Cantidad de ${p.nombre}` });
    qty.addEventListener('change', () => {
      const n = Number(qty.value);
      if (!Number.isInteger(n) || n < 1 || n > Number(qty.max)) {
        qty.classList.add('is-invalid');
        qty.value = String(l.cantidad);
        return;
      }
      cart.set(p.id, n);
      render();
    });
    return el('div', { class: 'cart-line', dataset: { productId: p.id } }, [
      el('img', { src: p.imagen, alt: '', width: '64', height: '64' }),
      el('div', { class: 'info' }, [el('strong', { text: p.nombre }), el('div', { class: 'small text-secondary', text: `${clp(p.precio)} ${unidadTexto(p.unidad)}` }), p.stock < l.cantidad ? el('div', { class: 'small text-danger', text: `Solo quedan ${p.stock}` }) : null]),
      qty,
      el('span', { class: 'line-total', text: clp(p.precio * l.cantidad) }),
      el('button', { class: 'btn btn-sm btn-link text-danger', type: 'button', 'aria-label': `Quitar ${p.nombre}`, onclick: () => (cart.remove(p.id), render()) }, [el('i', { class: 'bi bi-trash' })]),
    ]);
  });
  lineas.replaceChildren(...rows);
  const despacho = subtotal >= 50000 ? 0 : 3990;
  resumen.replaceChildren(
    el('div', { class: 'summary-row' }, [el('span', { text: 'Subtotal estimado' }), el('span', { text: clp(subtotal) })]),
    el('div', { class: 'summary-row' }, [el('span', { text: 'Despacho' }), el('span', { text: despacho ? clp(despacho) : 'Gratis' })]),
    el('div', { class: 'summary-row total' }, [el('span', { text: 'Total estimado' }), el('span', { text: clp(subtotal + despacho), dataset: { testid: 'cart-total' } })]),
  );
}

async function load() {
  showLoading(lineas, 'Actualizando precios…');
  const r = await api('/products');
  if (!r.ok) {
    btn.disabled = true;
    return showError(lineas, r, load);
  }
  catalogo = new Map(r.data.data.map((p) => [p.id, p]));
  render();
}

async function prefillProfile() {
  if (!session.isLogged() || session.isExpired()) return;
  const r = await api('/me/profile', { auth: true });
  if (r.ok) {
    if (!form.direccion.value && r.data.data.direccion) form.direccion.value = r.data.data.direccion;
    if (!form.comuna.value && r.data.data.comuna) form.comuna.value = r.data.data.comuna;
  }
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!session.isLogged() || session.isExpired()) {
    formMessage(form, 'warning', 'Inicia sesión para confirmar tu pedido.');
    openAuth('Inicia sesión o crea una cuenta para confirmar tu pedido.');
    return;
  }
  if (!validateForm(form)) return;
  const items = cart.lines().filter((l) => catalogo.has(l.productId)).map((l) => ({ productId: l.productId, cantidad: l.cantidad }));
  if (items.length === 0) return;
  setBusy(btn, true, 'Creando pedido…');
  const body = { items, despacho: { direccion: form.direccion.value.trim(), comuna: form.comuna.value.trim() }, notas: form.notas.value.trim() || undefined };
  const r = await api('/orders', { method: 'POST', body, auth: true, idempotencyKey: idemKey() });
  if (!r.ok) {
    setBusy(btn, false);
    if (r.error.code === 'STOCK_INSUFICIENTE') {
      const det = (r.error.details || []).map((d) => ({ message: `${d.nombre}: solicitaste ${d.solicitado}, disponibles ${d.disponible}` }));
      formMessage(form, 'danger', 'No hay stock suficiente para algunos productos. Ajusta las cantidades.', r.cid, det);
      resetIdem();
      load();
      return;
    }
    if (r.error.code === 'IDEMPOTENCY_KEY_REUSED') resetIdem();
    if (r.status === 400 || r.status === 422) resetIdem();
    formMessage(form, 'danger', r.error.message, r.cid, r.error.details);
    return;
  }
  // Pedido creado (o recuperado por reintento idempotente): el carrito ya no es necesario.
  const pedido = r.data.data;
  resetIdem();
  cart.clear();
  formMessage(form, 'success', `Pedido ${pedido.id.slice(0, 8)} creado por ${clp(pedido.total)}. Redirigiendo al pago…`, r.cid);
  setBusy(btn, true, 'Iniciando pago…');
  const p = await api('/payments', { method: 'POST', body: { pedidoId: pedido.id }, auth: true });
  if (!p.ok) {
    setBusy(btn, false);
    formMessage(form, 'warning', `Tu pedido quedó registrado, pero no pudimos iniciar el pago: ${p.error.message} Puedes pagarlo desde "Mis pedidos".`, p.cid);
    btn.replaceWith(el('a', { class: 'btn btn-choco w-100', href: `/pedidos.php?pedido=${pedido.id}`, text: 'Ir a mis pedidos' }));
    return;
  }
  location.href = p.data.data.checkoutUrl;
});

document.addEventListener('choco:cart', render);
document.addEventListener('choco:login', prefillProfile);
load();
prefillProfile();
