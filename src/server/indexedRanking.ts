import { MAX_EXCHANGES, RuleError } from '../shared/rules.ts';
import { MAX_ATTEMPT_MS, TIMED_SCORE_VERSION } from '../shared/timing.ts';
import { isRecord, isScoreRecord } from '../shared/validation.ts';
import type { Leaderboard, ScoreRecord } from '../shared/types.ts';
import { chooseFirstDaily, firstDailyKey, firstDailyLock } from './firstDaily.ts';
import type { DailyWrite, FirstDailyStatus } from './firstDaily.ts';

interface Member { member: string; score: number }
interface RangeOptions { by: 'rank' | 'score'; reverse?: boolean; limit?: { offset: number; count: number } }
interface SetOptions { expiration?: Date }

export interface RankTransaction {
  multi(): Promise<void>;
  exec(): Promise<unknown[] | null>;
  unwatch(): Promise<unknown>;
  set(key: string, value: string, options?: SetOptions): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  zAdd(key: string, ...members: Member[]): Promise<unknown>;
  zRem(key: string, members: string[]): Promise<unknown>;
  zCard(key: string): Promise<unknown>;
  zRank(key: string, member: string): Promise<unknown>;
  zScore(key: string, member: string): Promise<unknown>;
  zRange(key: string, start: number, stop: number, options: RangeOptions): Promise<unknown>;
}

export interface RankRedis {
  get(key: string): Promise<string | undefined>;
  mGet(keys: string[]): Promise<(string | null)[]>;
  set(key: string, value: string, options?: SetOptions): Promise<unknown>;
  watch(...keys: string[]): Promise<RankTransaction>;
  zAdd(key: string, ...members: Member[]): Promise<unknown>;
  zCard(key: string): Promise<number>;
  zRange(key: string, start: number, stop: number, options: RangeOptions): Promise<Member[]>;
  expire(key: string, seconds: number): Promise<unknown>;
  hScan(key: string, cursor: number, pattern?: string, count?: number): Promise<{
    cursor: number; fieldValues: { field: string; value: string }[];
  }>;
}

export interface DailyRankingStore {
  put(key: string, record: ScoreRecord, solveId?: string): Promise<DailyWrite | void>;
  firstStatus(key: string, userId: string): Promise<FirstDailyStatus>;
  read(key: string, userId: string | null, includeLeaders?: boolean): Promise<Leaderboard>;
  erase(userId: string): Promise<void>;
}

interface RankingOptions {
  remember: (key: string, userId: string) => Promise<void>;
  keys: (userId: string) => Promise<string[]>;
  accountExists?: (userId: string) => Promise<boolean>;
  eraseOtherData?: (userId: string) => Promise<void>;
  now?: () => number;
}

const RETENTION_MS = 30 * 86_400_000;
const RETRIES = 4;
const BATCH_SIZE = 8;
const busy = (): RuleError => new RuleError('The ranking changed while saving. Your repair is safe; retry save.', 'ranking_busy');
const indexKey = (key: string): string => `${key}:rank-index:1`;
const playerKey = (key: string, id: string): string => `${indexKey(key)}:best:${id}`;
const erasedKey = (id: string): string => `detour:rank-erased:${id}`;
const firstKey = (key: string, id: string): string => `${indexKey(key)}:first:${id}`;
const conflict = (result: unknown[] | null): boolean => result === null || result.length === 0 || (result.length === 1 && result[0] === null);

function expiry(key: string): Date {
  const match = new RegExp(`^detour:${TIMED_SCORE_VERSION}:(\\d{4}-\\d{2}-\\d{2}):daily$`).exec(key);
  const day = match?.[1];
  if (!day) throw new Error('The indexed Daily ranking has an invalid edition key.');
  const date = new Date(Date.parse(`${day}T00:00:00Z`) + RETENTION_MS);
  if (!Number.isFinite(date.getTime())) throw new Error('The indexed Daily ranking has an invalid date.');
  return date;
}

function recordFrom(text: string): ScoreRecord {
  const record: unknown = JSON.parse(text);
  if (!isScoreRecord(record) || record.solveMs === undefined) throw new Error('The Daily personal-best record is invalid.');
  return record;
}

export function dailyRankScore(record: Pick<ScoreRecord, 'swaps' | 'solveMs'>): number {
  if (!Number.isInteger(record.swaps) || record.swaps < 1 || record.swaps > MAX_EXCHANGES ||
      record.solveMs === undefined || !Number.isInteger(record.solveMs) || record.solveMs < 0 || record.solveMs > MAX_ATTEMPT_MS) {
    throw new Error('A Daily index score needs valid exchanges and server timing.');
  }
  const score = record.swaps * (MAX_ATTEMPT_MS + 1) + record.solveMs;
  if (!Number.isSafeInteger(score)) throw new Error('The Daily index score exceeds integer precision.');
  return score;
}

