import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isRecord, isScoreRecord } from '../shared/validation.ts';
import { rankScores, scoreField } from '../server/service.ts';
import type { ScoreStore } from '../server/service.ts';
import type { ScoreRecord } from '../shared/types.ts';
import { chooseFirstDaily, firstDailyKey, isFirstDailyLock } from '../server/firstDaily.ts';
import type { DailyWrite, FirstDailyLock, FirstDailyStatus } from '../server/firstDaily.ts';

type Records = Record<string, ScoreRecord[]>;
interface Archive { entries: Records; firstDaily: Record<string, Record<string, FirstDailyLock>> }

export class LocalScoreStore implements ScoreStore {
  private queue: Promise<void> = Promise.resolve();
  private readonly file: string;
  constructor(file: string) { this.file = file; }

  private async read(): Promise<Archive> {
    let text: string;
    try {
      text = await readFile(this.file, 'utf8');
    } catch (error) {
      if (isRecord(error) && error['code'] === 'ENOENT') return { entries: {}, firstDaily: {} };
      throw error;
    }
    const data: unknown = JSON.parse(text);
    if (!isRecord(data) || data['version'] !== 1 || !isRecord(data['entries'])) {
      throw new Error('The local score archive has an invalid format. It was not overwritten.');
    }
    const records: Records = {};
    for (const [key, values] of Object.entries(data['entries'])) {
      if (!Array.isArray(values) || !values.every(isScoreRecord)) {
        throw new Error('The local score archive contains an invalid entry. It was not overwritten.');
      }
      if (Date.now() - Date.parse(key.split(':')[2] ?? '') <= 30 * 86_400_000) records[key] = values;
    }
    const firstDaily: Archive['firstDaily'] = {};
    if (data['firstDaily'] !== undefined) {
      if (!isRecord(data['firstDaily'])) throw new Error('The local first-result archive is invalid. It was not overwritten.');
      for (const [key, values] of Object.entries(data['firstDaily'])) {
        if (!firstDailyKey(key) || !isRecord(values)) throw new Error('The local first-result edition is invalid.');
        const locks: Record<string, FirstDailyLock> = {};
        for (const [id, value] of Object.entries(values)) {
          if (!isFirstDailyLock(value) || (!('removed' in value) && value.record.userId !== id)) {
            throw new Error('The local first Daily result is invalid. It was not overwritten.');
          }
          locks[id] = value;
        }
        if (Date.now() - Date.parse(key.split(':')[2] ?? '') <= 30 * 86_400_000) firstDaily[key] = locks;
      }
    }
    return { entries: records, firstDaily };
  }

  private update<T>(change: (archive: Archive) => T): Promise<T> {
    const task = this.queue.then(async () => {
      const archive = await this.read();
      const result = change(archive);
      await mkdir(dirname(this.file), { recursive: true });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify({ version: 1, ...archive }), 'utf8');
      await rename(temporary, this.file);
      return result;
    });
    this.queue = task.then(
      () => undefined,
      (error: unknown) => { console.error('Local score archive update failed:', error); },
    );
    return task;
  }

  async list(key: string): Promise<ScoreRecord[]> {
    await this.queue;
    return (await this.read()).entries[key] ?? [];
  }

  async firstStatus(key: string, userId: string): Promise<FirstDailyStatus> {
    await this.queue;
    const archive = await this.read();
    const lock = archive.firstDaily[key]?.[userId];
    if (lock) return 'removed' in lock ? 'removed' : 'replay';
    return (archive.entries[key] ?? []).some((record) => record.userId === userId) ? 'replay' : 'eligible';
  }

  put(key: string, record: ScoreRecord, solveId?: string): Promise<DailyWrite | void> {
    return this.update((archive) => {
      const current = archive.entries[key] ?? [];
      if (firstDailyKey(key)) {
        const own = rankScores(current, record.userId, 'local').yourBest;
        const choice = chooseFirstDaily(archive.firstDaily[key]?.[record.userId] ?? null, own, record, solveId ?? null);
        const locks = archive.firstDaily[key] ?? {};
        locks[record.userId] = choice.lock;
        archive.firstDaily[key] = locks;
        if (choice.record) archive.entries[key] = [...current.filter((item) => item.userId !== record.userId), choice.record];
        return { ranking: choice.ranking };
      }
      archive.entries[key] = [...current.filter((item) => scoreField(item) !== scoreField(record)), record];
    });
  }

  erase(userId: string): Promise<void> {
    return this.update(({ entries: records, firstDaily }) => {
      for (const key of Object.keys(records)) {
        if (firstDailyKey(key) && records[key]?.some((record) => record.userId === userId)) {
          const locks = firstDaily[key] ?? {};
          locks[userId] = { removed: true };
          firstDaily[key] = locks;
        }
        const remaining = records[key]?.filter((record) => record.userId !== userId) ?? [];
        if (remaining.length) records[key] = remaining;
        else delete records[key];
      }
      for (const locks of Object.values(firstDaily)) if (locks[userId]) locks[userId] = { removed: true };
    });
  }
}
