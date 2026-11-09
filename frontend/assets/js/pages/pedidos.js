// Mis pedidos: agregación GraphQL (orders + inventory + payments + clients).
// Si alguna dependencia falla, la respuesta marca completo=false y la interfaz lo advierte:
// nunca presenta información parcial como si fuera completa.
import { api, gql } from '../core/api.js';
import { session } from '../core/session.js';
import { openAuth } from '../core/auth-ui.js';
import { el, clp, fecha, estadoBadge, refCode, showLoading, showEmpty, showError, toast, setBusy } from '../core/ui.js';

const LIMITE = 5;
const params = new URLSearchParams(location.search);
let desde = 0;
let seleccionado = params.get('pedido');

const lista = document.getElementById('listaPedidos');
const detalle = document.getElementById('detallePedido');
const aviso = document.getElementById('avisoPago');

const Q_LISTA = `query MisPedidos($limite: Int!, $desde: Int!) {
  misPedidos(limite: $limite, desde: $desde) {
    total limite desde
    pedidos { id estado creadoEn total completo items { cantidad } pago { estado } }
  }
}`;
const Q_DETALLE = `query Pedido($id: ID!) {
  pedido(id: $id) {
    id estado creadoEn subtotal costoDespacho total comuna completo advertencias
    items { productoId nombre cantidad precioUnitario subtotal producto { imagen disponible } }
    pago { id estado monto actualizadoEn }
    cliente { nombre email }
  }
}`;

function needLogin() {
  if (session.isLogged() && !session.isExpired()) return false;
  showEmpty(lista, 'Inicia sesión para ver tus pedidos.', el('button', { class: 'btn btn-choco btn-sm', type: 'button', text: 'Ingresar', onclick: () => openAuth() }));
  detalle.replaceChildren(el('p', { class: 'text-secondary mb-0', text: 'Necesitas una sesión activa.' }));
  return true;
}

function warnPartial(r, container) {
  if (!r.gqlErrors.some((e) => e.extensions && e.extensions.code === 'DEPENDENCY_UNAVAILABLE')) return;
  container.prepend(el('div', { class: 'alert alert-warning', role: 'alert', dataset: { testid: 'partial-warning' } }, [
    el('strong', { text: 'Información parcial. ' }),
    'Algunos datos no están disponibles temporalmente; lo que ves puede estar incompleto.',
    refCode(r.cid),
  ]));
}

async function loadList() {
  if (needLogin()) return;
  showLoading(lista, 'Cargando pedidos…');
  const r = await gql(Q_LISTA, { limite: LIMITE, desde });
  if (!r.ok) return showError(lista, r.gqlErrors.length ? { error: { message: r.gqlErrors[0].message }, cid: r.cid } : r, loadList);
  const page = r.data.data.misPedidos;
  document.getElementById('paginaInfo').textContent = page.total ? `${desde + 1}–${Math.min(desde + LIMITE, page.total)} de ${page.total}` : '';
  document.getElementById('btnPrev').disabled = desde === 0;
  document.getElementById('btnNext').disabled = desde + LIMITE >= page.total;
  if (page.pedidos.length === 0) return showEmpty(lista, 'Aún no tienes pedidos.', el('a', { class: 'btn btn-choco btn-sm', href: '/catalogo.php', text: 'Ver catálogo' }));
  lista.replaceChildren(...page.pedidos.map((p) =>
    el('button', {
      type: 'button', class: `order-card text-start ${p.id === seleccionado ? 'border-3' : ''}`, dataset: { orderId: p.id, testid: 'order-item' },
      onclick: () => {
        seleccionado = p.id;
        history.replaceState(null, '', `?pedido=${p.id}`);
        loadDetail();
      },
    }, [
      el('div', { class: 'head' }, [el('strong', { text: `#${p.id.slice(0, 8)}` }), estadoBadge(p.estado)]),
      el('div', { class: 'd-flex justify-content-between small' }, [el('span', { text: fecha(p.creadoEn) }), el('span', { class: 'fw-bold', text: clp(p.total) })]),
      !p.completo ? el('span', { class: 'small text-warning-emphasis', text: 'Información parcial' }) : null,
    ])));
  warnPartial(r, lista);
}

async function pagar(id, button) {
  setBusy(button, true, 'Iniciando pago…');
  const r = await api('/payments', { method: 'POST', body: { pedidoId: id }, auth: true });
  if (!r.ok) {
    setBusy(button, false);
    toast(r.error.message, 'danger', r.cid);
    return;
  }
  location.href = r.data.data.checkoutUrl;
}

async function cancelar(id, button) {
  if (!confirm('¿Cancelar este pedido? Se liberará el stock reservado.')) return;
  setBusy(button, true, 'Cancelando…');
  const r = await api(`/orders/${id}/cancel`, { method: 'POST', auth: true });
  setBusy(button, false);
  if (!r.ok) return toast(r.error.message, 'danger', r.cid);
  toast('Pedido cancelado.', 'secondary', r.cid);
  loadList();
  loadDetail();
}

