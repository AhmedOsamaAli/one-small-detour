import assert from 'node:assert/strict';
import test from 'node:test';
import { probeReasoningGreedy, reasoningFingerprint, reasoningGreedyRejection, reasoningQuality, reasoningRejection, rockForcedRouteRatio } from './reasoningQuality.ts';
import { getExpeditions } from './puzzles.ts';
import { FRAME_CHALLENGES } from './frameChallenges.ts';
import { campaignAchievements, campaignGates, campaignPlaces, completedOriginalRoad, initializePracticeProgress, nextCampaignPlace, worldStars, campaignWorlds } from './progression.ts';
import { normalizePracticeState, projectPracticeSnapshot } from './practiceProgress.ts';
import type { Board, CatalogEntry } from './types.ts';
import { REASONING_CAMPAIGN } from './reasoningCampaign.generated.ts';
import { FRAME_LESSONS } from './frameLessons.ts';

test('the released corridor and stock-garden expeditions fail the new planning gates despite large proved move counts', () => {
  for (const puzzle of getExpeditions()) {
    const quality = reasoningQuality(puzzle);
    assert.equal(quality.planningGap, 0, puzzle.id);
    assert.equal(quality.setupMoves, 0, puzzle.id);
    assert.ok(reasoningRejection(puzzle, quality, 3), puzzle.id);
  }
});

test('layout identity rejects cosmetic water changes, rotations and reflections', () => {
  const board: Board = ['Aoh...', '.x..o.', '..v...', 'o....B', '.~....', '..Co..'];
  const turn = board.map((_, row) => board.map((_, col) => {
    const tile = board[5 - col]?.[row];
    if (!tile) throw new Error('The test rotation lost a square.');
    return tile === 'h' ? 'v' : tile === 'v' ? 'h' : tile;
  }).join(''));
  assert.equal(reasoningFingerprint(board), reasoningFingerprint(turn));
  assert.equal(reasoningFingerprint(board), reasoningFingerprint(board.map(row => [...row].reverse().join(''))));
  assert.equal(reasoningFingerprint(board), reasoningFingerprint(board.map(row => row.replaceAll('~', '.'))));
});

test('interacting witnesses expose meaningful move-order dependencies rather than raw move counts', () => {
  const puzzle = FRAME_CHALLENGES[2];assert.ok(puzzle);
  const quality = reasoningQuality(puzzle);
  assert.ok(quality.criticalPairs > 0 && quality.dependencyCoverage === 1);
  assert.ok(quality.planningGap > 0);
});

test('rock-forced routes cannot hide behind a large decorative stock garden or unrelated junctions', () => {
  for (const puzzle of getExpeditions()) assert.equal(rockForcedRouteRatio(puzzle), 1, puzzle.id);
  const outlier = REASONING_CAMPAIGN[155];assert.ok(outlier);
  const quality = reasoningQuality(outlier);
  assert.ok(quality.movableCoverage >= .84 && quality.freeJunctions >= 4 && quality.stoneRatio <= .38);
  assert.ok(quality.rockForcedRatio > .8);
  assert.equal(reasoningRejection(outlier, quality, 2), 'rock-dictated-route');
  const open = { ...outlier, board: outlier.board.map(row => row.replaceAll('x', '.')) };
  assert.equal(rockForcedRouteRatio(open), 0);
});

test('the bounded greedy probe works without the witness and identifies easy alternative plans', () => {
  const lesson = FRAME_LESSONS.find(puzzle => puzzle.frame === 'square' && puzzle.minimum === 1);assert.ok(lesson);
  const { witness: _witness, ...publicLesson } = lesson;
  const easy = probeReasoningGreedy(publicLesson);
  assert.equal(easy.bestMoves, 1);
  assert.equal(reasoningGreedyRejection(publicLesson, easy, 3), 'easy-greedy-plan');
  const outlier = REASONING_CAMPAIGN[504];assert.ok(outlier);
  const probe = probeReasoningGreedy(outlier);
  const { witness: _plan, ...publicOutlier } = outlier;
  assert.deepEqual(probeReasoningGreedy(publicOutlier), probe);
  assert.equal(reasoningGreedyRejection(outlier, probe, 4), 'easy-greedy-expert');
});

