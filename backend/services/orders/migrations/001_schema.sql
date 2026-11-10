-- orders: creación y ciclo de vida de pedidos. Autoridad oficial del estado del pedido.
CREATE TABLE orders (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  estado          TEXT NOT NULL CHECK (estado IN ('PENDIENTE_PAGO','PAGADO','EN_PREPARACION','DESPACHADO','ENTREGADO','CANCELADO')),
  subtotal        INTEGER NOT NULL,
  costo_despacho  INTEGER NOT NULL,
  total           INTEGER NOT NULL,
  direccion       TEXT NOT NULL,      -- dato personal: solo propietario y ADMIN
  comuna          TEXT NOT NULL,
  notas_cliente   TEXT,
  notas_internas  TEXT,               -- solo ADMIN (autorización por campo en GraphQL)
  payment_id      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX idx_orders_client ON orders(client_id, created_at);

-- Un pedido confirmado contiene uno o más ítems (Pedido 1 — 1..* DetallePedido).
-- nombre y precio se guardan como instantánea: el historial no cambia si el producto cambia.
CREATE TABLE order_items (
  order_id        TEXT NOT NULL REFERENCES orders(id),
  product_id      TEXT NOT NULL,
  nombre          TEXT NOT NULL,
  precio_unitario INTEGER NOT NULL,
  unidad          TEXT NOT NULL,
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  PRIMARY KEY (order_id, product_id)
);

-- Historial de transiciones (la anulación no borra el pedido).
CREATE TABLE order_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   TEXT NOT NULL REFERENCES orders(id),
  desde      TEXT,
  hacia      TEXT NOT NULL,
  actor      TEXT NOT NULL,
  nota       TEXT,
  created_at TEXT NOT NULL
);

-- Prevención de efectos duplicados por reintento (Idempotency-Key por cliente).
CREATE TABLE idempotency_keys (
  client_id    TEXT NOT NULL,
  key          TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  order_id     TEXT,
  estado       TEXT NOT NULL CHECK (estado IN ('PROCESANDO','COMPLETADA')),
  created_at   TEXT NOT NULL,
  PRIMARY KEY (client_id, key)
);
