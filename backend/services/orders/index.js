'use strict';
// orders (privado): creación y ciclo de vida de pedidos.
// Reglas: el precio lo decide inventory; el pago lo confirma únicamente payments;
// el cliente solo ve y cancela sus propios pedidos; las transiciones están acotadas.
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../../lib/boot');
const { createService, HttpError, UUID_RE } = require('../../lib/http');
const { openDatabase, tx } = require('../../lib/db');
const { v } = require('../../lib/validate');

const NAME = 'orders';
const COSTO_DESPACHO = 3990;
const DESPACHO_GRATIS_DESDE = 50000;
const PAGADOS = ['PAGADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO'];
// Transiciones que puede ejecutar ADMIN. PAGADO solo lo asigna payments.
const ADMIN_TRANSITIONS = {
  PENDIENTE_PAGO: ['CANCELADO'],
  PAGADO: ['EN_PREPARACION'],
  EN_PREPARACION: ['DESPACHADO'],
  DESPACHADO: ['ENTREGADO'],
};

async function main() {
  const { logger, keyFor, client } = await boot({ name: NAME, inbound: ['gateway', 'graphql', 'payments'], outbound: ['inventory'] });
  const db = openDatabase(NAME, path.join(__dirname, 'migrations'));
  const now = () => new Date().toISOString();

  const getOrder = db.prepare('SELECT * FROM orders WHERE id = ?');
  const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY nombre');
  const getEvents = db.prepare('SELECT desde, hacia, actor, nota, created_at FROM order_events WHERE order_id = ? ORDER BY id');
  const addEvent = db.prepare('INSERT INTO order_events (order_id, desde, hacia, actor, nota, created_at) VALUES (?,?,?,?,?,?)');

  function dto(o, viewer) {
    const isAdmin = viewer && viewer.role === 'ADMIN';
    return {
      id: o.id,
      clienteId: o.client_id,
      estado: o.estado,
      subtotal: o.subtotal,
      costoDespacho: o.costo_despacho,
      total: o.total,
      despacho: { direccion: o.direccion, comuna: o.comuna },
      notas: o.notas_cliente,
      ...(isAdmin ? { notasInternas: o.notas_internas } : {}),
      pagoId: o.payment_id,
      items: getItems.all(o.id).map((i) => ({ productoId: i.product_id, nombre: i.nombre, precioUnitario: i.precio_unitario, unidad: i.unidad, cantidad: i.cantidad, subtotal: i.precio_unitario * i.cantidad })),
      historial: getEvents.all(o.id).map((e) => ({ desde: e.desde, hacia: e.hacia, actor: e.actor, nota: e.nota, fecha: e.created_at })),
      creadoEn: o.created_at,
      actualizadoEn: o.updated_at,
    };
  }

  // Propiedad: un cliente solo accede a sus pedidos. Para recursos ajenos se responde 404
  // (igual que si no existiera) para no revelar la existencia de pedidos de otros clientes.
  function loadOwned(id, user) {
    const o = UUID_RE.test(id) ? getOrder.get(id) : null;
    if (!o || (user.role !== 'ADMIN' && o.client_id !== user.sub)) throw new HttpError(404, 'NOT_FOUND', 'Pedido no encontrado');
    return o;
  }

  function parseOrderInput(body) {
    v.object(body);
    v.allowedKeys(body, ['items', 'despacho', 'notas']);
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [{ field: 'items', message: 'Debe contener entre 1 y 20 productos' }]);
    }
    const seen = new Set();
    const items = body.items.map((it, i) => {
      v.object(it, `items[${i}]`);
      // Cualquier precio enviado por el navegador se ignora: solo se aceptan id y cantidad.
      const productId = v.string(it.productId, `items[${i}].productId`, { max: 40, pattern: /^[a-z0-9-]+$/ });
      const cantidad = v.int(it.cantidad, `items[${i}].cantidad`, { min: 1, max: 50 });
      if (seen.has(productId)) throw new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [{ field: `items[${i}].productId`, message: 'Producto repetido' }]);
      seen.add(productId);
      return { productId, cantidad };
    });
    const d = v.object(body.despacho, 'despacho');
    const direccion = v.string(d.direccion, 'despacho.direccion', { min: 5, max: 200 });
    const comuna = v.string(d.comuna, 'despacho.comuna', { min: 2, max: 60 });
    const notas = v.string(body.notas, 'notas', { min: 0, max: 300, optional: true });
    return { items, direccion, comuna, notas };
  }

  const routes = [
    {
      method: 'POST', path: '/orders', callers: ['gateway'], user: 'required',
      handler: async ({ body, user, cid, headers }) => {
        if (user.role !== 'CLIENTE') throw new HttpError(403, 'FORBIDDEN', 'Solo los clientes pueden crear pedidos');
        const key = headers['idempotency-key'];
        if (typeof key !== 'string' || !UUID_RE.test(key)) {
          throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Se requiere la cabecera Idempotency-Key (UUID)');
        }
        const input = parseOrderInput(body);
        const requestHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');

        // Paso 1: registrar la clave de idempotencia (o detectar reintento).
        const claim = tx(db, () => {
          const row = db.prepare('SELECT * FROM idempotency_keys WHERE client_id = ? AND key = ?').get(user.sub, key);
          if (row) {
            if (row.request_hash !== requestHash) return { conflict: 'IDEMPOTENCY_KEY_REUSED' };
            if (row.estado === 'COMPLETADA') return { replay: row.order_id };
            const stale = Date.now() - new Date(row.created_at).getTime() > 30_000;
            if (!stale) return { conflict: 'REQUEST_IN_PROGRESS' };
            return { orderId: row.order_id }; // reintento de una solicitud abandonada: misma reserva
          }
          const orderId = crypto.randomUUID();
          db.prepare("INSERT INTO idempotency_keys (client_id, key, request_hash, order_id, estado, created_at) VALUES (?,?,?,?,'PROCESANDO',?)").run(user.sub, key, requestHash, orderId, now());
          return { orderId };
        });
        if (claim.conflict === 'IDEMPOTENCY_KEY_REUSED') throw new HttpError(422, claim.conflict, 'La clave de idempotencia ya se usó con otro contenido');
        if (claim.conflict) throw new HttpError(409, claim.conflict, 'El pedido ya se está procesando');
        if (claim.replay) {
          logger.info('order_replay', { cid, orderId: claim.replay });
          return { status: 200, headers: { 'idempotent-replay': 'true' }, body: { data: dto(getOrder.get(claim.replay), user) } };
        }
        const orderId = claim.orderId;
        const forget = () => db.prepare('DELETE FROM idempotency_keys WHERE client_id = ? AND key = ? AND estado = ?').run(user.sub, key, 'PROCESANDO');

        // Paso 2: reservar stock en inventory (autoridad de precio y disponibilidad).
        let r;
        try {
          r = await client.call('inventory', 'POST', '/internal/reservations', { body: { orderId, items: input.items }, user, cid, timeoutMs: 3000 });
        } catch (err) {
          forget();
          // La respuesta pudo perderse con la reserva hecha: se libera de forma preventiva.
          client.call('inventory', 'POST', `/internal/reservations/${orderId}/release`, { cid }).catch(() => logger.warn('release_pending', { cid, orderId }));
          throw new HttpError(503, 'INVENTARIO_NO_DISPONIBLE', 'No pudimos verificar el stock en este momento. Tu pedido no fue creado; intenta nuevamente.', { dependency: 'inventory' });
        }
        if (r.status !== 201 && r.status !== 200) {
          forget();
          const e = (r.data && r.data.error) || {};
          throw new HttpError(r.status === 409 || r.status === 422 ? r.status : 502, e.code || 'RESERVA_FALLIDA', e.message || 'No fue posible reservar el stock', e.details);
        }
        const lines = r.data.data.items;
        const subtotal = lines.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0);
        const costo = subtotal >= DESPACHO_GRATIS_DESDE ? 0 : COSTO_DESPACHO;

        // Paso 3: persistir pedido + ítems + historial y cerrar la clave de idempotencia.
        tx(db, () => {
          const ts = now();
          db.prepare(`INSERT INTO orders (id, client_id, estado, subtotal, costo_despacho, total, direccion, comuna, notas_cliente, created_at, updated_at)
                      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(orderId, user.sub, 'PENDIENTE_PAGO', subtotal, costo, subtotal + costo, input.direccion, input.comuna, input.notas, ts, ts);
          const insItem = db.prepare('INSERT INTO order_items (order_id, product_id, nombre, precio_unitario, unidad, cantidad) VALUES (?,?,?,?,?,?)');
          for (const l of lines) insItem.run(orderId, l.productId, l.nombre, l.precioUnitario, l.unidad, l.cantidad);
          addEvent.run(orderId, null, 'PENDIENTE_PAGO', 'cliente', null, ts);
          db.prepare("UPDATE idempotency_keys SET estado = 'COMPLETADA' WHERE client_id = ? AND key = ?").run(user.sub, key);
        });
        logger.info('order_created', { cid, orderId, total: subtotal + costo, items: lines.length });
        return { status: 201, body: { data: dto(getOrder.get(orderId), user) } };
      },
    },
    {
      method: 'GET', path: '/orders', callers: ['gateway', 'graphql'], user: 'required',
      handler: ({ user, query }) => {
        const limite = query.limite ? Number(query.limite) : 10;
        const desde = query.desde ? Number(query.desde) : 0;
        if (!Number.isInteger(limite) || limite < 1 || limite > 20 || !Number.isInteger(desde) || desde < 0) {
          throw new HttpError(400, 'VALIDATION_ERROR', 'Paginación inválida (limite 1..20, desde >= 0)');
        }
        const total = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE client_id = ?').get(user.sub).n;
        const rows = db.prepare('SELECT * FROM orders WHERE client_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(user.sub, limite, desde);
        return { body: { data: rows.map((o) => dto(o, user)), total, limite, desde } };
      },
    },
    {
      method: 'GET', path: '/orders/:id', callers: ['gateway', 'graphql'], user: 'required',
      handler: ({ params, user }) => ({ body: { data: dto(loadOwned(params.id, user), user) } }),
    },
    {
      method: 'POST', path: '/orders/:id/cancel', callers: ['gateway'], user: 'required',
      handler: async ({ params, user, cid }) => {
        const o = loadOwned(params.id, user);
        if (o.estado !== 'PENDIENTE_PAGO') throw new HttpError(409, 'TRANSICION_INVALIDA', `No se puede cancelar un pedido en estado ${o.estado}`);
        const r = await client.call('inventory', 'POST', `/internal/reservations/${o.id}/release`, { cid, user });
        if (r.status !== 200) throw new HttpError(502, 'LIBERACION_FALLIDA', 'No fue posible liberar el stock; el pedido no se canceló');
        const changed = tx(db, () => {
          const res = db.prepare("UPDATE orders SET estado = 'CANCELADO', updated_at = ? WHERE id = ? AND estado = 'PENDIENTE_PAGO'").run(now(), o.id);
          if (Number(res.changes) === 1) addEvent.run(o.id, 'PENDIENTE_PAGO', 'CANCELADO', user.role === 'ADMIN' ? 'admin' : 'cliente', null, now());
          return Number(res.changes);
        });
        if (!changed) throw new HttpError(409, 'TRANSICION_INVALIDA', 'El pedido cambió de estado mientras se cancelaba');
        logger.info('order_cancelled', { cid, orderId: o.id, by: user.role });
        return { body: { data: dto(getOrder.get(o.id), user) } };
      },
    },
    {
      method: 'GET', path: '/admin/orders', callers: ['gateway'], user: 'admin',
      handler: ({ query, user }) => {
        const args = [];
        let where = '';
        if (query.estado) {
          v.oneOf(query.estado, 'estado', ['PENDIENTE_PAGO', 'PAGADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO', 'CANCELADO']);
          where = 'WHERE estado = ?';
          args.push(query.estado);
        }
        const rows = db.prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT 100`).all(...args);
        return { body: { data: rows.map((o) => dto(o, user)) } };
      },
    },
    {
      method: 'PUT', path: '/admin/orders/:id/status', callers: ['gateway'], user: 'admin',
      handler: async ({ params, body, user, cid }) => {
        v.object(body);
        v.allowedKeys(body, ['estado', 'nota']);
        const estado = v.oneOf(body.estado, 'estado', ['PENDIENTE_PAGO', 'PAGADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO', 'CANCELADO']);
        const nota = v.string(body.nota, 'nota', { min: 0, max: 300, optional: true });
        const o = loadOwned(params.id, user);
        if (estado === 'PAGADO') throw new HttpError(422, 'TRANSICION_RESERVADA', 'El estado PAGADO solo puede asignarlo el sistema de pagos');
        if (!(ADMIN_TRANSITIONS[o.estado] || []).includes(estado)) throw new HttpError(409, 'TRANSICION_INVALIDA', `No se permite pasar de ${o.estado} a ${estado}`);
        if (estado === 'CANCELADO') {
          const r = await client.call('inventory', 'POST', `/internal/reservations/${o.id}/release`, { cid, user });
          if (r.status !== 200) throw new HttpError(502, 'LIBERACION_FALLIDA', 'No fue posible liberar el stock');
        }
        tx(db, () => {
          db.prepare('UPDATE orders SET estado = ?, notas_internas = COALESCE(?, notas_internas), updated_at = ? WHERE id = ?').run(estado, nota, now(), o.id);
          addEvent.run(o.id, o.estado, estado, 'admin', nota, now());
        });
        logger.info('order_status_changed', { cid, orderId: o.id, from: o.estado, to: estado });
        return { body: { data: dto(getOrder.get(o.id), user) } };
      },
    },
    // ---- Internas ----
    {
      method: 'GET', path: '/internal/orders/:id', callers: ['payments'], user: 'optional',
      handler: ({ params }) => {
        const o = UUID_RE.test(params.id) ? getOrder.get(params.id) : null;
        if (!o) throw new HttpError(404, 'NOT_FOUND', 'Pedido no encontrado');
        return { body: { data: { id: o.id, clienteId: o.client_id, estado: o.estado, total: o.total, pagoId: o.payment_id } } };
      },
    },
    {
      method: 'POST', path: '/internal/orders/:id/payment-confirmed', callers: ['payments'], user: 'none',
      handler: async ({ params, body, cid }) => {
        v.object(body);
        const paymentId = v.uuid(body.paymentId, 'paymentId');
        const monto = v.int(body.monto, 'monto', { min: 1 });
        const result = tx(db, () => {
          const o = getOrder.get(params.id);
          if (!o) throw new HttpError(404, 'NOT_FOUND', 'Pedido no encontrado');
          if (o.payment_id === paymentId && PAGADOS.includes(o.estado)) return { replay: true, o };
          if (o.estado !== 'PENDIENTE_PAGO') throw new HttpError(409, 'TRANSICION_INVALIDA', `El pedido está ${o.estado}`);
          if (monto !== o.total) throw new HttpError(409, 'MONTO_NO_COINCIDE', 'El monto pagado no coincide con el total del pedido');
          db.prepare("UPDATE orders SET estado = 'PAGADO', payment_id = ?, updated_at = ? WHERE id = ?").run(paymentId, now(), o.id);
          addEvent.run(o.id, 'PENDIENTE_PAGO', 'PAGADO', 'payments', null, now());
          return { replay: false, o };
        });
        if (!result.replay) {
          const r = await client.call('inventory', 'POST', `/internal/reservations/${params.id}/confirm`, { cid }).catch(() => null);
          if (!r || r.status !== 200) logger.warn('reservation_confirm_pending', { cid, orderId: params.id });
        }
        logger.info('order_paid', { cid, orderId: params.id, replay: result.replay });
        return { body: { data: { id: params.id, estado: 'PAGADO', replay: result.replay } } };
      },
    },
    {
      method: 'GET', path: '/internal/reports/sales', callers: ['graphql'], user: 'admin',
      handler: ({ query }) => {
        const dias = query.dias ? Number(query.dias) : 30;
        if (!Number.isInteger(dias) || dias < 1 || dias > 365) throw new HttpError(400, 'VALIDATION_ERROR', 'dias debe estar entre 1 y 365');
        const since = new Date(Date.now() - dias * 86400_000).toISOString();
        const marks = PAGADOS.map(() => '?').join(',');
        const pagados = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS ingresos FROM orders WHERE created_at >= ? AND estado IN (${marks})`).get(since, ...PAGADOS);
        const porEstado = db.prepare('SELECT estado, COUNT(*) AS n FROM orders WHERE created_at >= ? GROUP BY estado ORDER BY estado').all(since);
        const top = db.prepare(`SELECT i.product_id, i.nombre, SUM(i.cantidad) AS unidades, SUM(i.cantidad * i.precio_unitario) AS monto
                                FROM order_items i JOIN orders o ON o.id = i.order_id
                                WHERE o.created_at >= ? AND o.estado IN (${marks})
                                GROUP BY i.product_id, i.nombre ORDER BY unidades DESC LIMIT 5`).all(since, ...PAGADOS);
        return {
          body: {
            data: {
              dias, generadoEn: now(), pedidosPagados: pagados.n, ingresos: pagados.ingresos,
              porEstado: porEstado.map((r) => ({ estado: r.estado, cantidad: r.n })),
              topProductos: top.map((t) => ({ productoId: t.product_id, nombre: t.nombre, unidades: t.unidades, monto: t.monto })),
            },
          },
        };
      },
    },
  ];

  await createService({ name: NAME, port: Number(process.env.PORT || 7004), routes, keyFor, logger }).listen();
}

main().catch((err) => {
  console.error(`[${NAME}] error fatal de arranque:`, err.message);
  process.exit(1);
});
