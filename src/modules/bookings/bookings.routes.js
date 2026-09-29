'use strict';

const express = require('express');
const { ROLES } = require('../../middlewares/authentication');
const { validateRequest } = require('../../middlewares/validateRequest');
const { idParamsSchema } = require('../../shared/validation');
const { quoteBodySchema, createBookingBodySchema, listBookingsQuerySchema } = require('./bookings.schemas');

/**
 * Маршрути /api/v1/bookings.
 * Клієнт може розрахувати вартість, забронювати, переглянути й скасувати бронювання за його id.
 * Перегляд списку всіх бронювань — лише для адміністратора.
 */
function createBookingsRouter({ bookingsController, auth }) {
  const router = express.Router();

  router.post('/quote', validateRequest({ body: quoteBodySchema }), bookingsController.quote);
  router.post('/', validateRequest({ body: createBookingBodySchema }), bookingsController.create);
  router.get(
    '/',
    auth.requireRole(ROLES.ADMIN),
    validateRequest({ query: listBookingsQuerySchema }),
    bookingsController.list,
  );
  router.get('/:id', validateRequest({ params: idParamsSchema }), bookingsController.getById);
  router.post('/:id/cancel', validateRequest({ params: idParamsSchema }), bookingsController.cancel);

  return router;
}

module.exports = { createBookingsRouter };