function isMembers(value: unknown): value is Member[] {
  return Array.isArray(value) && value.every((part: unknown) => typeof part === 'object' && part !== null &&
    'member' in part && typeof part.member === 'string' && 'score' in part && typeof part.score === 'number');
}

function transactionMembers(value: unknown): Member[] | null {
  if (!isRecord(value) || !isMembers(value['members'])) return null;
  return value['members'];
}

export class IndexedDailyRanking implements DailyRankingStore {
  private readonly now: () => number;
  private readonly redis: RankRedis;
  private readonly options: RankingOptions;
  constructor(redis: RankRedis, options: RankingOptions) {
    this.redis = redis;
    this.options = options;
    this.now = options.now ?? Date.now;
  }

  private ttl(key: string): number { return Math.max(1, Math.ceil((expiry(key).getTime() - this.now()) / 1000)); }

  private async writeBest(key: string, record: ScoreRecord, historical = false): Promise<void> {
    const encoded = dailyRankScore(record);
    const bestKey = playerKey(key, record.userId);
    for (let retry = 0; retry < RETRIES; retry++) {
      const tx = await this.redis.watch(bestKey, erasedKey(record.userId));
      let closed = false;
      try {
        const [text, erased] = await Promise.all([this.redis.get(bestKey), this.redis.get(erasedKey(record.userId))]);
        if (erased !== undefined && !Number.isSafeInteger(Number(erased))) throw new Error('The saved-result erasure marker is invalid.');
        if (erased !== undefined && Date.parse(record.submittedAt) <= Number(erased)) {
          if (historical) return;
          throw new RuleError('That result was removed. Begin a fresh attempt before saving again.', 'records_removed');
        }
        if (text !== undefined) {
          const previous = recordFrom(text);
          if (previous.userId !== record.userId) throw new Error('The personal best belongs to a different player.');
          if (dailyRankScore(previous) <= encoded) return;
        }
        await tx.multi();
        await tx.set(bestKey, JSON.stringify(record), { expiration: expiry(key) });
        await tx.zAdd(indexKey(key), { member: record.userId, score: encoded });
        await tx.expire(indexKey(key), this.ttl(key));
        await tx.zAdd(`${indexKey(key)}:checked`, { member: record.userId, score: historical ? 0 : this.now() });
        await tx.expire(`${indexKey(key)}:checked`, this.ttl(key));
        closed = true;
        const result = await tx.exec();
        if (conflict(result)) continue;
        if (result?.length !== 5) throw new Error('The Daily personal-best transaction returned an invalid result.');
        return;
      } finally { if (!closed) await tx.unwatch(); }
    }
    throw busy();
  }

  private async prepare(key: string): Promise<void> {
    const stateKey = `${indexKey(key)}:state`;
    const state = await this.redis.get(stateKey);
    if (state === 'ready') return;
    const saved: unknown = state === undefined ? { cursor: 0, pending: [] } : JSON.parse(state);
    if (!isRecord(saved) || typeof saved['cursor'] !== 'number' || !Number.isSafeInteger(saved['cursor']) || saved['cursor'] < 0 ||
        !Array.isArray(saved['pending']) || !saved['pending'].every((item: unknown) => typeof item === 'string')) {
      throw new Error('The ranking migration cursor is invalid.');
    }
    let cursor = saved['cursor'];
    let pending: string[] = saved['pending'];
    if (!pending.length) {
      const batch = await this.redis.hScan(key, cursor, undefined, BATCH_SIZE);
      cursor = batch.cursor;
      pending = batch.fieldValues.map((field) => field.value);
    }
    for (const text of pending.slice(0, BATCH_SIZE)) {
      const record = recordFrom(text);
      await this.options.remember(key, record.userId);
      await this.writeBest(key, record, true);
    }
    const remaining = pending.slice(BATCH_SIZE);
    const ready = cursor === 0 && remaining.length === 0;
    const tx = await this.redis.watch(stateKey);
    let closed = false;
    try {
      const current = await this.redis.get(stateKey);
      if (current === 'ready') return;
      if (current !== state) throw busy();
      await tx.multi();
      await tx.set(stateKey, ready ? 'ready' : JSON.stringify({ cursor, pending: remaining }), { expiration: expiry(key) });
      closed = true;
      const result = await tx.exec();
      if (conflict(result) || !ready) {
        throw new RuleError('Existing scores are being indexed. No records were removed; retry shortly.', 'ranking_indexing');
      }
      if (result?.length !== 1) throw new Error('The ranking migration transaction returned an invalid result.');
    } finally { if (!closed) await tx.unwatch(); }
  }

