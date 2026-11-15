import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTDOWN_MS, formatSolveTime, SolveClock } from './timing.ts';

test('the countdown shows three, two, one and cannot finish early', () => {
  const clock = new SolveClock(COUNTDOWN_MS);
  assert.deepEqual(clock.snapshot(0), { phase: 'countdown', countdown: 3, elapsedMs: 0 });
  assert.equal(clock.snapshot(1000).countdown, 2);
  assert.equal(clock.snapshot(2000).countdown, 1);
  assert.equal(clock.snapshot(2999).phase, 'countdown');
  assert.deepEqual(clock.snapshot(3000), { phase: 'running', countdown: null, elapsedMs: 0 });
  assert.throws(() => clock.stop(2999));
});

test('solve time freezes at the winning exchange and Undo retains the original start', () => {
  const clock = new SolveClock(3000);
  assert.equal(clock.snapshot(8300).elapsedMs, 5300);
  assert.equal(clock.stop(8500).elapsedMs, 5500);
  assert.equal(clock.snapshot(30_000).elapsedMs, 5500, 'Celebrations do not increase solve time.');
  clock.resume();
  assert.equal(clock.snapshot(30_000).elapsedMs, 27_000, 'Undo, menus and background time do not reset the start.');
  assert.equal(clock.stop(31_000).elapsedMs, 28_000);
  assert.equal(new SolveClock(34_000).snapshot(31_000).countdown, 3, 'Restart uses a new countdown.');
});

test('solve-time labels cover long runs and reject invalid durations', () => {
  assert.equal(formatSolveTime(65_480), '1:05');
  assert.equal(formatSolveTime(65_480, true), '1:05.4');
  assert.equal(formatSolveTime(3_600_000), '60:00');
  assert.throws(() => formatSolveTime(-1));
  assert.throws(() => new SolveClock(NaN));
});
