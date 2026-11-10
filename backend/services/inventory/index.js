'use strict';
// inventory (privado): catálogo, disponibilidad, stock y reservas.
// Es la autoridad oficial del precio y del stock: orders nunca confía en precios del navegador.
const path = require('node:path');
const { boot } = require('../../lib/boot');
const { createService, HttpError } = require('../../lib/http');
const { openDatabase, tx } = require('../../lib/db');
const { v } = require('../../lib/validate');

const NAME = 'inventory';
const CATEGORIES = ['Barras', 'Figuras', 'Bombones', 'Bebidas'];

const publicDto = (p) => ({
  id: p.id,
  nombre: p.nombre,
  descripcion: p.descripcion,
  categoria: p.categoria,
  precio: p.precio,
  unidad: p.unidad,
  stock: p.stock,
  disponible: p.activo === 1 && p.stock > 0,
  imagen: p.imagen,
  destacado: p.destacado === 1,
});
const adminDto = (p) => ({ ...publicDto(p), sku: p.sku, activo: p.activo === 1, updatedAt: p.updated_at });

function productInput(body) {
  v.object(body);
  v.allowedKeys(body, ['sku', 'nombre', 'descripcion', 'categoria', 'precio', 'unidad', 'stock', 'imagen', 'destacado', 'activo']);
  return {
    sku: v.string(body.sku, 'sku', { min: 3, max: 30, pattern: /^[A-Z0-9-]+$/ }),
    nombre: v.string(body.nombre, 'nombre', { min: 3, max: 80 }),
    descripcion: v.string(body.descripcion, 'descripcion', { min: 0, max: 400, optional: true }) || '',
    categoria: v.oneOf(body.categoria, 'categoria', CATEGORIES),
    precio: v.int(body.precio, 'precio', { min: 1, max: 10_000_000 }),
    unidad: v.oneOf(body.unidad, 'unidad', ['unidad', 'kg']),
    stock: v.int(body.stock, 'stock', { min: 0, max: 100_000 }),
    imagen: v.string(body.imagen, 'imagen', { min: 0, max: 200, optional: true, pattern: /^\/assets\/img\/[a-z0-9/_-]+\.(svg|png|jpg|webp)$/ }) || '/assets/img/productos/generico.svg',
    destacado: v.bool(body.destacado, 'destacado', { optional: true }) ? 1 : 0,
    activo: v.bool(body.activo, 'activo', { optional: true }) === false ? 0 : 1,
  };
}