  private async reserveFirst(key: string, record: ScoreRecord, solveId: string | null) {
    const lockKey = firstKey(key, record.userId);
    for (let retry = 0; retry < RETRIES; retry++) {
      const tx = await this.redis.watch(lockKey, playerKey(key, record.userId), erasedKey(record.userId));
      let closed = false;
      try {
        const [text, best, erased] = await Promise.all([
          this.redis.get(lockKey), this.redis.get(playerKey(key, record.userId)), this.redis.get(erasedKey(record.userId)),
        ]);
        if (erased !== undefined && !Number.isSafeInteger(Number(erased))) throw new Error('The saved-result erasure marker is invalid.');
        const previous = firstDailyLock(text, record.userId);
        if (erased !== undefined && Date.parse(record.submittedAt) <= Number(erased) && !(previous && 'removed' in previous)) {
          throw new RuleError('That result was removed. Begin a fresh attempt before saving again.', 'records_removed');
        }
        const baseline = best === undefined ? null : recordFrom(best);
        if (baseline && baseline.userId !== record.userId) throw new Error('The first Daily baseline belongs to another player.');
        const choice = chooseFirstDaily(previous, baseline, record, solveId);
        if (previous) return choice;
        await tx.multi();
        await tx.set(lockKey, JSON.stringify(choice.lock), { expiration: expiry(key) });
        closed = true;
        const result = await tx.exec();
        if (conflict(result)) continue;
        if (result?.length !== 1) throw new Error('The first Daily result lock returned an invalid result.');
        return choice;
      } finally { if (!closed) await tx.unwatch(); }
    }
    throw busy();
  }

  async firstStatus(key: string, userId: string): Promise<FirstDailyStatus> {
    expiry(key);
    if (!firstDailyKey(key)) return 'eligible';
    await this.prepare(key);
    const [text, best] = await Promise.all([this.redis.get(firstKey(key, userId)), this.redis.get(playerKey(key, userId))]);
    const lock = firstDailyLock(text, userId);
    if (lock && 'removed' in lock) return 'removed';
    if (lock) {
      await this.writeBest(key, lock.record);
      return 'replay';
    }
    if (best !== undefined) {
      if (recordFrom(best).userId !== userId) throw new Error('The Daily replay status belongs to another player.');
      return 'replay';
    }
    return 'eligible';
  }

  async put(key: string, record: ScoreRecord, solveId?: string): Promise<DailyWrite | void> {
    expiry(key);
    await this.options.remember(key, record.userId);
    await this.prepare(key);
    if (firstDailyKey(key)) {
      const choice = await this.reserveFirst(key, record, solveId ?? null);
      if (choice.record) await this.writeBest(key, choice.record);
      return { ranking: choice.ranking };
    }
    await this.writeBest(key, record);
  }

  private async reconcile(key: string): Promise<void> {
    const exists = this.options.accountExists;
    if (!exists) return;
    const checkedKey = `${indexKey(key)}:checked`;
    const due = (await this.redis.zRange(checkedKey, 0, 3, { by: 'rank' }))
      .filter((member) => member.score <= this.now() - 300_000);
    await Promise.all(due.map(async ({ member }) => {
      if (await exists(member)) await this.redis.zAdd(checkedKey, { member, score: this.now() });
      else { await this.erase(member); await this.options.eraseOtherData?.(member); }
    }));
  }

  private async leaders(key: string, value: unknown, userId: string | null): Promise<Leaderboard['entries']> {
    const members = transactionMembers(value);
    if (!members) throw new Error('The Daily leader range is invalid.');
    if (!members.length) return [];
    const records = await this.redis.mGet(members.map(({ member }) => playerKey(key, member)));
    let rank = 0;
    return members.map((member, index) => {
      const text = records[index];
      if (!text) throw busy();
      const record = recordFrom(text);
      if (record.userId !== member.member || dailyRankScore(record) !== member.score) throw busy();
      if (!index || members[index - 1]?.score !== member.score) rank = index + 1;
      return { ...record, rank, isYou: record.userId === userId };
    });
  }

