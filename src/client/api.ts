import { isAttemptStart, isBootstrap, isLeaderboard, isMyRank, isPuzzle, isRecord, isSavedRepair } from '../shared/validation.ts';
import type { AttemptStart, Bootstrap, GuideTopic, Leaderboard, MyRank, Puzzle, RankedScore, SavedRepair, SubmitRepair } from '../shared/types.ts';
import { isGuideTopics } from '../shared/guidance.ts';
import { isPracticeAccount } from '../shared/practiceProgress.ts';
import type { PracticeAccount, PracticeState } from '../shared/practiceProgress.ts';
import { isDailyReminderSettings } from '../shared/reminders.ts';
import type { DailyReminderPreference, DailyReminderSettings } from '../shared/reminders.ts';

export class GameApiError extends Error {
  readonly code: string | null;
  constructor(message: string, code: string | null) { super(message); this.code = code; }
}

const ID_KEY = 'detour:local-player';
type TimedResult = RankedScore & { solveMs: number };
export type DailyLeaderboard = Omit<Leaderboard, 'entries' | 'yourBest'> & { entries: TimedResult[]; yourBest: TimedResult | null };

function isDailyLeaderboard(data: unknown): data is DailyLeaderboard {
  return isLeaderboard(data) && data.mode === 'daily' && data.entries.every((entry) => entry.solveMs !== undefined) &&
    (data.yourBest === null || data.yourBest.solveMs !== undefined);
}
let localId: string | null = null;
let storageNotice: string | null = null;

function playerId(): string {
  if (localId) return localId;
  try {
    const saved = localStorage.getItem(ID_KEY);
    if (saved && /^[a-f0-9-]{36}$/i.test(saved)) localId = saved;
    else {
      localId = crypto.randomUUID();
      localStorage.setItem(ID_KEY, localId);
    }
  } catch (error) {
    console.warn('Local player identity could not be saved:', error);
    localId = crypto.randomUUID();
    storageNotice = 'This browser is not saving local preferences. You can play, but progress may not survive a reload.';
  }
  return localId;
}

export function takeStorageNotice(): string | null {
  const notice = storageNotice;
  storageNotice = null;
  return notice;
}

async function request<T>(url: string, guard: (data: unknown) => data is T, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (import.meta.env.DEV) headers.set('X-Detour-Player', playerId());
  const response = await fetch(url, {
    ...options,
    headers,
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new GameApiError(isRecord(data) && typeof data['error'] === 'string' ? data['error'] : 'The village board could not be reached.',
      isRecord(data) && typeof data['code'] === 'string' ? data['code'] : null);
  }
  if (!guard(data)) throw new Error('The village sent an unreadable response. Please refresh and try again.');
  return data;
}

async function progressRequest(method: 'GET' | 'POST' | 'DELETE', body?: object): Promise<PracticeAccount> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    return await request('/api/me/progress?campaign=3', isPracticeAccount, {
      method, signal: controller.signal, ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Practice sync took too long. Your local stops are safe; retry when your connection is ready.');
    throw error;
  } finally { window.clearTimeout(timeout); }
}

const placeCache = new Map<string, Puzzle>();
const placeInFlight = new Map<string, Promise<Puzzle>>();

function fetchPlace(id: string): Promise<Puzzle> {
  const cached = placeCache.get(id);
  if (cached) return Promise.resolve(cached);
  const running = placeInFlight.get(id);
  if (running) return running;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  const promise = request(`/api/places/${encodeURIComponent(id)}?campaign=3`, isPuzzle, { signal: controller.signal })
    .then((puzzle) => {
      if (placeCache.size >= 40) {
        const oldest = placeCache.keys().next().value;
        if (oldest !== undefined) placeCache.delete(oldest);
      }
      placeCache.set(id, puzzle);
      return puzzle;
    })
    .catch((error: unknown) => {
      if (controller.signal.aborted) throw new Error('Opening this stop took too long. Your progress is safe; please try again.');
      throw error;
    })
    .finally(() => {
      window.clearTimeout(timeout);
      placeInFlight.delete(id);
    });
  placeInFlight.set(id, promise);
  return promise;
}

export const gameApi = {
  bootstrap: (): Promise<Bootstrap> => request('/api/bootstrap?campaign=3',
    (data): data is Bootstrap => isBootstrap(data) && data.campaignRevision === 3),
  place: (id: string): Promise<Puzzle> => fetchPlace(id),
  prefetchPlace: (id: string): void => {
    if (placeCache.has(id) || placeInFlight.has(id)) return;
    void fetchPlace(id).catch(() => { /* Prefetch is best-effort; explicit opens report errors. */ });
  },
  practiceProgress: (): Promise<PracticeAccount> => progressRequest('GET'),
  savePracticeProgress: (generation: number, state: PracticeState): Promise<PracticeAccount> => progressRequest('POST', { generation, ...state }),
  clearPracticeProgress: (): Promise<PracticeAccount> => progressRequest('DELETE'),
  dailyReminder: (signal?: AbortSignal): Promise<DailyReminderSettings> =>
    request('/api/me/reminder', isDailyReminderSettings, { cache: 'no-store', ...(signal ? { signal } : {}) }),
  saveDailyReminder: (preference: DailyReminderPreference, generation: number, signal?: AbortSignal): Promise<DailyReminderSettings> =>
    request('/api/me/reminder', isDailyReminderSettings, {
      method: 'PUT', body: JSON.stringify({ ...preference, generation }), ...(signal ? { signal } : {}),
    }),
  clearDailyReminder: (signal?: AbortSignal): Promise<DailyReminderSettings> =>
    request('/api/me/reminder', isDailyReminderSettings, { method: 'DELETE', ...(signal ? { signal } : {}) }),
  startAttempt: (edition: string, signal?: AbortSignal): Promise<AttemptStart> =>
    request('/api/attempts', isAttemptStart, {
      method: 'POST', body: JSON.stringify({ edition }), ...(signal ? { signal } : {}),
    }),
  myRank: (edition: string, signal?: AbortSignal): Promise<MyRank> =>
    request(`/api/my-rank?edition=${encodeURIComponent(edition)}`, isMyRank, signal ? { signal } : {}),
  standings: async (edition: string): Promise<DailyLeaderboard> => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      return await request(`/api/leaderboard?edition=${encodeURIComponent(edition)}&mode=daily`, isDailyLeaderboard, { signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Standings took too long. Retry when your connection is ready.');
      throw error;
    } finally { window.clearTimeout(timeout); }
  },
  rememberGuides: async (topics: readonly GuideTopic[]): Promise<void> => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      await request('/api/me/guides',
        (data): data is { seenGuides: GuideTopic[] } => isRecord(data) && isGuideTopics(data['seenGuides']),
        { method: 'POST', body: JSON.stringify({ topics }), signal: controller.signal });
    } finally { window.clearTimeout(timeout); }
  },
  submit: async (repair: SubmitRepair): Promise<SavedRepair> => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      return await request('/api/repairs', isSavedRepair, {
        method: 'POST', body: JSON.stringify(repair), signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Saving took too long. Retry save; your repair is safe.');
      throw error;
    } finally { window.clearTimeout(timeout); }
  },
  erase: (): Promise<{ deleted: true }> => request('/api/me',
    (data): data is { deleted: true } => isRecord(data) && data['deleted'] === true,
    { method: 'DELETE' }),
};
