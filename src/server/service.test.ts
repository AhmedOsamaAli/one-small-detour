import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameApi, rankScores, scoreKey } from './service.ts';
import type { ScoreStore } from './service.ts';
import { MemoryAttemptStore } from './attempts.ts';
import { MemoryGuideStore } from './guides.ts';
import type { ScoreRecord, Swap } from '../shared/types.ts';
import { AUTHORED, dailyPuzzleForDate } from '../shared/puzzles.ts';

class MemoryScores implements ScoreStore {
  data = new Map<string, ScoreRecord[]>();
  async list(key: string): Promise<ScoreRecord[]> { return this.data.get(key) ?? []; }
  async put(key: string, record: ScoreRecord): Promise<void> { this.data.set(key, [...(this.data.get(key) ?? []), record]); }
  async erase(id: string): Promise<void> {
    for (const [key, values] of this.data) this.data.set(key, values.filter((value) => value.userId !== id));
  }
}

const record = (userId: string, footprint: number, swaps: number): ScoreRecord => ({
  userId, name: userId, footprint, swaps, solveMs: 1000, submittedAt: '2026-11-12T12:00:00Z',
});

test('ranking uses genuine personal best, then footprint, exchanges and shared ties', () => {
  const result = rankScores([record('a', 8, 1), record('a', 6, 2), record('b', 6, 2), record('c', 6, 3), record('d', 8, 1)], 'a', 'local', 'gentle');
  assert.equal(result.players, 4);
  assert.deepEqual(result.entries.map((entry) => [entry.userId, entry.rank]), [['a', 1], ['b', 1], ['c', 3], ['d', 4]]);
  assert.equal(result.yourBest?.footprint, 6);
  assert.equal(rankScores([], null, 'local').players, 0);
});

test('daily ranking prioritizes fewest exchanges while footprint mode remains separate', () => {
  const records = [record('a', 8, 1), record('a', 6, 2), record('b', 6, 2), record('d', 8, 1)];
  const daily = rankScores(records, 'a', 'local', 'daily');
  const gentle = rankScores(records, 'a', 'local', 'gentle');
  assert.deepEqual(daily.entries.map((entry) => [entry.userId, entry.rank]), [['a', 1], ['d', 1], ['b', 3]]);
  assert.equal(daily.yourBest?.swaps, 1);
  assert.equal(daily.yourBest?.footprint, 8);
  assert.equal(gentle.yourBest?.swaps, 2);
  assert.equal(daily.mode, 'daily');
  assert.equal(gentle.mode, 'gentle');
});

test('API does not seed a leaderboard or expose winning moves', async () => {
  const app = createGameApi({
    attempts: new MemoryAttemptStore(), guides: new MemoryGuideStore(),
    store: new MemoryScores(), source: 'local', community: () => 'Test',
    player: async () => ({ id: 'real-player', name: 'You' }), now: () => new Date('2026-11-12T12:00:00Z'),
  });
  const response = await app.request('/api/bootstrap');
  assert.equal(response.status, 200);
  const body: unknown = await response.json();
  assert.equal(JSON.stringify(body).includes('witness'), false);
  const scores = await app.request('/api/leaderboard?edition=2026-11-12&mode=gentle');
  const text = await scores.text();
  assert.ok(text.includes('"players":0'));
  assert.ok(text.includes('"entries":[]'));
});

test('personal-rank endpoint returns only the current player rank, not leaderboard tickets or identities', async () => {
  const store = new MemoryScores();
  const date = '2026-11-12';
  const key = scoreKey(date, 'daily');
  await store.put(key, record('another-player', 4, 1));
  await store.put(key, record('owner', 8, 2));
  const app = createGameApi({
    attempts: new MemoryAttemptStore(), guides: new MemoryGuideStore(),
    store, source: 'local', community: () => 'Test',
    player: async (request) => request.headers.get('x-owner') ? { id: 'owner', name: 'Owner' } : null,
    now: () => new Date(`${date}T12:00:00Z`),
  });
  const response = await app.request(`/api/my-rank?edition=${date}`, { headers: { 'x-owner': 'yes' } });
  assert.deepEqual(await response.json(), { edition: date, rank: 2, swaps: 2, solveMs: 1000, participants: 2, topPercent: 100, source: 'local' });
  const anonymous = await app.request(`/api/my-rank?edition=${date}`);
  assert.deepEqual(await anonymous.json(), { edition: date, rank: null, swaps: null, solveMs: null, participants: 2, topPercent: null, source: 'local' });
});

