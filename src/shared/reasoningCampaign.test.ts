import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { REASONING_AUDIT, REASONING_CAMPAIGN } from './reasoningCampaign.generated.ts';
import { REASONING_REFINEMENTS, REFINEMENT_AUDIT } from './reasoningRefinements.generated.ts';
import { campaignAchievements, campaignPlaces, campaignWorlds, nextCampaignPlace, practiceGate } from './progression.ts';
import { findPuzzle, getCatalog, getLegacyPuzzles, getPuzzles } from './puzzles.ts';
import { probeReasoningGreedy, reasoningFingerprint, reasoningGreedyRejection, reasoningQuality, reasoningRejection } from './reasoningQuality.ts';
import { certifyRepairSearch } from './repairSearch.ts';
import { validateRepair } from './rules.ts';

test('the immutable revised campaign contains 1000 non-cosmetic layouts and no runtime-search certificates are silently invented', () => {
  const active = getPuzzles(2).filter(puzzle => !puzzle.archived);
  const refinements = new Map(REASONING_REFINEMENTS.map(puzzle => [puzzle.legacyId, puzzle]));
  assert.equal(REASONING_CAMPAIGN.length, 1000);
  assert.equal(createHash('sha256').update(JSON.stringify(REASONING_CAMPAIGN)).digest('hex'), REASONING_AUDIT.sha256);
  assert.equal(createHash('sha256').update(JSON.stringify(REASONING_CAMPAIGN.map(puzzle => refinements.get(puzzle.id) ?? puzzle))).digest('hex'), REFINEMENT_AUDIT.sha256);
  assert.equal(REFINEMENT_AUDIT.baseSha256, REASONING_AUDIT.sha256);
  assert.equal(REFINEMENT_AUDIT.count, REASONING_REFINEMENTS.length);
  assert.equal(active.length, 1000);
  assert.equal(new Set(active.map(puzzle => reasoningFingerprint(puzzle.board))).size, 1000);
  assert.equal(new Set(active.map(puzzle => puzzle.title)).size, 1000);
  assert.equal(REASONING_AUDIT.certified.length + REASONING_AUDIT.preservedIntroductions, 1000);
  assert.equal(campaignWorlds(1000).length, 50);
  assert.equal(new Set(campaignWorlds(1000).map(world => world.title)).size, 50);
  assert.ok(REASONING_AUDIT.examined > 1000);
});

test('every revised board replays authoritatively and later stops pass the real planning gates', () => {
  const preserved = new Map(getLegacyPuzzles().map(puzzle => [puzzle.id, puzzle]));
  const stages = new Map<number, { count: number; rocks: number; forced: number; greedySolved: number }>();
  for (const [slot, puzzle] of getPuzzles(2).filter(puzzle => !puzzle.archived).entries()) {
    assert.equal(puzzle.campaignSlot, slot);
    assert.equal(puzzle.minimum, puzzle.witness.length);
    validateRepair(puzzle, 'daily', puzzle.witness);
    if (preserved.has(puzzle.id)) {
      const original = preserved.get(puzzle.id);assert.ok(original);
      assert.deepEqual(puzzle.board, original.board);
      assert.deepEqual(puzzle.witness, original.witness);
      continue;
    }
    const quality = reasoningQuality(puzzle);
    assert.equal(reasoningRejection(puzzle, quality, puzzle.challengeTier ?? 0), null, puzzle.id);
    const tier = puzzle.challengeTier ?? 0;
    if (tier >= 2) {
      const probe = probeReasoningGreedy(puzzle);
      assert.equal(reasoningGreedyRejection(puzzle, probe, tier), null, puzzle.id);
      const stage = stages.get(tier) ?? { count: 0, rocks: 0, forced: 0, greedySolved: 0 };
      stage.count++;stage.rocks += quality.stoneRatio;stage.forced += quality.rockForcedRatio;
      stage.greedySolved += Number(probe.bestMoves !== null);stages.set(tier, stage);
    }
    if (slot >= 500) assert.ok(quality.planningGap >= 3 && quality.setupMoves >= 2 && quality.dependencyCoverage === 1, puzzle.id);
  }
  for (const tier of [3, 4]) {
    const previous = stages.get(tier - 1), current = stages.get(tier);assert.ok(previous && current);
    assert.ok(current.greedySolved / current.count < previous.greedySolved / previous.count, `tier ${tier}: blind shortcut success must decrease`);
    assert.ok(current.forced / current.count < previous.forced / previous.count, `tier ${tier}: rocks must dictate less of the potential route`);
    assert.ok(Math.abs(current.rocks / current.count - previous.rocks / previous.count) < .03, `tier ${tier}: harder must not mean a higher rock density`);
  }
});

