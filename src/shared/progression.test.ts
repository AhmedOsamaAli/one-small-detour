import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog } from './puzzles.ts';
import { advancePracticeWorlds, campaignGates, campaignPlaces, campaignWorlds, initializePracticeProgress, nextCampaignPlace, practiceGate, practiceStars, recordPracticeMoves, worldStarRequirement, worldStars } from './progression.ts';

test('shape lessons enter gradually while original islands retain their relative order', () => {
  const catalog = getCatalog();
  const original = catalog.map((place) => place.id);
  const ordered = campaignPlaces(catalog);
  const first = ordered[0];
  const second = ordered[1];
  const third = ordered[2];
  assert.ok(first && second && third);
  assert.equal(ordered.length, 218);
  assert.deepEqual(catalog.map((place) => place.id), original);
  assert.deepEqual(campaignPlaces([...catalog].reverse()).map((place) => place.id), ordered.map((place) => place.id));
  assert.equal(first.minimum, 1);
  assert.equal(ordered[211]?.minimum, 15);
  const legacy = ordered.filter((place) => place.practiceAfter === undefined);
  assert.deepEqual(legacy.map((place) => place.id),
    campaignPlaces(catalog.filter((place) => place.practiceAfter === undefined)).map((place) => place.id));
  assert.ok(legacy.every((place, index) => !index || index === 200 ||
    (place.minimum ?? 1) >= (legacy[index - 1]?.minimum ?? 1)));
  assert.deepEqual(ordered.slice(209, 212).map((place) => place.size), [12, 12, 12]);
  assert.ok(ordered.slice(0, 12).every((place) => place.frame === undefined));
  assert.deepEqual(ordered.slice(12, 15).map((place) => place.frame), ['strip', 'strip', 'strip']);
  assert.deepEqual(ordered.slice(39, 42).map((place) => place.frame), ['square', 'square', 'square']);
  assert.deepEqual(ordered.slice(78, 81).map((place) => place.frame), ['ell', 'ell', 'ell']);
  assert.equal(practiceGate(catalog, [], first.id).unlocked, true);
  assert.equal(practiceGate(catalog, [], second.id).unlocked, false);
  assert.equal(practiceGate(catalog, [first.id], second.id).unlocked, true);
  assert.equal(practiceGate(catalog, [first.id], third.id).unlocked, false);
  assert.equal(nextCampaignPlace(catalog, [])?.id, first.id);
});

test('old discoveries remain replayable but cannot bypass unfinished earlier stops', () => {
  const catalog = getCatalog();
  const ordered = campaignPlaces(catalog);
  const first = ordered[0];
  const second = ordered[1];
  const third = ordered[2];
  const oldDiscovery = ordered.at(-1);
  assert.ok(first && second && third && oldDiscovery);
  const completed = [second.id, oldDiscovery.id, 'daily-v4-2026-11-14'];
  assert.equal(practiceGate(catalog, [oldDiscovery.id], oldDiscovery.id).unlocked, true);
  assert.equal(practiceGate(catalog, completed, third.id).unlocked, false);
  assert.equal(nextCampaignPlace(catalog, completed)?.id, first.id);
  assert.match(practiceGate(catalog, completed, third.id).reason ?? '', /Finish stop 1/);
  assert.throws(() => practiceGate(catalog, [], 'not-a-place'));
});

test('replacing Sakura with meadow keeps every later world and saved stop in its existing slot', () => {
  const catalog = getCatalog(), entries = campaignPlaces(catalog), worlds = campaignWorlds(entries.length);
  assert.deepEqual(worlds.map(world => world.theme),
    ['meadow', 'coast', 'orchard', 'winter', 'meadow', 'maple', 'ginkgo', 'lavender', 'meadow', 'coast', 'orchard']);
  const garden = worlds[4];
  assert.ok(garden);
  assert.equal(garden.title, 'Meadow gardens');
  assert.deepEqual([garden.start, garden.end], [80, 100]);
  const completed = entries.slice(0, garden.end).map(place => place.id);
  const progress = initializePracticeProgress(catalog, completed);
  assert.equal(progress.unlockedWorlds, 6);
  assert.equal(nextCampaignPlace(catalog, completed, progress)?.id, entries[100]?.id);
  for (const place of entries.slice(garden.start, garden.end)) assert.equal(practiceGate(catalog, completed, place.id, progress).unlocked, true);
});

