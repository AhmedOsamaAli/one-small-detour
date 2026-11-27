import { randomUUID } from 'node:crypto';
import { isDailyReminderPreference, isReminderDelivery } from '../shared/reminders.ts';
import type { DailyReminderPreference, DailyReminderSettings, ReminderDelivery } from '../shared/reminders.ts';
import { RuleError } from '../shared/rules.ts';
import { isRecord } from '../shared/validation.ts';
import type { RankRedis } from './indexedRanking.ts';

const DAY_MS = 86_400_000;
const GRACE_MS = 60 * 60_000;
const BATCH_SIZE = 20;
const dueKey = 'detour:daily-reminders:1:due';
const subscriptionKey = (id: string): string => `detour:daily-reminder:1:${id}`;
const deliveryKey = (id: string, edition: string): string => `${subscriptionKey(id)}:delivery:${edition}`;
const generationKey = (id: string): string => `${subscriptionKey(id)}:generation`;

export interface ReminderSubscription {
  preference: DailyReminderPreference;
  postId: string | null;
  nextAt: number;
  revision: string;
}

export interface ReminderStore {
  generation(id: string): Promise<number>;
  read(id: string): Promise<ReminderSubscription | null>;
  save(id: string, preference: DailyReminderPreference, postId: string | null, now: Date, generation: number): Promise<void>;
  erase(id: string): Promise<void>;
  due(now: Date): Promise<string[]>;
  claim(id: string, revision: string, now: Date, shouldSend: boolean): Promise<boolean>;
  delivery(id: string, edition: string): Promise<ReminderDelivery | null>;
  finish(id: string, edition: string, status: 'sent' | 'failed' | 'skipped'): Promise<void>;
}

export function nextDailyReminderAt(preference: DailyReminderPreference, after: Date): Date {
  if (!isDailyReminderPreference(preference) || !Number.isFinite(after.getTime())) {
    throw new RuleError('Choose a valid reminder time and timezone.', 'reminder_invalid');
  }
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: preference.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const wallTime = (instant: number): number => {
    const parts = formatter.formatToParts(instant);
    const number = (type: Intl.DateTimeFormatPartTypes): number => {
      const value = Number(parts.find(part => part.type === type)?.value);
      if (!Number.isInteger(value)) throw new Error('The reminder timezone could not be read.');
      return value;
    };
    return Date.UTC(number('year'), number('month') - 1, number('day'), number('hour'), number('minute'));
  };
  const localDay = Math.floor(wallTime(after.getTime()) / DAY_MS) * DAY_MS;
  const minutes = Number(preference.time.slice(0, 2)) * 60 + Number(preference.time.slice(3));
  for (let day = 0; day < 3; day++) {
    const target = localDay + day * DAY_MS + minutes * 60_000;
    const offsets = new Set([-36, 0, 36].map(hours => {
      const probe = target + hours * 3_600_000;
      return wallTime(probe) - probe;
    }));
    // A missing DST time moves forward by the gap; repeated times use the first future occurrence.
    const candidates = [...offsets].map(offset => target - offset).filter(instant =>
      instant > after.getTime() && Math.floor(wallTime(instant) / DAY_MS) === Math.floor(target / DAY_MS) &&
      wallTime(instant) >= target);
    if (candidates.length) return new Date(Math.min(...candidates));
  }
  throw new Error('The next reminder time could not be scheduled.');
}

function subscription(preference: DailyReminderPreference, postId: string | null, now: Date): ReminderSubscription {
  if (postId !== null && !/^t3_[a-z0-9]+$/i.test(postId)) throw new Error('The reminder game post is invalid.');
  return { preference: { ...preference }, postId, nextAt: nextDailyReminderAt(preference, now).getTime(), revision: randomUUID() };
}

interface ReminderChange<T> {
  generation?: number;
  subscription?: ReminderSubscription | null;
  delivery?: ReminderDelivery;
  result: T;
}

