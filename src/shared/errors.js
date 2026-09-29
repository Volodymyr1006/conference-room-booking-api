'use strict';

/**
 * Базова помилка застосунку. Містить HTTP-статус і машиночитаний код,
 * щоб клієнт API міг обробляти помилки без розбору тексту повідомлення.
 */
class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message = 'Некоректні вхідні дані', details) {
    super(message, { status: 400, code: 'VALIDATION_ERROR', details });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Потрібна автентифікація') {
    super(message, { status: 401, code: 'UNAUTHORIZED' });
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Недостатньо прав для цієї дії') {
    super(message, { status: 403, code: 'FORBIDDEN' });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Ресурс не знайдено') {
    super(message, { status: 404, code: 'NOT_FOUND' });
  }
}

class ConflictError extends AppError {
  constructor(message, details) {
    super(message, { status: 409, code: 'CONFLICT', details });
  }
}

/** Запит коректний за форматом, але порушує бізнес-правило (наприклад, бронювання о 02:00). */
class BusinessRuleError extends AppError {
  constructor(message, details) {
    super(message, { status: 422, code: 'BUSINESS_RULE_VIOLATION', details });
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = 'Забагато запитів. Спробуйте пізніше') {
    super(message, { status: 429, code: 'TOO_MANY_REQUESTS' });
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  TooManyRequestsError,
};