  async read(key: string, userId: string | null, includeLeaders = false): Promise<Leaderboard> {
    expiry(key);
    await this.prepare(key);
    await this.reconcile(key);
    for (let retry = 0; retry < RETRIES; retry++) {
      const bestKey = userId ? playerKey(key, userId) : `${indexKey(key)}:anonymous`;
      const tx = await this.redis.watch(bestKey);
      let closed = false;
      try {
        const text = userId ? await this.redis.get(bestKey) : undefined;
        const record = text === undefined ? null : recordFrom(text);
        if (record && record.userId !== userId) throw new Error('The Daily ranking returned another player\'s record.');
        const score = record ? dailyRankScore(record) : null;
        const boundary = { by: 'score' as const, limit: { offset: 0, count: 1 } };
        const [first, last] = score === null ? [[], []] : await Promise.all([
          this.redis.zRange(indexKey(key), score, score, boundary),
          this.redis.zRange(indexKey(key), score, score, { ...boundary, reverse: true }),
        ]);
        if (record && (!first[0] || !last[0])) continue;
        await tx.multi();
        await tx.zCard(indexKey(key));
        if (score !== null && first[0] && last[0] && userId) {
          await tx.zRank(indexKey(key), first[0].member);
          await tx.zRank(indexKey(key), last[0].member);
          await tx.zScore(indexKey(key), userId);
          await tx.zRange(indexKey(key), score, score, boundary);
          await tx.zRange(indexKey(key), score, score, { ...boundary, reverse: true });
        } else if (userId) await tx.zScore(indexKey(key), userId);
        if (includeLeaders) await tx.zRange(indexKey(key), 0, 19, { by: 'rank' });
        closed = true;
        const result = await tx.exec();
        if (conflict(result)) continue;
        const players = result?.[0];
        if (typeof players !== 'number' || !Number.isInteger(players) || players < 0) throw new Error('The Daily finisher count is invalid.');
        const entries = includeLeaders ? await this.leaders(key, result?.at(-1), userId) : [];
        if (!record) {
          if (userId && result?.[1] !== null && result?.[1] !== undefined) throw new Error('An indexed player is missing their personal-best record.');
          return { entries, players, yourBest: null, topPercent: null, source: 'reddit', mode: 'daily' };
        }
        const rank = result?.[1], end = result?.[2], currentScore = result?.[3];
        const currentFirst = transactionMembers(result?.[4]), currentLast = transactionMembers(result?.[5]);
        if (typeof rank !== 'number' || typeof end !== 'number' || currentScore !== score ||
            !currentFirst || !currentLast ||
            currentFirst[0]?.member !== first[0]?.member || currentLast[0]?.member !== last[0]?.member) continue;
        if (rank < 0 || end < rank || end >= players) throw new Error('The Daily rank boundaries are invalid.');
        return {
          entries, players, yourBest: { ...record, rank: rank + 1, isYou: true },
          topPercent: players > 1 ? (end + 1) * 100 / players : null, source: 'reddit', mode: 'daily',
        };
      } finally { if (!closed) await tx.unwatch(); }
    }
    throw busy();
  }

  async erase(userId: string): Promise<void> {
    const keys = (await this.options.keys(userId)).filter((key) => key.startsWith(`detour:${TIMED_SCORE_VERSION}:`) && key.endsWith(':daily'));
    await this.redis.set(erasedKey(userId), String(this.now()), { expiration: new Date(this.now() + MAX_ATTEMPT_MS) });
    for (const key of keys) {
      expiry(key);
      const stateKey = `${indexKey(key)}:state`;
      const lockKey = firstKey(key, userId);
      const tx = await this.redis.watch(playerKey(key, userId), stateKey, lockKey);
      let closed = false;
      try {
        const [state, best, first] = await Promise.all([
          this.redis.get(stateKey), this.redis.get(playerKey(key, userId)), this.redis.get(lockKey),
        ]);
        const spent = firstDailyKey(key) && (best !== undefined || firstDailyLock(first, userId) !== null);
        let nextState: string | null = null;
        if (state !== undefined && state !== 'ready') {
          const progress: unknown = JSON.parse(state);
          if (!isRecord(progress) || typeof progress['cursor'] !== 'number' || !Array.isArray(progress['pending'])) {
            throw new Error('The ranking migration cannot be erased because its state is invalid.');
          }
          const pending = progress['pending'].filter((item: unknown) => {
            if (typeof item !== 'string') throw new Error('The ranking migration contains an invalid pending record.');
            return recordFrom(item).userId !== userId;
          });
          nextState = progress['cursor'] === 0 && !pending.length ? 'ready' : JSON.stringify({ cursor: progress['cursor'], pending });
        }
        await tx.multi();
        await tx.del(playerKey(key, userId));
        await tx.zRem(indexKey(key), [userId]);
        await tx.zRem(`${indexKey(key)}:checked`, [userId]);
        if (spent) await tx.set(lockKey, JSON.stringify({ removed: true }), { expiration: expiry(key) });
        if (nextState !== null) await tx.set(stateKey, nextState, { expiration: expiry(key) });
        closed = true;
        const result = await tx.exec();
        if (conflict(result)) throw busy();
        if (result?.length !== 3 + Number(spent) + Number(nextState !== null)) throw new Error('The Daily erasure transaction returned an invalid result.');
      } finally { if (!closed) await tx.unwatch(); }
    }
  }
}
