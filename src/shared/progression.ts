import type { CatalogEntry, Theme } from './types.ts';
import { MAX_EXCHANGES } from './rules.ts';

export type CampaignGate = { unlocked: true; reason: null } | { unlocked: false; reason: string };
export interface PracticeProgress { bests: Record<string, number>; unlockedWorlds: number }
export interface CampaignAchievement {
  completed: boolean;
  solved: boolean;
  credited: boolean;
  stars: number;
  legacyStars: number;
}
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
  'Frostpine valley', 'Meadow gardens', 'Crimson maple hills',
  'Golden ginkgo walk', 'Lavender country', 'Windmill fields',
  'Saltwater coves', 'The cider hills',
  'Snowbell harbour', 'Cloverfield gardens', 'Emberleaf ridge', 'Golden fan terraces',
  'Rosewater gardens', 'Fernlight fields', 'Pearlwater inlets', 'Honeyapple orchards', 'Moonfrost pines',
  'Willowmere green', 'Copperleaf crossing', 'Saffron steps', 'Petalbrook terraces',
  'Dewdrop downs', 'Tideglass isles', 'Ciderpress lanes', 'Silverpine reach',
  'Mosslight garden', 'Cinnamonleaf valley', 'Lantern-gold walk', 'Rosequartz lanes',
  'Brambleton common', 'Foamcrest coast', 'Harvestbell hill', 'Quiet snowfield',
  'Sunbeam meadow', 'Amberleaf plateau', 'Golden feather grove', 'Blushwater gardens',
  'Heatherbrook green', 'Driftwood coves', 'Appleblossom lane', 'Starlit frostpines',
  'Cloverglen park', 'Falling ember woods', 'Gilded fan valley', 'Rose mist terraces',
  'The homeward meadows', 'The farther harbour',
] as const;
// Keep world slots stable when a landscape is replaced.
const WORLD_THEMES: readonly Theme[] = ['meadow', 'coast', 'orchard', 'winter', 'meadow', 'maple', 'ginkgo', 'lavender'];

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
  const places = campaignPlaces(entries), earned = campaignAchievements(entries, completed, progress);
  return places.slice(world.start, world.end).reduce((sum, place) => sum + (earned.get(place.id)?.stars ?? 0), 0);
}

function originalRoads(place: CatalogEntry, lookup: ReadonlyMap<string, CatalogEntry>): CatalogEntry[] {
  const originals: CatalogEntry[] = [], seen = new Set([place.id]);
  let id = place.legacyId;
  while (id) {
    if (seen.has(id)) throw new Error('The revised campaign has a circular original-road reference.');
    const original = lookup.get(id);
    if (!original) throw new Error('The revised campaign is missing its original route metadata.');
    originals.push(original);seen.add(id);id = original.legacyId;
  }
  return originals;
}

export function completedOriginalRoad(catalog: readonly CatalogEntry[], completed: readonly string[], id: string): string | null {
  const lookup = new Map(catalog.map(place => [place.id, place])), place = lookup.get(id);
  if (!place) throw new Error('The revised campaign has no such road.');
  const done = new Set(completed);
  return originalRoads(place, lookup).find(original => done.has(original.id))?.id ?? null;
}

export function campaignAchievements(catalog: readonly CatalogEntry[], completed: readonly string[], progress: PracticeProgress): Map<string, CampaignAchievement> {
  const done = new Set(completed), lookup = new Map(catalog.map(place => [place.id, place]));
  return new Map(campaignPlaces(catalog).map(place => {
    const solved = done.has(place.id), originals = originalRoads(place, lookup).filter(original => done.has(original.id));
    const credited = originals.length > 0;
    const legacyStars = originals.reduce((stars, original) => Math.max(stars, practiceStars(original, progress.bests[original.id], true)), 0);
    const stars = Math.max(practiceStars(place, progress.bests[place.id], solved), legacyStars);
    return [place.id, { completed: solved || credited, solved, credited, stars, legacyStars }];
  }));
}

export function worldStarRequirement(world: CampaignWorld): number {
  return Math.ceil((world.end - world.start) * 2.25);
}

