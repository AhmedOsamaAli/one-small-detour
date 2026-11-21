import assert from 'node:assert/strict';
import test from 'node:test';
import { homeDailyResult } from './useDailyHome.ts';
import type { MyRank } from '../shared/types.ts';

const empty: MyRank = {
  edition: '2026-11-18', rank: null, swaps: null, solveMs: null,
  participants: 8, topPercent: null, source: 'local',
};

test('Home routes from the authoritative own result, not the presence of other finishers', () => {
  assert.deepEqual(homeDailyResult(empty.edition, empty), { status: 'ready', edition: empty.edition });
  const saved = { ...empty, rank: 3, swaps: 4, solveMs: 12500, topPercent: 38 };
  assert.deepEqual(homeDailyResult(saved.edition, saved), { status: 'complete', edition: saved.edition, result: saved });
  assert.equal(empty.rank, null);
});

test('Home never presents a mismatched edition or an incomplete saved result as ready to play', () => {
  assert.throws(() => homeDailyResult('2026-11-19', empty), /incomplete/);
  for (const result of [{ ...empty, rank: 1, swaps: 3 }, { ...empty, rank: 1, solveMs: 12000 }]) {
    assert.throws(() => homeDailyResult(empty.edition, result), /incomplete/);
  }
});
