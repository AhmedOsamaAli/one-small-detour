import { useEffect, useState } from 'react';
import type { Edition, MyRank } from '../shared/types.ts';
import { formatSolveTime } from '../shared/timing.ts';
import { gameApi } from './api.ts';
import type { DailyLeaderboard } from './api.ts';
import { DailyStandings } from './DailyStandings.tsx';
import type { StandingsState } from './DailyStandings.tsx';
import { Icon } from './components.tsx';
import { useCraftArt } from './CraftArt.tsx';

export type RecordedDailyRank = MyRank & { rank: number; swaps: number; solveMs: number };

export function SavedDailyResults({ edition, result, onReplay, onPractice, onHome }: {
  edition: Edition;
  result: RecordedDailyRank;
  onReplay: () => void;
  onPractice: () => void;
  onHome: () => void;
}) {
  const crafted = useCraftArt();
  const initialBoard = gameApi.peekStandings(edition.id);
  const [state, setState] = useState<StandingsState>(() => initialBoard ? { status: 'ready', board: initialBoard } : { status: 'loading' });
  const [board, setBoard] = useState<DailyLeaderboard | null>(initialBoard);
  const [refresh, setRefresh] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    let active = true;
    const cached = refresh === 0 ? gameApi.peekStandings(edition.id) : null;
    if (cached) {
      setBoard(cached);
      setState({ status: 'ready', board: cached });
    } else if (refresh === 0) {
      setState({ status: 'loading' });
    }
    setRefreshing(true);
    void gameApi.standings(edition.id, refresh > 0).then((next) => {
      if (!active) return;
      setBoard(next);
      setState({ status: 'ready', board: next });
    }).catch((error: unknown) => {
      console.error('The saved Daily standings could not refresh:', error);
      if (active) setState((prev) => prev.status === 'ready' ? prev : { status: 'error', message: error instanceof Error ? error.message : 'Your rank could not refresh. Please try again.' });
    }).finally(() => {
      if (active) setRefreshing(false);
    });
    return () => { active = false; };
  }, [edition.id, refresh]);
  useEffect(() => {
    const visible = (): void => { if (!document.hidden) setRefresh((value) => value + 1); };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, []);
  const own = board ? board.yourBest : result;
  const players = board?.players ?? result.participants;
  const percentage = board ? board.topPercent : result.topPercent;
  const source = board?.source ?? result.source;
  return <main className="saved-daily-results" data-testid="saved-daily-results">
    <header className="saved-daily-heading">
      <div className="saved-daily-title-group">
        <p className="eyebrow">{edition.id} / {source === 'local' ? 'LOCAL REHEARSAL' : 'DAILY COMPLETE'}</p>
        <h1 id="saved-daily-title" tabIndex={-1}>{edition.puzzle.title}<span>.</span></h1>
      </div>
      <button className="icon-button saved-daily-home-icon" onClick={onHome} aria-label="Back to home" title="Back to home">
        <Icon name="home" size={20}/>
      </button>
    </header>
    <div className="saved-daily-body">
      <section className="saved-daily-summary" aria-label="Your recorded Daily result">
        {own ? <>
          <span>{state.status === 'ready' ? 'Current rank' : 'Last checked rank'}</span>
          <strong className="saved-daily-rank" data-testid="saved-daily-rank" role="status">#{own.rank}</strong>
          {percentage !== null && <p>Top {percentage < 1 ? '<1' : Math.ceil(percentage)}%</p>}
          <p>{crafted ? `Of ${players} ${players === 1 ? 'finisher' : 'finishers'} today.` : `Among ${players} saved ${players === 1 ? 'finisher' : 'finishers'} in this community.`}</p>
          <p className="saved-daily-metrics">{own.swaps} moves · {formatSolveTime(own.solveMs, true)}</p>
        </> : <p role="status">Your saved result is no longer available. No rank is being shown.</p>}
        <p>{own ? crafted ? 'Your finish stays. Your rank can change.' : 'Rankings can change as other people finish. Your recorded moves and time stay the same.' : 'Refresh to check again. No old rank is being shown.'}</p>
        <button className="secondary-button" disabled={state.status === 'loading' || refreshing} onClick={() => setRefresh((value) => value + 1)}
          aria-label="Refresh current Daily rank"><Icon name="reset" size={16}/>Refresh rank</button>
      </section>
      <div className="saved-daily-standings">
        <DailyStandings state={state} edition={edition.id} onRetry={() => setRefresh((value) => value + 1)}/>
      </div>
    </div>
    <footer className="saved-daily-actions" id="saved-daily-controls" tabIndex={-1}>
      <button className="primary-button" onClick={onPractice}><Icon name="map" size={17}/>Practice</button>
      <button className="secondary-button" onClick={onReplay}><Icon name="reset" size={17}/>Replay unranked</button>
    </footer>
  </main>;
}
