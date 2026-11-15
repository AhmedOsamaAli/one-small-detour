import { performance } from 'node:perf_hooks';
import { IndexedDailyRanking, dailyRankScore } from './indexedRanking.ts';
import type { RankRedis, RankTransaction } from './indexedRanking.ts';
import type { ScoreRecord } from '../shared/types.ts';

type Range = Parameters<RankRedis['zRange']>[3];
type Options = Parameters<RankRedis['set']>[2];
interface Member { member: string; score: number }

export class RankingFixture implements RankRedis {
  readonly strings = new Map<string, string>();
  readonly legacy = new Map<string, Map<string, string>>();
  readonly sets = new Map<string, Map<string, number>>();
  readonly registered = new Map<string, Set<string>>();
  readonly calls: Record<string, number> = {};
  readonly expirations = new Map<string, number>();
  readonly versions = new Map<string, number>();
  readonly ordered = new Map<string, { members: Member[]; positions: Map<string, number> }>();
  beforeExec: (() => void) | null = null;
  now = Date.parse('2026-11-15T12:00:00Z');

  count(name: string): void { this.calls[name] = (this.calls[name] ?? 0) + 1; }
  touch(key: string): void { this.versions.set(key, (this.versions.get(key) ?? 0) + 1); this.ordered.delete(key); }
  rawSet(key: string, value: string, options?: Options): string {
    this.strings.set(key, value);
    if (options?.expiration) this.expirations.set(key, options.expiration.getTime());
    this.touch(key);
    return 'OK';
  }
  rawDel(keys: string[]): number {
    for (const key of keys) { this.strings.delete(key); this.sets.delete(key); this.touch(key); }
    return keys.length;
  }
  rawAdd(key: string, members: Member[]): number {
    const set = this.sets.get(key) ?? new Map<string, number>();
    for (const { member, score } of members) set.set(member, score);
    this.sets.set(key, set); this.touch(key); return members.length;
  }
  rawRemove(key: string, members: string[]): number {
    let removed = 0;
    for (const member of members) if (this.sets.get(key)?.delete(member)) removed++;
    this.touch(key); return removed;
  }
  order(key: string) {
    let ordered = this.ordered.get(key);
    if (!ordered) {
      const members = [...(this.sets.get(key) ?? [])].map(([member, score]) => ({ member, score }))
        .sort((a, b) => a.score - b.score || a.member.localeCompare(b.member));
      ordered = { members, positions: new Map(members.map(({ member }, index) => [member, index])) };
      this.ordered.set(key, ordered);
    }
    return ordered;
  }
  rawRange(key: string, start: number, stop: number, options: Range): Member[] {
    const values = this.order(key).members;
    let result: Member[];
    if (options.by === 'score') {
      const bound = (score: number, exclusive: boolean): number => {
        let low = 0, high = values.length;
        while (low < high) {
          const middle = Math.floor((low + high) / 2), value = values[middle]?.score;
          if (value === undefined) throw new Error('The benchmark index lost a member.');
          if (value < score || (exclusive && value === score)) low = middle + 1;
          else high = middle;
        }
        return low;
      };
      result = values.slice(bound(start, false), bound(stop, true));
    } else result = values.slice(start, stop < 0 ? undefined : stop + 1);
    if (options.reverse) result = [...result].reverse();
    return options.limit ? result.slice(options.limit.offset, options.limit.offset + options.limit.count) : result;
  }
  async get(key: string): Promise<string | undefined> { this.count('get'); return this.strings.get(key); }
  async mGet(keys: string[]): Promise<(string | null)[]> { this.count('mGet'); return keys.map((key) => this.strings.get(key) ?? null); }
  async set(key: string, value: string, options?: Options): Promise<string> { this.count('set'); return this.rawSet(key, value, options); }
  async zAdd(key: string, ...members: Member[]): Promise<number> { this.count('zAdd'); return this.rawAdd(key, members); }
  async zCard(key: string): Promise<number> { this.count('zCard'); return this.sets.get(key)?.size ?? 0; }
  async zRange(key: string, start: number, stop: number, options: Range): Promise<Member[]> { this.count('zRange'); return this.rawRange(key, start, stop, options); }
  async expire(key: string, seconds: number): Promise<void> { this.count('expire'); this.expirations.set(key, this.now + seconds * 1000); }
  async hScan(key: string, cursor: number): Promise<{ cursor: number; fieldValues: { field: string; value: string }[] }> {
    this.count('hScan');
    return { cursor: 0, fieldValues: [...(this.legacy.get(key) ?? [])].slice(cursor).map(([field, value]) => ({ field, value })) };
  }
  async watch(...keys: string[]): Promise<RankTransaction> {
    this.count('watch');
    const versions = keys.map((key) => this.versions.get(key) ?? 0);
    const commands: (() => unknown)[] = [];
    const queue = (name: string, command: () => unknown): Promise<unknown> => {
      this.count(name); commands.push(command); return Promise.resolve();
    };
    return {
      multi: async () => { this.count('multi'); },
      unwatch: async () => { this.count('unwatch'); },
      exec: async () => {
        this.count('exec'); this.beforeExec?.();
        if (keys.some((key, index) => (this.versions.get(key) ?? 0) !== versions[index])) return null;
        return commands.map((command) => command());
      },
      set: (key, value, options) => queue('set', () => this.rawSet(key, value, options)),
      del: (...keys) => queue('del', () => this.rawDel(keys)),
      expire: (key, seconds) => queue('expire', () => { this.expirations.set(key, this.now + seconds * 1000); return 1; }),
      zAdd: (key, ...members) => queue('zAdd', () => this.rawAdd(key, members)),
      zRem: (key, members) => queue('zRem', () => this.rawRemove(key, members)),
      zCard: (key) => queue('zCard', () => this.sets.get(key)?.size ?? 0),
      zRank: (key, member) => queue('zRank', () => this.order(key).positions.get(member) ?? null),
      zScore: (key, member) => queue('zScore', () => this.sets.get(key)?.get(member) ?? null),
      zRange: (key, start, stop, options) => queue('zRange', () => ({ members: this.rawRange(key, start, stop, options) })),
    };
  }
  create(options: { accountExists?: (id: string) => Promise<boolean> } = {}): IndexedDailyRanking {
    return new IndexedDailyRanking(this, {
      now: () => this.now,
      remember: async (key, id) => {
        const keys = this.registered.get(id) ?? new Set<string>(); keys.add(key); this.registered.set(id, keys);
      },
      keys: async (id) => [...(this.registered.get(id) ?? [])],
      ...options,
    });
  }
  seed(key: string, records: readonly ScoreRecord[]): void {
    const index = `${key}:rank-index:1`;
    this.strings.set(`${index}:state`, 'ready');
    for (const record of records) {
      this.strings.set(`${index}:best:${record.userId}`, JSON.stringify(record));
      const set = this.sets.get(index) ?? new Map<string, number>();
      set.set(record.userId, dailyRankScore(record)); this.sets.set(index, set);
      this.registered.set(record.userId, new Set([key]));
    }
    this.order(index);
  }
}

