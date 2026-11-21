import { getCatalog } from '../shared/puzzles.ts';
import { emptyPracticeSnapshot, isPracticeSnapshot, mergePracticeState, normalizePracticeState } from '../shared/practiceProgress.ts';
import type { PracticeSnapshot, PracticeState } from '../shared/practiceProgress.ts';
import { RuleError } from '../shared/rules.ts';
import type { RankRedis } from './indexedRanking.ts';

export interface PracticeStore {
  read(userId: string): Promise<PracticeSnapshot>;
  merge(userId: string, generation: number, state: PracticeState): Promise<PracticeSnapshot>;
  erase(userId: string): Promise<PracticeSnapshot>;
}

export function mergedPractice(previous: PracticeSnapshot, generation: number, state: PracticeState): PracticeSnapshot {
  if (previous.generation !== generation) {
    throw new RuleError('Practice progress was cleared on another device. Refresh your saved progress before continuing.', 'practice_reset');
  }
  const merged = mergePracticeState(getCatalog(3), previous, state);
  const changed = JSON.stringify({ completed: previous.completed, practice: previous.practice }) !== JSON.stringify(merged);
  if (changed && previous.revision === Number.MAX_SAFE_INTEGER) throw new Error('The saved Practice revision reached its limit.');
  return { ...merged, generation, revision: previous.revision + Number(changed) };
}

export class MemoryPracticeStore implements PracticeStore {
  private readonly entries = new Map<string, PracticeSnapshot>();

  constructor(entries: Record<string, PracticeSnapshot> = {}) {
    for (const [id, value] of Object.entries(entries)) {
      if (!isPracticeSnapshot(value)) throw new Error('The local Practice archive is invalid.');
      normalizePracticeState(getCatalog(3), value);
      this.entries.set(id, structuredClone(value));
    }
  }

  snapshot(): Record<string, PracticeSnapshot> { return Object.fromEntries(structuredClone(this.entries)); }

  async read(id: string): Promise<PracticeSnapshot> { return structuredClone(this.entries.get(id) ?? emptyPracticeSnapshot()); }

  async merge(id: string, generation: number, state: PracticeState): Promise<PracticeSnapshot> {
    const next = mergedPractice(this.entries.get(id) ?? emptyPracticeSnapshot(), generation, state);
    this.entries.set(id, next);
    return structuredClone(next);
  }

  async erase(id: string): Promise<PracticeSnapshot> {
    const previous = this.entries.get(id) ?? emptyPracticeSnapshot();
    const next = emptyPracticeSnapshot(previous.generation + 1);
    this.entries.set(id, next);
    return structuredClone(next);
  }
}

const keyFor = (id: string): string => `detour:practice-progress:1:${id}`;

export class RedisPracticeStore implements PracticeStore {
  private readonly redis: Pick<RankRedis, 'get' | 'watch'>;
  constructor(redis: Pick<RankRedis, 'get' | 'watch'>) { this.redis = redis; }

  private parse(text: string | undefined): PracticeSnapshot {
    if (text === undefined) return emptyPracticeSnapshot();
    const value: unknown = JSON.parse(text);
    if (!isPracticeSnapshot(value)) throw new Error('The saved Practice archive is invalid. It was not overwritten.');
    normalizePracticeState(getCatalog(3), value);
    return value;
  }

  async read(id: string): Promise<PracticeSnapshot> { return this.parse(await this.redis.get(keyFor(id))); }

  private async update(id: string, change: (previous: PracticeSnapshot) => PracticeSnapshot): Promise<PracticeSnapshot> {
    const key = keyFor(id);
    for (let retry = 0; retry < 4; retry++) {
      const tx = await this.redis.watch(key);
      let closed = false;
      try {
        const next = change(this.parse(await this.redis.get(key)));
        await tx.multi();
        await tx.set(key, JSON.stringify(next));
        closed = true;
        const result = await tx.exec();
        if (result === null || result.length === 0 || (result.length === 1 && result[0] === null)) continue;
        if (result.length !== 1) throw new Error('The Practice save transaction returned an invalid result.');
        return next;
      } finally { if (!closed) await tx.unwatch(); }
    }
    throw new RuleError('Your Practice progress changed during saving. Your local progress is safe; please retry sync.', 'practice_busy');
  }

  merge(id: string, generation: number, state: PracticeState): Promise<PracticeSnapshot> {
    return this.update(id, (previous) => mergedPractice(previous, generation, state));
  }

  erase(id: string): Promise<PracticeSnapshot> {
    return this.update(id, (previous) => {
      if (previous.generation === Number.MAX_SAFE_INTEGER) throw new Error('The Practice reset generation reached its limit.');
      return emptyPracticeSnapshot(previous.generation + 1);
    });
  }
}
