import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { REASONING_AUDIT, REASONING_CAMPAIGN } from '../src/shared/reasoningCampaign.generated.ts';
import { getLegacyPuzzles } from '../src/shared/puzzles.ts';
import { probeReasoningGreedy, reasoningFingerprint, reasoningGreedyRejection, reasoningQuality, reasoningRejection } from '../src/shared/reasoningQuality.ts';
import { replayPuzzle } from '../src/shared/difficulty.ts';
import { validateRepair } from '../src/shared/rules.ts';
import { reasoningCandidate } from './reasoning-candidates.ts';
import { certifyRepairSearch } from '../src/shared/repairSearch.ts';
import { isPuzzle, isRecord, isSwap } from '../src/shared/validation.ts';
import type { AuthoredPuzzle } from '../src/shared/types.ts';
import type { ReasoningGreedyProbe, ReasoningQuality } from '../src/shared/reasoningQuality.ts';

const destination = fileURLToPath(new URL('../src/shared/reasoningRefinements.generated.ts', import.meta.url));
const auditOnly = process.argv.includes('--audit-only');
if (!auditOnly && existsSync(destination)) throw new Error('The immutable refinement bank already exists. Do not overwrite board IDs.');
const checkpoint = process.argv.find(arg => arg.startsWith('--checkpoint='))?.slice('--checkpoint='.length);
const resume = process.argv.find(arg => arg.startsWith('--resume='))?.slice('--resume='.length);
const began = performance.now(), maximumMs = 20 * 60_000;
const hash = (entries: readonly AuthoredPuzzle[]): string => createHash('sha256').update(JSON.stringify(entries)).digest('hex');
if (hash(REASONING_CAMPAIGN) !== REASONING_AUDIT.sha256) throw new Error('The original reasoning bank changed before refinement.');

const rejected: { puzzle: AuthoredPuzzle; reason: string; quality: ReasoningQuality; greedy: ReasoningGreedyProbe | null }[] = [];
for (const puzzle of REASONING_CAMPAIGN) {
  const tier = puzzle.challengeTier ?? 0;
  if (tier < 2) continue;
  const quality = reasoningQuality(puzzle), rejection = reasoningRejection(puzzle, quality, tier);
  const greedy = tier >= 3 && !rejection ? probeReasoningGreedy(puzzle) : null;
  const reason = rejection ?? (greedy ? reasoningGreedyRejection(puzzle, greedy, tier) : null);
  if (reason) rejected.push({ puzzle, reason, quality, greedy });
}
const reasons: Record<string, number> = {};
for (const entry of rejected) reasons[entry.reason] = (reasons[entry.reason] ?? 0) + 1;
console.log(JSON.stringify({ audit: true, outliers: rejected.length, reasons, milliseconds: Math.round(performance.now() - began) }));
if (auditOnly) process.exit(0);

const replaced = new Set(rejected.map(entry => entry.puzzle.id));
const retained = REASONING_CAMPAIGN.filter(puzzle => !replaced.has(puzzle.id));
const seen = new Set([...REASONING_CAMPAIGN, ...getLegacyPuzzles()].map(puzzle => reasoningFingerprint(puzzle.board)));
const finalLayouts = new Map<string, number>();
for (const puzzle of retained) {
  const key = reasoningFingerprint(replayPuzzle(puzzle, puzzle.witness));
  finalLayouts.set(key, (finalLayouts.get(key) ?? 0) + 1);
}
const entries: AuthoredPuzzle[] = [];
const audits: { id: string; replaces: string; reason: string; seed: number; trial: number; depth: number; expanded: number;
  quality: ReasoningQuality; greedy: ReasoningGreedyProbe | null }[] = [];
