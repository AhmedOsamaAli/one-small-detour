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
  const rowCount = leaders.length + (own ? 1 : 0);
  const density = rowCount <= 4 ? 'spacious' : rowCount <= 8 ? 'roomy' : 'compact';
  return <section className="daily-standings" data-density={density} data-rows={rowCount} aria-label="Current Daily top 10">
    <div className="standings-header">
      <h3>{board.source === 'local' ? 'Local Top 10' : 'Daily Top 10'}</h3>
      <span className="standings-meta">{edition} · Moves, then time</span>
    </div>
    {!leaders.length ? <p className="standings-empty">No saved finishers yet.</p> : <table>
      <caption className="sr-only">Current Daily top ten by moves, then time</caption>
      <colgroup><col className="standing-rank"/><col/><col className="standing-moves"/><col className="standing-time"/></colgroup>
      <thead><tr><th scope="col" className="standing-num">#</th><th scope="col">Player</th><th scope="col" className="standing-num">Moves</th><th scope="col" className="standing-num">Time</th></tr></thead>
      <tbody>{leaders.map((entry) => <tr key={entry.userId} className={entry.isYou ? 'standing-you' : undefined}>
        <td className="standing-num">{entry.rank}</td><th scope="row" title={entry.name}><span className="standing-name">{entry.name}</span>{entry.isYou && <small className="standing-you-tag">You</small>}</th><td className="standing-num">{entry.swaps}</td>
        <td className="standing-num">{formatSolveTime(entry.solveMs, true)}</td>
      </tr>)}</tbody>
      {own && <tfoot><tr className="standing-you"><td className="standing-num">{own.rank}</td><th scope="row">{firstDailyResultOnly(edition) ? 'Your result' : 'Your best'}</th><td className="standing-num">{own.swaps}</td>
        <td className="standing-num">{formatSolveTime(own.solveMs, true)}</td></tr></tfoot>}
    </table>}
    <p className="standings-footnote">{crafted ? `${board.players} ${board.players === 1 ? 'finisher' : 'finishers'} · ${firstDailyResultOnly(edition) ? 'First finish only · ' : ''}Snapshot when opened.` :
      <>{board.players} saved {board.players === 1 ? 'finisher' : 'finishers'}. Each person counts once.
        {' '}{firstDailyResultOnly(edition) && 'First recorded result only. '}Snapshot when opened.</>}</p>
  </section>;
}
