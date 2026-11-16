import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RankingFixture } from './rankingFixture.ts';
import { createGameApi, scoreKey } from './service.ts';
import { MemoryAttemptStore } from './attempts.ts';
import { MemoryGuideStore } from './guides.ts';
import type { ScoreRecord } from '../shared/types.ts';
import { COUNTDOWN_MS } from '../shared/timing.ts';
import { dailyPuzzleForDate } from '../shared/puzzles.ts';
import { isAttemptStart, isSavedRepair } from '../shared/validation.ts';
import { legalSwaps } from '../shared/rules.ts';

const edition = '2026-11-16';
const key = scoreKey(edition, 'daily');
const record = (swaps = 5, solveMs = 9000, userId = 'owner'): ScoreRecord => ({
  userId, name: userId, footprint: swaps * 4, swaps, solveMs, submittedAt: `${edition}T12:00:00Z`,
});

function fixture() {
  const redis = new RankingFixture();
  redis.now = Date.parse(`${edition}T12:00:00Z`);
  redis.seed(key, []);
  const ranking = redis.create();
  return { redis, ranking };
}

test('a first Daily result is immutable to faster, fewer-move and concurrent repeat completions', async () => {
  const { redis, ranking } = fixture();
  const id = randomUUID();
  assert.equal(await ranking.firstStatus(key, 'owner'), 'eligible');
  assert.deepEqual(await ranking.put(key, record(), id), { ranking: 'recorded' });
  assert.deepEqual(await ranking.put(key, record(), id), { ranking: 'recorded' });
  assert.deepEqual(await ranking.put(key, record(3, 1000), randomUUID()), { ranking: 'replay' });
  assert.deepEqual(await ranking.put(key, record(5, 1), randomUUID()), { ranking: 'replay' });
  assert.equal((await ranking.read(key, 'owner')).yourBest?.solveMs, 9000);
  assert.equal((await ranking.read(key, 'owner')).yourBest?.swaps, 5);
  assert.equal(await ranking.firstStatus(key, 'owner'), 'replay');
  const competing = await Promise.all([
    ranking.put(key, record(4, 8000, 'peer'), randomUUID()),
    ranking.put(key, record(3, 1000, 'peer'), randomUUID()),
  ]);
  assert.equal(competing.filter((result) => result?.ranking === 'recorded').length, 1);
  assert.equal(competing.filter((result) => result?.ranking === 'replay').length, 1);
  assert.equal((await ranking.read(key, null)).players, 2);
  assert.ok([...redis.expirations].some(([name]) => name.includes(':first:')));
});

test('already saved scores are frozen as migration baselines without reranking or resetting the cohort', async () => {
  const { redis, ranking } = fixture();
  redis.seed(key, [record(4, 12_000), record(3, 17_000, 'peer')]);
  assert.equal(await ranking.firstStatus(key, 'owner'), 'replay');
  assert.deepEqual(await ranking.put(key, record(3, 100), randomUUID()), { ranking: 'replay' });
  const board = await ranking.read(key, 'owner');
  assert.equal(board.players, 2);
  assert.equal(board.yourBest?.swaps, 4);
  assert.equal(board.yourBest?.solveMs, 12_000);
  assert.equal(board.yourBest?.rank, 2);
});

test('a saved first-completion reservation survives a later ranking-write failure and cannot be improved through another device', async () => {
  const { redis, ranking } = fixture();
  let executions = 0;
  redis.beforeExec = () => {
    if (++executions === 2) { redis.beforeExec = null; throw new Error('Isolated ranking write failure after first-result reservation.'); }
  };
  await assert.rejects(ranking.put(key, record(5, 16_000), randomUUID()), /after first-result/);
  assert.deepEqual(await ranking.put(key, record(3, 1000), randomUUID()), { ranking: 'replay' });
  assert.equal((await ranking.read(key, 'owner')).yourBest?.solveMs, 16_000);
  assert.equal((await ranking.read(key, 'owner')).yourBest?.swaps, 5);
});

