'use strict';

/**
 * Створює файл .env на основі .env.example і генерує випадкові API-ключі.
 * Запуск: npm run setup
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXAMPLE_FILE = path.join(PROJECT_ROOT, '.env.example');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');

function generateApiKey() {
  return crypto.randomBytes(24).toString('hex');
}

function main() {
  if (fs.existsSync(ENV_FILE)) {
    console.log('Файл .env вже існує — нічого не змінено.');
    return;
  }

  const adminKey = generateApiKey();
  const clientKey = generateApiKey();

  const content = fs
    .readFileSync(EXAMPLE_FILE, 'utf8')
    .replace(/^ADMIN_API_KEY=.*$/m, `ADMIN_API_KEY=${adminKey}`)
    .replace(/^CLIENT_API_KEY=.*$/m, `CLIENT_API_KEY=${clientKey}`);

  fs.writeFileSync(ENV_FILE, content);

  console.log('Створено файл .env з новими API-ключами:');
  console.log(`  ADMIN_API_KEY  = ${adminKey}`);
  console.log(`  CLIENT_API_KEY = ${clientKey}`);
}

main();