function claimChange(previous: ReminderSubscription | null, revision: string, delivery: ReminderDelivery | null,
  now: Date, shouldSend: boolean): ReminderChange<boolean> {
  if (!previous || previous.revision !== revision || previous.nextAt > now.getTime()) return { result: false };
  return {
    subscription: { ...previous, nextAt: nextDailyReminderAt(previous.preference, now).getTime() },
    ...(delivery ? {} : { delivery: { edition: now.toISOString().slice(0, 10), status: shouldSend ? 'attempted' : 'skipped' } }),
    result: shouldSend && delivery === null,
  };
}

function finishedDelivery(delivery: ReminderDelivery | null, status: 'sent' | 'failed' | 'skipped'): ReminderDelivery {
  if (!delivery || delivery.status !== 'attempted') throw new Error('The reminder delivery reservation is missing.');
  return { ...delivery, status };
}

export async function dailyReminderSettings(store: ReminderStore, id: string, source: 'local' | 'reddit',
  now: Date): Promise<DailyReminderSettings> {
  for (let retry = 0; retry < 4; retry++) {
    const generation = await store.generation(id);
    const saved = await store.read(id);
    const lastDelivery = saved ? await store.delivery(id, now.toISOString().slice(0, 10)) : null;
    if (generation !== await store.generation(id)) continue;
    return saved ? {
      generation, preference: saved.preference, nextAt: new Date(saved.nextAt).toISOString(), lastDelivery, source,
    } : { generation, preference: null, nextAt: null, lastDelivery: null, source };
  }
  throw new RuleError('Your reminder changed while checking it. Please check again.', 'reminder_busy');
}

function checkGeneration(expected: number, current: number): void {
  if (!Number.isSafeInteger(expected) || expected < 0) throw new RuleError('Check your current reminder before saving it.', 'reminder_invalid');
  if (expected !== current) throw new RuleError('Your reminder was turned off or cleared. Check again before enabling it.', 'reminder_reset');
}

function nextGeneration(current: number): number {
  if (current === Number.MAX_SAFE_INTEGER) throw new Error('The reminder reset generation reached its limit.');
  return current + 1;
}

export class MemoryReminderStore implements ReminderStore {
  private readonly generations = new Map<string, number>();
  private readonly subscriptions = new Map<string, ReminderSubscription>();
  private readonly deliveries = new Map<string, ReminderDelivery>();

  async generation(id: string): Promise<number> { return this.generations.get(id) ?? 0; }
  async read(id: string): Promise<ReminderSubscription | null> {
    return structuredClone(this.subscriptions.get(id) ?? null);
  }
  async save(id: string, preference: DailyReminderPreference, postId: string | null, now: Date, generation: number): Promise<void> {
    checkGeneration(generation, this.generations.get(id) ?? 0);
    this.subscriptions.set(id, subscription(preference, postId, now));
  }
  async erase(id: string): Promise<void> {
    this.generations.set(id, nextGeneration(this.generations.get(id) ?? 0));
    this.subscriptions.delete(id);
  }
  async due(now: Date): Promise<string[]> {
    return [...this.subscriptions].filter(([, value]) => value.nextAt <= now.getTime())
      .sort((a, b) => a[1].nextAt - b[1].nextAt || a[0].localeCompare(b[0])).slice(0, BATCH_SIZE).map(([id]) => id);
  }
  async claim(id: string, revision: string, now: Date, shouldSend: boolean): Promise<boolean> {
    for (const [key, value] of this.deliveries) {
      if (Date.parse(`${value.edition}T00:00:00Z`) + 2 * DAY_MS <= now.getTime()) this.deliveries.delete(key);
    }
    const key = deliveryKey(id, now.toISOString().slice(0, 10));
    const change = claimChange(this.subscriptions.get(id) ?? null, revision, this.deliveries.get(key) ?? null, now, shouldSend);
    if (change.subscription) this.subscriptions.set(id, change.subscription);
    if (change.delivery) this.deliveries.set(key, change.delivery);
    return change.result;
  }
  async delivery(id: string, edition: string): Promise<ReminderDelivery | null> {
    return structuredClone(this.deliveries.get(deliveryKey(id, edition)) ?? null);
  }
  async finish(id: string, edition: string, status: 'sent' | 'failed' | 'skipped'): Promise<void> {
    const key = deliveryKey(id, edition);
    this.deliveries.set(key, finishedDelivery(this.deliveries.get(key) ?? null, status));
  }
}

