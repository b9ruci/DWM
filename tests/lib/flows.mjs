// Pasos reutilizables de los protocolos (preparación de datos y recorridos de interfaz).
import crypto from 'node:crypto';
import { API, WEB, SANDBOX, Blocked } from './harness.mjs';

export const DIR_A = 'Calle Bombón 123, depto 4';

/** Crea un pedido por API (precondición de pruebas que no evalúan la creación). */
export async function createOrderApi(ctx, token, items, despacho = { direccion: DIR_A, comuna: 'Providencia' }) {
  const r = await ctx.api('/orders', { method: 'POST', token, body: { items, despacho }, headers: { 'idempotency-key': crypto.randomUUID() } });
  if (r.status !== 201) throw new Blocked(`Precondición: no se pudo crear el pedido (HTTP ${r.status} ${JSON.stringify(r.data)})`);
  return r.data.data;
}

/** Inicia el pago y lo resuelve en el sandbox del proveedor (aprobar/rechazar) sin navegador. */
export async function payApi(ctx, token, pedidoId, action = 'approve') {
  const p = await ctx.api('/payments', { method: 'POST', token, body: { pedidoId } });
  if (p.status !== 201 && p.status !== 200) throw new Blocked(`Precondición: no se pudo iniciar el pago (HTTP ${p.status})`);
  const url = new URL(p.data.data.checkoutUrl);
  const r = await ctx.api(`${url.pathname}/${action}`, { method: 'POST', base: SANDBOX });
  if (r.status !== 303) throw new Blocked(`Precondición: el sandbox no resolvió el pago (HTTP ${r.status})`);
  return { payment: p.data.data, sessionPath: url.pathname };
}

export async function stockOf(ctx, productId) {
  const r = await ctx.api(`/products/${productId}`);
  return r.status === 200 ? r.data.data.stock : null;
}

export async function waitFor(fn, { timeout = 8000, interval = 250 } = {}) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, interval));
  }
  return last;
}

/** Recorrido UI: catálogo → agregar → carrito → confirmar → pasarela. Devuelve la página en el sandbox. */
export async function buyUi(ctx, page, account, productId, qty, { login = true } = {}) {
  await page.goto(`${WEB}/catalogo.php`);
  await page.locator('[data-testid=product-grid]').waitFor();
  if (login) await ctx.loginUi(page, account);
  const card = page.locator(`[data-product-id="${productId}"]`);
  await card.locator('input.qty').fill(String(qty));
  await card.locator(`[data-testid=add-${productId}]`).click();
  await page.goto(`${WEB}/carrito.php`);
  await page.locator(`.cart-line[data-product-id="${productId}"]`).waitFor();
  await page.locator('#direccion').fill(DIR_A);
  await page.locator('#comuna').fill('Providencia');
  return card;
}

export { API, WEB, SANDBOX };
