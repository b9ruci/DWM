'use strict';
// payments (privado): inicia pagos con el proveedor, verifica sus notificaciones
// firmadas y comunica a orders la confirmación. El navegador nunca decide el monto
// ni el resultado del pago.
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../../lib/boot');
const { createService, HttpError, UUID_RE } = require('../../lib/http');
const { openDatabase } = require('../../lib/db');
const { v } = require('../../lib/validate');

const NAME = 'payments';
const SIGNATURE_TOLERANCE_S = 300;

async function main() {
  const { logger, keyFor, client, secrets } = await boot({ name: NAME, inbound: ['gateway', 'graphql'], outbound: ['orders'] });
  const providerKey = await secrets.get('payments/provider-api-key');
  const webhookSecret = await secrets.get('payments/webhook-signing-secret');
  const providerUrl = process.env.PAYMENT_PROVIDER_URL || 'http://127.0.0.1:8090';
  const returnUrl = process.env.PAYMENTS_RETURN_URL || 'http://localhost:8000/pedidos.php';
  const webhookUrl = process.env.PAYMENTS_WEBHOOK_URL || 'http://127.0.0.1:8080/api/v1/webhooks/payments';
  const db = openDatabase(NAME, path.join(__dirname, 'migrations'));
  const now = () => new Date().toISOString();

  const getPayment = db.prepare('SELECT * FROM payments WHERE id = ?');
  const dto = (p) => ({ id: p.id, pedidoId: p.order_id, monto: p.monto, estado: p.estado, checkoutUrl: p.estado === 'PENDIENTE' ? p.checkout_url : null, creadoEn: p.created_at, actualizadoEn: p.updated_at });

  function verifySignature(header, raw) {
    if (typeof header !== 'string') return false;
    const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')));
    const t = Number(parts.t);
    if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > SIGNATURE_TOLERANCE_S) return false;
    const expected = crypto.createHmac('sha256', webhookSecret).update(`${t}.`).update(raw).digest();
    const given = Buffer.from(parts.v1 || '', 'hex');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  }

  const routes = [
    {
      method: 'POST', path: '/payments', callers: ['gateway'], user: 'required',
      handler: async ({ body, user, cid }) => {
        v.object(body);
        // Solo se acepta el identificador del pedido: monto, estado o moneda enviados por el
        // navegador se rechazan explícitamente.
        v.allowedKeys(body, ['pedidoId']);
        const pedidoId = v.uuid(body.pedidoId, 'pedidoId');
        const r = await client.call('orders', 'GET', `/internal/orders/${pedidoId}`, { cid });
        if (r.status === 404 || (r.status === 200 && r.data.data.clienteId !== user.sub)) throw new HttpError(404, 'NOT_FOUND', 'Pedido no encontrado');
        if (r.status !== 200) throw new HttpError(502, 'ORDERS_ERROR', 'No fue posible consultar el pedido');
        const order = r.data.data;
        if (order.estado !== 'PENDIENTE_PAGO') throw new HttpError(409, 'PEDIDO_NO_PAGABLE', `El pedido está ${order.estado}`);

        // Idempotencia: un pedido tiene a lo más un pago PENDIENTE vigente.
        const existing = db.prepare("SELECT * FROM payments WHERE order_id = ? AND estado = 'PENDIENTE' ORDER BY created_at DESC").get(pedidoId);
        if (existing && existing.monto === order.total) {
          logger.info('payment_reused', { cid, paymentId: existing.id, orderId: pedidoId });
          return { status: 200, body: { data: dto(existing) } };
        }
        const id = crypto.randomUUID();
        db.prepare("INSERT INTO payments (id, order_id, client_id, monto, estado, created_at, updated_at) VALUES (?,?,?,?, 'PENDIENTE', ?, ?)").run(id, pedidoId, user.sub, order.total, now(), now());
        let session;
        try {
          const res = await fetch(`${providerUrl}/v1/checkout-sessions`, {
            method: 'POST',
            headers: { authorization: `Bearer ${providerKey}`, 'content-type': 'application/json', 'idempotency-key': id },
            body: JSON.stringify({ amount: order.total, currency: 'CLP', reference: id, description: `Pedido ${pedidoId.slice(0, 8)}`, return_url: `${returnUrl}?pedido=${pedidoId}`, webhook_url: webhookUrl }),
            signal: AbortSignal.timeout(4000),
          });
          if (res.status !== 201) throw new Error(`proveedor respondió ${res.status}`);
          session = await res.json();
        } catch (err) {
          db.prepare("UPDATE payments SET estado = 'ERROR', updated_at = ? WHERE id = ?").run(now(), id);
          logger.warn('provider_unavailable', { cid, paymentId: id, error: err.message });
          throw new HttpError(503, 'PROVEEDOR_NO_DISPONIBLE', 'El proveedor de pagos no está disponible. Tu pedido sigue reservado; intenta pagar nuevamente.');
        }
        db.prepare('UPDATE payments SET provider_session_id = ?, checkout_url = ?, updated_at = ? WHERE id = ?').run(session.id, session.checkout_url, now(), id);
        logger.info('payment_started', { cid, paymentId: id, orderId: pedidoId, monto: order.total });
        return { status: 201, body: { data: dto(getPayment.get(id)) } };
      },
    },
    {
      method: 'GET', path: '/payments/:id', callers: ['gateway'], user: 'required',
      handler: ({ params, user }) => {
        const p = UUID_RE.test(params.id) ? getPayment.get(params.id) : null;
        if (!p || (user.role !== 'ADMIN' && p.client_id !== user.sub)) throw new HttpError(404, 'NOT_FOUND', 'Pago no encontrado');
        return { body: { data: dto(p) } };
      },
    },
    {
      // Batching para GraphQL: pagos de varios pedidos en una sola llamada.
      method: 'GET', path: '/internal/payments', callers: ['graphql'], user: 'required',
      handler: ({ query, user }) => {
        const ids = String(query.pedidoIds || '').split(',').filter((x) => UUID_RE.test(x));
        if (ids.length === 0 || ids.length > 50) throw new HttpError(400, 'VALIDATION_ERROR', 'pedidoIds debe contener entre 1 y 50 UUID');
        const rows = db.prepare(`SELECT * FROM payments WHERE order_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at DESC`).all(...ids);
        const visible = rows.filter((p) => user.role === 'ADMIN' || p.client_id === user.sub);
        return { body: { data: visible.map(dto) } };
      },
    },
    {
      method: 'POST', path: '/webhooks/provider', callers: ['gateway'], user: 'none', raw: true,
      handler: async ({ rawBody, headers, cid }) => {
        if (!verifySignature(headers['x-sandbox-signature'], rawBody)) {
          logger.warn('webhook_rejected', { cid, reason: 'invalid_signature' });
          throw new HttpError(401, 'FIRMA_INVALIDA', 'Firma de la notificación inválida');
        }
        let event;
        try {
          event = JSON.parse(rawBody.toString('utf8'));
        } catch {
          throw new HttpError(400, 'INVALID_JSON', 'Notificación mal formada');
        }
        const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
        if (db.prepare('SELECT 1 FROM webhook_events WHERE event_id = ?').get(event.id)) {
          logger.info('webhook_duplicate', { cid, eventId: event.id });
          return { body: { recibido: true, duplicado: true } };
        }
        const data = event.data || {};
        const p = UUID_RE.test(String(data.reference)) ? getPayment.get(data.reference) : null;
        if (!p || p.provider_session_id !== data.session_id || p.monto !== data.amount || data.currency !== 'CLP') {
          logger.warn('webhook_rejected', { cid, reason: 'mismatch', eventId: event.id });
          throw new HttpError(422, 'NOTIFICACION_NO_COINCIDE', 'La notificación no coincide con el pago registrado');
        }
        let nuevoEstado = p.estado;
        if (event.type === 'checkout.session.approved' && p.estado === 'PENDIENTE') {
          const r = await client.call('orders', 'POST', `/internal/orders/${p.order_id}/payment-confirmed`, { body: { paymentId: p.id, monto: p.monto }, cid });
          if (r.status === 200) nuevoEstado = 'APROBADO';
          else if (r.status === 409) nuevoEstado = 'REEMBOLSO_PENDIENTE'; // pagado tras cancelación: requiere devolución
          else throw new HttpError(503, 'ORDERS_NO_DISPONIBLE', 'No se pudo registrar el pago; reintente la notificación');
        } else if (event.type === 'checkout.session.rejected' && p.estado === 'PENDIENTE') {
          nuevoEstado = 'RECHAZADO';
        }
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare("UPDATE payments SET estado = ?, updated_at = ? WHERE id = ? AND estado = 'PENDIENTE'").run(nuevoEstado, now(), p.id);
          db.prepare('INSERT OR IGNORE INTO webhook_events (event_id, payment_id, tipo, payload_hash, received_at) VALUES (?,?,?,?,?)').run(event.id, p.id, event.type, payloadHash, now());
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
        logger.info('webhook_processed', { cid, eventId: event.id, paymentId: p.id, orderId: p.order_id, estado: nuevoEstado });
        return { body: { recibido: true, duplicado: false, estado: nuevoEstado } };
      },
    },
  ];

  await createService({ name: NAME, port: Number(process.env.PORT || 7006), routes, keyFor, logger }).listen();
}

main().catch((err) => {
  console.error(`[${NAME}] error fatal de arranque:`, err.message);
  process.exit(1);
});