test('a fresh exact-search rerun confirms representative generated minimums instead of trusting their labels', () => {
  const active = getPuzzles(2).filter(puzzle => !puzzle.archived);
  const selected = [...[20, 199, 399, 599, 799, 999].map(slot => active[slot]),
    REASONING_REFINEMENTS[0], REASONING_REFINEMENTS[Math.floor(REASONING_REFINEMENTS.length / 2)], REASONING_REFINEMENTS.at(-1)];
  for (const puzzle of selected) {
    assert.ok(puzzle);
    const proof = certifyRepairSearch(puzzle, 20_000);
    assert.equal(proof.status, 'certified', puzzle.id);
    if (proof.status === 'certified') assert.equal(proof.minimum, puzzle.minimum);
  }
});

test('legacy API catalogues and original board IDs remain intact while returning players keep actual stars and access', () => {
  const legacy = getCatalog(), revised = getCatalog(2), active = campaignPlaces(revised);
  assert.equal(legacy.length, 218);assert.equal(active.length, 1000);
  const originals = getLegacyPuzzles();
  for (const original of [...originals, ...REASONING_CAMPAIGN]) {
    const archived = getPuzzles(2).find(puzzle => puzzle.id === original.id);assert.ok(archived);
    assert.deepEqual(archived.board, original.board);
    assert.deepEqual(archived.witness, original.witness);
    assert.equal(Object.hasOwn(findPuzzle(original.id, 2) ?? {}, 'witness'), false);
  }
  const firstHundred = campaignPlaces(legacy).slice(0, 100);
  const completed = firstHundred.map(place => place.id);
  const practice = { bests: Object.fromEntries(firstHundred.map(place => [place.id, place.minimum ?? 1])), unlockedWorlds: 6 };
  const earned = campaignAchievements(revised, completed, practice);
  assert.ok(active.slice(0, 100).every(place => earned.get(place.id)?.completed && earned.get(place.id)?.stars === 3));
  assert.equal(nextCampaignPlace(revised, completed, practice)?.id, active[100]?.id);
  const replacement = active.find(place => place.legacyId && completed.includes(place.legacyId));assert.ok(replacement?.legacyId);
  assert.equal(Object.hasOwn(practice.bests, replacement.id), false);
  assert.equal(practiceGate(revised, completed, replacement.legacyId, practice).unlocked, true);
});

test('only quality outliers receive new IDs, and both previous banks keep their exact boards and move records', () => {
  const previous = new Map(REASONING_CAMPAIGN.map(puzzle => [puzzle.id, puzzle])), full = getPuzzles(2);
  const active = campaignPlaces(getCatalog(2));
  assert.equal(full.filter(puzzle => puzzle.archived).length, 203 + REASONING_REFINEMENTS.length);
  for (const refinement of REASONING_REFINEMENTS) {
    const original = refinement.legacyId ? previous.get(refinement.legacyId) : undefined;
    assert.ok(original);
    assert.notEqual(refinement.id, original.id);
    assert.equal(refinement.campaignSlot, original.campaignSlot);
    assert.equal(active[refinement.campaignSlot ?? -1]?.id, refinement.id);
    assert.equal(full.find(puzzle => puzzle.id === original.id)?.archived, true);
    const progress = { bests: { [original.id]: original.minimum ?? 1 }, unlockedWorlds: 50 };
    const achievement = campaignAchievements(getCatalog(2), [original.id], progress).get(refinement.id);
    assert.equal(achievement?.stars, 3);
    assert.equal(achievement?.solved, false);
    assert.equal(Object.hasOwn(progress.bests, refinement.id), false);
  }
});
