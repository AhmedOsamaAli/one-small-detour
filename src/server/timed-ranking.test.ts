import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createGameApi, rankScores, scoreField, scoreKey } from './service.ts';
import type { ScoreStore } from './service.ts';
import { MemoryAttemptStore } from './attempts.ts';
import { MemoryGuideStore } from './guides.ts';
import { dailyPuzzleForDate } from '../shared/puzzles.ts';
import { COUNTDOWN_MS, MAX_ATTEMPT_MS } from '../shared/timing.ts';
import { isAttemptStart, isMyRank, isSavedRepair } from '../shared/validation.ts';
import { legalSwaps } from '../shared/rules.ts';
import type { ScoreRecord } from '../shared/types.ts';

class Scores implements ScoreStore {
  readonly entries = new Map<string, ScoreRecord[]>();
  failNextWrite = false;
  async list(key: string): Promise<ScoreRecord[]> { return this.entries.get(key) ?? []; }
  async put(key: string, score: ScoreRecord): Promise<void> {
    if (this.failNextWrite) { this.failNextWrite = false; throw new Error('Test score storage is unavailable.'); }
    const entries = this.entries.get(key) ?? [];
    this.entries.set(key, [...entries.filter((item) => scoreField(item) !== scoreField(score)), score]);
  }
  async erase(userId: string): Promise<void> {
    for (const [key, entries] of this.entries) this.entries.set(key, entries.filter((entry) => entry.userId !== userId));
  }
}

const timed = (userId: string, swaps: number, solveMs: number): ScoreRecord => ({
  userId, name: userId, swaps, footprint: swaps * 4, solveMs, submittedAt: '2026-11-13T12:00:00Z',
});

test('exchanges outrank speed; same-move speed breaks ties and genuine equals share a rank', () => {
  const board = rankScores([
    timed('slow', 2, 30_000), timed('fast', 2, 9000), timed('equal', 2, 9000),
    timed('one-more', 3, 1000), timed('fast', 2, 40_000),
  ], 'slow', 'local');
  assert.deepEqual(board.entries.map((entry) => [entry.userId, entry.rank]), [
    ['fast', 1], ['equal', 1], ['slow', 3], ['one-more', 4],
  ]);
  assert.equal(board.yourBest?.solveMs, 30_000);
  assert.equal(board.entries.find((entry) => entry.userId === 'fast')?.solveMs, 9000);
  assert.throws(() => rankScores([timed('timed', 2, 5000), {
    userId: 'old', name: 'Old', swaps: 2, footprint: 8, submittedAt: '2026-11-13T12:00:00Z',
  }], null, 'local'), /Timed and untimed/);
  assert.notEqual(scoreKey('2026-11-13', 'daily'), scoreKey('2026-11-13', 'daily', '4'));
});

function fixture() {
  const edition = '2026-11-13';
  let now = Date.parse(`${edition}T12:00:00Z`);
  const scores = new Scores();
  const attempts = new MemoryAttemptStore(() => now);
  const app = createGameApi({
    guides: new MemoryGuideStore(),
    store: scores, attempts, source: 'local', community: () => 'Test',
    now: () => new Date(now),
    player: async (request) => {
      const id = request.headers.get('x-player');
      return id ? { id, name: id } : null;
    },
  });
  const puzzle = dailyPuzzleForDate(new Date(now));
  assert.ok(puzzle);
  const solveIds = new Map<string, string>();
  const start = async (player = 'owner') => {
    const response = await app.request('/api/attempts', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-player': player },
      body: JSON.stringify({ edition }),
    });
    const attempt: unknown = await response.json();
    assert.equal(response.status, 200);
    assert.ok(isAttemptStart(attempt));
    return attempt;
  };
  const submit = (attemptId: string, extra: Record<string, unknown> = {}, player = 'owner') => {
    const solveId = solveIds.get(attemptId) ?? randomUUID();
    solveIds.set(attemptId, solveId);
    return app.request('/api/repairs', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-player': player },
      body: JSON.stringify({ edition, mode: 'daily', attemptId, solveId, moves: puzzle.witness, ...extra }),
    });
  };
  return { app, scores, attempts, edition, puzzle, start, submit, advance: (milliseconds: number) => { now += milliseconds; } };
}

