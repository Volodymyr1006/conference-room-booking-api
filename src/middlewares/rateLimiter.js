'use strict';

const { rateLimit } = require('express-rate-limit');
const { TooManyRequestsError } = require('../shared/errors');

/**
 * Обмежує кількість запитів з однієї IP-адреси за проміжок часу.
 * Захищає від перебору API-ключів і від перевантаження сервера.
 */
function createRateLimiter({ windowMs, max }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next) => next(new TooManyRequestsError()),
  });
}

module.exports = { createRateLimiter };
