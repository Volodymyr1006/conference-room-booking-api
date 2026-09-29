'use strict';

const { BOOKING_STATUS } = require('../bookings/bookings.repository');

/**
 * Агрегуючі SQL-запити для звітів. Усі звіти враховують бронювання, що ПОЧИНАЮТЬСЯ
 * в періоді [fromAt, toExclusiveAt). Виручка рахується лише за підтвердженими бронюваннями.
 */
class ReportsRepository {
  constructor(db) {
    this.db = db;
  }

  getSummary({ fromAt, toExclusiveAt }) {
    return this.db
      .prepare(
        `SELECT
           COUNT(CASE WHEN status = @confirmed THEN 1 END)                      AS confirmedCount,
           COUNT(CASE WHEN status = @cancelled THEN 1 END)                      AS cancelledCount,
           COALESCE(SUM(CASE WHEN status = @confirmed THEN total_price END), 0)      AS totalRevenue,
           COALESCE(SUM(CASE WHEN status = @confirmed THEN rent_price END), 0)       AS rentRevenue,
           COALESCE(SUM(CASE WHEN status = @confirmed THEN services_price END), 0)   AS servicesRevenue,
           COALESCE(SUM(CASE WHEN status = @confirmed THEN duration_minutes END), 0) AS bookedMinutes
         FROM bookings
         WHERE start_at >= @fromAt AND start_at < @toExclusiveAt`,
      )
      .get({ ...this.#statuses(), fromAt, toExclusiveAt });
  }

  /** Показники по кожному залу. Видалені зали показуються, лише якщо мали бронювання в періоді. */
  getRoomsPerformance({ fromAt, toExclusiveAt }) {
    return this.db
      .prepare(
        `SELECT
           r.id                                   AS roomId,
           r.name                                 AS roomName,
           r.capacity                             AS capacity,
           r.deleted_at IS NOT NULL               AS isDeleted,
           COUNT(b.id)                            AS bookingsCount,
           COALESCE(SUM(b.duration_minutes), 0)   AS bookedMinutes,
           COALESCE(SUM(b.total_price), 0)        AS revenue
         FROM rooms r
         LEFT JOIN bookings b
           ON b.room_id = r.id
          AND b.status = @confirmed
          AND b.start_at >= @fromAt AND b.start_at < @toExclusiveAt
         GROUP BY r.id
         HAVING r.deleted_at IS NULL OR COUNT(b.id) > 0
         ORDER BY revenue DESC, r.name`,
      )
      .all({ confirmed: BOOKING_STATUS.CONFIRMED, fromAt, toExclusiveAt });
  }

  getServicesPopularity({ fromAt, toExclusiveAt }) {
    return this.db
      .prepare(
        `SELECT
           bs.name        AS serviceName,
           COUNT(*)       AS timesOrdered,
           SUM(bs.price)  AS revenue
         FROM booking_services bs
         JOIN bookings b ON b.id = bs.booking_id
         WHERE b.status = @confirmed AND b.start_at >= @fromAt AND b.start_at < @toExclusiveAt
         GROUP BY bs.name COLLATE NOCASE
         ORDER BY timesOrdered DESC, revenue DESC`,
      )
      .all({ confirmed: BOOKING_STATUS.CONFIRMED, fromAt, toExclusiveAt });
  }

  getTariffsBreakdown({ fromAt, toExclusiveAt }) {
    return this.db
      .prepare(
        `SELECT
           s.tariff       AS tariff,
           SUM(s.minutes) AS minutes,
           SUM(s.amount)  AS revenue
         FROM booking_price_segments s
         JOIN bookings b ON b.id = s.booking_id
         WHERE b.status = @confirmed AND b.start_at >= @fromAt AND b.start_at < @toExclusiveAt
         GROUP BY s.tariff`,
      )
      .all({ confirmed: BOOKING_STATUS.CONFIRMED, fromAt, toExclusiveAt });
  }

  findConfirmedIntervals({ fromAt, toExclusiveAt }) {
    return this.db
      .prepare(
        `SELECT start_at AS startAt, end_at AS endAt FROM bookings
         WHERE status = @confirmed AND start_at >= @fromAt AND start_at < @toExclusiveAt`,
      )
      .all({ confirmed: BOOKING_STATUS.CONFIRMED, fromAt, toExclusiveAt });
  }

  #statuses() {
    return { confirmed: BOOKING_STATUS.CONFIRMED, cancelled: BOOKING_STATUS.CANCELLED };
  }
}

module.exports = { ReportsRepository };