test('every stop unlocks in order and the completed campaign remains fully replayable', () => {
  const catalog = getCatalog();
  const ordered = campaignPlaces(catalog);
  const completed: string[] = [];
  for (const place of ordered) {
    const gates = campaignGates(catalog, completed);
    const available = ordered.filter((entry) => !completed.includes(entry.id) && gates.get(entry.id)?.unlocked);
    assert.deepEqual(available.map((entry) => entry.id), [place.id]);
    completed.push(place.id);
  }
  assert.equal(completed.length, 218);
  assert.equal(nextCampaignPlace(catalog, completed), null);
  assert.ok([...campaignGates(catalog, completed).values()].every((gate) => gate.unlocked));
});

test('Practice stars depend only on a completed move record and worse replays cannot replace a better one', () => {
  const place = { id: 'a-practice-place', minimum: 3 };
  assert.equal(practiceStars(place, 3, false), 0);
  assert.equal(practiceStars(place, undefined, true), 1);
  assert.equal(practiceStars(place, 3, true), 3);
  assert.equal(practiceStars(place, 4, true), 2);
  assert.equal(practiceStars(place, 5, true), 2);
  assert.equal(practiceStars(place, 6, true), 1);
  const initial = { bests: {}, unlockedWorlds: 1 };
  const first = recordPracticeMoves(initial, place, 5);
  const best = recordPracticeMoves(first, place, 3);
  assert.equal(recordPracticeMoves(best, place, 6), best);
  assert.equal(best.bests[place.id], 3);
  assert.deepEqual(initial.bests, {});
  assert.throws(() => recordPracticeMoves(best, place, 2), /valid move count/);
});

test('new worlds require completed stops and 30 of 60 stars, then stay unlocked through later replays', () => {
  const catalog = getCatalog(), entries = campaignPlaces(catalog), worlds = campaignWorlds(entries.length);
  const world = worlds[0], next = entries[20];
  assert.ok(world && next);
  assert.equal(worldStarRequirement(world), 30);
  let progress = initializePracticeProgress(catalog, []);
  const completed = entries.slice(0, 20).map((place) => place.id);
  assert.equal(worldStars(world, entries, completed, progress), 20);
  assert.equal(practiceGate(catalog, completed, next.id, progress).unlocked, false);
  assert.match(practiceGate(catalog, completed, next.id, progress).reason ?? '', /10 more stars/);
  assert.equal(nextCampaignPlace(catalog, completed, progress)?.id, entries[0]?.id);
  for (const place of entries.slice(0, 5)) progress = recordPracticeMoves(progress, place, place.minimum ?? 1);
  assert.equal(worldStars(world, entries, completed, progress), 30);
  assert.equal(advancePracticeWorlds(catalog, completed.slice(0, -1), progress).unlockedWorlds, 1);
  progress = advancePracticeWorlds(catalog, completed, progress);
  assert.equal(progress.unlockedWorlds, 2);
  assert.equal(practiceGate(catalog, completed, next.id, progress).unlocked, true);
  assert.equal(nextCampaignPlace(catalog, completed, progress)?.id, next.id);
  assert.equal(advancePracticeWorlds(catalog, [], progress).unlockedWorlds, 2);
});

test('legacy discoveries keep their completion stars and their already reachable world, without inventing perfect move counts', () => {
  const catalog = getCatalog(), entries = campaignPlaces(catalog);
  const completed = [...entries.slice(0, 40).map((place) => place.id), entries.at(-1)?.id ?? '', 'daily-v4-2026-11-16'];
  const progress = initializePracticeProgress(catalog, completed), next = entries[40], last = entries.at(-1);
  assert.ok(next && last);
  assert.deepEqual(progress.bests, {});
  assert.equal(progress.unlockedWorlds, 3);
  assert.equal(practiceGate(catalog, completed, next.id, progress).unlocked, true);
  assert.equal(practiceGate(catalog, completed, last.id, progress).unlocked, true);
  const firstWorld = campaignWorlds(entries.length)[0];
  assert.ok(firstWorld);
  assert.equal(worldStars(firstWorld, entries, completed, progress), 20);
  assert.equal(nextCampaignPlace(catalog, completed, progress)?.id, next.id);
  assert.equal(campaignWorlds(entries.length).length, 11);
  assert.equal(campaignWorlds(entries.length).at(-1)?.end, entries.length);
});
