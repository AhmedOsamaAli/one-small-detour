import test from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGES } from './challenges.generated.ts';
import { dailyPuzzleForDate, findPuzzle, getCatalog, getExpeditions, getPuzzles } from './puzzles.ts';
import { certifyMinimum } from './difficulty.ts';
import { roadFingerprint } from './rules.ts';
import { isCatalogEntry, isPuzzle } from './validation.ts';

test('200 distinct campaign places preserve the original 45 and cover certified minimums 1-15', () => {
  const campaign = getPuzzles();
  assert.equal(campaign.length, 200);
  assert.deepEqual(campaign.slice(0, 45), [...CHALLENGES, ...getExpeditions()]);
  assert.equal(new Set(campaign.map((puzzle) => roadFingerprint(puzzle.board))).size, 200);
  assert.deepEqual([...new Set(campaign.map((puzzle) => puzzle.minimum))].sort((a, b) => (a ?? 0) - (b ?? 0)),
    Array.from({ length: 15 }, (_, index) => index + 1));
  for (const puzzle of campaign) {
    assert.equal(certifyMinimum(puzzle), puzzle.minimum, puzzle.id);
    const publicPuzzle = findPuzzle(puzzle.id);
    assert.equal(isPuzzle(publicPuzzle), true, puzzle.id);
    assert.equal(JSON.stringify(publicPuzzle).includes('witness'), false);
  }
  const catalog = getCatalog();
  assert.equal(catalog.length, 200);
  assert.ok(catalog.every(isCatalogEntry));
  assert.equal(JSON.stringify(catalog).includes('witness'), false);
});

test('daily generation is separate from the campaign and continues beyond 200 editions', () => {
  const campaign = new Set(getPuzzles().map((puzzle) => roadFingerprint(puzzle.board)));
  const daily = new Set<string>();
  for (const offset of [0, 1, 14, 58, 190, 364, 800]) {
    const puzzle = dailyPuzzleForDate(new Date(Date.UTC(2026, 10, 11 + offset, 12)));
    assert.ok(puzzle);
    assert.match(puzzle.id, /^daily-v4-/);
    assert.equal(campaign.has(roadFingerprint(puzzle.board)), false);
    daily.add(roadFingerprint(puzzle.board));
  }
  assert.equal(daily.size, 7);
});
