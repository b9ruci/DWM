// Interfaz de autenticación compartida: abrir el modal, iniciar sesión, registrarse, salir.
import { api } from './api.js';
import { session } from './session.js';
import { formMessage, setBusy, validateForm, toast } from './ui.js';

export function openAuth(notice, tab = 'login') {
  const modalEl = document.getElementById('authModal');
  const box = document.getElementById('authNotice');
  if (notice) {
    box.textContent = notice;
    box.classList.remove('d-none');
  } else {
    box.classList.add('d-none');
  }
  const trigger = document.querySelector(tab === 'register' ? '[data-bs-target="#tabRegistro"]' : '[data-bs-target="#tabLogin"]');
  window.bootstrap.Tab.getOrCreateInstance(trigger).show();
  window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

export async function logout() {
  const r = await api('/auth/logout', { method: 'POST', auth: true });
  session.clear('LOGOUT');
  toast(r.ok ? 'Sesión cerrada.' : 'Sesión cerrada en este navegador.', 'secondary', r.cid);
  if (['pedidos', 'perfil', 'admin'].includes(document.body.dataset.page)) location.href = '/index.php';
}

function bindForms() {
  const login = document.getElementById('loginForm');
  login.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!validateForm(login)) return;
    const btn = login.querySelector('button[type=submit]');
    setBusy(btn, true, 'Ingresando…');
    const r = await api('/auth/login', { method: 'POST', body: { email: login.email.value.trim(), password: login.password.value } });
    setBusy(btn, false);
    if (!r.ok) {
      formMessage(login, 'danger', r.error.message, r.cid);
      return;
    }
    session.save(r.data.data);
    login.reset();
    login.classList.remove('was-validated');
    formMessage(login, 'success', `¡Hola, ${r.data.data.user.nombre}!`, r.cid);
    window.bootstrap.Modal.getOrCreateInstance(document.getElementById('authModal')).hide();
    toast(`Sesión iniciada como ${r.data.data.user.nombre}.`, 'success', r.cid);
    document.dispatchEvent(new CustomEvent('choco:login'));
  });

  const reg = document.getElementById('registerForm');
  reg.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!validateForm(reg)) return;
    const btn = reg.querySelector('button[type=submit]');
    setBusy(btn, true, 'Creando cuenta…');
    const body = { nombre: reg.nombre.value.trim(), email: reg.email.value.trim(), password: reg.password.value };
    const r = await api('/auth/register', { method: 'POST', body });
    if (!r.ok) {
      setBusy(btn, false);
      formMessage(reg, 'danger', r.error.message, r.cid, r.error.details);
      return;
    }
    // Inicio de sesión automático tras el registro.
    const l = await api('/auth/login', { method: 'POST', body: { email: body.email, password: body.password } });
    setBusy(btn, false);
    reg.reset();
    reg.classList.remove('was-validated');
    if (l.ok) {
      session.save(l.data.data);
      window.bootstrap.Modal.getOrCreateInstance(document.getElementById('authModal')).hide();
      toast('¡Cuenta creada! Ya puedes comprar.', 'success', r.cid);
      document.dispatchEvent(new CustomEvent('choco:login'));
    } else {
      formMessage(reg, 'success', 'Cuenta creada. Ahora inicia sesión.', r.cid);
    }
  });
}

export function initAuthUi() {
  bindForms();
  // Sesión expirada o revocada detectada por cualquier solicitud: avisar y ofrecer reingreso.
  document.addEventListener('choco:session', (ev) => {
    const reason = ev.detail && ev.detail.reason;
    if (reason && reason !== 'LOGOUT') {
      openAuth('Tu sesión expiró o fue cerrada. Inicia sesión nuevamente para continuar.');
    }
  });
}
