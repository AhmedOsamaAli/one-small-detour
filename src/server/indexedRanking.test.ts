import assert from 'node:assert/strict';
import test from 'node:test';
import { RankingFixture } from './rankingFixture.ts';
import { dailyRankScore } from './indexedRanking.ts';
import { createGameApi, rankScores, scoreKey } from './service.ts';
import { COUNTDOWN_MS, MAX_ATTEMPT_MS } from '../shared/timing.ts';
import { MAX_EXCHANGES } from '../shared/rules.ts';
import type { ScoreRecord } from '../shared/types.ts';
import { MemoryAttemptStore } from './attempts.ts';
import { MemoryGuideStore } from './guides.ts';
import { dailyPuzzleForDate } from '../shared/puzzles.ts';
import { isAttemptStart, isMyRank, isRecord, isSavedRepair } from '../shared/validation.ts';
import { randomUUID } from 'node:crypto';

const key = scoreKey('2026-11-15', 'daily');
const record = (userId: string, swaps: number, solveMs: number): ScoreRecord => ({
  userId, name: userId, swaps, solveMs, footprint: swaps * 4, submittedAt: '2026-11-15T12:00:01Z',
});

test('integer index encoding preserves moves before milliseconds without floating-point ties', () => {
  assert.ok(dailyRankScore(record('slow', 2, MAX_ATTEMPT_MS)) < dailyRankScore(record('fast', 3, 0)));
  assert.equal(dailyRankScore(record('one', 3, 2)) - dailyRankScore(record('two', 3, 1)), 1);
  assert.ok(Number.isSafeInteger(dailyRankScore(record('max', MAX_EXCHANGES, MAX_ATTEMPT_MS))));
  assert.throws(() => dailyRankScore({ swaps: 1, solveMs: -1 }));
});

test('atomic personal-best updates preserve the best concurrent result and shared ties', async () => {
  const fixture = new RankingFixture(), ranking = fixture.create();
  await ranking.put(key, record('owner', 3, 30_000));
  await Promise.all([ranking.put(key, record('owner', 3, 40_000)), ranking.put(key, record('owner', 3, 9000))]);
  await ranking.put(key, record('equal', 3, 9000));
  await ranking.put(key, record('worse', 4, 100));
  const result = await ranking.read(key, 'owner');
  assert.equal(result.players, 3);
  assert.equal(result.yourBest?.rank, 1);
  assert.equal(result.yourBest?.solveMs, 9000);
  assert.equal(result.topPercent, 200 / 3);
  assert.equal((await ranking.read(key, 'worse')).yourBest?.rank, 3);
  assert.deepEqual(result.entries, []);
  const legacyView = await ranking.read(key, 'owner', true);
  assert.deepEqual(legacyView.entries.map((entry) => entry.rank), [1, 1, 3]);
});

test('100,000 indexed finishers produce the same ties and percentage as the independent full-sort oracle with bounded reads', async () => {
  const records = Array.from({ length: 100_000 }, (_, index) => record(`p${index}`, 3 + index % 8, index % 50 * 1000));
  const fixture = new RankingFixture(); fixture.seed(key, records);
  const ranking = fixture.create();
  const actual = await ranking.read(key, 'p98765');
  const expected = rankScores(records, 'p98765', 'reddit');
  assert.equal(actual.players, expected.players);
  assert.equal(actual.yourBest?.rank, expected.yourBest?.rank);
  assert.equal(actual.topPercent, expected.topPercent);
  assert.equal(fixture.calls['hScan'] ?? 0, 0);
  assert.ok(Object.values(fixture.calls).reduce((sum, count) => sum + count, 0) <= 14);
  assert.ok(JSON.stringify(actual).length < 1000);
});

test('legacy migration is resumable and never returns a partial or invented cohort', async () => {
  const fixture = new RankingFixture(), ranking = fixture.create();
  const legacy = new Map<string, string>();
  for (let index = 0; index < 19; index++) legacy.set(`entry-${index}`, JSON.stringify(record(`p${index % 10}`, 3, 1000 + index * 100)));
  fixture.legacy.set(key, legacy);
  await assert.rejects(() => ranking.read(key, 'p0'), { code: 'ranking_indexing' });
  await assert.rejects(() => ranking.read(key, 'p0'), { code: 'ranking_indexing' });
  const result = await ranking.read(key, 'p0');
  assert.equal(result.players, 10);
  assert.equal(result.yourBest?.solveMs, 1000);
  assert.equal(legacy.size, 19);
});

