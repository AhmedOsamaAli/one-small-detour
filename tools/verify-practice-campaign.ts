import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PRACTICE_CAMPAIGN, PRACTICE_CAMPAIGN_AUDIT } from '../src/shared/practiceCampaign.generated.ts';
import { PRACTICE_CURRICULUM, structuralPuzzleIdentity } from '../src/shared/campaignCurriculum.ts';
import { evaluatePatchChallenge, patchPlanningScore } from '../src/shared/patchDifficulty.ts';
import { constructPatchChallenge, constructPreparedPatchChallenge } from '../src/shared/patchGeneration.ts';
import { PAIR_JOURNEY_STATE_BUDGET } from '../src/shared/pairDifficulty.ts';
import { getPuzzles } from '../src/shared/puzzles.ts';
import { checkPuzzle, validateRepair } from '../src/shared/rules.ts';
import { postcardGardens } from '../src/client/postcard.ts';

const began = performance.now(), levels = PRACTICE_CAMPAIGN, audit = PRACTICE_CAMPAIGN_AUDIT;
const previous = getPuzzles(2), previousActive = previous.filter(puzzle => !puzzle.archived);
const digest = createHash('sha256').update(JSON.stringify(levels)).digest('hex');
assert.equal(levels.length, 1000);
assert.equal(audit.count, levels.length);
assert.equal(audit.records.length, levels.length);
assert.equal(digest, audit.sha256, 'The immutable bank must match its recorded digest.');
const seen = new Set<string>(), profiles = new Map<string, number>();
const layouts: { frame: string; minimum: number; size: number; layout: string }[] = [];
const frames: Record<string, number> = {}, minimums: Record<string, number> = {}, sizes: Record<string, number> = {};
const regenerated = new Set<string>(), stageCounts: object[] = [];
let preparationCount = 0, maximumJourneyStates = 0;
for (const [slot, puzzle] of levels.entries()) {
  const record = audit.records[slot], old = previousActive[slot];
  assert.ok(record && old && puzzle.minimum);
  assert.equal(record.id, puzzle.id);
  assert.equal(puzzle.id, `practice-v3-${String(slot + 1).padStart(4, '0')}`);
  assert.equal(puzzle.campaignSlot, slot);
  assert.equal(puzzle.legacyId, old.id);
  assert.ok(!puzzle.archived);
  const frame = puzzle.frame ?? 'pair', size = puzzle.board.length;
  assert.ok(size <= 12 && puzzle.minimum >= 3 && puzzle.minimum <= 8);
  const graded = evaluatePatchChallenge(puzzle, slot >= 3);
  if (graded.status !== 'accepted') throw new Error(`${puzzle.id}: ${graded.reason}`);
  const evaluation = graded.evaluation;
  assert.deepEqual(evaluation, record.evaluation, `${puzzle.id}: fresh grading disagrees with the stored evidence.`);
  maximumJourneyStates = Math.max(maximumJourneyStates, evaluation.route.maximumJourneyStates, evaluation.greedy.maximumJourneyStates);
  assert.ok(maximumJourneyStates <= PAIR_JOURNEY_STATE_BUDGET);
  assert.equal(evaluation.certificate.suppliedRoadTiles, evaluation.certificate.requiredRoadTiles);
  assert.equal(evaluation.certificate.minimum, puzzle.minimum);
  assert.ok(evaluation.greedy.bestMoves === null || evaluation.greedy.bestMoves >= puzzle.minimum,
    `${puzzle.id}: an independently found repair must not contradict its lower-bound certificate.`);
  assert.equal(evaluation.certificate.preparationMovesProved, Number(record.scenario === 'preparation'));
  if (record.scenario === 'preparation') {
    preparationCount++;
    assert.ok(evaluation.stockInsulated);
    assert.equal(evaluation.initialCover.status, 'impossible');
    assert.equal(evaluation.cover.status, 'covered');
  }
  const repaired = validateRepair(puzzle, 'daily', puzzle.witness).board;
  const journey = checkPuzzle(repaired, puzzle).journey;
  assert.ok(journey?.solved);
  assert.equal(journey.path.length, evaluation.certificate.suppliedRoadTiles + (puzzle.journey?.length ?? 0),
    `${puzzle.id}: every paving and bridge tile must actually be used.`);
  assert.ok(postcardGardens(repaired).length, `${puzzle.id}: the finish must have a safe garden.`);
  const identity = structuralPuzzleIdentity(puzzle.board);
  assert.ok(!seen.has(identity.key), `${puzzle.id}: a rotated, mirrored or cosmetic duplicate entered the bank.`);
  seen.add(identity.key);
  for (const other of layouts) {
    if (other.frame !== frame || other.minimum !== puzzle.minimum || other.size !== size ||
        other.layout.length !== identity.layout.length) continue;
    let difference = 0;
    for (let index = 0; index < identity.layout.length; index++) {
      if (identity.layout[index] !== other.layout[index]) difference++;
    }
    assert.ok(difference >= (size >= 10 ? 6 : 4), `${puzzle.id}: a functional near-clone entered the bank.`);
  }
  layouts.push({ frame, minimum: puzzle.minimum, size, layout: identity.layout });
  const state = puzzle.board.join(''), axes = Number(state.includes('h')) + Number(state.includes('v'));
  const profile = [frame, puzzle.minimum, size, record.scenario, evaluation.cover.placements, evaluation.cover.branchingCells,
    evaluation.minimumBreakingCuts, evaluation.route.initialJunctions, evaluation.route.solvedJunctions, axes].join(':');
  const profileCount = (profiles.get(profile) ?? 0) + 1;
  assert.ok(profileCount <= 5, `${puzzle.id}: too many identical reasoning profiles.`);
  profiles.set(profile, profileCount);
  const before = audit.records[slot - 1]?.evaluation;
  if (before) {
    assert.ok(size >= before.boardSize, `${puzzle.id}: board size regresses.`);
    assert.ok(puzzle.minimum >= before.certificate.minimum, `${puzzle.id}: the exact move minimum regresses.`);
    assert.ok(evaluation.route.pressure >= before.route.pressure, `${puzzle.id}: route-choice pressure regresses.`);
    assert.ok(patchPlanningScore(evaluation) >= patchPlanningScore(before), `${puzzle.id}: the planning grade regresses.`);
  }
  frames[frame] = (frames[frame] ?? 0) + 1;
  minimums[puzzle.minimum] = (minimums[puzzle.minimum] ?? 0) + 1;
  sizes[size] = (sizes[size] ?? 0) + 1;
  if ((slot + 1) % 100 === 0) console.log(`Freshly audited ${slot + 1}/${levels.length} Practice puzzles.`);
}
let start = 0;
for (const [index, band] of PRACTICE_CURRICULUM.entries()) {
  const segment = levels.slice(start, band.end), records = audit.records.slice(start, band.end);
  assert.equal(segment.length, band.end - start);
  assert.ok(segment.every(puzzle => puzzle.minimum === band.minimum));
  assert.ok(records.every(record => record.evaluation.route.pressure <= band.pressureCap));
  const families: Record<string, { count: number; preparation: number }> = {};
  for (const [position, frame] of band.frames.entries()) {
    const members = segment.filter(puzzle => (puzzle.frame ?? 'pair') === frame);
    const count = Math.floor(segment.length / band.frames.length) + Number(position < segment.length % band.frames.length);
    const prepared = records.filter(record => record.scenario === 'preparation' &&
      members.some(puzzle => puzzle.id === record.id)).length;
    assert.equal(members.length, count, `Stage ${index + 1}: ${frame} revisit quota.`);
    assert.ok(index < 3 || prepared >= Math.ceil(count / 3), `Stage ${index + 1}: ${frame} preparation quota.`);
    if (index > 0) {
      const terrain = members.flatMap(puzzle => puzzle.board).join('');
      assert.ok(terrain.includes('h') && terrain.includes('v'), `Stage ${index + 1}: ${frame} must revisit both bridge axes.`);
      assert.ok(members.every(puzzle => /[hv]/.test(puzzle.board.join(''))));
    }
    for (const scenario of ['direct', 'preparation'] as const) {
      const recipe = records.find(record => record.scenario === scenario && members.some(puzzle => puzzle.id === record.id));
      if (!recipe) continue;
      const puzzle = segment.find(puzzle => puzzle.id === recipe.id);
      assert.ok(puzzle?.minimum);
      const built = scenario === 'preparation' ?
        constructPreparedPatchChallenge(frame, puzzle.minimum, recipe.seed, recipe.routePairs) :
        constructPatchChallenge(frame, puzzle.minimum, recipe.seed, recipe.routePairs, 'import');
      if (built.status !== 'constructed') throw new Error(`${puzzle.id}: its construction recipe failed: ${built.reason}`);
      for (const field of ['board', 'witness', 'goals', 'journey', 'area', 'frame', 'minimum'] as const) {
        assert.deepEqual(built.puzzle[field], puzzle[field], `${puzzle.id}: its recipe changed ${field}.`);
      }
      regenerated.add(puzzle.id);
    }
    families[frame] = { count, preparation: prepared };
  }
  assert.equal(Object.values(families).reduce((sum, family) => sum + family.count, 0), segment.length);
  stageCounts.push({ from: start + 1, through: band.end, minimum: band.minimum, families });
  start = band.end;
}
assert.equal(start, levels.length);
assert.ok(levels.slice(0, 3).every(puzzle => puzzle.board.length === 6 && !/[hv]/.test(puzzle.board.join(''))));
const installed = getPuzzles(3), archives = installed.filter(puzzle => puzzle.archived);
assert.equal(installed.length, levels.length + previous.length);
assert.equal(archives.length, previous.length);
const preserved = new Map(archives.map(puzzle => [puzzle.id, puzzle]));
for (const puzzle of previous) {
  assert.deepEqual(preserved.get(puzzle.id), { ...puzzle, archived: true }, `${puzzle.id}: the old route changed.`);
  validateRepair(puzzle, 'daily', puzzle.witness);
}
console.log(JSON.stringify({ complete: true, campaign: levels.length, archived: archives.length, frames, minimums, sizes,
  exactNoSurplusCertificates: levels.length, freshFullEvaluations: levels.length, distinctFunctionalLayouts: seen.size,
  genuinePreparationMoves: preparationCount, independentlyReconstructedRecipes: regenerated.size, maximumJourneyStates,
  stages: stageCounts, sha256: digest, milliseconds: Math.round(performance.now() - began),
  limitation: 'The exact inventory and move lower bounds are proofs. Structural grades and greedy resistance are engineering checks, not empirically calibrated human difficulty or enjoyment.' }, null, 2));
