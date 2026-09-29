'use strict';

const express = require('express');
const { RoomsRepository } = require('./rooms/rooms.repository');
const { RoomsService } = require('./rooms/rooms.service');
const { RoomsController } = require('./rooms/rooms.controller');
const { createRoomsRouter } = require('./rooms/rooms.routes');
const { BookingsRepository } = require('./bookings/bookings.repository');
const { BookingsService } = require('./bookings/bookings.service');
const { BookingsController } = require('./bookings/bookings.controller');
const { createBookingsRouter } = require('./bookings/bookings.routes');
const { ReportsRepository } = require('./reports/reports.repository');
const { ReportsService } = require('./reports/reports.service');
const { ReportsController } = require('./reports/reports.controller');
const { createReportsRouter } = require('./reports/reports.routes');

/**
 * Єдине місце, де створюються всі об'єкти застосунку і з'єднуються між собою
 * (Dependency Injection вручну). Класи не створюють залежності самі, а отримують їх —
 * тому їх легко тестувати й замінювати (наприклад, SQLite на PostgreSQL — лише нові репозиторії).
 */
function createControllers({ db, clock }) {
  const roomsRepository = new RoomsRepository(db);
  const bookingsRepository = new BookingsRepository(db);
  const reportsRepository = new ReportsRepository(db);

  const roomsService = new RoomsService({ roomsRepository, bookingsRepository, clock });
  const bookingsService = new BookingsService({ bookingsRepository, roomsRepository, clock });
  const reportsService = new ReportsService({ reportsRepository });

  return {
    roomsController: new RoomsController(roomsService),
    bookingsController: new BookingsController(bookingsService),
    reportsController: new ReportsController(reportsService),
  };
}

/** Роутер версії API v1. Нова несумісна версія API додається поруч як /api/v2. */
function createApiRouter({ db, clock, auth }) {
  const controllers = createControllers({ db, clock });
  const router = express.Router();

  router.use('/rooms', createRoomsRouter({ ...controllers, auth }));
  router.use('/bookings', createBookingsRouter({ ...controllers, auth }));
  router.use('/reports', createReportsRouter({ ...controllers, auth }));

  return router;
}

module.exports = { createApiRouter };
