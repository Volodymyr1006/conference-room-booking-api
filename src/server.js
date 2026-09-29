'use strict';

const { loadConfig } = require('./config');
const { createLogger } = require('./shared/logger');
const { createSystemClock } = require('./shared/clock');
const { openDatabase } = require('./db/connection');
const { runMigrations } = require('./db/migrator');
const { seedInitialData } = require('./db/seed');
const { createApp } = require('./app');

const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Точка входу: читає конфігурацію, готує базу даних і запускає HTTP-сервер.
 */
function main() {
  const config = loadConfig();
  const logger = createLogger(config);

  const db = openDatabase(config.databasePath);
  const appliedMigrations = runMigrations(db);
  if (appliedMigrations.length > 0) logger.info({ appliedMigrations }, 'Застосовано міграції бази даних');
  if (config.seedOnStart && seedInitialData(db)) logger.info('Додано початкові дані: Зал A, Зал B, Зал C');

  const app = createApp({ db, config, logger, clock: createSystemClock(config.timezone) });
  const server = app.listen(config.port, () => {
    logger.info(`Сервер запущено: http://localhost:${config.port}`);
    logger.info(`Документація Swagger: http://localhost:${config.port}/api-docs`);
  });

  // Коректне завершення: дочікуємось обробки поточних запитів і закриваємо базу,
  // щоб не пошкодити дані під час перезапуску
  let isShuttingDown = false;
  function shutdown(reason, exitCode = 0) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ reason }, 'Зупинка сервера...');

    server.close(() => {
      db.close();
      logger.info('Сервер зупинено');
      process.exit(exitCode);
    });
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (error) => {
    logger.fatal({ err: error }, 'Необроблене відхилення Promise');
    shutdown('unhandledRejection', 1);
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Необроблений виняток');
    shutdown('uncaughtException', 1);
  });
}

try {
  main();
} catch (error) {
  console.error(`Не вдалося запустити сервер: ${error.message}`);
  process.exit(1);
}
