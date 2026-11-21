import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getLegacyPuzzles } from '../src/shared/puzzles.ts';
import { campaignPlaces, campaignWorlds } from '../src/shared/progression.ts';
import { reasoningFingerprint } from '../src/shared/reasoningQuality.ts';
import { checkPuzzle } from '../src/shared/rules.ts';
import { replayPuzzle } from '../src/shared/difficulty.ts';
import { reasoningCandidate } from './reasoning-candidates.ts';
import type { AuthoredPuzzle, PatchFamily } from '../src/shared/types.ts';
import type { ReasoningQuality } from '../src/shared/reasoningQuality.ts';

const destination = fileURLToPath(new URL('../src/shared/reasoningCampaign.generated.ts', import.meta.url));
if (existsSync(destination)) throw new Error('The immutable reasoning bank already exists. Use a new revision rather than overwrite released IDs.');
const checkpoint = process.argv.find(arg => arg.startsWith('--checkpoint='))?.slice('--checkpoint='.length);
const began = performance.now(), maximumMs = 20 * 60_000, total = 1000;
const legacy = getLegacyPuzzles(), byId = new Map(legacy.map(puzzle => [puzzle.id, puzzle]));
const worlds = campaignWorlds(total);
const ordered = campaignPlaces(legacy.map(puzzle => ({ ...puzzle, size: puzzle.board.length })));
const introductions = new Set([...ordered.slice(0, 12).map(place => place.id), 'frame-strip-v1-1', 'frame-square-v1-1', 'frame-ell-v1-1']);
const seen = new Set(legacy.map(puzzle => reasoningFingerprint(puzzle.board)));
const finalLayouts = new Map<string, number>();
const entries: AuthoredPuzzle[] = [], audits: { id: string; seed: number; trial: number; expanded: number; quality: ReasoningQuality }[] = [];
const cursors = new Map<string, number>(), reasons: Record<string, number> = {};
const openings = ['Across', 'Beyond', 'Between', 'Around', 'Along', 'Under', 'Through', 'Past'];
const landmarks = ['the borrowed lane', 'the turning brook', 'two quiet courtyards', 'the hidden footbridge', 'the winding hedgerow',
  'the lantern walk', 'the little causeway', 'a bend in the village', 'the crossing paths', 'the old gatehouse',
  'the patchwork gardens', 'the willow steps', 'the interrupted road', 'the second crossing', 'the hillside homes',
  'the millpond bend', 'the linked courtyards', 'the far garden', 'the orchard fork', 'the careful shortcut'];
let examined = 0;
for (let slot = 0; slot < total; slot++) {
  const original = ordered[slot], preserved = original && introductions.has(original.id) ? byId.get(original.id) : undefined;
  if (preserved) { entries.push({ ...preserved, campaignSlot: slot, challengeTier: 1 });continue; }
  const tier = slot < 20 ? 1 : slot < 200 ? 2 : slot < 500 ? 3 : 4;
  const available: (PatchFamily | undefined)[] = slot < 39 ? [undefined, 'strip'] : slot < 78 ? [undefined, 'strip', 'square'] :
    slot < 200 ? ['strip', 'square', 'ell', undefined] : ['square', 'ell', 'strip'];
  const frame = available[slot % available.length];
  const size: 6 | 8 = slot >= 200 && slot % 9 === 0 ? 8 : 6;
  const key = `${frame ?? 'pair'}:${tier}:${size}`;
  let seed = cursors.get(key) ?? 1, accepted = false;
  while (!accepted && seed < 2_000_000) {
    if (performance.now() - began > maximumMs) throw new Error(`The generation budget ended at ${entries.length}/1000. No partial production bank was written.`);
    for (let trial = 0; trial < (tier >= 3 ? 5 : 2); trial++) {
      const result = reasoningCandidate(seed, frame, tier, size, trial);examined++;
      if (result.status === 'rejected') {
        reasons[result.reason] = (reasons[result.reason] ?? 0) + 1;
        if (['patch-choice-range', 'route-search-limit', 'separated-stock', 'forced-corridor'].includes(result.reason)) break;
        continue;
      }
      const fingerprint = reasoningFingerprint(result.puzzle.board);
      if (seen.has(fingerprint)) { reasons['duplicate'] = (reasons['duplicate'] ?? 0) + 1;continue; }
      const final = reasoningFingerprint(replayPuzzle(result.puzzle, result.puzzle.witness));
      if ((finalLayouts.get(final) ?? 0) >= 2) { reasons['repeated-final-layout'] = (reasons['repeated-final-layout'] ?? 0) + 1;continue; }
      const world = worlds[Math.floor(slot / 20)];if (!world) throw new Error('The reasoning bank lost a world.');
      const opening = openings[Math.floor(slot / landmarks.length) % openings.length], landmark = landmarks[slot % landmarks.length];
      if (!opening || !landmark) throw new Error('The reasoning bank lost a place name.');
      const title = `${opening} ${landmark} / ${world.title}`;
      const id = `reasoning-v1-${String(slot + 1).padStart(4, '0')}`;
      const puzzle: AuthoredPuzzle = { ...result.puzzle, id, title, chapter: slot + 1, campaignSlot: slot,
        challengeTier: tier, theme: world.theme, ...(original ? { legacyId: original.id } : {}) };
      if (!checkPuzzle(replayPuzzle(puzzle, puzzle.witness), puzzle).solved) throw new Error(`${id}: the certified witness stopped solving.`);
      entries.push(puzzle);audits.push({ id, seed, trial, expanded: result.expanded, quality: result.quality });
      seen.add(fingerprint);finalLayouts.set(final, (finalLayouts.get(final) ?? 0) + 1);accepted = true;break;
    }
    seed++;
  }
  cursors.set(key, seed);
  if (!accepted) throw new Error(`No certified non-filler puzzle was found for stop ${slot + 1}.`);
  if (entries.length % 20 === 0) {
    const progress = { accepted: entries.length, target: total, examined, seconds: Math.round((performance.now() - began) / 1000) };
    console.log(JSON.stringify(progress));
    if (checkpoint) await writeFile(checkpoint, JSON.stringify({ progress, entries, audits, reasons, cursors: [...cursors] }), 'utf8');
  }
}
const hash = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
const audit = { revision: 1, count: entries.length, preservedIntroductions: entries.length - audits.length,
  sha256: hash, examined, reasons, certified: audits, totalMs: Math.round(performance.now() - began) };
await writeFile(destination, "// Generated offline by tools/generate-reasoning-campaign.ts. Do not edit released IDs.\nimport type { AuthoredPuzzle } from './types.ts';\n\n" +
  `export const REASONING_CAMPAIGN: readonly AuthoredPuzzle[] = ${JSON.stringify(entries)};\n\n` +
  `export const REASONING_AUDIT = ${JSON.stringify(audit)};\n`, { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify({ complete: true, count: entries.length, sha256: hash, examined, milliseconds: audit.totalMs }));
