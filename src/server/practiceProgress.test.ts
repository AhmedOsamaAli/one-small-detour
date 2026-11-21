import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog } from '../shared/puzzles.ts';
import { campaignAchievements, campaignPlaces } from '../shared/progression.ts';
import { browserPracticeState, emptyPracticeSnapshot, isPracticeAccount } from '../shared/practiceProgress.ts';
import { MemoryPracticeStore, RedisPracticeStore } from './practiceProgress.ts';
import { RankingFixture } from './rankingFixture.ts';
import { createGameApi } from './service.ts';
import { MemoryAttemptStore } from './attempts.ts';
import { MemoryGuideStore } from './guides.ts';
import { isBootstrap } from '../shared/validation.ts';

const catalog = getCatalog(), places = campaignPlaces(catalog);
const first = places[0], second = places[1];
assert.ok(first && second);

for (const kind of ['memory', 'redis'] as const) {
  const create = () => kind === 'memory' ? new MemoryPracticeStore() : new RedisPracticeStore(new RankingFixture());
  test(`${kind}: independent devices merge clears and retain their better move records and opened islands`, async () => {
    const store = create();
    const a = browserPracticeState(catalog, [first.id], { bests: { [first.id]: (first.minimum ?? 1) + 4 }, unlockedWorlds: 2 });
    const b = browserPracticeState(catalog, [first.id, second.id], { bests: {
      [first.id]: first.minimum ?? 1, [second.id]: second.minimum ?? 1,
    }, unlockedWorlds: 1 });
    await Promise.all([store.merge('owner', 0, a), store.merge('owner', 0, b)]);
    const saved = await store.read('owner');
    assert.deepEqual(saved.completed, [first.id, second.id]);
    assert.equal(saved.practice.bests[first.id], first.minimum);
    assert.equal(saved.practice.unlockedWorlds, 2);
    const retry = await store.merge('owner', 0, a);
    assert.deepEqual(retry, saved);
    assert.deepEqual(await store.read('another-player'), emptyPracticeSnapshot());
  });

  test(`${kind}: legacy clears can sync without inventing exact moves or relocking previously reached worlds`, async () => {
    const store = create(), completed = places.slice(0, 40).map((place) => place.id);
    const saved = await store.merge('owner', 0, browserPracticeState(catalog, completed));
    assert.deepEqual(saved.completed, completed);
    assert.deepEqual(saved.practice.bests, {});
    assert.equal(saved.practice.unlockedWorlds, 3);
    assert.deepEqual((await store.merge('owner', 0, browserPracticeState(catalog, []))).completed, completed);
  });

  test(`${kind}: explicit Practice removal fences stale device writes without touching another player's progress`, async () => {
    const store = create(), progress = browserPracticeState(catalog, [first.id]);
    await store.merge('owner', 0, progress);
    await store.merge('peer', 0, progress);
    const cleared = await store.erase('owner');
    assert.equal(cleared.generation, 1);
    assert.deepEqual(cleared.completed, []);
    await assert.rejects(store.merge('owner', 0, progress), /cleared on another device/);
    assert.deepEqual((await store.read('owner')).completed, []);
    assert.deepEqual((await store.read('peer')).completed, [first.id]);
    assert.deepEqual((await store.merge('owner', 1, progress)).completed, [first.id]);
  });

  test(`${kind}: invalid stop IDs, impossible move records and inflated island counts fail without overwriting progress`, async () => {
    const store = create(), initial = await store.merge('owner', 0, browserPracticeState(catalog, [first.id]));
    await assert.rejects(store.merge('owner', 0, { completed: ['invented'], practice: { bests: {}, unlockedWorlds: 1 } }), /could not be read/);
    await assert.rejects(store.merge('owner', 0, { completed: [first.id], practice: { bests: { [first.id]: 0 }, unlockedWorlds: 1 } }), /could not be read/);
    await assert.rejects(store.merge('owner', 0, { completed: [], practice: { bests: {}, unlockedWorlds: 9999 } }), /could not be read/);
    assert.deepEqual(await store.read('owner'), initial);
  });
}

test('a Redis reset during a simultaneous Practice save cannot resurrect the removed stops', async () => {
  const fixture = new RankingFixture(), store = new RedisPracticeStore(fixture);
  fixture.beforeExec = () => {
    fixture.beforeExec = null;
    fixture.rawSet('detour:practice-progress:1:owner', JSON.stringify(emptyPracticeSnapshot(1)));
  };
  await assert.rejects(store.merge('owner', 0, browserPracticeState(catalog, [first.id])), /cleared on another device/);
  assert.deepEqual((await store.read('owner')).completed, []);
});

