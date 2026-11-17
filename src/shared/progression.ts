import type { CatalogEntry, Theme } from './types.ts';
import { MAX_EXCHANGES } from './rules.ts';

export type CampaignGate = { unlocked: true; reason: null } | { unlocked: false; reason: string };
export interface PracticeProgress { bests: Record<string, number>; unlockedWorlds: number }
export interface CampaignWorld {
  index: number;
  title: string;
  theme: Theme;
  start: number;
  end: number;
}

export const PRACTICE_WORLD_SIZE = 20;
const WORLD_NAMES = [
  'Mossbrook meadows', 'The riverlands', 'Amber orchards',
  'Windmill fields', 'Saltwater coves', 'The cider hills',
  'Clover commons', 'Lantern harbour', 'The old fruit groves',
  'Highland pastures', 'The far shoreline',
] as const;
const WORLD_THEMES: readonly Theme[] = ['meadow', 'coast', 'orchard'];

export function campaignWorlds(count: number): CampaignWorld[] {
  return Array.from({ length: Math.ceil(count / PRACTICE_WORLD_SIZE) }, (_, index) => {
    const theme = WORLD_THEMES[index % WORLD_THEMES.length];
    if (!theme) throw new Error('The Practice world has no landscape theme.');
    return { index, title: WORLD_NAMES[index] ?? `The farther journey ${index + 1}`, theme,
      start: index * PRACTICE_WORLD_SIZE, end: Math.min(count, (index + 1) * PRACTICE_WORLD_SIZE) };
  });
}

export function practiceStars(place: Pick<CatalogEntry, 'minimum'>, best: number | undefined, completed: boolean): number {
  if (!completed) return 0;
  if (best === undefined || place.minimum === undefined) return 1;
  if (!Number.isInteger(best) || best < place.minimum || best > MAX_EXCHANGES) throw new Error('The Practice move record is invalid.');
  return best === place.minimum ? 3 : best <= place.minimum + 2 ? 2 : 1;
}

export function worldStars(world: CampaignWorld, entries: readonly CatalogEntry[], completed: readonly string[], progress: PracticeProgress): number {
  const done = new Set(completed);
  return entries.slice(world.start, world.end).reduce((sum, place) =>
    sum + practiceStars(place, progress.bests[place.id], done.has(place.id)), 0);
}

export function worldStarRequirement(world: CampaignWorld): number {
  return Math.ceil((world.end - world.start) * 1.5);
}

export function initializePracticeProgress(catalog: readonly CatalogEntry[], completed: readonly string[]): PracticeProgress {
  const entries = campaignPlaces(catalog), done = new Set(completed);
  const firstUnfinished = entries.findIndex((place) => !done.has(place.id));
  const frontier = firstUnfinished < 0 ? Math.max(0, entries.length - 1) : firstUnfinished;
  return { bests: {}, unlockedWorlds: Math.floor(frontier / PRACTICE_WORLD_SIZE) + 1 };
}

export function advancePracticeWorlds(catalog: readonly CatalogEntry[], completed: readonly string[], progress: PracticeProgress): PracticeProgress {
  const entries = campaignPlaces(catalog), done = new Set(completed), worlds = campaignWorlds(entries.length);
  let unlocked = progress.unlockedWorlds;
  while (unlocked < worlds.length) {
    const previous = worlds[unlocked - 1];
    if (!previous || !entries.slice(previous.start, previous.end).every((place) => done.has(place.id)) ||
        worldStars(previous, entries, completed, progress) < worldStarRequirement(previous)) break;
    unlocked++;
  }
  return unlocked === progress.unlockedWorlds ? progress : { ...progress, unlockedWorlds: unlocked };
}

export function recordPracticeMoves(progress: PracticeProgress, place: Pick<CatalogEntry, 'id' | 'minimum'>, moves: number): PracticeProgress {
  if (!Number.isInteger(moves) || moves < (place.minimum ?? 1) || moves > MAX_EXCHANGES) throw new Error('A Practice result needs a valid move count.');
  const previous = progress.bests[place.id];
  if (previous !== undefined && previous <= moves) return progress;
  return { ...progress, bests: { ...progress.bests, [place.id]: moves } };
}

