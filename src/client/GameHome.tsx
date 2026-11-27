import type { CatalogEntry, Edition } from '../shared/types.ts';
import { formatSolveTime } from '../shared/timing.ts';
import { CraftScene, useCraftArt } from './CraftArt.tsx';
import { Icon, JourneyCottage, LandscapeIllustration } from './components.tsx';
import type { HomeDailyState } from './useDailyHome.ts';
import type { DailyClock } from './nextDaily.ts';
import { NextDailyCountdown } from './NextDailyCountdown.tsx';
import { DailyReminderControl } from './DailyReminderControl.tsx';

interface HomeProps {
  edition: Edition | null;
  nextDailyClock: DailyClock;
  daily: HomeDailyState;
  firstVisit: boolean;
  guestComplete: boolean;
  local: boolean;
  signedIn: boolean;
  reminderIdentity: string;
  nextPractice: CatalogEntry | null;
  nextPracticeNumber: number;
  completed: number;
  total: number;
  practiceBusy: boolean;
  practiceSyncing: boolean;
  practiceNeedsStars: boolean;
  islandStarGoal: { stars: number; required: number; nextIsland: number } | null;
  practiceError: string | null;
  syncError: string | null;
  onGuide: () => void;
  onPlay: () => void;
  onResults: () => void;
  onPractice: () => void;
  onMap: () => void;
  onRetry: () => void;
  onRetrySync: () => void;
}

