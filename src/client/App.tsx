import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gameApi, takeStorageNotice } from './api.ts';
import { IslandAudio } from './audio.ts';
import { BoardView } from './BoardView.tsx';
import type { Transition } from './BoardView.tsx';
import { BrandMark, CompletionSeal, FLAT_AXES, GuideCourier, GuideIllustration, Icon, LandscapeIllustration, Modal, ShapeGlyph, TileGuide, WalkthroughFeatures } from './components.tsx';
import { applySwap, checkPuzzle, patchCells, RuleError, rulesFor, selectionIssue, shapesFor, tileAt } from '../shared/rules.ts';
import type { PatchIssue } from '../shared/rules.ts';
import { difficultyLabel } from '../shared/difficulty.ts';
import { CelebrationHold } from '../shared/playback.ts';
import { campaignPlaces, nextCampaignPlace, practiceGate } from '../shared/progression.ts';
import { TUTORIAL, TUTORIAL_MOVE, TUTORIAL_START_SHAPE, tutorialStage } from '../shared/tutorial.ts';
import { AdventureMap } from './AdventureMap.tsx';
import { useSolveTimer } from './useSolveTimer.ts';
import { formatSolveTime } from '../shared/timing.ts';
import { isRecord } from '../shared/validation.ts';
import { isGuideTopics, mergeGuideTopics, newTileGuides } from '../shared/guidance.ts';
import type { Anchor, Board, Bootstrap, Celebration, Cell, FrameAxes, GuideTopic, JourneyPlayback, JourneyStop, MyRank, Puzzle, RouteCheck, Shape, Swap } from '../shared/types.ts';

type Kind = 'daily' | 'studio' | 'guide';
type Dialog = 'guide' | 'atlas' | 'erase' | 'welcome' | 'tour-tools' | 'tour-places' | 'tiles' | null;
interface Run { puzzle: Puzzle; kind: Kind; edition: string | null; number: number | null }
interface Preferences { flat: boolean; completed: string[]; soundWanted: boolean; seenGuides: GuideTopic[] }
interface Notice { message: string; error: boolean }

const PREF_KEY = 'detour:preferences:1';
const EMPTY_ROUTES: Cell[][] = [];
const EMPTY_CELLS: readonly Cell[] = [];
const selectionLabels: Record<PatchIssue['code'], string> = {
  shape: 'Use whole squares.',
  bounds: 'Keep the patch on the map.',
  home: 'Homes/rocks stay fixed.',
  boulder: 'Boulders stay fixed.',
  overlap: 'Patches overlap.',
};