export function campaignPlaces(catalog: readonly CatalogEntry[]): CatalogEntry[] {
  const original = catalog.filter((place) => place.practiceAfter === undefined).sort((a, b) =>
    Number(a.size === 12) - Number(b.size === 12) ||
    (a.minimum ?? 1) - (b.minimum ?? 1) || a.chapter - b.chapter || a.id.localeCompare(b.id));
  const lessons = catalog.filter((place) => place.practiceAfter !== undefined).sort((a, b) =>
    (a.practiceAfter ?? 0) - (b.practiceAfter ?? 0) || a.chapter - b.chapter || a.id.localeCompare(b.id));
  const ordered: CatalogEntry[] = [];
  let next = 0;
  original.forEach((place, index) => {
    ordered.push(place);
    while (lessons[next] && (lessons[next]?.practiceAfter ?? Infinity) <= index + 1) {
      const lesson = lessons[next++];
      if (!lesson) throw new Error('The next frame lesson is missing.');
      ordered.push(lesson);
    }
  });
  return [...ordered, ...lessons.slice(next)];
}

export function nextCampaignPlace(catalog: readonly CatalogEntry[], completed: readonly string[], progress?: PracticeProgress): CatalogEntry | null {
  const done = new Set(completed);
  const entries = campaignPlaces(catalog), nextIndex = entries.findIndex((place) => !done.has(place.id));
  const next = entries[nextIndex];
  if (!next || !progress || Math.floor(nextIndex / PRACTICE_WORLD_SIZE) < progress.unlockedWorlds) return next ?? null;
  const previousWorld = campaignWorlds(entries.length)[progress.unlockedWorlds - 1];
  return previousWorld ? entries.slice(previousWorld.start, previousWorld.end)
    .find((place) => done.has(place.id) && practiceStars(place, progress.bests[place.id], true) < 3) ?? null : null;
}

export function campaignGates(catalog: readonly CatalogEntry[], completed: readonly string[], progress?: PracticeProgress): Map<string, CampaignGate> {
  const entries = campaignPlaces(catalog);
  const done = new Set(completed);
  const nextIndex = entries.findIndex((place) => !done.has(place.id));
  const next = entries[nextIndex];
  const gates = new Map<string, CampaignGate>();
  const worlds = campaignWorlds(entries.length);
  for (const [index, place] of entries.entries()) {
    const worldIndex = Math.floor(index / PRACTICE_WORLD_SIZE);
    if (done.has(place.id)) gates.set(place.id, { unlocked: true, reason: null });
    else if (progress && worldIndex >= progress.unlockedWorlds) {
      const previous = worlds[progress.unlockedWorlds - 1];
      if (!previous) throw new Error('The next Practice island has no star gate.');
      const earned = worldStars(previous, entries, completed, progress), required = worldStarRequirement(previous);
      gates.set(place.id, { unlocked: false, reason: earned < required ?
        `Collect ${required - earned} more ${required - earned === 1 ? 'star' : 'stars'} in ${previous.title} (${earned}/${required}), and finish its stops.` :
        `Finish every stop in ${previous.title} to open the next island.` });
    } else if (place.id === next?.id) gates.set(place.id, { unlocked: true, reason: null });
    else {
      if (!next) throw new Error('The campaign has no next unfinished stop.');
      gates.set(place.id, { unlocked: false, reason: `Finish stop ${nextIndex + 1}: "${next.title}" to continue.` });
    }
  }
  return gates;
}

export function practiceGate(catalog: readonly CatalogEntry[], completed: readonly string[], id: string, progress?: PracticeProgress): CampaignGate {
  const gate = campaignGates(catalog, completed, progress).get(id);
  if (!gate) throw new Error('Unknown campaign place.');
  return gate;
}
