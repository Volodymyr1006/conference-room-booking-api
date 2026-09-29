'use strict';

const crypto = require('node:crypto');
const { ForbiddenError, UnauthorizedError } = require('../shared/errors');

const API_KEY_HEADER = 'X-API-Key';

const ROLES = Object.freeze({
  ADMIN: 'admin',
  CLIENT: 'client',
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest();
}

/**
 * Автентифікація за API-ключем у заголовку X-API-Key і перевірка ролей.
 *
 * Ключі порівнюються через timingSafeEqual (за час, що не залежить від вмісту),
 * щоб зловмисник не зміг підібрати ключ, вимірюючи час відповіді сервера.
 * Хешування вирівнює довжину значень, яку вимагає timingSafeEqual.
 */
function createAuthentication(apiKeys) {
  const credentials = [
    { role: ROLES.ADMIN, keyHash: sha256(apiKeys.admin) },
    { role: ROLES.CLIENT, keyHash: sha256(apiKeys.client) },
  ];

  function resolveRole(providedKey) {
    const providedHash = sha256(providedKey);
    const match = credentials.find(({ keyHash }) => crypto.timingSafeEqual(keyHash, providedHash));
    return match?.role ?? null;
  }

  function authenticate(req, res, next) {
    const apiKey = req.get(API_KEY_HEADER);
    if (!apiKey) {
      return next(new UnauthorizedError(`Відсутній API-ключ. Передайте його в заголовку ${API_KEY_HEADER}`));
    }

    const role = resolveRole(apiKey);
    if (!role) return next(new UnauthorizedError('Недійсний API-ключ'));

    req.auth = { role };
    return next();
  }

  function requireRole(...allowedRoles) {
    return (req, res, next) =>
      allowedRoles.includes(req.auth?.role) ? next() : next(new ForbiddenError('Ця дія доступна лише адміністратору'));
  }

  return { authenticate, requireRole };
}

module.exports = { createAuthentication, ROLES, API_KEY_HEADER };
