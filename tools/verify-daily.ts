import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { certifyMinimum } from '../src/shared/difficulty.ts';
import { dailyMinimum, dailyPuzzleForDate, editionForDate, getPuzzles, nextReset, puzzleDate, STARTER_DAILY_START } from '../src/shared/puzzles.ts';
import { MAX_EXCHANGES, roadFingerprint, RULE_VERSION, validateRepair } from '../src/shared/rules.ts';
import { BIOME_ORDER } from '../src/shared/biomes.ts';

if (process.argv.length > 3) throw new Error('Usage: npm run verify:daily -- [YYYY-MM-DD]');
const start = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const startDate = puzzleDate(start);
assert.ok(startDate, 'The verification start must be a valid UTC date: YYYY-MM-DD.');
const days = 365;
const dayMs = 86_400_000;
const terrain = new Map<string, string>();
const roads = new Map<string, string>();
const practice = getPuzzles(3);
const activePractice = practice.filter((puzzle) => !puzzle.archived);
const archivedPractice = practice.filter((puzzle) => puzzle.archived);
const campaignRoads = new Set(practice.map((puzzle) => roadFingerprint(puzzle.board)));
assert.equal(activePractice.length, 1000, 'The revised campaign must contain 1,000 active stops.');
assert.equal(archivedPractice.length, getPuzzles(2).length, 'Every replaced original and revised route must remain replayable.');
assert.equal(campaignRoads.size, practice.length, 'Active and archived Practice routes must have distinct road decisions.');
const paving = new Set<string>();
const repaired = new Set<string>();
const fingerprints: string[] = [];
const difficulties: Record<string, number> = {};
const themes = new Set<string>();
let slowestMs = 0;
const began = performance.now();

for (let offset = 0; offset < days; offset++) {
  const date: Date = new Date(startDate.getTime() + offset * dayMs);
  const id: string = date.toISOString().slice(0, 10);
  const before = performance.now();
  const puzzle = dailyPuzzleForDate(date);
  slowestMs = Math.max(slowestMs, performance.now() - before);
  assert.ok(puzzle, `${id}: no daily puzzle was returned.`);
  assert.ok(puzzle.journey, `${id}: the ordered stops are missing.`);
  assert.equal(puzzle.id, `daily-v${RULE_VERSION}-${id}`);
  const minimum = certifyMinimum(puzzle);
  assert.equal(minimum, puzzle.minimum, `${id}: the difficulty is not certified.`);
  if (id >= STARTER_DAILY_START) {
    assert.equal(minimum, dailyMinimum(id), `${id}: the Daily must match its gradual shared schedule.`);
    assert.equal(puzzle.board.length, minimum <= 4 ? 8 : 10, `${id}: the Daily must match its scheduled map size.`);
    assert.equal(puzzle.area, 2, `${id}: the ranked Daily frame rules must not change.`);
  }
  assert.equal(puzzle.budget, MAX_EXCHANGES, `${id}: long attempts are not supported.`);
  const solution = validateRepair(puzzle, 'daily', puzzle.witness);
  assert.equal(solution.swaps, minimum, `${id}: the authoritative replay disagrees.`);
  const layout = puzzle.board.join('/');
  const road = roadFingerprint(puzzle.board);
  assert.equal(terrain.has(layout), false, `${id}: identical terrain to ${terrain.get(layout)}.`);
  assert.equal(roads.has(road), false, `${id}: identical road decisions to ${roads.get(road)}.`);
  assert.equal(campaignRoads.has(road), false, `${id}: the daily repeats a campaign map.`);
  terrain.set(layout, id);
  roads.set(road, id);
  paving.add(road.replace(/[A-Fhv]/g, 'o').replace(/x/g, '.'));
  repaired.add(roadFingerprint(solution.board).replace(/[A-Fhv]/g, 'o').replace(/x/g, '.'));
  themes.add(puzzle.theme);
  difficulties[String(puzzle.minimum)] = (difficulties[String(puzzle.minimum)] ?? 0) + 1;
  fingerprints.push(createHash('sha256').update(JSON.stringify(puzzle)).digest('hex'));
  const midnight = new Date(`${id}T00:00:00Z`);
  const late = editionForDate(new Date(`${id}T23:59:59.999Z`));
  assert.ok(late, `${id}: the public edition is missing.`);
  assert.equal(late.id, id, `${id}: the daily edition changed before UTC midnight.`);
  assert.deepEqual(late.puzzle.board, puzzle.board);
  assert.equal('witness' in late.puzzle, false, `${id}: a solution leaked into the public edition.`);
  assert.equal(nextReset(date), new Date(midnight.getTime() + dayMs).toISOString());
  if ((offset + 1) % 60 === 0) console.log(`Checked ${offset + 1}/${days} daily editions.`);
}

// The 48-entry cache cannot retain a year's puzzles: this forward second pass
// checks independently regenerated content rather than comparing cached objects.
for (let offset = 0; offset < days; offset++) {
  const date: Date = new Date(startDate.getTime() + offset * dayMs);
  const puzzle = dailyPuzzleForDate(date);
  assert.ok(puzzle);
  const fingerprint = createHash('sha256').update(JSON.stringify(puzzle)).digest('hex');
  assert.equal(fingerprint, fingerprints[offset], `${date.toISOString()}: regeneration changed the daily puzzle.`);
}
assert.deepEqual([...themes].sort(), [...BIOME_ORDER].sort(), 'The year did not cover exactly the approved landscape themes.');
console.log(JSON.stringify({
  from: start,
  through: new Date(startDate.getTime() + (days - 1) * dayMs).toISOString().slice(0, 10),
  editions: days,
  distinctTerrain: terrain.size,
  distinctRoadAndStopLayouts: roads.size,
  campaignPlaces: activePractice.length,
  archivedPracticePlaces: archivedPractice.length,
  distinctPlayablePracticeLayouts: campaignRoads.size,
  dailyCampaignRepeats: 0,
  distinctPavingMasks: paving.size,
  distinctRepairedRoadPatterns: repaired.size,
  difficulties,
  themes: [...themes],
  independentlyRegenerated: days,
  slowestColdGenerationMs: Math.round(slowestMs),
  totalMs: Math.round(performance.now() - began),
  publicSolutionsExposed: false,
}, null, 2));
