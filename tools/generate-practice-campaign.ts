import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { constructPatchChallenge, constructPreparedPatchChallenge } from '../src/shared/patchGeneration.ts';
import type { CampaignFrame } from '../src/shared/patchGeneration.ts';
import { evaluatePatchChallenge, patchPlanningScore } from '../src/shared/patchDifficulty.ts';
import { analyzePairRoute } from '../src/shared/pairDifficulty.ts';
import type { PatchEvaluation } from '../src/shared/patchDifficulty.ts';
import { PRACTICE_CURRICULUM, structuralPuzzleIdentity } from '../src/shared/campaignCurriculum.ts';
import type { CurriculumBand } from '../src/shared/campaignCurriculum.ts';
import { getPuzzles } from '../src/shared/puzzles.ts';
import { campaignWorlds, PRACTICE_WORLD_SIZE } from '../src/shared/progression.ts';
import { checkPuzzle, RuleError, validateRepair } from '../src/shared/rules.ts';
import type { AuthoredPuzzle } from '../src/shared/types.ts';
import { isPuzzle, isRecord, isSwap } from '../src/shared/validation.ts';

const output = resolve('src\\shared\\practiceCampaign.generated.ts'), reportFile = resolve('.local\\practice-campaign-v3.json');
const started = performance.now(), budget = 5_400_000, previous = getPuzzles(2).filter(puzzle => !puzzle.archived);
if (previous.length !== 1000) throw new Error('The previous 1000-stop campaign is required for safe progress links.');
for (const file of [output, reportFile]) {
  try { await access(file); throw new Error(`Existing immutable campaign was not overwritten: ${file}`); }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
}
interface Candidate {
  puzzle: AuthoredPuzzle; evaluation: PatchEvaluation; seed: number; routePairs: number;
  frame: CampaignFrame; scenario: 'direct' | 'preparation'; key: string; layout: string;
}
const accepted: Candidate[] = [], selected: Candidate[] = [], seen = new Set<string>(), profiles = new Map<string, number>();
const rejected: Record<string, number> = {};
let examined = 0;
const checkpointFile = resolve('.local\\practice-generation-checkpoint-v3.json');
const sourceFiles = ['tools\\generate-practice-campaign.ts', 'src\\shared\\patchGeneration.ts', 'src\\shared\\patchDifficulty.ts',
  'src\\shared\\pairGeneration.ts', 'src\\shared\\pairDifficulty.ts', 'src\\shared\\rules.ts',
  'src\\shared\\campaignCurriculum.ts', 'src\\shared\\generation.ts'];
