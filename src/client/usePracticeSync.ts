import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { gameApi } from './api.ts';
import { browserPracticeState, mergePracticeState } from '../shared/practiceProgress.ts';
import type { PracticeAccount, PracticeSnapshot } from '../shared/practiceProgress.ts';
import type { Bootstrap, CatalogEntry } from '../shared/types.ts';
import type { Preferences } from './preferences.ts';

type SyncPhase = 'loading' | 'saving' | 'saved' | 'error' | 'guest';
interface SyncState { phase: SyncPhase; message: string | null }

export function reconcilePracticeAccount(current: Preferences, catalog: readonly CatalogEntry[], account: PracticeAccount): Preferences {
  const identity = current.practiceAccount;
  const reset = identity !== undefined && (identity.owner !== account.owner || identity.generation !== account.snapshot.generation);
  const state = reset ? account.snapshot :
    mergePracticeState(catalog, browserPracticeState(catalog, current.completed, current.practice), account.snapshot);
  const ids = new Set(catalog.map((place) => place.id));
  const completed = [...current.completed.filter((id) => !ids.has(id)), ...state.completed];
  if (JSON.stringify(current.completed) === JSON.stringify(completed) &&
      JSON.stringify(current.practice) === JSON.stringify(state.practice) &&
      identity?.owner === account.owner && identity.generation === account.snapshot.generation) return current;
  return { ...current, completed, practice: state.practice,
    practiceAccount: { owner: account.owner, generation: account.snapshot.generation } };
}

const signature = (snapshot: Pick<PracticeSnapshot, 'completed' | 'practice'>): string =>
  JSON.stringify({ completed: snapshot.completed, practice: snapshot.practice });

export function usePracticeSync(bootstrap: Bootstrap | null, preferences: Preferences, setPreferences: Dispatch<SetStateAction<Preferences>>) {
  const [state, setState] = useState<SyncState>({ phase: 'loading', message: null });
  const [refresh, setRefresh] = useState(0);
  const [ready, setReady] = useState<string | null>(null);
  const remote = useRef<PracticeAccount | null>(null);
  const saved = useRef('');
  const sequence = useRef(0);
  const latest = useRef(preferences);
  latest.current = preferences;
  const signedIn = bootstrap?.playerName !== null && bootstrap !== null;
  const catalog = bootstrap?.catalog;
  const local = useMemo(() => catalog ? browserPracticeState(catalog, preferences.completed, preferences.practice) : null,
    [catalog, preferences.completed, preferences.practice]);
  const localSignature = local ? signature(local) : '';

  const retry = useCallback(() => setRefresh((value) => value + 1), []);

  useEffect(() => {
    const request = ++sequence.current;
    remote.current = null;
    saved.current = '';
    setReady(null);
    if (!signedIn || !catalog) { setState({ phase: 'guest', message: null }); return; }
    let active = true;
    setState({ phase: 'loading', message: null });
    void gameApi.practiceProgress().then((account) => {
      if (!active || request !== sequence.current) return;
      remote.current = account;
      saved.current = signature(account.snapshot);
      const previous = latest.current.practiceAccount;
      const reconciled = reconcilePracticeAccount(latest.current, catalog, account);
      const pending = signature(browserPracticeState(catalog, reconciled.completed, reconciled.practice)) !== saved.current;
      setPreferences((current) => reconcilePracticeAccount(current, catalog, account));
      setReady(`${account.owner}:${account.snapshot.generation}:${refresh}`);
      setState({ phase: pending ? 'saving' : 'saved', message: previous && previous.owner === account.owner && previous.generation !== account.snapshot.generation ?
        'Practice progress was cleared on another device. This copy has refreshed.' : null });
    }).catch((error: unknown) => {
      console.error('Practice progress could not load:', error);
      if (active && request === sequence.current) setState({ phase: 'error',
        message: error instanceof Error ? error.message : 'Practice sync failed. Your local stops are safe; please retry.' });
    });
    return () => { active = false; sequence.current++; };
  }, [signedIn, bootstrap?.playerName, bootstrap?.source, bootstrap?.community, catalog, refresh, setPreferences]);

  useEffect(() => {
    if (!ready || !local || !remote.current || saved.current === localSignature) return;
    let active = true;
    const account = remote.current, request = sequence.current;
    setState({ phase: 'saving', message: null });
    const timer = window.setTimeout(() => {
      void gameApi.savePracticeProgress(account.snapshot.generation, local).then((next) => {
        if (!active || request !== sequence.current) return;
        if (next.owner !== account.owner) throw new Error('Your signed-in account changed. Refresh Practice sync before continuing.');
        remote.current = next;
        saved.current = signature(next.snapshot);
        setPreferences((current) => reconcilePracticeAccount(current, catalog ?? [], next));
        setState({ phase: 'saved', message: null });
      }).catch((error: unknown) => {
        console.error('Practice progress could not sync:', error);
        if (active && request === sequence.current) setState({ phase: 'error',
          message: error instanceof Error ? error.message : 'Practice sync failed. Your local stops are safe; please retry.' });
      });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [ready, localSignature, local, catalog, setPreferences]);

  useEffect(() => {
    if (!signedIn) return;
    const visible = (): void => { if (!document.hidden) retry(); };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, [signedIn, retry]);

  const clear = useCallback(async (): Promise<void> => {
    const request = ++sequence.current;
    const account = await gameApi.clearPracticeProgress();
    if (request !== sequence.current) throw new Error('The active Practice account changed. Refresh to confirm the reset.');
    remote.current = account;
    saved.current = signature(account.snapshot);
    const ids = new Set(catalog?.map((place) => place.id) ?? []);
    setPreferences((current) => ({ ...current,
      completed: current.completed.filter((id) => !ids.has(id)),
      practice: account.snapshot.practice, practiceAccount: { owner: account.owner, generation: account.snapshot.generation } }));
    setReady(`${account.owner}:${account.snapshot.generation}:${refresh}`);
    setState({ phase: 'saved', message: null });
  }, [catalog, refresh, setPreferences]);

  return { ...state, retry, clear };
}
