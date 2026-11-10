'use strict';
// GraphQL Gateway (privado). Combina orders + inventory + payments + clients.
// Controles: identidad verificada (viene del API Gateway), autorización por recurso
// (la aplican los servicios dueños) y por campo (aquí), límites de tamaño, profundidad
// y costo, paginación, plazos por dependencia, batching y errores parciales explícitos.
const fs = require('node:fs');
const path = require('node:path');
const {
  buildSchema, parse, validate, execute, specifiedRules, GraphQLError,
  NoSchemaIntrospectionCustomRule, Kind,
} = require('graphql');
const { boot } = require('../../lib/boot');
const { createService, HttpError } = require('../../lib/http');

const NAME = 'graphql';
const MAX_QUERY_LENGTH = 4000;
// Profundidad máxima = la mayor profundidad legítima del schema actual (misPedidos>pedidos>items>producto>campo).
const MAX_DEPTH = Number(process.env.GRAPHQL_MAX_DEPTH || 5);
// Costo máximo: admite la consulta legítima más grande (limite=20 con todos los campos ≈ 461)
// y rechaza amplificación por alias o repetición.
const MAX_COST = Number(process.env.GRAPHQL_MAX_COST || 500);
const DEP_TIMEOUT = 2000;

const schema = buildSchema(fs.readFileSync(path.join(__dirname, 'schema.graphql'), 'utf8'));

// ---------- Reglas de validación: profundidad y costo ----------
function fragmentMap(doc) {
  const m = {};
  for (const d of doc.definitions) if (d.kind === Kind.FRAGMENT_DEFINITION) m[d.name.value] = d;
  return m;
}
function depthOf(selectionSet, fragments, depth, seen = new Set()) {
  if (!selectionSet) return depth;
  let max = depth;
  for (const sel of selectionSet.selections) {
    if (sel.kind === Kind.FIELD) {
      if (sel.name.value.startsWith('__')) continue;
      max = Math.max(max, depthOf(sel.selectionSet, fragments, depth + 1, seen));
    } else if (sel.kind === Kind.INLINE_FRAGMENT) {
      max = Math.max(max, depthOf(sel.selectionSet, fragments, depth, seen));
    } else if (sel.kind === Kind.FRAGMENT_SPREAD && !seen.has(sel.name.value)) {
      seen.add(sel.name.value);
      const f = fragments[sel.name.value];
      if (f) max = Math.max(max, depthOf(f.selectionSet, fragments, depth, seen));
    }
  }
  return max;
}
// Costo: los escalares cuestan 0; cada objeto 1; las listas multiplican el costo de sus
// hijos por su tamaño máximo posible.
const LIST_SIZE = { misPedidos: (args) => args.limite || 5, items: () => 20, porEstado: () => 6, topProductos: () => 5 };
function argValues(field, variables) {
  const out = {};
  for (const a of field.arguments || []) {
    if (a.value.kind === Kind.VARIABLE) out[a.name.value] = variables[a.value.name.value];
    else if (a.value.kind === Kind.INT) out[a.name.value] = Number(a.value.value);
  }
  return out;
}
function costOf(selectionSet, fragments, variables, seen = new Set()) {
  if (!selectionSet) return 0;
  let cost = 0;
  for (const sel of selectionSet.selections) {
    if (sel.kind === Kind.FIELD) {
      if (sel.name.value.startsWith('__')) continue;
      if (!sel.selectionSet) continue; // escalar
      const mult = LIST_SIZE[sel.name.value] ? LIST_SIZE[sel.name.value](argValues(sel, variables)) : 1;
      cost += 1 + mult * costOf(sel.selectionSet, fragments, variables, seen);
    } else if (sel.kind === Kind.INLINE_FRAGMENT) {
      cost += costOf(sel.selectionSet, fragments, variables, seen);
    } else if (sel.kind === Kind.FRAGMENT_SPREAD && !seen.has(sel.name.value)) {
      seen.add(sel.name.value);
      const f = fragments[sel.name.value];
      if (f) cost += costOf(f.selectionSet, fragments, variables, seen);
    }
  }
  return cost;
}

// ---------- Cargador por lotes simple (evita N+1) ----------
function batchLoader(fetchMany) {
  const cache = new Map();
  let queue = [];
  return (key) => {
    if (cache.has(key)) return cache.get(key);
    const p = new Promise((resolve, reject) => queue.push({ key, resolve, reject }));
    cache.set(key, p);
    if (queue.length === 1) {
      setImmediate(async () => {
        const batch = queue;
        queue = [];
        try {
          const result = await fetchMany([...new Set(batch.map((b) => b.key))]);
          batch.forEach((b) => b.resolve(result.get(b.key) ?? null));
        } catch (err) {
          batch.forEach((b) => b.reject(err));
        }
      });
    }
    return p;
  };
}

