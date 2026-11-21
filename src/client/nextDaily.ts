export interface DailyClock {
  resetAtMs: number;
  serverOffsetMs: number;
}

export function createDailyClock(nextReset: string, serverNow: string, localNow: number): DailyClock {
  const resetAtMs = Date.parse(nextReset), serverNowMs = Date.parse(serverNow);
  if (![resetAtMs, serverNowMs, localNow].every(Number.isFinite)) {
    throw new Error('The Daily opening time could not be read. Please reload the island.');
  }
  return { resetAtMs, serverOffsetMs: serverNowMs - localNow };
}

export function secondsUntilDaily(clock: DailyClock, localNow: number): number {
  if (![clock.resetAtMs, clock.serverOffsetMs, localNow].every(Number.isFinite)) {
    throw new Error('The Daily countdown needs a valid clock.');
  }
  return Math.max(0, Math.ceil((clock.resetAtMs - localNow - clock.serverOffsetMs) / 1000));
}

export function formatDailyCountdown(seconds: number): string {
  if (!Number.isInteger(seconds) || seconds < 0) throw new Error('The Daily countdown needs a non-negative duration.');
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function localDailyOpening(resetAtMs: number, locale?: string, timeZone?: string): string {
  if (!Number.isFinite(resetAtMs)) throw new Error('The Daily opening time is invalid.');
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(resetAtMs);
}
