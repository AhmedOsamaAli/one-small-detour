import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOME_ORDER, dailyLandscapeTheme } from './biomes.ts';
import { dailyPuzzleForDate } from './puzzles.ts';
import { generateDailyChallenge, seedOf } from './generation.ts';
import { RULE_VERSION } from './rules.ts';

test('seasonal Daily themes preserve released editions, are date-seeded and cover every biome without consecutive repeats', () => {
  for (const previous of BIOME_ORDER) assert.equal(dailyLandscapeTheme('2026-11-17', previous), previous);
  const start = Date.parse('2026-11-18T00:00:00Z');
  const results = Array.from({ length: 365 }, (_, index) => {
    const edition = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    const theme = dailyLandscapeTheme(edition, 'meadow');
    assert.notEqual(theme, 'blossom');
    assert.equal(dailyLandscapeTheme(edition, 'orchard'), theme);
    return theme;
  });
  assert.equal(new Set(results).size, BIOME_ORDER.length);
  assert.ok(results.every((theme, index) => index === 0 || theme !== results[index - 1]));
  assert.throws(() => dailyLandscapeTheme('2026-11-32', 'meadow'), /valid edition/);
});

test('rotating a future Daily theme does not reseed or change its solved road, edition or minimum', () => {
  const first = dailyPuzzleForDate(new Date('2026-11-18T00:00:00Z'));
  const repeated = dailyPuzzleForDate(new Date('2026-11-18T19:00:00Z'));
  assert.ok(first && repeated);
  assert.equal(first.id, 'daily-v4-2026-11-18');
  const generated = generateDailyChallenge({
    id: first.id, title: first.title, minimum: first.minimum ?? 1,
    seed: seedOf(`detour:journey-v${RULE_VERSION}:2026-11-18`), chapter: first.chapter,
  });
  assert.deepEqual(first.board, generated.board);
  assert.deepEqual(first.witness, generated.witness);
  assert.deepEqual(repeated.board, first.board);
  assert.deepEqual(repeated.witness, first.witness);
  assert.equal(repeated.minimum, first.minimum);
  assert.equal(first.theme, dailyLandscapeTheme('2026-11-18', 'meadow'));
});
