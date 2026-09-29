'use strict';

const { randomUUID } = require('node:crypto');
const { RoomsRepository } = require('../modules/rooms/rooms.repository');
const { toKopecks } = require('../shared/money');

/** Початкові дані з технічного завдання (ціни в гривнях). */
const INITIAL_SERVICES = Object.freeze([
  { name: 'Проєктор', price: 500 },
  { name: 'Wi-Fi', price: 300 },
  { name: 'Звук', price: 700 },
]);

const INITIAL_ROOMS = Object.freeze([
  { name: 'Зал A', capacity: 50, basePricePerHour: 2000 },
  { name: 'Зал B', capacity: 100, basePricePerHour: 3500 },
  { name: 'Зал C', capacity: 30, basePricePerHour: 1500 },
]);

function buildInitialRoom({ name, capacity, basePricePerHour }) {
  return {
    id: randomUUID(),
    name,
    capacity,
    basePricePerHour: toKopecks(basePricePerHour),
    services: INITIAL_SERVICES.map((service) => ({
      id: randomUUID(),
      name: service.name,
      price: toKopecks(service.price),
    })),
  };
}

/**
 * Додає зали A, B, C з послугами, якщо в базі ще немає жодного залу.
 * @returns {boolean} true, якщо дані було додано
 */
function seedInitialData(db) {
  const roomsCount = db.prepare('SELECT COUNT(*) FROM rooms').pluck().get();
  if (roomsCount > 0) return false;

  const roomsRepository = new RoomsRepository(db);
  db.transaction(() => {
    INITIAL_ROOMS.map(buildInitialRoom).forEach((room) => roomsRepository.create(room));
  })();

  return true;
}

module.exports = { seedInitialData };
