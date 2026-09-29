'use strict';

const { CURRENCY, toHryvnias } = require('../../shared/money');
const { MINUTES_IN_HOUR, formatDisplayDate, formatTime, splitLocalDateTime } = require('../../shared/dateTime');
const { TARIFF_LABELS } = require('../pricing/tariffs');

function presentPriceSegment(segment) {
  return {
    tariff: segment.tariff,
    label: TARIFF_LABELS[segment.tariff],
    from: formatTime(segment.startMinute),
    to: formatTime(segment.endMinute),
    hours: segment.minutes / MINUTES_IN_HOUR,
    multiplier: segment.multiplierPercent / 100,
    amount: toHryvnias(segment.amount),
  };
}

function presentPrice({ rentPrice, servicesPrice, totalPrice, segments }) {
  return {
    currency: CURRENCY,
    rent: toHryvnias(rentPrice),
    services: toHryvnias(servicesPrice),
    total: toHryvnias(totalPrice),
    rentBreakdown: segments.map(presentPriceSegment),
  };
}

function presentSelectedServices(services) {
  return services.map(({ name, price }) => ({ name, price: toHryvnias(price) }));
}

function presentBooking(booking) {
  const start = splitLocalDateTime(booking.startAt);
  const end = splitLocalDateTime(booking.endAt);

  return {
    id: booking.id,
    status: booking.status,
    room: { id: booking.roomId, name: booking.roomName },
    customer: { name: booking.customerName, email: booking.customerEmail },
    date: formatDisplayDate(start.date),
    startTime: formatTime(start.minutes),
    endTime: formatTime(end.minutes),
    durationHours: booking.durationMinutes / MINUTES_IN_HOUR,
    services: presentSelectedServices(booking.services),
    price: presentPrice(booking),
    createdAt: booking.createdAt,
    cancelledAt: booking.cancelledAt,
  };
}

function presentQuote({ room, slot, services, price }) {
  return {
    room: { id: room.id, name: room.name },
    date: formatDisplayDate(slot.date),
    startTime: formatTime(slot.startMinute),
    endTime: formatTime(slot.endMinute),
    durationHours: slot.durationMinutes / MINUTES_IN_HOUR,
    services: presentSelectedServices(services),
    price: presentPrice(price),
  };
}

module.exports = { presentBooking, presentQuote };
