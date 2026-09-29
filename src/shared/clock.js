'use strict';

const { currentLocalDateTime } = require('./dateTime');

/**
 * "Годинник" передається в сервіси як залежність, а не викликається напряму через new Date().
 * Це дозволяє в тестах зафіксувати поточний час і перевіряти правила на кшталт
 * "не можна бронювати в минулому".
 */

/** Реальний час у часовому поясі залів. */
function createSystemClock(timeZone) {
  return { now: () => currentLocalDateTime(timeZone) };
}

/** Зафіксований час, наприклад createFixedClock("2024-08-01T09:00"). */
function createFixedClock(localDateTime) {
  return { now: () => localDateTime };
}

module.exports = { createSystemClock, createFixedClock };
