import { advancePracticeWorlds, campaignPlaces, campaignWorlds, initializePracticeProgress } from './progression.ts';
import type { PracticeProgress } from './progression.ts';
import type { CatalogEntry } from './types.ts';
import { MAX_EXCHANGES, RuleError } from './rules.ts';
import { isRecord } from './validation.ts';

export interface PracticeState {
  completed: string[];
  practice: PracticeProgress;
}

export interface PracticeSnapshot extends PracticeState {
  generation: number;
  revision: number;
}

export interface PracticeAccount {
  owner: string;
  snapshot: PracticeSnapshot;
}

export function isPracticeState(value: unknown): value is PracticeState {
  if (!isRecord(value) || !Array.isArray(value['completed']) || value['completed'].length > 10_000 ||
      !value['completed'].every((id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 150) ||
      new Set(value['completed']).size !== value['completed'].length || !isRecord(value['practice'])) return false;
  const practice = value['practice'];
  return isRecord(practice['bests']) && Object.keys(practice['bests']).length <= 10_000 &&
    Object.entries(practice['bests']).every(([id, moves]) => id.length > 0 && id.length <= 150 &&
      typeof moves === 'number' && Number.isInteger(moves) && moves >= 1 && moves <= MAX_EXCHANGES) &&
    typeof practice['unlockedWorlds'] === 'number' && Number.isInteger(practice['unlockedWorlds']) &&
    practice['unlockedWorlds'] >= 1 && practice['unlockedWorlds'] <= 10_000;
}

export function isPracticeSnapshot(value: unknown): value is PracticeSnapshot {
  return isPracticeState(value) && isRecord(value) &&
    typeof value['generation'] === 'number' && Number.isSafeInteger(value['generation']) && value['generation'] >= 0 &&
    typeof value['revision'] === 'number' && Number.isSafeInteger(value['revision']) && value['revision'] >= 0;
}

export function isPracticeAccount(value: unknown): value is PracticeAccount {
  return isRecord(value) && typeof value['owner'] === 'string' && /^[a-f0-9]{64}$/.test(value['owner']) &&
    isPracticeSnapshot(value['snapshot']);
}

export function emptyPracticeSnapshot(generation = 0): PracticeSnapshot {
  return { generation, revision: 0, completed: [], practice: { bests: {}, unlockedWorlds: 1 } };
}

export function normalizePracticeState(catalog: readonly CatalogEntry[], state: PracticeState): PracticeState {
  const places = campaignPlaces(catalog), all = [...places, ...catalog.filter(place => place.archived)], lookup = new Map(all.map((place) => [place.id, place]));
  if (all.some(place => place.originalSlot !== undefined)) all.sort((a, b) =>
    (a.originalSlot ?? Infinity) - (b.originalSlot ?? Infinity) || (a.campaignSlot ?? Infinity) - (b.campaignSlot ?? Infinity));
  if (!isPracticeState(state) || state.completed.some((id) => !lookup.has(id)) ||
      state.practice.unlockedWorlds > Math.max(1, campaignWorlds(places.length).length)) {
    throw new RuleError('The saved Practice stops could not be read. Your current progress was not replaced.', 'practice_invalid');
  }
  const done = new Set(state.completed);
  for (const [id, moves] of Object.entries(state.practice.bests)) {
    const place = lookup.get(id);
    if (!place || !done.has(id) || moves < (place.minimum ?? 1)) {
      throw new RuleError('A Practice move record is invalid. Your current progress was not replaced.', 'practice_invalid');
    }
  }
  const bests: Record<string, number> = {};
  for (const place of all) {
    const moves = state.practice.bests[place.id];
    if (moves !== undefined) bests[place.id] = moves;
  }
  const completed = all.filter((place) => done.has(place.id)).map((place) => place.id);
  return { completed, practice: advancePracticeWorlds(catalog, completed, { bests, unlockedWorlds: state.practice.unlockedWorlds }) };
}

export function mergePracticeState(catalog: readonly CatalogEntry[], first: PracticeState, second: PracticeState): PracticeState {
  const a = normalizePracticeState(catalog, first), b = normalizePracticeState(catalog, second);
  const bests = { ...a.practice.bests };
  for (const [id, moves] of Object.entries(b.practice.bests)) bests[id] = Math.min(bests[id] ?? moves, moves);
  return normalizePracticeState(catalog, {
    completed: [...new Set([...a.completed, ...b.completed])],
    practice: { bests, unlockedWorlds: Math.max(a.practice.unlockedWorlds, b.practice.unlockedWorlds) },
  });
}

export function browserPracticeState(catalog: readonly CatalogEntry[], completed: readonly string[], practice?: PracticeProgress): PracticeState {
  const ids = new Set(catalog.map((place) => place.id));
  const clears = [...new Set(completed.filter((id) => ids.has(id)))];
  return normalizePracticeState(catalog, { completed: clears,
    practice: practice ? { ...practice, bests: Object.fromEntries(Object.entries(practice.bests).filter(([id]) => ids.has(id))) } :
      initializePracticeProgress(catalog, clears) });
}

export function projectPracticeSnapshot(catalog: readonly CatalogEntry[], snapshot: PracticeSnapshot): PracticeSnapshot {
  const known = new Set(catalog.map(place => place.id));
  const completed = snapshot.completed.filter(id => known.has(id));
  const bests = Object.fromEntries(Object.entries(snapshot.practice.bests).filter(([id]) => known.has(id)));
  const unlockedWorlds = Math.min(snapshot.practice.unlockedWorlds, Math.max(1, campaignWorlds(campaignPlaces(catalog).length).length));
  return { ...normalizePracticeState(catalog, { completed, practice: { bests, unlockedWorlds } }),
    generation: snapshot.generation, revision: snapshot.revision };
}
