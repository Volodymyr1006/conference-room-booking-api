'use strict';

const { CURRENCY, toHryvnias } = require('../../shared/money');
const { MINUTES_IN_HOUR, countDaysInclusive, formatDisplayDate, formatTime } = require('../../shared/dateTime');
const { TARIFF_LABELS } = require('../pricing/tariffs');

function toHours(minutes) {
  return Math.round((minutes / MINUTES_IN_HOUR) * 100) / 100;
}

function presentPeriod({ from, to }) {
  return { from: formatDisplayDate(from), to: formatDisplayDate(to), days: countDaysInclusive(from, to) };
}

function presentSummary(summary) {
  return {
    currency: CURRENCY,
    confirmedBookings: summary.confirmedBookings,
    cancelledBookings: summary.cancelledBookings,
    cancellationRatePercent: summary.cancellationRatePercent,
    revenue: {
      total: toHryvnias(summary.totalRevenue),
      rent: toHryvnias(summary.rentRevenue),
      services: toHryvnias(summary.servicesRevenue),
    },
    averageBookingValue: toHryvnias(summary.averageBookingValue),
    bookedHours: toHours(summary.bookedMinutes),
    averageDurationHours: toHours(summary.averageDurationMinutes),
  };
}

function presentRoomPerformance({ bookedMinutes, revenue, averageBookingValue, ...room }) {
  return {
    ...room,
    bookedHours: toHours(bookedMinutes),
    revenue: toHryvnias(revenue),
    averageBookingValue: toHryvnias(averageBookingValue),
  };
}

function presentServicePopularity({ revenue, ...service }) {
  return { ...service, revenue: toHryvnias(revenue) };
}

function presentTariff({ tariff, minutes, revenue, shareOfRentRevenuePercent }) {
  return {
    tariff,
    label: TARIFF_LABELS[tariff],
    bookedHours: toHours(minutes),
    revenue: toHryvnias(revenue),
    shareOfRentRevenuePercent,
  };
}

function presentHour({ startMinute, endMinute, bookingsCount, bookedMinutes }) {
  return {
    hour: `${formatTime(startMinute)}–${formatTime(endMinute)}`,
    bookingsCount,
    bookedHours: toHours(bookedMinutes),
  };
}

module.exports = {
  presentPeriod,
  presentSummary,
  presentRoomPerformance,
  presentServicePopularity,
  presentTariff,
  presentHour,
};
