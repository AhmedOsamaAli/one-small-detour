import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePracticeAccount } from './usePracticeSync.ts';
import type { Preferences } from './preferences.ts';
import { getCatalog } from '../shared/puzzles.ts';
import { campaignPlaces } from '../shared/progression.ts';
import { browserPracticeState, emptyPracticeSnapshot } from '../shared/practiceProgress.ts';

const catalog = getCatalog(), entries = campaignPlaces(catalog);
const a = entries[0], b = entries[1];
assert.ok(a && b);
const owner = 'a'.repeat(64);
const base: Preferences = { flat: true, completed: [a.id, 'daily-v4-2026-11-16'], appearance: 'dark', soundWanted: true, seenGuides: ['basics'],
  practice: { bests: { [a.id]: (a.minimum ?? 1) + 4 }, unlockedWorlds: 1 } };

test('sync merges existing device clears with account records and retains the better Practice result', () => {
  const snapshot = { ...browserPracticeState(catalog, [a.id, b.id], {
    bests: { [a.id]: a.minimum ?? 1, [b.id]: b.minimum ?? 1 }, unlockedWorlds: 2,
  }), generation: 0, revision: 1 };
  const result = reconcilePracticeAccount(base, catalog, { owner, snapshot });
  assert.ok(result.completed.includes(a.id) && result.completed.includes(b.id) && result.completed.includes('daily-v4-2026-11-16'));
  assert.equal(result.practice?.bests[a.id], a.minimum);
  assert.equal(result.practice?.unlockedWorlds, 2);
  assert.equal(result.appearance, 'dark');
  assert.equal(reconcilePracticeAccount(result, catalog, { owner, snapshot }), result);
});

test('an account reset clears only Practice records instead of resyncing an old device copy', () => {
  const current = { ...base, practiceAccount: { owner, generation: 0 } };
  const result = reconcilePracticeAccount(current, catalog, { owner, snapshot: emptyPracticeSnapshot(1) });
  assert.deepEqual(result.completed, ['daily-v4-2026-11-16']);
  assert.deepEqual(result.practice?.bests, {});
  assert.equal(result.practiceAccount?.generation, 1);
  assert.equal(result.soundWanted, true);
});

test('switching Reddit accounts does not import the previous account stars into the newly signed-in account', () => {
  const current = { ...base, practiceAccount: { owner, generation: 0 } };
  const result = reconcilePracticeAccount(current, catalog, { owner: 'b'.repeat(64), snapshot: emptyPracticeSnapshot() });
  assert.deepEqual(result.completed, ['daily-v4-2026-11-16']);
  assert.deepEqual(result.practice?.bests, {});
  assert.equal(result.flat, true);
});
