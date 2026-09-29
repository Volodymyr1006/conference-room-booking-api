'use strict';

const { MINUTES_IN_HOUR } = require('../../shared/dateTime');
const { TARIFF_SCHEDULE } = require('./tariffs');

const PERCENT_BASE = 100;

/**
 * Чисті функції розрахунку вартості (без бази даних і HTTP), тому їх легко тестувати.
 * Усі суми — в копійках.
 */

/**
 * Частина бронювання, що припадає на один тарифний інтервал.
 * Повертає null, якщо бронювання не перетинається з цим інтервалом.
 */
function calculateTariffSegment(tariff, basePricePerHour, startMinute, endMinute) {
  const segmentStart = Math.max(startMinute, tariff.startMinute);
  const segmentEnd = Math.min(endMinute, tariff.endMinute);
  if (segmentStart >= segmentEnd) return null;

  const minutes = segmentEnd - segmentStart;
  const amount = Math.round(
    (basePricePerHour * minutes * tariff.multiplierPercent) / (MINUTES_IN_HOUR * PERCENT_BASE),
  );

  return {
    tariff: tariff.code,
    startMinute: segmentStart,
    endMinute: segmentEnd,
    minutes,
    multiplierPercent: tariff.multiplierPercent,
    amount,
  };
}

/**
 * Вартість оренди залу. Бронювання розбивається на частини за тарифами,
 * і кожна частина рахується за своїм коефіцієнтом.
 * Приклад: 11:00–13:00 = 1 год стандарт (100%) + 1 год пік (115%).
 */
function calculateRentPrice({ basePricePerHour, startMinute, endMinute }, schedule = TARIFF_SCHEDULE) {
  const segments = schedule
    .map((tariff) => calculateTariffSegment(tariff, basePricePerHour, startMinute, endMinute))
    .filter(Boolean);

  const total = segments.reduce((sum, segment) => sum + segment.amount, 0);
  return { segments, total };
}

/** Вартість обраних послуг. Ціна послуги фіксована за одне бронювання. */
function calculateServicesPrice(services) {
  return services.reduce((sum, service) => sum + service.price, 0);
}

/** Повний розрахунок бронювання: оренда за тарифами + послуги. */
function calculateBookingPrice({ basePricePerHour, startMinute, endMinute, services }) {
  const rent = calculateRentPrice({ basePricePerHour, startMinute, endMinute });
  const servicesPrice = calculateServicesPrice(services);

  return {
    rentPrice: rent.total,
    servicesPrice,
    totalPrice: rent.total + servicesPrice,
    segments: rent.segments,
  };
}

module.exports = { calculateRentPrice, calculateServicesPrice, calculateBookingPrice };
