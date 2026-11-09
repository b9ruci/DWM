'use strict';
// Lista blanca explícita de rutas externas del API Gateway (Módulo 6).
// Cualquier ruta o verbo no listado responde 404/405: no se publican endpoints internos por omisión.
//  access: anon | user | admin | webhook
//  limit:  default | strict  (límite de solicitudes por IP y por ruta)
//  svc:    ID de servicio del Módulo 1
module.exports = [
  // ---- Catálogo (anónimo) ----
  { id: 'GW01', svc: 'S01', method: 'GET', path: '/api/v1/products', access: 'anon', target: 'inventory', to: '/products', query: ['categoria', 'q', 'destacado'] },
  { id: 'GW02', svc: 'S02', method: 'GET', path: '/api/v1/products/:id', access: 'anon', target: 'inventory', to: '/products/:id' },
  { id: 'GW03', svc: 'S03', method: 'GET', path: '/api/v1/categories', access: 'anon', target: 'inventory', to: '/categories' },
  { id: 'GW04', svc: 'S04', method: 'GET', path: '/api/v1/promotions', access: 'anon', target: 'inventory', to: '/promotions' },
  // ---- Identidad ----
  { id: 'GW05', svc: 'S05', method: 'POST', path: '/api/v1/auth/register', access: 'anon', limit: 'strict', target: 'auth', to: '/register' },
  { id: 'GW06', svc: 'S06', method: 'POST', path: '/api/v1/auth/login', access: 'anon', limit: 'strict', target: 'auth', to: '/login' },
  { id: 'GW07', svc: 'S07', method: 'POST', path: '/api/v1/auth/logout', access: 'user', target: 'auth', to: '/logout' },
  { id: 'GW08', svc: 'S08', method: 'GET', path: '/api/v1/auth/me', access: 'user', target: 'auth', to: '/me' },
  // ---- Perfil (clients) ----
  { id: 'GW09', svc: 'S09', method: 'GET', path: '/api/v1/me/profile', access: 'user', target: 'clients', to: '/clients/me' },
  { id: 'GW10', svc: 'S10', method: 'PUT', path: '/api/v1/me/profile', access: 'user', target: 'clients', to: '/clients/me' },
  { id: 'GW11', svc: 'S11', method: 'POST', path: '/api/v1/contact-requests', access: 'anon', limit: 'strict', target: 'clients', to: '/contact-requests', optionalUser: true },
  // ---- Pedidos (orders) ----
  { id: 'GW12', svc: 'S12', method: 'POST', path: '/api/v1/orders', access: 'user', target: 'orders', to: '/orders', forward: ['idempotency-key'] },
  { id: 'GW13', svc: 'S13', method: 'GET', path: '/api/v1/orders', access: 'user', target: 'orders', to: '/orders', query: ['limite', 'desde'] },
  { id: 'GW14', svc: 'S14', method: 'GET', path: '/api/v1/orders/:id', access: 'user', target: 'orders', to: '/orders/:id' },
  { id: 'GW15', svc: 'S15', method: 'POST', path: '/api/v1/orders/:id/cancel', access: 'user', target: 'orders', to: '/orders/:id/cancel' },
  // ---- Pagos (payments) ----
  { id: 'GW16', svc: 'S16', method: 'POST', path: '/api/v1/payments', access: 'user', target: 'payments', to: '/payments' },
  { id: 'GW17', svc: 'S17', method: 'GET', path: '/api/v1/payments/:id', access: 'user', target: 'payments', to: '/payments/:id' },
  { id: 'GW18', svc: 'S18', method: 'POST', path: '/api/v1/webhooks/payments', access: 'webhook', target: 'payments', to: '/webhooks/provider', forward: ['x-sandbox-signature'], raw: true },
  // ---- Agregación GraphQL (privada detrás del gateway) ----
  { id: 'GW19', svc: 'S19', method: 'POST', path: '/api/v1/graphql', access: 'user', target: 'graphql', to: '/graphql' },
  // ---- Administración ----
  { id: 'GW20', svc: 'S20', method: 'GET', path: '/api/v1/admin/products', access: 'admin', target: 'inventory', to: '/admin/products' },
  { id: 'GW21', svc: 'S21', method: 'POST', path: '/api/v1/admin/products', access: 'admin', target: 'inventory', to: '/admin/products' },
  { id: 'GW22', svc: 'S22', method: 'PUT', path: '/api/v1/admin/products/:id', access: 'admin', target: 'inventory', to: '/admin/products/:id' },
  { id: 'GW23', svc: 'S23', method: 'DELETE', path: '/api/v1/admin/products/:id', access: 'admin', target: 'inventory', to: '/admin/products/:id' },
  { id: 'GW24', svc: 'S24', method: 'GET', path: '/api/v1/admin/orders', access: 'admin', target: 'orders', to: '/admin/orders', query: ['estado'] },
  { id: 'GW25', svc: 'S25', method: 'PUT', path: '/api/v1/admin/orders/:id/status', access: 'admin', target: 'orders', to: '/admin/orders/:id/status' },
  { id: 'GW26', svc: 'S26', method: 'GET', path: '/api/v1/admin/clients', access: 'admin', target: 'clients', to: '/admin/clients' },
  { id: 'GW27', svc: 'S27', method: 'GET', path: '/api/v1/admin/contact-requests', access: 'admin', target: 'clients', to: '/admin/contact-requests' },
  { id: 'GW28', svc: 'S28', method: 'PUT', path: '/api/v1/admin/contact-requests/:id', access: 'admin', target: 'clients', to: '/admin/contact-requests/:id' },
];