export class RedisReminderStore implements ReminderStore {
  private readonly redis: Pick<RankRedis, 'get' | 'watch' | 'zRange'>;
  constructor(redis: Pick<RankRedis, 'get' | 'watch' | 'zRange'>) { this.redis = redis; }

  private parse(text: string | undefined): ReminderSubscription | null {
    if (text === undefined) return null;
    const value: unknown = JSON.parse(text);
    if (!isRecord(value) || !isDailyReminderPreference(value['preference']) ||
        (value['postId'] !== null && (typeof value['postId'] !== 'string' || !/^t3_[a-z0-9]+$/i.test(value['postId']))) ||
        typeof value['nextAt'] !== 'number' || !Number.isSafeInteger(value['nextAt']) ||
        !Number.isFinite(new Date(value['nextAt']).getTime()) ||
        typeof value['revision'] !== 'string' || !/^[a-f0-9-]{36}$/i.test(value['revision'])) {
      throw new Error('The saved reminder is invalid. It was not overwritten.');
    }
    return { preference: value['preference'], postId: value['postId'], nextAt: value['nextAt'], revision: value['revision'] };
  }
  private parseDelivery(text: string | undefined, edition: string): ReminderDelivery | null {
    if (text === undefined) return null;
    const value: unknown = JSON.parse(text);
    if (!isReminderDelivery(value) || value.edition !== edition) throw new Error('The reminder delivery record is invalid.');
    return value;
  }
  private parseGeneration(text: string | undefined): number {
    if (text === undefined) return 0;
    const value = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < 0) throw new Error('The reminder reset generation is invalid.');
    return value;
  }
  async generation(id: string): Promise<number> { return this.parseGeneration(await this.redis.get(generationKey(id))); }
  async read(id: string): Promise<ReminderSubscription | null> { return this.parse(await this.redis.get(subscriptionKey(id))); }
  async delivery(id: string, edition: string): Promise<ReminderDelivery | null> {
    return this.parseDelivery(await this.redis.get(deliveryKey(id, edition)), edition);
  }

  private async update<T>(id: string, edition: string,
    change: (previous: ReminderSubscription | null, delivery: ReminderDelivery | null, generation: number) => ReminderChange<T>): Promise<T> {
    const key = subscriptionKey(id), marker = deliveryKey(id, edition), resetKey = generationKey(id);
    for (let retry = 0; retry < 4; retry++) {
      const tx = await this.redis.watch(key, marker, resetKey);
      let closed = false;
      try {
        const [text, delivered, generation] = await Promise.all([this.redis.get(key), this.redis.get(marker), this.redis.get(resetKey)]);
        const next = change(this.parse(text), this.parseDelivery(delivered, edition), this.parseGeneration(generation));
        if (next.subscription === undefined && next.delivery === undefined && next.generation === undefined) return next.result;
        await tx.multi();
        let commands = 0;
        if (next.generation !== undefined) {
          await tx.set(resetKey, String(next.generation));
          commands++;
        }
        if (next.subscription !== undefined) {
          if (next.subscription) {
            await tx.set(key, JSON.stringify(next.subscription));
            await tx.zAdd(dueKey, { member: id, score: next.subscription.nextAt });
          } else {
            await tx.del(key);
            await tx.zRem(dueKey, [id]);
          }
          commands += 2;
        }
        if (next.delivery) {
          await tx.set(marker, JSON.stringify(next.delivery), {
            expiration: new Date(Date.parse(`${edition}T00:00:00Z`) + 2 * DAY_MS),
          });
          commands++;
        }
        closed = true;
        const result = await tx.exec();
        if (result === null || result.length === 0 || (result.length === 1 && result[0] === null)) continue;
        if (result.length !== commands) throw new Error('The reminder transaction returned an invalid result.');
        return next.result;
      } finally { if (!closed) await tx.unwatch(); }
    }
    throw new RuleError('Your reminder changed while saving. Please retry your choice.', 'reminder_busy');
  }

  async save(id: string, preference: DailyReminderPreference, postId: string | null, now: Date, generation: number): Promise<void> {
    const saved = subscription(preference, postId, now);
    await this.update(id, now.toISOString().slice(0, 10), (_previous, _delivery, current) => {
      checkGeneration(generation, current);
      return { subscription: saved, result: undefined };
    });
  }
  async erase(id: string): Promise<void> {
    await this.update(id, new Date().toISOString().slice(0, 10), (_previous, _delivery, generation) => ({
      generation: nextGeneration(generation), subscription: null, result: undefined,
    }));
  }
  async due(now: Date): Promise<string[]> {
    return (await this.redis.zRange(dueKey, 0, now.getTime(), {
      by: 'score', limit: { offset: 0, count: BATCH_SIZE },
    })).map(({ member }) => member);
  }
  claim(id: string, revision: string, now: Date, shouldSend: boolean): Promise<boolean> {
    return this.update(id, now.toISOString().slice(0, 10), (previous, delivery) =>
      claimChange(previous, revision, delivery, now, shouldSend));
  }
  async finish(id: string, edition: string, status: 'sent' | 'failed' | 'skipped'): Promise<void> {
    await this.update(id, edition, (_previous, delivery) => ({
      delivery: finishedDelivery(delivery, status), result: undefined,
    }));
  }
}

