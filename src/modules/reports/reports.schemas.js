'use strict';

const { z, displayDateSchema } = require('../../shared/validation');
const { countDaysInclusive } = require('../../shared/dateTime');

const MAX_PERIOD_DAYS = 366;

const reportPeriodQuerySchema = z
  .strictObject({
    from: displayDateSchema,
    to: displayDateSchema,
  })
  .refine(({ from, to }) => from <= to, {
    message: 'Дата "from" не може бути пізніше за дату "to"',
    path: ['from'],
  })
  .refine(({ from, to }) => countDaysInclusive(from, to) <= MAX_PERIOD_DAYS, {
    message: `Період звіту не може перевищувати ${MAX_PERIOD_DAYS} днів`,
    path: ['to'],
  });

module.exports = { reportPeriodQuerySchema };
