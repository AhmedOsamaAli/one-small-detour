import { createHash } from 'node:crypto';
import { REASONING_AUDIT, REASONING_CAMPAIGN } from '../src/shared/reasoningCampaign.generated.ts';
import { REASONING_REFINEMENTS, REFINEMENT_AUDIT } from '../src/shared/reasoningRefinements.generated.ts';
import { probeReasoningGreedy, reasoningFingerprint, reasoningGreedyRejection, reasoningQuality, reasoningRejection } from '../src/shared/reasoningQuality.ts';
import { validateRepair } from '../src/shared/rules.ts';
import { postcardGardens } from '../src/client/postcard.ts';
import { getPuzzles } from '../src/shared/puzzles.ts';
import { reasoningCandidate } from './reasoning-candidates.ts';

const hash = (entries: typeof REASONING_CAMPAIGN): string => createHash('sha256').update(JSON.stringify(entries)).digest('hex');
const originalHash = hash(REASONING_CAMPAIGN), campaign = getPuzzles(2).filter(puzzle => !puzzle.archived);
const refinements = new Map(REASONING_REFINEMENTS.map(puzzle => [puzzle.legacyId, puzzle]));
const activeHash = hash(REASONING_CAMPAIGN.map(puzzle => refinements.get(puzzle.id) ?? puzzle));
if (originalHash !== REASONING_AUDIT.sha256 || REASONING_CAMPAIGN.length !== 1000 ||
    REFINEMENT_AUDIT.baseSha256 !== originalHash || REFINEMENT_AUDIT.count !== REASONING_REFINEMENTS.length ||
    activeHash !== REFINEMENT_AUDIT.sha256 || campaign.length !== 1000) throw new Error('The immutable campaign/refinement audit no longer matches.');
const seen = new Set<string>(), tiers: Record<string, number> = {}, sizes: Record<string, number> = {}, minimums: Record<string, number> = {};
const bands = new Map<number, { count: number; stones: number; forced: number; maxForced: number; greedySolved: number; greedyNearMinimum: number }>();
const began = performance.now();
for (const puzzle of campaign) {
  const key = reasoningFingerprint(puzzle.board);
  if (seen.has(key)) throw new Error(`${puzzle.id}: a rotated or cosmetic duplicate entered the campaign.`);
  seen.add(key);
  const repaired = validateRepair(puzzle, 'daily', puzzle.witness).board;
  if (!postcardGardens(repaired).length) throw new Error(`${puzzle.id}: the finish has no safe garden.`);
  if (puzzle.id.startsWith('reasoning-v')) {
    const quality = reasoningQuality(puzzle), reject = reasoningRejection(puzzle, quality, puzzle.challengeTier ?? 0);
    if (reject) throw new Error(`${puzzle.id}: ${reject}`);
    const tier = puzzle.challengeTier;
    if (!tier) throw new Error(`${puzzle.id}: the difficulty tier is missing.`);
    const probe = probeReasoningGreedy(puzzle), greedyReject = reasoningGreedyRejection(puzzle, probe, tier);
    if (greedyReject) throw new Error(`${puzzle.id}: ${greedyReject}`);
    const band = bands.get(tier) ?? { count: 0, stones: 0, forced: 0, maxForced: 0, greedySolved: 0, greedyNearMinimum: 0 };
    band.count++;band.stones += quality.stoneRatio;band.forced += quality.rockForcedRatio;
    band.maxForced = Math.max(band.maxForced, quality.rockForcedRatio);
    band.greedySolved += Number(probe.bestMoves !== null);
    band.greedyNearMinimum += Number(probe.bestMoves !== null && probe.bestMoves <= puzzle.witness.length + 2);
    bands.set(tier, band);
  }
  const tier = String(puzzle.challengeTier), size = String(puzzle.board.length), minimum = String(puzzle.minimum);
  tiers[tier] = (tiers[tier] ?? 0) + 1;sizes[size] = (sizes[size] ?? 0) + 1;minimums[minimum] = (minimums[minimum] ?? 0) + 1;
}
for (const index of [0, Math.floor(REFINEMENT_AUDIT.certified.length / 2), REFINEMENT_AUDIT.certified.length - 1]) {
  const recipe = REFINEMENT_AUDIT.certified[index], puzzle = REASONING_REFINEMENTS[index];
  if (!recipe || !puzzle || !puzzle.challengeTier || puzzle.board.length !== 6 && puzzle.board.length !== 8) throw new Error('A refinement recipe is incomplete.');
  const rebuilt = reasoningCandidate(recipe.seed, puzzle.frame, puzzle.challengeTier, puzzle.board.length, recipe.trial, recipe.depth);
  if (rebuilt.status !== 'accepted' || JSON.stringify(rebuilt.puzzle.board) !== JSON.stringify(puzzle.board) ||
      JSON.stringify(rebuilt.puzzle.witness) !== JSON.stringify(puzzle.witness) || rebuilt.puzzle.minimum !== puzzle.minimum) {
    throw new Error(`${puzzle.id}: its recorded generation recipe did not reproduce the certified board.`);
  }
}
console.log(JSON.stringify({ campaign: campaign.length, uniqueGeometries: seen.size, refinements: REASONING_REFINEMENTS.length,
  archivedRoutes: getPuzzles(2).filter(puzzle => puzzle.archived).length, tiers, sizes, minimums,
  difficulty: [...bands].map(([tier, band]) => ({ tier, count: band.count, averageRockFraction: band.stones / band.count,
    averageRockForcedFraction: band.forced / band.count, maximumRockForcedFraction: band.maxForced,
    blindGreedySolvesWithin12: band.greedySolved, blindGreedySolvesWithinTwoOfMinimum: band.greedyNearMinimum })),
  preservedIntroductions: REASONING_AUDIT.preservedIntroductions, offlineCandidatesExamined: REASONING_AUDIT.examined,
  originalSha256: originalHash, activeSha256: REFINEMENT_AUDIT.sha256, safeFinishGardens: true,
  note: 'Blind greedy probes use three deterministic tie orders, do not read witnesses, and are not human playtesting.',
  milliseconds: Math.round(performance.now() - began) }, null, 2));
