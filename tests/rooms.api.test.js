'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, ADMIN, CLIENT } = require('./helpers/testApp');

describe('API залів', () => {
  let context;
  beforeEach(() => {
    context = createTestApp();
  });

  it('початкові дані: зали A, B, C з послугами', async () => {
    const response = await context.api.get('/api/v1/rooms').set(CLIENT).expect(200);

    const summary = response.body.data.map(({ name, capacity, basePricePerHour }) => [name, capacity, basePricePerHour]);
    assert.deepEqual(summary, [
      ['Зал A', 50, 2000],
      ['Зал B', 100, 3500],
      ['Зал C', 30, 1500],
    ]);
    assert.deepEqual(
      response.body.data[0].services.map(({ name, price }) => [name, price]).sort(),
      [['Wi-Fi', 300], ['Звук', 700], ['Проєктор', 500]].sort(),
    );
  });

  it('створює зал і повертає унікальний id', async () => {
    const response = await context.api
      .post('/api/v1/rooms')
      .set(ADMIN)
      .send({ name: 'Зал D', capacity: 20, basePricePerHour: 1000, services: [{ name: 'Wi-Fi', price: 300 }] })
      .expect(201);

    assert.equal(response.body.message, 'Зал успішно створено');
    assert.match(response.body.data.id, /^[0-9a-f-]{36}$/);
    assert.equal(response.headers.location, `/api/v1/rooms/${response.body.data.id}`);
  });

  it('не дозволяє дві однакові назви залу', async () => {
    const response = await context.api
      .post('/api/v1/rooms')
      .set(ADMIN)
      .send({ name: 'Зал A', capacity: 10, basePricePerHour: 100 })
      .expect(409);
    assert.equal(response.body.error.code, 'CONFLICT');
  });

  it('повертає зрозумілі помилки валідації', async () => {
    const response = await context.api
      .post('/api/v1/rooms')
      .set(ADMIN)
      .send({ name: '', capacity: -5, basePricePerHour: 'дорого', unknownField: true })
      .expect(400);

    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
    const fields = response.body.error.details.map((issue) => issue.field);
    assert.ok(fields.includes('name'));
    assert.ok(fields.includes('capacity'));
    assert.ok(fields.includes('basePricePerHour'));
  });

  it('редагує ціну (приклад із ТЗ: 2000 → 2500) і додає послугу "Звук"', async () => {
    const room = await context.findRoomByName('Зал C');
    const withoutSound = room.services
      .filter((service) => service.name !== 'Звук')
      .map(({ name, price }) => ({ name, price }));
    await context.api.patch(`/api/v1/rooms/${room.id}`).set(ADMIN).send({ services: withoutSound }).expect(200);

    const updated = await context.api
      .patch(`/api/v1/rooms/${room.id}`)
      .set(ADMIN)
      .send({ basePricePerHour: 2500 })
      .expect(200);
    assert.equal(updated.body.message, 'Інформацію про зал успішно оновлено');
    assert.equal(updated.body.data.basePricePerHour, 2500);

    const withSound = await context.api
      .post(`/api/v1/rooms/${room.id}/services`)
      .set(ADMIN)
      .send({ name: 'Звук', price: 700 })
      .expect(201);
    assert.ok(withSound.body.data.services.some((service) => service.name === 'Звук' && service.price === 700));
  });

  it('видаляє зал', async () => {
    const room = await context.findRoomByName('Зал C');
    const response = await context.api.delete(`/api/v1/rooms/${room.id}`).set(ADMIN).expect(200);

    assert.equal(response.body.message, 'Зал успішно видалено');
    await context.api.get(`/api/v1/rooms/${room.id}`).set(CLIENT).expect(404);
  });

  it('не видаляє зал з майбутніми бронюваннями', async () => {
    const room = await context.findRoomByName('Зал C');
    await context.api
      .post('/api/v1/bookings')
      .set(CLIENT)
      .send({ roomId: room.id, date: '01.09.2024', startTime: '10:00', durationHours: 2, customerName: 'Клієнт' })
      .expect(201);

    const response = await context.api.delete(`/api/v1/rooms/${room.id}`).set(ADMIN).expect(409);
    assert.equal(response.body.error.details.upcomingBookings, 1);
  });

  it('клієнт не може змінювати зали', async () => {
    const room = await context.findRoomByName('Зал A');
    await context.api.patch(`/api/v1/rooms/${room.id}`).set(CLIENT).send({ capacity: 1 }).expect(403);
    await context.api.delete(`/api/v1/rooms/${room.id}`).set(CLIENT).expect(403);
  });

  describe('пошук доступних залів', () => {
    const search = (query) => context.api.get('/api/v1/rooms/available').query(query).set(CLIENT);

    it('приклад із ТЗ: 01.09.2024, 10:00–14:00, 50 осіб', async () => {
      const response = await search({ date: '01.09.2024', startTime: '10:00', endTime: '14:00', capacity: 50 }).expect(200);

      assert.deepEqual(response.body.data.map((room) => room.name), ['Зал A', 'Зал B']);
      assert.equal(response.body.data[0].estimatedRentPrice, 8600);
    });

    it('не показує зал, зайнятий у цей час', async () => {
      const hallA = await context.findRoomByName('Зал A');
      await context.api
        .post('/api/v1/bookings')
        .set(CLIENT)
        .send({ roomId: hallA.id, date: '01.09.2024', startTime: '13:00', durationHours: 2, customerName: 'Клієнт' })
        .expect(201);

      const response = await search({ date: '01.09.2024', startTime: '10:00', endTime: '14:00', capacity: 50 }).expect(200);
      assert.deepEqual(response.body.data.map((room) => room.name), ['Зал B']);
    });

    it('зал знову доступний одразу після завершення бронювання', async () => {
      const hallA = await context.findRoomByName('Зал A');
      await context.api
        .post('/api/v1/bookings')
        .set(CLIENT)
        .send({ roomId: hallA.id, date: '01.09.2024', startTime: '08:00', durationHours: 2, customerName: 'Клієнт' })
        .expect(201);

      const response = await search({ date: '01.09.2024', startTime: '10:00', endTime: '14:00', capacity: 50 }).expect(200);
      assert.ok(response.body.data.some((room) => room.name === 'Зал A'));
    });

    it('відхиляє некоректну дату', async () => {
      await search({ date: '31.02.2024', startTime: '10:00', endTime: '14:00' }).expect(400);
    });
  });
});
