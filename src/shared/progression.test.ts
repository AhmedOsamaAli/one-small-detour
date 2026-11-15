import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog } from './puzzles.ts';
import { campaignGates, campaignPlaces, nextCampaignPlace, practiceGate } from './progression.ts';

test('the connected campaign orders 200 stops by difficulty without mutating the catalog', () => {
  const catalog = getCatalog();
  const original = catalog.map((place) => place.id);
  const ordered = campaignPlaces(catalog);
  const first = ordered[0];
  const second = ordered[1];
  const third = ordered[2];
  assert.ok(first && second && third);
  assert.equal(ordered.length, 200);
  assert.deepEqual(catalog.map((place) => place.id), original);
  assert.deepEqual(campaignPlaces([...catalog].reverse()).map((place) => place.id), ordered.map((place) => place.id));
  assert.equal(first.minimum, 1);
  assert.equal(ordered.at(-1)?.minimum, 15);
  assert.ok(ordered.every((place, index) => !index || (place.minimum ?? 1) >= (ordered[index - 1]?.minimum ?? 1)));
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
  assert.equal(completed.length, 200);
  assert.equal(nextCampaignPlace(catalog, completed), null);
  assert.ok([...campaignGates(catalog, completed).values()].every((gate) => gate.unlocked));
});
