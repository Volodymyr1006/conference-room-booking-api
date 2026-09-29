'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, CLIENT } = require('./helpers/testApp');

describe('Безпека API', () => {
  it('без API-ключа — 401', async () => {
    const { api } = createTestApp();
    const response = await api.get('/api/v1/rooms').expect(401);
    assert.equal(response.body.error.code, 'UNAUTHORIZED');
  });

  it('з неправильним API-ключем — 401', async () => {
    const { api } = createTestApp();
    await api.get('/api/v1/rooms').set('X-API-Key', 'wrong-key').expect(401);
  });

  it('обмежує частоту запитів', async () => {
    const { api } = createTestApp({ rateLimitMax: 2 });
    await api.get('/api/v1/rooms').set(CLIENT).expect(200);
    await api.get('/api/v1/rooms').set(CLIENT).expect(200);
    const response = await api.get('/api/v1/rooms').set(CLIENT).expect(429);
    assert.equal(response.body.error.code, 'TOO_MANY_REQUESTS');
  });

  it('некоректний JSON — 400 без технічних подробиць', async () => {
    const { api } = createTestApp();
    const response = await api
      .post('/api/v1/bookings')
      .set(CLIENT)
      .set('Content-Type', 'application/json')
      .send('{"roomId": ')
      .expect(400);
    assert.equal(response.body.error.message, 'Тіло запиту містить некоректний JSON');
  });

  it('SQL-ін’єкція в параметрі не спрацьовує', async () => {
    const { api } = createTestApp();
    await api.get(`/api/v1/rooms/${encodeURIComponent("' OR 1=1 --")}`).set(CLIENT).expect(400);
  });

  it('встановлює безпечні заголовки й не розкриває технологію', async () => {
    const { api } = createTestApp();
    const response = await api.get('/health').expect(200);
    assert.equal(response.headers['x-powered-by'], undefined);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.ok(response.headers['x-request-id']);
  });

  it('невідомий маршрут — 404 у єдиному форматі', async () => {
    const { api } = createTestApp();
    const response = await api.get('/api/v1/unknown').set(CLIENT).expect(404);
    assert.equal(response.body.error.code, 'NOT_FOUND');
  });
});
