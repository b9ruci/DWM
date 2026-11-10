'use strict';
// DOBLE DE PRUEBA DECLARADO del proveedor de pagos externo.
// Simula el contrato de un proveedor tipo "checkout hospedado + webhook firmado":
//   POST /v1/checkout-sessions   (servidor a servidor, Bearer sk_test_...)
//   GET  /checkout/:id           (página que ve el comprador)
//   POST /checkout/:id/approve|reject  → envía webhook firmado HMAC y redirige al comercio
//   POST /checkout/:id/resend    → reenvía el MISMO evento (simula reintento del proveedor)
// No procesa dinero real ni demuestra interoperabilidad con un proveedor real.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { createLogger } = require('../../lib/logger');

const logger = createLogger('payment-sandbox');
const port = Number(process.env.PORT || 8090);
const publicUrl = process.env.SANDBOX_PUBLIC_URL || `http://localhost:${port}`;
const cfgFile = process.env.SANDBOX_CONFIG_FILE || path.join(__dirname, '..', '..', '..', '.secrets', 'provider', 'sandbox.json');
const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const sessions = new Map();

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clp = (n) => '$' + Number(n).toLocaleString('es-CL');

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

async function deliver(session, event) {
  const raw = JSON.stringify(event);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', cfg.webhookSecret).update(`${t}.${raw}`).digest('hex');
    try {
      const res = await fetch(session.webhook_url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-sandbox-signature': `t=${t},v1=${sig}` },
        body: raw,
        signal: AbortSignal.timeout(5000),
      });
      logger.info('webhook_delivered', { sessionId: session.id, eventId: event.id, status: res.status, attempt });
      if (res.status < 500) return res.status;
    } catch (err) {
      logger.warn('webhook_failed', { sessionId: session.id, eventId: event.id, attempt, error: err.message });
    }
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  return 0;
}

function page(session) {
  const done = session.status !== 'open';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pasarela de pago (sandbox)</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f1ee;margin:0;padding:16px;color:#222}
.box{max-width:420px;margin:24px auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.1)}
.warn{background:#fff3cd;border:1px solid #e0c46c;padding:8px 12px;border-radius:8px;font-size:.9rem}
.amount{font-size:2rem;font-weight:700;margin:12px 0}.row{display:flex;gap:8px;margin-top:16px}
button{flex:1;padding:12px;border:0;border-radius:8px;font-size:1rem;cursor:pointer}
.ok{background:#1f7a4d;color:#fff}.ko{background:#a12b2b;color:#fff}</style></head><body>
<div class="box"><div class="warn" role="note">ENTORNO DE PRUEBA (sandbox). No se procesan pagos reales.</div>
<h1 style="font-size:1.2rem">Pago a Chocolatería Chocomanía</h1>
<p>${esc(session.description)}</p><div class="amount" data-testid="sandbox-amount">${clp(session.amount)} CLP</div>
${done ? `<p data-testid="sandbox-status">Sesión ${esc(session.status)}.</p>` : `
<form method="post" action="/checkout/${esc(session.id)}/approve" class="row" style="margin:0">
<button class="ok" type="submit" data-testid="sandbox-approve">Aprobar pago (tarjeta de prueba)</button></form>
<form method="post" action="/checkout/${esc(session.id)}/reject" class="row">
<button class="ko" type="submit" data-testid="sandbox-reject">Rechazar pago</button></form>`}
</div></body></html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, publicUrl);
  const json = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === '/health') return json(200, { status: 'ok', service: 'payment-sandbox' });

  if (req.method === 'POST' && url.pathname === '/v1/checkout-sessions') {
    if (req.headers.authorization !== `Bearer ${cfg.apiKey}`) return json(401, { error: 'invalid_api_key' });
    const body = JSON.parse((await readBody(req)) || '{}');
    if (!Number.isInteger(body.amount) || body.amount <= 0 || body.currency !== 'CLP' || !body.reference || !body.webhook_url) {
      return json(400, { error: 'invalid_request' });
    }
    const id = `cs_test_${crypto.randomBytes(12).toString('hex')}`;
    const session = { id, status: 'open', ...body, created: Date.now(), event: null };
    sessions.set(id, session);
    logger.info('session_created', { sessionId: id, amount: body.amount });
    return json(201, { id, status: 'open', checkout_url: `${publicUrl}/checkout/${id}` });
  }

  const m = /^\/checkout\/(cs_test_[a-f0-9]+)(?:\/(approve|reject|resend))?$/.exec(url.pathname);
  if (!m) return json(404, { error: 'not_found' });
  const session = sessions.get(m[1]);
  if (!session) return json(404, { error: 'session_not_found' });

  if (req.method === 'GET' && !m[2]) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(page(session));
  }
  if (req.method === 'POST' && (m[2] === 'approve' || m[2] === 'reject')) {
    if (session.status === 'open') {
      session.status = m[2] === 'approve' ? 'approved' : 'rejected';
      session.event = {
        id: `evt_${crypto.randomUUID()}`,
        type: m[2] === 'approve' ? 'checkout.session.approved' : 'checkout.session.rejected',
        created: Math.floor(Date.now() / 1000),
        data: { session_id: session.id, reference: session.reference, amount: session.amount, currency: session.currency },
      };
      await deliver(session, session.event);
    }
    const back = new URL(session.return_url);
    back.searchParams.set('resultado', session.status);
    res.writeHead(303, { location: back.toString() });
    return res.end();
  }
  if (req.method === 'POST' && m[2] === 'resend') {
    if (!session.event) return json(409, { error: 'no_event' });
    const status = await deliver(session, session.event);
    return json(200, { reenviado: true, eventId: session.event.id, statusComercio: status });
  }
  return json(405, { error: 'method_not_allowed' });
});

server.listen(port, process.env.BIND_HOST || '127.0.0.1', () => logger.info('listening', { port }));
