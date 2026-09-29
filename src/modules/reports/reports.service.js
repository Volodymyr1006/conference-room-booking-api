'use strict';

const { MINUTES_IN_HOUR, addDays, countDaysInclusive, splitLocalDateTime } = require('../../shared/dateTime');
const { TARIFF_CODES, WORKING_HOURS } = require('../pricing/tariffs');

const WORKING_MINUTES_PER_DAY = WORKING_HOURS.closeMinute - WORKING_HOURS.openMinute;

/** Відсоток з одним знаком після коми: percentage(1, 3) → 33.3 */
function percentage(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

function average(total, count) {
  return count > 0 ? Math.round(total / count) : 0;
}

function toDateRange({ from, to }) {
  return { fromAt: `${from}T00:00`, toExclusiveAt: `${addDays(to, 1)}T00:00` };
}

function overlapMinutes(startA, endA, startB, endB) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

/**
 * Звіти для бізнесу. Кожен звіт відповідає на конкретне питання:
 *  - summary       — скільки заробили і скільки бронювань скасовано?
 *  - rooms         — які зали приносять найбільше грошей, а які простоюють?
 *  - services      — які послуги замовляють найчастіше?
 *  - tariffs       — скільки виручки дають ранкові/пікові/вечірні години (чи працюють знижки)?
 *  - hourlyDemand  — у які години зали найзавантаженіші (для планування цін і персоналу)?
 */
class ReportsService {
  constructor({ reportsRepository }) {
    this.reportsRepository = reportsRepository;
  }

  getSummary(period) {
    const summary = this.reportsRepository.getSummary(toDateRange(period));
    const allBookings = summary.confirmedCount + summary.cancelledCount;

    return {
      confirmedBookings: summary.confirmedCount,
      cancelledBookings: summary.cancelledCount,
      cancellationRatePercent: percentage(summary.cancelledCount, allBookings),
      totalRevenue: summary.totalRevenue,
      rentRevenue: summary.rentRevenue,
      servicesRevenue: summary.servicesRevenue,
      averageBookingValue: average(summary.totalRevenue, summary.confirmedCount),
      bookedMinutes: summary.bookedMinutes,
      averageDurationMinutes: average(summary.bookedMinutes, summary.confirmedCount),
    };
  }

  /** Завантаженість = заброньований час / увесь робочий час залу за період. */
  getRoomsPerformance(period) {
    const availableMinutes = countDaysInclusive(period.from, period.to) * WORKING_MINUTES_PER_DAY;

    return this.reportsRepository.getRoomsPerformance(toDateRange(period)).map((room) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      capacity: room.capacity,
      isDeleted: Boolean(room.isDeleted),
      bookingsCount: room.bookingsCount,
      bookedMinutes: room.bookedMinutes,
      occupancyRatePercent: percentage(room.bookedMinutes, availableMinutes),
      revenue: room.revenue,
      averageBookingValue: average(room.revenue, room.bookingsCount),
    }));
  }

  getServicesPopularity(period) {
    const range = toDateRange(period);
    const { confirmedCount } = this.reportsRepository.getSummary(range);

    return this.reportsRepository.getServicesPopularity(range).map((service) => ({
      serviceName: service.serviceName,
      timesOrdered: service.timesOrdered,
      shareOfBookingsPercent: percentage(service.timesOrdered, confirmedCount),
      revenue: service.revenue,
    }));
  }

  getTariffsBreakdown(period) {
    const rows = new Map(
      this.reportsRepository.getTariffsBreakdown(toDateRange(period)).map((row) => [row.tariff, row]),
    );
    const totalRentRevenue = [...rows.values()].reduce((sum, row) => sum + row.revenue, 0);

    return Object.values(TARIFF_CODES).map((tariff) => {
      const { minutes = 0, revenue = 0 } = rows.get(tariff) ?? {};
      return { tariff, minutes, revenue, shareOfRentRevenuePercent: percentage(revenue, totalRentRevenue) };
    });
  }

  /** Для кожної робочої години: скільки бронювань її зачіпають і скільки хвилин заброньовано. */
  getHourlyDemand(period) {
    const intervals = this.reportsRepository.findConfirmedIntervals(toDateRange(period)).map((booking) => ({
      start: splitLocalDateTime(booking.startAt).minutes,
      end: splitLocalDateTime(booking.endAt).minutes,
    }));

    const hours = [];
    for (let hourStart = WORKING_HOURS.openMinute; hourStart < WORKING_HOURS.closeMinute; hourStart += MINUTES_IN_HOUR) {
      const hourEnd = hourStart + MINUTES_IN_HOUR;
      const minutesPerBooking = intervals.map(({ start, end }) => overlapMinutes(start, end, hourStart, hourEnd));

      hours.push({
        startMinute: hourStart,
        endMinute: hourEnd,
        bookingsCount: minutesPerBooking.filter((minutes) => minutes > 0).length,
        bookedMinutes: minutesPerBooking.reduce((sum, minutes) => sum + minutes, 0),
      });
    }
    return hours;
  }
}

module.exports = { ReportsService };