const sourceHash = createHash('sha256');
for (const file of sourceFiles) sourceHash.update(await readFile(file));
sourceHash.update(JSON.stringify(previous));
const sourceRevision = sourceHash.digest('hex');
let resumeBand = 0, resumePool: Candidate[] = [], resumeCursors: [CampaignFrame, number][] = [];
function candidateRecord(value: unknown): value is Candidate {
  if (!isRecord(value) || !isPuzzle(value['puzzle']) || !isRecord(value['evaluation'])) return false;
  const puzzle = value['puzzle'], evaluation = value['evaluation'];
  return 'witness' in puzzle && Array.isArray(puzzle.witness) && puzzle.witness.every(isSwap) &&
    isRecord(evaluation['certificate']) && typeof evaluation['certificate']['minimum'] === 'number' &&
    isRecord(evaluation['route']) && typeof evaluation['route']['pressure'] === 'number' &&
    typeof value['seed'] === 'number' && typeof value['routePairs'] === 'number' &&
    ['pair', 'strip', 'square', 'ell'].includes(String(value['frame'])) &&
    ['direct', 'preparation'].includes(String(value['scenario'])) &&
    typeof value['key'] === 'string' && typeof value['layout'] === 'string';
}
try {
  const saved: unknown = JSON.parse(await readFile(checkpointFile, 'utf8'));
  if (!isRecord(saved) || !isRecord(saved['payload']) ||
      createHash('sha256').update(JSON.stringify(saved['payload'])).digest('hex') !== saved['sha256']) {
    throw new Error('The saved generation checkpoint is invalid; it was not trusted or overwritten.');
  }
  const payload = saved['payload'], list = payload['accepted'], selectedKeys = payload['selected'], poolKeys = payload['pool'];
  if (payload['sourceRevision'] !== sourceRevision || !Array.isArray(list) || !list.every(candidateRecord) ||
      !Array.isArray(selectedKeys) || !selectedKeys.every(key => typeof key === 'string') ||
      !Array.isArray(poolKeys) || !poolKeys.every(key => typeof key === 'string') ||
      typeof payload['bandIndex'] !== 'number' || typeof payload['examined'] !== 'number' ||
      !isRecord(payload['rejected']) || !Array.isArray(payload['cursors']) || !Array.isArray(payload['profiles'])) {
    throw new Error('The generation checkpoint does not match this constructor; start a distinct run rather than mixing proofs.');
  }
  accepted.push(...list);
  const lookup = new Map(list.map(value => [value.key, value]));
  const fetch = (key: string): Candidate => {
    const value = lookup.get(key);
    if (!value) throw new Error('The generation checkpoint references a missing candidate.');
    return value;
  };
  selected.push(...selectedKeys.map(fetch)); resumePool = poolKeys.map(fetch);
  for (const value of list) seen.add(value.key);
  for (const [key, count] of Object.entries(payload['rejected'])) {
    if (typeof count !== 'number') throw new Error('A checkpoint rejection count is invalid.');
    rejected[key] = count;
  }
  for (const entry of payload['profiles']) {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[1] !== 'number') throw new Error('A checkpoint profile is invalid.');
    profiles.set(entry[0], entry[1]);
  }
  for (const entry of payload['cursors']) {
    if (!Array.isArray(entry) || !['pair', 'strip', 'square', 'ell'].includes(entry[0]) || typeof entry[1] !== 'number') {
      throw new Error('A checkpoint cursor is invalid.');
    }
    const frame = entry[0];
    if (frame !== 'pair' && frame !== 'strip' && frame !== 'square' && frame !== 'ell') throw new Error('The saved frame family is invalid.');
    resumeCursors.push([frame, entry[1]]);
  }
  resumeBand = payload['bandIndex']; examined = payload['examined'];
  console.log(JSON.stringify({ resumed: true, stage: resumeBand + 1, complete: selected.length, accepted: accepted.length, examined }));
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}
async function checkpoint(bandIndex: number, pool: readonly Candidate[], cursors: ReadonlyMap<CampaignFrame, number>): Promise<void> {
  await mkdir(dirname(checkpointFile), { recursive: true });
  const payload = { sourceRevision, bandIndex, accepted, selected: selected.map(value => value.key), pool: pool.map(value => value.key),
    cursors: [...cursors], profiles: [...profiles], examined, rejected };
  const sha256 = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  await writeFile(`${checkpointFile}.tmp`, JSON.stringify({ sha256, payload }));
  await rename(`${checkpointFile}.tmp`, checkpointFile);
}
const reject = (reason: string): null => { rejected[reason] = (rejected[reason] ?? 0) + 1; return null; };
function regresses(a: PatchEvaluation, b: PatchEvaluation): boolean {
  return b.boardSize < a.boardSize || b.certificate.minimum < a.certificate.minimum ||
    b.route.pressure < a.route.pressure || patchPlanningScore(b) < patchPlanningScore(a);
}
function make(band: CurriculumBand, frame: CampaignFrame, seed: number, pairs: number, scenario: Candidate['scenario'], introductory = false): Candidate | null {
  if (performance.now() - started > budget) throw new Error('The bounded offline run ended. No incomplete campaign was published.');
  examined++;
  try {
    const built = scenario === 'preparation' ? constructPreparedPatchChallenge(frame, band.minimum, seed, pairs) :
      constructPatchChallenge(frame, band.minimum, seed, pairs, 'import');
    if (built.status === 'rejected') return reject(built.reason);
    const state = built.puzzle.board.join(''), axes = Number(state.includes('h')) + Number(state.includes('v'));
    if (introductory && (axes || built.puzzle.board.length !== 6) ||
        !introductory && band.end >= 96 && axes === 0) return reject('curriculum-skill-profile');
    const identity = structuralPuzzleIdentity(built.puzzle.board);
    if (seen.has(identity.key)) return reject('functional-duplicate');
    const before = selected.at(-1)?.evaluation;
    if (before && built.puzzle.board.length < before.boardSize) return reject('outside-global-curriculum-envelope');
    const route = analyzePairRoute(built.puzzle);
    if (route.pressure > band.pressureCap || introductory && route.pressure > 2 ||
        before && (route.pressure < before.route.pressure ||
          8 * band.minimum + 4 * route.pressure + 16 < patchPlanningScore(before))) {
      return reject('outside-global-curriculum-envelope');
    }
    const graded = evaluatePatchChallenge(built.puzzle, !introductory);
    if (graded.status === 'rejected') return reject(graded.reason);
    const e = graded.evaluation;
    if (e.route.pressure > band.pressureCap || introductory && e.route.pressure > 2 ||
        before && regresses(before, e)) return reject('outside-global-curriculum-envelope');
    const near = accepted.some(value => {
      if (value.frame !== frame || value.puzzle.minimum !== band.minimum || value.layout.length !== identity.layout.length) return false;
      let difference = 0;
      for (let index = 0; index < identity.layout.length; index++) {
        if (identity.layout[index] !== value.layout[index] && ++difference >= (e.boardSize >= 10 ? 6 : 4)) return false;
      }
      return true;
    });
    if (near) return reject('near-clone');
    const profile = [frame, band.minimum, e.boardSize, scenario, e.cover.placements, e.cover.branchingCells,
      e.minimumBreakingCuts, e.route.initialJunctions, e.route.solvedJunctions, axes].join(':');
    if ((profiles.get(profile) ?? 0) >= 5) return reject('repeated-reasoning-profile');
    profiles.set(profile, (profiles.get(profile) ?? 0) + 1); seen.add(identity.key);
    const value = { puzzle: built.puzzle, evaluation: e, seed, routePairs: pairs, frame, scenario, ...identity };
    accepted.push(value); return value;
  } catch (error) {
    if (error instanceof RuleError && (error.code === 'journey_complexity' || error.code === 'stock_cover_budget')) return reject(error.code);
    throw error;
  }
}
interface Bucket {
  size: number; pressure: number; score: number; values: Candidate[]; total: number; prior: number;
}
function orderedChain(pool: readonly Candidate[]): Candidate[] {
  const grouped = new Map<string, Bucket>();
  for (const value of pool) {
    const size = value.evaluation.boardSize, pressure = value.evaluation.route.pressure, score = patchPlanningScore(value.evaluation);
    const key = `${size}:${pressure}:${score}`, bucket = grouped.get(key) ?? { size, pressure, score, values: [], total: 0, prior: -1 };
    bucket.values.push(value); grouped.set(key, bucket);
  }
  const buckets = [...grouped.values()].sort((a, b) => a.size - b.size || a.pressure - b.pressure || a.score - b.score);
  let best = -1;
  for (const [index, bucket] of buckets.entries()) {
    let total = 0;
    for (let prior = 0; prior < index; prior++) {
      const before = buckets[prior];
      if (before && before.pressure <= bucket.pressure && before.score <= bucket.score && before.total > total) {
        total = before.total; bucket.prior = prior;
      }
    }
    bucket.total = total + bucket.values.length;
    if (best < 0 || bucket.total > (buckets[best]?.total ?? 0)) best = index;
  }
  const pieces: Candidate[][] = [];
  while (best >= 0) {
    const bucket = buckets[best];
    if (!bucket) throw new Error('The globally ordered grade chain is incomplete.');
    pieces.unshift(bucket.values); best = bucket.prior;
  }
  return pieces.flat();
}
const firstBand = PRACTICE_CURRICULUM[0];
if (!firstBand) throw new Error('The curriculum has no first stage.');
for (let seed = 1; selected.length < 3; seed++) {
  const value = make(firstBand, 'pair', seed, 4, 'direct', true);
  if (value) selected.push(value);
}
for (const [bandIndex, band] of PRACTICE_CURRICULUM.entries()) {
  if (bandIndex < resumeBand) continue;
  const needed = band.end - selected.length;
  if (needed <= 0) continue;
  const quotas = new Map(band.frames.map((frame, index) => [frame,
    Math.floor(needed / band.frames.length) + Number(index < needed % band.frames.length)]));
  const pool: Candidate[] = bandIndex === resumeBand ? [...resumePool] : [];
  const cursors = new Map<CampaignFrame, number>(bandIndex === resumeBand && resumeCursors.length ? resumeCursors :
    band.frames.map(frame => [frame, 0]));
  let chain: Candidate[] = orderedChain(pool);
  const available = (frame: CampaignFrame): number => chain.filter(value => value.frame === frame).length;
  const preparationQuota = (frame: CampaignFrame): number => bandIndex >= 3 ? Math.ceil((quotas.get(frame) ?? 0) / 3) : 0;
  const preparations = (frame: CampaignFrame): number => chain.filter(value => value.frame === frame && value.scenario === 'preparation').length;
  const incomplete = (frame: CampaignFrame): boolean => available(frame) < (quotas.get(frame) ?? 0) || preparations(frame) < preparationQuota(frame);
  for (let trial = 0; band.frames.some(incomplete); trial++) {
    const deficits = [...band.frames].filter(incomplete).sort((a, b) => available(a) / (quotas.get(a) ?? 1) - available(b) / (quotas.get(b) ?? 1));
    const frame = deficits[trial % deficits.length];
    if (!frame) throw new Error('The curriculum lost an active frame family.');
    const cursor = cursors.get(frame) ?? 0; cursors.set(frame, cursor + 1);
    const pairs = band.pairs[cursor % band.pairs.length];
    if (!pairs) throw new Error('The curriculum has no route template.');
    const scenario = Math.floor(cursor / band.pairs.length) % 3 === 2 ? 'preparation' : 'direct';
    const seed = bandIndex * 100000 + Math.floor(cursor / (band.pairs.length * 3)) + 1;
    const value = make(band, frame, seed, pairs, scenario);
    if (value) { pool.push(value); chain = orderedChain(pool); }
    if ((trial + 1) % 500 === 0) {
      const progress = { stage: bandIndex + 1, skill: band.skill, complete: selected.length,
        pool: pool.length, ordered: chain.length, byFrame: Object.fromEntries(band.frames.map(value => [value, available(value)])),
        required: Object.fromEntries(quotas), examined, seconds: Math.round((performance.now() - started) / 1000) };
      console.log(JSON.stringify(progress));
      await mkdir(dirname(reportFile), { recursive: true });
      await writeFile(resolve('.local\\practice-generation-status.json'), JSON.stringify(progress, null, 2) + '\n');
      await checkpoint(bandIndex, pool, cursors);
    }
  }
  const picks = new Set<Candidate>();
  for (const frame of band.frames) {
    const values = chain.filter(value => value.frame === frame), quota = quotas.get(frame) ?? 0;
    const prepared = values.filter(value => value.scenario === 'preparation'), preparationCount = preparationQuota(frame);
    for (let index = 0; index < preparationCount; index++) {
      const value = prepared[Math.floor(index * (prepared.length - 1) / Math.max(1, preparationCount - 1))];
      if (!value) throw new Error('The curriculum is missing a proved preparation puzzle.');
      picks.add(value);
    }
    const remaining = values.filter(value => !picks.has(value)), required = quota - preparationCount;
    for (let index = 0; index < required; index++) {
      const value = remaining[Math.floor(index * (remaining.length - 1) / Math.max(1, required - 1))];
      if (!value) throw new Error('The all-family curriculum quota is incomplete.');
      picks.add(value);
    }
  }
  selected.push(...chain.filter(value => picks.has(value)));
  if (selected.length !== band.end) throw new Error('The complete curriculum stage has the wrong number of levels.');
  const last = selected.at(-1);
  await checkpoint(bandIndex + 1, [], new Map());
  console.log(JSON.stringify({ stageComplete: bandIndex + 1, count: selected.length,
    minimum: band.minimum, pressure: last?.evaluation.route.pressure, score: last ? patchPlanningScore(last.evaluation) : null }));
}
const names = ['My sunrise', 'The borrowed bend', 'A careful little cut', 'The other end', 'Across the quiet brook',
  'The road we keep', 'A bridge worth saving', 'Not one stone spare', 'The patient crossing', 'Between two courtyards',
  'Where the paths agree', 'A turn for home', 'The far bank', 'Every piece matters', 'Beyond the first answer',
  'Two roads, one choice', 'The interwoven lane', 'Before the last crossing', 'The long way, made small', 'Everyone gets home'];
