import assert from 'node:assert/strict';
import test from 'node:test';
import { createDailyClock, formatDailyCountdown, localDailyOpening, secondsUntilDaily } from './nextDaily.ts';

test('the shared UTC opening is shown in different local dates and half-hour timezones', () => {
  const now = Date.parse('2026-11-21T23:00:00Z');
  const clock = createDailyClock('2026-11-22T00:00:00Z', '2026-11-21T23:00:00Z', now);
  assert.equal(formatDailyCountdown(secondsUntilDaily(clock, now)), '01:00:00');
  assert.match(localDailyOpening(clock.resetAtMs, 'en-US', 'America/Los_Angeles'), /Sat.*4:00 PM.*PST/);
  assert.match(localDailyOpening(clock.resetAtMs, 'en-US', 'Asia/Kolkata'), /Sun.*5:30 AM.*GMT\+5:30/);
  assert.equal(clock.resetAtMs, Date.parse('2026-11-22T00:00:00Z'));
});

test('a fast device clock does not change the remaining shared Daily time', () => {
  const serverNow = Date.parse('2026-11-21T23:59:00Z'), deviceNow = serverNow + 9 * 60_000;
  const clock = createDailyClock('2026-11-22T00:00:00Z', new Date(serverNow).toISOString(), deviceNow);
  assert.equal(secondsUntilDaily(clock, deviceNow), 60);
  assert.equal(secondsUntilDaily(clock, deviceNow + 20_000), 40);
  assert.equal(secondsUntilDaily(clock, deviceNow + 60_000), 0);
  assert.equal(secondsUntilDaily(clock, deviceNow + 80_000), 0);
});

test('local opening uses the target date daylight-saving offset and rejects invalid timing', () => {
  const opening = Date.parse('2026-11-02T00:00:00Z');
  assert.match(localDailyOpening(opening, 'en-US', 'America/Los_Angeles'), /Sun.*4:00 PM.*PST/);
  assert.throws(() => createDailyClock('invalid', '2026-11-21T00:00:00Z', 0), /opening time/);
  assert.throws(() => secondsUntilDaily({ resetAtMs: NaN, serverOffsetMs: 0 }, 0), /valid clock/);
});
