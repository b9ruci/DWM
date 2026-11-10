// Perfil del cliente (GET/PUT /me/profile → clients). El backend valida RUT, teléfono y longitudes.
import { api } from '../core/api.js';
import { session } from '../core/session.js';
import { openAuth } from '../core/auth-ui.js';
import { el, showLoading, showEmpty, showError, formMessage, setBusy, validateForm } from '../core/ui.js';

const panel = document.getElementById('perfilPanel');

function field(id, label, value, attrs = {}, help) {
  return el('div', { class: 'col-12 col-sm-6' }, [
    el('label', { class: 'form-label', for: id, text: label }),
    el('input', { class: 'form-control', id, name: id, value: value || '', ...attrs }),
    help ? el('div', { class: 'form-text', text: help }) : null,
    el('div', { class: 'invalid-feedback', text: attrs.title || 'Valor inválido' }),
  ]);
}

async function load() {
  if (!session.isLogged() || session.isExpired()) {
    return showEmpty(panel, 'Inicia sesión para ver tu perfil.', el('button', { class: 'btn btn-choco btn-sm', type: 'button', text: 'Ingresar', onclick: () => openAuth() }));
  }
  showLoading(panel);
  const r = await api('/me/profile', { auth: true });
  if (!r.ok) return showError(panel, r, load);
  const p = r.data.data;
  const form = el('form', { id: 'perfilForm', novalidate: true }, [
    el('div', { class: 'row g-3' }, [
      field('nombre', 'Nombre', p.nombre, { required: true, minlength: '2', maxlength: '80', title: 'Entre 2 y 80 caracteres' }),
      el('div', { class: 'col-12 col-sm-6' }, [el('label', { class: 'form-label', for: 'email', text: 'Correo' }), el('input', { class: 'form-control', id: 'email', value: p.email, disabled: true })]),
      field('rut', 'RUT (opcional)', p.rut, { maxlength: '12', pattern: '\\d{1,2}\\.?\\d{3}\\.?\\d{3}-[\\dkK]', placeholder: '12.345.678-5', title: 'Formato 12.345.678-5' }, 'Se valida el dígito verificador en el servidor.'),
      field('telefono', 'Teléfono (opcional)', p.telefono, { maxlength: '20', pattern: '\\+?[\\d\\s]{8,20}', placeholder: '+56 9 1234 5678', title: 'Solo números, espacios y +' }),
      field('direccion', 'Dirección de despacho', p.direccion, { maxlength: '200', minlength: '5', title: 'Mínimo 5 caracteres' }),
      field('comuna', 'Comuna', p.comuna, { maxlength: '60', minlength: '2', title: 'Mínimo 2 caracteres' }),
    ]),
    el('div', { class: 'form-msg mt-3', 'aria-live': 'polite' }),
    el('button', { class: 'btn btn-choco mt-2', type: 'submit', text: 'Guardar cambios', dataset: { testid: 'profile-save' } }),
  ]);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!validateForm(form)) return;
    const btn = form.querySelector('button[type=submit]');
    setBusy(btn, true, 'Guardando…');
    const val = (k) => form[k].value.trim() || undefined;
    const res = await api('/me/profile', { method: 'PUT', auth: true, body: { nombre: val('nombre'), rut: val('rut'), telefono: val('telefono'), direccion: val('direccion'), comuna: val('comuna') } });
    setBusy(btn, false);
    if (!res.ok) return formMessage(form, 'danger', res.error.message, res.cid, res.error.details);
    formMessage(form, 'success', 'Perfil actualizado.', res.cid);
  });
  panel.replaceChildren(form);
}

document.addEventListener('choco:login', load);
load();