if (process.argv.includes('--benchmark')) {
  const key = 'detour:5:2026-11-15:daily';
  const rows = [];
  for (const players of [1_000, 10_000, 100_000]) {
    const fixture = new RankingFixture();
    const records = Array.from({ length: players }, (_, index): ScoreRecord => ({
      userId: `p${String(index).padStart(6, '0')}`, name: 'Synthetic player', swaps: 3 + index % 20,
      footprint: (3 + index % 20) * 4, solveMs: index % 100 * 1000, submittedAt: '2026-11-15T12:00:00Z',
    }));
    fixture.seed(key, records);
    const ranking = fixture.create();
    const times: number[] = [];
    for (let sample = 0; sample < 100; sample++) {
      const began = performance.now();
      await ranking.read(key, records[(sample * 997) % players]?.userId ?? null);
      times.push(performance.now() - began);
    }
    const sorted = times.sort((a, b) => a - b);
    rows.push({
      players, samples: times.length, commandsPerRead: Object.values(fixture.calls).reduce((a, b) => a + b, 0) / times.length,
      hScans: fixture.calls['hScan'] ?? 0, p50HarnessMs: sorted[50], p95HarnessMs: sorted[95],
      serializedBestBytes: Buffer.byteLength(JSON.stringify(records[0])),
    });
  }
  console.log(JSON.stringify({
    note: 'In-memory indexed-adapter algorithm/call-count benchmark, NOT Redis or hosted Reddit throughput. The mock prebuilds its sorted index. No real accounts or live records are used.',
    rows,
  }, null, 2));
}