interface DispatchOptions {
  store: ReminderStore;
  recipient: (id: string, edition: string) => Promise<{ name: string; completed: boolean } | null>;
  send: (name: string, postId: string, edition: string) => Promise<void>;
  now?: () => Date;
}

export async function dispatchDailyReminders(options: DispatchOptions): Promise<void> {
  const clock = options.now ?? (() => new Date());
  const due = await options.store.due(clock());
  const results = await Promise.allSettled(due.map(async id => {
    const saved = await options.store.read(id);
    if (!saved) { await options.store.erase(id);return; }
    const now = clock(), edition = now.toISOString().slice(0, 10);
    const missed = now.getTime() - saved.nextAt > GRACE_MS || new Date(saved.nextAt).toISOString().slice(0, 10) !== edition;
    if (missed) { await options.store.claim(id, saved.revision, now, false);return; }
    const recipient = await options.recipient(id, edition);
    if (!recipient) { await options.store.erase(id);return; }
    const claimTime = clock();
    if (claimTime.toISOString().slice(0, 10) !== edition) return;
    const inWindow = claimTime.getTime() - saved.nextAt <= GRACE_MS;
    if (!(await options.store.claim(id, saved.revision, claimTime, !recipient.completed && inWindow))) return;
    const current = await options.store.read(id);
    const sendTime = clock();
    if (!current || current.revision !== saved.revision || sendTime.toISOString().slice(0, 10) !== edition ||
        sendTime.getTime() - saved.nextAt > GRACE_MS) {
      await options.store.finish(id, edition, 'skipped');
      return;
    }
    // Reserve before the external send: an uncertain response must never produce a duplicate message.
    try {
      if (!saved.postId) throw new Error('An inbox reminder needs its original Reddit game post.');
      await options.send(recipient.name, saved.postId, edition);
    } catch (sendError) {
      try { await options.store.finish(id, edition, 'failed'); }
      catch (recordError) { throw new AggregateError([sendError, recordError], 'The reminder send and its failure record could not be confirmed.'); }
      throw sendError;
    }
    await options.store.finish(id, edition, 'sent');
  }));
  const errors: unknown[] = results.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
  for (const error of errors) console.error('A Daily inbox reminder could not be delivered:', error);
  if (errors.length) throw new AggregateError(errors, `${errors.length} Daily inbox reminder(s) failed.`);
}
