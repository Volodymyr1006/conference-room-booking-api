'use strict';

const { z, displayDateSchema, idSchema, nameSchema, timeOfDaySchema } = require('../../shared/validation');
const { BOOKING_STATUS } = require('./bookings.repository');

const MAX_DURATION_HOURS = 17;
const MAX_SELECTED_SERVICES = 50;
const MAX_PAGE_SIZE = 100;

/** Тривалість у годинах (2 або 1.5) → перетворюється на хвилини (120 або 90) */
const durationHoursSchema = z
  .number()
  .positive('Тривалість має бути більшою за 0')
  .max(MAX_DURATION_HOURS, `Тривалість не може перевищувати ${MAX_DURATION_HOURS} годин`)
  .refine((hours) => Number.isInteger(hours * 60), 'Тривалість має бути цілою кількістю хвилин')
  .transform((hours) => hours * 60);

const bookingRequestShape = {
  roomId: idSchema,
  date: displayDateSchema,
  startTime: timeOfDaySchema,
  durationHours: durationHoursSchema,
  services: z.array(nameSchema).max(MAX_SELECTED_SERVICES).default([]),
};

/** Приводимо поле durationHours до внутрішньої назви durationMinutes. */
function toServiceInput({ durationHours, ...rest }) {
  return { ...rest, durationMinutes: durationHours };
}

const quoteBodySchema = z.strictObject(bookingRequestShape).transform(toServiceInput);

const createBookingBodySchema = z
  .strictObject({
    ...bookingRequestShape,
    customerName: z.string().trim().min(2, 'Вкажіть ім’я клієнта (мінімум 2 символи)').max(100),
    customerEmail: z.email('Некоректна електронна пошта').max(254).optional(),
  })
  .transform(toServiceInput);

const listBookingsQuerySchema = z.strictObject({
  roomId: idSchema.optional(),
  date: displayDateSchema.optional(),
  status: z.enum(Object.values(BOOKING_STATUS)).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

module.exports = { quoteBodySchema, createBookingBodySchema, listBookingsQuerySchema };
