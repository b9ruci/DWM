'use strict';
// Arranque común: obtiene del gestor de secretos las claves internas
// (entrantes y salientes) que corresponden a este servicio según su ACL.
const { createLogger } = require('./logger');
const { createSecretsClient } = require('./secrets-client');
const { createServiceClient } = require('./http');

const DEFAULT_URLS = {
  auth: 'http://127.0.0.1:7001',
  graphql: 'http://127.0.0.1:7002',
  inventory: 'http://127.0.0.1:7003',
  orders: 'http://127.0.0.1:7004',
  clients: 'http://127.0.0.1:7005',
  payments: 'http://127.0.0.1:7006',
};

function serviceUrl(target) {
  return process.env[`${target.toUpperCase()}_URL`] || DEFAULT_URLS[target];
}

async function boot({ name, inbound = [], outbound = [] }) {
  const logger = createLogger(name);
  const secrets = createSecretsClient({ service: name, logger });
  const inboundKeys = {};
  for (const caller of inbound) inboundKeys[caller] = await secrets.get(`internal/${caller}--${name}`);
  const targets = {};
  for (const target of outbound) {
    targets[target] = { url: serviceUrl(target), key: await secrets.get(`internal/${name}--${target}`) };
  }
  const client = createServiceClient({ caller: name, targets, logger });
  return { logger, secrets, keyFor: (caller) => inboundKeys[caller], client };
}

module.exports = { boot, serviceUrl };
