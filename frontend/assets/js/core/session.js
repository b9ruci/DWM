// Sesión del usuario en el navegador.
// Se guarda en sessionStorage (se borra al cerrar la pestaña). El token es de vida corta (15 min)
// y el API Gateway puede revocarlo (logout). El navegador nunca recibe secretos del backend.
const KEY = 'choco.session';

function read() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!s || !s.token || !s.expiresAt) return null;
    return s;
  } catch {
    return null;
  }
}

export const session = {
  get() {
    return read();
  },
  isLogged() {
    const s = read();
    return Boolean(s);
  },
  isExpired() {
    const s = read();
    return Boolean(s && Date.now() >= s.expiresAt);
  },
  user() {
    const s = read();
    return s ? s.user : null;
  },
  token() {
    const s = read();
    return s ? s.token : null;
  },
  save({ accessToken, expiresIn, user }) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ token: accessToken, user, expiresAt: Date.now() + expiresIn * 1000 }));
    } catch {
      /* almacenamiento no disponible: la sesión dura solo esta página */
    }
    document.dispatchEvent(new CustomEvent('choco:session', { detail: { user } }));
  },
  clear(reason) {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
    document.dispatchEvent(new CustomEvent('choco:session', { detail: { user: null, reason } }));
  },
};
