// Carrito = borrador local del cliente: solo guarda {productId, cantidad}.
// Los precios que se muestran se consultan al backend y el total oficial lo calcula orders.
const KEY = 'choco.cart';
const MAX_QTY = 50;

function read() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(c) ? c.filter((l) => typeof l.productId === 'string' && Number.isInteger(l.cantidad) && l.cantidad > 0) : [];
  } catch {
    return [];
  }
}
function write(lines) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* sin almacenamiento: el carrito no persiste */
  }
  document.dispatchEvent(new CustomEvent('choco:cart', { detail: { count: count(lines) } }));
}
const count = (lines) => lines.reduce((s, l) => s + l.cantidad, 0);

export const cart = {
  lines: read,
  count: () => count(read()),
  add(productId, cantidad = 1, max = MAX_QTY) {
    const lines = read();
    const line = lines.find((l) => l.productId === productId);
    const limit = Math.min(max, MAX_QTY);
    if (line) line.cantidad = Math.min(line.cantidad + cantidad, limit);
    else lines.push({ productId, cantidad: Math.min(cantidad, limit) });
    write(lines);
  },
  set(productId, cantidad) {
    const lines = read()
      .map((l) => (l.productId === productId ? { ...l, cantidad: Math.min(cantidad, MAX_QTY) } : l))
      .filter((l) => l.cantidad > 0);
    write(lines);
  },
  remove(productId) {
    write(read().filter((l) => l.productId !== productId));
  },
  clear() {
    write([]);
  },
};
