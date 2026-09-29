'use strict';

const BOOKING_STATUS = Object.freeze({
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
});

/** Поля фільтра списку бронювань і відповідні SQL-умови. */
const LIST_FILTERS = Object.freeze({
  roomId: 'b.room_id = @roomId',
  status: 'b.status = @status',
  date: 'substr(b.start_at, 1, 10) = @date',
});

function mapBooking(row, services, segments) {
  return {
    id: row.id,
    roomId: row.room_id,
    roomName: row.room_name,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    startAt: row.start_at,
    endAt: row.end_at,
    durationMinutes: row.duration_minutes,
    status: row.status,
    rentPrice: row.rent_price,
    servicesPrice: row.services_price,
    totalPrice: row.total_price,
    services,
    segments,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
  };
}

function mapSegment(row) {
  return {
    tariff: row.tariff,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    minutes: row.minutes,
    multiplierPercent: row.multiplier_percent,
    amount: row.amount,
  };
}

const SELECT_BOOKING = `
  SELECT b.*, r.name AS room_name
  FROM bookings b
  JOIN rooms r ON r.id = b.room_id`;

class BookingsRepository {
  constructor(db) {
    this.db = db;
  }

  findById(id) {
    const row = this.db.prepare(`${SELECT_BOOKING} WHERE b.id = ?`).get(id);
    return row ? this.#withDetails([row])[0] : null;
  }

  /** Список бронювань з фільтрами та пагінацією. */
  findMany({ filters, limit, offset }) {
    const activeFilters = Object.keys(LIST_FILTERS).filter((key) => filters[key] !== undefined);
    const where = activeFilters.length > 0 ? `WHERE ${activeFilters.map((key) => LIST_FILTERS[key]).join(' AND ')}` : '';
    const params = Object.fromEntries(activeFilters.map((key) => [key, filters[key]]));

    const total = this.db.prepare(`SELECT COUNT(*) FROM bookings b ${where}`).pluck().get(params);
    const rows = this.db
      .prepare(`${SELECT_BOOKING} ${where} ORDER BY b.start_at DESC LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit, offset });

    return { items: this.#withDetails(rows), total };
  }

  countUpcomingForRoom(roomId, fromLocalDateTime) {
    return this.db
      .prepare(`SELECT COUNT(*) FROM bookings WHERE room_id = ? AND status = ? AND end_at > ?`)
      .pluck()
      .get(roomId, BOOKING_STATUS.CONFIRMED, fromLocalDateTime);
  }

  /**
   * Атомарно перевіряє, що зал вільний, і створює бронювання.
   * Транзакція IMMEDIATE одразу блокує базу на запис, тому два паралельні запити
   * (навіть з різних процесів) не зможуть забронювати один і той самий час.
   * @returns {boolean} false, якщо час уже зайнятий
   */
  createIfSlotIsFree(booking) {
    const create = this.db.transaction(() => {
      if (this.#hasOverlap(booking.roomId, booking.startAt, booking.endAt)) return false;

      this.db
        .prepare(
          `INSERT INTO bookings (
             id, room_id, customer_name, customer_email, start_at, end_at, duration_minutes,
             status, rent_price, services_price, total_price, created_at
           ) VALUES (
             @id, @roomId, @customerName, @customerEmail, @startAt, @endAt, @durationMinutes,
             @status, @rentPrice, @servicesPrice, @totalPrice, @createdAt
           )`,
        )
        .run({ ...booking, status: BOOKING_STATUS.CONFIRMED, createdAt: new Date().toISOString() });

      this.#insertServices(booking.id, booking.services);
      this.#insertSegments(booking.id, booking.segments);
      return true;
    });

    return create.immediate();
  }

  cancel(id) {
    this.db
      .prepare('UPDATE bookings SET status = ?, cancelled_at = ? WHERE id = ?')
      .run(BOOKING_STATUS.CANCELLED, new Date().toISOString(), id);
  }

  #hasOverlap(roomId, startAt, endAt) {
    const row = this.db
      .prepare(
        `SELECT 1 FROM bookings
         WHERE room_id = ? AND status = ? AND start_at < ? AND end_at > ?
         LIMIT 1`,
      )
      .get(roomId, BOOKING_STATUS.CONFIRMED, endAt, startAt);
    return Boolean(row);
  }

  #insertServices(bookingId, services) {
    const insert = this.db.prepare('INSERT INTO booking_services (booking_id, name, price) VALUES (?, ?, ?)');
    services.forEach((service) => insert.run(bookingId, service.name, service.price));
  }

  #insertSegments(bookingId, segments) {
    const insert = this.db.prepare(
      `INSERT INTO booking_price_segments
         (booking_id, tariff, start_minute, end_minute, minutes, multiplier_percent, amount)
       VALUES (@bookingId, @tariff, @startMinute, @endMinute, @minutes, @multiplierPercent, @amount)`,
    );
    segments.forEach((segment) => insert.run({ ...segment, bookingId }));
  }

  /** Завантажує послуги й деталізацію вартості для всіх бронювань двома запитами. */
  #withDetails(rows) {
    if (rows.length === 0) return [];
    const ids = JSON.stringify(rows.map((row) => row.id));

    const services = this.db
      .prepare('SELECT * FROM booking_services WHERE booking_id IN (SELECT value FROM json_each(?)) ORDER BY name')
      .all(ids);
    const segments = this.db
      .prepare(
        'SELECT * FROM booking_price_segments WHERE booking_id IN (SELECT value FROM json_each(?)) ORDER BY start_minute',
      )
      .all(ids);

    const servicesByBooking = Map.groupBy(services, (service) => service.booking_id);
    const segmentsByBooking = Map.groupBy(segments, (segment) => segment.booking_id);

    return rows.map((row) =>
      mapBooking(
        row,
        (servicesByBooking.get(row.id) ?? []).map(({ name, price }) => ({ name, price })),
        (segmentsByBooking.get(row.id) ?? []).map(mapSegment),
      ),
    );
  }
}

module.exports = { BookingsRepository, BOOKING_STATUS };