test('the server stamps countdown and solve receipt, ignoring forged client time and identity', async () => {
  const f = fixture();
  const attempt = await f.start();
  assert.ok(attempt.id);
  assert.equal(Date.parse(attempt.startsAt) - Date.parse(attempt.now), COUNTDOWN_MS);
  assert.equal((await f.submit(attempt.id, { solveMs: 0, userId: 'impostor' })).status, 400);
  f.advance(COUNTDOWN_MS + 1250);
  assert.equal((await f.submit(attempt.id, { solveMs: 1, startedAt: 'yesterday' })).status, 200);
  const stored = (await f.scores.list(scoreKey(f.edition, 'daily')))[0];
  assert.equal(stored?.solveMs, 1250);
  assert.equal(stored?.userId, 'owner');
  assert.equal(stored?.swaps, 3);
  const rank = await f.app.request(`/api/my-rank?edition=${f.edition}`, { headers: { 'x-player': 'owner' } });
  assert.deepEqual(await rank.json(), { edition: f.edition, rank: 1, swaps: 3, solveMs: 1250, participants: 1, topPercent: null, source: 'local' });
});

test('timers are bound to identity and edition, expire, and are erased with player records', async () => {
  const f = fixture();
  const attempt = await f.start();
  assert.ok(attempt.id);
  f.advance(COUNTDOWN_MS + 5000);
  assert.equal((await f.submit(attempt.id, {}, 'another-player')).status, 400);
  assert.equal((await f.submit(attempt.id, { edition: '2026-11-12' })).status, 400);
  assert.equal((await f.submit(attempt.id, { moves: [] })).status, 400);
  const deletion = await f.app.request('/api/me', { method: 'DELETE', headers: { 'x-player': 'owner' } });
  assert.equal(deletion.status, 200);
  assert.equal((await f.submit(attempt.id)).status, 400);
  const expired = await f.start();
  assert.ok(expired.id);
  f.advance(COUNTDOWN_MS + MAX_ATTEMPT_MS);
  assert.equal((await f.submit(expired.id)).status, 400);
});

test('retrying a save keeps its first solve time, even after score storage failed', async () => {
  const f = fixture();
  const attempt = await f.start();
  assert.ok(attempt.id);
  f.advance(COUNTDOWN_MS + 7000);
  f.scores.failNextWrite = true;
  assert.equal((await f.submit(attempt.id)).status, 503);
  f.advance(60_000);
  assert.equal((await f.submit(attempt.id)).status, 200);
  assert.equal((await f.scores.list(scoreKey(f.edition, 'daily')))[0]?.solveMs, 7000);
  f.advance(30_000);
  await f.submit(attempt.id);
  assert.equal((await f.scores.list(scoreKey(f.edition, 'daily'))).length, 1);
});

