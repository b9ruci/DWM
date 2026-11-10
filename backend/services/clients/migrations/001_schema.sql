-- clients: perfil de clientes (datos personales) y solicitudes de contacto / órdenes especiales.
-- RUT, teléfono y dirección se guardan cifrados (AES-256-GCM) con la clave
-- clients/pii-encryption-key obtenida del gestor de secretos.
CREATE TABLE clients (
  id            TEXT PRIMARY KEY,           -- mismo identificador (sub) que la cuenta en auth
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  rut_enc       TEXT,
  telefono_enc  TEXT,
  direccion_enc TEXT,
  comuna        TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE contact_requests (
  id         TEXT PRIMARY KEY,
  nombre     TEXT NOT NULL,
  email      TEXT NOT NULL,
  tipo       TEXT NOT NULL CHECK (tipo IN ('CONSULTA','ORDEN_ESPECIAL')),
  mensaje    TEXT NOT NULL,
  estado     TEXT NOT NULL DEFAULT 'NUEVA' CHECK (estado IN ('NUEVA','EN_GESTION','CERRADA')),
  client_id  TEXT,
  created_at TEXT NOT NULL
);
