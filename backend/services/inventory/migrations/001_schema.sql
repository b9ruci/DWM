-- inventory: catálogo, stock y reservas. Autoridad oficial sobre productos y disponibilidad.
CREATE TABLE products (
  id          TEXT PRIMARY KEY,
  sku         TEXT NOT NULL UNIQUE,
  nombre      TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  categoria   TEXT NOT NULL,
  precio      INTEGER NOT NULL CHECK (precio > 0),          -- CLP, entero
  unidad      TEXT NOT NULL CHECK (unidad IN ('unidad','kg')),
  stock       INTEGER NOT NULL CHECK (stock >= 0),
  imagen      TEXT NOT NULL DEFAULT '',
  destacado   INTEGER NOT NULL DEFAULT 0,
  activo      INTEGER NOT NULL DEFAULT 1,                   -- baja lógica: conserva historial de pedidos
  updated_at  TEXT NOT NULL
);

CREATE TABLE promotions (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  titulo     TEXT NOT NULL,
  subtitulo  TEXT NOT NULL,
  orden      INTEGER NOT NULL DEFAULT 0,
  activo     INTEGER NOT NULL DEFAULT 1
);

-- Reserva de stock por pedido: se crea al aceptar el pedido, se confirma al pagarse
-- y se libera si el pedido se cancela. (order_id, product_id) es único → idempotencia.
CREATE TABLE reservations (
  order_id   TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  cantidad   INTEGER NOT NULL CHECK (cantidad > 0),
  estado     TEXT NOT NULL CHECK (estado IN ('RESERVADA','CONFIRMADA','LIBERADA')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
