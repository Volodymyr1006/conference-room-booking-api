'use strict';

const pino = require('pino');
const request = require('supertest');
const { openDatabase, IN_MEMORY } = require('../../src/db/connection');
const { runMigrations } = require('../../src/db/migrator');
const { seedInitialData } = require('../../src/db/seed');
const { createFixedClock } = require('../../src/shared/clock');
const { createApp } = require('../../src/app');

const ADMIN_KEY = 'test-admin-key-1234567890';
const CLIENT_KEY = 'test-client-key-1234567890';

const ADMIN = { 'X-API-Key': ADMIN_KEY };
const CLIENT = { 'X-API-Key': CLIENT_KEY };

/** "Зараз" у тестах — 1 серпня 2024, 09:00. Тож дата з ТЗ (01.09.2024) — у майбутньому. */
const DEFAULT_NOW = '2024-08-01T09:00';

/**
 * Створює ізольований застосунок з базою в пам'яті й початковими даними.
 * Кожен тест отримує чисту базу.
 */
function createTestApp({ now = DEFAULT_NOW, rateLimitMax = 10_000 } = {}) {
  const db = openDatabase(IN_MEMORY);
  runMigrations(db);
  seedInitialData(db);

  const config = {
    apiKeys: { admin: ADMIN_KEY, client: CLIENT_KEY },
    corsOrigins: [],
    trustProxy: 0,
    rateLimit: { windowMs: 60_000, max: rateLimitMax },
  };
  const app = createApp({ db, config, logger: pino({ level: 'silent' }), clock: createFixedClock(now) });
  const api = request(app);

  async function findRoomByName(name) {
    const response = await api.get('/api/v1/rooms').set(CLIENT);
    return response.body.data.find((room) => room.name === name);
  }

  return { app, api, db, findRoomByName };
}

module.exports = { createTestApp, ADMIN, CLIENT };
