'use strict';

const { randomUUID } = require('node:crypto');
const { ConflictError, NotFoundError } = require('../../shared/errors');
const { createTimeSlot } = require('../pricing/timeSlot');
const { calculateRentPrice } = require('../pricing/pricingCalculator');

function withGeneratedId(service) {
  return { id: randomUUID(), ...service };
}

function isSameName(first, second) {
  return first.localeCompare(second, 'uk', { sensitivity: 'base' }) === 0;
}

/**
 * Бізнес-логіка роботи із залами.
 */
class RoomsService {
  constructor({ roomsRepository, bookingsRepository, clock }) {
    this.roomsRepository = roomsRepository;
    this.bookingsRepository = bookingsRepository;
    this.clock = clock;
  }

  list() {
    return this.roomsRepository.findAll();
  }

  getById(id) {
    const room = this.roomsRepository.findById(id);
    if (!room) throw new NotFoundError('Зал не знайдено');
    return room;
  }

  create({ name, capacity, basePricePerHour, services }) {
    this.#ensureNameIsAvailable(name);

    const room = {
      id: randomUUID(),
      name,
      capacity,
      basePricePerHour,
      services: services.map(withGeneratedId),
    };
    this.roomsRepository.create(room);
    return this.getById(room.id);
  }

  update(id, changes) {
    this.getById(id);
    if (changes.name !== undefined) this.#ensureNameIsAvailable(changes.name, id);

    this.roomsRepository.update(id, {
      ...changes,
      services: changes.services?.map(withGeneratedId),
    });
    return this.getById(id);
  }

  addService(roomId, service) {
    const room = this.getById(roomId);
    if (room.services.some((existing) => isSameName(existing.name, service.name))) {
      throw new ConflictError(`Послуга "${service.name}" вже є в залі "${room.name}"`);
    }

    this.roomsRepository.addService(roomId, withGeneratedId(service));
    return this.getById(roomId);
  }

  removeService(roomId, serviceId) {
    this.getById(roomId);
    if (!this.roomsRepository.removeService(roomId, serviceId)) {
      throw new NotFoundError('Послугу не знайдено в цьому залі');
    }
    return this.getById(roomId);
  }

  /**
   * Видаляє зал (м'яко — історія бронювань лишається для звітів).
   * Не можна видалити зал, у якому є майбутні підтверджені бронювання:
   * інакше клієнти прийдуть у зал, якого "немає".
   */
  remove(id) {
    const room = this.getById(id);
    const upcomingBookings = this.bookingsRepository.countUpcomingForRoom(id, this.clock.now());
    if (upcomingBookings > 0) {
      throw new ConflictError(
        `Неможливо видалити "${room.name}": є майбутні підтверджені бронювання. Спочатку скасуйте їх`,
        { upcomingBookings },
      );
    }
    this.roomsRepository.softDelete(id);
  }

  /** Пошук вільних залів на заданий проміжок із попереднім розрахунком вартості оренди. */
  findAvailable({ date, startTime, endTime, capacity }) {
    const slot = createTimeSlot({ date, startMinute: startTime, endMinute: endTime });
    const rooms = this.roomsRepository.findAvailable({
      minCapacity: capacity,
      startAt: slot.startAt,
      endAt: slot.endAt,
    });

    return {
      slot,
      rooms: rooms.map((room) => ({
        room,
        estimatedRentPrice: calculateRentPrice({
          basePricePerHour: room.basePricePerHour,
          startMinute: slot.startMinute,
          endMinute: slot.endMinute,
        }).total,
      })),
    };
  }

  #ensureNameIsAvailable(name, excludeRoomId) {
    if (this.roomsRepository.isNameTaken(name, excludeRoomId)) {
      throw new ConflictError(`Зал з назвою "${name}" вже існує`);
    }
  }
}

module.exports = { RoomsService };
