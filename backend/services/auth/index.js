'use strict';
// Auth Service (privado, expuesto solo a través del API Gateway).
// - Registro y login con contraseña (hash scrypt N=2^15 con sal aleatoria).
// - Emite JWT RS256 de vida corta (15 min) con identificador de sesión (sid).
// - Permite revocar sesiones (logout) y responde al gateway si una sesión sigue activa.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../../lib/boot');
const { createService, HttpError } = require('../../lib/http');
const { openDatabase } = require('../../lib/db');
const { v, fail } = require('../../lib/validate');
const { signJwt } = require('../../lib/jwt');

const NAME = 'auth';
const TTL = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 900);
const MAX_FAILED = 5;
const LOCK_MINUTES = 5;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}
function verifyPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const got = crypto.scryptSync(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return crypto.timingSafeEqual(got, expected);
}
// Hash ficticio para igualar tiempos cuando el usuario no existe (evita enumeración por tiempo).
const DUMMY_HASH = hashPassword('dummy-password-no-real-1');

const SEED_IDS = {
  admin: '00000000-0000-4000-8000-000000000001',
  clienteA: '00000000-0000-4000-8000-0000000000a1',
  clienteB: '00000000-0000-4000-8000-0000000000b2',
};

async function main() {
  const { logger, keyFor, secrets, client } = await boot({ name: NAME, inbound: ['gateway'], outbound: ['clients'] });
  const signingKey = await secrets.get('auth/jwt-signing-key');
  const db = openDatabase(NAME, path.join(__dirname, 'migrations'));
  const now = () => new Date().toISOString();

  // Cuentas ficticias por rol (contraseñas aleatorias generadas por init-secrets).
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
    const seedFile = process.env.SEED_ACCOUNTS_FILE || path.join(__dirname, '..', '..', '..', '.secrets', 'seed-accounts.json');
    if (fs.existsSync(seedFile)) {
      const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
      const ins = db.prepare('INSERT INTO users (id, email, nombre, password_hash, role, created_at) VALUES (?,?,?,?,?,?)');
      for (const [k, acc] of Object.entries(seed)) {
        ins.run(SEED_IDS[k], acc.email, acc.nombre, hashPassword(acc.password), k === 'admin' ? 'ADMIN' : 'CLIENTE', now());
      }
      logger.info('seed_accounts_created', { count: Object.keys(seed).length });
    }
  }

  const byEmail = db.prepare('SELECT * FROM users WHERE email = ?');
  const removeUser = db.prepare('DELETE FROM users WHERE id = ?');

  function issueToken(user) {
    const sid = crypto.randomUUID();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + TTL;
    db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?,?,?,?)').run(sid, user.id, now(), new Date(exp * 1000).toISOString());
    const token = signJwt({ iss: 'chocomania-auth', aud: 'chocomania-api', sub: user.id, role: user.role, sid, iat, exp }, signingKey);
    return { accessToken: token, tokenType: 'Bearer', expiresIn: TTL, user: { id: user.id, nombre: user.nombre, role: user.role } };
  }

  const routes = [
    {
      method: 'POST', path: '/register', callers: ['gateway'], user: 'none',
      handler: async ({ body, cid }) => {
        v.object(body);
        v.allowedKeys(body, ['nombre', 'email', 'password']);
        const nombre = v.string(body.nombre, 'nombre', { min: 2, max: 80 });
        const email = v.email(body.email);
        const password = v.string(body.password, 'password', { min: 8, max: 72 });
        if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) fail('password', 'Debe contener letras y números');
        if (byEmail.get(email)) throw new HttpError(409, 'EMAIL_REGISTRADO', 'El correo ya está registrado');
        const id = crypto.randomUUID();
        db.prepare('INSERT INTO users (id, email, nombre, password_hash, role, created_at) VALUES (?,?,?,?,?,?)').run(id, email, nombre, hashPassword(password), 'CLIENTE', now());
        // El perfil (datos personales) lo administra clients. Si falla, se deshace la cuenta.
        let r;
        try {
          r = await client.call('clients', 'POST', '/internal/clients', { body: { id, nombre, email }, cid });
        } catch (err) {
          removeUser.run(id);
          throw err;
        }
        if (r.status !== 201) {
          removeUser.run(id);
          throw new HttpError(r.status === 409 ? 409 : 502, (r.data && r.data.error && r.data.error.code) || 'REGISTRO_FALLIDO', 'No fue posible crear el perfil');
        }
        logger.info('user_registered', { cid, id });
        return { status: 201, body: { data: { id, email, nombre, role: 'CLIENTE' } } };
      },
    },
    {
      method: 'POST', path: '/login', callers: ['gateway'], user: 'none',
      handler: ({ body, cid }) => {
        v.object(body);
        const email = v.email(body.email);
        const password = v.string(body.password, 'password', { min: 1, max: 72 });
        const user = byEmail.get(email);
        const generic = new HttpError(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos');
        if (!user) {
          verifyPassword(password, DUMMY_HASH);
          logger.warn('login_failed', { cid, reason: 'unknown_user' });
          throw generic;
        }
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
          logger.warn('login_locked', { cid, sub: user.id });
          throw new HttpError(423, 'CUENTA_BLOQUEADA', `Demasiados intentos fallidos. Intenta nuevamente en ${LOCK_MINUTES} minutos.`);
        }
        if (!verifyPassword(password, user.password_hash)) {
          const failed = user.failed_attempts + 1;
          const lock = failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
          db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(lock ? 0 : failed, lock, user.id);
          logger.warn('login_failed', { cid, sub: user.id, failed, locked: Boolean(lock) });
          throw generic;
        }
        db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
        const out = issueToken(user);
        logger.info('login_ok', { cid, sub: user.id, role: user.role });
        return { body: { data: out } };
      },
    },
    {
      method: 'POST', path: '/logout', callers: ['gateway'], user: 'required',
      handler: ({ user, cid }) => {
        db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL').run(now(), user.sid, user.sub);
        logger.info('logout', { cid, sub: user.sub });
        return { body: { data: { revocada: true } } };
      },
    },
    {
      method: 'GET', path: '/me', callers: ['gateway'], user: 'required',
      handler: ({ user }) => {
        const u = db.prepare('SELECT id, email, nombre, role FROM users WHERE id = ?').get(user.sub);
        if (!u) throw new HttpError(404, 'NOT_FOUND', 'Usuario no encontrado');
        return { body: { data: u } };
      },
    },
    {
      // Consultado por el gateway (con caché breve) para rechazar tokens de sesiones revocadas.
      method: 'GET', path: '/internal/sessions/:sid', callers: ['gateway'], user: 'none',
      handler: ({ params }) => {
        const s = db.prepare('SELECT revoked_at, expires_at FROM sessions WHERE id = ?').get(params.sid);
        const active = Boolean(s && !s.revoked_at && new Date(s.expires_at) > new Date());
        return { body: { data: { active } } };
      },
    },
  ];

  await createService({ name: NAME, port: Number(process.env.PORT || 7001), routes, keyFor, logger }).listen();
}

main().catch((err) => {
  console.error(`[${NAME}] error fatal de arranque:`, err.message);
  process.exit(1);
});