async function main() {
  const { logger, keyFor } = await boot({ name: NAME, inbound: ['gateway', 'graphql', 'orders'] });
  const db = openDatabase(NAME, path.join(__dirname, 'migrations'));

  const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
  const now = () => new Date().toISOString();

  const routes = [
    {
      method: 'GET', path: '/products', callers: ['gateway', 'graphql'], user: 'optional',
      handler: ({ query }) => {
        const where = ['activo = 1'];
        const args = [];
        if (query.categoria !== undefined) {
          v.oneOf(query.categoria, 'categoria', CATEGORIES);
          where.push('categoria = ?');
          args.push(query.categoria);
        }
        if (query.destacado !== undefined) {
          v.oneOf(query.destacado, 'destacado', ['true', 'false']);
          where.push('destacado = ?');
          args.push(query.destacado === 'true' ? 1 : 0);
        }
        if (query.q !== undefined) {
          const q = v.string(query.q, 'q', { min: 1, max: 50 });
          where.push('(nombre LIKE ? OR descripcion LIKE ?)');
          args.push(`%${q}%`, `%${q}%`);
        }
        if (query.ids !== undefined) {
          // Usado por el GraphQL Gateway para agrupar (batching) la carga de productos.
          // Incluye productos dados de baja: el historial de pedidos debe poder mostrarlos.
          const ids = query.ids.split(',').filter(Boolean);
          if (ids.length === 0 || ids.length > 50) throw new HttpError(400, 'VALIDATION_ERROR', 'ids debe contener entre 1 y 50 elementos');
          where.shift();
          where.push(`id IN (${ids.map(() => '?').join(',')})`);
          args.push(...ids);
        }
        const rows = db.prepare(`SELECT * FROM products WHERE ${where.join(' AND ')} ORDER BY destacado DESC, nombre`).all(...args);
        return { body: { data: rows.map(publicDto), total: rows.length } };
      },
    },
    {
      method: 'GET', path: '/products/:id', callers: ['gateway', 'graphql'], user: 'optional',
      handler: ({ params }) => {
        const p = getProduct.get(params.id);
        if (!p || p.activo !== 1) throw new HttpError(404, 'NOT_FOUND', 'Producto no encontrado');
        return { body: { data: publicDto(p) } };
      },
    },
    {
      method: 'GET', path: '/categories', callers: ['gateway'], user: 'optional',
      handler: () => {
        const rows = db.prepare('SELECT categoria, COUNT(*) AS total FROM products WHERE activo = 1 GROUP BY categoria ORDER BY categoria').all();
        return { body: { data: rows.map((r) => ({ nombre: r.categoria, total: r.total })) } };
      },
    },
    {
      method: 'GET', path: '/promotions', callers: ['gateway'], user: 'optional',
      handler: () => {
        const rows = db
          .prepare(`SELECT pr.id, pr.titulo, pr.subtitulo, pr.orden, p.id AS product_id, p.precio, p.unidad, p.imagen, p.stock, p.activo
                    FROM promotions pr JOIN products p ON p.id = pr.product_id
                    WHERE pr.activo = 1 AND p.activo = 1 ORDER BY pr.orden`)
          .all();
        return {
          body: {
            data: rows.map((r) => ({
              id: r.id, titulo: r.titulo, subtitulo: r.subtitulo, productoId: r.product_id,
              precio: r.precio, unidad: r.unidad, imagen: r.imagen, disponible: r.stock > 0,
            })),
          },
        };
      },
    },
    // ---- Administración (rol ADMIN verificado por el gateway Y nuevamente aquí) ----
    {
      method: 'GET', path: '/admin/products', callers: ['gateway'], user: 'admin',
      handler: () => ({ body: { data: db.prepare('SELECT * FROM products ORDER BY activo DESC, nombre').all().map(adminDto) } }),
    },
    {
      method: 'POST', path: '/admin/products', callers: ['gateway'], user: 'admin',
      handler: ({ body, user, cid }) => {
        const p = productInput(body);
        const id = `p-${Date.now().toString(36)}`;
        try {
          db.prepare(`INSERT INTO products (id, sku, nombre, descripcion, categoria, precio, unidad, stock, imagen, destacado, activo, updated_at)
                      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, p.sku, p.nombre, p.descripcion, p.categoria, p.precio, p.unidad, p.stock, p.imagen, p.destacado, p.activo, now());
        } catch (err) {
          if (/UNIQUE/.test(err.message)) throw new HttpError(409, 'SKU_DUPLICADO', 'Ya existe un producto con ese SKU');
          throw err;
        }
        logger.info('product_created', { cid, id, by: user.sub });
        return { status: 201, body: { data: adminDto(getProduct.get(id)) } };
      },
    },
    {
      method: 'PUT', path: '/admin/products/:id', callers: ['gateway'], user: 'admin',
      handler: ({ params, body, user, cid }) => {
        if (!getProduct.get(params.id)) throw new HttpError(404, 'NOT_FOUND', 'Producto no encontrado');
        const p = productInput(body);
        try {
          db.prepare(`UPDATE products SET sku=?, nombre=?, descripcion=?, categoria=?, precio=?, unidad=?, stock=?, imagen=?, destacado=?, activo=?, updated_at=? WHERE id=?`)
            .run(p.sku, p.nombre, p.descripcion, p.categoria, p.precio, p.unidad, p.stock, p.imagen, p.destacado, p.activo, now(), params.id);
        } catch (err) {
          if (/UNIQUE/.test(err.message)) throw new HttpError(409, 'SKU_DUPLICADO', 'Ya existe un producto con ese SKU');
          throw err;
        }
        logger.info('product_updated', { cid, id: params.id, by: user.sub });
        return { body: { data: adminDto(getProduct.get(params.id)) } };
      },
    },
    {
      method: 'DELETE', path: '/admin/products/:id', callers: ['gateway'], user: 'admin',
      handler: ({ params, user, cid }) => {
        const p = getProduct.get(params.id);
        if (!p) throw new HttpError(404, 'NOT_FOUND', 'Producto no encontrado');
        // Baja lógica: los pedidos históricos siguen referenciando el producto.
        db.prepare('UPDATE products SET activo = 0, updated_at = ? WHERE id = ?').run(now(), params.id);
        logger.info('product_deactivated', { cid, id: params.id, by: user.sub });
        return { body: { data: adminDto(getProduct.get(params.id)) } };
      },
    },
    // ---- Operaciones internas (solo orders) ----
    {
      method: 'POST', path: '/internal/reservations', callers: ['orders'], user: 'required',
      handler: ({ body, cid }) => {
        v.object(body);
        const orderId = v.uuid(body.orderId, 'orderId');
        if (!Array.isArray(body.items) || body.items.length === 0) throw new HttpError(400, 'VALIDATION_ERROR', 'items es obligatorio');
        const result = tx(db, () => {
          const existing = db.prepare('SELECT * FROM reservations WHERE order_id = ?').all(orderId);
          if (existing.length > 0) {
            // Reintento de la misma reserva: no descuenta stock dos veces.
            return { replay: true, rows: existing };
          }
          const shortages = [];
          const lines = body.items.map((it, i) => {
            const productId = v.string(it.productId, `items[${i}].productId`, { max: 40 });
            const cantidad = v.int(it.cantidad, `items[${i}].cantidad`, { min: 1, max: 50 });
            const p = getProduct.get(productId);
            if (!p || p.activo !== 1) throw new HttpError(422, 'PRODUCTO_NO_DISPONIBLE', 'Un producto ya no está disponible', { productId });
            if (p.stock < cantidad) shortages.push({ productId, nombre: p.nombre, solicitado: cantidad, disponible: p.stock });
            return { p, cantidad };
          });
          if (shortages.length) throw new HttpError(409, 'STOCK_INSUFICIENTE', 'No hay stock suficiente', shortages);
          const ts = now();
          for (const { p, cantidad } of lines) {
            db.prepare('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?').run(cantidad, ts, p.id);
            db.prepare('INSERT INTO reservations (order_id, product_id, cantidad, estado, created_at, updated_at) VALUES (?,?,?,?,?,?)').run(orderId, p.id, cantidad, 'RESERVADA', ts, ts);
          }
          return { replay: false, rows: db.prepare('SELECT * FROM reservations WHERE order_id = ?').all(orderId) };
        });
        const items = result.rows.map((r) => {
          const p = getProduct.get(r.product_id);
          return { productId: p.id, nombre: p.nombre, precioUnitario: p.precio, unidad: p.unidad, cantidad: r.cantidad };
        });
        logger.info('stock_reserved', { cid, orderId, replay: result.replay, items: items.map((i) => `${i.productId}x${i.cantidad}`) });
        return { status: result.replay ? 200 : 201, body: { data: { orderId, items } } };
      },
    },
    {
      method: 'POST', path: '/internal/reservations/:orderId/release', callers: ['orders'], user: 'optional',
      handler: ({ params, cid }) => {
        const released = tx(db, () => {
          const rows = db.prepare("SELECT * FROM reservations WHERE order_id = ? AND estado = 'RESERVADA'").all(params.orderId);
          const ts = now();
          for (const r of rows) {
            db.prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?').run(r.cantidad, ts, r.product_id);
            db.prepare("UPDATE reservations SET estado = 'LIBERADA', updated_at = ? WHERE order_id = ? AND product_id = ?").run(ts, r.order_id, r.product_id);
          }
          return rows.length;
        });
        logger.info('stock_released', { cid, orderId: params.orderId, lines: released });
        return { body: { data: { orderId: params.orderId, lineasLiberadas: released } } };
      },
    },
    {
      method: 'POST', path: '/internal/reservations/:orderId/confirm', callers: ['orders'], user: 'optional',
      handler: ({ params, cid }) => {
        const r = db.prepare("UPDATE reservations SET estado = 'CONFIRMADA', updated_at = ? WHERE order_id = ? AND estado = 'RESERVADA'").run(now(), params.orderId);
        logger.info('stock_confirmed', { cid, orderId: params.orderId, lines: Number(r.changes) });
        return { body: { data: { orderId: params.orderId, lineasConfirmadas: Number(r.changes) } } };
      },
    },
  ];

  await createService({ name: NAME, port: Number(process.env.PORT || 7003), routes, keyFor, logger }).listen();
}

main().catch((err) => {
  console.error(`[${NAME}] error fatal de arranque:`, err.message);
  process.exit(1);
});
