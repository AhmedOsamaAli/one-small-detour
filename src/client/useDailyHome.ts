import { useCallback, useEffect, useState } from 'react';
import type { MyRank } from '../shared/types.ts';
import type { RecordedDailyRank } from './SavedDailyResults.tsx';
import { gameApi } from './api.ts';

export type HomeDailyState =
  | { status: 'checking'; edition: string | null }
  | { status: 'ready'; edition: string }
  | { status: 'complete'; edition: string; result: RecordedDailyRank }
  | { status: 'error'; edition: string; message: string }
  | { status: 'unavailable'; edition: null };

export function homeDailyResult(edition: string, result: MyRank): HomeDailyState {
  if (result.edition !== edition ||
      result.rank !== null && (result.swaps === null || result.solveMs === null)) {
    throw new Error('The saved Daily result was incomplete. Please try again.');
  }
  return result.rank !== null && result.swaps !== null && result.solveMs !== null ?
    { status: 'complete', edition, result: { ...result, rank: result.rank, swaps: result.swaps, solveMs: result.solveMs } } :
    { status: 'ready', edition };
}

export function useDailyHome(edition: string | null, active: boolean, identity: string) {
  const [checked, setChecked] = useState<{ identity: string; state: HomeDailyState }>({
    identity, state: { status: 'checking', edition },
  });
  const [generation, setGeneration] = useState(0);
  const refresh = useCallback(() => {
    setChecked({ identity, state: { status: 'checking', edition } });
    setGeneration(value => value + 1);
  }, [edition, identity]);

  useEffect(() => {
    if (!active) return;
    if (!edition) { setChecked({ identity, state: { status: 'unavailable', edition: null } });return; }
    let current = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setChecked({ identity, state: { status: 'checking', edition } });
    void gameApi.myRank(edition, controller.signal).then(result => {
      if (current) setChecked({ identity, state: homeDailyResult(edition, result) });
    }).catch((error: unknown) => {
      if (!current) return;
      console.error('The Home Daily status could not be checked:', error);
      setChecked({ identity, state: { status: 'error', edition, message: controller.signal.aborted ?
        'Checking today took too long. Please try again.' :
        error instanceof Error ? error.message : 'Today could not be checked. Please try again.' } });
    }).finally(() => window.clearTimeout(timeout));
    return () => { current = false;controller.abort();window.clearTimeout(timeout); };
  }, [edition, active, identity, generation]);

  useEffect(() => {
    if (!active) return;
    const visible = (): void => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, [active, refresh]);

  return { state: checked.identity === identity && checked.state.edition === edition ?
    checked.state : { status: 'checking' as const, edition }, refresh };
}