test('server recomputes scores and identity rather than trusting submitted totals', async () => {
  const store = new MemoryScores();
  const app = createGameApi({
    attempts: new MemoryAttemptStore(), guides: new MemoryGuideStore(),
    store, source: 'local', community: () => 'Test',
    player: async () => ({ id: 'verified-user', name: 'Real player' }),
    now: () => new Date('2026-11-12T12:00:00Z'),
  });
  const puzzle = dailyPuzzleForDate(new Date('2026-11-12T12:00:00Z'));
  assert.ok(puzzle);
  const response = await app.request('/api/repairs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edition: '2026-11-12', mode: 'gentle', moves: puzzle.witness, footprint: 0, userId: 'impostor' }),
  });
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes('"footprint":8'));
  const saved = [...store.data.values()].flat()[0];
  assert.equal(saved?.userId, 'verified-user');
  assert.equal(saved?.name, 'Real player');
});

test('malformed, unsolved, future and unauthenticated submissions fail explicitly', async () => {
  const app = createGameApi({
    attempts: new MemoryAttemptStore(), guides: new MemoryGuideStore(),
    store: new MemoryScores(), source: 'local', community: () => 'Test',
    player: async (request) => request.headers.get('x-player') ? { id: 'valid', name: 'You' } : null,
    now: () => new Date('2026-11-12T12:00:00Z'),
  });
  const send = (body: unknown, player = true) => app.request('/api/repairs', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(player ? { 'x-player': 'yes' } : {}) },
    body: JSON.stringify(body),
  });
  assert.equal((await send({}, false)).status, 401);
  assert.equal((await send({ moves: [{ a: null }] })).status, 400);
  assert.equal((await send({ edition: '2026-11-12', mode: 'gentle', moves: [
    { a: { row: 1, col: 0 }, b: { row: 1, col: 2 }, rows: 1, cols: 1 },
  ] })).status, 400);
  const puzzle = AUTHORED[2];
  assert.ok(puzzle);
  assert.equal((await send({ edition: '2026-11-13', mode: 'gentle', moves: puzzle.witness })).status, 400);
});

test('deleting records and reconciling deleted accounts removes their scores', async () => {
  const store = new MemoryScores();
  const key = scoreKey('2026-11-12', 'gentle');
  await store.put(key, record('deleted', 4, 1));
  const app = createGameApi({
    attempts: new MemoryAttemptStore(), guides: new MemoryGuideStore(),
    store, source: 'reddit', community: () => 'Test', player: async () => ({ id: 'owner', name: 'Owner' }),
    now: () => new Date('2026-11-12T12:00:00Z'), accountExists: async (id) => id !== 'deleted',
  });
  const board = await app.request('/api/leaderboard?edition=2026-11-12&mode=gentle');
  assert.ok((await board.text()).includes('"players":0'));
  assert.equal((await store.list(key)).length, 0);
  const deletion = await app.request('/api/me', { method: 'DELETE' });
  assert.equal(deletion.status, 200);
});

test('verified fifteen-exchange repairs remain accepted and isolate earlier rules', async () => {
  const store = new MemoryScores();
  const date = '2026-11-15';
  await store.put(scoreKey(date, 'gentle', '1'), record('old-rules', 2, 1));
  await store.put(scoreKey(date, 'gentle', '3'), record('classic-rules', 8, 2));
  const app = createGameApi({
    attempts: new MemoryAttemptStore(), guides: new MemoryGuideStore(),
    store, source: 'local', community: () => 'Test',
    player: async () => ({ id: 'expert', name: 'Expert' }), now: () => new Date(`${date}T12:00:00Z`),
  });
  const puzzle = dailyPuzzleForDate(new Date(`${date}T12:00:00Z`));
  assert.ok(puzzle);
  assert.equal(puzzle.minimum, 5);
  const first = puzzle.witness[0];
  assert.ok(first);
  const moves = [...Array<Swap>(10).fill(first), ...puzzle.witness];
  assert.equal(moves.length, 15);
  const send = (moves: unknown) => app.request('/api/repairs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edition: date, mode: 'gentle', moves }),
  });
  const short = await send(moves.slice(0, -1));
  assert.equal(short.status, 400);
  const full = await send(moves);
  assert.equal(full.status, 200);
  const result = await full.text();
  assert.ok(result.includes('"footprint":60'));
  assert.ok(result.includes('"players":1'));
  assert.equal(result.includes('old-rules'), false);
  assert.equal(result.includes('classic-rules'), false);
  const outside = await send([{ a: { row: 10, col: 0 }, b: { row: 0, col: 0 }, rows: 1, cols: 2 }]);
  assert.equal(outside.status, 400);
});