export function initializePracticeProgress(catalog: readonly CatalogEntry[], completed: readonly string[]): PracticeProgress {
  const entries = campaignPlaces(catalog), earned = campaignAchievements(catalog, completed, { bests: {}, unlockedWorlds: 1 });
  const firstUnfinished = entries.findIndex((place) => !earned.get(place.id)?.completed);
  const frontier = firstUnfinished < 0 ? Math.max(0, entries.length - 1) : firstUnfinished;
  return { bests: {}, unlockedWorlds: Math.floor(frontier / PRACTICE_WORLD_SIZE) + 1 };
}

export function advancePracticeWorlds(catalog: readonly CatalogEntry[], completed: readonly string[], progress: PracticeProgress): PracticeProgress {
  const entries = campaignPlaces(catalog), earned = campaignAchievements(catalog, completed, progress), worlds = campaignWorlds(entries.length);
  let unlocked = progress.unlockedWorlds;
  while (unlocked < worlds.length) {
    const previous = worlds[unlocked - 1];
    if (!previous || !entries.slice(previous.start, previous.end).every((place) => earned.get(place.id)?.completed) ||
        entries.slice(previous.start, previous.end).reduce((sum, place) => sum + (earned.get(place.id)?.stars ?? 0), 0) < worldStarRequirement(previous)) break;
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
  if (catalog.some(place => place.campaignSlot !== undefined)) {
    const active = catalog.filter(place => !place.archived).sort((a, b) => (a.campaignSlot ?? Infinity) - (b.campaignSlot ?? Infinity));
    if (active.some((place, index) => place.campaignSlot !== index)) throw new Error('The revised campaign has a missing or repeated stop slot.');
    return active;
  }
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
  const earned = campaignAchievements(catalog, completed, progress ?? { bests: {}, unlockedWorlds: 1 });
  const entries = campaignPlaces(catalog), nextIndex = entries.findIndex((place) => !earned.get(place.id)?.completed);
  const next = entries[nextIndex];
  if (!next || !progress || Math.floor(nextIndex / PRACTICE_WORLD_SIZE) < progress.unlockedWorlds) return next ?? null;
  const previousWorld = campaignWorlds(entries.length)[progress.unlockedWorlds - 1];
  return previousWorld ? entries.slice(previousWorld.start, previousWorld.end)
    .find((place) => earned.get(place.id)?.completed && (earned.get(place.id)?.stars ?? 0) < 3) ?? null : null;
}

export function campaignGates(catalog: readonly CatalogEntry[], completed: readonly string[], progress?: PracticeProgress): Map<string, CampaignGate> {
  const entries = campaignPlaces(catalog);
  const earned = campaignAchievements(catalog, completed, progress ?? { bests: {}, unlockedWorlds: 1 });
  const nextIndex = entries.findIndex((place) => !earned.get(place.id)?.completed);
  const next = entries[nextIndex];
  const gates = new Map<string, CampaignGate>();
  const worlds = campaignWorlds(entries.length);
  const totals = worlds.map(world => entries.slice(world.start, world.end).reduce((sum, place) => sum + (earned.get(place.id)?.stars ?? 0), 0));
  for (const [index, place] of entries.entries()) {
    const worldIndex = Math.floor(index / PRACTICE_WORLD_SIZE);
    if (earned.get(place.id)?.completed) gates.set(place.id, { unlocked: true, reason: null });
    else if (progress && worldIndex >= progress.unlockedWorlds) {
      const previous = worlds[progress.unlockedWorlds - 1];
      if (!previous) throw new Error('The next Practice island has no star gate.');
      const stars = totals[previous.index] ?? 0, required = worldStarRequirement(previous);
      gates.set(place.id, { unlocked: false, reason: stars < required ?
        `Collect ${required - stars} more ${required - stars === 1 ? 'star' : 'stars'} in ${previous.title} (${stars}/${required}), and finish its stops.` :
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
  const original = catalog.find(place => place.id === id && place.archived);
  if (original) return completed.includes(id) ? { unlocked: true, reason: null } :
    { unlocked: false, reason: 'Original routes are kept for your previously completed stops.' };
  const gate = campaignGates(catalog, completed, progress).get(id);
  if (!gate) throw new Error('Unknown campaign place.');
  return gate;
}