test('erasing a Daily removes its score and name but preserves only a used-turn marker until the edition expires', async () => {
  const { redis, ranking } = fixture();
  await ranking.put(key, record(), randomUUID());
  redis.now += 1000;
  await ranking.erase('owner');
  assert.equal((await ranking.read(key, 'owner')).yourBest, null);
  assert.equal(await ranking.firstStatus(key, 'owner'), 'removed');
  assert.deepEqual(await ranking.put(key, { ...record(3, 100), submittedAt: new Date(redis.now + 1).toISOString() }, randomUUID()),
    { ranking: 'removed' });
  assert.equal((await ranking.read(key, 'owner')).players, 0);
  const marker = [...redis.strings].find(([name]) => name.endsWith(':first:owner'));
  assert.deepEqual(JSON.parse(marker?.[1] ?? ''), { removed: true });
  assert.equal(redis.expirations.get(marker?.[0] ?? ''), Date.parse('2026-12-16T00:00:00Z'));
});

test('first-result reservations do not introduce a shared-player lock or change older Daily best-score rules', async () => {
  const { ranking } = fixture();
  await Promise.all(Array.from({ length: 250 }, (_, index) => ranking.put(key, record(3, 1000 + index, `peer-${index}`), randomUUID())));
  assert.equal((await ranking.read(key, null)).players, 250);
  const old = scoreKey('2026-11-15', 'daily');
  await ranking.put(old, record(4, 10_000), randomUUID());
  await ranking.put(old, record(3, 1000), randomUUID());
  assert.equal((await ranking.read(old, 'owner')).yourBest?.swaps, 3);
});

test('the Daily API makes completed replays unranked, protects concurrent open attempts and preserves network save retries', async () => {
  const { redis, ranking } = fixture();
  const puzzle = dailyPuzzleForDate(new Date(redis.now));
  assert.ok(puzzle);
  const app = createGameApi({
    source: 'reddit', community: () => 'Test', dailyRanking: ranking,
    attempts: new MemoryAttemptStore(() => redis.now), guides: new MemoryGuideStore(),
    store: { list: async () => [], put: async () => { throw new Error('Timed results must use the indexed store.'); }, erase: async () => undefined },
    player: async () => ({ id: 'owner', name: 'Owner' }), now: () => new Date(redis.now),
  });
  const start = async () => {
    const response = await app.request('/api/attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edition }) });
    const body: unknown = await response.json();
    assert.equal(response.status, 200);
    assert.ok(isAttemptStart(body));
    return body;
  };
  const first = await start(), concurrent = await start();
  assert.equal(first.ranking, 'eligible');
  assert.ok(first.id && concurrent.id);
  redis.now += COUNTDOWN_MS + 7000;
  const solveId = randomUUID();
  const reversible = legalSwaps(puzzle.board, puzzle.area)[0];
  assert.ok(reversible);
  const submission = { edition, mode: 'daily', attemptId: first.id, solveId, moves: [reversible, reversible, ...puzzle.witness] };
  const save = (body: unknown) => app.request('/api/repairs', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body) });
  let executions = 0;
  redis.beforeExec = () => {
    if (++executions === 2) { redis.beforeExec = null; throw new Error('Isolated ranking failure after reservation.'); }
  };
  assert.equal((await save(submission)).status, 503);
  redis.now += 20_000;
  const retry: unknown = await (await save(submission)).json();
  assert.ok(isSavedRepair(retry));
  assert.equal(retry.ranking, 'recorded');
  assert.equal(retry.saved.solveMs, 7000);
  const duplicate: unknown = await (await save({ ...submission, attemptId: concurrent.id, solveId: randomUUID(), moves: puzzle.witness })).json();
  assert.ok(isSavedRepair(duplicate));
  assert.equal(duplicate.ranking, 'replay');
  assert.equal(duplicate.yourBest?.swaps, puzzle.witness.length + 2);
  assert.equal(duplicate.yourBest?.solveMs, 7000);
  const replay = await start();
  assert.equal(replay.id, null);
  assert.equal(replay.ranking, 'replay');
  assert.equal(await (await app.request('/api/my-rank?edition=2026-11-16')).json().then((body: unknown) =>
    typeof body === 'object' && body !== null && 'swaps' in body ? body.swaps : null), puzzle.witness.length + 2);
  assert.equal((await app.request('/api/me', { method: 'DELETE' })).status, 200);
  const removed = await start();
  assert.equal(removed.id, null);
  assert.equal(removed.ranking, 'removed');
});