test('a new timer can improve a personal best; legacy scores remain separate and anonymous play is unranked', async () => {
  const f = fixture();
  await f.scores.put(scoreKey(f.edition, 'daily', '4'), {
    userId: 'owner', name: 'Owner', swaps: 1, footprint: 4, submittedAt: `${f.edition}T12:00:00Z`,
  });

  const first = await f.start();
  assert.ok(first.id);
  f.advance(COUNTDOWN_MS + 12_000);
  await f.submit(first.id);
  const second = await f.start();
  assert.ok(second.id);
  f.advance(COUNTDOWN_MS + 8000);
  await f.submit(second.id);
  const rank = await f.app.request(`/api/my-rank?edition=${f.edition}`, { headers: { 'x-player': 'owner' } });
  assert.equal((await rank.json()).solveMs, 8000);
  assert.equal((await f.scores.list(scoreKey(f.edition, 'daily', '4'))).length, 1);
  const anonymous = await f.start('');
  assert.equal(anonymous.id, null);
  const rejected = await f.app.request('/api/repairs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  });
  assert.equal(rejected.status, 401);
});

test('re-solving after Undo records later elapsed time, while retries cannot rewrite a solved replay', async () => {
  const f = fixture();
  const attempt = await f.start();
  assert.ok(attempt.id);
  f.advance(COUNTDOWN_MS + 5000);
  await f.submit(attempt.id);
  f.advance(30_000);
  const retry = await f.submit(attempt.id);
  assert.equal((await retry.json()).saved.solveMs, 5000);
  const later = await f.submit(attempt.id, { solveId: randomUUID() });
  assert.equal((await later.json()).saved.solveMs, 35_000);
  assert.equal(rankScores(await f.scores.list(scoreKey(f.edition, 'daily')), 'owner', 'local').yourBest?.solveMs, 5000);
  const reversible = legalSwaps(f.puzzle.board, 2)[0];
  assert.ok(reversible);
  const changed = await f.submit(attempt.id, { moves: [reversible, reversible, ...f.puzzle.witness] });
  assert.equal(changed.status, 400);
  assert.equal((await changed.json()).code, 'solve_mismatch');
});

test('daily top percentage uses unique finishers, includes tied peers and does not invent a comparison for a sole player', () => {
  const records = [
    timed('first', 2, 5000), timed('tied', 2, 5000),
    timed('third', 2, 7000), timed('fourth', 3, 3000), timed('first', 2, 9000),
  ];
  const first = rankScores(records, 'first', 'local');
  assert.equal(first.players, 4);
  assert.equal(first.topPercent, 50);
  assert.equal(rankScores(records, 'tied', 'local').topPercent, 50);
  assert.equal(rankScores(records, 'third', 'local').topPercent, 75);
  assert.equal(rankScores(records, 'fourth', 'local').topPercent, 100);
  assert.equal(rankScores(records, null, 'local').topPercent, null);
  assert.equal(rankScores([timed('solo', 2, 5000)], 'solo', 'local').topPercent, null);
  assert.equal(rankScores([], 'first', 'local').topPercent, null);
});

test('percentage covers the complete cohort even when your rank is outside the displayed legacy table', () => {
  const records = Array.from({ length: 50 }, (_, index) => timed(`player-${index}`, 2, 1000 + index * 100));
  const result = rankScores(records, 'player-24', 'local');
  assert.equal(result.entries.length, 20);
  assert.equal(result.yourBest?.rank, 25);
  assert.equal(result.players, 50);
  assert.equal(result.topPercent, 50);
});

test('rank and save wire guards reject fabricated, missing or invalid percentage populations', () => {
  const rank = { edition: '2026-11-13', rank: 1, swaps: 2, solveMs: 5000, participants: 4, topPercent: 50, source: 'local' };
  assert.equal(isMyRank(rank), true);
  assert.equal(isMyRank({ ...rank, topPercent: null }), false);
  assert.equal(isMyRank({ ...rank, participants: 0 }), false);
  assert.equal(isMyRank({ ...rank, rank: 5 }), false);
  assert.equal(isMyRank({ ...rank, participants: 1, topPercent: null }), true);
  assert.equal(isMyRank({ ...rank, participants: 1 }), false);
  for (const topPercent of [0, -1, 101, NaN, Infinity, '50']) assert.equal(isMyRank({ ...rank, topPercent }), false);
  const saved = { ...rankScores([timed('solo', 2, 5000)], 'solo', 'local'), saved: { swaps: 2, solveMs: 5000 } };
  assert.equal(isSavedRepair(saved), true);
  assert.equal(isSavedRepair({ ...saved, topPercent: 1 }), false);
  assert.equal(isSavedRepair({ ...saved, players: 0 }), false);
});
