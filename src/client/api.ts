import { isAttemptStart, isBootstrap, isMyRank, isPuzzle, isRecord, isSavedRepair } from '../shared/validation.ts';
import type { AttemptStart, Bootstrap, GuideTopic, MyRank, Puzzle, SavedRepair, SubmitRepair } from '../shared/types.ts';
import { isGuideTopics } from '../shared/guidance.ts';

const ID_KEY = 'detour:local-player';
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
    throw new Error(isRecord(data) && typeof data['error'] === 'string' ? data['error'] : 'The village board could not be reached.');
  }
  if (!guard(data)) throw new Error('The village sent an unreadable response. Please refresh and try again.');
  return data;
}

export const gameApi = {
  bootstrap: (): Promise<Bootstrap> => request('/api/bootstrap', isBootstrap),
  place: (id: string): Promise<Puzzle> => request(`/api/places/${encodeURIComponent(id)}`, isPuzzle),
  startAttempt: (edition: string, signal?: AbortSignal): Promise<AttemptStart> =>
    request('/api/attempts', isAttemptStart, {
      method: 'POST', body: JSON.stringify({ edition }), ...(signal ? { signal } : {}),
    }),
  myRank: (edition: string): Promise<MyRank> =>
    request(`/api/my-rank?edition=${encodeURIComponent(edition)}`, isMyRank),
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
