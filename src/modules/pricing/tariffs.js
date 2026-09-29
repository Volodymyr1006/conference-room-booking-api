'use strict';

/**
 * Тарифна сітка та правила робочого часу.
 * Щоб змінити знижки/націнки або додати новий тариф, достатньо змінити цей файл:
 * решта коду працює з розкладом як з даними.
 */

const HOUR = 60;

/** Зали працюють з 06:00 до 23:00 (для інших годин у ТЗ немає тарифу). */
const WORKING_HOURS = Object.freeze({
  openMinute: 6 * HOUR,
  closeMinute: 23 * HOUR,
});

/** Час початку й тривалість бронювання мають бути кратні 30 хвилинам (10:00, 10:30, ...). */
const BOOKING_STEP_MINUTES = 30;

const TARIFF_CODES = Object.freeze({
  MORNING: 'MORNING',
  STANDARD: 'STANDARD',
  PEAK: 'PEAK',
  EVENING: 'EVENING',
});

const TARIFF_LABELS = Object.freeze({
  [TARIFF_CODES.MORNING]: 'Ранкові години (знижка 10%)',
  [TARIFF_CODES.STANDARD]: 'Стандартні години',
  [TARIFF_CODES.PEAK]: 'Пікові години (націнка 15%)',
  [TARIFF_CODES.EVENING]: 'Вечірні години (знижка 20%)',
});

/**
 * Розклад тарифів протягом доби. Інтервали не перетинаються й повністю покривають робочий час.
 * Пікові години (12:00–14:00) входять у стандартний час (09:00–18:00), тому мають пріоритет:
 * стандартний тариф розбито на два інтервали — до піку і після нього.
 * multiplierPercent: 100 — базова ціна, 90 — знижка 10%, 115 — націнка 15%.
 */
const TARIFF_SCHEDULE = Object.freeze(
  [
    { code: TARIFF_CODES.MORNING, startMinute: 6 * HOUR, endMinute: 9 * HOUR, multiplierPercent: 90 },
    { code: TARIFF_CODES.STANDARD, startMinute: 9 * HOUR, endMinute: 12 * HOUR, multiplierPercent: 100 },
    { code: TARIFF_CODES.PEAK, startMinute: 12 * HOUR, endMinute: 14 * HOUR, multiplierPercent: 115 },
    { code: TARIFF_CODES.STANDARD, startMinute: 14 * HOUR, endMinute: 18 * HOUR, multiplierPercent: 100 },
    { code: TARIFF_CODES.EVENING, startMinute: 18 * HOUR, endMinute: 23 * HOUR, multiplierPercent: 80 },
  ].map(Object.freeze),
);

module.exports = {
  WORKING_HOURS,
  BOOKING_STEP_MINUTES,
  TARIFF_CODES,
  TARIFF_LABELS,
  TARIFF_SCHEDULE,
};
