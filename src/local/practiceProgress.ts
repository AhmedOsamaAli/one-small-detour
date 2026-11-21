import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isRecord } from '../shared/validation.ts';
import { isPracticeSnapshot } from '../shared/practiceProgress.ts';
import type { PracticeSnapshot, PracticeState } from '../shared/practiceProgress.ts';
import { MemoryPracticeStore } from '../server/practiceProgress.ts';
import type { PracticeStore } from '../server/practiceProgress.ts';

export class LocalPracticeStore implements PracticeStore {
  private queue: Promise<void> = Promise.resolve();
  private readonly file: string;
  constructor(file: string) { this.file = file; }

  private async load(): Promise<MemoryPracticeStore> {
    let text: string;
    try { text = await readFile(this.file, 'utf8'); }
    catch (error) {
      if (isRecord(error) && error['code'] === 'ENOENT') return new MemoryPracticeStore();
      throw error;
    }
    const value: unknown = JSON.parse(text);
    if (!isRecord(value) || value['version'] !== 1 || !isRecord(value['players'])) {
      throw new Error('The local Practice archive is invalid. It was not overwritten.');
    }
    const entries: Record<string, PracticeSnapshot> = {};
    for (const [id, snapshot] of Object.entries(value['players'])) {
      if (!isPracticeSnapshot(snapshot)) throw new Error('A local Practice record is invalid. It was not overwritten.');
      entries[id] = snapshot;
    }
    return new MemoryPracticeStore(entries);
  }

  private run<T>(write: boolean, action: (store: MemoryPracticeStore) => Promise<T>): Promise<T> {
    const task = this.queue.then(async () => {
      const store = await this.load();
      const value = await action(store);
      if (write) {
        await mkdir(dirname(this.file), { recursive: true });
        const temporary = `${this.file}.${randomUUID()}.tmp`;
        await writeFile(temporary, JSON.stringify({ version: 1, players: store.snapshot() }), 'utf8');
        await rename(temporary, this.file);
      }
      return value;
    });
    this.queue = task.then(() => undefined, (error: unknown) => { console.error('Local Practice progress could not be saved:', error); });
    return task;
  }

  read(id: string): Promise<PracticeSnapshot> { return this.run(false, (store) => store.read(id)); }
  merge(id: string, generation: number, state: PracticeState): Promise<PracticeSnapshot> {
    return this.run(true, (store) => store.merge(id, generation, state));
  }
  erase(id: string): Promise<PracticeSnapshot> { return this.run(true, (store) => store.erase(id)); }
}