export function GameHome(props: HomeProps) {
  const crafted = useCraftArt();
  const { edition, daily, firstVisit, guestComplete } = props;
  const complete = daily.status === 'complete' || guestComplete;
  const learning = firstVisit && !complete;
  const ready = daily.status === 'ready' || daily.status === 'complete';
  const date = edition ? new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${edition.id}T12:00:00Z`)) : 'ONE SMALL DETOUR';
  return <main className="game-home" data-testid="game-home"
    data-daily-state={guestComplete ? 'guest-complete' : daily.status} data-first-visit={firstVisit}>
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-picture" aria-hidden="true">{crafted ? <CraftScene/> : <LandscapeIllustration theme={edition?.puzzle.theme ?? 'meadow'}/>}</div>
      <div className="home-welcome">
        <p className="eyebrow">{props.local ? 'LOCAL REHEARSAL / ' : ''}{date}</p>
        <h1 id="home-title" tabIndex={-1}>{complete ? 'A good road home.' : learning ? 'A little way home.' : 'Your little detour awaits.'}</h1>
        <p>{complete ? 'Today is done. Your journey goes on.' : 'Move the land. Get everyone home.'}</p>
        <ol className="home-route journey-order" aria-label="Connect A, then B, then C">
          {(['A', 'B', 'C'] as const).map((anchor, index) => <li key={anchor} data-stop={anchor}>
            <span className="journey-stop"><JourneyCottage anchor={anchor}/><span className="sr-only">{anchor}</span></span>
            {index < 2 && <span className="journey-arrow" aria-hidden="true">&rarr;</span>}
          </li>)}
        </ol>
      </div>
    </section>
    <div className="home-choices" id="home-controls" tabIndex={-1}>
      <section className="home-daily home-signpost" aria-labelledby="home-daily-title">
        <div className="home-signpost-heading"><Icon name={complete ? 'check' : learning ? 'book' : 'leaf'} size={20}/>
          <span className="eyebrow">{complete ? 'TODAY COMPLETE' : learning ? 'STEP 1 · QUICK DEMO' : "TODAY'S DAILY"}</span></div>
        <h2 id="home-daily-title">{learning ? 'Finish demo to unlock Daily.' : edition?.puzzle.title ?? 'A road at your own pace.'}</h2>
        {learning && <p id="home-demo-lock" className="home-demo-lock">1 short swap lesson + 6 quick cards unlock Today's Daily.</p>}
        {daily.status === 'checking' && <p className="home-status" role="status">Checking today. No clock yet.</p>}
        {daily.status === 'error' && <p className="inline-error" role="alert">{daily.message}</p>}
        {daily.status === 'unavailable' && <p>A new Daily is not available. Practice is open.</p>}
        {daily.status === 'complete' && <div className="home-record" data-testid="home-record">
          <span><Icon name="trophy" size={18}/><strong>Rank #{daily.result.rank}</strong>
            <span>of {daily.result.participants}</span></span>
          <small>{daily.result.swaps} moves &middot; {formatSolveTime(daily.result.solveMs, true)}</small>
        </div>}
        {guestComplete && <p className="home-status">Finished on this device. No saved rank.</p>}
        {daily.status === 'ready' && !guestComplete && !learning && <p>Your solve timer starts with Play.</p>}
        <div className="home-actions">
          {learning && <button className="primary-button" onClick={props.onGuide}><Icon name="play" size={17}/>Start demo</button>}
          {complete ? <>
            {daily.status === 'complete' && <button className="secondary-button home-result-button" onClick={props.onResults} aria-label="View today's result"><Icon name="trophy" size={16}/>Top 10</button>}
            <button className="secondary-button home-replay-button" onClick={props.onPlay}><Icon name="reset" size={16}/>Replay unranked</button>
          </> : daily.status === 'error' ?
            <button className="secondary-button" onClick={props.onRetry}><Icon name="reset" size={17}/>Retry today's status</button> :
            edition && <button className={learning ? 'secondary-button home-locked-daily' : 'primary-button'} onClick={props.onPlay}
              disabled={firstVisit || !ready} data-demo-locked={firstVisit} aria-describedby={learning ? 'home-demo-lock' : undefined}
              title={firstVisit ? 'Finish the demo and 6 rule cards to unlock Today\'s Daily.' : undefined}>
              <Icon name={firstVisit ? 'lock' : 'play'} size={17}/>{daily.status === 'checking' ? 'Checking...' : firstVisit ? 'Daily locked (finish demo)' : 'Play today'}</button>}
        </div>
        {edition && <NextDailyCountdown clock={props.nextDailyClock}/>}
      </section>
      <section className="home-practice home-signpost" aria-labelledby="home-practice-title">
        <div className="home-signpost-heading"><Icon name="map" size={20}/><span className="eyebrow">PRACTICE</span>
          <span className="home-progress">{props.completed} / {props.total}</span></div>
        <h2 id="home-practice-title">{props.practiceNeedsStars ? 'More stars needed.' :
          props.nextPractice ? `Stop ${props.nextPracticeNumber}` : 'Every road discovered.'}</h2>
        <p className={props.practiceNeedsStars ? 'home-star-guidance' : 'home-next-name'} title={props.practiceNeedsStars ? undefined : props.nextPractice?.title}>
          {props.practiceNeedsStars && props.islandStarGoal
            ? `Collect ${props.islandStarGoal.required - props.islandStarGoal.stars} more stars (${props.islandStarGoal.stars}/${props.islandStarGoal.required}) to open Island ${props.islandStarGoal.nextIsland}.`
            : props.nextPractice?.title.split(' / ')[0] ?? 'Revisit a favourite little place.'}</p>
        {!props.practiceNeedsStars && props.islandStarGoal && <p className="home-star-goal" data-testid="home-star-goal">
          ★ {props.islandStarGoal.stars} / {props.islandStarGoal.required} stars for Island {props.islandStarGoal.nextIsland}
        </p>}
        {props.syncError && <p className="inline-error" role="alert">{props.syncError}
          <button className="secondary-button" onClick={props.onRetrySync}>Retry sync</button></p>}
        {props.practiceError && <p className="inline-error" role="alert">{props.practiceError}</p>}
        <div className="home-actions">
          <button className={complete ? 'primary-button' : 'secondary-button'} disabled={props.practiceBusy || props.practiceSyncing} onClick={props.onPractice}
            aria-label={props.practiceNeedsStars ? 'Choose a Practice stop for more stars' : undefined}>
            <Icon name="play" size={17}/>{props.practiceBusy ? 'Opening...' : props.practiceSyncing ? 'Loading...' :
              props.practiceNeedsStars ? 'Choose on map' : props.nextPractice ? 'Continue Practice' : 'Explore Practice'}</button>
          {!props.practiceNeedsStars && <button className="secondary-button home-map-button" onClick={props.onMap}><Icon name="map" size={16}/>Map</button>}
        </div>
      </section>
    </div>
    <DailyReminderControl key={props.reminderIdentity} signedIn={props.signedIn} local={props.local}/>
    <footer className="home-footnote">{guestComplete ? 'Guest finishes stay on this device. Daily ranks need a Reddit sign-in.' :
      complete ? 'Your saved finish stays. Your rank can change.' :
      'One shared island each day. 1,000 roads in Practice.'}
      {!learning && <button className="secondary-button home-guide-button" onClick={props.onGuide}><Icon name="book" size={15}/>Guide</button>}</footer>
  </main>;
}
