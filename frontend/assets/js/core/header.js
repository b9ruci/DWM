// Comportamiento común del encabezado: contador del carrito, menú de usuario según
// la sesión, categorías del catálogo obtenidas del backend y modal de autenticación.
import { api } from './api.js';
import { cart } from './cart.js';
import { session } from './session.js';
import { el, $$ } from './ui.js';
import { initAuthUi, openAuth, logout } from './auth-ui.js';

function renderCartCount() {
  const n = cart.count();
  $$('[data-cart-count]').forEach((b) => {
    b.textContent = String(n);
    b.classList.toggle('d-none', n === 0);
  });
}

function renderUserMenu() {
  const menu = document.getElementById('userMenu');
  const user = session.isExpired() ? null : session.user();
  const btn = document.getElementById('userMenuButton');
  btn.setAttribute('aria-label', user ? `Cuenta de ${user.nombre}` : 'Cuenta de usuario');
  btn.dataset.logged = user ? 'true' : 'false';
  const item = (text, attrs) => el('li', {}, [el(attrs.href ? 'a' : 'button', { class: 'dropdown-item', type: attrs.href ? undefined : 'button', ...attrs }, text)]);
  if (!user) {
    menu.replaceChildren(
      item('Ingresar', { onclick: () => openAuth(), dataset: { testid: 'menu-login' } }),
      item('Crear cuenta', { onclick: () => openAuth(null, 'register') }),
    );
    return;
  }
  const items = [
    el('li', {}, [el('span', { class: 'dropdown-item-text fw-bold', text: user.nombre, dataset: { testid: 'user-name' } })]),
    el('li', {}, [el('hr', { class: 'dropdown-divider' })]),
    item('Mis pedidos', { href: '/pedidos.php' }),
    item('Mi perfil', { href: '/perfil.php' }),
    user.role === 'ADMIN' ? item('Administración', { href: '/admin.php', dataset: { testid: 'menu-admin' } }) : null,
    el('li', {}, [el('hr', { class: 'dropdown-divider' })]),
    item('Cerrar sesión', { onclick: logout, dataset: { testid: 'menu-logout' } }),
  ];
  menu.replaceChildren(...items.filter(Boolean));
}

async function loadCategories() {
  const ul = document.getElementById('navCategorias');
  const r = await api('/categories');
  if (!r.ok) return; // el menú conserva "Todo el catálogo"; la página de catálogo muestra el error
  for (const c of r.data.data) {
    ul.append(el('li', {}, [el('a', { class: 'dropdown-item', href: `/catalogo.php?categoria=${encodeURIComponent(c.nombre)}`, text: `${c.nombre} (${c.total})` })]));
  }
}

initAuthUi();
renderCartCount();
renderUserMenu();
loadCategories();
document.addEventListener('choco:cart', renderCartCount);
document.addEventListener('choco:session', renderUserMenu);
window.addEventListener('storage', (e) => e.key === 'choco.cart' && renderCartCount());
