import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ageForRecipient,
  calculateCurrentAge,
  deriveBirthYearFromCurrentAge,
  deriveBirthYearFromTurningAge,
  normalizeRecipientAgeFields,
  turningAgeOnDate,
} from './recipientAge.js';

const now = new Date(2026, 5, 20);

test('calculates age before, on, and after a birthday', () => {
  assert.equal(calculateCurrentAge(2000, 6, 21, now), 25);
  assert.equal(calculateCurrentAge(2000, 6, 20, now), 26);
  assert.equal(calculateCurrentAge(2000, 6, 19, now), 26);
});

test('derives birth year only with a complete birthday', () => {
  assert.equal(deriveBirthYearFromCurrentAge(25, 6, 21, now), 2000);
  assert.equal(deriveBirthYearFromCurrentAge(26, 6, 19, now), 2000);
  assert.equal(deriveBirthYearFromCurrentAge(25, null, null, now), null);
});

test('derives birth year from the age they are turning and event year', () => {
  assert.equal(deriveBirthYearFromTurningAge(40, '2027-02-28'), 1987);
  assert.equal(turningAgeOnDate(1987, '2027-02-28'), 40);
});

test('treats birth year as canonical when both fields are supplied', () => {
  assert.deepEqual(normalizeRecipientAgeFields({
    age: 99,
    birth_year: 2000,
    birthday_month: 6,
    birthday_day: 21,
  }, now), {
    age: 25,
    birth_year: 2000,
    birthday_month: 6,
    birthday_day: 21,
  });
});

test('keeps age without guessing birth year when birthday is incomplete', () => {
  assert.deepEqual(normalizeRecipientAgeFields({ age: 30 }, now), {
    age: 30,
    birth_year: undefined,
    birthday_month: undefined,
    birthday_day: undefined,
  });
});

test('uses birth year when reading a recipient age', () => {
  assert.equal(ageForRecipient({ age: 88, birth_year: 2000, birthday_month: 6, birthday_day: 20 }, now), 26);
});
