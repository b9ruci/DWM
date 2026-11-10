#!/usr/bin/env node
'use strict';
// Inicia todo el sistema en esta máquina (sin Docker):
//   frontend      http://localhost:8000   (PHP built-in server)
//   API Gateway   http://localhost:8080   (único punto público del backend)
//   sandbox pagos http://localhost:8090   (doble de prueba del proveedor externo)
// Los servicios privados escuchan solo en 127.0.0.1 y exigen identidad de servicio.
const { createStack } = require('./stack');

const stack = createStack();
stack
  .startAll()
  .then(() => {
    console.log('\nChocomanía en ejecución:');
    console.log('  Frontend:      http://localhost:8000');
    console.log('  API Gateway:   http://localhost:8080/api/v1');
    console.log('  Sandbox pagos: http://localhost:8090 (doble de prueba)');
    console.log('Ctrl+C para detener.\n');
  })
  .catch(async (err) => {
    console.error('Error al iniciar:', err.message);
    await stack.stopAll();
    process.exit(1);
  });

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await stack.stopAll();
    process.exit(0);
  });
}
