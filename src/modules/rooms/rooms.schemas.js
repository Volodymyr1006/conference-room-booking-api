'use strict';

const {
  z,
  capacitySchema,
  displayDateSchema,
  idSchema,
  moneySchema,
  nameSchema,
  timeOfDaySchema,
} = require('../../shared/validation');

const MAX_SERVICES_PER_ROOM = 50;

function hasUniqueNames(items) {
  const names = items.map((item) => item.name.toLocaleLowerCase('uk'));
  return new Set(names).size === names.length;
}

const serviceSchema = z.strictObject({
  name: nameSchema,
  price: moneySchema,
});

const servicesListSchema = z
  .array(serviceSchema)
  .max(MAX_SERVICES_PER_ROOM, `Не більше ${MAX_SERVICES_PER_ROOM} послуг на зал`)
  .refine(hasUniqueNames, 'Назви послуг у залі мають бути унікальними');

const createRoomBodySchema = z.strictObject({
  name: nameSchema,
  capacity: capacitySchema,
  basePricePerHour: moneySchema,
  services: servicesListSchema.default([]),
});

const updateRoomBodySchema = z
  .strictObject({
    name: nameSchema.optional(),
    capacity: capacitySchema.optional(),
    basePricePerHour: moneySchema.optional(),
    services: servicesListSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Передайте хоча б одне поле для оновлення');

const searchAvailableQuerySchema = z.strictObject({
  date: displayDateSchema,
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema,
  capacity: z.coerce.number().pipe(capacitySchema).default(1),
});

const roomServiceParamsSchema = z.strictObject({
  id: idSchema,
  serviceId: idSchema,
});

module.exports = {
  serviceSchema,
  createRoomBodySchema,
  updateRoomBodySchema,
  searchAvailableQuerySchema,
  roomServiceParamsSchema,
};
