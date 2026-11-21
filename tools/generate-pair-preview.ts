import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { constructPairChallenge, pairProgressionTarget } from '../src/shared/pairGeneration.ts';
import { evaluatePairChallenge, PAIR_JOURNEY_STATE_BUDGET, pairDifficultyRegresses, pairGeometry, pairPlanningScore, pairRouteJunctions } from '../src/shared/pairDifficulty.ts';
import type { PairChallengeEvaluation } from '../src/shared/pairDifficulty.ts';
import { reasoningFingerprint } from '../src/shared/reasoningQuality.ts';
import { campaignWorlds, PRACTICE_WORLD_SIZE } from '../src/shared/progression.ts';
import { validateRepair } from '../src/shared/rules.ts';
import type { AuthoredPuzzle } from '../src/shared/types.ts';
import { isPuzzle, isRecord, isSwap } from '../src/shared/validation.ts';

const destination = resolve(process.argv.find(arg => arg.startsWith('--out='))?.slice('--out='.length) ??
  '.local\\pair-global-preview-v3.json');
const revision = process.argv.find(arg => arg.startsWith('--revision='))?.slice('--revision='.length) ?? 'pair-engine-v3';
if (!/^pair-engine-v[1-9]\d*(?:-[a-z0-9]+)*$/.test(revision)) throw new Error('Choose a distinct pair-engine-vN revision for new puzzle IDs.');
const previousPath = process.argv.find(arg => arg.startsWith('--previous='))?.slice('--previous='.length);
const authored = (value: unknown): value is AuthoredPuzzle => isPuzzle(value) && 'witness' in value &&
  Array.isArray(value.witness) && value.witness.every(isSwap);