test('erasure removes indexed rank and tombstones an old concurrent or backfilled result, not a new attempt', async () => {
  const fixture = new RankingFixture(), ranking = fixture.create();
  await ranking.put(key, record('owner', 3, 1000));
  await ranking.put(key, record('other', 3, 2000));
  fixture.now += 5000;
  await ranking.erase('owner');
  assert.equal((await ranking.read(key, 'other')).players, 1);
  await assert.rejects(() => ranking.put(key, record('owner', 3, 1000)), { code: 'records_removed' });
  await ranking.put(key, { ...record('owner', 3, 3000), submittedAt: new Date(fixture.now + 1).toISOString() });
  assert.equal((await ranking.read(key, 'owner')).players, 2);
  assert.equal(fixture.expirations.get(`${key}:rank-index:1:best:owner`), Date.parse('2026-12-15T00:00:00Z'));
});

test('erasure also removes a player from a pending legacy-migration batch', async () => {
  const fixture = new RankingFixture(), ranking = fixture.create();
  fixture.legacy.set(key, new Map(Array.from({ length: 10 }, (_, index) =>
    [`entry-${index}`, JSON.stringify(record(`p${index}`, 3, 1000 + index))])));
  await assert.rejects(() => ranking.read(key, 'p0'), { code: 'ranking_indexing' });
  fixture.registered.set('p9', new Set([key]));
  await ranking.erase('p9');
  const pending = fixture.strings.get(`${key}:rank-index:1:state`);
  assert.ok(pending);
  const progress: unknown = JSON.parse(pending);
  assert.ok(isRecord(progress) && Array.isArray(progress['pending']));
  assert.ok(progress['pending'].every((item: unknown) => typeof item === 'string' && !item.includes('"userId":"p9"')));
  const result = await ranking.read(key, 'p0');
  assert.equal(result.players, 9);
});

test('bounded account reconciliation removes deleted users without checking the whole ranking', async () => {
  const fixture = new RankingFixture(), checks: string[] = [];
  const ranking = fixture.create({ accountExists: async (id) => { checks.push(id); return id !== 'p0'; } });
  const records = Array.from({ length: 100 }, (_, index) => record(`p${index}`, 3, 1000 + index));
  fixture.seed(key, records);
  fixture.rawAdd(`${key}:rank-index:1:checked`, records.map(({ userId }) => ({ member: userId, score: 0 })));
  const result = await ranking.read(key, 'p20');
  assert.equal(checks.length, 4);
  assert.equal(result.players, 99);
  assert.equal(result.yourBest?.rank, 20);
});

test('transaction conflicts retry but Redis failures never become fake rank-zero success', async () => {
  const fixture = new RankingFixture(), ranking = fixture.create();
  fixture.seed(key, [record('owner', 3, 1000)]);
  fixture.beforeExec = () => {
    fixture.beforeExec = null;
    fixture.touch(`${key}:rank-index:1:best:owner`);
  };
  assert.equal((await ranking.read(key, 'owner')).yourBest?.rank, 1);
  fixture.beforeExec = () => { throw new Error('Isolated Redis outage'); };
  await assert.rejects(() => ranking.read(key, 'owner'), /Redis outage/);
});

test('real API score verification and personal-rank responses use the index without loading legacy results', async () => {
  const fixture = new RankingFixture(), dailyRanking = fixture.create();
  const app = createGameApi({
    source: 'reddit', community: () => 'Isolated ranking test', now: () => new Date(fixture.now),
    player: async () => ({ id: 'owner', name: 'Owner' }),
    guides: new MemoryGuideStore(), attempts: new MemoryAttemptStore(() => fixture.now), dailyRanking,
    store: {
      list: async () => { throw new Error('Hot indexed ranking must not scan legacy results.'); },
      put: async () => { throw new Error('Hot indexed ranking must not append attempt history.'); },
      erase: async () => undefined,
    },
  });
  const edition = '2026-11-15';
  const attempt: unknown = await (await app.request('/api/attempts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edition }),
  })).json();
  assert.ok(isAttemptStart(attempt));
  fixture.now += COUNTDOWN_MS + 1500;
  const puzzle = dailyPuzzleForDate(new Date(fixture.now));
  assert.ok(puzzle);
  const response = await app.request('/api/repairs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edition, mode: 'daily', attemptId: attempt.id, solveId: randomUUID(), moves: puzzle.witness }),
  });
  const saved: unknown = await response.json();
  assert.equal(response.status, 200);
  assert.ok(isSavedRepair(saved));
  assert.equal(saved.yourBest?.solveMs, 1500);
  assert.equal(saved.players, 1);
  const rank: unknown = await (await app.request(`/api/my-rank?edition=${edition}`)).json();
  assert.ok(isMyRank(rank));
  assert.equal(rank.rank, 1);
  assert.equal(rank.participants, 1);
});
