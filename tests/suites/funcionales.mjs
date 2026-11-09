// Pruebas de flujos funcionales (catálogo, identidad, compra, pago, pedidos).
// Cada prueba declara su ficha (Etapa 2) y su procedimiento ejecutable.
import crypto from 'node:crypto';
import { WEB, SANDBOX, Blocked } from '../lib/harness.mjs';
import { createOrderApi, payApi, stockOf, waitFor, buyUi, DIR_A } from '../lib/flows.mjs';

const Q_PEDIDO = 'query($id: ID!){ pedido(id:$id){ id estado total completo items{ nombre cantidad producto{ nombre } } pago{ estado monto } cliente{ nombre } } }';

export default [
  {
    id: 'P01', flujo: 'F01', requisito: 'R01', criterio: 'CA01', critico: 'C1', tipo: 'éxito', viewports: ['escritorio', 'movil'],
    titulo: 'Consultar catálogo desde el frontend con datos reales de inventory',
    precondiciones: 'Datos semilla (9 productos, 9 activos). Visitante anónimo. inventory disponible.',
    pasos: ['Abrir /catalogo.php', 'Esperar la grilla de productos', 'Leer cantidad de tarjetas y precio de "Choco Miau"', 'Consultar GET /api/v1/products con un cliente API independiente', 'Repetir en móvil'],
    esperado: 'La grilla muestra la misma cantidad de productos que devuelve inventory y el precio de Choco Miau ($3.990) coincide; la solicitud pasa por el API Gateway (ruta GW01) con correlación registrada en gateway e inventory.',
    verificacion: 'Captura + red del navegador + respuesta de cliente API + traza backend por X-Correlation-Id.',
    restauracion: 'Solo lectura; no requiere.',
    async run(ctx) {
      const api = await ctx.api('/products');
      for (const vp of this.viewports) {
        const page = await ctx.page(vp);
        await page.goto(`${WEB}/catalogo.php`);
        await page.locator('[data-testid=product-grid]').waitFor();
        const cards = await page.locator('[data-testid=product-grid] .product-card').count();
        const price = await page.locator('[data-product-id="p-002"] [data-testid=price]').textContent();
        await ctx.shot(page, 'catalogo', 'Catálogo cargado desde inventory');
        ctx.check(`[${vp}] tarjetas en pantalla = productos de la API`, api.data.total, cards);
        ctx.check(`[${vp}] precio Choco Miau en pantalla`, '$3.990', price.trim());
      }
      ctx.check('API devuelve solo campos públicos (sin sku/activo)', false, Object.keys(api.data.data[0]).some((k) => ['sku', 'activo', 'updated_at'].includes(k)));
    },
  },
  {
    id: 'P02', flujo: 'F01', requisito: 'R01', criterio: 'CA02', critico: 'C1', tipo: 'límite', viewports: ['escritorio'],
    titulo: 'Filtro por categoría y búsqueda sin resultados (estado vacío)',
    precondiciones: 'Datos semilla. Visitante anónimo.',
    pasos: ['Abrir /catalogo.php?categoria=Bombones', 'Contar tarjetas', 'Buscar "zzzz" en el campo de búsqueda', 'Observar estado vacío', 'Consultar GET /products?categoria=Inválida'],
    esperado: 'Bombones muestra 2 productos; búsqueda sin coincidencias muestra estado vacío con acción "Limpiar filtros"; una categoría inválida es rechazada con 400 por inventory.',
    verificacion: 'Capturas + red + respuesta 400 del cliente API.',
    restauracion: 'No requiere.',
    async run(ctx) {
      const page = await ctx.page('escritorio');
      await page.goto(`${WEB}/catalogo.php?categoria=Bombones`);
      await page.locator('[data-testid=product-grid]').waitFor();
      ctx.check('tarjetas en categoría Bombones', 2, await page.locator('[data-testid=product-grid] .product-card').count());
      await page.locator('#buscar').fill('zzzz');
      await page.locator('[data-state=empty]').waitFor();
      ctx.check('estado vacío visible', true, await page.locator('[data-state=empty]').isVisible());
      await ctx.shot(page, 'vacio', 'Estado vacío al buscar sin coincidencias');
      const bad = await ctx.api('/products?categoria=Inventada');
      ctx.check('categoría inválida rechazada', 400, bad.status);
    },
  },
  {
    id: 'P03', flujo: 'F01', requisito: 'R12', criterio: 'CA03', critico: 'C1', tipo: 'fallo y recuperación', viewports: ['escritorio'],
    titulo: 'inventory indisponible: mensaje comprensible y recuperación con "Reintentar"',
    precondiciones: 'Sistema completo en ejecución. Se detiene el proceso inventory (fallo controlado).',
    pasos: ['Detener inventory', 'Abrir /catalogo.php', 'Observar estado de error', 'Reiniciar inventory', 'Pulsar "Reintentar"'],
    esperado: 'Con inventory detenido la pantalla muestra "El servicio no está disponible…" con referencia de correlación (HTTP 503 SERVICE_UNAVAILABLE), sin datos falsos; tras reiniciar, "Reintentar" carga la grilla.',
    verificacion: 'Capturas antes/después + red (503 y luego 200) + traza gateway (downstream_failure).',
    restauracion: 'inventory reiniciado al final de la prueba (también en caso de error).',
    async run(ctx, env) {
      await env.stack.stop('inventory');
      try {
        const page = await ctx.page('escritorio');
        await page.goto(`${WEB}/catalogo.php`);
        const err = page.locator('#catalogo [data-state=error]');
        await err.waitFor();
        ctx.check('código de error presentado', 'SERVICE_UNAVAILABLE', await err.getAttribute('data-code'));
        ctx.check('referencia de correlación visible', true, await err.locator('.ref-code').isVisible());
        ctx.check('no se muestran productos', 0, await page.locator('.product-card').count());
        await ctx.shot(page, 'error', 'Catálogo con inventory detenido');
        await env.stack.start('inventory');
        await err.locator('[data-testid=retry]').click();
        await page.locator('[data-testid=product-grid]').waitFor();
        ctx.check('recupera la grilla tras reintentar', true, (await page.locator('.product-card').count()) > 0);
        await ctx.shot(page, 'recuperado', 'Catálogo recuperado tras reiniciar inventory');
      } finally {
        await env.stack.start('inventory');
      }
    },
  },
  {
    id: 'P04', flujo: 'F03', requisito: 'R02', criterio: 'CA04', tipo: 'éxito', viewports: ['escritorio'],
    titulo: 'Registro de cuenta desde el frontend y persistencia en auth y clients',
    precondiciones: 'Correo no registrado (generado por ejecución).',
    pasos: ['Abrir inicio, menú de usuario → Crear cuenta', 'Completar nombre, correo y contraseña válida', 'Enviar', 'En sesión nueva (cliente API) iniciar sesión con la cuenta', 'Leer perfil GET /me/profile', 'Inspeccionar auth.db (hash) y clients.db (perfil)'],
    esperado: 'La interfaz confirma la cuenta y muestra el nombre en el menú; un login independiente funciona; auth guarda hash scrypt (no la contraseña) y clients guarda el perfil con el mismo id.',
    verificacion: 'Captura + red + login independiente + lectura SQLite de solo lectura.',
    restauracion: 'La cuenta queda creada; el reinicio de datos (base nueva por ejecución) la elimina.',
    async run(ctx) {
      const email = `nueva.${Date.now()}@chocomania.test`;
      const password = `Prueba${crypto.randomBytes(4).toString('hex')}9`;
      const page = await ctx.page('escritorio');
      await page.goto(`${WEB}/index.php`);
      await page.locator('[data-testid=user-menu]').click();
      await page.getByRole('button', { name: 'Crear cuenta' }).first().click();
      await page.locator('#regNombre').fill('Carla Prueba (ficticia)');
      await page.locator('#regEmail').fill(email);
      await page.locator('#regPassword').fill(password);
      await page.locator('[data-testid=register-submit]').click();
      await page.locator('#authModal').waitFor({ state: 'hidden' });
      await page.locator('[data-testid=user-menu]').click();
      ctx.check('nombre visible en el menú', 'Carla Prueba (ficticia)', (await page.locator('[data-testid=user-name]').textContent()).trim());
      await ctx.shot(page, 'registrado', 'Sesión iniciada tras el registro');
      const tok = await ctx.login({ email, password });
      const prof = await ctx.api('/me/profile', { token: tok });
      ctx.check('perfil disponible en clients', 200, prof.status);
      const u = ctx.db('auth').prepare('SELECT id, password_hash, role FROM users WHERE email = ?').get(email);
      ctx.check('auth guarda hash scrypt, no la contraseña', true, Boolean(u && u.password_hash.startsWith('scrypt$') && !u.password_hash.includes(password)));
      ctx.check('rol asignado por el servidor', 'CLIENTE', u && u.role);
      const c = ctx.db('clients').prepare('SELECT id FROM clients WHERE email = ?').get(email);
      ctx.check('clients usa el mismo id que auth', u && u.id, c && c.id);
      ctx.saveJson('persistencia', { usuario: { id: u.id, role: u.role, hashAlgoritmo: u.password_hash.split('$')[0] }, perfil: { id: c.id } }, 'Lectura SQLite de auth.db y clients.db (sin hash ni contraseña)');
    },
  },
  {
    id: 'P05', flujo: 'F03', requisito: 'R02', criterio: 'CA05', tipo: 'rechazo', viewports: ['escritorio'],
    titulo: 'Credenciales inválidas y contraseña débil',
    precondiciones: 'Cuenta semilla clienteA existente.',
    pasos: ['Intentar login en la interfaz con contraseña errónea', 'Observar mensaje', 'POST /auth/register con contraseña "abc" (cliente API)', 'POST /auth/register con correo existente'],
    esperado: 'Mensaje genérico "Correo o contraseña incorrectos" (401) sin token; registro débil 400 VALIDATION_ERROR; correo existente 409.',
    verificacion: 'Captura + red + respuestas API.',
    restauracion: 'Un intento fallido queda contado (se reinicia al siguiente login correcto).',
    async run(ctx) {
      const page = await ctx.page('escritorio');
      await page.goto(`${WEB}/index.php`);
      await page.locator('[data-testid=user-menu]').click();
      await page.locator('[data-testid=menu-login]').click();
      await page.locator('#loginEmail').fill(ctx.seed.clienteA.email);
      await page.locator('#loginPassword').fill('incorrecta-123');
      await page.locator('[data-testid=login-submit]').click();
      const msg = page.locator('#loginForm .form-msg [data-kind=danger]');
      await msg.waitFor();
      ctx.check('mensaje genérico', true, (await msg.textContent()).includes('Correo o contraseña incorrectos'));
      ctx.check('no se guarda sesión', null, await page.evaluate(() => sessionStorage.getItem('choco.session')));
      await ctx.shot(page, 'login-fallido', 'Login con contraseña incorrecta');
      const weak = await ctx.api('/auth/register', { method: 'POST', body: { nombre: 'X Y', email: `debil.${Date.now()}@chocomania.test`, password: 'abc' } });
      ctx.check('contraseña débil rechazada', 400, weak.status);
      const dup = await ctx.api('/auth/register', { method: 'POST', body: { nombre: 'Dup', email: ctx.seed.clienteA.email, password: 'Valida12345' } });
      ctx.check('correo duplicado rechazado', 409, dup.status);
      await ctx.login(ctx.seed.clienteA); // restablece el contador de intentos
    },
  },
  {
    id: 'P06', flujo: 'F04-F05', requisito: 'R03,R04', criterio: 'CA06', critico: 'C2', tipo: 'éxito', viewports: ['escritorio', 'movil'],
    titulo: 'Compra completa: carrito → pedido → pago aprobado en sandbox → PAGADO',
    precondiciones: 'clienteA; stock de Choco Miau (p-002) ≥ 2; payments y sandbox disponibles (sandbox = doble de prueba declarado).',
    pasos: ['Abrir catálogo e iniciar sesión como clienteA', 'Cantidad 2 en Choco Miau → Agregar', 'Ir al carrito, completar despacho', 'Confirmar pedido y pagar', 'En la pasarela sandbox verificar monto y aprobar', 'Volver a Mis pedidos y esperar confirmación', 'Verificar en sesión nueva (GraphQL) y en SQLite de orders, payments e inventory'],
    esperado: 'Monto en pasarela $11.970 (2×3.990 + despacho 3.990, calculado por el servidor); la interfaz muestra "¡Pago confirmado!"; consulta independiente: pedido PAGADO, pago APROBADO; stock de p-002 disminuye exactamente 2 y la reserva queda CONFIRMADA.',
    verificacion: 'Capturas por paso + red (POST /orders, POST /payments, webhook) + traza por correlación + consulta GraphQL en sesión nueva + lectura SQLite.',
    restauracion: 'Base nueva por ejecución (scripts/reset-data.js).',
    async run(ctx) {
      for (const vp of this.viewports) {
        const before = await stockOf(ctx, 'p-002');
        const page = await ctx.page(vp);
        await buyUi(ctx, page, ctx.seed.clienteA, 'p-002', 2);
        ctx.check(`[${vp}] total estimado en carrito`, '$11.970', (await page.locator('[data-testid=cart-total]').textContent()).trim());
        await ctx.shot(page, 'carrito', 'Carrito con 2 Choco Miau');
        await page.locator('[data-testid=checkout-submit]').click();
        await page.waitForURL(/:8090\/checkout\//);
        ctx.check(`[${vp}] monto informado por el proveedor`, '$11.970 CLP', (await page.locator('[data-testid=sandbox-amount]').textContent()).trim());
        await ctx.shot(page, 'pasarela', 'Pasarela sandbox con monto calculado por el servidor');
        await page.locator('[data-testid=sandbox-approve]').click();
        await page.waitForURL(/pedidos\.php\?pedido=/);
        const result = page.locator('[data-testid=payment-result]');
        await result.waitFor({ timeout: 12000 });
        ctx.check(`[${vp}] la interfaz informa pago aprobado`, 'approved', await result.getAttribute('data-result'));
        await ctx.shot(page, 'confirmado', 'Pedido confirmado en Mis pedidos');
        const pedidoId = new URL(page.url()).searchParams.get('pedido');
        ctx.note(`[${vp}] pedido ${pedidoId}`);
        // Verificación independiente de la pantalla que ejecutó la acción.
        const tok = await ctx.login(ctx.seed.clienteA);
        const g = await ctx.api('/graphql', { method: 'POST', token: tok, body: { query: Q_PEDIDO, variables: { id: pedidoId } } });
        const p = g.data && g.data.data && g.data.data.pedido;
        ctx.check(`[${vp}] GraphQL (sesión nueva): estado`, 'PAGADO', p && p.estado);
        ctx.check(`[${vp}] GraphQL: pago`, 'APROBADO', p && p.pago && p.pago.estado);
        ctx.check(`[${vp}] GraphQL: total`, 11970, p && p.total);
        const o = ctx.db('orders').prepare('SELECT estado, total, payment_id FROM orders WHERE id = ?').get(pedidoId);
        const pay = ctx.db('payments').prepare('SELECT estado, monto FROM payments WHERE id = ?').get(o && o.payment_id);
        const res = ctx.db('inventory').prepare('SELECT estado, cantidad FROM reservations WHERE order_id = ?').get(pedidoId);
        ctx.check(`[${vp}] orders.db estado`, 'PAGADO', o && o.estado);
        ctx.check(`[${vp}] payments.db estado y monto`, ['APROBADO', 11970], pay && [pay.estado, pay.monto]);
        ctx.check(`[${vp}] inventory.db reserva`, ['CONFIRMADA', 2], res && [res.estado, res.cantidad]);
        ctx.check(`[${vp}] stock p-002 disminuye en 2`, before - 2, await stockOf(ctx, 'p-002'));
        ctx.saveJson(`persistencia-${vp}`, { pedidoId, orders: o, payments: pay, reserva: res, graphql: p }, `Comprobación independiente (${vp})`);
      }
    },
  },
  {
    id: 'P07', flujo: 'F04', requisito: 'R03', criterio: 'CA07', critico: 'C2', tipo: 'rechazo / límite', viewports: ['escritorio'],
    titulo: 'Stock insuficiente: el servidor rechaza y no crea pedido ni descuenta stock',
    precondiciones: 'Mezcla Chocolate Caliente (p-008) con stock 3. Carrito local con 5 unidades (carrito desactualizado; la UI limita a 3, por eso se precarga en localStorage).',
    pasos: ['Iniciar sesión como clienteB', 'Precargar carrito {p-008: 5}', 'Abrir carrito, completar despacho y confirmar'],
    esperado: 'HTTP 409 STOCK_INSUFICIENTE; mensaje "No hay stock suficiente…" con detalle disponible=3; no se crea pedido para clienteB y el stock sigue en 3.',
    verificacion: 'Captura + red + conteo SQLite de pedidos de clienteB + stock vía API.',
    restauracion: 'No modifica datos.',
    async run(ctx) {
      const before = await stockOf(ctx, 'p-008');
      const count = () => ctx.db('orders').prepare('SELECT COUNT(*) AS n FROM orders WHERE client_id = ?').get('00000000-0000-4000-8000-0000000000b2').n;
      const n0 = count();
      const page = await ctx.page('escritorio');
      await page.goto(`${WEB}/index.php`);
      await ctx.loginUi(page, ctx.seed.clienteB);
      await page.evaluate(() => localStorage.setItem('choco.cart', JSON.stringify([{ productId: 'p-008', cantidad: 5 }])));
      await page.goto(`${WEB}/carrito.php`);
      await page.locator('.cart-line[data-product-id="p-008"]').waitFor();
      await page.locator('#direccion').fill(DIR_A);
      await page.locator('#comuna').fill('Ñuñoa');
      await page.locator('[data-testid=checkout-submit]').click();
      const msg = page.locator('#checkoutForm .form-msg [data-kind=danger]');
      await msg.waitFor();
      ctx.check('mensaje de stock insuficiente', true, (await msg.textContent()).includes('No hay stock suficiente'));
      await ctx.shot(page, 'sin-stock', 'Rechazo por stock insuficiente');
      ctx.check('no se crea pedido', n0, count());
      ctx.check('stock sin cambios', before, await stockOf(ctx, 'p-008'));
    },
  },
  {
    id: 'P08', flujo: 'F04', requisito: 'R03', criterio: 'CA08', critico: 'C2', tipo: 'recuperación (reintento)', viewports: ['escritorio'],
    titulo: 'Reintento tras perder la respuesta de POST /orders no duplica el pedido',
    precondiciones: 'clienteB; Tableta 70% (p-007) con stock ≥ 1. Se intercepta la primera respuesta de POST /orders en el navegador: el servidor la procesa pero el navegador recibe un error de red (fallo controlado).',
    pasos: ['Iniciar sesión y agregar 1 Tableta 70%', 'Confirmar pedido (la respuesta se pierde)', 'Observar mensaje de error de red', 'Pulsar nuevamente "Confirmar pedido y pagar"'],
    esperado: 'El segundo intento reutiliza la misma Idempotency-Key: el gateway responde 200 con idempotent-replay=true y el mismo pedido; existe un único pedido nuevo y el stock baja una sola vez.',
    verificacion: 'Red (dos POST con la misma clave) + traza (order_created una vez, order_replay una vez) + SQLite.',
    restauracion: 'Base nueva por ejecución.',
    async run(ctx) {
      const before = await stockOf(ctx, 'p-007');
      const ordersOf = () => ctx.db('orders').prepare("SELECT o.id FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.client_id = ? AND i.product_id = 'p-007'").all('00000000-0000-4000-8000-0000000000b2').length;
      const n0 = ordersOf();
      const page = await ctx.page('escritorio');
      await buyUi(ctx, page, ctx.seed.clienteB, 'p-007', 1);
      let first = true;
      const keys = [];
      await page.route('**/api/v1/orders', async (route) => {
        keys.push(route.request().headers()['idempotency-key']);
        if (first && route.request().method() === 'POST') {
          first = false;
          await route.fetch(); // el servidor procesa la solicitud…
          return route.abort('connectionreset'); // …pero el navegador no recibe la respuesta
        }
        return route.continue();
      });
      await page.locator('[data-testid=checkout-submit]').click();
      const err = page.locator('#checkoutForm .form-msg [data-kind=danger]');
      await err.waitFor();
      await ctx.shot(page, 'respuesta-perdida', 'Error de red tras el primer envío');
      await page.locator('[data-testid=checkout-submit]').click();
      await page.waitForURL(/:8090\/checkout\//);
      await ctx.shot(page, 'pasarela', 'El reintento continúa al pago');
      ctx.check('misma Idempotency-Key en ambos intentos', true, keys.length >= 2 && keys[0] === keys[1]);
      ctx.check('un único pedido nuevo', n0 + 1, ordersOf());
      ctx.check('stock descontado una vez', before - 1, await stockOf(ctx, 'p-007'));
    },
  },
  {
    id: 'P09', flujo: 'F04-F05', requisito: 'R03,R04,R11', criterio: 'CA09', tipo: 'rechazo', viewports: [],
    titulo: 'Datos alterados por el navegador: precio, monto y estado de pago no son confiables',
    precondiciones: 'clienteA con sesión (cliente API, equivalente a modificar la solicitud desde las herramientas del navegador).',
    pasos: ['POST /orders con items[].precio = 1', 'POST /payments con monto = 1', 'PUT /admin/orders/{id}/status {estado: PAGADO} como cliente', 'Consultar el pedido'],
    esperado: 'El total del pedido usa el precio de inventory (2×3.990+3.990 = 11.970); monto en POST /payments → 400 (campo no permitido); cambio de estado → 403; el pedido sigue PENDIENTE_PAGO.',
    verificacion: 'Respuestas API + SQLite orders.',
    restauracion: 'Deja un pedido PENDIENTE_PAGO (base nueva por ejecución).',
    async run(ctx) {
      const tok = await ctx.login(ctx.seed.clienteA);
      const r = await ctx.api('/orders', { method: 'POST', token: tok, headers: { 'idempotency-key': crypto.randomUUID() }, body: { items: [{ productId: 'p-003', cantidad: 2, precio: 1, precioUnitario: 1 }], despacho: { direccion: DIR_A, comuna: 'Providencia' } } });
      ctx.check('pedido creado con precio del servidor', [201, 11970], [r.status, r.data && r.data.data && r.data.data.total]);
      const id = r.data.data.id;
      const p = await ctx.api('/payments', { method: 'POST', token: tok, body: { pedidoId: id, monto: 1 } });
      ctx.check('monto enviado por el navegador rechazado', 400, p.status);
      const s = await ctx.api(`/admin/orders/${id}/status`, { method: 'PUT', token: tok, body: { estado: 'PAGADO' } });
      ctx.check('cliente no puede marcar PAGADO', 403, s.status);
      ctx.check('pedido sigue pendiente', 'PENDIENTE_PAGO', ctx.db('orders').prepare('SELECT estado FROM orders WHERE id = ?').get(id).estado);
    },
  },
  {
    id: 'P10', flujo: 'F05', requisito: 'R04', criterio: 'CA10', critico: 'C2', tipo: 'rechazo y recuperación', viewports: ['escritorio'],
    titulo: 'Pago rechazado por el proveedor y nuevo intento aprobado',
    precondiciones: 'clienteB; Flor de Chocolate (p-004) con stock.',
    pasos: ['Comprar 1 Flor de Chocolate desde la interfaz', 'En la pasarela pulsar "Rechazar pago"', 'Observar resultado en Mis pedidos', 'Pulsar "Pagar ahora" y aprobar'],
    esperado: 'Tras el rechazo la interfaz informa "El pago fue rechazado"; pedido PENDIENTE_PAGO y pago RECHAZADO en la base; tras el nuevo intento el pedido queda PAGADO con un segundo pago APROBADO.',
    verificacion: 'Capturas + red + SQLite payments/orders.',
    restauracion: 'Base nueva por ejecución.',
    async run(ctx) {
      const page = await ctx.page('escritorio');
      await buyUi(ctx, page, ctx.seed.clienteB, 'p-004', 1);
      await page.locator('[data-testid=checkout-submit]').click();
      await page.waitForURL(/:8090\/checkout\//);
      await page.locator('[data-testid=sandbox-reject]').click();
      await page.waitForURL(/pedidos\.php/);
      const result = page.locator('[data-testid=payment-result]');
      await result.waitFor({ timeout: 12000 });
      ctx.check('interfaz informa rechazo', 'rejected', await result.getAttribute('data-result'));
      await ctx.shot(page, 'rechazado', 'Pago rechazado');
      const id = new URL(page.url()).searchParams.get('pedido');
      ctx.check('pedido sigue PENDIENTE_PAGO', 'PENDIENTE_PAGO', ctx.db('orders').prepare('SELECT estado FROM orders WHERE id = ?').get(id).estado);
      ctx.check('pago RECHAZADO registrado', ['RECHAZADO'], ctx.db('payments').prepare('SELECT estado FROM payments WHERE order_id = ?').all(id).map((r) => r.estado));
      await page.locator('[data-testid=pay-order]').click();
      await page.waitForURL(/:8090\/checkout\//);
      await page.locator('[data-testid=sandbox-approve]').click();
      await page.waitForURL(/pedidos\.php/);
      await page.locator('[data-testid=payment-result][data-result=approved]').waitFor({ timeout: 12000 });
      await ctx.shot(page, 'aprobado', 'Segundo intento aprobado');
      ctx.check('pedido PAGADO', 'PAGADO', ctx.db('orders').prepare('SELECT estado FROM orders WHERE id = ?').get(id).estado);
      ctx.check('historial de pagos', ['APROBADO', 'RECHAZADO'], ctx.db('payments').prepare('SELECT estado FROM payments WHERE order_id = ? ORDER BY estado').all(id).map((r) => r.estado));
    },
  },
  {
    id: 'P11', flujo: 'F05', requisito: 'R04,R11', criterio: 'CA11', tipo: 'rechazo / duplicado', viewports: [],
    titulo: 'Notificación duplicada del proveedor y notificación con firma inválida',
    precondiciones: 'Pedido de clienteB pagado mediante el sandbox (precondición por API).',
    pasos: ['Crear pedido y aprobar el pago en el sandbox', 'Solicitar al sandbox reenviar el MISMO evento', 'Enviar al webhook una notificación con firma falsa'],
    esperado: 'El reenvío responde 200 con duplicado=true; webhook_events tiene un único registro y el historial del pedido una sola transición a PAGADO; firma falsa → 401 sin cambios.',
    verificacion: 'Respuestas + SQLite payments.webhook_events + orders.order_events + traza (webhook_duplicate).',
    restauracion: 'Base nueva por ejecución.',
    async run(ctx) {
      const tok = await ctx.login(ctx.seed.clienteB);
      const o = await createOrderApi(ctx, tok, [{ productId: 'p-003', cantidad: 1 }]);
      const { payment, sessionPath } = await payApi(ctx, tok, o.id, 'approve');
      await waitFor(() => ctx.db('orders').prepare('SELECT estado FROM orders WHERE id = ?').get(o.id).estado === 'PAGADO');
      const re = await ctx.api(`${sessionPath}/resend`, { method: 'POST', base: SANDBOX });
      ctx.check('sandbox reenvía el evento', 200, re.status);
      ctx.check('eventos registrados para el pago', 1, ctx.db('payments').prepare('SELECT COUNT(*) AS n FROM webhook_events WHERE payment_id = ?').get(payment.id).n);
      ctx.check('transiciones a PAGADO', 1, ctx.db('orders').prepare("SELECT COUNT(*) AS n FROM order_events WHERE order_id = ? AND hacia = 'PAGADO'").get(o.id).n);
      const forged = JSON.stringify({ id: `evt_${crypto.randomUUID()}`, type: 'checkout.session.approved', data: { reference: payment.id, session_id: 'cs_test_x', amount: 1, currency: 'CLP' } });
      const f = await ctx.api('/webhooks/payments', { method: 'POST', raw: forged, headers: { 'content-type': 'application/json', 'x-sandbox-signature': `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}` } });
      ctx.check('firma falsa rechazada', 401, f.status);
    },
  },
  {
    id: 'P12', flujo: 'F06', requisito: 'R05', criterio: 'CA12', critico: 'C3', tipo: 'éxito', viewports: ['escritorio', 'movil'],
    titulo: 'Mis pedidos: agregación GraphQL (orders + inventory + payments + clients) en pantalla real',
    precondiciones: 'clienteA con un pedido pagado creado en la prueba (por API).',
    pasos: ['Crear pedido (2 Bombones) y aprobar pago (precondición)', 'Abrir /pedidos.php?pedido={id} con sesión de clienteA', 'Leer total, estados y titular', 'Comparar con GET /orders/{id} (REST) y con la traza del backend'],
    esperado: 'La pantalla muestra total $29.970 (2×12.990 + despacho 3.990), estado Pagado, pago aprobado y titular "Ana Pérez (ficticia)"; coincide con orders; la traza muestra que, con el mismo identificador de correlación, el gateway validó la sesión en auth y graphql consultó orders, inventory, payments y clients.',
    verificacion: 'Capturas + red (POST /graphql) + REST independiente + traza backend.',
    restauracion: 'Base nueva por ejecución.',
    async run(ctx) {
      const tok = await ctx.login(ctx.seed.clienteA);
      const o = await createOrderApi(ctx, tok, [{ productId: 'p-005', cantidad: 2 }]);
      await payApi(ctx, tok, o.id, 'approve');
      await waitFor(() => ctx.db('orders').prepare('SELECT estado FROM orders WHERE id = ?').get(o.id).estado === 'PAGADO');
      const rest = await ctx.api(`/orders/${o.id}`, { token: tok });
      for (const vp of this.viewports) {
        const page = await ctx.page(vp);
        await page.goto(`${WEB}/index.php`);
        await ctx.loginUi(page, ctx.seed.clienteA);
        const gqlResp = page.waitForResponse((r) => r.url().endsWith('/graphql') && r.request().postData().includes('query Pedido'));
        await page.goto(`${WEB}/pedidos.php?pedido=${o.id}`);
        const resp = await gqlResp;
        const cid = resp.headers()['x-correlation-id'];
        await page.locator('[data-testid=order-total]').waitFor();
        ctx.check(`[${vp}] total en pantalla = orders`, `$${rest.data.data.total.toLocaleString('es-CL')}`, (await page.locator('[data-testid=order-total]').textContent()).trim());
        ctx.check(`[${vp}] estados visibles`, ['PAGADO', 'APROBADO'], await page.locator('#detallePedido [data-estado]').evaluateAll((n) => n.map((x) => x.dataset.estado)));
        ctx.check(`[${vp}] titular desde clients`, true, (await page.locator('#detallePedido').textContent()).includes('Ana Pérez (ficticia)'));
        await ctx.shot(page, 'detalle', 'Detalle agregado del pedido');
        await new Promise((r) => setTimeout(r, 400));
        const svcs = [...new Set(ctx.trace(cid).map((l) => JSON.parse(l).svc))].sort();
        ctx.check(`[${vp}] servicios en la traza de la consulta GraphQL (cid ${cid.slice(0, 8)})`, ['auth', 'clients', 'gateway', 'graphql', 'inventory', 'orders', 'payments'], svcs);
      }
      ctx.check('total REST', 29970, rest.data.data.total);
    },
  },
];
