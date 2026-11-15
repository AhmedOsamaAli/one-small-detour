import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isRecord, isScoreRecord } from '../shared/validation.ts';
import { scoreField } from '../server/service.ts';
import type { ScoreStore } from '../server/service.ts';
import type { ScoreRecord } from '../shared/types.ts';

type Records = Record<string, ScoreRecord[]>;

export class LocalScoreStore implements ScoreStore {
  private queue: Promise<void> = Promise.resolve();
  private readonly file: string;
  constructor(file: string) { this.file = file; }

  private async read(): Promise<Records> {
    let text: string;
    try {
      text = await readFile(this.file, 'utf8');
    } catch (error) {
      if (isRecord(error) && error['code'] === 'ENOENT') return {};
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
    return records;
  }

  private update(change: (records: Records) => void): Promise<void> {
    const task = this.queue.then(async () => {
      const entries = await this.read();
      change(entries);
      await mkdir(dirname(this.file), { recursive: true });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify({ version: 1, entries }), 'utf8');
      await rename(temporary, this.file);
    });
    this.queue = task.then(
      () => undefined,
      (error: unknown) => { console.error('Local score archive update failed:', error); },
    );
    return task;
  }

  async list(key: string): Promise<ScoreRecord[]> {
    await this.queue;
    return (await this.read())[key] ?? [];
  }

  put(key: string, record: ScoreRecord): Promise<void> {
    return this.update((records) => {
      const current = records[key] ?? [];
      records[key] = [...current.filter((item) => scoreField(item) !== scoreField(record)), record];
    });
  }

  erase(userId: string): Promise<void> {
    return this.update((records) => {
      for (const key of Object.keys(records)) {
        const remaining = records[key]?.filter((record) => record.userId !== userId) ?? [];
        if (remaining.length) records[key] = remaining;
        else delete records[key];
      }
    });
  }
}
