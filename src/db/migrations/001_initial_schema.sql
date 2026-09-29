-- Початкова схема бази даних.
-- Усі суми зберігаються в копійках (INTEGER).
-- Дата й час бронювань зберігаються як локальний час залів у форматі 'YYYY-MM-DDTHH:MM'.

CREATE TABLE rooms (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    capacity            INTEGER NOT NULL CHECK (capacity > 0),
    base_price_per_hour INTEGER NOT NULL CHECK (base_price_per_hour >= 0),
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    -- М'яке видалення: зал зникає з API, але історія бронювань зберігається для звітів
    deleted_at          TEXT
);

-- Назва залу унікальна серед не видалених залів
CREATE UNIQUE INDEX ux_rooms_active_name ON rooms (name COLLATE NOCASE) WHERE deleted_at IS NULL;

-- Послуги, доступні в конкретному залі, з ціною за одне бронювання
CREATE TABLE room_services (
    id      TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    name    TEXT NOT NULL,
    price   INTEGER NOT NULL CHECK (price >= 0)
);

CREATE UNIQUE INDEX ux_room_services_room_name ON room_services (room_id, name COLLATE NOCASE);

CREATE TABLE bookings (
    id               TEXT PRIMARY KEY,
    room_id          TEXT NOT NULL REFERENCES rooms (id),
    customer_name    TEXT NOT NULL,
    customer_email   TEXT,
    start_at         TEXT NOT NULL,
    end_at           TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    status           TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
    -- Ціни фіксуються на момент бронювання: зміна тарифів залу не змінює старі бронювання
    rent_price       INTEGER NOT NULL CHECK (rent_price >= 0),
    services_price   INTEGER NOT NULL CHECK (services_price >= 0),
    total_price      INTEGER NOT NULL CHECK (total_price >= 0),
    created_at       TEXT NOT NULL,
    cancelled_at     TEXT,
    CHECK (end_at > start_at)
);

-- Швидкий пошук перетинів бронювань для конкретного залу
CREATE INDEX ix_bookings_room_time ON bookings (room_id, start_at, end_at) WHERE status = 'confirmed';
-- Швидка вибірка за періодом для звітів
CREATE INDEX ix_bookings_start_at ON bookings (start_at);

-- Послуги, обрані в бронюванні (знімок назви та ціни на момент бронювання)
CREATE TABLE booking_services (
    booking_id TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    price      INTEGER NOT NULL CHECK (price >= 0),
    PRIMARY KEY (booking_id, name)
);

-- Деталізація вартості оренди за тарифними періодами (ранок / стандарт / пік / вечір)
CREATE TABLE booking_price_segments (
    booking_id         TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
    tariff             TEXT NOT NULL,
    start_minute       INTEGER NOT NULL,
    end_minute         INTEGER NOT NULL,
    minutes            INTEGER NOT NULL CHECK (minutes > 0),
    multiplier_percent INTEGER NOT NULL,
    amount             INTEGER NOT NULL CHECK (amount >= 0)
);

CREATE INDEX ix_booking_price_segments_booking ON booking_price_segments (booking_id);
