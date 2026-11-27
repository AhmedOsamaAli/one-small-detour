import type { DailyLeaderboard } from './api.ts';
import { firstDailyResultOnly, formatSolveTime } from '../shared/timing.ts';
import { useCraftArt } from './CraftArt.tsx';

export type StandingsState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; board: DailyLeaderboard };

function RankBadge({ rank }: { rank: number }) {
  if (rank < 1 || rank > 3) return <>{rank}</>;
  const medal = rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze';
  return <span className={`rank-medal rank-medal-${medal}`} data-medal={medal} aria-label={`Rank ${rank}, ${medal} medal`}>
    <svg className="rank-medal-icon" viewBox="0 0 22 26" aria-hidden="true">
      <path d="M4.5 1h4.8l2.7 8H8.4Z" className="rank-medal-ribbon-left"/>
      <path d="M17.5 1h-4.8L10 9h3.6Z" className="rank-medal-ribbon-right"/>
      <circle cx="11" cy="16.8" r="7.7" className="rank-medal-disc"/>
      <circle cx="11" cy="16.8" r="5.8" className="rank-medal-rim"/>
      <text x="11" y="17.1" textAnchor="middle" dominantBaseline="central" className="rank-medal-num">{rank}</text>
    </svg>
  </span>;
}

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
      <thead><tr><th scope="col" className="standing-num standing-rank-col">#</th><th scope="col">Player</th><th scope="col" className="standing-num standing-moves-col">Moves</th><th scope="col" className="standing-num standing-time-col">Time</th></tr></thead>
      <tbody>{leaders.map((entry) => <tr key={entry.userId} className={entry.isYou ? 'standing-you' : undefined}>
        <td className="standing-num standing-rank-col"><RankBadge rank={entry.rank}/></td><th scope="row" title={entry.name}><span className="standing-player"><span className="standing-name">{entry.name}</span>{entry.isYou && <small className="standing-you-tag">You</small>}</span></th><td className="standing-num standing-moves-col">{entry.swaps}</td>
        <td className="standing-num standing-time-col">{formatSolveTime(entry.solveMs, true)}</td>
      </tr>)}</tbody>
      {own && <tfoot><tr className="standing-you"><td className="standing-num standing-rank-col">{own.rank}</td><th scope="row">{firstDailyResultOnly(edition) ? 'Your result' : 'Your best'}</th><td className="standing-num standing-moves-col">{own.swaps}</td>
        <td className="standing-num standing-time-col">{formatSolveTime(own.solveMs, true)}</td></tr></tfoot>}
    </table>}
    <p className="standings-footnote">{crafted ? `${board.players} ${board.players === 1 ? 'finisher' : 'finishers'} · ${firstDailyResultOnly(edition) ? 'First finish only · ' : ''}Snapshot when opened.` :
      <>{board.players} saved {board.players === 1 ? 'finisher' : 'finishers'}. Each person counts once.
        {' '}{firstDailyResultOnly(edition) && 'First recorded result only. '}Snapshot when opened.</>}</p>
  </section>;
}
