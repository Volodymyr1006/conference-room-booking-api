'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Простий механізм міграцій: SQL-файли з папки migrations виконуються по черзі (за назвою),
 * кожен рівно один раз. Застосовані міграції записуються в таблицю schema_migrations.
 * Щоб змінити схему в майбутньому — додайте новий файл, наприклад 002_add_attendees.sql.
 */
function runMigrations(db, migrationsDir = MIGRATIONS_DIR) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(db.prepare('SELECT name FROM schema_migrations').pluck().all());
  const pending = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql') && !applied.has(file))
    .sort();

  // Кожна міграція — в окремій транзакції: або застосовується повністю, або не застосовується зовсім
  const applyMigration = db.transaction((name, sql) => {
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(name, new Date().toISOString());
  });

  for (const file of pending) {
    applyMigration(file, fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }

  return pending;
}

module.exports = { runMigrations };
