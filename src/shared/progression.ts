import type { CatalogEntry } from './types.ts';

export type CampaignGate = { unlocked: true; reason: null } | { unlocked: false; reason: string };

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

export function nextCampaignPlace(catalog: readonly CatalogEntry[], completed: readonly string[]): CatalogEntry | null {
  const done = new Set(completed);
  return campaignPlaces(catalog).find((place) => !done.has(place.id)) ?? null;
}

export function campaignGates(catalog: readonly CatalogEntry[], completed: readonly string[]): Map<string, CampaignGate> {
  const entries = campaignPlaces(catalog);
  const done = new Set(completed);
  const nextIndex = entries.findIndex((place) => !done.has(place.id));
  const next = entries[nextIndex];
  const gates = new Map<string, CampaignGate>();
  for (const place of entries) {
    if (done.has(place.id) || place.id === next?.id) gates.set(place.id, { unlocked: true, reason: null });
    else {
      if (!next) throw new Error('The campaign has no next unfinished stop.');
      gates.set(place.id, { unlocked: false, reason: `Finish stop ${nextIndex + 1}: "${next.title}" to continue.` });
    }
  }
  return gates;
}

export function practiceGate(catalog: readonly CatalogEntry[], completed: readonly string[], id: string): CampaignGate {
  const gate = campaignGates(catalog, completed).get(id);
  if (!gate) throw new Error('Unknown campaign place.');
  return gate;
}
