import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gameApi, takeStorageNotice } from './api.ts';
import { IslandAudio } from './audio.ts';
import { BoardView } from './BoardView.tsx';
import type { Transition } from './BoardView.tsx';
import { BrandMark, CompletionSeal, FLAT_AXES, GuideCourier, GuideIllustration, HomeLetter, Icon, JourneyCottage, LandscapeIllustration, Modal, ScenicBackdrop, ShapeGlyph, StarRating, TileGuide, WalkthroughFeatures } from './components.tsx';
import { worldCssVariables } from './worldTheme.ts';
import { applySwap, checkPuzzle, patchArea, patchCells, RuleError, rulesFor, selectionIssue, shapesFor, tileAt } from '../shared/rules.ts';
import type { PatchIssue } from '../shared/rules.ts';
import { difficultyLabel } from '../shared/difficulty.ts';
import { CelebrationHold } from '../shared/playback.ts';
import { advancePracticeWorlds, campaignAchievements, campaignPlaces, campaignWorlds, completedOriginalRoad, initializePracticeProgress, nextCampaignPlace, PRACTICE_WORLD_SIZE, practiceGate, practiceStars, recordPracticeMoves, worldStarRequirement, worldStars } from '../shared/progression.ts';
import { guidePatchStart, pendingTutorialProbe, TUTORIAL, TUTORIAL_LESSONS, tutorialLesson, tutorialStage } from '../shared/tutorial.ts';
import { TutorialCoach } from './TutorialCoach.tsx';
import { TutorialCards } from './TutorialCards.tsx';
import { AdventureMap } from './AdventureMap.tsx';
import { useSolveTimer } from './useSolveTimer.ts';
import { firstDailyResultOnly, formatSolveTime } from '../shared/timing.ts';
import { mergeGuideTopics, newTileGuides } from '../shared/guidance.ts';
import { loadPreferences, PRACTICE_FENCE_KEY, PREF_KEY, resolveAppearance } from './preferences.ts';
import type { Anchor, Board, Bootstrap, CatalogEntry, Celebration, Cell, Edition, FrameAxes, GuideTarget, GuideTopic, JourneyPlayback, JourneyStop, MyRank, Puzzle, RouteCheck, Shape, Swap } from '../shared/types.ts';
import type { TutorialProbe } from '../shared/tutorial.ts';
import { sameGuideTarget } from './coachLayout.ts';
import { DailyStandings } from './DailyStandings.tsx';
import type { StandingsState } from './DailyStandings.tsx';
import { usePracticeSync } from './usePracticeSync.ts';
import { GardenArtContext, GardenArtDefinitions } from './GardenArt.tsx';
import { SavedDailyResults } from './SavedDailyResults.tsx';
import type { RecordedDailyRank } from './SavedDailyResults.tsx';
import { CraftArtContext, CraftFinishCourier, CraftScene } from './CraftArt.tsx';
import { CraftTerrainDefinitions } from './CraftTerrainArt.tsx';
import { GameHome } from './GameHome.tsx';
import { useDailyHome } from './useDailyHome.ts';
import { createDailyClock } from './nextDaily.ts';

type Kind = 'daily' | 'studio' | 'guide';
type Dialog = 'guide' | 'atlas' | 'erase' | 'erase-practice' | 'welcome' | 'tour-tools' | 'tour-places' | 'tiles' | null;
interface Run { puzzle: Puzzle; kind: Kind; edition: string | null; number: number | null }
interface Notice { message: string; error: boolean }

const EMPTY_ROUTES: Cell[][] = [];
const EMPTY_CELLS: readonly Cell[] = [];
const EMPTY_CATALOG: readonly CatalogEntry[] = [];
const postcardQuery = new URLSearchParams(window.location.search).get('postcard');
const POSTCARD_PREVIEW = postcardQuery !== '0';
const miniatureQuery = new URLSearchParams(window.location.search).get('miniature');
const MINIATURE_PREVIEW = miniatureQuery === '1' || (import.meta.env.DEV && miniatureQuery !== '0');
const GARDEN_PREVIEW = new URLSearchParams(window.location.search).get('art') !== 'classic';
const craftQuery = new URLSearchParams(window.location.search).get('craft');
const CRAFT_PREVIEW = GARDEN_PREVIEW && craftQuery !== '0';
const CRAFT_TOUR = CRAFT_PREVIEW && new URLSearchParams(window.location.search).get('tour') === '1';
const selectionLabels: Record<PatchIssue['code'], string> = {
  shape: 'Use whole squares.',
  bounds: 'Keep the patch on the map.',
  home: 'Homes/rocks stay fixed.',
  boulder: 'Boulders stay fixed.',
  overlap: 'Patches overlap.',
};

