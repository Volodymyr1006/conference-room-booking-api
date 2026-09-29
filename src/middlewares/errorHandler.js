'use strict';

const { AppError, ConflictError, NotFoundError, ValidationError } = require('../shared/errors');

/** Перетворює будь-яку помилку на AppError зі зрозумілим статусом і повідомленням. */
function normalizeError(error) {
  if (error instanceof AppError) return error;

  // Помилки, які генерує express.json()
  if (error.type === 'entity.parse.failed') {
    return new ValidationError('Тіло запиту містить некоректний JSON');
  }
  if (error.type === 'entity.too.large') {
    return new AppError('Тіло запиту занадто велике', { status: 413, code: 'PAYLOAD_TOO_LARGE' });
  }

  // Останній рубіж захисту цілісності даних — обмеження в самій базі
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new ConflictError('Запис з такими даними вже існує');
  }
  if (error.code === 'SQLITE_BUSY') {
    return new AppError('Сервіс тимчасово перевантажений, спробуйте ще раз', {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  }

  return new AppError('Внутрішня помилка сервера');
}

/**
 * Єдиний обробник помилок. Клієнт завжди отримує відповідь одного формату:
 *   { "error": { "code": "NOT_FOUND", "message": "...", "details": ... } }
 * Технічні подробиці (stack trace, SQL) ніколи не потрапляють у відповідь — лише в лог.
 */
function createErrorHandler(logger) {
  // Express розпізнає обробник помилок саме за 4 аргументами, тому next потрібен, хоч і не використовується
  return (error, req, res, next) => {
    const appError = normalizeError(error);

    if (appError.status >= 500) {
      (req.log ?? logger).error({ err: error }, 'Необроблена помилка');
    }

    res.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details !== undefined && { details: appError.details }),
      },
    });
  };
}

function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Маршрут ${req.method} ${req.path} не існує`));
}

module.exports = { createErrorHandler, notFoundHandler };
