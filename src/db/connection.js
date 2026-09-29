'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const IN_MEMORY = ':memory:';
const BUSY_TIMEOUT_MS = 5000;

/**
 * Відкриває з'єднання з SQLite і вмикає налаштування надійності:
 *  - WAL: читання не блокують запис, база стійкіша до збоїв під час запису;
 *  - foreign_keys: SQLite не перевіряє зовнішні ключі без цього прапорця;
 *  - busy_timeout: при конкурентному записі чекаємо, а не падаємо одразу.
 */
function openDatabase(filePath) {
  if (filePath !== IN_MEMORY) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
  return db;
}

module.exports = { openDatabase, IN_MEMORY };
