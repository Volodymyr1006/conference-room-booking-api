'use strict';

const express = require('express');
const { ROLES } = require('../../middlewares/authentication');
const { validateRequest } = require('../../middlewares/validateRequest');
const { reportPeriodQuerySchema } = require('./reports.schemas');

/** Маршрути /api/v1/reports — лише для адміністратора. */
function createReportsRouter({ reportsController, auth }) {
  const router = express.Router();
  const validatePeriod = validateRequest({ query: reportPeriodQuerySchema });

  router.use(auth.requireRole(ROLES.ADMIN));

  router.get('/summary', validatePeriod, reportsController.summary);
  router.get('/rooms', validatePeriod, reportsController.rooms);
  router.get('/services', validatePeriod, reportsController.services);
  router.get('/tariffs', validatePeriod, reportsController.tariffs);
  router.get('/hourly-demand', validatePeriod, reportsController.hourlyDemand);

  return router;
}

module.exports = { createReportsRouter };
