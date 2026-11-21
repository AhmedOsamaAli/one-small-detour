import test from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGES } from './challenges.generated.ts';
import { dailyMinimum, dailyPuzzleForDate, findPuzzle, getCatalog, getExpeditions, getPuzzles, STARTER_DAILY_START } from './puzzles.ts';
import { certifyMinimum } from './difficulty.ts';
import { roadFingerprint } from './rules.ts';
import { isCatalogEntry, isPuzzle } from './validation.ts';
import { campaignPlaces } from './progression.ts';

test('218 distinct campaign places preserve the original 45 and cover certified minimums 1-15', () => {
  const campaign = getPuzzles();
  assert.equal(campaign.length, 218);
  assert.deepEqual(campaign.slice(0, 45), [...CHALLENGES, ...getExpeditions()]);
  assert.equal(new Set(campaign.map((puzzle) => roadFingerprint(puzzle.board))).size, 218);
  assert.deepEqual([...new Set(campaign.map((puzzle) => puzzle.minimum))].sort((a, b) => (a ?? 0) - (b ?? 0)),
    Array.from({ length: 15 }, (_, index) => index + 1));
  for (const puzzle of campaign) {
    assert.equal(certifyMinimum(puzzle), puzzle.minimum, puzzle.id);
    const publicPuzzle = findPuzzle(puzzle.id);
    assert.equal(isPuzzle(publicPuzzle), true, puzzle.id);
    assert.equal(JSON.stringify(publicPuzzle).includes('witness'), false);
  }
  const catalog = getCatalog();
  assert.equal(catalog.length, 218);
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

test('the first Practice title stays consistent across catalogs and details without changing the saved route', () => {
  const original = CHALLENGES[0];
  assert.ok(original);
  for (const revision of [1, 2] as const) {
    const first = campaignPlaces(getCatalog(revision))[0];
    assert.ok(first);
    assert.equal(first.title, 'My sunrise');
    assert.equal(first.id, original.id);
    const puzzle = findPuzzle(first.id, revision);
    assert.ok(puzzle);
    assert.equal(puzzle.title, first.title);
    assert.deepEqual(puzzle.board, original.board);
  }
});

test('future shared Dailies vary gradually without changing the existing frame rules', () => {
  const start = Date.parse(`${STARTER_DAILY_START}T12:00:00Z`);
  const layouts = new Set<string>();
  for (const offset of [0, 1, 7, 30, 364]) {
    const date = new Date(start + offset * 86_400_000);
    const puzzle = dailyPuzzleForDate(date);
    assert.ok(puzzle);
    assert.equal(puzzle.board.length, dailyMinimum(date.toISOString().slice(0, 10)) <= 4 ? 8 : 10);
    assert.equal(puzzle.area, 2);
    assert.equal(puzzle.frame, undefined);
    assert.equal(certifyMinimum(puzzle), dailyMinimum(date.toISOString().slice(0, 10)));
    if (offset === 0) assert.equal(puzzle.minimum, 3);
    assert.deepEqual(dailyPuzzleForDate(new Date(`${date.toISOString().slice(0, 10)}T23:59:59Z`)), puzzle);
    layouts.add(roadFingerprint(puzzle.board));
  }
  assert.equal(layouts.size, 5);
  const year = Array.from({ length: 365 }, (_, offset) => dailyMinimum(new Date(start + offset * 86_400_000).toISOString().slice(0, 10)));
  assert.ok(year.slice(0, 7).every((minimum) => minimum >= 3 && minimum <= 5));
  assert.ok(year.slice(7, 14).every((minimum) => minimum >= 3 && minimum <= 7));
  assert.ok(year.every((minimum, index) => minimum >= 3 && minimum <= 10 && (!index || Math.abs(minimum - (year[index - 1] ?? minimum)) <= 2)));
  assert.ok(year.slice(14).some((minimum) => minimum >= 8));
  assert.ok(year.slice(14).some((minimum) => minimum === 3));
  assert.ok(year.some((minimum, index) => index > 0 && minimum < (year[index - 1] ?? minimum)));
});