function rankSummary(rank: MyRank, label = 'today'): string {
  if (rank.rank === null) throw new Error('A saved daily rank is missing.');
  if (rank.participants === 1) return `Rank #${rank.rank} ${label}`;
  if (rank.topPercent === null) throw new Error('The daily percentage is missing.');
  return `#${rank.rank} · Top ${rank.topPercent < 1 ? '<1' : Math.ceil(rank.topPercent)}% ${label}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something unexpected happened. Please try again.';
}

function loadPreferences(): { value: Preferences; warning: string | null } {
  const defaults: Preferences = {
    flat: false, completed: [], soundWanted: false, seenGuides: [],
  };
  try {
    const text = localStorage.getItem(PREF_KEY);
    if (!text) return { value: defaults, warning: null };
    const value: unknown = JSON.parse(text);
    if (!isRecord(value) || typeof value['flat'] !== 'boolean' ||
        typeof value['soundWanted'] !== 'boolean' || !Array.isArray(value['completed']) ||
        !value['completed'].every((item: unknown) => typeof item === 'string')) throw new Error('Invalid saved preferences.');
    let seenGuides: GuideTopic[] = [];
    let warning: string | null = null;
    if (value['seenGuides'] !== undefined) {
      if (isGuideTopics(value['seenGuides'])) seenGuides = value['seenGuides'];
      else {
        console.warn('Saved walkthrough choices could not be read.');
        warning = 'The walkthrough choices could not be read. Other progress is safe; the guide may appear again.';
      }
    }
    return { value: { flat: value['flat'], completed: value['completed'], soundWanted: value['soundWanted'], seenGuides }, warning };
  } catch (error) {
    console.warn('Saved Detour preferences could not be loaded:', error);
    return { value: defaults, warning: 'Saved preferences could not be read. The island is using fresh settings; nothing on your village board was changed.' };
  }
}

function defaultShape(area: number): Shape {
  const shapes = shapesFor(area);
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
  const [preferences, setPreferences] = useState(initial.value);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const dark = useMediaQuery('(prefers-color-scheme: dark)');
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<Run | null>(null);
  const [pendingRun, setPendingRun] = useState<Run | null>(null);
  const [board, setBoard] = useState<Board>([]);
  const [moves, setMoves] = useState<Swap[]>([]);
  const [shape, setShape] = useState<Shape>({ rows: 1, cols: 2 });
  const [first, setFirst] = useState<Cell | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);
  const [selectionFeedback, setSelectionFeedback] = useState<PatchIssue | null>(null);
  const [busy, setBusy] = useState(false);
  const [transition, setTransition] = useState<Transition | null>(null);
  const transitionId = useRef(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<Notice | null>(initial.warning ? { message: initial.warning, error: true } : null);
  const [soundOn, setSoundOn] = useState(false);
  const audio = useRef<IslandAudio | null>(null);
  const [myRank, setMyRank] = useState<MyRank | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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
  const celebrationHold = useRef<{ revision: number; flat: boolean; clock: CelebrationHold } | null>(null);
  const [frameAxes, setFrameAxes] = useState<FrameAxes>(FLAT_AXES);
  const guideWrites = useRef(new Set<Promise<void>>());
  const [practiceLoading, setPracticeLoading] = useState<string | null>(null);
  const practiceRequest = useRef(0);
  const warnedStorage = useRef(false);
  const stageSection = useRef<HTMLElement>(null);
  const rankEdition = run?.kind === 'daily' ? run.edition : null;
  const timed = run !== null && run.kind !== 'guide';
  const timer = useSolveTimer(timerGeneration, rankEdition, timed, boardReady);

  const notify = useCallback((message: string, error = false) => setNotice({ message, error }), []);
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
    celebrationHold.current = null;
    setCelebration(null);
  }, []);
  const fallback = useCallback((message: string) => {
    setBusy(false);
    setPreferences((current) => ({ ...current, flat: true }));
    notify(message, true);
  }, [notify]);

  const begin = useCallback((next: Run) => {
    practiceRequest.current++;
    setPracticeLoading(null);
    setRun(next);
    setPendingRun(null);
    setBoard(next.puzzle.board);
    setMoves([]);
    setFirst(null);
    setHover(null);
    setSelectionFeedback(null);
    setShape(next.kind === 'guide' ? TUTORIAL_START_SHAPE : defaultShape(next.puzzle.area));
    setTransition(null);
    setBusy(false);
    setPublished(false);
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

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await gameApi.bootstrap();
      setBootstrap(data);
      const localSeen = preferencesRef.current.seenGuides;
      const seen = mergeGuideTopics(localSeen, data.seenGuides);
      setPreferences((current) => ({ ...current, seenGuides: mergeGuideTopics(current.seenGuides, seen) }));
      syncGuides(localSeen.filter((topic) => !data.seenGuides.includes(topic)), data.playerName !== null);
      if (!seen.includes('basics')) startWalkthrough();
      else if (data.edition) openRun({ puzzle: data.edition.puzzle, kind: 'daily', edition: data.edition.id, number: data.edition.number }, seen);
      else if (data.catalog[0]) {
        const puzzle = await gameApi.place(data.catalog[0].id);
        openRun({ puzzle, kind: 'studio', edition: null, number: null }, seen);
        notify(data.seasonComplete ? 'This season is complete. The unranked atlas is still yours to explore.' : 'The season has not opened yet. Explore a practice place in the meantime.');
      }
      const storageWarning = takeStorageNotice();
      if (storageWarning) notify(storageWarning, true);
    } catch (error) {
      console.error('Detour could not load:', error);
      setLoadError(messageOf(error));
    } finally {
      setLoading(false);
    }
  }, [startWalkthrough, openRun, notify, syncGuides]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const instrument = new IslandAudio((message) => { setSoundOn(false); notify(message, true); });
    audio.current = instrument;
    return () => { instrument.dispose(); audio.current = null; };
  }, [notify]);
  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(preferences)); }
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
    if (!bootstrap) return;
    const offset = Date.parse(bootstrap.now) - Date.now();
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
            notify('A new daily island is ready. Tap the title when you are ready; your current repair is safe.');
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
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [bootstrap, notify]);

  const area = run?.puzzle.area ?? 2;
  const rules = useMemo(() => run ? rulesFor(run.puzzle, 'daily') : { areas: [2], budget: 1 }, [run]);
  const check = useMemo<RouteCheck>(() => run ? checkPuzzle(board, run.puzzle) : { solved: false, routes: EMPTY_ROUTES, missing: [] }, [run, board]);
  const roadReady = moves.length > 0 && check.solved;
  const lastHome = run?.puzzle.journey?.at(-1);
  const allHomesArrived = roadReady && lastHome !== undefined && arrived.includes(lastHome);
  const won = roadReady && arrivalComplete && resultRevealed;
  const campaign = useMemo(() => campaignPlaces(bootstrap?.catalog ?? []), [bootstrap?.catalog]);
  const currentCampaignIndex = run?.kind === 'studio' ? campaign.findIndex((place) => place.id === run.puzzle.id) : -1;
  const nextCampaign = useMemo(() => nextCampaignPlace(campaign, preferences.completed), [campaign, preferences.completed]);
  const nextCampaignIndex = nextCampaign ? campaign.findIndex((place) => place.id === nextCampaign.id) : -1;
  const playback = useMemo<JourneyPlayback | null>(() => {
    const plan = roadReady && !arrivalComplete ? check.journey : null;
    return plan ? { revision, plan } : null;
  }, [roadReady, check.journey, revision, arrivalComplete]);
  const restingStop: Anchor = arrived.at(-1) ?? 'A';
  const routes = roadReady ? check.routes : EMPTY_ROUTES;
  const footprint = moves.reduce((total, move) => total + 2 * move.rows * move.cols, 0);
  const shapes = useMemo(() => shapesFor(area), [area]);
  const guideStage = tutorialStage(shape, first, roadReady);
  const hoverIssue = useMemo(() => {
    if (!hover || !run || roadReady || busy || !timer.canPlay || (run.kind === 'guide' && guideStage === 'frame')) return null;
    return selectionIssue(board, hover, shape, first);
  }, [hover, first, shape, board, run, roadReady, busy, timer.canPlay, guideStage]);
  const feedback = selectionFeedback ?? hoverIssue;
  const feedbackCells = feedback?.cells ?? EMPTY_CELLS;
  const onHover = useCallback((cell: Cell | null) => {
    setHover(cell);
    if (cell) setSelectionFeedback(null);
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
    if (run.kind !== 'guide') setPreferences((current) => current.completed.includes(run.puzzle.id) ? current :
      { ...current, completed: [...current.completed, run.puzzle.id] });
  }, [run, roadReady, check.journey]);

  useEffect(() => {
    if (!allHomesArrived || resultRevealed || dialog || !boardReady) return;
    if (!celebrationHold.current || celebrationHold.current.revision !== revision || celebrationHold.current.flat !== preferences.flat) {
      celebrationHold.current = { revision, flat: preferences.flat, clock: new CelebrationHold() };
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
  }, [allHomesArrived, resultRevealed, dialog, boardReady, revision, preferences.flat]);

  const resumePreferredSound = useCallback(() => {
    const instrument = audio.current;
    if (preferences.soundWanted && instrument && !instrument.enabled) {
      void instrument.enable().then(() => {
        if (audio.current === instrument) setSoundOn(instrument.enabled);
      }).catch((error: unknown) => notify(messageOf(error), true));
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
      setBusy(!preferences.flat && !reducedMotion);
      setBoard(next);
      setMoves((current) => [...current, move]);
      setTransition({ id: ++transitionId.current, move });
      setFirst(null); setHover(null); setSelectionFeedback(null); setPublished(false);
    } catch (error) {
      console.error('Patch exchange failed:', error);
      notify(messageOf(error), !(error instanceof RuleError));
    }
  }, [run, timer.canPlay, timer.stop, busy, travelerMoving, roadReady, shape, board, rules, moves.length, preferences.flat, reducedMotion, restartPlayback, notify]);

  const onCell = useCallback((cell: Cell) => {
    if (!run || !timer.canPlay || busy) return;
    resumePreferredSound();
    if (travelerMoving) { notify('Let the traveler reach the next home. Undo is still free.'); return; }
    if (roadReady) { notify(allHomesArrived ? 'Journey complete. Undo to try another repair.' : 'The traveler is on the way. Undo if you want to change the route.'); return; }
    if (run.kind === 'guide' && guideStage === 'frame') { notify('First choose the glowing tall frame beside the board.'); return; }
    if (moves.length >= rules.budget) { notify('This long attempt has reached its save limit. Undo a swap to continue.'); return; }
    const issue = selectionIssue(board, cell, shape, first);
    if (issue) { setHover(cell); setSelectionFeedback(issue); return; }
    setSelectionFeedback(null);
    if (first?.row === cell.row && first.col === cell.col) {
      setFirst(null); setHover(null); return;
    }
    if (!first) {
      if (run.kind === 'guide' && (cell.row !== TUTORIAL_MOVE.a.row || cell.col !== TUTORIAL_MOVE.a.col)) {
        notify('For this little lesson, tap the orange-framed stone and pond.');
        return;
      }
      setFirst(cell); setHover(null); audio.current?.select(false);
    } else {
      if (run.kind === 'guide' && (cell.row !== TUTORIAL_MOVE.b.row || cell.col !== TUTORIAL_MOVE.b.col)) {
        notify('Now tap the blue-framed empty pair. The matching patches will trade places.');
        return;
      }
      audio.current?.select(true);
      commitSwap(first, cell);
    }
  }, [run, timer.canPlay, busy, travelerMoving, allHomesArrived, roadReady, moves.length, rules.budget, board, shape, first, guideStage, notify, resumePreferredSound, commitSwap]);

  const undo = (): void => {
    if (!run || moves.length === 0 || busy) return;
    const removed = moves.at(-1);
    if (!removed) return;
    const previousMoves = moves.slice(0, -1);
    let restored = run.puzzle.board;
    previousMoves.forEach((move, used) => { restored = applySwap(restored, move, rules, used); });
    setBoard(restored); setMoves(previousMoves);
    restartPlayback();
    timer.resume();
    setSolveId(null);
    saveRequest.current++;
    setPublishing(false);
    setSaveError(null);
    setSavedSolveMs(null);
    setBusy(!preferences.flat && !reducedMotion);
    setTransition({ id: ++transitionId.current, move: removed });
    setFirst(null); setHover(null); setSelectionFeedback(null); setPublished(false);
    setMyRank(null);
    audio.current?.undo();
  };

  const reset = (): void => {
    if (!run || busy) return;
    setBoard(run.puzzle.board); setMoves([]); setTransition(null);
    setFirst(null); setHover(null); setSelectionFeedback(null); setPublished(false);
    setMyRank(null);
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
    const edition = bootstrap?.edition;
    const topics: GuideTopic[] = ['basics', ...(skip && edition ? newTileGuides(edition.puzzle.board, []) : [])];
    const seen = rememberGuides(topics);
    if (edition) {
      const next: Run = { puzzle: edition.puzzle, kind: 'daily', edition: edition.id, number: edition.number };
      if (skip) begin(next);
      else openRun(next, seen);
    } else {
      setDialogError(null);
      setDialog('atlas');
    }
  };

  const acceptTileGuide = (): void => {
    if (!pendingRun) { notify('That island changed. Please choose it again.', true); setDialog(null); return; }
    const next = pendingRun;
    rememberGuides(newTileGuides(next.puzzle.board, preferencesRef.current.seenGuides));
    begin(next);
  };

  const visitToday = (): void => {
    if (run?.kind === 'guide') { finishWalkthrough(true); return; }
    const edition = bootstrap?.edition;
    if (edition) openRun({ puzzle: edition.puzzle, kind: 'daily', edition: edition.id, number: edition.number }, preferencesRef.current.seenGuides);
  };

  const openPractice = (id: string): void => {
    if (!bootstrap) { notify('The world map is still loading.'); return; }
    const gate = practiceGate(bootstrap.catalog, preferences.completed, id);
    if (!gate.unlocked) { setDialogError(gate.reason); return; }
    const request = ++practiceRequest.current;
    setPracticeLoading(id);
    setDialogError(null);
    const seen = run?.kind === 'guide' ? rememberGuides(['basics']) : preferencesRef.current.seenGuides;
    void gameApi.place(id).then((puzzle) => {
      if (request === practiceRequest.current) openRun({ puzzle, kind: 'studio', edition: null, number: null }, seen);
    }).catch((error: unknown) => {
      console.error('The practice island could not load:', error);
      if (request === practiceRequest.current) setDialogError(messageOf(error));
    }).finally(() => {
      if (request === practiceRequest.current) setPracticeLoading(null);
    });
  };

  const toggleSound = async (): Promise<void> => {
    const instrument = audio.current;
    if (!instrument) return;
    try {
      if (soundOn) {
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
    if (!run?.edition || run.kind !== 'daily' || !roadReady || !attemptId || !solveId || publishing || autoSaveSuppressed) return;
    const savingRequest = ++saveRequest.current;
    const savedRevision = currentRevision.current;
    setPublishing(true);
    setSaveError(null);
    try {
      const result = await gameApi.submit({ edition: run.edition, mode: 'daily', moves, attemptId, solveId });
      if (!result.yourBest || result.yourBest.solveMs === undefined || result.saved.solveMs === null) {
        throw new Error('The route was checked, but no timed rank was recorded. Please retry.');
      }
      if (savedRevision === currentRevision.current && savingRequest === saveRequest.current) {
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
  }, [run, timer.attempt?.id, solveId, roadReady, publishing, autoSaveSuppressed, moves, notify]);

  useEffect(() => {
    if (roadReady && timer.phase === 'solved' && timer.attempt?.id && !published && !publishing && !saveError && !autoSaveSuppressed) {
      void publish();
    }
  }, [roadReady, timer.phase, timer.attempt?.id, published, publishing, saveError, autoSaveSuppressed, publish]);

  const elapsedMs = savedSolveMs ?? timer.elapsedMs;

  const todayLabel = run?.edition ? new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${run.edition}T12:00:00Z`)) : 'A place of your own';
  const nextStop = run?.puzzle.journey?.[arrived.length + 1];
  const status = !timer.canPlay ? timer.phase === 'countdown' ? 'Get ready.' : 'Preparing the timer...' :
    busy ? 'Exchanging...' : allHomesArrived ? 'Everyone made it home!' : travelerMoving ? `On the way to ${nextStop ?? 'the final home'}...` :
    roadReady ? nextStop ? `Next stop: ${nextStop}` : 'Final stop reached.' :
    moves.length >= rules.budget ? 'Undo a swap to continue.' :
    run?.kind === 'guide' ? guideStage === 'frame' ? 'Choose the tall frame.' : !first ? 'Tap the orange pair.' : 'Tap the blue pair.' :
    !first ? 'Choose a patch.' : 'Choose the matching patch.';
  const earnedRank = won && published && run?.kind === 'daily' && myRank?.edition === run.edition && myRank.rank !== null ? myRank : null;
  const rankLabel = run?.edition === bootstrap?.edition?.id ? 'today' : `on ${todayLabel}`;
  const pendingTopics = pendingRun ? newTileGuides(pendingRun.puzzle.board, preferences.seenGuides) : [];

  return <div className={`app-shell focused-game direct-play viewport-fit ${reducedMotion ? 'reduce-motion' : ''}`}
    data-appearance={dark ? 'dark' : 'light'} data-onboarding={run?.kind === 'guide' ? 'practice' : dialog === 'tiles' ? 'tiles' : 'complete'}
    data-guide-step={run?.kind === 'guide' ? guideStage : undefined}
    data-timer-phase={timer.phase} data-score-state={publishing ? 'saving' : published ? 'saved' : saveError ? 'error' : 'idle'}
    data-completion-state={won ? 'result' : allHomesArrived ? 'celebrating' : roadReady ? 'walking' : 'repairing'}>
    <a className="skip-link" href="#game-controls">Skip to game controls</a>
    <header className="site-header">
      <button className="wordmark" onClick={visitToday} aria-label="One Small Detour, today's island">
        <BrandMark/><span className="wordmark-full">one small detour<span className="wordmark-dot">.</span></span><span className="wordmark-compact">detour.</span>
      </button>
      <nav className="header-nav" aria-label="Game navigation">
        <button className="icon-button map-toggle" disabled={!bootstrap} onClick={() => { setDialogError(null); setDialog('atlas'); }}
          aria-label="Adventure map" title="Adventure map"><Icon name="map"/></button>
        <button className={`icon-button sound-toggle ${soundOn ? 'sound-is-on' : ''}`} onClick={() => { void toggleSound(); }}
          aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'} aria-pressed={soundOn} title={soundOn ? 'Soundscape on' : 'Listen to the island'}>
          <Icon name={soundOn ? 'sound' : 'mute'}/>
        </button>
        <button className="icon-button help-toggle" onClick={() => setDialog('guide')} aria-label="How to play and tile rules" title="How to play and tile rules"><Icon name="book"/></button>
      </nav>
    </header>

    {loading && <main className="loading-place"><LandscapeIllustration/><p className="eyebrow"><Icon name="leaf" size={14}/>A LITTLE PATIENCE</p><h1>Unfolding your little place...</h1><p>The roads, the ponds, the possibilities.</p></main>}
    {!loading && loadError && <main className="loading-place"><LandscapeIllustration theme="coast"/><h1>The island is taking its time.</h1><p className="inline-error" role="alert"><Icon name="warning" size={18}/>{loadError}</p><button className="primary-button" onClick={() => { void load(); }}>Try again <Icon name="arrow"/></button></main>}
    {!loading && !loadError && !run && pendingRun && <main className="loading-place"><LandscapeIllustration theme={pendingRun.puzzle.theme}/><h1>Before the clock starts.</h1></main>}

    {!loading && !loadError && run && bootstrap && <main className={`game-layout ${run.kind === 'studio' || run.kind === 'guide' ? 'practice-play' : ''}`}>
      <aside className="story-panel">
        <div className="place-heading">
          <div className="edition-label">{run.kind === 'guide' ? 'GUIDED PRACTICE' : run.kind === 'studio' ? 'UNRANKED CHALLENGE' : `${todayLabel.toUpperCase()} / NO. ${run.number?.toString().padStart(3, '0')}`}</div>
          <h1 title={run.puzzle.title}>{run.puzzle.title}<span className="title-period">.</span></h1>
          <div className="challenge-facts"><span>{board.length} x {board.length}</span><span>{difficultyLabel(run.puzzle.minimum)}</span>
            {run.puzzle.minimum && <span title="A checked solution matches the proven lower bound for this patch size.">Minimum {run.puzzle.minimum} {run.puzzle.minimum === 1 ? 'exchange' : 'exchanges'}</span>}
          </div>
          {earnedRank && earnedRank.solveMs !== null && <div className="my-rank-line" data-testid="my-rank" role="status"
            title={`Best: ${earnedRank.swaps} moves in ${formatSolveTime(earnedRank.solveMs, true)}. Among ${earnedRank.participants} genuine finishers for ${run.edition}. Tied results share a percentage.`}>
            <Icon name="trophy" size={16}/>{bootstrap.source === 'local' && <span>Local ·</span>}<strong>{rankSummary(earnedRank, rankLabel)}</strong>
          </div>}
          {run.kind !== 'daily' && <p className="practice-note"><Icon name={run.kind === 'guide' ? 'book' : 'map'} size={16}/>
            {run.kind === 'guide' ? 'Practice · no timer' : 'Adventure · unranked'}</p>}
        </div>
        <div className="mission" aria-label="Connect every home in this order before the traveler starts">
          <ol className="journey-order" aria-label={`Visit ${run.puzzle.journey?.join(', then ') ?? ''} in order`}>
            {run.puzzle.journey?.map((anchor, index, stops) => <li key={anchor}
              data-stop={anchor} data-arrived={index === 0 || arrived.includes(anchor) ? 'true' : 'false'}
              aria-current={anchor === nextStop ? 'step' : undefined}>
              <span className={`journey-stop ${index === 0 || arrived.includes(anchor) ? 'arrived' : ''} ${anchor === celebration?.anchors[0] ? 'stop-celebrating' : ''}`}
                aria-label={`${anchor}: ${index === 0 ? 'start' : arrived.includes(anchor) ? 'arrived' : anchor === nextStop ? 'next stop' : 'later stop'}`}>{anchor}</span>
              {index < stops.length - 1 && <span className="journey-arrow" aria-hidden="true">→</span>}
            </li>)}
          </ol>
          <span className="arrival-announcement" aria-live="polite">{arrived.length ? `Arrived at ${arrived.at(-1)}.` : ''}</span>
        </div>
        {run.kind === 'guide' && <div className="lesson-coach" role="status">
          <GuideCourier/>
          <span className="lesson-step" aria-label="Walkthrough step one of three. No timer."><Icon name="leaf" size={15}/>NO TIMER</span>
          <strong id="lesson-instruction">{guideStage === 'frame' ? 'Choose the tall frame.' : guideStage === 'home' ? 'Watch the way home.' : guideStage === 'second' ? 'Tap the blue pair.' : 'Tap the orange pair.'}</strong>
          <span>{roadReady ? 'The whole road connects before the traveler moves.' : 'The two matching patches trade places.'}</span>
          <button className="text-button" onClick={() => finishWalkthrough(true)} aria-label="Skip walkthrough and play today">Skip <Icon name="arrow" size={15}/></button>
        </div>}
      </aside>

      <section ref={stageSection} className="island-panel" aria-label="The playable island">
        <div className="play-toolbar" id="game-controls" tabIndex={-1}>
          <div className="visual-frames" role="group" aria-label="Frame orientation" aria-describedby={run.kind === 'guide' ? 'lesson-instruction' : undefined}>
            <span className="frame-label">Frame</span>
            {shapes.map((item) => <button key={`${item.rows}:${item.cols}`} className={`frame-option ${shape.rows === item.rows && shape.cols === item.cols ? 'chosen' : ''} ${run.kind === 'guide' && guideStage === 'frame' && item.rows === TUTORIAL_MOVE.rows && item.cols === TUTORIAL_MOVE.cols ? 'tutorial-target' : ''}`}
              disabled={!timer.canPlay || busy || travelerMoving}
              aria-label={`Frame ${item.rows} rows by ${item.cols} columns`} aria-pressed={shape.rows === item.rows && shape.cols === item.cols}
              onClick={() => {
                if (shape.rows !== item.rows || shape.cols !== item.cols) {
                  setShape(item); setFirst(null); setHover(null); setSelectionFeedback(null);
                }
              }}>
              <ShapeGlyph shape={item} axes={frameAxes}/>
              <span aria-hidden="true">{item.cols} x {item.rows}</span>
            </button>)}
          </div>
          <div className="run-metrics">
            <span className="compact-moves" data-testid="move-count" aria-label={`${moves.length} ${moves.length === 1 ? 'exchange' : 'exchanges'} used`}>Moves <strong>{moves.length}</strong></span>
            {timed && <span className="compact-time" role="timer" aria-live="off" data-testid="solve-time"
              aria-label={`Solve time ${formatSolveTime(elapsedMs, timer.phase === 'solved')}`}>
              <Icon name="clock" size={15}/>{formatSolveTime(elapsedMs, timer.phase === 'solved')}
            </span>}
          </div>
          <button className="icon-button undo-control" disabled={!timer.canPlay || moves.length === 0 || busy} onClick={undo} aria-label="Undo" title="Undo"><Icon name="undo" size={20}/></button>
        </div>
        <BoardView board={board} puzzleId={run.puzzle.id} theme={run.puzzle.theme} seed={localHash(run.puzzle.id)}
          shape={shape} first={first} second={null}
          hover={run.kind === 'guide' ? !roadReady && guideStage !== 'frame' ? first ? TUTORIAL_MOVE.b : TUTORIAL_MOVE.a : null : hover}
          invalid={run.kind === 'guide' ? false : feedback !== null} blockedCells={feedbackCells}
          routes={routes} transition={transition} reduced={reducedMotion} dark={dark} flat={preferences.flat} guide={run.kind === 'guide'}
          celebration={celebration} arrived={arrived} restingStop={restingStop}
          onMoving={setTravelerMoving}
          locked={!timer.canPlay} readyRevision={timerGeneration} onReady={setBoardReady}
          overlay={!timer.canPlay ? <div className="countdown-overlay" role="status">
            {timer.phase === 'countdown' ? <><span className="countdown-dial"><span className="countdown-number" data-testid="countdown">{timer.countdown}</span></span><strong>Find a way home.</strong></> :
              timer.phase === 'error' ? <><span className="state-emblem state-warning"><Icon name="clock" size={28}/></span><p>{timer.error}</p><button className="primary-button" onClick={reset}><Icon name="reset" size={17}/>Retry countdown</button></> :
                <><span className="loading-island"><BrandMark/></span><span>Preparing your start...</span></>}
          </div> : timed && timer.phase === 'running' && timer.elapsedMs < 400
            ? <div className="countdown-go" role="status">Go!</div> : null}
          playback={playback} busy={busy} paused={dialog !== null} onProjection={setFrameAxes} onArrival={onArrival} onJourneyEnd={onJourneyEnd}
          onCell={onCell} onHover={onHover} onBusy={setBusy} onFallback={fallback}/>
        <div className="board-footer">
        <div className={`island-status ${feedback ? 'selection-warning' : ''}`}
          role={selectionFeedback ? 'alert' : 'status'} aria-live={selectionFeedback ? 'assertive' : 'polite'}
          data-testid="selection-status" title={feedback?.message} aria-label={feedback?.message}>
          {!won && <>{feedback ? <Icon name="warning" size={18}/> : <span className="status-step">{first ? '2' : '1'}</span>}
            <span>{feedback ? selectionLabels[feedback.code] : status}</span></>}
        </div>
        <div className="view-selector" role="group" aria-label="Map view">
          <button className={`view-option ${!preferences.flat ? 'selected' : ''}`} aria-label="3D map" aria-pressed={!preferences.flat} disabled={busy}
            onClick={() => setPreferences((current) => current.flat ? { ...current, flat: false } : current)}><Icon name="cube" size={14}/><span>3D</span></button>
          <button className={`view-option ${preferences.flat ? 'selected' : ''}`} aria-label="Flat map" aria-pressed={preferences.flat} disabled={busy}
            onClick={() => setPreferences((current) => current.flat ? current : { ...current, flat: true })}><Icon name="grid" size={14}/><span>Flat</span></button>
        </div>
        </div>
        {won && !busy && <div className={`result-card ${run.puzzle.minimum === moves.length ? 'perfect-result' : ''} ${reducedMotion ? '' : 'celebrate-completion'}`} data-testid="result-card" role="status">
          <div className="completion-confetti" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index}
            style={{ left: `${(index * 37) % 100}%`, animationDelay: `${index * 38}ms` }}/>)}</div>
          <CompletionSeal perfect={run.puzzle.minimum === moves.length}/>
          <div className="result-copy">
            <span className="result-label"><Icon name="check" size={13}/>ROAD RESTORED</span>
            <h2>{run.kind === 'guide' ? 'You have the idea!' : run.puzzle.minimum === moves.length ? 'Perfect detour!' : 'Everyone is home!'}</h2>
            <div className="result-metrics">
              <span><Icon name="swap" size={15}/>{moves.length} {moves.length === 1 ? 'exchange' : 'exchanges'}</span>
              <span><Icon name={timed ? 'clock' : 'grid'} size={15}/>{timed ? formatSolveTime(elapsedMs, true) : `${footprint} tiles moved`}</span>
            </div>
            {run.kind === 'studio' && currentCampaignIndex >= 0 && <p className="completion-next">
              {nextCampaignIndex === currentCampaignIndex + 1 ? `Next: stop ${nextCampaignIndex + 1}.` :
                nextCampaign ? 'Your next stop is ready.' : `All ${campaign.length} stops complete.`}
            </p>}
            {run.kind === 'daily' && <p className={`score-save-status ${saveError ? 'save-failed' : ''}`} data-testid="save-status">
              <Icon name={saveError ? 'warning' : 'trophy'} size={14}/>
              {autoSaveSuppressed ? 'Records removed. Restart for a new ranked attempt.' : saveError ? `Not saved: ${saveError}` : publishing ? 'Saving your score...' :
                earnedRank ? `Saved · ${rankSummary(earnedRank, rankLabel)}` : 'Unranked · sign in to save a rank'}
            </p>}
          </div>
          <div className="result-actions">
            {run.kind === 'guide' ? <button className="primary-button" onClick={() => setDialog('tour-tools')}>See your tools <Icon name="arrow" size={17}/></button> :
              run.kind === 'daily' ? <>{saveError && <button className="primary-button" onClick={() => { void publish(); }} disabled={publishing} aria-label="Retry saving score"><Icon name="reset" size={17}/>Retry save</button>}<button className="secondary-button" onClick={() => { setDialogError(null); setDialog('atlas'); }} aria-label="Explore the unranked adventure map"><Icon name="map" size={17}/>View campaign</button></> :
                <button className="primary-button" onClick={() => { setDialogError(null); setDialog('atlas'); }} aria-label="Continue on the campaign map">View next stop <Icon name="arrow" size={17}/></button>}
          </div>
        </div>}
      </section>

    </main>}

    {notice && <div className={`toast ${notice.error ? 'toast-error' : ''}`} role={notice.error ? 'alert' : 'status'}><Icon name={notice.error ? 'warning' : 'check'} size={18}/><span>{notice.message}</span><button aria-label="Dismiss message" onClick={() => setNotice(null)}><Icon name="close" size={15}/></button></div>}

    {dialog === 'welcome' && <Modal title="Move a little world." kind="guide" className="walkthrough-dialog" onClose={() => finishWalkthrough(true)}>
      <p className="tour-eyebrow">1 / 3 · A LITTLE PRACTICE</p>
      <div className="dialog-welcome"><GuideCourier/><p className="dialog-intro"><strong>I'll show you the way.</strong>
        Choose a frame, then tap two matching patches to connect A to B. Homes stay fixed. I'll mark exactly what to tap.</p></div>
      <p className="tour-reassurance"><Icon name="clock" size={18}/>This practice has no timer and cannot affect your rank.</p>
      <div className="dialog-actions"><button className="secondary-button" onClick={() => finishWalkthrough(true)} aria-label="Skip walkthrough and play today">Skip</button>
        <button className="primary-button" onClick={() => setDialog(null)}>Show me <Icon name="arrow" size={17}/></button></div>
    </Modal>}

    {(dialog === 'tour-tools' || dialog === 'tour-places') && <Modal
      title={dialog === 'tour-tools' ? 'Your little toolkit.' : 'A new way, every day.'}
      kind="guide" className="walkthrough-dialog" emblem={<GuideCourier portrait/>} wide onClose={() => finishWalkthrough(true)}>
      <p className="tour-eyebrow">{dialog === 'tour-tools' ? '2 / 3 · MAKE IT YOURS' : '3 / 3 · CHOOSE YOUR ROAD'}</p>
      <WalkthroughFeatures section={dialog === 'tour-tools' ? 'tools' : 'places'}/>
      <div className="dialog-actions"><button className="secondary-button" onClick={() => finishWalkthrough(true)} aria-label="Skip walkthrough and play today">Skip</button>
        <button className="primary-button" onClick={() => dialog === 'tour-tools' ? setDialog('tour-places') : finishWalkthrough(false)}>
          {dialog === 'tour-tools' ? 'Continue' : bootstrap?.edition ? 'Play today' : 'Explore'}<Icon name="arrow" size={17}/></button></div>
    </Modal>}

    {dialog === 'tiles' && <Modal title="A little new terrain." kind="guide" className="walkthrough-dialog terrain-intro" wide onClose={acceptTileGuide}>
      <p className="tour-reassurance"><Icon name="clock" size={18}/>The next countdown has not started.</p>
      <TileGuide only={pendingTopics}/>
      <div className="dialog-actions"><button className="primary-button" onClick={acceptTileGuide}>Start island <Icon name="arrow" size={17}/></button></div>
    </Modal>}

    {dialog === 'guide' && <Modal title="How to find a way." kind="guide" onClose={() => setDialog(null)} wide>
      <div className="dialog-welcome">
        <LandscapeIllustration theme={run?.puzzle.theme ?? 'meadow'}/>
        <p className="dialog-intro"><strong>The whole road comes first.</strong> Connect A, then B, then C, in the shown order.
          The traveler waits at A until the complete trail is ready.</p>
      </div>
      <div className="guide-steps">
        {[['Choose a frame', 'Each puzzle fixes the patch size. Choose its orientation using the frame pictures.'],
          ['Tap two places', 'Tap your first patch, then the matching patch. They trade places immediately. Undo is always free.'],
          ['Finish the road', 'Keep one continuous trail through every home, in order. No diagonals, skipped homes or revisiting a square. Then the traveler walks and celebrates.']].map(([title, text], index) =>
          <div className="guide-step" key={title}><GuideIllustration step={index + 1}/><span className="guide-step-number">0{index + 1}</span><h3>{title}</h3><p>{text}</p></div>)}
      </div>
      <TileGuide/>
      <div className="guide-bottom"><div className="guide-score-note"><span className="state-emblem"><Icon name="trophy" size={23}/></span><p><strong>Fewest moves first. Time breaks ties.</strong>Daily scores save automatically. The clock starts after 3, 2, 1 and stops on the winning exchange.</p></div>
        <button className="primary-button" onClick={startWalkthrough}><Icon name="play" size={17}/>Replay walkthrough</button></div>
      <div className="guide-footnotes">
        <p><Icon name="undo" size={18}/><span>Undo is free and keeps the clock running. It cancels the walk and returns the traveler to A.</span></p>
        <p><Icon name="grid" size={18}/><span>Keyboard: arrows choose a square; Space selects it; Escape clears a cut. Flat map has individual labeled buttons.</span></p>
        <p><Icon name="lock" size={18}/><span>Saved scores are yours to control. <button className="text-button data-management-link"
          onClick={() => { setDialogError(null); setDialog('erase'); }}>Manage saved data</button></span></p>
      </div>
    </Modal>}

    {dialog === 'atlas' && <Modal title="Adventure map." kind="map" className="adventure-dialog" onClose={() => {
      practiceRequest.current++; setPracticeLoading(null); setDialog(null);
    }} wide>
      <AdventureMap places={bootstrap?.catalog ?? []} completed={preferences.completed} currentId={run?.puzzle.id ?? ''}
        reduced={reducedMotion}
        loading={practiceLoading} error={dialogError} onSelect={openPractice} onToday={visitToday}/>
    </Modal>}

    {dialog === 'erase' && <Modal title="Remove saved scores?" kind="erase" onClose={() => setDialog(null)}>
      <p className="dialog-intro">Remove your rankings, active timers and synced guide choices from this game community. This cannot be undone.</p>
      <div className="data-choice-grid">
        <div className="data-choice data-remove"><Icon name="trash" size={24}/><strong>Records removed</strong><p>Saved ranks, active timers and synced guide choices.</p></div>
        <div className="data-choice data-keep"><Icon name="leaf" size={24}/><strong>Your road stays</strong><p>Campaign progress, view and sound choices.</p></div>
      </div>
      {dialogError && <p className="inline-error" role="alert"><Icon name="warning" size={18}/>{dialogError}</p>}
      <div className="dialog-actions"><button className="secondary-button" disabled={publishing} onClick={() => setDialog(null)}>Keep my records</button>
      <button className="primary-button danger-button" disabled={publishing} onClick={() => {
        setPublishing(true);
        void Promise.all([...guideWrites.current]).then(() => gameApi.erase()).then(() => {
          saveRequest.current++;
          setAutoSaveSuppressed(true);
          setSaveError(null);
          setPublished(false);
          setMyRank(null);
          setPreferences((current) => ({ ...current, seenGuides: [] }));
          setDialog(null);
          notify('Your leaderboard records were removed.');
        })
          .catch((error: unknown) => { console.error('Could not erase leaderboard data:', error); setDialogError(messageOf(error)); })
          .finally(() => setPublishing(false));
      }}><Icon name="trash" size={17}/>{publishing ? 'Removing...' : 'Remove my records'}</button></div>
    </Modal>}
  </div>;
}
