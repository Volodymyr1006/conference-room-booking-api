'use strict';

const { randomUUID } = require('node:crypto');
const { BusinessRuleError, ConflictError, NotFoundError } = require('../../shared/errors');
const { createTimeSlot } = require('../pricing/timeSlot');
const { calculateBookingPrice } = require('../pricing/pricingCalculator');
const { BOOKING_STATUS } = require('./bookings.repository');

function normalizeName(name) {
  return name.toLocaleLowerCase('uk');
}

/**
 * Бізнес-логіка бронювань: перевірка правил, розрахунок вартості, створення та скасування.
 */
class BookingsService {
  constructor({ bookingsRepository, roomsRepository, clock }) {
    this.bookingsRepository = bookingsRepository;
    this.roomsRepository = roomsRepository;
    this.clock = clock;
  }

  /** Розрахунок вартості без створення бронювання ("скільки це коштуватиме?"). */
  quote({ roomId, date, startTime, durationMinutes, services }) {
    const room = this.#getRoom(roomId);
    const slot = createTimeSlot({ date, startMinute: startTime, endMinute: startTime + durationMinutes });
    const selectedServices = this.#resolveServices(room, services);
    const price = calculateBookingPrice({
      basePricePerHour: room.basePricePerHour,
      startMinute: slot.startMinute,
      endMinute: slot.endMinute,
      services: selectedServices,
    });

    return { room, slot, services: selectedServices, price };
  }

  create({ customerName, customerEmail, ...bookingRequest }) {
    const { room, slot, services, price } = this.quote(bookingRequest);
    this.#ensureNotInPast(slot.startAt);

    const booking = {
      id: randomUUID(),
      roomId: room.id,
      customerName,
      customerEmail: customerEmail ?? null,
      startAt: slot.startAt,
      endAt: slot.endAt,
      durationMinutes: slot.durationMinutes,
      services,
      ...price,
    };

    if (!this.bookingsRepository.createIfSlotIsFree(booking)) {
      throw new ConflictError(`"${room.name}" вже заброньовано на цей час. Оберіть інший час або зал`);
    }
    return this.getById(booking.id);
  }

  getById(id) {
    const booking = this.bookingsRepository.findById(id);
    if (!booking) throw new NotFoundError('Бронювання не знайдено');
    return booking;
  }

  list({ limit, offset, ...filters }) {
    return this.bookingsRepository.findMany({ filters, limit, offset });
  }

  cancel(id) {
    const booking = this.getById(id);
    if (booking.status === BOOKING_STATUS.CANCELLED) {
      throw new ConflictError('Бронювання вже скасовано');
    }
    if (booking.startAt <= this.clock.now()) {
      throw new BusinessRuleError('Неможливо скасувати бронювання, яке вже почалося або завершилося');
    }

    this.bookingsRepository.cancel(id);
    return this.getById(id);
  }

  #getRoom(roomId) {
    const room = this.roomsRepository.findById(roomId);
    if (!room) throw new NotFoundError('Зал не знайдено');
    return room;
  }

  /** Знаходить обрані послуги серед послуг залу (без урахування регістру, без дублікатів). */
  #resolveServices(room, requestedNames) {
    const uniqueNames = [...new Map(requestedNames.map((name) => [normalizeName(name), name])).values()];
    const roomServices = new Map(room.services.map((service) => [normalizeName(service.name), service]));

    const unavailable = uniqueNames.filter((name) => !roomServices.has(normalizeName(name)));
    if (unavailable.length > 0) {
      throw new BusinessRuleError(`Обрані послуги недоступні в "${room.name}"`, {
        unavailableServices: unavailable,
        availableServices: room.services.map((service) => service.name),
      });
    }

    return uniqueNames.map((name) => {
      const service = roomServices.get(normalizeName(name));
      return { name: service.name, price: service.price };
    });
  }

  #ensureNotInPast(startAt) {
    if (startAt <= this.clock.now()) {
      throw new BusinessRuleError('Неможливо забронювати зал на час, що вже минув');
    }
  }
}

module.exports = { BookingsService };
