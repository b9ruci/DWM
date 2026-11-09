#!/usr/bin/env node
'use strict';
// Restaura el estado inicial de los datos de prueba: elimina las bases SQLite de cada
// servicio. Al siguiente arranque, las migraciones y semillas recrean los datos ficticios.
// Detenga el sistema antes de ejecutarlo.
const fs = require('node:fs');
const path = require('node:path');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  console.log(`[reset] no hay datos en ${dataDir}`);
  process.exit(0);
}
for (const f of fs.readdirSync(dataDir)) {
  if (/\.db(-wal|-shm)?$/.test(f)) fs.unlinkSync(path.join(dataDir, f));
}
console.log(`[reset] bases de datos eliminadas en ${dataDir}; se recrearán con datos ficticios al iniciar.`);
