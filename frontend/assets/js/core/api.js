// Cliente HTTP hacia el API Gateway (único backend que conoce el navegador).
// - Genera un identificador de correlación por acción (X-Correlation-Id) que también
//   registran el gateway y los servicios: permite vincular pantalla, red y logs.
// - Plazo máximo por solicitud (AbortController) y estado de error comprensible.
// - Ante 401 por sesión expirada/revocada limpia la sesión y avisa a la interfaz.
import { session } from './session.js';

const API = window.CHOCO_CONFIG.apiBase;
const SESSION_CODES = ['TOKEN_EXPIRED', 'TOKEN_INVALID', 'SESSION_REVOKED', 'AUTH_REQUIRED'];

export const MESSAGES = {
  NETWORK: 'No pudimos conectarnos con el servidor. Revisa tu conexión e intenta nuevamente.',
  TIMEOUT: 'El servidor tardó demasiado en responder. Intenta nuevamente.',
  SERVICE_UNAVAILABLE: 'El servicio no está disponible en este momento. Intenta nuevamente en unos minutos.',
  UPSTREAM_TIMEOUT: 'El servicio tardó demasiado en responder. Intenta nuevamente.',
  RATE_LIMITED: 'Hiciste demasiadas solicitudes seguidas. Espera un momento.',
  FORBIDDEN: 'No tienes permisos para realizar esta acción.',
  INTERNAL_ERROR: 'Ocurrió un error inesperado. Intenta nuevamente.',
};

export function newId() {
  return crypto.randomUUID();
}

/**
 * @returns {Promise<{ok:boolean,status:number,data:any,error:{code:string,message:string,details?:any}|null,cid:string,headers?:Headers}>}
 */
export async function api(path, { method = 'GET', body, auth = false, idempotencyKey, timeoutMs = 10000 } = {}) {
  const cid = newId();
  const headers = { 'x-correlation-id': cid };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  if (auth) {
    const token = session.token();
    if (!token || session.isExpired()) {
      session.clear('TOKEN_EXPIRED');
      return { ok: false, status: 401, data: null, error: { code: 'TOKEN_EXPIRED', message: 'Tu sesión expiró. Inicia sesión nuevamente.' }, cid };
    }
    headers.authorization = `Bearer ${token}`;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: ctrl.signal });
  } catch (err) {
    const code = err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
    return { ok: false, status: 0, data: null, error: { code, message: MESSAGES[code] }, cid };
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  const serverCid = res.headers.get('x-correlation-id') || cid;
  if (res.ok) return { ok: true, status: res.status, data, error: null, cid: serverCid, headers: res.headers };
  const e = (data && data.error) || {};
  const code = e.code || `HTTP_${res.status}`;
  if (res.status === 401 && auth && SESSION_CODES.includes(code)) session.clear(code);
  return {
    ok: false,
    status: res.status,
    data,
    error: { code, message: e.message || MESSAGES[code] || MESSAGES.INTERNAL_ERROR, details: e.details },
    cid: serverCid,
  };
}

/** Consulta GraphQL a través del API Gateway (POST /graphql). */
export async function gql(query, variables = {}) {
  const r = await api('/graphql', { method: 'POST', body: { query, variables }, auth: true });
  if (r.status === 200 || (r.data && r.data.errors)) {
    return { ...r, ok: r.status === 200 && Boolean(r.data && r.data.data), gqlErrors: (r.data && r.data.errors) || [] };
  }
  return { ...r, gqlErrors: [] };
}