async function loadPrevious(file: string): Promise<{ levels: AuthoredPuzzle[]; archive: AuthoredPuzzle[]; sha256: string }> {
  const data: unknown = JSON.parse(await readFile(resolve(file), 'utf8'));
  if (!isRecord(data)) throw new Error('The previous review bank could not be read; no progress links were written.');
  const levels = data['levels'], archive = data['archive'] ?? [], sha256 = data['sha256'];
  if (!Array.isArray(levels) || levels.length !== 20 || !levels.every(authored) ||
      !Array.isArray(archive) || !archive.every(authored) || typeof sha256 !== 'string' ||
      createHash('sha256').update(JSON.stringify(levels)).digest('hex') !== sha256 ||
      data['archiveSha256'] !== undefined &&
        createHash('sha256').update(JSON.stringify(archive)).digest('hex') !== data['archiveSha256'] ||
      new Set([...levels, ...archive].map(puzzle => puzzle.id)).size !== levels.length + archive.length) {
    throw new Error('The previous review is incomplete or changed; no progress links were written.');
  }
  for (const puzzle of [...levels, ...archive]) validateRepair(puzzle, 'daily', puzzle.witness);
  return { levels, archive, sha256 };
}
const previous = previousPath ? await loadPrevious(previousPath) : null;
if (previous && [...previous.levels, ...previous.archive].some(puzzle => puzzle.id.startsWith(`${revision}-`))) {
  throw new Error('This review revision already has player records. Choose a new --revision and --out; existing puzzle IDs cannot be reused.');
}
const TITLES = [
  'My sunrise', 'The borrowed bend', 'A careful little cut', 'The other end',
  'Across the quiet brook', 'The road we keep', 'A bridge worth saving', 'Not one stone spare',
  'The patient crossing', 'Between two courtyards', 'Where the paths agree', 'A turn for home',
  'The far bank', 'Every piece matters', 'Beyond the first answer', 'Two roads, one choice',
  'The interwoven lane', 'Before the last crossing', 'The long way, made small', 'Everyone gets home',
] as const;
interface Candidate { puzzle: AuthoredPuzzle; evaluation: PairChallengeEvaluation; seed: number; routePairs: number; fingerprint: string }
const selected: Candidate[] = [];
const seen = new Set<string>(), rejected: Record<string, number> = {};
const began = performance.now();
let examined = 0;
const reject = (reason: string): void => { rejected[reason] = (rejected[reason] ?? 0) + 1; };
for (let slot = 0; slot < 20; slot++) {
  const target = pairProgressionTarget(slot), { minimum } = target, preceding = selected.at(-1);
  const initialJunctions = slot % 3;
  const pool: Candidate[] = [], poolSeen = new Set<string>();
  for (let routePairs = Math.max(target.routePairs, preceding?.routePairs ?? 0); routePairs <= 18 && !pool.length; routePairs++) {
    for (let seed = 1; seed <= 10000 && pool.length < 6; seed++) {
      if (performance.now() - began > 300000) throw new Error('The offline generation budget ended. No incomplete review bank was written.');
      examined++;
      const constructed = constructPairChallenge(minimum, seed, routePairs);
      if (constructed.status === 'rejected') { reject(constructed.reason); continue; }
      if (pairRouteJunctions(constructed.puzzle.board, pairGeometry(constructed.puzzle).geodesic) !== initialJunctions) {
        reject('opening-road-web-grade'); continue;
      }
      const evaluation = evaluatePairChallenge(constructed.puzzle, preceding?.evaluation);
      if (evaluation.status === 'rejected') { reject(evaluation.reason); continue; }
      const fingerprint = reasoningFingerprint(constructed.puzzle.board);
      if (seen.has(fingerprint) || poolSeen.has(fingerprint)) { reject('canonical-duplicate'); continue; }
      pool.push({ puzzle: constructed.puzzle, evaluation: evaluation.evaluation, seed, routePairs, fingerprint });
      poolSeen.add(fingerprint);
    }
  }
  pool.sort((a, b) => a.evaluation.route.pressure - b.evaluation.route.pressure ||
    pairPlanningScore(a.evaluation) - pairPlanningScore(b.evaluation) ||
    a.evaluation.route.initialJunctions - b.evaluation.route.initialJunctions || a.seed - b.seed);
  const candidate = pool[0];
  if (!candidate) throw new Error(`No fair globally progressing candidate for stop ${slot + 1} (${minimum} moves). Rejections: ${JSON.stringify(rejected)}`);
  selected.push(candidate); seen.add(candidate.fingerprint);
  console.log(JSON.stringify({ complete: selected.length, minimum, size: candidate.puzzle.board.length,
    routePressure: candidate.evaluation.route.pressure, initialRouteJunctions: candidate.evaluation.route.initialJunctions,
    planningScore: pairPlanningScore(candidate.evaluation), minimumBreakingCuts: candidate.evaluation.stock.minimumBreakingCuts,
    examined, seconds: Math.round((performance.now() - began) / 1000) }));
}
const worlds = campaignWorlds(selected.length);
const levels: AuthoredPuzzle[] = selected.map((candidate, slot) => {
  const title = TITLES[slot], world = worlds[Math.floor(slot / PRACTICE_WORLD_SIZE)];
  if (!title || !world) throw new Error('The globally graded review is missing its presentation metadata.');
  const legacy = previous?.levels[slot];
  return { ...candidate.puzzle, id: `${revision}-${String(slot + 1).padStart(2, '0')}`,
    title, theme: world.theme, chapter: slot + 1, campaignSlot: slot, ...(legacy ? { legacyId: legacy.id } : {}) };
});
const archive: AuthoredPuzzle[] = previous ? [...previous.levels, ...previous.archive].map((puzzle, index) => {
  const { campaignSlot, ...original } = puzzle;
  return { ...original, archived: true, originalSlot: puzzle.originalSlot ?? campaignSlot ?? index };
}) : [];
const evidence = selected.map((candidate, slot) => ({ id: levels[slot]?.id, seed: candidate.seed,
  routePairs: candidate.routePairs, planningScore: pairPlanningScore(candidate.evaluation), evaluation: candidate.evaluation }));
