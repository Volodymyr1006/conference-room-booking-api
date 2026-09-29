'use strict';

const pino = require('pino');

/**
 * Структуроване логування (JSON). У режимі розробки — зручний кольоровий вивід.
 * API-ключі автоматично приховуються, щоб не потрапити в логи.
 */
function createLogger({ logLevel, env }) {
  const isDevelopment = env === 'development';

  return pino({
    level: logLevel,
    redact: {
      paths: ['req.headers["x-api-key"]', 'req.headers.authorization'],
      censor: '[HIDDEN]',
    },
    ...(isDevelopment && {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
    }),
  });
}

module.exports = { createLogger };
