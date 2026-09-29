'use strict';

const { CURRENCY, toHryvnias } = require('../../shared/money');

/**
 * Перетворення внутрішніх об'єктів (копійки, службові поля) у формат відповіді API (гривні).
 */

function presentService(service) {
  return { id: service.id, name: service.name, price: toHryvnias(service.price) };
}

function presentRoom(room) {
  return {
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    basePricePerHour: toHryvnias(room.basePricePerHour),
    currency: CURRENCY,
    services: room.services.map(presentService),
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

function presentAvailableRoom({ room, estimatedRentPrice }) {
  return { ...presentRoom(room), estimatedRentPrice: toHryvnias(estimatedRentPrice) };
}

module.exports = { presentRoom, presentAvailableRoom };
