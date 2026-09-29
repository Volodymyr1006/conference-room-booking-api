'use strict';

const { z } = require('zod');
const { parseDisplayDate, parseTime } = require('./dateTime');
const { toKopecks, hasAtMostTwoDecimals } = require('./money');

// Стандартні повідомлення Zod — українською
z.config(z.locales.uk());

/**
 * Спільні схеми валідації, які перевикористовуються в різних модулях.
 */

const MAX_MONEY_AMOUNT = 1_000_000;
const MAX_CAPACITY = 10_000;

/** Дата "01.09.2024" → перетворюється на "2024-09-01" */
const displayDateSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const isoDate = parseDisplayDate(value);
    if (!isoDate) {
      ctx.addIssue({ code: 'custom', message: 'Дата має бути у форматі ДД.ММ.РРРР, наприклад 01.09.2024' });
      return z.NEVER;
    }
    return isoDate;
  });

/** Час "10:00" → перетворюється на кількість хвилин від початку доби (600) */
const timeOfDaySchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const minutes = parseTime(value);
    if (minutes === null) {
      ctx.addIssue({ code: 'custom', message: 'Час має бути у форматі ГГ:ХХ, наприклад 10:00' });
      return z.NEVER;
    }
    return minutes;
  });

/** Сума в гривнях (500 або 499.99) → перетворюється на копійки (50000) */
const moneySchema = z
  .number()
  .nonnegative('Сума не може бути від’ємною')
  .max(MAX_MONEY_AMOUNT, `Сума не може перевищувати ${MAX_MONEY_AMOUNT} грн`)
  .refine(hasAtMostTwoDecimals, 'Сума може містити не більше двох знаків після коми')
  .transform(toKopecks);

const capacitySchema = z
  .number()
  .int('Місткість має бути цілим числом')
  .positive('Місткість має бути більшою за 0')
  .max(MAX_CAPACITY, `Місткість не може перевищувати ${MAX_CAPACITY}`);

const nameSchema = z.string().trim().min(1, 'Назва не може бути порожньою').max(100, 'Назва задовга (максимум 100 символів)');

const idSchema = z.uuid('Некоректний ідентифікатор');

const idParamsSchema = z.strictObject({ id: idSchema });

module.exports = {
  z,
  displayDateSchema,
  timeOfDaySchema,
  moneySchema,
  capacitySchema,
  nameSchema,
  idSchema,
  idParamsSchema,
};
