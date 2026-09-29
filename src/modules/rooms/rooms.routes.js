'use strict';

const express = require('express');
const { ROLES } = require('../../middlewares/authentication');
const { validateRequest } = require('../../middlewares/validateRequest');
const { idParamsSchema } = require('../../shared/validation');
const {
  createRoomBodySchema,
  updateRoomBodySchema,
  searchAvailableQuerySchema,
  serviceSchema,
  roomServiceParamsSchema,
} = require('./rooms.schemas');

/**
 * Маршрути /api/v1/rooms.
 * Перегляд і пошук — для будь-якого автентифікованого клієнта, зміни — лише для адміністратора.
 */
function createRoomsRouter({ roomsController, auth }) {
  const router = express.Router();
  const adminOnly = auth.requireRole(ROLES.ADMIN);

  // /available оголошено перед /:id, інакше "available" сприймалося б як id
  router.get('/available', validateRequest({ query: searchAvailableQuerySchema }), roomsController.searchAvailable);

  router.get('/', roomsController.list);
  router.post('/', adminOnly, validateRequest({ body: createRoomBodySchema }), roomsController.create);

  router.get('/:id', validateRequest({ params: idParamsSchema }), roomsController.getById);
  router.patch(
    '/:id',
    adminOnly,
    validateRequest({ params: idParamsSchema, body: updateRoomBodySchema }),
    roomsController.update,
  );
  router.delete('/:id', adminOnly, validateRequest({ params: idParamsSchema }), roomsController.remove);

  router.post(
    '/:id/services',
    adminOnly,
    validateRequest({ params: idParamsSchema, body: serviceSchema }),
    roomsController.addService,
  );
  router.delete(
    '/:id/services/:serviceId',
    adminOnly,
    validateRequest({ params: roomServiceParamsSchema }),
    roomsController.removeService,
  );

  return router;
}

module.exports = { createRoomsRouter };
