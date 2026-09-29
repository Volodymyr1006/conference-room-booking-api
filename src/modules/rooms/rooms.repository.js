'use strict';

/**
 * Доступ до даних залів у базі. Тут лише SQL і перетворення рядків таблиці в об'єкти —
 * жодних бізнес-правил. Усі запити параметризовані (захист від SQL-ін'єкцій).
 */

/** Поля, які дозволено оновлювати, і відповідні колонки в таблиці. */
const UPDATABLE_COLUMNS = Object.freeze({
  name: 'name',
  capacity: 'capacity',
  basePricePerHour: 'base_price_per_hour',
});

function mapService(row) {
  return { id: row.id, name: row.name, price: row.price };
}

function mapRoom(row, services) {
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    basePricePerHour: row.base_price_per_hour,
    services,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class RoomsRepository {
  constructor(db) {
    this.db = db;
  }

  findById(id) {
    const row = this.db.prepare('SELECT * FROM rooms WHERE id = ? AND deleted_at IS NULL').get(id);
    return row ? this.#withServices([row])[0] : null;
  }

  findAll() {
    const rows = this.db.prepare('SELECT * FROM rooms WHERE deleted_at IS NULL ORDER BY name').all();
    return this.#withServices(rows);
  }

  /** Чи зайнята назва іншим (не видаленим) залом. */
  isNameTaken(name, excludeRoomId = null) {
    const row = this.db
      .prepare(
        `SELECT 1 FROM rooms
         WHERE name = ? COLLATE NOCASE AND deleted_at IS NULL AND id IS NOT ?`,
      )
      .get(name, excludeRoomId);
    return Boolean(row);
  }

  /**
   * Зали з достатньою місткістю, які не мають підтверджених бронювань,
   * що перетинаються з проміжком [startAt, endAt).
   * Два проміжки перетинаються, якщо один починається раніше, ніж закінчується інший, і навпаки.
   */
  findAvailable({ minCapacity, startAt, endAt }) {
    const rows = this.db
      .prepare(
        `SELECT r.* FROM rooms r
         WHERE r.deleted_at IS NULL
           AND r.capacity >= @minCapacity
           AND NOT EXISTS (
             SELECT 1 FROM bookings b
             WHERE b.room_id = r.id
               AND b.status = 'confirmed'
               AND b.start_at < @endAt
               AND b.end_at > @startAt
           )
         ORDER BY r.capacity, r.base_price_per_hour`,
      )
      .all({ minCapacity, startAt, endAt });
    return this.#withServices(rows);
  }

  create(room) {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO rooms (id, name, capacity, base_price_per_hour, created_at, updated_at)
           VALUES (@id, @name, @capacity, @basePricePerHour, @now, @now)`,
        )
        .run({ ...room, now });
      this.#insertServices(room.id, room.services);
    })();
  }

  /** Оновлює лише передані поля. Якщо передано services — повністю замінює список послуг. */
  update(id, changes) {
    const columns = Object.keys(UPDATABLE_COLUMNS).filter((field) => changes[field] !== undefined);
    const assignments = columns.map((field) => `${UPDATABLE_COLUMNS[field]} = @${field}`);

    this.db.transaction(() => {
      this.db
        .prepare(`UPDATE rooms SET ${[...assignments, 'updated_at = @now'].join(', ')} WHERE id = @id`)
        .run({ ...pick(changes, columns), id, now: new Date().toISOString() });

      if (changes.services) {
        this.db.prepare('DELETE FROM room_services WHERE room_id = ?').run(id);
        this.#insertServices(id, changes.services);
      }
    })();
  }

  addService(roomId, service) {
    this.db.transaction(() => {
      this.#insertServices(roomId, [service]);
      this.#touch(roomId);
    })();
  }

  /** @returns {boolean} true, якщо послугу знайдено й видалено */
  removeService(roomId, serviceId) {
    return this.db.transaction(() => {
      const { changes } = this.db
        .prepare('DELETE FROM room_services WHERE id = ? AND room_id = ?')
        .run(serviceId, roomId);
      if (changes > 0) this.#touch(roomId);
      return changes > 0;
    })();
  }

  softDelete(id) {
    this.db.prepare('UPDATE rooms SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  }

  #insertServices(roomId, services) {
    const insert = this.db.prepare(
      'INSERT INTO room_services (id, room_id, name, price) VALUES (@id, @roomId, @name, @price)',
    );
    services.forEach((service) => insert.run({ ...service, roomId }));
  }

  #touch(roomId) {
    this.db.prepare('UPDATE rooms SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), roomId);
  }

  /** Завантажує послуги для всіх залів одним запитом (без проблеми N+1 запитів). */
  #withServices(rows) {
    if (rows.length === 0) return [];

    const serviceRows = this.db
      .prepare(
        `SELECT * FROM room_services
         WHERE room_id IN (SELECT value FROM json_each(?))
         ORDER BY name`,
      )
      .all(JSON.stringify(rows.map((row) => row.id)));

    const servicesByRoom = Map.groupBy(serviceRows, (service) => service.room_id);
    return rows.map((row) => mapRoom(row, (servicesByRoom.get(row.id) ?? []).map(mapService)));
  }
}

function pick(source, keys) {
  return Object.fromEntries(keys.map((key) => [key, source[key]]));
}

module.exports = { RoomsRepository };