const worlds = campaignWorlds(1000);
const levels: AuthoredPuzzle[] = selected.map((value, slot) => {
  const world = worlds[Math.floor(slot / PRACTICE_WORLD_SIZE)], name = names[slot % names.length], original = previous[slot];
  if (!world || !name || !original) throw new Error('Safe presentation/progress metadata is missing.');
  const challengeTier: 1 | 2 | 3 | 4 = slot < 3 ? 1 : slot < 200 ? 2 : slot < 600 ? 3 : 4;
  return { ...value.puzzle, id: `practice-v3-${String(slot + 1).padStart(4, '0')}`,
    title: slot === 0 ? 'My sunrise' : `${name} / ${world.title}`, theme: world.theme, chapter: slot + 1,
    campaignSlot: slot, legacyId: original.id, challengeTier };
});
if (levels.length !== 1000 || new Set(selected.map(value => value.key)).size !== 1000) throw new Error('The full bank must contain 1000 functionally distinct puzzles.');
for (const [slot, puzzle] of levels.entries()) {
  const value = selected[slot], before = selected[slot - 1];
  if (!value || before && regresses(before.evaluation, value.evaluation)) throw new Error(`A global grade regresses at ${slot + 1}.`);
  const repair = validateRepair(puzzle, 'daily', puzzle.witness), journey = checkPuzzle(repair.board, puzzle).journey;
  if (!journey?.solved || journey.path.length !== value.evaluation.certificate.suppliedRoadTiles + (puzzle.journey?.length ?? 0)) {
    throw new Error(`An unused road piece invalidates the campaign: ${puzzle.id}`);
  }
}
const sha256 = createHash('sha256').update(JSON.stringify(levels)).digest('hex');
const records = selected.map((value, slot) => {
  const puzzle = levels[slot]; if (!puzzle) throw new Error('A campaign proof is missing its puzzle.');
  return { id: puzzle.id, seed: value.seed, routePairs: value.routePairs, scenario: value.scenario, evaluation: value.evaluation };
});
const audit = { count: 1000, sha256, records };
const text = `import type { AuthoredPuzzle } from './types.ts';\nimport type { PatchEvaluation } from './patchDifficulty.ts';\n\n` +
  `export const PRACTICE_CAMPAIGN: readonly AuthoredPuzzle[] = ${JSON.stringify(levels, null, 2)};\n\n` +
  `export const PRACTICE_CAMPAIGN_AUDIT: { count: number; sha256: string; records: readonly { id: string; seed: number; routePairs: number; scenario: 'direct' | 'preparation'; evaluation: PatchEvaluation }[] } = ${JSON.stringify(audit, null, 2)};\n`;
await mkdir(dirname(reportFile), { recursive: true });
await writeFile(reportFile, JSON.stringify({ status: 'Complete offline bank; integration and independent audit required before release.',
  curriculum: PRACTICE_CURRICULUM, levels, audit, examined, rejected, milliseconds: Math.round(performance.now() - started),
  distinction: 'Exact inventory/minimum certificates are proofs. The curriculum, bounded greedy resistance and structural diversity are research-informed engineering criteria, not a human-difficulty or enjoyment study.' }, null, 2) + '\n', { flag: 'wx' });
await writeFile(`${output}.tmp`, text, { flag: 'wx' }); await rename(`${output}.tmp`, output);
console.log(JSON.stringify({ complete: true, count: 1000, sha256, examined,
  frames: Object.fromEntries(['pair', 'strip', 'square', 'ell'].map(frame => [frame, selected.filter(value => value.frame === frame).length])),
  preparation: records.filter(record => record.scenario === 'preparation').length,
  milliseconds: Math.round(performance.now() - started), output }));
