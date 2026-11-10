// Contacto / orden especial: POST /contact-requests (clients). Los canales son contenido
// informativo estático (assets/data/canales.json), no datos de negocio.
import { api } from '../core/api.js';
import { session } from '../core/session.js';
import { el, formMessage, setBusy, validateForm } from '../core/ui.js';

const form = document.getElementById('formContacto');
const tipo = new URLSearchParams(location.search).get('tipo');
if (tipo === 'ORDEN_ESPECIAL') form.tipo.value = 'ORDEN_ESPECIAL';
const u = session.user();
if (u && !session.isExpired()) form.nombre.value = u.nombre;

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!validateForm(form)) return;
  const btn = form.querySelector('button[type=submit]');
  setBusy(btn, true, 'Enviando…');
  const body = { nombre: form.nombre.value.trim(), email: form.email.value.trim(), tipo: form.tipo.value, mensaje: form.mensaje.value.trim() };
  const logged = session.isLogged() && !session.isExpired();
  const r = await api('/contact-requests', { method: 'POST', body, auth: logged });
  setBusy(btn, false);
  if (!r.ok) return formMessage(form, 'danger', r.error.message, r.cid, r.error.details);
  formMessage(form, 'success', `¡Gracias, ${body.nombre}! Recibimos tu solicitud (N° ${r.data.data.id.slice(0, 8)}). Te responderemos al correo indicado.`, r.cid);
  form.reset();
  form.classList.remove('was-validated');
});

async function canales() {
  const box = document.getElementById('listaCanales');
  try {
    const res = await fetch('/assets/data/canales.json');
    const data = await res.json();
    box.replaceChildren(...data.map((c) => el('div', { class: 'list-group-item d-flex gap-2' }, [el('i', { class: `bi ${c.icono}` }), el('strong', { text: `${c.tipo}:` }), el('span', { text: c.valor })])));
  } catch {
    box.replaceChildren(el('p', { class: 'text-secondary mb-0', text: 'No pudimos cargar los canales.' }));
  }
}
canales();
