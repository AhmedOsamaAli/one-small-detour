import type { DailyLeaderboard } from './api.ts';
import { firstDailyResultOnly, formatSolveTime } from '../shared/timing.ts';
import { useCraftArt } from './CraftArt.tsx';

export type StandingsState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; board: DailyLeaderboard };

export function DailyStandings({ state, edition, onRetry }: { state: StandingsState; edition: string; onRetry: () => void }) {
  const crafted = useCraftArt();
  if (state.status === 'idle' || state.status === 'loading') return <p role="status">Loading current standings...</p>;
  if (state.status === 'error') return <div className="standings-error" role="alert"><p>{state.message}</p>
    <button className="secondary-button" onClick={onRetry}>Retry standings</button></div>;
  const board = state.board;
  const leaders = board.entries.slice(0, 10);
  const own = board.yourBest && !leaders.some((entry) => entry.isYou) ? board.yourBest : null;
  return <section className="daily-standings" aria-label="Current Daily top 10">
    <h3>{board.source === 'local' ? 'Local Top 10' : 'Daily Top 10'}</h3>
    <p>{edition} / Moves first, then time.</p>
    {!leaders.length ? <p>No saved finishers yet.</p> : <table>
      <caption className="sr-only">Current Daily top ten by moves, then time</caption>
      <colgroup><col className="standing-rank"/><col/><col className="standing-moves"/><col className="standing-time"/></colgroup>
      <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Moves</th><th scope="col">Time</th></tr></thead>
      <tbody>{leaders.map((entry) => <tr key={entry.userId} className={entry.isYou ? 'standing-you' : undefined}>
        <td>{entry.rank}</td><th scope="row" title={entry.name}>{entry.name}{entry.isYou && <small> You</small>}</th><td>{entry.swaps}</td>
        <td>{formatSolveTime(entry.solveMs, true)}</td>
      </tr>)}</tbody>
      {own && <tfoot><tr className="standing-you"><td>{own.rank}</td><th scope="row">{firstDailyResultOnly(edition) ? 'Your result' : 'Your best'}</th><td>{own.swaps}</td>
        <td>{formatSolveTime(own.solveMs, true)}</td></tr></tfoot>}
    </table>}
    <p>{crafted ? `${board.players} ${board.players === 1 ? 'finisher' : 'finishers'}. ${firstDailyResultOnly(edition) ? 'First finishes only. ' : ''}Rank when opened.` :
      <>{board.players} saved {board.players === 1 ? 'finisher' : 'finishers'}. Each person counts once.
        {' '}{firstDailyResultOnly(edition) && 'First recorded result only. '}Snapshot when opened.</>}</p>
  </section>;
}
