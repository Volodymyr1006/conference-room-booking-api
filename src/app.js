'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');

const { createAuthentication, API_KEY_HEADER } = require('./middlewares/authentication');
const { createRateLimiter } = require('./middlewares/rateLimiter');
const { createErrorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { createApiRouter } = require('./modules');

const MAX_BODY_SIZE = '10kb';
const OPENAPI_FILE = path.join(__dirname, 'docs', 'openapi.yaml');

function loadOpenApiDocument() {
  return YAML.parse(fs.readFileSync(OPENAPI_FILE, 'utf8'));
}

function requestLogger(logger) {
  return pinoHttp({
    logger,
    // Кожен запит отримує унікальний id — за ним легко знайти запит у логах
    genReqId: (req, res) => {
      const requestId = randomUUID();
      res.setHeader('X-Request-Id', requestId);
      return requestId;
    },
    customLogLevel: (req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  });
}

/** Перевірка стану сервісу для моніторингу та Docker/Kubernetes. */
function healthCheck(db) {
  return (req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ok', database: 'ok', uptimeSeconds: Math.round(process.uptime()) });
    } catch {
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  };
}

/**
 * Створює Express-застосунок. Усі залежності передаються ззовні,
 * тому в тестах можна підставити базу в пам'яті та зафіксований час.
 */
function createApp({ db, config, logger, clock }) {
  const app = express();
  const auth = createAuthentication(config.apiKeys);
  const openApiDocument = loadOpenApiDocument();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // Безпечні HTTP-заголовки (захист від XSS, clickjacking, MIME-sniffing тощо)
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
      allowedHeaders: ['Content-Type', API_KEY_HEADER],
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    }),
  );
  app.use(express.json({ limit: MAX_BODY_SIZE }));
  app.use(requestLogger(logger));

  app.get('/health', healthCheck(db));
  app.get('/api-docs.json', (req, res) => res.json(openApiDocument));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'Conference Rooms API' }));

  app.use(
    '/api/v1',
    createRateLimiter(config.rateLimit),
    auth.authenticate,
    createApiRouter({ db, clock, auth }),
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}

module.exports = { createApp };
