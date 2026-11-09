// Panel de administración. Ocultar esta página a otros roles es solo comodidad:
// la autorización real la aplican el API Gateway (rol ADMIN) y cada servicio.
import { api, gql } from '../core/api.js';
import { session } from '../core/session.js';
import { openAuth } from '../core/auth-ui.js';
import { el, clp, fecha, estadoBadge, showLoading, showEmpty, showError, toast, formMessage, setBusy, validateForm } from '../core/ui.js';

const root = document.getElementById('adminRoot');
const NEXT = { PENDIENTE_PAGO: ['CANCELADO'], PAGADO: ['EN_PREPARACION'], EN_PREPARACION: ['DESPACHADO'], DESPACHADO: ['ENTREGADO'] };

function guard() {
  const u = session.user();
  if (!u || session.isExpired()) {
    showEmpty(root, 'Inicia sesión con una cuenta de administración.', el('button', { class: 'btn btn-choco btn-sm', type: 'button', text: 'Ingresar', onclick: () => openAuth() }));
    return false;
  }
  if (u.role !== 'ADMIN') {
    showError(root, { error: { code: 'FORBIDDEN', message: 'No tienes permisos para acceder a la administración.' } });
    return false;
  }
  return true;
}

const table = (head, rows) => el('div', { class: 'table-responsive' }, [
  el('table', { class: 'table table-sm align-middle table-choco' }, [
    el('thead', {}, [el('tr', {}, head.map((h) => el('th', { scope: 'col', text: h })))]),
    el('tbody', {}, rows),
  ]),
]);

async function resumen() {
  const box = document.getElementById('resumenVentas');
  showLoading(box);
  const r = await gql('query { resumenVentas(dias: 30) { dias pedidosPagados ingresos porEstado { estado cantidad } topProductos { nombre unidades monto } } }');
  if (!r.ok) return showError(box, r.gqlErrors.length ? { error: { message: r.gqlErrors[0].message }, cid: r.cid } : r, resumen);
  const s = r.data.data.resumenVentas;
  box.replaceChildren(
    el('h2', { class: 'fs-5', text: `Últimos ${s.dias} días` }),
    el('div', { class: 'row g-3 mb-3' }, [
      el('div', { class: 'col-6 col-md-3' }, [el('div', { class: 'border rounded-3 p-3' }, [el('div', { class: 'small text-secondary', text: 'Pedidos pagados' }), el('div', { class: 'fs-3 fw-bold', text: String(s.pedidosPagados), dataset: { testid: 'kpi-pagados' } })])]),
      el('div', { class: 'col-6 col-md-3' }, [el('div', { class: 'border rounded-3 p-3' }, [el('div', { class: 'small text-secondary', text: 'Ingresos' }), el('div', { class: 'fs-3 fw-bold', text: clp(s.ingresos) })])]),
    ]),
    el('div', { class: 'row g-3' }, [
      el('div', { class: 'col-12 col-md-6' }, [el('h3', { class: 'fs-6', text: 'Pedidos por estado' }), table(['Estado', 'Cantidad'], s.porEstado.map((e) => el('tr', {}, [el('td', {}, [estadoBadge(e.estado)]), el('td', { text: String(e.cantidad) })])))]),
      el('div', { class: 'col-12 col-md-6' }, [el('h3', { class: 'fs-6', text: 'Productos más vendidos' }), s.topProductos.length ? table(['Producto', 'Unid.', 'Monto'], s.topProductos.map((t) => el('tr', {}, [el('td', { text: t.nombre }), el('td', { text: String(t.unidades) }), el('td', { text: clp(t.monto) })]))) : el('p', { class: 'text-secondary', text: 'Sin ventas pagadas en el período.' })]),
    ]),
  );
}

async function pedidos() {
  const box = document.getElementById('adminPedidos');
  const estado = document.getElementById('filtroEstado').value;
  showLoading(box);
  const r = await api(`/admin/orders${estado ? `?estado=${estado}` : ''}`, { auth: true });
  if (!r.ok) return showError(box, r, pedidos);
  if (!r.data.data.length) return showEmpty(box, 'No hay pedidos con ese filtro.');
  box.replaceChildren(table(['Pedido', 'Fecha', 'Comuna', 'Total', 'Estado', 'Acción'], r.data.data.map((o) => {
    const opciones = NEXT[o.estado] || [];
    const sel = el('select', { class: 'form-select form-select-sm', 'aria-label': `Nuevo estado del pedido ${o.id.slice(0, 8)}`, disabled: !opciones.length }, [el('option', { value: '', text: opciones.length ? 'Cambiar a…' : '—' }), ...opciones.map((x) => el('option', { value: x, text: x }))]);
    sel.addEventListener('change', async () => {
      if (!sel.value) return;
      const res = await api(`/admin/orders/${o.id}/status`, { method: 'PUT', auth: true, body: { estado: sel.value } });
      if (!res.ok) toast(res.error.message, 'danger', res.cid);
      else toast(`Pedido ${o.id.slice(0, 8)} → ${sel.value}`, 'success', res.cid);
      pedidos();
    });
    return el('tr', { dataset: { orderId: o.id } }, [el('td', { class: 'font-monospace', text: o.id.slice(0, 8) }), el('td', { text: fecha(o.creadoEn) }), el('td', { text: o.despacho.comuna }), el('td', { text: clp(o.total) }), el('td', {}, [estadoBadge(o.estado)]), el('td', {}, [sel])]);
  })));
}