if (levels.length !== 20 || levels.some((puzzle, index) => puzzle.minimum !== pairProgressionTarget(index).minimum || puzzle.area !== 2) ||
    selected.some((candidate, index) => {
      const before = selected[index - 1];
      return before !== undefined && pairDifficultyRegresses(before.evaluation, candidate.evaluation);
    }) ||
    new Set([...levels, ...archive].map(puzzle => puzzle.id)).size !== levels.length + archive.length) {
  throw new Error('The review has an incorrect global curve or reuses an existing progress ID.');
}
const manifest = {
  revision,
  status: 'Engine-generated 20-level challenge review. Not installed or merged into the released campaign.',
  builtAt: new Date().toISOString(), levels, archive, evidence,
  previousBankSha256: previous?.sha256 ?? null,
  archiveSha256: createHash('sha256').update(JSON.stringify(archive)).digest('hex'),
  checks: {
    count: 20, patchTiles: 2, minimumCurve: levels.map(puzzle => puzzle.minimum),
    boardSizesNeverShrink: true, surplusRoadPieces: 0, exactMinimumCertificates: true,
    globalPlanningScoreNeverDecreases: true, canonicalStartingGeometriesUnique: true,
    routePressureNeverDecreases: true, sameParInitialRoadJunctionsIncrease: true,
    maximumBoardSize: Math.max(...levels.map(puzzle => puzzle.board.length)),
    maximumJourneyStates: Math.max(...selected.flatMap(candidate =>
      [candidate.evaluation.route.maximumJourneyStates, candidate.evaluation.greedy.maximumJourneyStates])),
    journeyStateBudget: PAIR_JOURNEY_STATE_BUDGET,
    previousCompletionsAndStarsLinked: previous !== null,
  },
  engine: {
    constructor: 'src/shared/pairGeneration.ts',
    evaluator: 'src/shared/pairDifficulty.ts',
    proof: 'Road inventory equals an ordered geometric lower bound. Given road pairs can increase independently of the minimum. Exactly twice the minimum road tiles start outside every shortest possible leg; a swap imports at most two, and the legal witness attains that lower bound.',
    planning: 'Stock is insulated from the geodesic boundary, ruling out cross-boundary rescue swaps at the optimum. Count cuts that destroy the remaining perfect matching and therefore require extra moves. Require branching and reject witness-blind greedy optima for every level.',
    greedyProbe: 'Three deterministic tie orders, at most 256 geometrically promising candidates per step, tested through minimum plus two moves. This is a bounded heuristic, not exhaustive human-difficulty evidence.',
    globalProgression: 'Grade candidates before assigning island scenery. Three opening stops per move band, with strictly more initial road junctions at the same par. Neither route pressure nor overall planning score may decrease. Stock-cut pressure can ease when compensated by more route decisions or a higher minimum. The absolute-slot policy caps par at 12 and boards at 12x12; capped-par content can vary at the same measured grade rather than demand infinite growth in one junction count.',
    routePressure: 'Twice the traversable junctions in the verified final layout plus the initial geodesic-road junctions. Stock parking junctions and wrong-axis bridge contacts do not count. This is a measured layout signal, not a proof of subjective human difficulty.',
    planningScore: '8 times certified minimum plus 4 times route pressure plus proven minimum-breaking stock cuts. These engineering weights prevent a single parking-stock statistic from forcing needless frustration. They need human playtest calibration.',
    runtime: 'Construction, matching analysis and greedy probes run offline only. Reject candidates exceeding the deterministic route-search state budget on any witness prefix or greedy-probe play state. This sampling does not bound every possible player arrangement or certify physical-phone frame rates.',
  },
  examined, rejected,
  difficultyNote: 'Opening minima are 3,3,3 through 8,8,8 then 9,9. Real initial-road junctions increase within each same-par group; measured route pressure, overall planning score and size never reset at an island. Later content may stay at the capped par. Only this twenty-stop review is replaced; human enjoyment still needs playtesting.',
  originalCampaignChanged: false, originalProgressChanged: false, originalRanksChanged: false,
  sha256: createHash('sha256').update(JSON.stringify(levels)).digest('hex'),
  milliseconds: Math.round(performance.now() - began),
};
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify({ complete: true, destination, minima: manifest.checks.minimumCurve, examined,
  rejected, milliseconds: manifest.milliseconds, sha256: manifest.sha256 }, null, 2));