function rankSummary(rank: MyRank, label = 'today'): string {
  if (rank.rank === null) throw new Error('A saved daily rank is missing.');
  if (rank.participants === 1) return `Rank #${rank.rank} of 1 finisher ${label}`;
  if (rank.topPercent === null) throw new Error('The daily percentage is missing.');
  return `#${rank.rank} of ${rank.participants} · Top ${rank.topPercent < 1 ? '<1' : Math.ceil(rank.topPercent)}% ${label}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something unexpected happened. Please try again.';
}

function defaultShape(puzzle: Puzzle): Shape {
  const shapes = shapesFor(puzzle.area, puzzle.board.length, puzzle.frame);
  const shape = shapes.find((item) => item.rows === item.cols) ?? shapes[0];
  if (!shape) throw new Error('This patch size cannot fit the island.');
  return shape;
}

function localHash(value: string): number {
  let hash = 17;
  for (const char of value) hash = Math.imul(hash, 31) + char.charCodeAt(0);
  return hash >>> 0;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = (): void => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export default function App() {
  const initial = useMemo(loadPreferences, []);
  const craftTourOpened = useRef(false);
  const [preferences, setPreferences] = useState(initial.value);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  useEffect(() => {
    const update = (): void => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const appearance = resolveAppearance(preferences.appearance);
  const dark = appearance === 'dark';
  useLayoutEffect(() => { document.documentElement.dataset['appearance'] = appearance; }, [appearance]);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [reminderRevision, setReminderRevision] = useState(0);
  const dailyClock = useMemo(() => bootstrap ? createDailyClock(bootstrap.nextReset, bootstrap.now, Date.now()) : null, [bootstrap]);
  const catalogRef = useRef<readonly CatalogEntry[]>(EMPTY_CATALOG);
  catalogRef.current = bootstrap?.catalog ?? EMPTY_CATALOG;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<'home' | 'game' | 'results'>('home');
  const [run, setRun] = useState<Run | null>(null);
  const [pendingRun, setPendingRun] = useState<Run | null>(null);
  const [recordedDaily, setRecordedDaily] = useState<{ edition: Edition; result: RecordedDailyRank } | null>(null);
  const homeDaily = useDailyHome(bootstrap?.edition?.id ?? null, bootstrap !== null && screen === 'home',
    JSON.stringify([bootstrap?.source, bootstrap?.community, bootstrap?.playerName]));
  const [board, setBoard] = useState<Board>([]);
  const [moves, setMoves] = useState<Swap[]>([]);
  const [shape, setShape] = useState<Shape>({ rows: 1, cols: 2 });
  const [first, setFirst] = useState<Cell | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);
  const hoverForFeedback = useRef<Cell | null>(null);
  hoverForFeedback.current = hover;
  const [selectionFeedback, setSelectionFeedback] = useState<PatchIssue | null>(null);
  const [invalidPick, setInvalidPick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [transition, setTransition] = useState<Transition | null>(null);
  const transitionId = useRef(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<Notice | null>(initial.warning ? { message: initial.warning, error: true } : null);
  const [soundOn, setSoundOn] = useState(false);
  const audio = useRef<IslandAudio | null>(null);
  const [myRank, setMyRank] = useState<MyRank | null>(null);
  const [community, setCommunity] = useState<{ players: number; source: 'local' | 'reddit' } | null>(null);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [standings, setStandings] = useState<StandingsState>({ status: 'idle' });
  const [standingsOpen, setStandingsOpen] = useState(false);
  const standingsRequest = useRef(0);
  const automaticStandings = useRef<{ revision: number; saved: boolean } | null>(null);
  const resultCard = useRef<HTMLDivElement>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [replayMode, setReplayMode] = useState<'replay' | 'removed' | null>(null);
  const [replayRankError, setReplayRankError] = useState<string | null>(null);
  const [replayRankRetry, setReplayRankRetry] = useState(0);
  const completedDailies = useRef(new Set<string>());
  const [autoSaveSuppressed, setAutoSaveSuppressed] = useState(false);
  const [savedSolveMs, setSavedSolveMs] = useState<number | null>(null);
  const [solveId, setSolveId] = useState<string | null>(null);
  const saveRequest = useRef(0);
  const [timerGeneration, setTimerGeneration] = useState(0);
  const [boardReady, setBoardReady] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const celebrationId = useRef(0);
  const [revision, setRevision] = useState(0);
  const currentRevision = useRef(0);
  const finishedRevision = useRef(-1);
  const arrivals = useRef(new Set<Anchor>());
  const [arrived, setArrived] = useState<Anchor[]>([]);
  const [travelerMoving, setTravelerMoving] = useState(false);
  const [arrivalComplete, setArrivalComplete] = useState(false);
  const [resultRevealed, setResultRevealed] = useState(false);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [guideBounds, setGuideBounds] = useState<GuideTarget | null>(null);
  const [guideProbesDone, setGuideProbesDone] = useState<string[]>([]);
  const [guideFeedback, setGuideFeedback] = useState<TutorialProbe | null>(null);
  const celebrationHold = useRef<{ revision: number; flat: boolean; clock: CelebrationHold } | null>(null);
  const [frameAxes, setFrameAxes] = useState<FrameAxes>(FLAT_AXES);
  const guideWrites = useRef(new Set<Promise<void>>());
  const [practiceLoading, setPracticeLoading] = useState<string | null>(null);
  const [practiceBefore, setPracticeBefore] = useState<{ stars: number; best: number | null; worlds: number }>({ stars: 0, best: null, worlds: 1 });
  const practiceRequest = useRef(0);
  const warnedStorage = useRef(false);
  const stageSection = useRef<HTMLElement>(null);
  const rankEdition = run?.kind === 'daily' ? run.edition : null;
  const timed = run !== null && run.kind !== 'guide';
  const timer = useSolveTimer(timerGeneration, rankEdition, timed, boardReady, dialog === null);
  const firstResultOnly = rankEdition !== null && firstDailyResultOnly(rankEdition);
  const replayStatus = firstResultOnly ? replayMode ??
    (timer.attempt?.ranking === 'replay' || timer.attempt?.ranking === 'removed' ? timer.attempt.ranking : null) : null;

  const notify = useCallback((message: string, error = false) => setNotice({ message, error }), []);
  const progressSync = usePracticeSync(bootstrap, preferences, setPreferences);
  const syncGuides = useCallback((topics: readonly GuideTopic[], signedIn: boolean): void => {
    if (!signedIn || topics.length === 0) return;
    const request = gameApi.rememberGuides(topics).catch((error: unknown) => {
      console.error('Walkthrough choices could not sync:', error);
      notify(`Guide choices could not sync: ${messageOf(error)} You can still play, but may see the guide again on another device.`, true);
    });
    guideWrites.current.add(request);
    void request.finally(() => { guideWrites.current.delete(request); });
  }, [notify]);
  const restartPlayback = useCallback(() => {
    setRevision(++currentRevision.current);
    arrivals.current = new Set();
    setArrived([]);
    setTravelerMoving(false);
    setArrivalComplete(false);
    setResultRevealed(false);
    setResultDismissed(false);
    celebrationHold.current = null;
    setCelebration(null);
  }, []);
  const fallback = useCallback((message: string) => {
    setBusy(false);
    setPreferences((current) => ({ ...current, flat: true }));
    notify(message, true);
  }, [notify]);

  const begin = useCallback((next: Run) => {
    setScreen('game');
    setRecordedDaily(null);
    setLoading(false);
    setLoadError(null);
    practiceRequest.current++;
    setPracticeLoading(null);
    setRun(next);
    const saved = preferencesRef.current;
    const best = saved.practice?.bests[next.puzzle.id];
    const earned = next.kind === 'studio' && !next.puzzle.archived ? campaignAchievements(catalogRef.current, saved.completed,
      saved.practice ?? initializePracticeProgress(catalogRef.current, saved.completed)).get(next.puzzle.id) : undefined;
    setPracticeBefore({ stars: next.kind === 'studio' ? earned?.stars ?? practiceStars(next.puzzle, best, saved.completed.includes(next.puzzle.id)) : 0,
      best: best ?? null, worlds: saved.practice?.unlockedWorlds ?? 1 });
    setPendingRun(null);
    setBoard(next.puzzle.board);
    setMoves([]);
    setFirst(null);
    setHover(null);
    setSelectionFeedback(null);
    setShape(next.kind === 'guide' ? tutorialLesson(next.puzzle.id).startShape : defaultShape(next.puzzle));
    setGuideProbesDone([]);
    setGuideFeedback(null);
    setNotice(null);
    setTransition(null);
    setBusy(false);
    setPublished(false);
    setReplayMode(null);
    setReplayRankError(null);
    setMyRank(null);
    saveRequest.current++;
    setPublishing(false);
    setSaveError(null);
    setAutoSaveSuppressed(false);
    setSavedSolveMs(null);
    setSolveId(null);
    setBoardReady(false);
    setTimerGeneration((current) => current + 1);
    setDialog(null);
    setDialogError(null);
    restartPlayback();
  }, [restartPlayback]);

  const startWalkthrough = useCallback((): void => {
    begin({ puzzle: TUTORIAL, kind: 'guide', edition: null, number: null });
    setDialog('welcome');
  }, [begin]);

  const openRun = useCallback((next: Run, seen: readonly GuideTopic[]): void => {
    if (newTileGuides(next.puzzle.board, seen).length) {
      setPendingRun(next);
      setDialog('tiles');
    } else begin(next);
  }, [begin]);

  const openDaily = useCallback((edition: Edition, seen: readonly GuideTopic[]): void => {
    if (!seen.includes('basics')) {
      notify('Finish the lesson and picture cards to unlock today.', true);
      return;
    }
    openRun({ puzzle: edition.puzzle, kind: 'daily', edition: edition.id, number: edition.number }, seen);
  }, [openRun, notify]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setScreen('home');
    setRun(null);
    setPendingRun(null);
    setRecordedDaily(null);
    try {
      const data = await gameApi.bootstrap();
      setBootstrap(data);
      const localSeen = preferencesRef.current.seenGuides;
      const seen = mergeGuideTopics(localSeen, data.seenGuides);
      setPreferences((current) => ({ ...current, seenGuides: mergeGuideTopics(current.seenGuides, seen),
        practice: advancePracticeWorlds(data.catalog, current.completed,
          current.practice ?? initializePracticeProgress(data.catalog, current.completed)) }));
      syncGuides(localSeen.filter((topic) => !data.seenGuides.includes(topic)), data.playerName !== null);
      if (CRAFT_TOUR && !craftTourOpened.current) {
        craftTourOpened.current = true;
        startWalkthrough();
      }
      const storageWarning = takeStorageNotice();
      if (storageWarning) notify(storageWarning, true);
    } catch (error) {
      console.error('Detour could not load:', error);
      setLoadError(messageOf(error));
    } finally {
      setLoading(false);
    }
  }, [startWalkthrough, notify, syncGuides]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!loading && !loadError && screen !== 'game') {
      document.getElementById(screen === 'home' ? 'home-title' : 'saved-daily-title')?.focus({ preventScroll: true });
    }
  }, [screen, loading, loadError]);
  useEffect(() => {
    const instrument = new IslandAudio((message) => {
      setSoundOn(false);
      setPreferences((current) => ({ ...current, soundWanted: false }));
      notify(message, true);
    }, setSoundOn);
    audio.current = instrument;
    return () => { instrument.dispose(); audio.current = null; };
  }, [notify]);
  useEffect(() => {
    const start = (): void => {
      const instrument = audio.current;
      if (!preferences.soundWanted || document.hidden || !instrument) return;
      try {
        setSoundOn(instrument.tryAutoplay());
      } catch (error) {
        console.error('Could not start the default soundscape:', error);
        instrument.disable();
        setPreferences((current) => ({ ...current, soundWanted: false }));
        notify(messageOf(error), true);
      }
    };
    start();
    document.addEventListener('visibilitychange', start);
    return () => document.removeEventListener('visibilitychange', start);
  }, [preferences.soundWanted, notify]);
  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(preferences));
      if (preferences.practiceAccount) localStorage.setItem(PRACTICE_FENCE_KEY, JSON.stringify(preferences.practiceAccount));
    }
    catch (error) {
      console.warn('Detour progress could not be saved:', error);
      if (!warnedStorage.current) {
        warnedStorage.current = true;
        notify('This browser is not saving local discoveries. You can still play; village-board scores are stored separately.', true);
      }
    }
  }, [preferences, notify]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.error ? 7500 : 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const clear = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !dialog) { setFirst(null); setHover(null); setSelectionFeedback(null); }
    };
    window.addEventListener('keydown', clear);
    return () => window.removeEventListener('keydown', clear);
  }, [dialog]);

  useEffect(() => {
    if (!bootstrap || !dailyClock) return;
    const offset = dailyClock.serverOffsetMs;
    let active = true;
    let refreshing = false;
    const tick = (): void => {
      const remaining = Math.max(0, Date.parse(bootstrap.nextReset) - (Date.now() + offset));
      if (remaining === 0 && !refreshing) {
        refreshing = true;
        void gameApi.bootstrap().then((data) => {
          if (!active) return;
          setBootstrap(data);
          if (data.edition?.id !== bootstrap.edition?.id) {
            notify('A new Daily island is ready. Open Home when you are ready; your current repair is safe.');
          }
        }).catch((error: unknown) => {
          console.error('Daily rollover could not refresh:', error);
          if (active) notify('A new day is here, but the next island could not refresh. Your current repair is safe.', true);
        }).finally(() => { refreshing = false; });
      }
    };
    const visible = (): void => { if (!document.hidden) tick(); };
    tick();
    const timer = window.setInterval(tick, 60_000);
    const boundary = window.setTimeout(tick, Math.max(0, dailyClock.resetAtMs - Date.now() - offset) + 10);
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; window.clearInterval(timer); window.clearTimeout(boundary); document.removeEventListener('visibilitychange', visible); };
  }, [bootstrap, dailyClock, notify]);

  const area = run?.puzzle.area ?? 2;
  const rules = useMemo(() => run ? rulesFor(run.puzzle, 'daily') : { areas: [2], budget: 1 }, [run]);
  const check = useMemo<RouteCheck>(() => run ? checkPuzzle(board, run.puzzle) : { solved: false, routes: EMPTY_ROUTES, missing: [] }, [run, board]);
  const roadReady = moves.length > 0 && check.solved;
  const lastHome = run?.puzzle.journey?.at(-1);
  const allHomesArrived = roadReady && lastHome !== undefined && arrived.includes(lastHome);
  const won = roadReady && arrivalComplete && resultRevealed;
  const catalog = bootstrap?.catalog ?? EMPTY_CATALOG;
  const campaign = useMemo(() => campaignPlaces(catalog), [catalog]);
  const practiceProgress = useMemo(() => preferences.practice ?? initializePracticeProgress(catalog, preferences.completed),
    [preferences.practice, catalog, preferences.completed]);
  const achievements = useMemo(() => campaignAchievements(catalog, preferences.completed, practiceProgress), [catalog, preferences.completed, practiceProgress]);
  const worlds = useMemo(() => campaignWorlds(campaign.length), [campaign.length]);
  const currentCampaignIndex = run?.kind === 'studio' ? run.puzzle.campaignSlot ?? run.puzzle.originalSlot ??
    campaign.findIndex((place) => place.id === run.puzzle.id || place.legacyId === run.puzzle.id) : -1;
  const currentWorld = currentCampaignIndex >= 0 ? worlds[Math.floor(currentCampaignIndex / PRACTICE_WORLD_SIZE)] : null;
  const nextCampaign = useMemo(() => nextCampaignPlace(catalog, preferences.completed, practiceProgress), [catalog, preferences.completed, practiceProgress]);
  const nextCampaignIndex = nextCampaign ? campaign.findIndex((place) => place.id === nextCampaign.id) : -1;
  const replayForStars = nextCampaign !== null && achievements.get(nextCampaign.id)?.completed === true;
  const currentAchievement = currentCampaignIndex >= 0 ? achievements.get(campaign[currentCampaignIndex]?.id ?? '') : undefined;
  const originalTarget = run?.kind === 'studio' && currentCampaignIndex >= 0 ? run.puzzle.archived ?
    campaign[currentCampaignIndex]?.id : completedOriginalRoad(catalog, preferences.completed, run.puzzle.id) : null;
  const practiceAward = run?.kind === 'studio' && roadReady ? practiceStars(run.puzzle, moves.length, true) : 0;
  const bestPracticeStars = Math.max(practiceBefore.stars, practiceAward);
  const gateWorld = replayForStars ? worlds[practiceProgress.unlockedWorlds - 1] : null;
  const activeGoalWorld = useMemo(() => {
    const world = worlds[practiceProgress.unlockedWorlds - 1];
    if (!world || practiceProgress.unlockedWorlds >= worlds.length) return null;
    return { stars: worldStars(world, catalog, preferences.completed, practiceProgress), required: worldStarRequirement(world), nextIsland: world.index + 2 };
  }, [worlds, practiceProgress, catalog, preferences.completed]);
  const currentWorldGoal = useMemo(() => {
    if (!currentWorld || currentWorld.index + 1 >= worlds.length || currentWorld.index + 1 < practiceProgress.unlockedWorlds) return null;
    const stars = worldStars(currentWorld, catalog, preferences.completed, practiceProgress);
    const required = worldStarRequirement(currentWorld);
    return { title: currentWorld.title, stars, required, remaining: Math.max(0, required - stars), nextIsland: currentWorld.index + 2 };
  }, [currentWorld, worlds.length, practiceProgress, catalog, preferences.completed]);
  const playback = useMemo<JourneyPlayback | null>(() => {
    const plan = roadReady && !arrivalComplete ? check.journey : null;
    return plan ? { revision, plan } : null;
  }, [roadReady, check.journey, revision, arrivalComplete]);
  const restingStop: Anchor = arrived.at(-1) ?? 'A';
  const routes = roadReady ? check.routes : EMPTY_ROUTES;
  const footprint = moves.reduce((total, move) => total + 2 * patchArea(move), 0);
  const shapes = useMemo(() => shapesFor(area, board.length || 6, run?.puzzle.frame), [area, board.length, run?.puzzle.frame]);
  const guideLesson = run?.kind === 'guide' ? tutorialLesson(run.puzzle.id) : null;
  const guideLessonIndex = guideLesson ? TUTORIAL_LESSONS.indexOf(guideLesson) : -1;
  const nextGuideLesson = guideLesson ? TUTORIAL_LESSONS[guideLessonIndex + 1] ?? null : null;
  const guideMove = guideLesson?.moves[moves.length] ?? null;
  const guideProbe = guideLesson ? pendingTutorialProbe(guideLesson, moves.length, guideProbesDone) : null;
  const guideRepair = guideLesson?.repairs[moves.length] ?? null;
  const guideStage = guideLesson ? guideProbe || guideLesson.moves.length === 0 ? 'check' : tutorialStage(shape, first, roadReady, guideMove) : null;
  const hoverIssue = useMemo(() => {
    if (!hover || !run || run.kind === 'guide' || roadReady || busy || !timer.canPlay) return null;
    return selectionIssue(board, hover, shape, first);
  }, [hover, first, shape, board, run, roadReady, busy, timer.canPlay]);
  const feedback = selectionFeedback ?? hoverIssue;
  const probeFeedbackCells = useMemo(() => guideFeedback ? [guideFeedback.cell] : EMPTY_CELLS, [guideFeedback]);
  const feedbackCells = feedback?.cells ?? probeFeedbackCells;
  useEffect(() => {
    if (!guideFeedback || !guideLesson || dialog !== null || !pageVisible || !boardReady) return;
    const finishedChecks = guideLesson.moves.length === 0 && !guideProbe;
    if (guideFeedback.blockedToward) return;
    const timeout = window.setTimeout(() => {
      if (finishedChecks) {
        if (!nextGuideLesson) { notify('The next guided lesson could not be found. Return home and restart the guide.', true); return; }
        begin({ puzzle: nextGuideLesson.puzzle, kind: 'guide', edition: null, number: null });
        return;
      }
      setGuideFeedback(null);
    }, finishedChecks ? 250 : 600);
    return () => window.clearTimeout(timeout);
  }, [guideFeedback, guideProbe, guideLesson, nextGuideLesson, dialog, pageVisible, boardReady, begin, notify]);
  useEffect(() => {
    if (!feedback) return;
    const capturedHover = hoverForFeedback.current;
    const expiry = window.setTimeout(() => {
      setSelectionFeedback((current) => current === feedback ? null : current);
      // Touch keeps its hover after a tap, which would otherwise recreate the error.
      setHover((current) => current === capturedHover ? null : current);
    }, 1000);
    return () => window.clearTimeout(expiry);
  }, [feedback]);
  const onHover = useCallback((cell: Cell | null) => {
    const previous = hoverForFeedback.current;
    if (previous?.row === cell?.row && previous?.col === cell?.col) return;
    setHover(cell);
    if (cell) setSelectionFeedback(null);
  }, []);
  const updateGuideBounds = useCallback((next: GuideTarget | null) => {
    setGuideBounds((current) => sameGuideTarget(current, next) ? current : next);
  }, []);

  const onArrival = useCallback((eventRevision: number, stop: JourneyStop) => {
    if (!run || !roadReady || eventRevision !== currentRevision.current || arrivals.current.has(stop.anchor)) return;
    arrivals.current.add(stop.anchor);
    setArrived([...arrivals.current]);
    const journey = run.puzzle.journey;
    const complete = journey?.at(-1) === stop.anchor;
    setCelebration({
      id: ++celebrationId.current,
      anchors: complete && journey ? [...journey] : [stop.anchor],
      complete,
    });
    audio.current?.destination(arrivals.current.size);
  }, [run, roadReady]);

  const onJourneyEnd = useCallback((eventRevision: number) => {
    if (!run || !roadReady || eventRevision !== currentRevision.current || finishedRevision.current === eventRevision) return;
    finishedRevision.current = eventRevision;
    setArrivalComplete(true);
    audio.current?.finish(check.journey?.path ?? []);
    if (run.kind === 'guide') return;
    setPreferences((current) => {
      const completed = current.completed.includes(run.puzzle.id) ? current.completed : [...current.completed, run.puzzle.id];
      if (run.kind !== 'studio') return completed === current.completed ? current : { ...current, completed };
      const previous = current.practice ?? initializePracticeProgress(campaign, current.completed);
      const practice = advancePracticeWorlds(catalog, completed, recordPracticeMoves(previous, run.puzzle, moves.length));
      return completed === current.completed && practice === current.practice ? current : { ...current, completed, practice };
    });
  }, [run, roadReady, check.journey, campaign, catalog, moves.length]);

  useEffect(() => {
    if (!allHomesArrived || resultRevealed || dialog || !boardReady) return;
    if (!celebrationHold.current || celebrationHold.current.revision !== revision || celebrationHold.current.flat !== preferences.flat) {
      celebrationHold.current = { revision, flat: preferences.flat, clock: run?.kind === 'guide' ? new CelebrationHold(650) :
        POSTCARD_PREVIEW ? new CelebrationHold(3000) : new CelebrationHold() };
    }
    const hold = celebrationHold.current;
    let active = true;
    let frameId = 0;
    let previousTime = performance.now();
    const resetTime = (): void => { previousTime = performance.now(); };
    const tick = (now: number): void => {
      if (!active || hold.revision !== currentRevision.current) return;
      const elapsed = Math.min(60, Math.max(0, now - previousTime));
      previousTime = now;
      if (hold.clock.advance(elapsed, !document.hidden)) {
        setResultRevealed(true);
        return;
      }
      frameId = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', resetTime);
    frameId = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', resetTime);
    };
  }, [allHomesArrived, resultRevealed, dialog, boardReady, revision, preferences.flat, run?.kind]);

  const resumePreferredSound = useCallback(() => {
    const instrument = audio.current;
    if (preferences.soundWanted && instrument && !instrument.enabled) {
      void instrument.enable().then(() => {
        if (audio.current === instrument) setSoundOn(instrument.enabled);
      }).catch((error: unknown) => {
        if (audio.current !== instrument) return;
        console.error('Could not start the preferred soundscape:', error);
        setSoundOn(false);
        setPreferences((current) => ({ ...current, soundWanted: false }));
        notify(messageOf(error), true);
      });
    }
  }, [preferences.soundWanted, notify]);

  const commitSwap = useCallback((a: Cell, b: Cell): void => {
    if (!run || !timer.canPlay || busy || travelerMoving || roadReady) return;
    const solvedAt = performance.now();
    try {
      const move = { a, b, ...shape };
      const next = applySwap(board, move, rules, moves.length);
      const nextCheck = checkPuzzle(next, run.puzzle);
      if (nextCheck.solved) {
        const identifier = crypto.randomUUID();
        timer.stop(solvedAt);
        setSolveId(identifier);
      }
      const hasWater = [...patchCells(a, shape), ...patchCells(b, shape)].some((cell) => tileAt(board, cell) === '~');
      audio.current?.swap(hasWater);
      restartPlayback();
      setBusy(!reducedMotion);
      setBoard(next);
      setMoves((current) => [...current, move]);
      setTransition({ id: ++transitionId.current, move });
      setFirst(null); setHover(null); setSelectionFeedback(null); setPublished(false);
    } catch (error) {
      console.error('Patch exchange failed:', error);
      notify(messageOf(error), !(error instanceof RuleError));
    }
  }, [run, timer.canPlay, timer.stop, busy, travelerMoving, roadReady, shape, board, rules, moves.length, reducedMotion, restartPlayback, notify]);

  const onCell = useCallback((picked: Cell) => {
    if (!run || !timer.canPlay || busy) return;
    resumePreferredSound();
    if (travelerMoving) { notify('Let the traveler finish the delivery.'); return; }
    if (roadReady) { notify(allHomesArrived ? 'Journey complete. Choose another stop or replay from the map.' : 'The traveler is on the way.'); return; }
    if (guideProbe) {
      if (picked.row !== guideProbe.cell.row || picked.col !== guideProbe.cell.col) {
        notify(guideProbe.instruction);
        return;
      }
      setGuideProbesDone((completed) => [...completed, guideProbe.id]);
      setGuideFeedback(guideProbe);
      setInvalidPick((current) => current + 1);
      if (!reducedMotion) navigator.vibrate?.(35);
      setFirst(null);
      setHover(null);
      setSelectionFeedback(null);
      setNotice(null);
      return;
    }
    if (guideLesson?.moves.length === 0) return;
    if (run.kind === 'guide' && guideStage === 'frame') { notify('First choose the glowing frame beside the board.'); return; }
    if (moves.length >= rules.budget) { notify('This attempt has reached its exchange limit. Choose the island again to start fresh.'); return; }
    const cell = run.kind === 'guide' && guideMove ? guidePatchStart(picked, guideMove, first) : picked;
    const issue = selectionIssue(board, cell, shape, first);
    if (issue) {
      setHover(cell);
      setSelectionFeedback(issue);
      setInvalidPick((current) => current + 1);
      if (!reducedMotion) navigator.vibrate?.(35);
      return;
    }
    setSelectionFeedback(null);
    if (first?.row === cell.row && first.col === cell.col) {
      setFirst(null); setHover(null); return;
    }
    if (!first) {
      if (run.kind === 'guide' && (cell.row !== guideMove?.a.row || cell.col !== guideMove?.a.col)) {
        notify('Tap inside the outlined orange patch. The arrow marks its start.');
        return;
      }
      setFirst(cell); setHover(null); audio.current?.select(false);
    } else {
      if (run.kind === 'guide' && (cell.row !== guideMove?.b.row || cell.col !== guideMove?.b.col)) {
        notify('Tap inside the outlined blue patch to exchange both patches.');
        return;
      }
      audio.current?.select(true);
      setGuideFeedback(null);
      commitSwap(first, cell);
    }
  }, [run, timer.canPlay, busy, travelerMoving, allHomesArrived, roadReady, moves.length, rules.budget, board, shape, first, guideStage, guideMove, guideProbe, guideLesson, notify, resumePreferredSound, commitSwap, reducedMotion]);

  const reset = (): void => {
    if (!run || busy) return;
    setBoard(run.puzzle.board); setMoves([]); setTransition(null);
    setFirst(null); setHover(null); setSelectionFeedback(null); setPublished(false);
    setGuideProbesDone([]);
    setGuideFeedback(null);
    setMyRank(null);
    setReplayMode(null);
    setReplayRankError(null);
    restartPlayback();
    saveRequest.current++;
    setPublishing(false);
    setSaveError(null);
    setAutoSaveSuppressed(false);
    setSavedSolveMs(null);
    setSolveId(null);
    setTimerGeneration((current) => current + 1);
    audio.current?.undo();
  };

  const rememberGuides = (topics: readonly GuideTopic[]): GuideTopic[] => {
    const seen = mergeGuideTopics(preferencesRef.current.seenGuides, topics);
    const next = { ...preferencesRef.current, seenGuides: seen };
    preferencesRef.current = next;
    setPreferences(next);
    syncGuides(topics, bootstrap !== null && bootstrap.playerName !== null);
    return seen;
  };

  const finishWalkthrough = (skip: boolean): void => {
    if (skip) { visitToday();return; }
    const edition = bootstrap?.edition;
    const seen = preferencesRef.current.seenGuides;
    if (edition && homeDaily.state.status === 'ready') openDaily(edition, seen);
    else visitToday();
  };

  const acceptTileGuide = (): void => {
    if (!pendingRun) { notify('That island changed. Please choose it again.', true); setDialog(null); return; }
    const next = pendingRun;
    rememberGuides(newTileGuides(next.puzzle.board, preferencesRef.current.seenGuides));
    begin(next);
  };

  const visitToday = (): void => {
    practiceRequest.current++;
    saveRequest.current++;
    setPracticeLoading(null);
    setPublishing(false);
    setRun(null);
    setPendingRun(null);
    setRecordedDaily(null);
    setBoardReady(false);
    setBusy(false);
    setDialog(null);
    setDialogError(null);
    setScreen('home');
    restartPlayback();
    homeDaily.refresh();
  };

  const openPractice = (id: string): void => {
    if (!bootstrap) { notify('The world map is still loading.'); return; }
    const gate = practiceGate(bootstrap.catalog, preferences.completed, id, practiceProgress);
    if (!gate.unlocked) { setDialogError(gate.reason); return; }
    const request = ++practiceRequest.current;
    setPracticeLoading(id);
    setDialogError(null);
    const seen = preferencesRef.current.seenGuides;
    void gameApi.place(id).then((puzzle) => {
      if (request === practiceRequest.current) {
        const index = puzzle.campaignSlot ?? puzzle.originalSlot ?? campaign.findIndex((place) => place.id === id || place.legacyId === id);
        const world = worlds[Math.floor(index / PRACTICE_WORLD_SIZE)];
        if (!world) throw new Error('That Practice stop has no world.');
        openRun({ puzzle: { ...puzzle, theme: world.theme }, kind: 'studio', edition: null, number: null }, seen);
      }
    }).catch((error: unknown) => {
      console.error('The practice island could not load:', error);
      if (request === practiceRequest.current) {
        setDialogError(messageOf(error));
        if (dialog !== 'atlas') notify(messageOf(error), true);
      }
    }).finally(() => {
      if (request === practiceRequest.current) setPracticeLoading(null);
    });
  };

  const continuePractice = (): void => {
    if (replayForStars || !nextCampaign) {
      setResultDismissed(true);
      setDialogError(null);
      setDialog('atlas');
    } else openPractice(nextCampaign.id);
  };

  const toggleSound = async (): Promise<void> => {
    const instrument = audio.current;
    if (!instrument) return;
    try {
      if (preferences.soundWanted) {
        instrument.disable();
        setSoundOn(false);
        setPreferences((current) => ({ ...current, soundWanted: false }));
      } else {
        await instrument.enable();
        if (instrument.enabled) {
          setSoundOn(true);
          setPreferences((current) => ({ ...current, soundWanted: true }));
        }
      }
    } catch (error) {
      console.error('Could not enable the soundscape:', error);
      notify(messageOf(error), true);
    }
  };

  const publish = useCallback(async (): Promise<void> => {
    const attemptId = timer.attempt?.id;
    if (!run?.edition || run.kind !== 'daily' || !roadReady || !attemptId || !solveId || publishing || autoSaveSuppressed || replayStatus) return;
    const savingRequest = ++saveRequest.current;
    const savedRevision = currentRevision.current;
    setPublishing(true);
    setSaveError(null);
    setSaveError(null);
    try {
      const result = await gameApi.submit({ edition: run.edition, mode: 'daily', moves, attemptId, solveId });
      if (result.ranking === 'removed') {
        if (savedRevision === currentRevision.current && savingRequest === saveRequest.current) {
          completedDailies.current.add(run.edition);
          setReplayMode('removed');
          setMyRank(null);
          setPublished(false);
        }
        return;
      }
      if (!result.yourBest || result.yourBest.solveMs === undefined || result.saved.solveMs === null) {
        throw new Error('The route was checked, but no timed rank was recorded. Please retry.');
      }
      if (savedRevision === currentRevision.current && savingRequest === saveRequest.current) {
        if (firstDailyResultOnly(run.edition)) {
          completedDailies.current.add(run.edition);
          if (result.ranking === 'replay') setReplayMode('replay');
        }
        setMyRank({
          edition: run.edition, rank: result.yourBest.rank, swaps: result.yourBest.swaps,
          solveMs: result.yourBest.solveMs, participants: result.players, topPercent: result.topPercent, source: result.source,
        });
        setPublished(true);
        setSavedSolveMs(result.saved.solveMs);
        setNotice((current) => current?.message.startsWith('Score not saved: ') ? null : current);
      }
    } catch (error) {
      console.error('Could not submit the repair:', error);
      if (savingRequest === saveRequest.current) {
        setSaveError(messageOf(error));
        notify(`Score not saved: ${messageOf(error)}`, true);
      }
    } finally {
      if (savingRequest === saveRequest.current) setPublishing(false);
    }
  }, [run, timer.attempt?.id, solveId, roadReady, publishing, autoSaveSuppressed, moves, notify, replayStatus]);

  useEffect(() => {
    if (roadReady && timer.phase === 'solved' && timer.attempt?.id && !published && !publishing && !saveError && !autoSaveSuppressed) {
      void publish();
    }
  }, [roadReady, timer.phase, timer.attempt?.id, published, publishing, saveError, autoSaveSuppressed, publish]);

  useEffect(() => {
    if (!replayStatus || !rankEdition || !roadReady || autoSaveSuppressed) return;
    completedDailies.current.add(rankEdition);
    const savedRevision = currentRevision.current;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setReplayRankError(null);
    void gameApi.myRank(rankEdition, controller.signal).then((rank) => {
      if (!active || savedRevision !== currentRevision.current) return;
      setMyRank(rank);
      setPublished(rank.rank !== null);
      setCommunity({ players: rank.participants, source: rank.source });
      setCommunityError(null);
      if (rank.rank === null) setReplayMode('removed');
    }).catch((error: unknown) => {
      console.error('The first Daily result could not be loaded:', error);
      if (active && savedRevision === currentRevision.current) setReplayRankError(controller.signal.aborted ?
        'Your recorded result took too long to load. Retry when your connection is ready.' : messageOf(error));
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [replayStatus, rankEdition, roadReady, autoSaveSuppressed, replayRankRetry]);

  useEffect(() => {
    if (!POSTCARD_PREVIEW) return;
    standingsRequest.current++;
    automaticStandings.current = null;
    setStandings({ status: 'idle' });
    setStandingsOpen(false);
    setCommunity(null);
    setCommunityError(null);
    return () => { standingsRequest.current++; };
  }, [revision, autoSaveSuppressed]);

  useEffect(() => {
    if (!POSTCARD_PREVIEW || autoSaveSuppressed || replayStatus || run?.kind !== 'daily' || !run.edition || !roadReady) return;
    if (published && myRank?.edition === run.edition) {
      setCommunity({ players: myRank.participants, source: myRank.source });
      setCommunityError(null);
      return;
    }
    if (!bootstrap || bootstrap.playerName !== null) return;
    let active = true;
    const savedRevision = currentRevision.current;
    void gameApi.myRank(run.edition).then((result) => {
      if (active && savedRevision === currentRevision.current) setCommunity({ players: result.participants, source: result.source });
    }).catch((error: unknown) => {
      console.error('Could not load the saved-finisher count:', error);
      if (active && savedRevision === currentRevision.current) setCommunityError(messageOf(error));
    });
    return () => { active = false; };
  }, [run, roadReady, published, myRank, bootstrap, autoSaveSuppressed, replayStatus]);

  const loadStandings = useCallback(async (open = true): Promise<void> => {
    if (!POSTCARD_PREVIEW || !won || run?.kind !== 'daily' || !run.edition) return;
    const request = ++standingsRequest.current;
    const savedRevision = currentRevision.current;
    if (open) setStandingsOpen(true);
    setStandings({ status: 'loading' });
    try {
      const board = await gameApi.standings(run.edition);
      if (request !== standingsRequest.current || savedRevision !== currentRevision.current) return;
      setStandings({ status: 'ready', board });
      setCommunity({ players: board.players, source: board.source });
      setCommunityError(null);
    } catch (error) {
      console.error('Could not load Daily standings:', error);
      if (request === standingsRequest.current && savedRevision === currentRevision.current) setStandings({ status: 'error', message: messageOf(error) });
    }
  }, [won, run]);

  useEffect(() => {
    if (!won || resultDismissed || dialog || autoSaveSuppressed || run?.kind !== 'daily' || !run.edition) return;
    const saved = published && myRank?.edition === run.edition;
    const previous = automaticStandings.current;
    if (previous?.revision === revision && previous.saved === saved) return;
    automaticStandings.current = { revision, saved };
    void loadStandings(previous?.revision !== revision);
  }, [won, resultDismissed, dialog, autoSaveSuppressed, run, published, myRank?.edition, revision, loadStandings]);

  useLayoutEffect(() => { resultCard.current?.scrollTo(0, 0); }, [standingsOpen]);

  const elapsedMs = savedSolveMs ?? timer.elapsedMs;

  const todayLabel = run?.edition ? new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${run.edition}T12:00:00Z`)) : 'A place of your own';
  const nextStop = run?.puzzle.journey?.[arrived.length + 1];
  const status = !timer.canPlay ? timer.phase === 'countdown' ? 'Get ready.' : 'Preparing the timer...' :
    busy ? 'Exchanging...' : allHomesArrived ? 'Everyone made it home!' : travelerMoving ? `On the way to ${nextStop ?? 'the final home'}...` :
    roadReady ? nextStop ? `Next stop: ${nextStop}` : 'Final stop reached.' :
    moves.length >= rules.budget ? 'Exchange limit reached. Start a fresh island.' :
    run?.kind === 'guide' ? guideProbe?.instruction ?? (guideStage === 'frame' ? 'Choose the glowing frame.' : !first ? 'Tap the orange patch.' : 'Tap the blue patch.') :
    !first ? shape.rows > 1 && shape.cols > 1 ? 'Pick patch 1 (top-left)' :
      shape.rows > shape.cols ? 'Pick patch 1 (top)' : 'Pick patch 1 (left)' : 'Pick patch 2 · tap 1st to cancel';
  const earnedRank = won && published && run?.kind === 'daily' && myRank?.edition === run.edition && myRank.rank !== null ? myRank : null;
  const rankLabel = run?.edition === bootstrap?.edition?.id ? 'today' : `on ${todayLabel}`;
  const pendingTopics = pendingRun ? newTileGuides(pendingRun.puzzle.board, preferences.seenGuides) : [];
  const guestDailyComplete = bootstrap?.playerName === null && homeDaily.state.status === 'ready' &&
    bootstrap.edition !== null && preferences.completed.includes(bootstrap.edition.puzzle.id);
  const completionOpen = won && !busy && !resultDismissed && dialog === null;
  const guideInstruction = busy ? 'Watch the swap.' : guideProbe ? guideProbe.instruction :
    guideLesson?.moves.length === 0 && guideFeedback ? guideFeedback.answer : guideStage === 'frame' ?
    `Tap the ${guideMove?.rows === 1 ? 'wide' : 'tall'} frame.` : guideStage === 'home' ? 'Watch the way home.' :
      (guideStage === 'second' ? guideRepair?.second : guideRepair?.first) ?? 'Choose the outlined patch.';
  const guideDetail = (guideProbe ? guideFeedback?.response ?? guideProbe.detail :
    guideFeedback && (guideStage === 'frame' || guideLesson?.moves.length === 0) ? guideFeedback.response : null) ?? (guideStage === 'frame' ?
    `Start at the ${guideMove?.rows === 1 ? 'left' : 'top'} tile. The frame changes; the tiles never rotate.` :
    guideRepair?.detail ?? 'The whole road comes first. Then everyone goes home.');
  const soundToggle = <button className={`icon-button sound-toggle ${preferences.soundWanted ? 'sound-is-on' : ''}`} onClick={() => { void toggleSound(); }}
    aria-label={preferences.soundWanted ? 'Turn sound off' : 'Turn sound on'} aria-pressed={preferences.soundWanted}
    title={soundOn ? 'Soundscape on' : preferences.soundWanted ? 'The browser is waiting for a tap to enable sound. Tap here to mute.' : 'Listen to the island'}>
    <Icon name={preferences.soundWanted ? 'sound' : 'mute'}/>
  </button>;

  return <GardenArtContext.Provider value={GARDEN_PREVIEW}><CraftArtContext.Provider value={CRAFT_PREVIEW}><div className={`app-shell focused-game direct-play viewport-fit ${GARDEN_PREVIEW ? 'art-realistic' : ''} ${CRAFT_PREVIEW ? 'craft-preview' : ''} ${reducedMotion ? 'reduce-motion' : ''}`}
    style={worldCssVariables(run?.puzzle.theme ?? pendingRun?.puzzle.theme ?? recordedDaily?.edition.puzzle.theme ?? bootstrap?.edition?.puzzle.theme ?? 'meadow', dark, CRAFT_PREVIEW)}
    data-appearance={dark ? 'dark' : 'light'} data-onboarding={run?.kind === 'guide' ? 'practice' : dialog === 'tiles' ? 'tiles' : 'complete'}
    data-page-visible={pageVisible}
    data-screen={screen}
    data-guide-step={run?.kind === 'guide' ? guideStage : undefined}
    data-guide-exchange={guideLesson ? Math.min(moves.length + 1, guideLesson.moves.length) : undefined}
    data-guide-lesson={guideLesson ? guideLessonIndex + 1 : undefined} data-guide-probe={guideProbe?.id}
    data-guide-feedback={guideFeedback?.id}
    data-timer-phase={timer.phase} data-score-state={publishing ? 'saving' : published ? 'saved' : saveError ? 'error' : 'idle'}
    data-completion-state={won ? 'result' : allHomesArrived ? 'celebrating' : roadReady ? 'walking' : 'repairing'}
    onClickCapture={(event) => {
      if (event.isTrusted && event.target instanceof Element && !event.target.closest('.sound-toggle')) resumePreferredSound();
    }}>
    {GARDEN_PREVIEW && <GardenArtDefinitions/>}
    {CRAFT_PREVIEW && <CraftTerrainDefinitions/>}
    <ScenicBackdrop/>
    <a className="skip-link" href={screen === 'game' ? '#game-controls' : screen === 'results' ? '#saved-daily-controls' : '#home-controls'}>
      {screen === 'game' ? 'Skip to game controls' : 'Skip to choices'}</a>
    <header className="site-header">
      <button className="wordmark" disabled={loading || busy || publishing} onClick={visitToday} aria-label="One Small Detour, home"
        title={run && moves.length > 0 && !roadReady ? 'Home. Unfinished swaps are not saved.' : 'Home'}>
        <BrandMark/><span className="wordmark-full">one small detour<span className="wordmark-dot">.</span></span><span className="wordmark-compact">detour.</span>
      </button>
      <nav className="header-nav" aria-label="Game navigation">
        <button className="icon-button map-toggle" disabled={!bootstrap || loading} onClick={() => { setDialogError(null); setDialog('atlas'); }}
          aria-label="Practice map" title="Practice map"><Icon name="map"/></button>
        {soundToggle}
        <button className="icon-button theme-toggle" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => setPreferences((current) => ({ ...current,
            appearance: resolveAppearance(current.appearance) === 'dark' ? 'light' : 'dark' }))}>
          <Icon name={dark ? 'sun' : 'moon'} size={21}/>
        </button>
        <button className="icon-button help-toggle" disabled={loading} onClick={() => setDialog('guide')} aria-label="How to play and tile rules" title="How to play and tile rules"><Icon name="help" size={22}/></button>
      </nav>
    </header>

    {loading && <main className="loading-place">{CRAFT_PREVIEW ? <BrandMark/> : <LandscapeIllustration/>}<p className="eyebrow"><Icon name="leaf" size={14}/>A LITTLE PATIENCE</p><h1>Unfolding your little place...</h1><p>The roads, the ponds, the possibilities.</p></main>}
    {!loading && loadError && <main className="loading-place">{CRAFT_PREVIEW ? <BrandMark/> : <LandscapeIllustration theme="coast"/>}<h1>The island is taking its time.</h1><p className="inline-error" role="alert"><Icon name="warning" size={18}/>{loadError}</p><button className="primary-button" onClick={() => { void load(); }}>Try again <Icon name="arrow"/></button></main>}
    {!loading && !loadError && screen === 'home' && bootstrap && dailyClock && <GameHome
      edition={bootstrap.edition} nextDailyClock={dailyClock} daily={homeDaily.state} firstVisit={!preferences.seenGuides.includes('basics')}
      guestComplete={guestDailyComplete} local={bootstrap.source === 'local'} nextPractice={nextCampaign}
      signedIn={bootstrap.playerName !== null}
      reminderIdentity={JSON.stringify([bootstrap.source, bootstrap.community, bootstrap.playerName, reminderRevision])}
      nextPracticeNumber={nextCampaignIndex + 1} completed={[...achievements.values()].filter(value => value.completed).length}
      total={campaign.length} practiceBusy={practiceLoading !== null} practiceSyncing={progressSync.phase === 'loading'}
      practiceNeedsStars={replayForStars}
      islandStarGoal={activeGoalWorld}
      practiceError={dialogError} syncError={progressSync.phase === 'error' ? progressSync.message : null}
      onGuide={startWalkthrough} onRetry={homeDaily.refresh} onRetrySync={progressSync.retry}
      onPlay={() => { if (bootstrap.edition) openDaily(bootstrap.edition, preferencesRef.current.seenGuides); }}
      onResults={() => {
        if (bootstrap.edition && homeDaily.state.status === 'complete' && homeDaily.state.edition === bootstrap.edition.id) {
          setRecordedDaily({ edition: bootstrap.edition, result: homeDaily.state.result });
          setScreen('results');
        }
      }}
      onPractice={continuePractice}
      onMap={() => { setDialogError(null);setDialog('atlas'); }}/> }
    {!loading && !loadError && screen === 'results' && recordedDaily && <SavedDailyResults key={recordedDaily.edition.id}
      edition={recordedDaily.edition} result={recordedDaily.result}
      onReplay={() => openRun({ puzzle: recordedDaily.edition.puzzle, kind: 'daily', edition: recordedDaily.edition.id, number: recordedDaily.edition.number }, preferencesRef.current.seenGuides)}
      onPractice={() => { setDialogError(null); setDialog('atlas'); }}
      onHome={visitToday}/>}
    {!loading && !loadError && screen !== 'home' && !run && pendingRun && <main className="loading-place">{CRAFT_PREVIEW ? <BrandMark/> : <LandscapeIllustration theme={pendingRun.puzzle.theme}/>}<h1>Before the clock starts.</h1></main>}

    {!loading && !loadError && screen === 'game' && run && bootstrap && <main className={`game-layout board-first ${run.kind === 'studio' || run.kind === 'guide' ? 'practice-play' : ''}`}>
      <aside className="story-panel">
        <div className="place-heading">
          <div className="edition-label">{run.kind === 'guide' ? 'HANDS-ON / SWAP PATCHES' : run.kind === 'studio' ?
            `${run.puzzle.archived ? 'ORIGINAL ROAD' : `ISLAND ${(currentWorld?.index ?? 0) + 1}`} / STOP ${currentCampaignIndex + 1}` : `${todayLabel.toUpperCase()} / NO. ${run.number?.toString().padStart(3, '0')}`}</div>
          <h1 title={run.puzzle.title}>{run.puzzle.title}<span className="title-period">.</span></h1>
          <div className="challenge-facts"><span>{board.length} x {board.length}</span><span>{difficultyLabel(run.puzzle.minimum, run.kind === 'studio' ? run.puzzle.challengeTier : undefined)}</span>
            {run.puzzle.frame && <span>{run.puzzle.frame === 'ell' ? '4-square L' : run.puzzle.frame === 'strip' ? '3-square strips' : '2 x 2 squares'}</span>}
          </div>
          {earnedRank && earnedRank.solveMs !== null && <div className="my-rank-line" data-testid="my-rank" role="status"
            title={`${firstResultOnly ? 'First result' : 'Best'}: ${earnedRank.swaps} moves in ${formatSolveTime(earnedRank.solveMs, true)}. Among ${earnedRank.participants} genuine finishers for ${run.edition}. Tied results share a percentage.`}>
            <Icon name="trophy" size={16}/>{bootstrap.source === 'local' && <span>Local ·</span>}<strong>{rankSummary(earnedRank, rankLabel)}</strong>
          </div>}
          {firstResultOnly && <p className="practice-note daily-policy" data-testid="daily-policy"><Icon name={replayStatus ? 'book' : 'trophy'} size={16}/>
            {replayStatus ? 'Daily replay · unranked' : 'Daily · first finish counts'}</p>}
          {run.kind !== 'daily' && <p className="practice-note"><Icon name={run.kind === 'guide' ? 'book' : 'map'} size={16}/>
            {run.kind === 'guide' ? 'Practice · no timer' : run.puzzle.archived ? 'Practice · Original route' : `Practice · ${currentWorld?.title ?? 'unranked'}`}
            {originalTarget && <button className="text-button original-route-toggle" disabled={practiceLoading !== null}
              onClick={() => openPractice(originalTarget)} aria-label={run.puzzle.archived ? 'Play the revised route for this stop' : 'Replay the original route for this stop'}>
              <Icon name="book" size={15}/>{run.puzzle.archived ? 'New road' : 'Original road'}</button>}</p>}
        </div>
        <div className="mission" aria-label="Connect every home in this order before the traveler starts">
          <ol className="journey-order" aria-label={`Visit ${run.puzzle.journey?.join(', then ') ?? ''} in order`}>
            {run.puzzle.journey?.map((anchor, index, stops) => <li key={anchor}
              data-stop={anchor} data-arrived={index === 0 || arrived.includes(anchor) ? 'true' : 'false'}
              aria-current={anchor === nextStop ? 'step' : undefined}>
              <span className={`journey-stop ${index === 0 || arrived.includes(anchor) ? 'arrived' : ''} ${anchor === celebration?.anchors[0] ? 'stop-celebrating' : ''}`}
                aria-label={`${anchor}: ${index === 0 ? 'start' : arrived.includes(anchor) ? 'arrived' : anchor === nextStop ? 'next stop' : 'later stop'}`}><JourneyCottage anchor={anchor}/><span className="sr-only">{anchor}</span>
                {(index === 0 || arrived.includes(anchor)) && <span className="journey-arrival-mark" aria-hidden="true"><Icon name="check" size={9}/></span>}
              </span>
              {index < stops.length - 1 && <span className="journey-arrow" aria-hidden="true">→</span>}
            </li>)}
          </ol>
          <span className="arrival-announcement" aria-live="polite">{arrived.length ? `Arrived at ${arrived.at(-1)}.` : ''}</span>
        </div>
      </aside>

      <section ref={stageSection} className="island-panel" aria-label="The playable island">
        {guideLesson && <TutorialCoach target={guideBounds} frame={guideStage === 'frame'} second={guideStage === 'second'}
          step={Math.min(moves.length + 1, guideLesson.moves.length)} total={guideLesson.moves.length}
          lesson={guideLesson.name} instruction={guideInstruction} detail={guideDetail} checking={guideProbe !== null || guideLesson.moves.length === 0}
          pointing={!busy && !roadReady && dialog === null && boardReady}
          onSkip={() => finishWalkthrough(true)}/>}
        <div className="play-toolbar" id="game-controls" tabIndex={-1}>
          <div className="visual-frames" role="group" aria-label="Frame orientation" aria-describedby={run.kind === 'guide' ? 'lesson-instruction' : undefined}>
            <span className="frame-label">Frame</span>
            {shapes.map((item) => <button key={`${item.rows}:${item.cols}:${item.kind ?? 'rect'}`} className={`frame-option ${shape.rows === item.rows && shape.cols === item.cols && shape.kind === item.kind ? 'chosen' : ''} ${run.kind === 'guide' && guideStage === 'frame' && item.rows === guideMove?.rows && item.cols === guideMove.cols ? 'tutorial-target' : ''}`}
              disabled={!timer.canPlay || busy || travelerMoving}
              data-frame-kind={item.kind ?? 'rect'} data-frame-rows={item.rows} data-frame-cols={item.cols}
              aria-label={`Frame ${item.rows} rows by ${item.cols} columns${item.kind === 'ell' ? ', L of 4 squares' : ''}`} aria-pressed={shape.rows === item.rows && shape.cols === item.cols && shape.kind === item.kind}
              onClick={() => {
                if (shape.rows !== item.rows || shape.cols !== item.cols || shape.kind !== item.kind) {
                  setShape(item); setFirst(null); setHover(null); setSelectionFeedback(null);
                  if (run.kind === 'guide') setNotice(null);
                }
              }}>
              <ShapeGlyph shape={item} axes={frameAxes}/>
              <span aria-hidden="true">{item.kind === 'ell' ? 'L / 4' : `${item.cols} x ${item.rows}`}</span>
            </button>)}
          </div>
          <div className="run-metrics">
            <span className="compact-moves" data-testid="move-count" aria-label={`${moves.length} ${moves.length === 1 ? 'exchange' : 'exchanges'} used`}>Moves <strong>{moves.length}</strong></span>
            {timed && <span className="compact-time" role="timer" aria-live="off" data-testid="solve-time"
              aria-label={`Solve time ${formatSolveTime(elapsedMs, timer.phase === 'solved')}`}>
              <Icon name="clock" size={15}/>{formatSolveTime(elapsedMs, timer.phase === 'solved')}
            </span>}
          </div>
        </div>
        <BoardView board={board} moves={moves} puzzleId={run.puzzle.id} theme={run.puzzle.theme} seed={localHash(run.puzzle.id)}
          shape={shape} axes={frameAxes} first={first} second={null}
          hover={run.kind === 'guide' ? !roadReady && !guideProbe && guideStage !== 'frame' ? first ? guideMove?.b ?? null : guideMove?.a ?? null : null : hover}
          invalid={run.kind === 'guide' ? false : feedback !== null} invalidPick={selectionFeedback || guideFeedback ? invalidPick : null} blockedCells={feedbackCells}
          routes={routes} transition={transition} reduced={reducedMotion} dark={dark} flat={preferences.flat} guide={run.kind === 'guide'} postcard={POSTCARD_PREVIEW}
          guideProbe={guideProbe?.cell ?? (guideLesson?.moves.length === 0 ? guideFeedback?.cell : null) ?? null}
          guideBlockedLink={guideFeedback?.blockedToward ? { from: guideFeedback.cell, to: guideFeedback.blockedToward } : null}
          miniature={MINIATURE_PREVIEW}
          communityCount={POSTCARD_PREVIEW && allHomesArrived ? community?.players ?? null : null}
          celebration={celebration} arrived={arrived} restingStop={restingStop}
          onMoving={setTravelerMoving}
          locked={!timer.canPlay} readyRevision={timerGeneration} onReady={setBoardReady}
          overlay={!timer.canPlay ? <div className="countdown-overlay" role="status">
            {timer.phase === 'countdown' ? <><span className="countdown-dial"><span className="countdown-number" data-testid="countdown">{timer.countdown}</span></span><strong>Find a way home.</strong></> :
              timer.phase === 'error' ? <><span className="state-emblem state-warning"><Icon name="clock" size={28}/></span><p>{timer.error}</p><button className="primary-button" onClick={reset}><Icon name="reset" size={17}/>Retry countdown</button></> :
                <><span className="loading-island"><BrandMark/></span><span>Preparing your start...</span></>}
          </div> : timed && timer.phase === 'running' && timer.elapsedMs < 400
            ? <div className="countdown-go" role="status">Go!</div> : null}
          playback={playback} busy={busy} paused={dialog !== null || completionOpen} onProjection={setFrameAxes}
          onGuideBounds={updateGuideBounds} onArrival={onArrival} onJourneyEnd={onJourneyEnd}
          onCell={onCell} onHover={onHover} onBusy={setBusy} onFallback={fallback}/>
        <div className="board-footer">
        <div key={invalidPick} className={`island-status ${feedback ? 'selection-warning' : ''}`}
          data-selection-error={selectionFeedback ? 'tap' : feedback ? 'hover' : undefined}
          role={selectionFeedback ? 'alert' : 'status'} aria-live={selectionFeedback ? 'assertive' : 'polite'}
          data-testid="selection-status" title={feedback?.message ?? (first ? 'Tap the same starting square again to deselect.' : undefined)} aria-label={feedback?.message}>
          {!won && (run.kind !== 'guide' || feedback) && <>{feedback ? <Icon name="warning" size={18}/> : <span className="status-step">{first ? '2' : '1'}</span>}
            <span>{feedback ? selectionLabels[feedback.code] : status}</span></>}
          {CRAFT_PREVIEW && !won && run.kind === 'guide' && !feedback && <span>
            {guideFeedback?.blockedToward ? 'The road is still broken.' : 'One road. Every home.'}
          </span>}
          {POSTCARD_PREVIEW && won && run.kind === 'daily' && <button className="text-button postcard-results-button"
            onClick={() => setResultDismissed(false)}><Icon name="trophy" size={16}/>Results</button>}
        </div>
        <div className="view-selector" role="group" aria-label="Map view">
          <button className={`view-option ${!preferences.flat ? 'selected' : ''}`} aria-label="3D map" aria-pressed={!preferences.flat} disabled={busy}
            onClick={() => setPreferences((current) => current.flat ? { ...current, flat: false } : current)}><Icon name="cube" size={14}/><span>3D</span></button>
          <button className={`view-option ${preferences.flat ? 'selected' : ''}`} aria-label="Flat map" aria-pressed={preferences.flat} disabled={busy}
            onClick={() => setPreferences((current) => current.flat ? current : { ...current, flat: true })}><Icon name="grid" size={14}/><span>Flat</span></button>
        </div>
        </div>
        {completionOpen && run.kind === 'guide' && <TutorialCards soundControl={soundToggle}
          dailyReady={Boolean(bootstrap?.edition && homeDaily.state.status === 'ready')}
          onClose={visitToday}
          onFinishHome={() => { rememberGuides(['basics', 'rocks', 'bridges']); visitToday(); }}
          onFinish={() => { rememberGuides(['basics', 'rocks', 'bridges']); finishWalkthrough(false); }}/>}
        {completionOpen && run.kind !== 'guide' && <Modal title={CRAFT_PREVIEW ? "Everyone's home." : standingsOpen ? 'Daily Top 10.' : run.kind === 'daily' ? 'Your daily result.' : 'Practice complete.'}
          kind="guide" className="completion-dialog" eyebrow={CRAFT_PREVIEW ? 'A GOOD LITTLE JOURNEY' : 'FIELD GUIDE'} emblem={<Icon name="trophy" size={25}/>} headerControl={soundToggle} closeIcon="home" closeLabel="Back to home" onClose={visitToday}>
        <div ref={resultCard} className={`result-card ${run.puzzle.minimum === moves.length ? 'perfect-result' : ''} ${reducedMotion ? '' : 'celebrate-completion'} ${standingsOpen ? 'standings-view' : ''}`} data-testid="result-card">
          <div className="completion-confetti" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index}
            style={{ left: `${(index * 37) % 100}%`, animationDelay: `${index * 38}ms` }}/>)}</div>
          <CompletionSeal perfect={run.puzzle.minimum === moves.length}/>
          <div className="result-copy">
            {CRAFT_PREVIEW && <CraftFinishCourier/>}
            <span className="result-label"><Icon name="check" size={13}/>{CRAFT_PREVIEW ? 'HOME, SWEET HOME.' : 'ROAD RESTORED'}</span>
            {earnedRank ? <div className="rank-reveal" data-testid="rank-popup" role="status">
              <span>{earnedRank.source === 'local' ? 'Local rank' : replayStatus ? 'Your recorded rank' : 'Your rank'} {rankLabel}</span>
              <strong>#{earnedRank.rank}</strong>
              {earnedRank.topPercent !== null && <p>Top {earnedRank.topPercent < 1 ? '<1' : Math.ceil(earnedRank.topPercent)}% {rankLabel}</p>}
              <span className="rank-context">{CRAFT_PREVIEW ?
                `Of ${earnedRank.participants} ${earnedRank.participants === 1 ? 'finisher' : 'finishers'}. Rank when saved.` :
                `Among ${earnedRank.participants} saved ${earnedRank.participants === 1 ? 'finisher' : 'finishers'} in this community. Rank when saved.`}</span>
              {firstResultOnly && earnedRank.solveMs !== null && <span className="ranked-first-metrics">{standingsOpen ? 'Ranked:' : 'Ranked result:'} {earnedRank.swaps} moves · {formatSolveTime(earnedRank.solveMs, true)}.</span>}
            </div> : <h2>{CRAFT_PREVIEW ? run.puzzle.minimum === moves.length ? 'A perfect little detour.' : 'You found the way.' :
                run.puzzle.minimum === moves.length ? 'Perfect detour!' : 'Everyone is home!'}</h2>}
            <div className={`result-metrics ${firstResultOnly && earnedRank && !replayStatus ? 'ranked-metrics-repeat' : ''}`}>
              {replayStatus && <span>This replay:</span>}
              <span><Icon name="swap" size={15}/>{moves.length} {moves.length === 1 ? 'exchange' : 'exchanges'}</span>
              <span><Icon name={timed ? 'clock' : 'grid'} size={15}/>{timed ? formatSolveTime(elapsedMs, true) : `${footprint} tiles moved`}</span>
            </div>
            {run.kind === 'studio' && <div className="practice-star-result" data-testid="practice-star-result">
              <div className="practice-star-row">
                <StarRating stars={practiceAward} label={`${practiceAward} of 3 stars for this solution`}/>
                <strong>{practiceAward === 3 ? '3 / 3 · Perfect detour!' : practiceAward > practiceBefore.stars ? `${practiceAward} / 3 · New best!` : `${practiceAward} / 3 stars`}</strong>
              </div>
              <small>Best: {bestPracticeStars} / 3{practiceBefore.best !== null && practiceBefore.best < moves.length ?
                ` (${practiceBefore.best} moves)` : ''}{practiceAward < 3 ? ' · Fewer swaps earn more stars.' : '.'}</small>
              {currentAchievement?.credited && !run.puzzle.archived && <small className="legacy-credit-note">Earlier stars kept.</small>}
              {practiceProgress.unlockedWorlds > practiceBefore.worlds && <p className="practice-world-open" role="status">
                <Icon name="map" size={16}/>New island open: {worlds[practiceProgress.unlockedWorlds - 1]?.title}.
              </p>}
              {progressSync.phase === 'error' && <p className="inline-error" role="alert">
                {progressSync.message}
                <button className="text-button" onClick={progressSync.retry}>Retry sync</button>
              </p>}
            </div>}
            {run.kind === 'studio' && currentCampaignIndex >= 0 && !gateWorld && !nextCampaign && <p className="completion-next">
              All {campaign.length} stops complete.
            </p>}
            {gateWorld && <p className="completion-next completion-star-goal" data-testid="practice-star-gate">
              ★ {worldStars(gateWorld, catalog, preferences.completed, practiceProgress)} / {worldStarRequirement(gateWorld)} stars in {gateWorld.title} — need {Math.max(0, worldStarRequirement(gateWorld) - worldStars(gateWorld, catalog, preferences.completed, practiceProgress))} more for Island {gateWorld.index + 2}.
            </p>}
            {!gateWorld && run.kind === 'studio' && currentWorldGoal && <p className="completion-next completion-star-goal" data-testid="practice-island-star-goal">
              {currentWorldGoal.remaining > 0
                ? `★ ${currentWorldGoal.stars} / ${currentWorldGoal.required} stars · ${currentWorldGoal.remaining} more for Island ${currentWorldGoal.nextIsland}`
                : `★ ${currentWorldGoal.stars} / ${currentWorldGoal.required} stars · Island ${currentWorldGoal.nextIsland} star goal met!`}
            </p>}
            {run.kind === 'daily' && nextCampaign && <p className="completion-next">{replayForStars ?
              'Choose a completed Practice stop on the map for more stars.' : `Continue in unranked Practice: stop ${nextCampaignIndex + 1}.`}</p>}
            {run.kind === 'daily' && <p className={`score-save-status ${saveError ? 'save-failed' : ''}`} data-testid="save-status">
              <Icon name={saveError ? 'warning' : 'trophy'} size={14}/>
              {autoSaveSuppressed ? firstResultOnly ? "Records removed. Today's ranked turn stays used." : 'Records removed. Begin a fresh attempt to rank again.' :
                replayStatus ? replayRankError ? replayRankError : replayStatus === 'removed' ? 'Replay only. The original ranked result was removed.' :
                  'Replay only. Your first recorded Daily result cannot be improved.' :
                  saveError ? `Not saved: ${saveError}` : publishing ? 'Saving your score...' :
                    earnedRank ? firstResultOnly ? 'First result saved. Later replays are unranked.' : 'Saved automatically.' : 'Unranked · sign in to save a rank'}
            </p>}
          </div>
          {POSTCARD_PREVIEW && run.kind === 'daily' && <section className="postcard-community-results" aria-label="Community finishers and standings">
            {community && <div className="community-count" data-testid="community-count">
              <Icon name="leaf" size={18}/><div><strong>{community.source === 'local' ? 'Local rehearsal: ' : ''}{community.players} saved {community.players === 1 ? 'finisher' : 'finishers'}</strong>
                <small title="Illustrative villagers, not player avatars.">One {firstResultOnly ? 'recorded' : 'best'} result per person in this community.</small></div>
            </div>}
            {communityError && <p className="inline-error" role="alert">Community count unavailable: {communityError}</p>}
            {standingsOpen && run.edition && <div id="daily-top-ten"><DailyStandings state={standings} edition={run.edition} onRetry={() => { void loadStandings(); }}/></div>}
          </section>}
        </div>
          <div className={`result-actions completion-actions ${run.kind === 'studio' ? 'practice-completion-actions' : ''}`}>
            {run.kind === 'daily' && saveError && <button className="primary-button" onClick={() => { void publish(); }} disabled={publishing} aria-label="Retry saving score"><Icon name="reset" size={17}/>Retry save</button>}
                {run.kind === 'daily' && replayRankError && <button className="secondary-button" onClick={() => setReplayRankRetry((current) => current + 1)}
                  aria-label="Retry loading recorded rank"><Icon name="reset" size={17}/>Retry rank</button>}
                {nextCampaign && <button className="primary-button" disabled={publishing || practiceLoading !== null}
                  onClick={continuePractice} aria-label={replayForStars ? 'Choose a Practice stop for more stars' : 'Continue your journey'}>
                  {replayForStars ? 'Choose stop' : CRAFT_PREVIEW ? (run.kind === 'studio' ? 'Next' : 'Next stop') : 'Continue'} <Icon name="arrow" size={15}/>
                </button>}
                {run.kind === 'studio' && <button className="secondary-button" disabled={practiceLoading !== null}
                  onClick={() => openPractice(run.puzzle.id)} aria-label="Replay this Practice stop"><Icon name="reset" size={15}/>Replay</button>}
                {POSTCARD_PREVIEW && run.kind === 'daily' ? <button className={`${nextCampaign ? 'secondary-button' : 'primary-button'} standings-toggle`}
                  aria-label={standingsOpen ? 'Back to result' : 'View Daily Top 10'} aria-expanded={standingsOpen} aria-controls="daily-top-ten"
                  onClick={() => { if (standingsOpen) setStandingsOpen(false); else void loadStandings(); }}>
                  <Icon name={standingsOpen ? 'undo' : 'trophy'} size={15}/>{standingsOpen ? 'Result' : 'Top 10'}
                </button> : !replayForStars && <button className={nextCampaign ? 'secondary-button' : 'primary-button'} onClick={() => { setResultDismissed(true); setDialogError(null); setDialog('atlas'); }}
                  aria-label={run.kind === 'daily' ? 'Play more in practice' : 'View the next practice stop'}><Icon name="map" size={15}/>Map</button>}
          </div>
        </Modal>}
      </section>

    </main>}

    {notice && <div className={`toast ${notice.error ? 'toast-error' : ''}`} role={notice.error ? 'alert' : 'status'}><Icon name={notice.error ? 'warning' : 'check'} size={18}/><span>{notice.message}</span><button aria-label="Dismiss message" onClick={() => setNotice(null)}><Icon name="close" size={15}/></button></div>}

    {dialog === 'welcome' && <Modal title={CRAFT_PREVIEW ? 'A little way home.' : 'Move a little world.'} kind="guide" eyebrow={CRAFT_PREVIEW ? 'ONE SMALL DETOUR' : 'FIELD GUIDE'} className="walkthrough-dialog" emblem={<GuideCourier portrait/>} headerControl={soundToggle} closeIcon="home" onClose={visitToday}>
      {CRAFT_PREVIEW ? <CraftScene/> : <p className="tour-eyebrow">1 / 3 · THE GOAL</p>}
      <div className="tutorial-goal" data-testid="tutorial-goal">
        <GuideIllustration step={3}/>
        <ol className="tutorial-goal-route" aria-label="Example route: A, then B, then C">
          {TUTORIAL.journey?.map((anchor, index, stops) => <li key={anchor}>
            <span style={{ color: `var(--world-home-${anchor.toLowerCase()})` }}><HomeLetter anchor={anchor} plaque/><span className="sr-only">{anchor}</span></span>
            {index < stops.length - 1 && <Icon name="arrow" size={23}/>}
          </li>)}
        </ol>
      </div>
      <p className="dialog-intro tutorial-goal-copy"><strong>{CRAFT_PREVIEW ? 'Get everyone home.' : 'Give everyone a way home.'}</strong>
        {CRAFT_PREVIEW ? 'Swap two matching patches.' : <>Connect A, then B, then C with one unbroken road. C is the final home here.
        The courier waits at A until the whole road is ready, then visits every home in order.
        No gaps, diagonals or revisiting a square.</>}</p>
      <p className="tour-reassurance"><Icon name="clock" size={18}/>One lesson. Six short cards. No clock.</p>
      <div className="dialog-actions"><button className="secondary-button" onClick={() => finishWalkthrough(true)}>Back home</button>
        <button className="primary-button" onClick={() => setDialog(CRAFT_PREVIEW ? null : 'tour-tools')}>{CRAFT_PREVIEW ? 'Try a little swap' : 'See the moves'} <Icon name="arrow" size={17}/></button></div>
    </Modal>}

    {dialog === 'tour-tools' && <Modal title="Your little toolkit." kind="guide" className="walkthrough-dialog tutorial-tools" headerControl={soundToggle} closeIcon="home" wide onClose={visitToday}>
      <div className="tutorial-step-nav"><p className="tour-eyebrow">2 / 3 · YOUR MOVES</p>
        <button className="text-button tutorial-back" onClick={() => setDialog('welcome')} aria-label="Back" title="Back to the goal"><Icon name="undo" size={16}/>Back</button>
      </div>
      <p className="dialog-intro">Move the land, not the courier. Homes stay fixed.</p>
      <WalkthroughFeatures section="tools" places={campaign.length}/>
      <div className="welcome-view-choice">
        <p><strong>3D or Flat.</strong> You can switch below the island at any time.</p>
        <div role="group" aria-label="Choose your practice view">
          <button className="secondary-button" aria-label="Use 3D for this practice" aria-pressed={!preferences.flat}
            onClick={() => setPreferences((current) => ({ ...current, flat: false }))}><Icon name="cube" size={18}/>3D <span>Default</span></button>
          <button className="secondary-button" aria-label="Try Flat for this practice" aria-pressed={preferences.flat}
            onClick={() => setPreferences((current) => ({ ...current, flat: true }))}><Icon name="grid" size={18}/>Try Flat</button>
        </div>
      </div>
      <p className="tutorial-next">Next: one hands-on lesson, then six illustrated rule cards.</p>
      <div className="dialog-actions"><button className="secondary-button" onClick={() => finishWalkthrough(true)}>Back home</button>
        <button className="primary-button" onClick={() => setDialog(null)}>Show me <Icon name="arrow" size={17}/></button></div>
    </Modal>}

    {dialog === 'tour-places' && <Modal
      title="A new way, every day."
      kind="guide" className="walkthrough-dialog" emblem={<GuideCourier portrait/>} headerControl={soundToggle} closeIcon="home" wide onClose={visitToday}>
      <p className="tour-eyebrow">YOU'RE READY · CHOOSE YOUR ROAD</p>
      <WalkthroughFeatures section="places" places={campaign.length}/>
      <div className="dialog-actions"><button className="secondary-button" onClick={() => finishWalkthrough(true)}>Back home</button>
        <button className="primary-button" onClick={() => finishWalkthrough(false)}>
          {bootstrap?.edition ? 'Play today' : 'Explore'}<Icon name="arrow" size={17}/></button></div>
    </Modal>}

    {dialog === 'tiles' && <Modal title="A little new terrain." kind="guide" className="walkthrough-dialog terrain-intro" headerControl={soundToggle} wide onClose={visitToday}>
      <p className="tour-reassurance"><Icon name="clock" size={18}/>The next countdown has not started.</p>
      <TileGuide only={pendingTopics}/>
      <div className="dialog-actions"><button className="primary-button" onClick={acceptTileGuide}>Start island <Icon name="arrow" size={17}/></button></div>
    </Modal>}

    {dialog === 'guide' && <Modal title="How to find a way." kind="guide" headerControl={soundToggle} closeIcon={screen === 'home' ? 'home' : 'close'} onClose={() => setDialog(null)} wide>
      <section className="guide-replay-card" aria-labelledby="guide-replay-title" data-testid="guide-replay-card">
        <GuideCourier portrait/>
        <div className="guide-replay-copy"><h3 id="guide-replay-title">Replay walkthrough</h3>
          <p>One lesson. Six short cards.</p><small>No timer. No rank.</small></div>
        <button className="primary-button" onClick={startWalkthrough}><Icon name="play" size={17}/>Replay walkthrough</button>
      </section>
      <div className="dialog-welcome">
        <LandscapeIllustration theme={run?.puzzle.theme ?? 'meadow'}/>
        <p className="dialog-intro"><strong>The whole road comes first.</strong> Connect A, then B, then C, in the shown order.
          The traveler waits at A until the complete trail is ready.</p>
      </div>
      <div className="guide-steps">
        {[['Choose a frame', 'Each island uses one frame family. Later Practice teaches three-square strips, four-square gardens and L patches. Choose its pictured orientation; terrain never rotates.'],
          ['Tap two places', 'Wide patches start at the left tile; tall patches at the top tile. Square and L patches start at the top-left. Tap the same start again to deselect. A valid second patch swaps immediately. In the guide, either square inside a marked patch works.'],
          ['Finish the road', 'Keep one continuous trail through every home, in order. No diagonals, skipped homes or revisiting a square. Then the traveler walks and celebrates.']].map(([title, text], index) =>
          <div className="guide-step" key={title}><GuideIllustration step={index + 1}/><span className="guide-step-number">0{index + 1}</span><h3>{title}</h3><p>{text}</p></div>)}
      </div>
      <TileGuide/>
      <div className="guide-bottom"><div className="guide-score-note"><span className="state-emblem"><Icon name="trophy" size={23}/></span><p><strong>Fewest moves first. Time breaks ties.</strong>
        From November 16, your first saved Daily finish is final. Replays are unranked; Retry save keeps the same result.
        The clock starts after 3, 2, 1 and stops on the winning exchange.</p></div></div>
      <div className="guide-footnotes">
        <p><Icon name="trophy" size={18}/><span>Practice stars reward efficient routes. Keep your highest stars, and discover better roads by replaying.
          Finish an island's stops and collect 45 of its 60 stars to open the next one. Daily ranking is separate.</span></p>
        <p><Icon name="check" size={18}/><span>Every completed exchange counts. There is no Undo in Daily or Practice.</span></p>
        <p><Icon name="grid" size={18}/><span>Keyboard: arrows choose a square; Space selects it; Escape clears a cut. Flat map has individual labeled buttons.</span></p>
        <p><Icon name="lock" size={18}/><span>Saved scores are yours to control. <button className="text-button data-management-link"
          onClick={() => { setDialogError(null); setDialog('erase'); }}>Manage saved data</button></span></p>
        <p><Icon name="map" size={18}/><span>Practice stops and stars sync to your signed-in account in this community.
          <button className="text-button data-management-link" onClick={() => { setDialogError(null); setDialog('erase-practice'); }}>Manage Practice progress</button></span></p>
      </div>
    </Modal>}

    {dialog === 'atlas' && <Modal title="Practice map." kind="map" className="adventure-dialog" headerControl={soundToggle} closeIcon="home" closeLabel="Back to home" onClose={visitToday} wide>
      <AdventureMap places={bootstrap?.catalog ?? []} completed={preferences.completed} progress={practiceProgress} currentId={run?.puzzle.id ?? ''}
        reduced={reducedMotion} dark={dark}
        loading={practiceLoading} error={dialogError} onSelect={openPractice} onToday={visitToday} sync={progressSync}/>
    </Modal>}

    {dialog === 'erase-practice' && <Modal title="Remove Practice progress?" kind="erase" headerControl={soundToggle} onClose={() => setDialog(null)}>
      <p className="dialog-intro">Remove your completed Practice stops, stars and opened islands from this device and your account in this community.
        Daily scores and view/sound choices stay unchanged. This cannot be undone.</p>
      {dialogError && <p className="inline-error" role="alert">{dialogError}</p>}
      <div className="dialog-actions"><button className="secondary-button" disabled={publishing} onClick={() => setDialog(null)}>Keep my progress</button>
        <button className="primary-button danger-button" disabled={publishing} onClick={() => {
          setPublishing(true); setDialogError(null);
          const action = bootstrap?.playerName !== null && bootstrap !== null ? progressSync.clear() : Promise.resolve().then(() => {
            const ids = new Set(bootstrap?.catalog.map((place) => place.id) ?? []);
            setPreferences((current) => ({ ...current, completed: current.completed.filter((id) => !ids.has(id)),
              practice: { bests: {}, unlockedWorlds: 1 } }));
          });
          void action.then(() => { setDialog(null); notify('Your Practice progress was removed. Daily scores were kept.'); })
            .catch((error: unknown) => { console.error('Practice progress could not be removed:', error); setDialogError(messageOf(error)); })
            .finally(() => setPublishing(false));
        }}><Icon name="trash" size={17}/>{publishing ? 'Removing...' : 'Remove Practice progress'}</button>
      </div>
    </Modal>}

    {dialog === 'erase' && <Modal title="Remove saved scores?" kind="erase" headerControl={soundToggle} onClose={() => setDialog(null)}>
      <p className="dialog-intro">Remove your rankings, active timers, synced guide choices and inbox reminders from this game community. This cannot be undone.
        Removing a Daily result does not give another ranked turn for that edition.</p>
      <div className="data-choice-grid">
        <div className="data-choice data-remove"><Icon name="trash" size={24}/><strong>Records removed</strong><p>Saved ranks, active timers, synced guide choices and inbox reminders.</p></div>
        <div className="data-choice data-keep"><Icon name="leaf" size={24}/><strong>Your road stays</strong><p>Campaign progress, view and sound choices.</p></div>
      </div>
      {dialogError && <p className="inline-error" role="alert"><Icon name="warning" size={18}/>{dialogError}</p>}
      <div className="dialog-actions"><button className="secondary-button" disabled={publishing} onClick={() => setDialog(null)}>Keep my records</button>
      <button className="primary-button danger-button" disabled={publishing} onClick={() => {
        const erasedLanding = recordedDaily;
        const erasedRevision = currentRevision.current;
        setPublishing(true);
        void Promise.all([...guideWrites.current]).then(() => gameApi.erase()).then(() => {
          saveRequest.current++;
          setAutoSaveSuppressed(true);
          if (rankEdition && firstDailyResultOnly(rankEdition)) setReplayMode('removed');
          setSaveError(null);
          setPublished(false);
          setMyRank(null);
          setPreferences((current) => ({ ...current, seenGuides: [] }));
          setReminderRevision(value => value + 1);
          setDialog(null);
          if (erasedLanding && erasedRevision === currentRevision.current) visitToday();
          else if (screen === 'home') homeDaily.refresh();
          notify('Your leaderboard records and inbox reminders were removed.');
        })
          .catch((error: unknown) => { console.error('Could not erase leaderboard data:', error); setDialogError(messageOf(error)); })
          .finally(() => setPublishing(false));
      }}><Icon name="trash" size={17}/>{publishing ? 'Removing...' : 'Remove my records'}</button></div>
    </Modal>}
  </div></CraftArtContext.Provider></GardenArtContext.Provider>;
}
