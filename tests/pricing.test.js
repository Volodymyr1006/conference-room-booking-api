'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateRentPrice, calculateBookingPrice } = require('../src/modules/pricing/pricingCalculator');
const { createTimeSlot } = require('../src/modules/pricing/timeSlot');
const { BusinessRuleError } = require('../src/shared/errors');

const HOUR = 60;
const HALL_A_PRICE = 2000_00; // 2000 грн у копійках

function rent(startHour, endHour, basePricePerHour = HALL_A_PRICE) {
  return calculateRentPrice({ basePricePerHour, startMinute: startHour * HOUR, endMinute: endHour * HOUR }).total;
}

describe('Розрахунок вартості оренди', () => {
  it('стандартні години — базова ціна', () => {
    assert.equal(rent(9, 11), 4000_00);
    assert.equal(rent(14, 18), 8000_00);
  });

  it('ранкові години — знижка 10%', () => {
    assert.equal(rent(6, 9), 5400_00); // 3 × 2000 × 0.9
  });

  it('вечірні години — знижка 20%', () => {
    assert.equal(rent(18, 23), 8000_00); // 5 × 2000 × 0.8
  });

  it('пікові години — націнка 15%', () => {
    assert.equal(rent(12, 14), 4600_00); // 2 × 2000 × 1.15
  });

  it('бронювання через кілька тарифів рахується частинами (приклад із ТЗ: 10:00–14:00)', () => {
    const { total, segments } = calculateRentPrice({
      basePricePerHour: HALL_A_PRICE,
      startMinute: 10 * HOUR,
      endMinute: 14 * HOUR,
    });

    assert.equal(total, 8600_00); // 2 × 2000 + 2 × 2000 × 1.15
    assert.deepEqual(
      segments.map((segment) => [segment.tariff, segment.minutes, segment.amount]),
      [
        ['STANDARD', 120, 4000_00],
        ['PEAK', 120, 4600_00],
      ],
    );
  });

  it('весь робочий день 06:00–23:00', () => {
    // ранок 5400 + стандарт 3×2000 + пік 4600 + стандарт 4×2000 + вечір 8000
    assert.equal(rent(6, 23), 5400_00 + 6000_00 + 4600_00 + 8000_00 + 8000_00);
  });

  it('пів години рахується пропорційно', () => {
    const total = calculateRentPrice({
      basePricePerHour: HALL_A_PRICE,
      startMinute: 8 * HOUR + 30,
      endMinute: 9 * HOUR + 30,
    }).total;
    assert.equal(total, 900_00 + 1000_00); // 0.5 год ранок + 0.5 год стандарт
  });

  it('послуги додаються до вартості оренди без знижок', () => {
    const price = calculateBookingPrice({
      basePricePerHour: HALL_A_PRICE,
      startMinute: 18 * HOUR,
      endMinute: 20 * HOUR,
      services: [{ price: 500_00 }, { price: 300_00 }],
    });

    assert.equal(price.rentPrice, 3200_00);
    assert.equal(price.servicesPrice, 800_00);
    assert.equal(price.totalPrice, 4000_00);
  });
});

describe('Перевірка часового проміжку', () => {
  const date = '2024-09-01';

  it('створює проміжок у робочий час', () => {
    const slot = createTimeSlot({ date, startMinute: 10 * HOUR, endMinute: 14 * HOUR });
    assert.equal(slot.startAt, '2024-09-01T10:00');
    assert.equal(slot.endAt, '2024-09-01T14:00');
    assert.equal(slot.durationMinutes, 240);
  });

  it('відхиляє час поза 06:00–23:00', () => {
    assert.throws(() => createTimeSlot({ date, startMinute: 5 * HOUR, endMinute: 7 * HOUR }), BusinessRuleError);
    assert.throws(() => createTimeSlot({ date, startMinute: 22 * HOUR, endMinute: 24 * HOUR }), BusinessRuleError);
  });

  it('відхиляє завершення раніше за початок', () => {
    assert.throws(() => createTimeSlot({ date, startMinute: 14 * HOUR, endMinute: 10 * HOUR }), BusinessRuleError);
  });

  it('відхиляє час, не кратний 30 хвилинам', () => {
    assert.throws(() => createTimeSlot({ date, startMinute: 10 * HOUR + 15, endMinute: 12 * HOUR }), BusinessRuleError);
  });
});
