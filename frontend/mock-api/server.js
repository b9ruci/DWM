#!/usr/bin/env node
'use strict';
// API SIMULADA (servicios dummy de la Unidad 1). Mismo contrato y puerto que el API Gateway real,
// de modo que el frontend funcione SIN backend. Las respuestas salen de data/*.json y las
// "modificaciones" (pedido, contacto) se simulan en memoria: no hay persistencia ni seguridad real.
//   node frontend/mock-api/server.js        → http://localhost:8080/api/v1
//   MOCK_DELAY_MS=1500  simula latencia (estado de carga)
//   MOCK_FAIL=products  hace fallar esa ruta con 503 (estado de error y "Reintentar")
const http = require('node:http');
const crypto = require('node:crypto');
const products = require('./data/products.json');
const promotions = require('./data/promotions.json');

const PORT = Number(process.env.PORT || 8080);
const DELAY = Number(process.env.MOCK_DELAY_MS || 300);
const FAIL = (process.env.MOCK_FAIL || '').split(',').filter(Boolean);
const ORIGINS = ['http://localhost:8000', 'http://127.0.0.1:8000'];
const orders = new Map();

const user = { id: 'demo-0001', nombre: 'Cliente Demo (ficticio)', role: 'CLIENTE' };
const profile = { id: user.id, nombre: user.nombre, email: 'demo@chocomania.test', rut: null, telefono: '+56 9 0000 0000', direccion: 'Calle Bombón 123', comuna: 'Providencia' };

function send(req, res, status, body) {
  const origin = ORIGINS.includes(req.headers.origin) ? req.headers.origin : ORIGINS[0];
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,idempotency-key,x-correlation-id',
    'access-control-expose-headers': 'x-correlation-id',
    'x-correlation-id': req.headers['x-correlation-id'] || crypto.randomUUID(),
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
const err = (code, message, details) => ({ error: { code, message, details } });

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      try {
        resolve(b ? JSON.parse(b) : {});
      } catch {
        resolve(null);
      }
    });
  });
}

const routes = {
  'GET /products': (q) => {
    let list = products;
    if (q.get('categoria')) list = list.filter((p) => p.categoria === q.get('categoria'));
    if (q.get('destacado') === 'true') list = list.filter((p) => p.destacado);
    if (q.get('q')) list = list.filter((p) => (p.nombre + p.descripcion).toLowerCase().includes(q.get('q').toLowerCase()));
    return [200, { data: list, total: list.length }];
  },
  'GET /categories': () => {
    const c = {};
    products.forEach((p) => (c[p.categoria] = (c[p.categoria] || 0) + 1));
    return [200, { data: Object.entries(c).map(([nombre, total]) => ({ nombre, total })) }];
  },
  'GET /promotions': () => [200, { data: promotions }],
  'POST /auth/login': (q, body) => {
    if (!body || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email || '') || String(body.password || '').length < 8) {
      return [401, err('CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos (simulado: usa cualquier correo y 8+ caracteres)')];
    }
    return [200, { data: { accessToken: 'token-simulado', tokenType: 'Bearer', expiresIn: 900, user } }];
  },
  'POST /auth/register': (q, body) => [201, { data: { id: user.id, email: body.email, nombre: body.nombre, role: 'CLIENTE' } }],
  'POST /auth/logout': () => [200, { data: { revocada: true } }],
  'GET /me/profile': () => [200, { data: profile }],
  'POST /contact-requests': (q, body) => {
    if (!body || !body.nombre || !body.email || String(body.mensaje || '').length < 10) return [400, err('VALIDATION_ERROR', 'Datos inválidos', [{ field: 'mensaje', message: 'Mínimo 10 caracteres' }])];
    return [201, { data: { id: crypto.randomUUID(), estado: 'NUEVA', tipo: body.tipo } }];
  },
  'POST /orders': (q, body) => {
    if (!body || !Array.isArray(body.items) || !body.items.length) return [400, err('VALIDATION_ERROR', 'El pedido no tiene productos')];
    const items = [];
    for (const it of body.items) {
      const p = products.find((x) => x.id === it.productId);
      if (!p || p.stock < it.cantidad) return [409, err('STOCK_INSUFICIENTE', 'No hay stock suficiente', [{ productId: it.productId, nombre: p ? p.nombre : it.productId, solicitado: it.cantidad, disponible: p ? p.stock : 0 }])];
      items.push({ productoId: p.id, nombre: p.nombre, precioUnitario: p.precio, cantidad: it.cantidad, subtotal: p.precio * it.cantidad });
    }
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const costo = subtotal >= 50000 ? 0 : 3990;
    const o = { id: crypto.randomUUID(), estado: 'PENDIENTE_PAGO', subtotal, costoDespacho: costo, total: subtotal + costo, items, despacho: body.despacho };
    orders.set(o.id, o);
    return [201, { data: o }];
  },
  'POST /payments': (q, body) => {
    const o = orders.get(body && body.pedidoId);
    if (!o) return [404, err('NOT_FOUND', 'Pedido no encontrado')];
    return [201, { data: { id: crypto.randomUUID(), pedidoId: o.id, monto: o.total, estado: 'PENDIENTE', checkoutUrl: `http://localhost:${PORT}/pago-simulado/${o.id}` } }];
  },
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://mock');
  if (req.method === 'OPTIONS') return send(req, res, 204);
  if (url.pathname.startsWith('/pago-simulado/')) {
    const o = orders.get(url.pathname.split('/').pop());
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pago simulado</title>
<body style="font-family:system-ui;background:#fbf5ec;padding:24px"><div style="max-width:420px;margin:auto;background:#fff;border:2px solid #3b2218;border-radius:12px;padding:20px">
<p style="background:#fff3cd;padding:8px;border-radius:8px">SERVICIO SIMULADO (Unidad 1): no hay pago real.</p>
<h1 style="font-size:1.3rem">Pedido ${o ? o.id.slice(0, 8) : '—'}</h1><p data-testid="mock-total">Total: $${o ? o.total.toLocaleString('es-CL') : 0}</p>
<p>Pago aprobado (simulado).</p><a href="http://localhost:8000/index.php">Volver a la tienda</a></div></body>`);
  }
  const path = url.pathname.replace(/^\/api\/v1/, '');
  const key = `${req.method} ${path}`;
  const handler = routes[key];
  await new Promise((r) => setTimeout(r, DELAY));
  if (!handler) return send(req, res, 404, err('NOT_FOUND', 'Ruta no disponible en la API simulada'));
  if (FAIL.some((f) => path.includes(f))) return send(req, res, 503, err('SERVICE_UNAVAILABLE', 'El servicio no está disponible en este momento (falla simulada).'));
  const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : null;
  const [status, out] = handler(url.searchParams, body);
  console.log(new Date().toISOString(), key, status);
  return send(req, res, status, out);
}).listen(PORT, '127.0.0.1', () => console.log(`API simulada (U1) en http://localhost:${PORT}/api/v1`));