const place = (id: string, minimum: number, extra: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id, minimum, title: id, note: '', chapter: 1, area: 2, budget: 2000, size: 6, theme: 'meadow', ...extra,
});
const revised = [
  place('new-one', 4, { campaignSlot: 0, legacyId: 'old-one', challengeTier: 3 }),
  place('new-two', 5, { campaignSlot: 1, legacyId: 'old-two', challengeTier: 4 }),
  place('old-one', 1, { archived: true }), place('old-two', 2, { archived: true }),
];

test('revision credit preserves old clears and stars without inventing a better move record on a different board', () => {
  const state = { completed: ['old-one'], practice: { bests: { 'old-one': 1 }, unlockedWorlds: 1 } };
  const earned = campaignAchievements(revised, state.completed, state.practice);
  assert.deepEqual(earned.get('new-one'), { completed: true, solved: false, credited: true, stars: 3, legacyStars: 3 });
  assert.equal(earned.get('new-two')?.completed, false);
  assert.equal(nextCampaignPlace(revised, state.completed, state.practice)?.id, 'new-two');
  assert.equal(campaignGates(revised, state.completed, state.practice).get('new-one')?.unlocked, true);
  assert.equal(state.practice.bests['old-one'], 1);
  assert.equal(Object.hasOwn(state.practice.bests, 'new-one'), false);
  assert.deepEqual(normalizePracticeState(revised, state).completed, ['old-one']);
  const world = campaignWorlds(2)[0];assert.ok(world);
  assert.equal(worldStars(world, revised, state.completed, state.practice), 3);
  assert.equal(campaignPlaces(revised).length, 2);
  assert.equal(initializePracticeProgress(revised, state.completed).unlockedWorlds, 1);
});

test('a later harder-board clear cannot reduce earlier earned stars, and legacy clients see only their own catalogue projection', () => {
  const snapshot = { generation: 2, revision: 7, completed: ['old-one', 'new-one'],
    practice: { bests: { 'old-one': 1, 'new-one': 7 }, unlockedWorlds: 1 } };
  assert.equal(campaignAchievements(revised, snapshot.completed, snapshot.practice).get('new-one')?.stars, 3);
  const legacy = revised.filter(entry => entry.archived).map(({ archived: _archived, ...entry }) => entry);
  const projected = projectPracticeSnapshot(legacy, snapshot);
  assert.deepEqual(projected.completed, ['old-one']);
  assert.deepEqual(projected.practice.bests, { 'old-one': 1 });
  assert.equal(projected.generation, 2);assert.equal(projected.revision, 7);
  assert.deepEqual(snapshot.practice.bests, { 'old-one': 1, 'new-one': 7 });
});

test('a quality refinement keeps both generations of actual records and finds the completed replay, not an unplayed intermediate road', () => {
  const catalog = [
    place('refined', 5, { campaignSlot: 0, legacyId: 'earlier-revision' }),
    place('earlier-revision', 4, { campaignSlot: 0, archived: true, legacyId: 'original' }),
    place('original', 2, { originalSlot: 0, archived: true }),
  ];
  const originalOnly = { completed: ['original'], practice: { bests: { original: 2 }, unlockedWorlds: 1 } };
  assert.equal(campaignAchievements(catalog, originalOnly.completed, originalOnly.practice).get('refined')?.stars, 3);
  assert.equal(completedOriginalRoad(catalog, originalOnly.completed, 'refined'), 'original');
  const intermediate = { completed: ['original', 'earlier-revision'], practice: { bests: { original: 2, 'earlier-revision': 7 }, unlockedWorlds: 1 } };
  const normalized = normalizePracticeState(catalog, intermediate);
  assert.equal(campaignAchievements(catalog, normalized.completed, normalized.practice).get('refined')?.stars, 3);
  assert.equal(completedOriginalRoad(catalog, normalized.completed, 'refined'), 'earlier-revision');
  assert.equal(Object.hasOwn(normalized.practice.bests, 'refined'), false);
  assert.deepEqual(normalized.practice.bests, intermediate.practice.bests);
  assert.throws(() => campaignAchievements(catalog.slice(0, 2), [], { bests: {}, unlockedWorlds: 1 }), /missing its original route/);
  assert.throws(() => campaignAchievements([
    place('cycle', 4, { campaignSlot: 0, legacyId: 'cycle' }),
  ], [], { bests: {}, unlockedWorlds: 1 }), /circular/);
});