test('Practice endpoints use authenticated identity, reject malformed input, and keep score deletion separate', async () => {
  const practice = new MemoryPracticeStore();
  const app = createGameApi({
    source: 'local', community: () => 'Test', practice,
    store: { list: async () => [], put: async () => undefined, erase: async () => undefined },
    guides: new MemoryGuideStore(), attempts: new MemoryAttemptStore(),
    player: async (request) => request.headers.get('x-player') ? { id: request.headers.get('x-player') ?? '', name: 'Owner' } : null,
    now: () => new Date('2026-11-17T12:00:00Z'),
  });

  assert.equal((await app.request('/api/me/progress')).status, 401);
  const send = (method: string, value?: unknown) => app.request('/api/me/progress', {
    method, headers: { 'Content-Type': 'application/json', 'x-player': 'owner' }, ...(value ? { body: JSON.stringify(value) } : {}),
  });
  const initial: unknown = await (await send('GET')).json();
  assert.ok(isPracticeAccount(initial));
  assert.equal(initial.snapshot.revision, 0);
  const progress = browserPracticeState(catalog, [first.id]);
  assert.equal((await send('POST', { generation: 0, ...progress, userId: 'impostor' })).status, 200);
  assert.deepEqual((await practice.read('owner')).completed, [first.id]);
  assert.deepEqual((await practice.read('impostor')).completed, []);
  await app.request('/api/me', { method: 'DELETE', headers: { 'x-player': 'owner' } });
  assert.deepEqual((await practice.read('owner')).completed, [first.id]);
  assert.equal((await send('DELETE')).status, 200);
  assert.equal((await send('POST', { generation: 0, ...progress })).status, 409);
  assert.equal((await send('POST', { generation: 1, completed: ['fake'], practice: { bests: {}, unlockedWorlds: 1 } })).status, 400);
});

test('campaign negotiation preserves old clients, original records and reset fences without exposing private certificates', async () => {
    const practice = new MemoryPracticeStore();
    const app = createGameApi({
      source: 'local', community: () => 'Revision test', practice,
      store: { list: async () => [], put: async () => undefined, erase: async () => undefined },
      guides: new MemoryGuideStore(), attempts: new MemoryAttemptStore(),
      player: async () => ({ id: 'owner', name: 'Owner' }), now: () => new Date('2026-11-18T12:00:00Z'),
    });
    const oldBoot: unknown = await (await app.request('/api/bootstrap')).json();
    const response = await app.request('/api/bootstrap?campaign=2'), text = await response.text();
    const newBoot: unknown = JSON.parse(text);
    assert.ok(isBootstrap(oldBoot) && isBootstrap(newBoot));
    assert.equal(oldBoot.catalog.length, 218);assert.equal(campaignPlaces(newBoot.catalog).length, 1000);
    assert.equal(newBoot.campaignRevision, 2);
    assert.equal(text.includes('"witness"'), false);assert.equal(text.includes('"certified"'), false);
    assert.equal((await app.request('/api/bootstrap?campaign=999')).status, 400);
    const previous = campaignPlaces(oldBoot.catalog).slice(0, 43);
    const oldProgress = browserPracticeState(oldBoot.catalog, previous.map(place => place.id), {
      bests: Object.fromEntries(previous.map(place => [place.id, place.minimum ?? 1])), unlockedWorlds: 3,
    });
    const send = (version: 1 | 2, method: string, value?: unknown) => app.request(`/api/me/progress?campaign=${version}`, {
      method, headers: { 'Content-Type': 'application/json' }, ...(value ? { body: JSON.stringify(value) } : {}),
    });
    assert.equal((await send(1, 'POST', { generation: 0, ...oldProgress })).status, 200);
    const modern: unknown = await (await send(2, 'GET')).json();assert.ok(isPracticeAccount(modern));
    const active = campaignPlaces(newBoot.catalog), earned = campaignAchievements(newBoot.catalog, modern.snapshot.completed, modern.snapshot.practice);
    assert.ok(active.slice(0, 43).every(place => earned.get(place.id)?.completed && earned.get(place.id)?.stars === 3));
    const replacement = active.find(place => place.legacyId && oldProgress.completed.includes(place.legacyId));assert.ok(replacement?.minimum);
    assert.equal((await app.request(`/api/places/${replacement.id}`)).status, 404);
    const puzzle = await app.request(`/api/places/${replacement.id}?campaign=2`);
    assert.equal(puzzle.status, 200);assert.equal((await puzzle.text()).includes('"witness"'), false);
    const changed = browserPracticeState(newBoot.catalog, [...oldProgress.completed, replacement.id], {
      bests: { ...oldProgress.practice.bests, [replacement.id]: replacement.minimum + 1 }, unlockedWorlds: 3,
    });
    assert.equal((await send(2, 'POST', { generation: 0, ...changed })).status, 200);
    const legacyView: unknown = await (await send(1, 'GET')).json();assert.ok(isPracticeAccount(legacyView));
    assert.equal(legacyView.snapshot.completed.includes(replacement.id), false);
    assert.equal(Object.hasOwn(legacyView.snapshot.practice.bests, replacement.id), false);
    assert.equal((await send(1, 'POST', { generation: 0, ...oldProgress })).status, 200);
    assert.equal((await practice.read('owner')).practice.bests[replacement.id], replacement.minimum + 1);
    assert.equal((await send(1, 'DELETE')).status, 200);
    assert.equal((await send(2, 'POST', { generation: 0, ...changed })).status, 409);
    assert.deepEqual((await practice.read('owner')).completed, []);
});
