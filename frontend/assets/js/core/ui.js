// Utilidades de interfaz: creación segura de nodos (textContent, nunca innerHTML con datos),
// estados operacionales (carga / vacío / error con reintento) y notificaciones.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** el('div', {class:'x', dataset:{id:1}, onclick}, ['texto', nodo]) */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const clp = (n) => '$' + Number(n).toLocaleString('es-CL');
export const unidadTexto = (u) => (u === 'kg' ? 'venta por kilo' : 'x un');
export const fecha = (iso) => new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
export const ESTADOS = {
  PENDIENTE_PAGO: 'Pendiente de pago', PAGADO: 'Pagado', EN_PREPARACION: 'En preparación',
  DESPACHADO: 'Despachado', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado',
  PENDIENTE: 'Pago pendiente', APROBADO: 'Pago aprobado', RECHAZADO: 'Pago rechazado', ERROR: 'Pago con error', REEMBOLSO_PENDIENTE: 'Reembolso pendiente',
};
export const estadoBadge = (e) => el('span', { class: `estado estado-${e}`, text: ESTADOS[e] || e, dataset: { estado: e } });

export const refCode = (cid) => (cid ? el('span', { class: 'ref-code', text: `Ref: ${cid.slice(0, 8)}`, dataset: { cid } }) : null);

export function showLoading(container, text = 'Cargando…') {
  container.replaceChildren(
    el('div', { class: 'state-box', role: 'status', dataset: { state: 'loading' } }, [
      el('div', { class: 'spinner-border text-secondary', 'aria-hidden': 'true' }),
      el('span', { text }),
    ]),
  );
}
export function showEmpty(container, text, action) {
  container.replaceChildren(
    el('div', { class: 'state-box', dataset: { state: 'empty' } }, [el('i', { class: 'bi bi-inbox' }), el('p', { class: 'mb-0', text }), action || null]),
  );
}
export function showError(container, result, retry) {
  container.replaceChildren(
    el('div', { class: 'state-box error', role: 'alert', dataset: { state: 'error', code: result.error ? result.error.code : '' } }, [
      el('i', { class: 'bi bi-exclamation-triangle text-danger' }),
      el('p', { class: 'mb-0 fw-semibold', text: result.error ? result.error.message : 'Ocurrió un error.' }),
      refCode(result.cid),
      retry ? el('button', { class: 'btn btn-outline-choco btn-sm', type: 'button', text: 'Reintentar', onclick: retry, dataset: { testid: 'retry' } }) : null,
    ]),
  );
}

/** Mensaje en línea dentro de un formulario. kind: success | danger | warning | info */
export function formMessage(form, kind, text, cid, details) {
  const box = form.querySelector('.form-msg');
  if (!box) return;
  const list = Array.isArray(details) && details.length ? el('ul', { class: 'mb-0 small' }, details.map((d) => el('li', { text: d.field ? `${d.field}: ${d.message}` : d.message || JSON.stringify(d) }))) : null;
  box.replaceChildren(el('div', { class: `alert alert-${kind} py-2`, role: kind === 'danger' ? 'alert' : 'status', dataset: { kind } }, [el('div', { text }), list, refCode(cid)]));
}

export function toast(text, kind = 'success', cid) {
  const zone = document.getElementById('toastZone');
  if (!zone) return;
  const t = el('div', { class: `toast align-items-center text-bg-${kind} border-0 show`, role: 'status', dataset: { testid: 'toast' } }, [
    el('div', { class: 'd-flex' }, [
      el('div', { class: 'toast-body' }, [text, cid ? el('div', { class: 'small opacity-75', text: `Ref: ${cid.slice(0, 8)}` }) : null]),
      el('button', { type: 'button', class: 'btn-close btn-close-white me-2 m-auto', 'aria-label': 'Cerrar', onclick: () => t.remove() }),
    ]),
  ]);
  zone.append(t);
  setTimeout(() => t.remove(), 5000);
}

/** Validación de formulario con la API de Constraint Validation + estilos Bootstrap. */
export function validateForm(form) {
  form.classList.add('was-validated');
  return form.checkValidity();
}

export function setBusy(button, busy, text) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    button.replaceChildren(el('span', { class: 'spinner-border spinner-border-sm me-2', 'aria-hidden': 'true' }), text || 'Procesando…');
  } else {
    button.disabled = false;
    button.textContent = button.dataset.label || button.textContent;
  }
}

/** Tarjeta de producto (mockup: imagen, NOMBRE, [$$$] x un [cantidad] + agregar). */
export function productCard(p, onAdd) {
  const qty = el('input', { class: 'form-control form-control-sm qty', type: 'number', min: '1', max: String(Math.max(1, Math.min(p.stock, 50))), value: '1', 'aria-label': `Cantidad de ${p.nombre}`, disabled: !p.disponible });
  const addBtn = el('button', {
    class: 'btn btn-choco btn-sm', type: 'button', disabled: !p.disponible, dataset: { testid: `add-${p.id}` },
    onclick: () => {
      const n = Number(qty.value);
      if (!Number.isInteger(n) || n < 1 || n > Number(qty.max)) {
        qty.classList.add('is-invalid');
        toast(`Elige una cantidad entre 1 y ${qty.max}.`, 'warning');
        return;
      }
      qty.classList.remove('is-invalid');
      onAdd(p, n);
    },
  }, [el('i', { class: 'bi bi-cart-plus me-1' }), p.disponible ? 'Agregar' : 'Agotado']);
  return el('article', { class: 'product-card', dataset: { productId: p.id } }, [
    el('div', { class: 'media' }, [
      el('img', { src: p.imagen, alt: p.nombre, loading: 'lazy', width: '200', height: '200' }),
      !p.disponible ? el('span', { class: 'badge text-bg-danger badge-stock', text: 'Agotado' }) : p.stock <= 5 ? el('span', { class: 'badge text-bg-warning badge-stock', text: `Últimas ${p.stock}` }) : null,
    ]),
    el('div', { class: 'body' }, [
      el('h3', { class: 'name', text: p.nombre }),
      p.descripcion ? el('p', { class: 'desc', text: p.descripcion }) : null,
      el('div', { class: 'buy-row' }, [
        el('span', { class: 'price', text: clp(p.precio), dataset: { testid: 'price' } }),
        el('span', { class: 'unit', text: unidadTexto(p.unidad) }),
      ]),
      el('div', { class: 'buy-row' }, [qty, addBtn]),
    ]),
  ]);
}
