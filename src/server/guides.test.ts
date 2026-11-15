import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameApi } from './service.ts';
import { MemoryGuideStore } from './guides.ts';
import { MemoryAttemptStore } from './attempts.ts';
import type { ScoreStore } from './service.ts';
import type { ScoreRecord } from '../shared/types.ts';
import { isBootstrap } from '../shared/validation.ts';

class Scores implements ScoreStore {
  readonly data = new Map<string, ScoreRecord[]>();
  async list(key: string): Promise<ScoreRecord[]> { return this.data.get(key) ?? []; }
  async put(key: string, record: ScoreRecord): Promise<void> {
    this.data.set(key, [...(this.data.get(key) ?? []), record]);
  }
  async erase(userId: string): Promise<void> {
    for (const [key, values] of this.data) this.data.set(key, values.filter((record) => record.userId !== userId));
  }
}

function fixture() {
  const guides = new MemoryGuideStore();
  const app = createGameApi({
    guides, store: new Scores(), attempts: new MemoryAttemptStore(),
    source: 'local', community: () => 'Test',
    player: async (request) => {
      const id = request.headers.get('x-player');
      return id ? { id, name: id } : null;
    },
    now: () => new Date('2026-11-14T12:00:00Z'),
  });
  return { app, guides };
}

test('guide choices belong to authenticated identity, survive a fresh bootstrap, and never create ranked participants', async () => {
  const { app, guides } = fixture();
  const response = await app.request('/api/me/guides', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-player': 'owner' },
    body: JSON.stringify({ topics: ['basics', 'rocks'], userId: 'someone-else' }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await guides.seen('owner'), ['basics', 'rocks']);
  assert.deepEqual(await guides.seen('someone-else'), []);
  const data: unknown = await (await app.request('/api/bootstrap', { headers: { 'x-player': 'owner' } })).json();
  assert.ok(isBootstrap(data));
  assert.deepEqual(data.seenGuides, ['basics', 'rocks']);
  const board = await (await app.request('/api/leaderboard?edition=2026-11-14&mode=daily')).json();
  assert.equal(board.players, 0);
  assert.equal(board.yourBest, null);
});

test('guide updates merge without losing other topics or another player choices', async () => {
  const { guides } = fixture();
  await Promise.all([
    guides.markSeen('owner', ['basics']), guides.markSeen('owner', ['bridges']),
    guides.markSeen('other', ['rocks']),
  ]);
  assert.deepEqual(await guides.seen('owner'), ['basics', 'bridges']);
  await guides.erase('owner');
  assert.deepEqual(await guides.seen('owner'), []);
  assert.deepEqual(await guides.seen('other'), ['rocks']);
});

test('anonymous and invalid guide requests fail explicitly without remembering arbitrary data', async () => {
  const { app, guides } = fixture();
  const anonymous = await app.request('/api/me/guides', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topics: ['basics'] }),
  });
  assert.equal(anonymous.status, 401);
  for (const topics of [[], ['basics', 'basics'], ['unknown'], [1]]) {
    const response = await app.request('/api/me/guides', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-player': 'owner' },
      body: JSON.stringify({ topics }),
    });
    assert.equal(response.status, 400);
  }
  assert.deepEqual(await guides.seen('owner'), []);
  const anonymousBootstrap = await (await app.request('/api/bootstrap')).json();
  assert.deepEqual(anonymousBootstrap.seenGuides, []);
});

test('removing player data also forgets the synced walkthrough without affecting others', async () => {
  const { app, guides } = fixture();
  await guides.markSeen('owner', ['basics', 'rocks', 'bridges']);
  await guides.markSeen('other', ['basics']);
  const response = await app.request('/api/me', { method: 'DELETE', headers: { 'x-player': 'owner' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await guides.seen('owner'), []);
  assert.deepEqual(await guides.seen('other'), ['basics']);
});