const gqlError = (message, code) => new GraphQLError(message, { extensions: { code } });

async function main() {
  const { logger, keyFor, client } = await boot({ name: NAME, inbound: ['gateway'], outbound: ['orders', 'inventory', 'payments', 'clients'] });

  function makeContext(user, cid) {
    const call = async (target, p) => {
      const r = await client.call(target, 'GET', p, { user, cid, timeoutMs: DEP_TIMEOUT });
      return r;
    };
    const ctx = { user, cid, call, warnings: new Set() };
    ctx.products = batchLoader(async (ids) => {
      const r = await call('inventory', `/products?ids=${ids.map(encodeURIComponent).join(',')}`);
      if (r.status !== 200) throw new Error('inventory');
      return new Map(r.data.data.map((p) => [p.id, p]));
    });
    ctx.payments = batchLoader(async (orderIds) => {
      const r = await call('payments', `/internal/payments?pedidoIds=${orderIds.join(',')}`);
      if (r.status !== 200) throw new Error('payments');
      const m = new Map();
      for (const p of r.data.data) if (!m.has(p.pedidoId)) m.set(p.pedidoId, p); // el más reciente
      return m;
    });
    ctx.clients = batchLoader(async (ids) => {
      const m = new Map();
      await Promise.all(ids.map(async (id) => {
        const r = await call('clients', `/internal/clients/${id}`);
        if (r.status === 200) m.set(id, r.data.data);
        else if (r.status !== 404) throw new Error('clients');
      }));
      return m;
    });
    return ctx;
  }

  const requireUser = (ctx) => {
    if (!ctx.user) throw gqlError('Se requiere autenticación', 'UNAUTHENTICATED');
  };
  const requireAdmin = (ctx) => {
    requireUser(ctx);
    if (ctx.user.role !== 'ADMIN') throw gqlError('No autorizado para este campo', 'FORBIDDEN');
  };

  // Dependencias de un pedido: se consultan con los mismos cargadores (respuesta cacheada).
  async function dependencyWarnings(order, ctx) {
    const w = [];
    const ids = order.items.map((i) => i.productoId);
    const results = await Promise.allSettled([Promise.all(ids.map((id) => ctx.products(id))), ctx.payments(order.id)]);
    if (results[0].status === 'rejected') w.push('La información actual de productos (inventory) no está disponible temporalmente.');
    if (results[1].status === 'rejected') w.push('El estado del pago (payments) no está disponible temporalmente.');
    return w;
  }

  const Query = schema.getQueryType().getFields();
  Query.misPedidos.resolve = async (_, { limite, desde }, ctx) => {
    requireUser(ctx);
    if (limite < 1 || limite > 20 || desde < 0) throw gqlError('limite debe estar entre 1 y 20 y desde >= 0', 'BAD_USER_INPUT');
    const r = await ctx.call('orders', `/orders?limite=${limite}&desde=${desde}`);
    if (r.status !== 200) throw gqlError('El servicio de pedidos no está disponible', 'DEPENDENCY_UNAVAILABLE');
    return { total: r.data.total, limite, desde, pedidos: r.data.data };
  };
  Query.pedido.resolve = async (_, { id }, ctx) => {
    requireUser(ctx);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const r = await ctx.call('orders', `/orders/${id}`);
    if (r.status === 404) return null; // ajeno o inexistente: no se revela cuál
    if (r.status !== 200) throw gqlError('El servicio de pedidos no está disponible', 'DEPENDENCY_UNAVAILABLE');
    return r.data.data;
  };
  Query.resumenVentas.resolve = async (_, { dias }, ctx) => {
    requireAdmin(ctx);
    const r = await ctx.call('orders', `/internal/reports/sales?dias=${dias}`);
    if (r.status === 400) throw gqlError('dias debe estar entre 1 y 365', 'BAD_USER_INPUT');
    if (r.status !== 200) throw gqlError('El servicio de pedidos no está disponible', 'DEPENDENCY_UNAVAILABLE');
    return r.data.data;
  };

  const Pedido = schema.getType('ResumenPedido').getFields();
  Pedido.comuna.resolve = (o) => o.despacho.comuna;
  Pedido.pago.resolve = async (o, _, ctx) => {
    try {
      return await ctx.payments(o.id);
    } catch {
      throw gqlError('payments no disponible', 'DEPENDENCY_UNAVAILABLE');
    }
  };
  Pedido.cliente.resolve = async (o, _, ctx) => {
    try {
      return await ctx.clients(o.clienteId);
    } catch {
      throw gqlError('clients no disponible', 'DEPENDENCY_UNAVAILABLE');
    }
  };
  Pedido.notasInternas.resolve = (o, _, ctx) => {
    requireAdmin(ctx); // autorización por campo
    return o.notasInternas ?? null;
  };
  Pedido.completo.resolve = async (o, _, ctx) => (await dependencyWarnings(o, ctx)).length === 0;
  Pedido.advertencias.resolve = (o, _, ctx) => dependencyWarnings(o, ctx);

  const Item = schema.getType('ItemPedido').getFields();
  Item.producto.resolve = async (i, _, ctx) => {
    try {
      return await ctx.products(i.productoId);
    } catch {
      throw gqlError('inventory no disponible', 'DEPENDENCY_UNAVAILABLE');
    }
  };

  const routes = [
    {
      method: 'POST', path: '/graphql', callers: ['gateway'], user: 'required',
      handler: async ({ body, user, cid }) => {
        if (!body || typeof body.query !== 'string') throw new HttpError(400, 'BAD_REQUEST', 'Se requiere { query }');
        if (body.query.length > MAX_QUERY_LENGTH) {
          return { status: 400, body: { errors: [{ message: `La consulta excede ${MAX_QUERY_LENGTH} caracteres`, extensions: { code: 'QUERY_TOO_LARGE' } }] } };
        }
        const variables = body.variables && typeof body.variables === 'object' ? body.variables : {};
        let document;
        try {
          document = parse(body.query);
        } catch (err) {
          return { status: 400, body: { errors: [{ message: err.message, extensions: { code: 'GRAPHQL_PARSE_FAILED' } }] } };
        }
        const rules = process.env.GRAPHQL_INTROSPECTION === 'true' ? specifiedRules : [...specifiedRules, NoSchemaIntrospectionCustomRule];
        const errors = validate(schema, document, rules);
        if (errors.length) {
          return { status: 400, body: { errors: errors.map((e) => ({ message: e.message, extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } })) } };
        }
        const fragments = fragmentMap(document);
        const op = document.definitions.find((d) => d.kind === Kind.OPERATION_DEFINITION && (!body.operationName || (d.name && d.name.value === body.operationName)));
        if (!op) return { status: 400, body: { errors: [{ message: 'Operación no encontrada', extensions: { code: 'BAD_REQUEST' } }] } };
        const depth = depthOf(op.selectionSet, fragments, 0);
        if (depth > MAX_DEPTH) {
          logger.warn('graphql_limit', { cid, kind: 'depth', depth });
          return { status: 400, body: { errors: [{ message: `Profundidad ${depth} excede el máximo permitido (${MAX_DEPTH})`, extensions: { code: 'QUERY_TOO_DEEP', depth, max: MAX_DEPTH } }] } };
        }
        const cost = costOf(op.selectionSet, fragments, variables);
        if (cost > MAX_COST) {
          logger.warn('graphql_limit', { cid, kind: 'cost', cost });
          return { status: 400, body: { errors: [{ message: `Costo ${cost} excede el máximo permitido (${MAX_COST})`, extensions: { code: 'QUERY_TOO_COMPLEX', cost, max: MAX_COST } }] } };
        }
        const ctx = makeContext(user, cid);
        const result = await execute({ schema, document, variableValues: variables, contextValue: ctx, operationName: body.operationName });
        const out = { data: result.data };
        if (result.errors && result.errors.length) {
          out.errors = result.errors.map((e) => ({
            message: e.extensions && e.extensions.code ? e.message : 'Error interno',
            path: e.path,
            extensions: { code: (e.extensions && e.extensions.code) || 'INTERNAL_ERROR' },
          }));
        }
        logger.info('graphql_executed', { cid, op: op.name ? op.name.value : 'anon', depth, cost, errors: out.errors ? out.errors.map((e) => e.extensions.code) : [] });
        return { status: 200, body: out };
      },
    },
  ];

  await createService({ name: NAME, port: Number(process.env.PORT || 7002), routes, keyFor, logger }).listen();
}

main().catch((err) => {
  console.error(`[${NAME}] error fatal de arranque:`, err.message);
  process.exit(1);
});
