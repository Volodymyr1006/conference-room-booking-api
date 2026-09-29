'use strict';

/**
 * Утиліти для дат і часу.
 *
 * Усередині системи використовуються:
 *   - дата у форматі ISO:            "2024-09-01"
 *   - час як кількість хвилин від 00:00: 600 (= 10:00)
 *   - локальні дата й час:           "2024-09-01T10:00" (час залів, без часового поясу)
 * Такі рядки коректно порівнюються як звичайний текст, що спрощує SQL-запити.
 *
 * Назовні (в API) дата передається у звичному форматі "01.09.2024", час — "10:00".
 */

const MINUTES_IN_HOUR = 60;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

const DISPLAY_DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function padTwoDigits(value) {
  return String(value).padStart(2, '0');
}

/** "01.09.2024" → "2024-09-01". Повертає null для неіснуючої дати (наприклад, 31.02.2024). */
function parseDisplayDate(value) {
  const match = DISPLAY_DATE_PATTERN.exec(value);
  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const isRealDate =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day);

  return isRealDate ? `${year}-${month}-${day}` : null;
}

/** "2024-09-01" → "01.09.2024" */
function formatDisplayDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

/** "10:30" → 630. Повертає null для некоректного часу. */
function parseTime(value) {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * MINUTES_IN_HOUR + Number(match[2]);
}

/** 630 → "10:30" */
function formatTime(minutes) {
  return `${padTwoDigits(Math.floor(minutes / MINUTES_IN_HOUR))}:${padTwoDigits(minutes % MINUTES_IN_HOUR)}`;
}

/** ("2024-09-01", 600) → "2024-09-01T10:00" */
function toLocalDateTime(isoDate, minutes) {
  return `${isoDate}T${formatTime(minutes)}`;
}

/** "2024-09-01T10:00" → { date: "2024-09-01", minutes: 600 } */
function splitLocalDateTime(localDateTime) {
  const [date, time] = localDateTime.split('T');
  return { date, minutes: parseTime(time) };
}

/** Поточні дата й час у заданому часовому поясі у форматі "2024-09-01T10:00". */
function currentLocalDateTime(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

/** Кількість днів у періоді включно з обома датами: ("2024-09-01", "2024-09-30") → 30 */
function countDaysInclusive(fromIsoDate, toIsoDate) {
  return Math.round((Date.parse(toIsoDate) - Date.parse(fromIsoDate)) / MS_IN_DAY) + 1;
}

/** ("2024-09-30", 1) → "2024-10-01" */
function addDays(isoDate, days) {
  return new Date(Date.parse(isoDate) + days * MS_IN_DAY).toISOString().slice(0, 10);
}

module.exports = {
  MINUTES_IN_HOUR,
  parseDisplayDate,
  formatDisplayDate,
  parseTime,
  formatTime,
  toLocalDateTime,
  splitLocalDateTime,
  currentLocalDateTime,
  countDaysInclusive,
  addDays,
};