async function loadDetail() {
  if (!seleccionado || needLogin()) return null;
  showLoading(detalle, 'Cargando detalle…');
  const r = await gql(Q_DETALLE, { id: seleccionado });
  if (!r.ok) {
    showError(detalle, r.gqlErrors.length ? { error: { message: r.gqlErrors[0].message }, cid: r.cid } : r, loadDetail);
    return null;
  }
  const p = r.data.data.pedido;
  if (!p) {
    showEmpty(detalle, 'Pedido no encontrado.');
    return null;
  }
  const acciones = [];
  if (p.estado === 'PENDIENTE_PAGO') {
    const b1 = el('button', { class: 'btn btn-choco', type: 'button', dataset: { testid: 'pay-order' } }, 'Pagar ahora');
    b1.addEventListener('click', () => pagar(p.id, b1));
    const b2 = el('button', { class: 'btn btn-outline-danger', type: 'button', dataset: { testid: 'cancel-order' } }, 'Cancelar pedido');
    b2.addEventListener('click', () => cancelar(p.id, b2));
    acciones.push(b1, b2);
  }
  detalle.replaceChildren(
    el('div', { class: 'd-flex justify-content-between align-items-start flex-wrap gap-2 mb-2' }, [
      el('div', {}, [el('h2', { class: 'fs-4 mb-0', text: `Pedido #${p.id.slice(0, 8)}` }), el('span', { class: 'small text-secondary', text: fecha(p.creadoEn) })]),
      el('div', { class: 'd-flex gap-2 align-items-center' }, [estadoBadge(p.estado), p.pago ? estadoBadge(p.pago.estado) : null]),
    ]),
    !p.completo ? el('div', { class: 'alert alert-warning py-2', role: 'alert', dataset: { testid: 'partial-detail' } }, [el('strong', { text: 'Información parcial: ' }), p.advertencias.join(' ')]) : null,
    el('ul', { class: 'list-unstyled mb-2' }, p.items.map((i) => el('li', { class: 'cart-line' }, [
      i.producto ? el('img', { src: i.producto.imagen, alt: '', width: '64', height: '64' }) : el('div', { class: 'cart-line-noimg' }),
      el('div', { class: 'info' }, [el('strong', { text: i.nombre }), el('div', { class: 'small text-secondary', text: `${i.cantidad} × ${clp(i.precioUnitario)}` })]),
      el('span', { class: 'line-total', text: clp(i.subtotal) }),
    ]))),
    el('div', { class: 'summary-row' }, [el('span', { text: 'Subtotal' }), el('span', { text: clp(p.subtotal) })]),
    el('div', { class: 'summary-row' }, [el('span', { text: `Despacho (${p.comuna})` }), el('span', { text: p.costoDespacho ? clp(p.costoDespacho) : 'Gratis' })]),
    el('div', { class: 'summary-row total' }, [el('span', { text: 'Total' }), el('span', { text: clp(p.total), dataset: { testid: 'order-total' } })]),
    p.cliente ? el('p', { class: 'small text-secondary mt-2 mb-0', text: `Titular: ${p.cliente.nombre} · ${p.cliente.email}` }) : null,
    acciones.length ? el('div', { class: 'd-flex gap-2 flex-wrap mt-3' }, acciones) : null,
    el('p', { class: 'mb-0 mt-2' }, [refCode(r.cid)]),
  );
  warnPartial(r, detalle);
  return p;
}

// Regreso desde la pasarela: el resultado visible proviene del backend (webhook verificado),
// no del parámetro de la URL; se consulta hasta que payments registre el resultado.
async function verificarRetorno() {
  const resultado = params.get('resultado');
  if (!resultado || !seleccionado) return;
  aviso.replaceChildren(el('div', { class: 'alert alert-info', role: 'status', dataset: { testid: 'payment-checking' } }, 'Verificando el resultado del pago con el servidor…'));
  for (let i = 0; i < 8; i++) {
    const p = await loadDetail();
    const estadoPago = p && p.pago ? p.pago.estado : null;
    if (p && (p.estado !== 'PENDIENTE_PAGO' || estadoPago === 'RECHAZADO')) {
      const ok = p.estado === 'PAGADO';
      aviso.replaceChildren(el('div', { class: `alert alert-${ok ? 'success' : 'danger'}`, role: 'status', dataset: { testid: 'payment-result', result: ok ? 'approved' : 'rejected' } },
        ok ? '¡Pago confirmado! Comenzaremos a preparar tu pedido.' : 'El pago fue rechazado. Puedes intentarlo nuevamente.'));
      loadList();
      return;
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  aviso.replaceChildren(el('div', { class: 'alert alert-warning', role: 'status' }, 'Aún no recibimos la confirmación del proveedor de pagos. Actualiza en unos minutos.'));
}

document.getElementById('btnRefrescar').addEventListener('click', () => (loadList(), loadDetail()));
document.getElementById('btnPrev').addEventListener('click', () => ((desde = Math.max(0, desde - LIMITE)), loadList()));
document.getElementById('btnNext').addEventListener('click', () => ((desde += LIMITE), loadList()));
document.addEventListener('choco:login', () => (loadList(), loadDetail()));

loadList();
if (params.get('resultado')) verificarRetorno();
else loadDetail();
