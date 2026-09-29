'use strict';

const { ValidationError } = require('../shared/errors');

function formatIssue(location, issue) {
  return {
    location,
    field: issue.path.join('.') || null,
    message: issue.message,
  };
}

/**
 * Перевіряє частини запиту (body, query, params) за схемами Zod.
 * Перевірені та перетворені дані кладуться в req.validated — контролери працюють лише з ними.
 * Невідомі поля відхиляються (strictObject), тож клієнт не може "підсунути" зайві дані.
 *
 * Приклад: validateRequest({ params: idParamsSchema, body: updateRoomBodySchema })
 */
function validateRequest(schemas) {
  return (req, res, next) => {
    const validated = {};
    const issues = [];

    for (const [location, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[location] ?? {});
      if (result.success) {
        validated[location] = result.data;
      } else {
        issues.push(...result.error.issues.map((issue) => formatIssue(location, issue)));
      }
    }

    if (issues.length > 0) return next(new ValidationError('Некоректні вхідні дані', issues));

    req.validated = validated;
    return next();
  };
}

module.exports = { validateRequest };
