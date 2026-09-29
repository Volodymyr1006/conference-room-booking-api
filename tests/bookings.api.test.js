'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, ADMIN, CLIENT } = require('./helpers/testApp');

describe('API бронювань', () => {
  let context;
  let hallA;

  beforeEach(async () => {
    context = createTestApp();
    hallA = await context.findRoomByName('Зал A');
  });

  function book(overrides = {}) {
    return context.api
      .post('/api/v1/bookings')
      .set(CLIENT)
      .send({
        roomId: hallA.id,
        date: '01.09.2024',
        startTime: '10:00',
        durationHours: 4,
        services: ['Проєктор', 'Wi-Fi'],
        customerName: 'ТОВ "Ромашка"',
        customerEmail: 'office@romashka.ua',
        ...overrides,
      });
  }

  it('бронює зал і повертає розрахунок загальної вартості', async () => {
    const response = await book().expect(201);
    const { data } = response.body;

    assert.equal(data.status, 'confirmed');
    assert.equal(data.startTime, '10:00');
    assert.equal(data.endTime, '14:00');
    assert.deepEqual(data.price, {
      currency: 'UAH',
      rent: 8600,
      services: 800,
      total: 9400,
      rentBreakdown: [
        { tariff: 'STANDARD', label: 'Стандартні години', from: '10:00', to: '12:00', hours: 2, multiplier: 1, amount: 4000 },
        { tariff: 'PEAK', label: 'Пікові години (націнка 15%)', from: '12:00', to: '14:00', hours: 2, multiplier: 1.15, amount: 4600 },
      ],
    });
    assert.match(response.body.message, /9400 грн/);
  });

  it('не дозволяє подвійне бронювання одного часу', async () => {
    await book().expect(201);
    const response = await book({ startTime: '13:30', durationHours: 1 }).expect(409);
    assert.equal(response.body.error.code, 'CONFLICT');
  });

  it('дозволяє бронювати впритул до іншого бронювання', async () => {
    await book().expect(201);
    await book({ startTime: '14:00', durationHours: 1 }).expect(201);
  });

  it('відхиляє послуги, яких немає в залі', async () => {
    const response = await book({ services: ['Кава'] }).expect(422);
    assert.deepEqual(response.body.error.details.unavailableServices, ['Кава']);
  });

  it('відхиляє бронювання в минулому', async () => {
    const response = await book({ date: '01.07.2024' }).expect(422);
    assert.equal(response.body.error.code, 'BUSINESS_RULE_VIOLATION');
  });

  it('відхиляє бронювання поза робочими годинами', async () => {
    await book({ startTime: '22:00', durationHours: 2 }).expect(422);
  });

  it('відхиляє неіснуючий зал', async () => {
    await book({ roomId: '00000000-0000-4000-8000-000000000000' }).expect(404);
  });

  it('розраховує вартість без створення бронювання', async () => {
    const response = await context.api
      .post('/api/v1/bookings/quote')
      .set(CLIENT)
      .send({ roomId: hallA.id, date: '01.09.2024', startTime: '18:00', durationHours: 2, services: ['Звук'] })
      .expect(200);

    assert.equal(response.body.data.price.rent, 3200); // вечір: 2 × 2000 × 0.8
    assert.equal(response.body.data.price.total, 3900);

    const list = await context.api.get('/api/v1/bookings').set(ADMIN).expect(200);
    assert.equal(list.body.pagination.total, 0);
  });

  it('ціна бронювання не змінюється, якщо потім змінили ціну залу', async () => {
    const booking = (await book().expect(201)).body.data;
    await context.api.patch(`/api/v1/rooms/${hallA.id}`).set(ADMIN).send({ basePricePerHour: 9999 }).expect(200);

    const response = await context.api.get(`/api/v1/bookings/${booking.id}`).set(CLIENT).expect(200);
    assert.equal(response.body.data.price.total, 9400);
  });

  it('скасовує бронювання й звільняє час', async () => {
    const booking = (await book().expect(201)).body.data;

    const cancelled = await context.api.post(`/api/v1/bookings/${booking.id}/cancel`).set(CLIENT).expect(200);
    assert.equal(cancelled.body.data.status, 'cancelled');

    await context.api.post(`/api/v1/bookings/${booking.id}/cancel`).set(CLIENT).expect(409);
    await book().expect(201);
  });

  it('список бронювань доступний лише адміністратору', async () => {
    await book().expect(201);
    await context.api.get('/api/v1/bookings').set(CLIENT).expect(403);

    const response = await context.api.get('/api/v1/bookings').query({ date: '01.09.2024' }).set(ADMIN).expect(200);
    assert.equal(response.body.pagination.total, 1);
  });
});
