import test from 'node:test';
import assert from 'node:assert/strict';
import { localDayDiff, localDayKey, parseLocalDayKey } from './localTime';

test('localDayKey uses the local calendar day, not UTC', () => {
  // 22:00 in São Paulo (UTC-3) is already the next day in UTC.
  const lateEvening = new Date(2026, 10, 15, 22, 0, 0); // 15 Nov 2026, 22:00 local
  assert.equal(localDayKey(lateEvening), '2026-11-15');

  const earlyMorning = new Date(2026, 0, 2, 0, 30, 0);
  assert.equal(localDayKey(earlyMorning), '2026-01-02');
});

test('localDayKey zero-pads month and day', () => {
  assert.equal(localDayKey(new Date(2026, 8, 5, 12, 0, 0)), '2026-09-05');
  assert.equal(localDayKey(new Date(2026, 11, 31, 23, 59, 59)), '2026-12-31');
});

test('localDayKey changes at local midnight only', () => {
  const justBefore = new Date(2026, 5, 10, 23, 59, 59);
  const justAfter = new Date(2026, 5, 11, 0, 0, 1);
  assert.equal(localDayKey(justBefore), '2026-06-10');
  assert.equal(localDayKey(justAfter), '2026-06-11');
});

test('parseLocalDayKey round-trips and rejects invalid keys', () => {
  const parsed = parseLocalDayKey('2026-03-09');
  assert.ok(parsed);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 2);
  assert.equal(parsed.getDate(), 9);

  assert.equal(parseLocalDayKey('2026-3-9'), null);
  assert.equal(parseLocalDayKey('2026-02-30'), null);
  assert.equal(parseLocalDayKey(''), null);
});

test('localDayDiff counts calendar days between local keys', () => {
  assert.equal(localDayDiff('2026-11-15', '2026-11-16'), 1);
  assert.equal(localDayDiff('2026-11-16', '2026-11-15'), -1);
  assert.equal(localDayDiff('2026-11-15', '2026-11-15'), 0);
  assert.equal(localDayDiff('2026-02-28', '2026-03-01'), 1);
  assert.equal(localDayDiff('invalid', '2026-03-01'), 0);
});
