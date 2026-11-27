import { isRecord } from './validation.ts';

export interface DailyReminderPreference {
  time: string;
  timeZone: string;
}

export interface ReminderDelivery {
  edition: string;
  status: 'attempted' | 'sent' | 'failed' | 'skipped';
}

export interface DailyReminderSettings {
  generation: number;
  preference: DailyReminderPreference | null;
  nextAt: string | null;
  lastDelivery: ReminderDelivery | null;
  source: 'local' | 'reddit';
}

export function isDailyReminderPreference(value: unknown): value is DailyReminderPreference {
  if (!isRecord(value) || typeof value['time'] !== 'string' ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value['time']) ||
      typeof value['timeZone'] !== 'string' || value['timeZone'].length === 0 ||
      value['timeZone'].length > 80 || value['timeZone'].trim() !== value['timeZone']) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value['timeZone'] });
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

export function isReminderDelivery(value: unknown): value is ReminderDelivery {
  if (!isRecord(value) || typeof value['edition'] !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value['edition'])) return false;
  const date = new Date(`${value['edition']}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value['edition'] &&
    (value['status'] === 'attempted' || value['status'] === 'sent' ||
      value['status'] === 'failed' || value['status'] === 'skipped');
}

export function isDailyReminderSettings(value: unknown): value is DailyReminderSettings {
  if (!isRecord(value) || (value['source'] !== 'local' && value['source'] !== 'reddit') ||
      typeof value['generation'] !== 'number' || !Number.isSafeInteger(value['generation']) || value['generation'] < 0) return false;
  if (value['preference'] === null) return value['nextAt'] === null && value['lastDelivery'] === null;
  return isDailyReminderPreference(value['preference']) && typeof value['nextAt'] === 'string' &&
    Number.isFinite(Date.parse(value['nextAt'])) &&
    (value['lastDelivery'] === null || isReminderDelivery(value['lastDelivery']));
}
