'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, ADMIN, CLIENT } = require('./helpers/testApp');

const PERIOD = { from: '01.09.2024', to: '30.09.2024' };

describe('API звітів', () => {
  let context;

  beforeEach(async () => {
    context = createTestApp();
    const hallA = await context.findRoomByName('Зал A');
    const hallB = await context.findRoomByName('Зал B');

    const book = (body) =>
      context.api.post('/api/v1/bookings').set(CLIENT).send({ customerName: 'Клієнт', ...body }).expect(201);

    // Зал A: 10:00–14:00 (8600) + Проєктор (500) = 9100
    await book({ roomId: hallA.id, date: '01.09.2024', startTime: '10:00', durationHours: 4, services: ['Проєктор'] });
    // Зал B: 18:00–20:00 (2 × 3500 × 0.8 = 5600) + Проєктор + Wi-Fi (800) = 6400
    await book({ roomId: hallB.id, date: '02.09.2024', startTime: '18:00', durationHours: 2, services: ['Проєктор', 'Wi-Fi'] });
    // Скасоване бронювання не враховується у виручці
    const cancelled = await book({ roomId: hallB.id, date: '03.09.2024', startTime: '10:00', durationHours: 1 });
    await context.api.post(`/api/v1/bookings/${cancelled.body.data.id}/cancel`).set(CLIENT).expect(200);
  });

  const report = (name) => context.api.get(`/api/v1/reports/${name}`).query(PERIOD).set(ADMIN).expect(200);

  it('summary: виручка, кількість і частка скасувань', async () => {
    const { data } = (await report('summary')).body;

    assert.equal(data.confirmedBookings, 2);
    assert.equal(data.cancelledBookings, 1);
    assert.equal(data.cancellationRatePercent, 33.3);
    assert.deepEqual(data.revenue, { total: 15500, rent: 14200, services: 1300 });
    assert.equal(data.averageBookingValue, 7750);
    assert.equal(data.bookedHours, 6);
  });

  it('rooms: виручка й завантаженість по залах', async () => {
    const { data, period } = (await report('rooms')).body;

    assert.equal(period.days, 30);
    assert.deepEqual(
      data.map((room) => [room.roomName, room.bookingsCount, room.revenue]),
      [
        ['Зал A', 1, 9100],
        ['Зал B', 1, 6400],
        ['Зал C', 0, 0],
      ],
    );
    // 4 год / (30 днів × 17 год) = 0.78%
    assert.equal(data[0].occupancyRatePercent, 0.8);
  });

  it('services: найпопулярніші послуги', async () => {
    const { data } = (await report('services')).body;
    assert.deepEqual(data[0], { serviceName: 'Проєктор', timesOrdered: 2, shareOfBookingsPercent: 100, revenue: 1000 });
  });

  it('tariffs: виручка за тарифами', async () => {
    const { data } = (await report('tariffs')).body;
    const byTariff = Object.fromEntries(data.map((row) => [row.tariff, row.revenue]));
    assert.deepEqual(byTariff, { MORNING: 0, STANDARD: 4000, PEAK: 4600, EVENING: 5600 });
  });

  it('hourly-demand: попит за годинами', async () => {
    const { data } = (await report('hourly-demand')).body;
    assert.equal(data.length, 17);
    assert.equal(data.find((hour) => hour.hour === '12:00–13:00').bookingsCount, 1);
    assert.equal(data.find((hour) => hour.hour === '06:00–07:00').bookingsCount, 0);
  });

  it('звіти недоступні клієнту', async () => {
    await context.api.get('/api/v1/reports/summary').query(PERIOD).set(CLIENT).expect(403);
  });

  it('перевіряє коректність періоду', async () => {
    await context.api.get('/api/v1/reports/summary').query({ from: '30.09.2024', to: '01.09.2024' }).set(ADMIN).expect(400);
  });
});
