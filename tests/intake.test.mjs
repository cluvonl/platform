import test from 'node:test';
import assert from 'node:assert/strict';
import {intakeMinutesFromHours, intakeHoursFromMinutes, intakeUnavailabilityDates, intakeAnswerList} from '../lib/domain/intake.mjs';

test('monthly wish keeps zero separate from missing and converts hours exactly', () => {
  assert.equal(intakeMinutesFromHours(''), null);
  assert.equal(intakeMinutesFromHours('0'), 0);
  assert.equal(intakeMinutesFromHours('1,5'), 90);
  assert.equal(intakeMinutesFromHours('0.1'), 6);
  for (const minutes of [0, 1, 59, 60, 90, 100_000]) assert.equal(intakeMinutesFromHours(intakeHoursFromMinutes(minutes)), minutes);
  for (const value of ['-1', '1.01', 'NaN', '1e3', 'Infinity', '1:60', '1667', '1.333']) assert.throws(() => intakeMinutesFromHours(value), /INVALID_MONTHLY_HOURS/);
});

test('unavailable days reject impossible and ambiguous dates and dedupe valid dates', () => {
  assert.deepEqual(intakeUnavailabilityDates('2026-10-25, 2026-03-29, 2026-10-25'), ['2026-03-29', '2026-10-25']);
  assert.deepEqual(intakeUnavailabilityDates(''), []);
  for (const value of ['2026-02-29', '2026-02-30', '2026-13-01', '01-10-2026', '2026-1-01', '0000-01-01']) assert.throws(() => intakeUnavailabilityDates(value), /INVALID_UNAVAILABILITY/);
  assert.deepEqual(intakeUnavailabilityDates('2028-02-29'), ['2028-02-29']);
});

test('legacy personal text is preserved while known labels are normalized', () => {
  assert.deepEqual(intakeAnswerList('bar', ['Bar']), ['Bar']);
  assert.deepEqual(intakeAnswerList('ervaring die nog geen keuzelabel is', ['Techniek']), ['ervaring die nog geen keuzelabel is']);
  assert.deepEqual(intakeAnswerList(['Bar', 'bar', 1, null], ['Bar']), ['Bar']);
});
