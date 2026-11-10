-- payments: intentos de pago y su relación con el proveedor externo.
-- Autoridad oficial del resultado del pago; el estado PAGADO del pedido solo se
-- asigna cuando payments recibe una notificación firmada y válida del proveedor.
CREATE TABLE payments (
  id                  TEXT PRIMARY KEY,
  order_id            TEXT NOT NULL,
  client_id           TEXT NOT NULL,
  monto               INTEGER NOT NULL,
  estado              TEXT NOT NULL CHECK (estado IN ('PENDIENTE','APROBADO','RECHAZADO','ERROR','REEMBOLSO_PENDIENTE')),
  provider_session_id TEXT,
  checkout_url        TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX idx_payments_order ON payments(order_id);

-- Notificaciones procesadas: evita aplicar dos veces el mismo evento del proveedor.
CREATE TABLE webhook_events (
  event_id     TEXT PRIMARY KEY,
  payment_id   TEXT NOT NULL,
  tipo         TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  received_at  TEXT NOT NULL
);
