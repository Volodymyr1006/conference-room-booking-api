'use strict';

const { BusinessRuleError } = require('../../shared/errors');
const { formatTime, toLocalDateTime } = require('../../shared/dateTime');
const { WORKING_HOURS, BOOKING_STEP_MINUTES } = require('./tariffs');

function ensureEndIsAfterStart(startMinute, endMinute) {
  if (endMinute <= startMinute) {
    throw new BusinessRuleError('Час завершення має бути пізніше за час початку');
  }
}

function ensureWithinWorkingHours(startMinute, endMinute) {
  const { openMinute, closeMinute } = WORKING_HOURS;
  if (startMinute < openMinute || endMinute > closeMinute) {
    throw new BusinessRuleError(
      `Зали можна бронювати лише з ${formatTime(openMinute)} до ${formatTime(closeMinute)}`,
    );
  }
}

function ensureAlignedToStep(startMinute, endMinute) {
  if (startMinute % BOOKING_STEP_MINUTES !== 0 || endMinute % BOOKING_STEP_MINUTES !== 0) {
    throw new BusinessRuleError(
      `Час початку і тривалість мають бути кратні ${BOOKING_STEP_MINUTES} хвилинам (наприклад, 10:00 або 10:30)`,
    );
  }
}

/**
 * Створює перевірений часовий проміжок у межах одного дня.
 * Кидає BusinessRuleError, якщо проміжок порушує правила бронювання.
 */
function createTimeSlot({ date, startMinute, endMinute }) {
  ensureEndIsAfterStart(startMinute, endMinute);
  ensureWithinWorkingHours(startMinute, endMinute);
  ensureAlignedToStep(startMinute, endMinute);

  return Object.freeze({
    date,
    startMinute,
    endMinute,
    durationMinutes: endMinute - startMinute,
    startAt: toLocalDateTime(date, startMinute),
    endAt: toLocalDateTime(date, endMinute),
  });
}

module.exports = { createTimeSlot };
