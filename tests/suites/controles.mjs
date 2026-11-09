// Pruebas de permisos, GraphQL, resiliencia, administración, responsividad y protección de evidencias.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WEB, ROOT, forgeExpiredToken, allSecretValues } from '../lib/harness.mjs';
import { createOrderApi, payApi, stockOf, waitFor, DIR_A } from '../lib/flows.mjs';

const A_ID = '00000000-0000-4000-8000-0000000000a1';

export default [
  {
    id: 'P13', flujo: 'F06', requisito: 'R05,R11', criterio: 'CA13', critico: 'C3', tipo: 'rechazo (recurso ajeno)', viewports: ['escritorio', 'movil'],
    titulo: 'Un cliente no puede ver, pagar ni cancelar el pedido de otro cliente',
    precondiciones: 'Pedido PENDIENTE_PAGO de clienteA (creado por API). clienteB con sesión.',
    pasos: ['clienteA crea un pedido', 'clienteB abre /pedidos.php?pedido={id de A}', 'clienteB intenta GET /orders/{id}, POST /payments y POST /orders/{id}/cancel', 'Verificar que el pedido no cambió'],
    esperado: 'La interfaz muestra "Pedido no encontrado" sin dirección ni nombre de A; GraphQL devuelve pedido=null; REST 404 en las tres operaciones; el pedido sigue PENDIENTE_PAGO.',
    verificacion: 'Capturas + red (respuesta GraphQL) + respuestas API + SQLite.',
    restauracion: 'Base nueva por ejecución.',
    async run(ctx) {
      const tA = await ctx.login(ctx.seed.clienteA);
      const o = await createOrderApi(ctx, tA, [{ productId: 'p-007', cantidad: 1 }]);
      for (const vp of this.viewports) {
        const page = await ctx.page(vp);
        await page.goto(`${WEB}/index.php`);
        await ctx.loginUi(page, ctx.seed.clienteB);
        const gq = page.waitForResponse((r) => r.url().endsWith('/graphql') && r.request().postData().includes('query Pedido'));
        await page.goto(`${WEB}/pedidos.php?pedido=${o.id}`);
        const body = await (await gq).json();
        ctx.check(`[${vp}] GraphQL devuelve pedido null`, null, body.data.pedido);
        await page.locator('#detallePedido [data-state=empty]').waitFor();
        const text = await page.locator('#detallePedido').textContent();
        ctx.check(`[${vp}] mensaje "Pedido no encontrado"`, true, text.includes('Pedido no encontrado'));
        ctx.check(`[${vp}] no se revelan datos de A`, false, text.includes(DIR_A) || text.includes('Ana Pérez'));
        await ctx.shot(page, 'ajeno', 'clienteB intentando ver un pedido de clienteA');
      }
      const tB = await ctx.login(ctx.seed.clienteB);
      ctx.check('GET pedido ajeno', 404, (await ctx.api(`/orders/${o.id}`, { token: tB })).status);
      ctx.check('pagar pedido ajeno', 404, (await ctx.api('/payments', { method: 'POST', token: tB, body: { pedidoId: o.id } })).status);
      ctx.check('cancelar pedido ajeno', 404, (await ctx.api(`/orders/${o.id}/cancel`, { method: 'POST', token: tB })).status);
      ctx.check('pedido sin modificaciones', 'PENDIENTE_PAGO', ctx.db('orders').prepare('SELECT estado FROM orders WHERE id = ?').get(o.id).estado);
    },
  },
  {
    id: 'P14', flujo: 'F06', requisito: 'R05,R11', criterio: 'CA14', critico: 'C3', tipo: 'límite', viewports: [],
    titulo: 'Límites y autorización por campo en GraphQL',
    precondiciones: 'Sesiones de clienteA y admin. Límites configurados: costo 500, profundidad 5, 4000 caracteres, limite ≤ 20, introspección deshabilitada.',
    pasos: ['Consulta con 2 alias de misPedidos(limite:20) (amplificación)', 'Consulta de introspección', 'Campo notasInternas como cliente y como admin', 'resumenVentas como cliente', 'misPedidos(limite: 50)', 'Consulta de más de 4000 caracteres'],
    esperado: '400 QUERY_TOO_COMPLEX; 400 por introspección; cliente recibe notasInternas=null con error FORBIDDEN y admin sin error; resumenVentas FORBIDDEN para cliente; BAD_USER_INPUT; 400 QUERY_TOO_LARGE.',
    verificacion: 'Respuestas API + traza graphql (graphql_limit).',
    restauracion: 'No modifica datos.',
    async run(ctx) {
      const tA = await ctx.login(ctx.seed.clienteA);
      const tAdm = await ctx.login(ctx.seed.admin);
      const q = (token, query, variables) => ctx.api('/graphql', { method: 'POST', token, body: { query, variables } });
      const code = (r) => r.data && r.data.errors && r.data.errors[0] && r.data.errors[0].extensions.code;
      const big = '{ a: misPedidos(limite:20){ pedidos{ items{ producto{ nombre } } pago{ estado } cliente{ nombre } } } b: misPedidos(limite:20){ pedidos{ items{ producto{ nombre } } pago{ estado } } } }';
      const r1 = await q(tA, big);
      ctx.check('amplificación por alias rechazada', [400, 'QUERY_TOO_COMPLEX'], [r1.status, code(r1)]);
      const r2 = await q(tA, '{ __schema { types { name } } }');
      ctx.check('introspección deshabilitada', 400, r2.status);
      const o = await createOrderApi(ctx, tA, [{ productId: 'p-007', cantidad: 1 }]);
      const r3 = await q(tA, 'query($id:ID!){ pedido(id:$id){ id notasInternas } }', { id: o.id });
      ctx.check('cliente: notasInternas null + FORBIDDEN', [null, 'FORBIDDEN'], [r3.data.data.pedido.notasInternas, code(r3)]);
      const r4 = await q(tAdm, 'query($id:ID!){ pedido(id:$id){ id notasInternas } }', { id: o.id });
      ctx.check('admin: campo autorizado sin errores', [o.id, undefined], [r4.data.data.pedido && r4.data.data.pedido.id, r4.data.errors]);
      const r5 = await q(tA, '{ resumenVentas { ingresos } }');
      ctx.check('resumenVentas denegado a cliente', [null, 'FORBIDDEN'], [r5.data.data.resumenVentas, code(r5)]);
      const r6 = await q(tA, '{ misPedidos(limite: 50) { total } }');
      ctx.check('paginación acotada', 'BAD_USER_INPUT', code(r6));
      const r7 = await q(tA, `{ misPedidos { total } } # ${'x'.repeat(4100)}`);
      ctx.check('consulta demasiado grande', [400, 'QUERY_TOO_LARGE'], [r7.status, code(r7)]);
    },
  },
  {
    id: 'P15', flujo: 'F06', requisito: 'R05,R12', criterio: 'CA15', critico: 'C3', tipo: 'fallo y recuperación', viewports: ['escritorio'],
    titulo: 'GraphQL con inventory caído: información parcial advertida y recuperación',
    precondiciones: 'Pedido de clienteA (por API). Se detiene inventory.',
    pasos: ['Crear pedido', 'Detener inventory', 'Abrir /pedidos.php?pedido={id}', 'Observar advertencia', 'Reiniciar inventory y pulsar "Actualizar"'],
    esperado: 'Pantalla muestra "Información parcial" y el nombre del producto guardado en el pedido; GraphQL responde completo=false con error DEPENDENCY_UNAVAILABLE en items.producto; tras reiniciar, la advertencia desaparece (completo=true).',
    verificacion: 'Capturas + red GraphQL + traza (downstream_failure en graphql).',
    restauracion: 'inventory reiniciado (también en caso de error).',
    async run(ctx, env) {
      const tA = await ctx.login(ctx.seed.clienteA);
      const o = await createOrderApi(ctx, tA, [{ productId: 'p-006', cantidad: 1 }]);
      const page = await ctx.page('escritorio');
      await page.goto(`${WEB}/index.php`);
      await ctx.loginUi(page, ctx.seed.clienteA);
      await env.stack.stop('inventory');
      try {
        const gq = page.waitForResponse((r) => r.url().endsWith('/graphql') && r.request().postData().includes('query Pedido'));
        await page.goto(`${WEB}/pedidos.php?pedido=${o.id}`);
        const body = await (await gq).json();
        ctx.check('GraphQL marca completo=false', false, body.data.pedido.completo);
        ctx.check('error parcial tipificado', true, body.errors.some((e) => e.extensions.code === 'DEPENDENCY_UNAVAILABLE' && e.path.includes('producto')));
        await page.locator('[data-testid=partial-detail]').waitFor();
        ctx.check('nombre del producto (instantánea de orders) visible', true, (await page.locator('#detallePedido').textContent()).includes('Trufas de Pistacho'));
        await ctx.shot(page, 'parcial', 'Detalle con advertencia de información parcial');
        await env.stack.start('inventory');
        await page.locator('#btnRefrescar').click();
        await page.locator('[data-testid=order-total]').waitFor();
        await waitFor(async () => (await page.locator('[data-testid=partial-detail]').count()) === 0);
        ctx.check('advertencia desaparece tras recuperación', 0, await page.locator('[data-testid=partial-detail]').count());
        await ctx.shot(page, 'recuperado', 'Detalle completo tras reiniciar inventory');
      } finally {
        await env.stack.start('inventory');
      }
    },
  },
  {
    id: 'P16', flujo: 'F12', requisito: 'R11', criterio: 'CA16', tipo: 'rechazo', viewports: ['escritorio'],
    titulo: 'Operaciones protegidas sin sesión',
    precondiciones: 'Visitante sin sesión.',
    pasos: ['GET /orders, POST /orders y POST /graphql sin token', 'Abrir /pedidos.php sin sesión', 'Intentar confirmar un carrito sin sesión'],
    esperado: '401 AUTH_REQUIRED en las tres; la interfaz pide iniciar sesión y abre el modal al confirmar el carrito; no se crea pedido.',
    verificacion: 'Respuestas API + capturas.',
    restauracion: 'No modifica datos.',
    async run(ctx) {
      const n0 = ctx.db('orders').prepare('SELECT COUNT(*) AS n FROM orders').get().n;
      for (const [m, p] of [['GET', '/orders'], ['POST', '/orders'], ['POST', '/graphql']]) {
        const r = await ctx.api(p, { method: m, body: m === 'POST' ? {} : undefined });
        ctx.check(`${m} ${p} sin sesión`, [401, 'AUTH_REQUIRED'], [r.status, r.data && r.data.error && r.data.error.code]);
      }
      const page = await ctx.page('escritorio');
      await page.goto(`${WEB}/pedidos.php`);
      await page.locator('#listaPedidos [data-state=empty]').waitFor();
      ctx.check('pedidos.php pide iniciar sesión', true, (await page.locator('#listaPedidos').textContent()).includes('Inicia sesión'));
      await page.evaluate(() => localStorage.setItem('choco.cart', JSON.stringify([{ productId: 'p-002', cantidad: 1 }])));
      await page.goto(`${WEB}/carrito.php`);
      await page.locator('.cart-line').first().waitFor();
      await page.locator('[data-testid=checkout-submit]').click();
      await page.locator('#authModal.show').waitFor();
      ctx.check('se abre modal de inicio de sesión', true, await page.locator('#authModal').isVisible());
      await ctx.shot(page, 'requiere-login', 'Confirmación de carrito sin sesión');
      ctx.check('no se crearon pedidos', n0, ctx.db('orders').prepare('SELECT COUNT(*) AS n FROM orders').get().n);
    },
  },
  {
    id: 'P17', flujo: 'F12', requisito: 'R02,R11', criterio: 'CA17', tipo: 'rechazo (sesión expirada/revocada)', viewports: ['escritorio'],
    titulo: 'Sesión expirada y sesión cerrada (revocada)',
    precondiciones: 'Token expirado FABRICADO por el arnés con la clave del entorno de prueba (declarado: evita esperar 15 min). Cuenta clienteA.',
    pasos: ['GET /orders con token expirado', 'Cargar el token expirado en la sesión del navegador y abrir /pedidos.php', 'Iniciar sesión por API, cerrar sesión (logout) y reutilizar el mismo token inmediatamente'],
    esperado: '401 TOKEN_EXPIRED; la interfaz limpia la sesión y abre el modal "Tu sesión expiró…"; tras logout, el token reutilizado recibe 401 SESSION_REVOKED de inmediato.',
    verificacion: 'Respuestas API + captura + traza.',
    restauracion: 'No modifica datos de negocio.',
    async run(ctx) {
      const expired = forgeExpiredToken(A_ID, 'CLIENTE');
      const r = await ctx.api('/orders', { token: expired });
      ctx.check('token expirado rechazado', [401, 'TOKEN_EXPIRED'], [r.status, r.data.error.code]);
      const page = await ctx.page('escritorio');
      await page.goto(`${WEB}/index.php`);
      await page.evaluate((t) => sessionStorage.setItem('choco.session', JSON.stringify({ token: t, user: { id: 'x', nombre: 'Ana Pérez (ficticia)', role: 'CLIENTE' }, expiresAt: Date.now() + 600000 })), expired);
      await page.goto(`${WEB}/pedidos.php`);
      await page.locator('#authModal.show').waitFor();
      ctx.check('aviso de sesión expirada', true, (await page.locator('#authNotice').textContent()).includes('sesión expiró'));
      ctx.check('sesión local eliminada', null, await page.evaluate(() => sessionStorage.getItem('choco.session')));
      await ctx.shot(page, 'expirada', 'Aviso de sesión expirada');
      const tok = await ctx.login(ctx.seed.clienteA);
      ctx.check('token válido antes de logout', 200, (await ctx.api('/orders', { token: tok })).status);
      ctx.check('logout', 200, (await ctx.api('/auth/logout', { method: 'POST', token: tok })).status);
      const after = await ctx.api('/orders', { token: tok });
      ctx.check('token revocado rechazado inmediatamente', [401, 'SESSION_REVOKED'], [after.status, after.data && after.data.error && after.data.error.code]);
    },
  },
  {
    id: 'P18', flujo: 'F10-F11', requisito: 'R09,R10,R11', criterio: 'CA18', tipo: 'rechazo (rol sin permiso)', viewports: ['escritorio'],
    titulo: 'Cliente intenta operaciones de administración',
    precondiciones: 'Sesión de clienteA.',
    pasos: ['POST /admin/products', 'DELETE /admin/products/p-002', 'GET /admin/orders y GET /admin/clients', 'Abrir /admin.php con sesión de cliente'],
    esperado: '403 FORBIDDEN en todas; p-002 sigue activo; la página muestra "No tienes permisos…" sin datos administrativos.',
    verificacion: 'Respuestas API + SQLite inventory + captura.',
    restauracion: 'No modifica datos.',
    async run(ctx) {
      const t = await ctx.login(ctx.seed.clienteA);
      const ops = [['POST', '/admin/products', { sku: 'HACK-1', nombre: 'Hack', categoria: 'Barras', precio: 1, unidad: 'unidad', stock: 1 }], ['DELETE', '/admin/products/p-002'], ['GET', '/admin/orders'], ['GET', '/admin/clients']];
      for (const [m, p, b] of ops) ctx.check(`${m} ${p} como cliente`, 403, (await ctx.api(p, { method: m, token: t, body: b })).status);
      ctx.check('p-002 sigue activo', 1, ctx.db('inventory').prepare("SELECT activo FROM products WHERE id = 'p-002'").get().activo);
      ctx.check('no se creó HACK-1', undefined, ctx.db('inventory').prepare("SELECT id FROM products WHERE sku = 'HACK-1'").get());
      const page = await ctx.page('escritorio');
      await page.goto(`${WEB}/index.php`);
      await ctx.loginUi(page, ctx.seed.clienteA);
      await page.goto(`${WEB}/admin.php`);
      await page.locator('#adminRoot [data-state=error]').waitFor();
      ctx.check('admin.php denegado en la interfaz', 'FORBIDDEN', await page.locator('#adminRoot [data-state=error]').getAttribute('data-code'));
      await ctx.shot(page, 'admin-denegado', 'Cliente en /admin.php');
    },
  },
  {
    id: 'P19', flujo: 'F12', requisito: 'R11', criterio: 'CA19', tipo: 'rechazo (acceso directo)', viewports: [],
    titulo: 'Acceso directo a servicios privados y al administrador de secretos',
    precondiciones: 'Servicios privados en 127.0.0.1:7000-7006 (modo local). El arnés actúa como atacante en la red interna.',
    pasos: ['GET directo a cada servicio privado sin identidad de servicio', 'Llamada con x-internal-auth falsificado', 'GET /v1/secrets/... sin identidad', 'GET de la clave de firma JWT presentando la identidad del gateway (consumidor no autorizado para esa referencia)', 'Enviar al gateway cabeceras x-internal-auth/x-user falsas sin JWT'],
    esperado: '401 SERVICE_AUTH_REQUIRED en cada servicio; 401 en secretos sin identidad; 403 por ACL; el gateway responde 401 AUTH_REQUIRED (ignora cabeceras de identidad del navegador).',
    verificacion: 'Respuestas + traza (internal_auth_rejected, secret_access denied).',
    restauracion: 'No modifica datos.',
    async run(ctx) {
      const targets = { inventory: [7003, '/products'], orders: [7004, '/orders'], clients: [7005, '/clients/me'], payments: [7006, '/payments/x'], graphql: [7002, '/graphql'], auth: [7001, '/me'] };
      for (const [svc, [port, p]] of Object.entries(targets)) {
        const m = svc === 'graphql' ? 'POST' : 'GET';
        const r = await ctx.api(p, { method: m, base: `http://127.0.0.1:${port}`, body: m === 'POST' ? { query: '{misPedidos{total}}' } : undefined });
        ctx.check(`${svc} sin identidad de servicio`, 401, r.status);
      }
      const forged = `v1.${Buffer.from(JSON.stringify({ iss: 'gateway', aud: 'orders', m: 'GET', p: '/orders', exp: 9999999999, usr: { sub: A_ID, role: 'ADMIN' } })).toString('base64url')}.firmafalsa`;
      ctx.check('token interno falsificado', 401, (await ctx.api('/orders', { base: 'http://127.0.0.1:7004', headers: { 'x-internal-auth': forged } })).status);
      ctx.check('secretos sin identidad', 401, (await ctx.api('/v1/secrets/auth%2Fjwt-signing-key', { base: 'http://127.0.0.1:7000' })).status);
      const gwId = fs.readFileSync(path.join(ROOT, '.secrets', 'identities', 'gateway.token'), 'utf8').trim();
      const acl = await ctx.api('/v1/secrets/auth%2Fjwt-signing-key', { base: 'http://127.0.0.1:7000', headers: { authorization: `Bearer ${gwId}`, 'x-consumer': 'gateway' } });
      ctx.check('ACL impide al gateway leer la clave de firma', 403, acl.status);
      const spoof = await ctx.api('/orders', { headers: { 'x-internal-auth': forged, 'x-user-id': A_ID, 'x-user-role': 'ADMIN' } });
      ctx.check('gateway ignora cabeceras de identidad del cliente', [401, 'AUTH_REQUIRED'], [spoof.status, spoof.data.error.code]);
    },
  },
  {
    id: 'P20', flujo: 'F07', requisito: 'R06', criterio: 'CA20', tipo: 'éxito', viewports: ['escritorio'],
    titulo: 'Cancelar un pedido pendiente desde la interfaz libera el stock',
    precondiciones: 'Pedido PENDIENTE_PAGO de clienteA con 2 Trufas (p-006), creado por API.',
    pasos: ['Registrar stock de p-006', 'Crear pedido', 'Abrir el detalle y pulsar "Cancelar pedido" (aceptar confirmación)', 'Intentar cancelar nuevamente por API'],
    esperado: 'La interfaz muestra estado Cancelado; stock vuelve al valor inicial; reserva LIBERADA; segundo intento 409 TRANSICION_INVALIDA; el pedido no se borra (historial conservado).',
    verificacion: 'Captura + red + SQLite (orders, order_events, reservations) + stock API.',
    restauracion: 'Base nueva por ejecución.',
    async run(ctx) {
      const s0 = await stockOf(ctx, 'p-006');
      const tA = await ctx.login(ctx.seed.clienteA);
      const o = await createOrderApi(ctx, tA, [{ productId: 'p-006', cantidad: 2 }]);
      ctx.check('stock reservado', s0 - 2, await stockOf(ctx, 'p-006'));
      const page = await ctx.page('escritorio');
      page.on('dialog', (d) => d.accept());
      await page.goto(`${WEB}/index.php`);
      await ctx.loginUi(page, ctx.seed.clienteA);
      await page.goto(`${WEB}/pedidos.php?pedido=${o.id}`);
      await page.locator('[data-testid=cancel-order]').click();
      await page.locator('#detallePedido [data-estado=CANCELADO]').waitFor();
      await ctx.shot(page, 'cancelado', 'Pedido cancelado');
      ctx.check('stock restaurado', s0, await stockOf(ctx, 'p-006'));
      ctx.check('reserva liberada', 'LIBERADA', ctx.db('inventory').prepare('SELECT estado FROM reservations WHERE order_id = ?').get(o.id).estado);
      ctx.check('historial conservado', ['PENDIENTE_PAGO', 'CANCELADO'], ctx.db('orders').prepare('SELECT hacia FROM order_events WHERE order_id = ? ORDER BY id').all(o.id).map((e) => e.hacia));
      const again = await ctx.api(`/orders/${o.id}/cancel`, { method: 'POST', token: tA });
      ctx.check('segunda cancelación rechazada', [409, 'TRANSICION_INVALIDA'], [again.status, again.data.error.code]);
    },
  },
  {
    id: 'P21', flujo: 'F08', requisito: 'R07', criterio: 'CA21', tipo: 'rechazo y éxito', viewports: ['escritorio'],
    titulo: 'Perfil: validación de RUT en servidor y datos personales cifrados en reposo',
    precondiciones: 'clienteB con sesión.',
    pasos: ['Abrir /perfil.php', 'Ingresar RUT 12.345.678-9 (dígito verificador inválido) y guardar', 'Corregir a 12.345.678-5 y teléfono +56 9 3333 4444, guardar', 'Recargar la página', 'Leer clients.db'],
    esperado: 'Primer guardado: mensaje de error del servidor (rut: RUT inválido); segundo: "Perfil actualizado"; tras recargar se muestran los valores; en la base rut/teléfono están cifrados (prefijo v1:, sin texto plano).',
    verificacion: 'Capturas + red + SQLite.',
    restauracion: 'Base nueva por ejecución.',
    async run(ctx) {
      const page = await ctx.page('escritorio');
      await page.goto(`${WEB}/index.php`);
      await ctx.loginUi(page, ctx.seed.clienteB);
      await page.goto(`${WEB}/perfil.php`);
      await page.locator('#perfilForm').waitFor();
      await page.locator('#rut').fill('12.345.678-9');
      await page.locator('[data-testid=profile-save]').click();
      const err = page.locator('#perfilForm .form-msg [data-kind=danger]');
      await err.waitFor();
      ctx.check('servidor rechaza RUT inválido', true, (await err.textContent()).includes('RUT inválido'));
      await ctx.shot(page, 'rut-invalido', 'RUT con dígito verificador inválido');
      await page.locator('#rut').fill('12.345.678-5');
      await page.locator('#telefono').fill('+56 9 3333 4444');
      await page.locator('[data-testid=profile-save]').click();
      await page.locator('#perfilForm .form-msg [data-kind=success]').waitFor();
      await page.reload();
      await page.locator('#perfilForm').waitFor();
      ctx.check('valores persistidos tras recargar', ['12.345.678-5', '+56 9 3333 4444'], [await page.locator('#rut').inputValue(), await page.locator('#telefono').inputValue()]);
      await ctx.shot(page, 'perfil-guardado', 'Perfil tras recargar');
      const row = ctx.db('clients').prepare('SELECT rut_enc, telefono_enc FROM clients WHERE id = ?').get('00000000-0000-4000-8000-0000000000b2');
      ctx.check('RUT y teléfono cifrados en reposo', true, row.rut_enc.startsWith('v1:') && !row.rut_enc.includes('12.345') && row.telefono_enc.startsWith('v1:') && !row.telefono_enc.includes('3333'));
    },
  },
  {
    id: 'P22', flujo: 'F09', requisito: 'R08', criterio: 'CA22', tipo: 'éxito y validación', viewports: ['movil'],
    titulo: 'Solicitud de orden especial desde "¡Contáctanos!" (móvil)',
    precondiciones: 'Visitante anónimo. Admin para la verificación.',
    pasos: ['Desde el inicio pulsar "¡Contáctanos!"', 'Enviar con mensaje de 5 caracteres', 'Completar mensaje válido y enviar', 'Admin consulta GET /admin/contact-requests', 'POST directo con mensaje corto'],
    esperado: 'Tipo preseleccionado ORDEN_ESPECIAL; el mensaje corto no se envía (validación de interfaz); el válido muestra N° de solicitud; el admin la ve con estado NUEVA; el POST directo corto recibe 400.',
    verificacion: 'Capturas + red + respuesta admin.',
    restauracion: 'Base nueva por ejecución.',
    async run(ctx) {
      const page = await ctx.page('movil');
      await page.goto(`${WEB}/index.php`);
      await page.locator('[data-testid=cta-contacto]').click();
      await page.waitForURL(/contacto\.php/);
      ctx.check('tipo preseleccionado', 'ORDEN_ESPECIAL', await page.locator('#tipo').inputValue());
      await page.locator('#nombre').fill('Pedro Evento (ficticio)');
      await page.locator('#correo').fill('pedro.evento@chocomania.test');
      await page.locator('#mensaje').fill('Hola');
      let posted = 0;
      page.on('request', (r) => r.url().includes('/contact-requests') && r.method() === 'POST' && posted++);
      await page.locator('[data-testid=contact-submit]').click();
      ctx.check('validación de interfaz bloquea mensaje corto', [true, 0], [await page.locator('#mensaje:invalid').count() === 1, posted]);
      await ctx.shot(page, 'validacion', 'Mensaje demasiado corto');
      const unique = `Necesito 30 figuras Choco Miau para un cumpleaños ref-${Date.now()}`;
      await page.locator('#mensaje').fill(unique);
      await page.locator('[data-testid=contact-submit]').click();
      await page.locator('#formContacto .form-msg [data-kind=success]').waitFor();
      await ctx.shot(page, 'enviado', 'Solicitud enviada');
      const tAdm = await ctx.login(ctx.seed.admin);
      const list = await ctx.api('/admin/contact-requests', { token: tAdm });
      const found = list.data.data.find((s) => s.mensaje === unique);
      ctx.check('admin ve la solicitud', ['ORDEN_ESPECIAL', 'NUEVA'], found && [found.tipo, found.estado]);
      const bad = await ctx.api('/contact-requests', { method: 'POST', body: { nombre: 'X Y', email: 'x@chocomania.test', tipo: 'CONSULTA', mensaje: 'corto' } });
      ctx.check('servidor también valida', 400, bad.status);
    },
  },
  {
    id: 'P23', flujo: 'F10', requisito: 'R09', criterio: 'CA23', tipo: 'éxito', viewports: ['escritorio'],
    titulo: 'Administración de productos: alta y baja lógica reflejadas en el catálogo público',
    precondiciones: 'Cuenta admin. SKU único por ejecución.',
    pasos: ['Admin abre /admin.php → Productos → Nuevo producto', 'Completa y guarda', 'Visitante consulta catálogo (API sin sesión)', 'Admin da de baja el producto', 'Visitante vuelve a consultar'],
    esperado: 'El producto aparece en la tabla y en el catálogo público; tras la baja deja de aparecer en el catálogo, pero sigue en la base con activo=0.',
    verificacion: 'Capturas + red + API anónima + SQLite.',
    restauracion: 'Producto queda inactivo (base nueva por ejecución).',
    async run(ctx) {
      const sku = `PRU-${Date.now().toString(36).toUpperCase()}`;
      const nombre = `Paleta de Prueba ${sku}`;
      const page = await ctx.page('escritorio');
      page.on('dialog', (d) => d.accept());
      await page.goto(`${WEB}/index.php`);
      await ctx.loginUi(page, ctx.seed.admin);
      await page.goto(`${WEB}/admin.php`);
      await page.locator('[data-testid=tab-admin-productos]').click();
      await page.locator('#adminProductos table').waitFor();
      await page.locator('[data-testid=new-product]').click();
      await page.locator('#pNombre').fill(nombre);
      await page.locator('#pSku').fill(sku);
      await page.locator('#pCat').selectOption('Figuras');
      await page.locator('#pPrecio').fill('2990');
      await page.locator('#pStock').fill('12');
      await page.locator('[data-testid=product-save]').click();
      await page.locator('#productoModal').waitFor({ state: 'hidden' });
      await page.locator(`#adminProductos tr:has-text("${sku}")`).waitFor();
      await ctx.shot(page, 'creado', 'Producto creado en administración');
      const pub = await ctx.api(`/products?q=${encodeURIComponent(sku)}`);
      ctx.check('visible en catálogo público', 1, pub.data.total);
      await page.locator(`#adminProductos tr:has-text("${sku}") button:has-text("Dar de baja")`).click();
      await page.locator(`#adminProductos tr:has-text("${sku}") .text-bg-secondary`).waitFor();
      const pub2 = await ctx.api(`/products?q=${encodeURIComponent(sku)}`);
      ctx.check('oculto del catálogo tras la baja', 0, pub2.data.total);
      ctx.check('conservado en la base como inactivo', 0, ctx.db('inventory').prepare('SELECT activo FROM products WHERE sku = ?').get(sku).activo);
    },
  },
  {
    id: 'P24', flujo: 'F11', requisito: 'R10', criterio: 'CA24', tipo: 'éxito y rechazo', viewports: ['escritorio'],
    titulo: 'Administración de estados: PAGADO → EN_PREPARACION y transición inválida',
    precondiciones: 'Pedido PAGADO de clienteA (precondición por API + sandbox).',
    pasos: ['Admin abre Pedidos y cambia el pedido a EN_PREPARACION', 'PUT directo EN_PREPARACION → ENTREGADO', 'clienteA consulta su pedido por GraphQL'],
    esperado: 'La tabla muestra En preparación; la transición inválida recibe 409; el cliente ve EN_PREPARACION; historial con actor admin.',
    verificacion: 'Captura + red + SQLite order_events + GraphQL del cliente.',
    restauracion: 'Base nueva por ejecución.',
    async run(ctx) {
      const tA = await ctx.login(ctx.seed.clienteA);
      const o = await createOrderApi(ctx, tA, [{ productId: 'p-004', cantidad: 1 }]);
      await payApi(ctx, tA, o.id, 'approve');
      await waitFor(() => ctx.db('orders').prepare('SELECT estado FROM orders WHERE id = ?').get(o.id).estado === 'PAGADO');
      const page = await ctx.page('escritorio');
      await page.goto(`${WEB}/index.php`);
      await ctx.loginUi(page, ctx.seed.admin);
      await page.goto(`${WEB}/admin.php`);
      await page.locator('[data-testid=tab-admin-pedidos]').click();
      const row = page.locator(`#adminPedidos tr[data-order-id="${o.id}"]`);
      await row.waitFor();
      await row.locator('select').selectOption('EN_PREPARACION');
      await page.locator(`#adminPedidos tr[data-order-id="${o.id}"] [data-estado=EN_PREPARACION]`).waitFor();
      await ctx.shot(page, 'en-preparacion', 'Pedido cambiado a En preparación');
      const tAdm = await ctx.login(ctx.seed.admin);
      const bad = await ctx.api(`/admin/orders/${o.id}/status`, { method: 'PUT', token: tAdm, body: { estado: 'ENTREGADO' } });
      ctx.check('transición inválida rechazada', 409, bad.status);
      const g = await ctx.api('/graphql', { method: 'POST', token: tA, body: { query: 'query($id:ID!){pedido(id:$id){estado}}', variables: { id: o.id } } });
      ctx.check('cliente ve el nuevo estado', 'EN_PREPARACION', g.data.data.pedido.estado);
      ctx.check('historial con actor admin', ['cliente', 'payments', 'admin'], ctx.db('orders').prepare('SELECT actor FROM order_events WHERE order_id = ? ORDER BY id').all(o.id).map((e) => e.actor));
    },
  },
  {
    id: 'P25', flujo: 'F01', requisito: 'R12', criterio: 'CA25', tipo: 'fallo (demora controlada)', viewports: ['escritorio'],
    titulo: 'inventory con respuesta demorada 5 s: el gateway corta a los 4 s y la interfaz lo comunica',
    precondiciones: 'inventory reiniciado con FAULT_DELAY_MS=5000 (inyección de fallos de prueba).',
    pasos: ['Reiniciar inventory con demora', 'Abrir /catalogo.php', 'Medir tiempo hasta el mensaje', 'Reiniciar inventory sin demora y reintentar'],
    esperado: 'Error UPSTREAM_TIMEOUT (504) "El servicio tardó demasiado…" en ≈4 s (< 6 s); tras restablecer, "Reintentar" carga el catálogo.',
    verificacion: 'Captura + red (504) + traza (downstream_failure timeout=true).',
    restauracion: 'inventory reiniciado sin demora (también en caso de error).',
    async run(ctx, env) {
      await env.stack.stop('inventory');
      await env.stack.start('inventory', { FAULT_DELAY_MS: '5000' });
      try {
        const page = await ctx.page('escritorio');
        const t0 = Date.now();
        await page.goto(`${WEB}/catalogo.php`);
        const err = page.locator('#catalogo [data-state=error]');
        await err.waitFor({ timeout: 15000 });
        const secs = (Date.now() - t0) / 1000;
        ctx.check('código UPSTREAM_TIMEOUT', 'UPSTREAM_TIMEOUT', await err.getAttribute('data-code'));
        ctx.check('mensaje en menos de 6 s', '< 6 s', `${secs.toFixed(1)} s`, secs < 6);
        await ctx.shot(page, 'demora', 'Catálogo con inventory demorado');
        await env.stack.stop('inventory');
        await env.stack.start('inventory');
        await err.locator('[data-testid=retry]').click();
        await page.locator('[data-testid=product-grid]').waitFor();
        ctx.check('recupera tras restablecer', true, (await page.locator('.product-card').count()) > 0);
      } finally {
        await env.stack.stop('inventory');
        await env.stack.start('inventory');
      }
    },
  },
  {
    id: 'P26', flujo: 'F05', requisito: 'R04,R12', criterio: 'CA26', tipo: 'fallo y recuperación', viewports: ['escritorio'],
    titulo: 'Proveedor de pagos (sandbox) indisponible al iniciar el pago',
    precondiciones: 'Pedido PENDIENTE_PAGO de clienteB. Se detiene payment-sandbox.',
    pasos: ['Crear pedido por API', 'Detener sandbox', 'En Mis pedidos pulsar "Pagar ahora"', 'Reiniciar sandbox y pulsar de nuevo'],
    esperado: 'Mensaje "El proveedor de pagos no está disponible…" (503) y el pedido sigue PENDIENTE_PAGO con el stock reservado; tras reiniciar, el botón redirige a la pasarela.',
    verificacion: 'Captura + red + SQLite (payments ERROR, orders PENDIENTE_PAGO).',
    restauracion: 'Sandbox reiniciado (también en caso de error).',
    async run(ctx, env) {
      const tB = await ctx.login(ctx.seed.clienteB);
      const o = await createOrderApi(ctx, tB, [{ productId: 'p-003', cantidad: 1 }]);
      const page = await ctx.page('escritorio');
      await page.goto(`${WEB}/index.php`);
      await ctx.loginUi(page, ctx.seed.clienteB);
      await page.goto(`${WEB}/pedidos.php?pedido=${o.id}`);
      await page.locator('[data-testid=pay-order]').waitFor();
      await env.stack.stop('payment-sandbox');
      try {
        await page.locator('[data-testid=pay-order]').click();
        const t = page.locator('[data-testid=toast]');
        await t.waitFor();
        ctx.check('mensaje de proveedor no disponible', true, (await t.textContent()).includes('proveedor de pagos no está disponible'));
        await ctx.shot(page, 'proveedor-caido', 'Pago con proveedor indisponible');
        ctx.check('pedido sigue pendiente', 'PENDIENTE_PAGO', ctx.db('orders').prepare('SELECT estado FROM orders WHERE id = ?').get(o.id).estado);
        ctx.check('intento registrado como ERROR', ['ERROR'], ctx.db('payments').prepare('SELECT estado FROM payments WHERE order_id = ?').all(o.id).map((r) => r.estado));
        await env.stack.start('payment-sandbox');
        await page.locator('[data-testid=pay-order]').click();
        await page.waitForURL(/:8090\/checkout\//);
        ctx.check('recuperación: llega a la pasarela', true, /:8090\/checkout\//.test(page.url()));
      } finally {
        await env.stack.start('payment-sandbox');
      }
    },
  },
  {
    id: 'P27', flujo: 'F09', requisito: 'R11', criterio: 'CA27', tipo: 'límite', viewports: [],
    titulo: 'Límite de solicitudes en una ruta anónima sensible (contact-requests)',
    precondiciones: 'Límite estricto configurado en la ejecución (RATE_LIMIT_STRICT, ver run.json).',
    pasos: ['Enviar límite+5 solicitudes inválidas seguidas desde la misma IP'],
    esperado: 'Las primeras reciben 400; al superar el límite, 429 RATE_LIMITED con Retry-After; no se crean registros.',
    verificacion: 'Conteo de estados + SQLite.',
    restauracion: 'La ventana se reinicia al minuto.',
    async run(ctx, env) {
      const n0 = ctx.db('clients').prepare('SELECT COUNT(*) AS n FROM contact_requests').get().n;
      const statuses = {};
      let retry = null;
      for (let i = 0; i < env.rateLimitStrict + 5; i++) {
        const r = await ctx.api('/contact-requests', { method: 'POST', body: { nombre: 'x' } });
        statuses[r.status] = (statuses[r.status] || 0) + 1;
        if (r.status === 429) retry = r.headers.get('retry-after');
      }
      ctx.check('se alcanza 429', true, (statuses[429] || 0) >= 5, (statuses[429] || 0) >= 5);
      ctx.check('cabecera Retry-After presente', true, Boolean(retry));
      ctx.saveJson('estados', statuses, 'Conteo de códigos HTTP');
      ctx.check('sin registros creados', n0, ctx.db('clients').prepare('SELECT COUNT(*) AS n FROM contact_requests').get().n);
    },
  },
  {
    id: 'P28', flujo: 'F01-F04', requisito: 'R13', criterio: 'CA28', tipo: 'responsivo', viewports: ['360', '768', '1024', '1440'],
    titulo: 'Comportamiento responsivo en 4 anchos (inicio, catálogo, carrito)',
    precondiciones: 'Visitante anónimo con 1 producto en el carrito.',
    pasos: ['Para 360, 768, 1024 y 1440 px abrir inicio, catálogo y carrito', 'Medir desborde horizontal', 'Verificar menú colapsado bajo 992 px y columnas del catálogo'],
    esperado: 'Sin desborde horizontal; botón de menú visible en 360/768 y oculto en 1024/1440; columnas del catálogo 1/3/3/4.',
    verificacion: 'Capturas de página completa + mediciones.',
    restauracion: 'No requiere.',
    async run(ctx, env) {
      const expectedCols = { 360: 1, 768: 3, 1024: 3, 1440: 4 };
      for (const w of [360, 768, 1024, 1440]) {
        const context = await env.browser.newContext({ viewport: { width: w, height: 900 } });
        const page = await context.newPage();
        await page.goto(`${WEB}/index.php`);
        await page.evaluate(() => localStorage.setItem('choco.cart', JSON.stringify([{ productId: 'p-002', cantidad: 1 }])));
        for (const p of ['index', 'catalogo', 'carrito']) {
          await page.goto(`${WEB}/${p}.php`);
          await page.waitForLoadState('networkidle');
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          ctx.check(`${w}px ${p}: sin desborde horizontal`, 0, overflow, overflow <= 0);
          await ctx.shotFull(page, `${w}px-${p}`, `${p}.php a ${w}px (página completa)`);
          if (p === 'index') ctx.check(`${w}px: botón de menú visible`, w < 992, await page.locator('.navbar-toggler').isVisible());
          if (p === 'catalogo') {
            const cols = await page.evaluate(() => {
              const items = [...document.querySelectorAll('[data-testid=product-grid] > .col')];
              return items.length ? items.filter((i) => i.getBoundingClientRect().top === items[0].getBoundingClientRect().top).length : 0;
            });
            ctx.check(`${w}px: columnas del catálogo`, expectedCols[w], cols);
          }
        }
        await context.close();
      }
    },
  },
];

// P29 se ejecuta al final: revisa las evidencias de la propia ejecución.
export const protection = {
  id: 'P29', flujo: 'Transversal', requisito: 'R11', criterio: 'CA29', tipo: 'control de protección', viewports: [],
  titulo: 'Las evidencias y logs de la ejecución no contienen secretos ni contraseñas',
  precondiciones: 'Todas las demás pruebas ejecutadas.',
  pasos: ['Obtener los valores secretos del entorno de prueba (.secrets)', 'Buscar cada valor en todos los archivos de texto de la ejecución (evidencias y logs)', 'Buscar patrones de JWT ("eyJ…") en las evidencias'],
  esperado: '0 coincidencias.',
  verificacion: 'Reporte de búsqueda (sin imprimir los valores).',
  restauracion: 'No requiere.',
  async run(ctx, env) {
    const secrets = allSecretValues();
    const files = [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(json|jsonl|log|md|txt)$/.test(e.name) && files.push(path.join(d, e.name))));
    walk(env.runDir);
    let hits = 0;
    let jwt = 0;
    for (const f of files) {
      const t = fs.readFileSync(f, 'utf8');
      for (const s of secrets) if (t.includes(s)) hits++;
      if (/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./.test(t)) jwt++;
    }
    ctx.saveJson('busqueda', { archivosRevisados: files.length, valoresBuscados: secrets.length, coincidencias: hits, archivosConJwt: jwt }, 'Resultado de la búsqueda de secretos');
    ctx.check('valores secretos en evidencias', 0, hits);
    ctx.check('tokens JWT en evidencias', 0, jwt);
  },
};
void crypto;