const cursors = new Map<string, number>(), failures: Record<string, number> = {};
let examined = 0, priorMs = 0;
if (resume) {
  const saved: unknown = JSON.parse(await readFile(resume, 'utf8'));
  if (!isRecord(saved) || !Array.isArray(saved['entries']) || !Array.isArray(saved['audits']) || !isRecord(saved['progress']) ||
      typeof saved['progress']['examined'] !== 'number' || typeof saved['progress']['seconds'] !== 'number') {
    throw new Error('The refinement checkpoint is invalid.');
  }
  examined = saved['progress']['examined'];priorMs = saved['progress']['seconds'] * 1000;
  for (const raw of saved['entries']) {
    if (!isRecord(raw) || !isPuzzle(raw)) throw new Error('A checkpoint board is invalid.');
    const witness = raw['witness'];
    if (!Array.isArray(witness) || !witness.every(isSwap)) throw new Error('A checkpoint witness is invalid.');
    const puzzle: AuthoredPuzzle = { ...raw, witness }, outlier = rejected[entries.length];
    if (!outlier || puzzle.legacyId !== outlier.puzzle.id || puzzle.campaignSlot !== outlier.puzzle.campaignSlot ||
        puzzle.id !== `reasoning-v2-${String((puzzle.campaignSlot ?? -1) + 1).padStart(4, '0')}`) {
      throw new Error('The refinement checkpoint no longer matches the ordered outliers.');
    }
    const audit: unknown = saved['audits'].find((value: unknown) => isRecord(value) && value['id'] === puzzle.id);
    if (!isRecord(audit) || typeof audit['seed'] !== 'number' || typeof audit['trial'] !== 'number') throw new Error('A checkpoint recipe is invalid.');
    const seed = audit['seed'], trial = audit['trial'], tier = puzzle.challengeTier;
    if (!tier || !Number.isSafeInteger(seed) || !Number.isSafeInteger(trial) || trial < 0 || trial > 4) throw new Error('A checkpoint recipe has invalid parameters.');
    const quality = reasoningQuality(puzzle), greedy = tier >= 3 ? probeReasoningGreedy(puzzle) : null;
    if (reasoningRejection(puzzle, quality, tier) || greedy && reasoningGreedyRejection(puzzle, greedy, tier)) {
      throw new Error('A checkpoint board fails the current quality gates.');
    }
    const proof = certifyRepairSearch(puzzle, 2500);
    if (proof.status !== 'certified') throw new Error('A checkpoint board no longer has a completed exact minimum proof.');
    const fingerprint = reasoningFingerprint(puzzle.board);
    if (seen.has(fingerprint)) throw new Error('A checkpoint board duplicates an earlier layout.');
    const final = reasoningFingerprint(replayPuzzle(puzzle, puzzle.witness));
    if ((finalLayouts.get(final) ?? 0) >= 2) throw new Error('A checkpoint board repeats too many final layouts.');
    const depth = typeof audit['depth'] === 'number' ? audit['depth'] : tier >= 4 ? 7 + seed % 2 : tier === 3 ? 5 + seed % 2 : 3 + seed % 2;
    entries.push(puzzle);audits.push({ id: puzzle.id, replaces: outlier.puzzle.id, reason: outlier.reason, seed, trial, depth,
      expanded: proof.expanded, quality, greedy });
    seen.add(fingerprint);finalLayouts.set(final, (finalLayouts.get(final) ?? 0) + 1);
    const key = `${puzzle.frame ?? 'pair'}:${tier}:${puzzle.board.length}`;
    cursors.set(key, Math.max(cursors.get(key) ?? 200_001, seed + 1));
  }
  console.log(JSON.stringify({ resumed: entries.length, target: rejected.length, checkedAgainstCurrentGates: true }));
}
for (const outlier of rejected.slice(entries.length)) {
  const original = outlier.puzzle, tier = original.challengeTier, slot = original.campaignSlot;
  if (!tier || slot === undefined) throw new Error('The refinement lost its active campaign slot.');
  const size = original.board.length;
  if (size !== 6 && size !== 8) throw new Error('Only the revised six/eight-square bank may be refined.');
  const key = `${original.frame ?? 'pair'}:${tier}:${size}`;
  let seed = cursors.get(key) ?? 200_001, accepted = false;
  while (!accepted && seed < 2_000_000) {
    if (performance.now() - began > maximumMs) throw new Error(`The refinement budget ended at ${entries.length}/${rejected.length}; no partial bank was installed.`);
    for (let trial = 0; trial < 5; trial++) {
      const depth = tier >= 4 ? 4 + seed % 3 : tier === 3 ? 4 + seed % 2 : 3 + seed % 2;
      const candidate = reasoningCandidate(seed, original.frame, tier, size, trial, depth);examined++;
      if (candidate.status === 'rejected') {
        failures[candidate.reason] = (failures[candidate.reason] ?? 0) + 1;
        if (['patch-choice-range', 'route-search-limit', 'separated-stock', 'forced-corridor', 'rock-dictated-route'].includes(candidate.reason)) break;
        continue;
      }
      const fingerprint = reasoningFingerprint(candidate.puzzle.board);
      if (seen.has(fingerprint)) { failures['duplicate'] = (failures['duplicate'] ?? 0) + 1;continue; }
      const final = reasoningFingerprint(replayPuzzle(candidate.puzzle, candidate.puzzle.witness));
      if ((finalLayouts.get(final) ?? 0) >= 2) { failures['repeated-final-layout'] = (failures['repeated-final-layout'] ?? 0) + 1;continue; }
      const id = `reasoning-v2-${String(slot + 1).padStart(4, '0')}`;
      const puzzle: AuthoredPuzzle = { ...candidate.puzzle, id, title: original.title, chapter: original.chapter,
        campaignSlot: slot, challengeTier: tier, theme: original.theme, legacyId: original.id };
      validateRepair(puzzle, 'daily', puzzle.witness);
      entries.push(puzzle);audits.push({ id, replaces: original.id, reason: outlier.reason, seed, trial, depth,
        expanded: candidate.expanded, quality: candidate.quality, greedy: tier >= 3 ? probeReasoningGreedy(puzzle) : null });
      seen.add(fingerprint);finalLayouts.set(final, (finalLayouts.get(final) ?? 0) + 1);accepted = true;break;
    }
    seed++;
  }
  cursors.set(key, seed);
  if (!accepted) throw new Error(`No certified non-corridor replacement was found for stop ${slot + 1}.`);
  if (entries.length % 10 === 0 || entries.length === rejected.length) {
    const progress = { accepted: entries.length, target: rejected.length, examined, seconds: Math.round((priorMs + performance.now() - began) / 1000) };
    console.log(JSON.stringify(progress));
    if (checkpoint) await writeFile(checkpoint, JSON.stringify({ progress, entries, audits, failures, cursors: [...cursors] }), 'utf8');
  }
}
const bySlot = new Map(entries.map(puzzle => [puzzle.campaignSlot, puzzle]));
const active = REASONING_CAMPAIGN.map(puzzle => bySlot.get(puzzle.campaignSlot) ?? puzzle);
const audit = { baseSha256: REASONING_AUDIT.sha256, sha256: hash(active), count: entries.length, reasons, examined,
  certified: audits, totalMs: Math.round(priorMs + performance.now() - began) };
await writeFile(destination, "// Generated offline by tools/refine-reasoning-campaign.ts. Do not edit board IDs.\n" +
  "import type { AuthoredPuzzle } from './types.ts';\n\n" +
  `export const REASONING_REFINEMENTS: readonly AuthoredPuzzle[] = ${JSON.stringify(entries)};\n\n` +
  `export const REFINEMENT_AUDIT = ${JSON.stringify(audit)};\n`, { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify({ complete: true, replaced: entries.length, active: active.length, sha256: audit.sha256, milliseconds: audit.totalMs }));
