export const COUNTDOWN_MS = 3000;
export const MAX_ATTEMPT_MS = 24 * 60 * 60 * 1000;
// Advance this for ranking or puzzle-rule changes, without reseeding the puzzle
// for timing-only changes.
export const TIMED_SCORE_VERSION = '5';

export interface ClockSnapshot {
  phase: 'countdown' | 'running' | 'solved';
  countdown: number | null;
  elapsedMs: number;
}

export class SolveClock {
  private finishedAt: number | null = null;
  readonly startsAt: number;

  constructor(startsAt: number) {
    if (!Number.isFinite(startsAt)) throw new Error('The solve clock needs a valid starting time.');
    this.startsAt = startsAt;
  }

  snapshot(now: number): ClockSnapshot {
    if (!Number.isFinite(now)) throw new Error('The solve clock needs a valid current time.');
    const end = this.finishedAt ?? now;
    return {
      phase: this.finishedAt !== null ? 'solved' : now < this.startsAt ? 'countdown' : 'running',
      countdown: now < this.startsAt ? Math.ceil((this.startsAt - now) / 1000) : null,
      elapsedMs: Math.max(0, Math.floor(end - this.startsAt)),
    };
  }

  stop(now: number): ClockSnapshot {
    if (!Number.isFinite(now) || now < this.startsAt) throw new Error('Finish the countdown before solving.');
    if (this.finishedAt === null) this.finishedAt = now;
    return this.snapshot(now);
  }

  resume(): void {
    this.finishedAt = null;
  }
}

export function formatSolveTime(milliseconds: number, precise = false): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error('Solve time must be a non-negative duration.');
  const seconds = Math.floor(milliseconds / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return precise ? `${time}.${Math.floor(milliseconds % 1000 / 100)}` : time;
}