const modalEl = document.getElementById('productoModal');
const pform = document.getElementById('productoForm');
function abrirProducto(p) {
  pform.reset();
  pform.classList.remove('was-validated');
  pform.querySelector('.form-msg').replaceChildren();
  pform.id.value = p ? p.id : '';
  if (p) {
    for (const k of ['nombre', 'sku', 'descripcion', 'categoria', 'unidad', 'precio', 'stock', 'imagen']) pform[k].value = p[k] ?? '';
    pform.destacado.checked = p.destacado;
    pform.activo.checked = p.activo;
  }
  document.getElementById('productoModalTitle').textContent = p ? `Editar ${p.nombre}` : 'Nuevo producto';
  window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
}
pform.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!validateForm(pform)) return;
  const body = {
    nombre: pform.nombre.value.trim(), sku: pform.sku.value.trim(), descripcion: pform.descripcion.value.trim(), categoria: pform.categoria.value,
    unidad: pform.unidad.value, precio: Number(pform.precio.value), stock: Number(pform.stock.value), imagen: pform.imagen.value.trim() || undefined,
    destacado: pform.destacado.checked, activo: pform.activo.checked,
  };
  const btn = pform.querySelector('button[type=submit]');
  setBusy(btn, true, 'Guardando…');
  const id = pform.id.value;
  const r = await api(id ? `/admin/products/${id}` : '/admin/products', { method: id ? 'PUT' : 'POST', auth: true, body });
  setBusy(btn, false);
  if (!r.ok) return formMessage(pform, 'danger', r.error.message, r.cid, r.error.details);
  window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
  toast(`Producto ${r.data.data.nombre} guardado.`, 'success', r.cid);
  productos();
});

async function productos() {
  const box = document.getElementById('adminProductos');
  showLoading(box);
  const r = await api('/admin/products', { auth: true });
  if (!r.ok) return showError(box, r, productos);
  box.replaceChildren(table(['Producto', 'Categoría', 'Precio', 'Stock', 'Estado', ''], r.data.data.map((p) => el('tr', { dataset: { productId: p.id } }, [
    el('td', {}, [el('strong', { text: p.nombre }), el('div', { class: 'small text-secondary', text: p.sku })]),
    el('td', { text: p.categoria }),
    el('td', { text: clp(p.precio) }),
    el('td', { text: String(p.stock) }),
    el('td', {}, [el('span', { class: `badge ${p.activo ? 'text-bg-success' : 'text-bg-secondary'}`, text: p.activo ? 'Activo' : 'Inactivo' })]),
    el('td', { class: 'text-nowrap' }, [
      el('button', { class: 'btn btn-sm btn-outline-choco me-1', type: 'button', text: 'Editar', onclick: () => abrirProducto(p) }),
      p.activo ? el('button', {
        class: 'btn btn-sm btn-outline-danger', type: 'button', text: 'Dar de baja',
        onclick: async () => {
          if (!confirm(`¿Dar de baja ${p.nombre}? Se ocultará del catálogo y se conservará en el historial.`)) return;
          const res = await api(`/admin/products/${p.id}`, { method: 'DELETE', auth: true });
          if (!res.ok) toast(res.error.message, 'danger', res.cid);
          else toast(`${p.nombre} dado de baja.`, 'secondary', res.cid);
          productos();
        },
      }) : null,
    ]),
  ]))));
}

async function solicitudes() {
  const box = document.getElementById('adminSolicitudes');
  showLoading(box);
  const r = await api('/admin/contact-requests', { auth: true });
  if (!r.ok) return showError(box, r, solicitudes);
  if (!r.data.data.length) return showEmpty(box, 'Sin solicitudes.');
  box.replaceChildren(table(['Fecha', 'Tipo', 'Nombre', 'Correo', 'Mensaje', 'Estado'], r.data.data.map((s) => {
    const sel = el('select', { class: 'form-select form-select-sm', 'aria-label': 'Estado de la solicitud' }, ['NUEVA', 'EN_GESTION', 'CERRADA'].map((x) => el('option', { value: x, text: x, selected: x === s.estado })));
    sel.addEventListener('change', async () => {
      const res = await api(`/admin/contact-requests/${s.id}`, { method: 'PUT', auth: true, body: { estado: sel.value } });
      toast(res.ok ? 'Solicitud actualizada.' : res.error.message, res.ok ? 'success' : 'danger', res.cid);
    });
    return el('tr', {}, [el('td', { text: fecha(s.creadoEn) }), el('td', { text: s.tipo }), el('td', { text: s.nombre }), el('td', { text: s.email }), el('td', { class: 'small', text: s.mensaje }), el('td', {}, [sel])]);
  })));
}

async function clientes() {
  const box = document.getElementById('adminClientes');
  showLoading(box);
  const r = await api('/admin/clients', { auth: true });
  if (!r.ok) return showError(box, r, clientes);
  box.replaceChildren(
    el('p', { class: 'small text-secondary', text: 'RUT y teléfono se muestran enmascarados (minimización de datos).' }),
    table(['Nombre', 'Correo', 'RUT', 'Teléfono', 'Comuna'], r.data.data.map((c) => el('tr', {}, [el('td', { text: c.nombre }), el('td', { text: c.email }), el('td', { text: c.rut || '—' }), el('td', { text: c.telefono || '—' }), el('td', { text: c.comuna || '—' })]))),
  );
}

function init() {
  if (!guard()) return;
  resumen();
  pedidos();
  productos();
  solicitudes();
  clientes();
}
document.getElementById('filtroEstado').addEventListener('change', pedidos);
document.getElementById('btnNuevoProducto').addEventListener('click', () => abrirProducto(null));
document.addEventListener('choco:login', () => location.reload());
init();
