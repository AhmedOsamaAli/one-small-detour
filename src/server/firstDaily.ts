import { firstDailyResultOnly, TIMED_SCORE_VERSION } from '../shared/timing.ts';
import type { SavedRepair, ScoreRecord } from '../shared/types.ts';
import { isRecord, isScoreRecord } from '../shared/validation.ts';

export type FirstDailyStatus = 'eligible' | 'replay' | 'removed';
export type FirstDailyLock = { removed: true } | { record: ScoreRecord; solveId: string | null };
export interface DailyWrite { ranking: NonNullable<SavedRepair['ranking']> }

export function firstDailyKey(key: string): boolean {
  const date = new RegExp(`^detour:${TIMED_SCORE_VERSION}:(\\d{4}-\\d{2}-\\d{2}):daily$`).exec(key)?.[1];
  return date !== undefined && firstDailyResultOnly(date);
}

export function isFirstDailyLock(value: unknown): value is FirstDailyLock {
  return isRecord(value) && (value['removed'] === true ||
    (value['removed'] === undefined && isScoreRecord(value['record']) && value['record'].solveMs !== undefined &&
      (value['solveId'] === null || (typeof value['solveId'] === 'string' && /^[a-f0-9-]{36}$/i.test(value['solveId'])))));
}

export function firstDailyLock(text: string | undefined, userId: string): FirstDailyLock | null {
  if (text === undefined) return null;
  const value: unknown = JSON.parse(text);
  if (!isFirstDailyLock(value) || (!('removed' in value) && value.record.userId !== userId)) {
    throw new Error('The saved first Daily result is invalid.');
  }
  return value;
}

export function chooseFirstDaily(previous: FirstDailyLock | null, baseline: ScoreRecord | null,
  incoming: ScoreRecord, solveId: string | null): { lock: FirstDailyLock; record: ScoreRecord | null } & DailyWrite {
  if (!isScoreRecord(incoming) || incoming.solveMs === undefined ||
      (baseline !== null && (!isScoreRecord(baseline) || baseline.solveMs === undefined))) {
    throw new Error('A first Daily result needs valid exchanges and server timing.');
  }
  if (previous && 'removed' in previous) return { lock: previous, record: null, ranking: 'removed' };
  const selected = baseline ?? incoming;
  const solveMs = selected.solveMs;
  if (solveMs === undefined) throw new Error('The first Daily result has no server timing.');
  const lock = previous ?? { record: {
    userId: selected.userId, name: selected.name, footprint: selected.footprint, swaps: selected.swaps,
    submittedAt: selected.submittedAt, solveMs,
  }, solveId: baseline ? null : solveId };
  const retry = previous !== null && lock.solveId !== null && lock.solveId === solveId &&
    lock.record.swaps === incoming.swaps && lock.record.solveMs === incoming.solveMs;
  return { lock, record: lock.record, ranking: previous ? retry ? 'recorded' : 'replay' : baseline ? 'replay' : 'recorded' };
}
