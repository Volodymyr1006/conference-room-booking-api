'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');
const MIN_API_KEY_LENGTH = 16;

function readString(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function readRequiredString(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Не задано обов'язкову змінну оточення ${name}. Виконайте "npm run setup" або див. .env.example`);
  }
  return value;
}

function readInteger(name, fallback) {
  const raw = readString(name, undefined);
  if (raw === undefined) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`Змінна оточення ${name} має бути цілим числом, отримано "${raw}"`);
  }
  return value;
}

function readList(name) {
  return readString(name, '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateApiKeys({ admin, client }) {
  if (admin.length < MIN_API_KEY_LENGTH || client.length < MIN_API_KEY_LENGTH) {
    throw new Error(`API-ключі мають містити щонайменше ${MIN_API_KEY_LENGTH} символів`);
  }
  if (admin === client) {
    throw new Error('ADMIN_API_KEY і CLIENT_API_KEY мають відрізнятися');
  }
}

/**
 * Читає конфігурацію зі змінних оточення (і з файлу .env, якщо він є).
 * Помилка в конфігурації зупиняє запуск одразу, а не під час першого запиту (fail fast).
 */
function loadConfig() {
  if (fs.existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }

  const apiKeys = {
    admin: readRequiredString('ADMIN_API_KEY'),
    client: readRequiredString('CLIENT_API_KEY'),
  };
  validateApiKeys(apiKeys);

  return Object.freeze({
    env: readString('NODE_ENV', 'development'),
    port: readInteger('PORT', 3000),
    logLevel: readString('LOG_LEVEL', 'info'),
    databasePath: path.resolve(PROJECT_ROOT, readString('DATABASE_PATH', './data/booking.db')),
    timezone: readString('TIMEZONE', 'Europe/Kyiv'),
    apiKeys: Object.freeze(apiKeys),
    corsOrigins: readList('CORS_ORIGINS'),
    trustProxy: readInteger('TRUST_PROXY', 0),
    rateLimit: Object.freeze({
      windowMs: readInteger('RATE_LIMIT_WINDOW_MS', 60_000),
      max: readInteger('RATE_LIMIT_MAX', 100),
    }),
    seedOnStart: readString('SEED_ON_START', 'true') !== 'false',
  });
}

module.exports = { loadConfig };
