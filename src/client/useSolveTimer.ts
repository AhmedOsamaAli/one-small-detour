import { useCallback, useEffect, useRef, useState } from 'react';
import { gameApi } from './api.ts';
import { COUNTDOWN_MS, MAX_ATTEMPT_MS, SolveClock } from '../shared/timing.ts';
import type { AttemptStart } from '../shared/types.ts';

type TimerPhase = 'preparing' | 'countdown' | 'running' | 'solved' | 'error';
interface TimerState {
  generation: number;
  phase: TimerPhase;
  countdown: number | null;
  elapsedMs: number;
  error: string | null;
  attempt: AttemptStart | null;
}

export function useSolveTimer(generation: number, edition: string | null, enabled: boolean, ready: boolean) {
  const [state, setState] = useState<TimerState>({
    generation, phase: enabled ? 'preparing' : 'running', countdown: null, elapsedMs: 0, error: null, attempt: null,
  });
  const current = useRef<{ generation: number; clock: SolveClock; attempt: AttemptStart | null } | null>(null);

  useEffect(() => {
    if (!enabled) {
      current.current = null;
      setState({ generation, phase: 'running', countdown: null, elapsedMs: 0, error: null, attempt: null });
      return;
    }
    if (!ready || current.current?.generation === generation) return;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    setState({ generation, phase: 'preparing', countdown: null, elapsedMs: 0, error: null, attempt: null });
    const start = async (): Promise<void> => {
      try {
        const attempt = edition ? await gameApi.startAttempt(edition, controller.signal) : null;
        if (!active) return;
        const delay = attempt ? Date.parse(attempt.startsAt) - Date.parse(attempt.now) : COUNTDOWN_MS;
        if (delay !== COUNTDOWN_MS) throw new Error('The server sent an invalid countdown. Please restart.');
        const clock = new SolveClock(performance.now() + delay);
        current.current = { generation, clock, attempt };
        setState({ generation, ...clock.snapshot(performance.now()), error: null, attempt });
      } catch (error) {
        if (!active) return;
        console.error('The timed attempt could not start:', error);
        setState({
          generation, phase: 'error', countdown: null, elapsedMs: 0, attempt: null,
          error: error instanceof Error ? error.message : 'The timed attempt could not start. Please restart.',
        });
      } finally { window.clearTimeout(timeout); }
    };
    void start();
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [generation, edition, enabled, ready]);

  useEffect(() => {
    if (!enabled) return;
    const tick = (): void => {
      const timer = current.current;
      if (!timer || timer.generation !== generation) return;
      const snapshot = timer.clock.snapshot(performance.now());
      setState((previous) => {
        if (previous.generation !== generation || previous.phase === 'error') return previous;
        if (snapshot.elapsedMs > MAX_ATTEMPT_MS) {
          return { ...previous, phase: 'error', error: 'This timed attempt expired. Restart to begin a new countdown.' };
        }
        return { generation, ...snapshot, error: null, attempt: timer.attempt };
      });
    };
    const interval = window.setInterval(tick, 100);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [generation, enabled]);

  const stop = useCallback((at = performance.now()): void => {
    if (!enabled) return;
    const timer = current.current;
    if (!timer || timer.generation !== generation) throw new Error('Wait for the countdown before making this repair.');
    const snapshot = timer.clock.stop(at);
    setState({ generation, ...snapshot, error: null, attempt: timer.attempt });
  }, [generation, enabled]);

  const resume = useCallback((): void => {
    const timer = current.current;
    if (!enabled || !timer || timer.generation !== generation) return;
    timer.clock.resume();
    setState({ generation, ...timer.clock.snapshot(performance.now()), error: null, attempt: timer.attempt });
  }, [generation, enabled]);

  const visible: TimerState = state.generation === generation ? state : {
    generation, phase: enabled ? 'preparing' : 'running', countdown: null, elapsedMs: 0, error: null, attempt: null,
  };
  return { ...visible, stop, resume, canPlay: !enabled || visible.phase === 'running' || visible.phase === 'solved' };
}
