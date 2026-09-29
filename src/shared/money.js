'use strict';

/**
 * Гроші зберігаються в копійках (цілими числами), щоб уникнути помилок округлення
 * дробових чисел (0.1 + 0.2 !== 0.3). У API суми передаються в гривнях.
 */

const KOPECKS_IN_HRYVNIA = 100;
const CURRENCY = 'UAH';

function toKopecks(hryvnias) {
  return Math.round(hryvnias * KOPECKS_IN_HRYVNIA);
}

function toHryvnias(kopecks) {
  return kopecks / KOPECKS_IN_HRYVNIA;
}

function hasAtMostTwoDecimals(amount) {
  return Math.abs(amount * KOPECKS_IN_HRYVNIA - Math.round(amount * KOPECKS_IN_HRYVNIA)) < 1e-6;
}

module.exports = { CURRENCY, toKopecks, toHryvnias, hasAtMostTwoDecimals };
