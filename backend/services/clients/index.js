'use strict';
// clients (privado): registro de perfil, datos personales y solicitudes de contacto.
// Autoridad oficial sobre los datos personales del cliente.
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../../lib/boot');
const { createService, HttpError } = require('../../lib/http');
const { openDatabase } = require('../../lib/db');
const { v, fail } = require('../../lib/validate');

const NAME = 'clients';

function rutValido(rut) {
  const m = /^(\d{1,2}\.?\d{3}\.?\d{3})-([\dkK])$/.exec(rut);
  if (!m) return false;
  const body = m[1].replace(/\./g, '');
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const dv = 11 - (sum % 11);
  const expected = dv === 11 ? '0' : dv === 10 ? 'K' : String(dv);
  return expected === m[2].toUpperCase();
}

const mask = (s, keep = 4) => (s ? `${'*'.repeat(Math.max(0, s.length - keep))}${s.slice(-keep)}` : null);

async function main() {
  const { logger, keyFor, secrets } = await boot({ name: NAME, inbound: ['gateway', 'graphql', 'auth'] });
  const key = Buffer.from(await secrets.get('clients/pii-encryption-key'), 'base64');
  const db = openDatabase(NAME, path.join(__dirname, 'migrations'));
  const now = () => new Date().toISOString();

  const enc = (plain) => {
    if (plain === null || plain === undefined || plain === '') return null;
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
    return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join(':');
  };
  const dec = (stored) => {
    if (!stored) return null;
    const [, iv, tag, data] = stored.split(':');
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
  };
  const profile = (r) => ({
    id: r.id, nombre: r.nombre, email: r.email, rut: dec(r.rut_enc), telefono: dec(r.telefono_enc),
    direccion: dec(r.direccion_enc), comuna: r.comuna, creadoEn: r.created_at,
  });

  // Semilla de perfiles ficticios para las cuentas de prueba (mismos IDs que auth).
  if (db.prepare('SELECT COUNT(*) AS n FROM clients').get().n === 0) {
    const ins = db.prepare('INSERT INTO clients (id, nombre, email, rut_enc, telefono_enc, direccion_enc, comuna, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)');
    const ts = now();
    ins.run('00000000-0000-4000-8000-000000000001', 'Administración Chocomanía', 'admin@chocomania.test', null, enc('+56 2 2345 6789'), enc('Av. Cacao 100'), 'Santiago', ts, ts);
    ins.run('00000000-0000-4000-8000-0000000000a1', 'Ana Pérez (ficticia)', 'ana.cliente@chocomania.test', enc('11.111.111-1'), enc('+56 9 1111 1111'), enc('Calle Bombón 123, depto 4'), 'Providencia', ts, ts);
    ins.run('00000000-0000-4000-8000-0000000000b2', 'Bruno Soto (ficticio)', 'bruno.cliente@chocomania.test', enc('22.222.222-2'), enc('+56 9 2222 2222'), enc('Pasaje Trufa 45'), 'Ñuñoa', ts, ts);
  }
  const byId = db.prepare('SELECT * FROM clients WHERE id = ?');

  const routes = [
    {
      method: 'GET', path: '/clients/me', callers: ['gateway'], user: 'required',
      handler: ({ user }) => {
        const r = byId.get(user.sub);
        if (!r) throw new HttpError(404, 'NOT_FOUND', 'Perfil no encontrado');
        return { body: { data: profile(r) } };
      },
    },
    {
      method: 'PUT', path: '/clients/me', callers: ['gateway'], user: 'required',
      handler: ({ user, body, cid }) => {
        v.object(body);
        v.allowedKeys(body, ['nombre', 'rut', 'telefono', 'direccion', 'comuna']);
        const nombre = v.string(body.nombre, 'nombre', { min: 2, max: 80 });
        const rut = v.string(body.rut, 'rut', { min: 8, max: 12, optional: true });
        if (rut && !rutValido(rut)) fail('rut', 'RUT inválido');
        const telefono = v.string(body.telefono, 'telefono', { min: 8, max: 20, pattern: /^\+?[\d\s]+$/, optional: true });
        const direccion = v.string(body.direccion, 'direccion', { min: 5, max: 200, optional: true });
        const comuna = v.string(body.comuna, 'comuna', { min: 2, max: 60, optional: true });
        if (!byId.get(user.sub)) throw new HttpError(404, 'NOT_FOUND', 'Perfil no encontrado');
        db.prepare('UPDATE clients SET nombre=?, rut_enc=?, telefono_enc=?, direccion_enc=?, comuna=?, updated_at=? WHERE id=?')
          .run(nombre, enc(rut), enc(telefono), enc(direccion), comuna, now(), user.sub);
        logger.info('profile_updated', { cid, sub: user.sub });
        return { body: { data: profile(byId.get(user.sub)) } };
      },
    },
    {
      method: 'POST', path: '/internal/clients', callers: ['auth'], user: 'none',
      handler: ({ body, cid }) => {
        v.object(body);
        const id = v.uuid(body.id, 'id');
        const nombre = v.string(body.nombre, 'nombre', { min: 2, max: 80 });
        const email = v.email(body.email);
        try {
          db.prepare('INSERT INTO clients (id, nombre, email, created_at, updated_at) VALUES (?,?,?,?,?)').run(id, nombre, email, now(), now());
        } catch (err) {
          if (/UNIQUE/.test(err.message)) throw new HttpError(409, 'EMAIL_REGISTRADO', 'El correo ya está registrado');
          throw err;
        }
        logger.info('client_created', { cid, id });
        return { status: 201, body: { data: { id } } };
      },
    },
    {
      method: 'DELETE', path: '/internal/clients/:id', callers: ['auth'], user: 'none',
      handler: ({ params, cid }) => {
        db.prepare('DELETE FROM clients WHERE id = ?').run(params.id);
        logger.info('client_rollback', { cid, id: params.id });
        return { body: { data: { id: params.id } } };
      },
    },
    {
      method: 'GET', path: '/internal/clients/:id', callers: ['graphql'], user: 'required',
      handler: ({ params, user }) => {
        // Propiedad verificada aquí aunque el GraphQL Gateway ya filtre: defensa en profundidad.
        if (user.role !== 'ADMIN' && user.sub !== params.id) throw new HttpError(404, 'NOT_FOUND', 'Perfil no encontrado');
        const r = byId.get(params.id);
        if (!r) throw new HttpError(404, 'NOT_FOUND', 'Perfil no encontrado');
        return { body: { data: profile(r) } };
      },
    },
    {
      method: 'GET', path: '/admin/clients', callers: ['gateway'], user: 'admin',
      handler: () => {
        const rows = db.prepare('SELECT * FROM clients ORDER BY created_at DESC LIMIT 200').all();
        // Minimización: el listado administrativo enmascara RUT y teléfono.
        return { body: { data: rows.map((r) => ({ id: r.id, nombre: r.nombre, email: r.email, rut: mask(dec(r.rut_enc), 5), telefono: mask(dec(r.telefono_enc)), comuna: r.comuna, creadoEn: r.created_at })) } };
      },
    },
    {
      method: 'POST', path: '/contact-requests', callers: ['gateway'], user: 'optional',
      handler: ({ body, user, cid }) => {
        v.object(body);
        v.allowedKeys(body, ['nombre', 'email', 'tipo', 'mensaje']);
        const nombre = v.string(body.nombre, 'nombre', { min: 2, max: 80 });
        const email = v.email(body.email);
        const tipo = v.oneOf(body.tipo, 'tipo', ['CONSULTA', 'ORDEN_ESPECIAL']);
        const mensaje = v.string(body.mensaje, 'mensaje', { min: 10, max: 1000 });
        const id = crypto.randomUUID();
        db.prepare('INSERT INTO contact_requests (id, nombre, email, tipo, mensaje, client_id, created_at) VALUES (?,?,?,?,?,?,?)')
          .run(id, nombre, email, tipo, mensaje, user ? user.sub : null, now());
        logger.info('contact_request_created', { cid, id, tipo });
        return { status: 201, body: { data: { id, estado: 'NUEVA', tipo } } };
      },
    },
    {
      method: 'GET', path: '/admin/contact-requests', callers: ['gateway'], user: 'admin',
      handler: () => ({ body: { data: db.prepare('SELECT id, nombre, email, tipo, mensaje, estado, created_at AS creadoEn FROM contact_requests ORDER BY created_at DESC LIMIT 200').all() } }),
    },
    {
      method: 'PUT', path: '/admin/contact-requests/:id', callers: ['gateway'], user: 'admin',
      handler: ({ params, body }) => {
        v.object(body);
        const estado = v.oneOf(body.estado, 'estado', ['NUEVA', 'EN_GESTION', 'CERRADA']);
        const r = db.prepare('UPDATE contact_requests SET estado = ? WHERE id = ?').run(estado, params.id);
        if (Number(r.changes) === 0) throw new HttpError(404, 'NOT_FOUND', 'Solicitud no encontrada');
        return { body: { data: { id: params.id, estado } } };
      },
    },
  ];

  await createService({ name: NAME, port: Number(process.env.PORT || 7005), routes, keyFor, logger }).listen();
}

main().catch((err) => {
  console.error(`[${NAME}] error fatal de arranque:`, err.message);
  process.exit(1);
});
