import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { canTraverse, isAnchor, locate, patchCells, patchOutline, tileAt, walkable } from '../shared/rules.ts';
import type { Anchor, Board, Celebration, Cell, FrameAxes, GuideBounds, GuideTarget, JourneyPlayback, JourneyStop, Shape, Swap, Theme } from '../shared/types.ts';
import { JourneyPlayer } from '../shared/playback.ts';
import type { LivingIsland } from './island.ts';
import { BrandMark, FLAT_AXES, GuideCourier, HomeLetter, Icon } from './components.tsx';
import { worldCssVariables } from './worldTheme.ts';
import { flatCourierGeometry } from './courierSizing.ts';
import { animateFlatExchange } from './flatAnimation.ts';
import { frameArrowPath } from './frameArrow.ts';
import { sceneryOrigins, tileScenery, waterBanks } from './scenery.ts';
import type { FlatExchangeAnimation } from './flatAnimation.ts';
import { viewportSize } from './viewport.ts';
import { communityCrowd, postcardGardens } from './postcard.ts';
import { GardenCottage, GardenPlant, useGardenArt } from './GardenArt.tsx';
import { loadGardenImages } from './gardenAssets.ts';
import { useCraftArt } from './CraftArt.tsx';
import { CraftGroundDetail, CraftPaving, CraftRock } from './CraftTerrainArt.tsx';
import { groundDetail } from './craftSurface.ts';

export interface Transition {
  id: number;
  move: Swap;
}

interface BoardProps {
  board: Board;
  moves: readonly Swap[];
  puzzleId: string;
  theme: Theme;
  seed: number;
  shape: Shape;
  axes: FrameAxes;
  first: Cell | null;
  second: Cell | null;
  hover: Cell | null;
  invalid: boolean;
  invalidPick: number | null;
  blockedCells: readonly Cell[];
  routes: Cell[][];
  transition: Transition | null;
  reduced: boolean;
  dark: boolean;
  flat: boolean;
  guide: boolean;
  guideProbe: Cell | null;
  guideBlockedLink: { from: Cell; to: Cell } | null;
  postcard: boolean;
  miniature: boolean;
  communityCount: number | null;
  celebration: Celebration | null;
  arrived: readonly Anchor[];
  restingStop: Anchor;
  onMoving: (moving: boolean) => void;
  playback: JourneyPlayback | null;
  busy: boolean;
  paused: boolean;
  locked: boolean;
  overlay: ReactNode;
  readyRevision: number;
  onReady: (ready: boolean) => void;
  onCell: (cell: Cell) => void;
  onHover: (cell: Cell | null) => void;
  onBusy: (busy: boolean) => void;
  onFallback: (message: string) => void;
  onProjection: (axes: FrameAxes) => void;
  onGuideBounds: (bounds: GuideTarget | null) => void;
  onArrival: (revision: number, stop: JourneyStop) => void;
  onJourneyEnd: (revision: number) => void;
}

interface StartMarker extends GuideBounds {
  row: number;
  col: number;
  number: 1 | 2;
  preview: boolean;
}

interface BlockedLink { x1: number; y1: number; x2: number; y2: number }

const FLOWER_CSS_COLORS = ['var(--world-flower-one)', 'var(--world-flower-two)', 'var(--world-flower-three)'] as const;

interface FlatTravelerMetrics {
  x: number;
  y: number;
  stepX: number;
  stepY: number;
}

function measureFlatTraveler(map: HTMLDivElement | null, avatar: HTMLSpanElement | null): FlatTravelerMetrics | null {
  const firstCell = map?.querySelector<HTMLButtonElement>('.flat-cell');
  if (!map || !firstCell || !avatar) return null;
  const box = firstCell.getBoundingClientRect();
  const style = getComputedStyle(map);
  const { width, height, offsetX, offsetY } = flatCourierGeometry(box.width, box.height);
  avatar.style.width = `${width}px`;
  avatar.style.height = `${height}px`;
  return {
    x: firstCell.offsetLeft + offsetX,
    y: firstCell.offsetTop + offsetY,
    stepX: box.width + (parseFloat(style.columnGap) || 0),
    stepY: box.height + (parseFloat(style.rowGap) || 0),
  };
}

function positionFlatTraveler(avatar: HTMLSpanElement | null, position: Cell | null, metrics: FlatTravelerMetrics | null): void {
  if (!avatar) return;
  if (!position || !metrics) {
    avatar.style.visibility = 'hidden';
    return;
  }
  avatar.style.visibility = 'visible';
  avatar.style.transform = `translate(${metrics.x + position.col * metrics.stepX}px, ${metrics.y + position.row * metrics.stepY}px)`;
}

export function BoardView(props: BoardProps) {
  const garden = useGardenArt();
  const crafted = useCraftArt();
  const container = useRef<HTMLDivElement>(null);
  const island = useRef<LivingIsland | null>(null);
  const flatMap = useRef<HTMLDivElement>(null);
  const flatTraveler = useRef<HTMLSpanElement>(null);
  const flatPosition = useRef<Cell | null>(null);
  const flatTravelerMetrics = useRef<FlatTravelerMetrics | null>(null);
  const flatMotion = useRef<FlatExchangeAnimation | null>(null);
  const previousFlat = useRef<{ puzzle: string; transition: number | null; flat: boolean }>({ puzzle: '', transition: null, flat: false });
  const stage = useRef<HTMLDivElement>(null);
  const player = useRef<{ revision: number; reduced: boolean; animation: JourneyPlayer } | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const previous = useRef<{ puzzle: string; transition: number | null; board: Board | null }>({ puzzle: '', transition: null, board: null });
  const keyboardCell = useRef<Cell>({ row: 0, col: 0 });
  const [flatExtent, setFlatExtent] = useState(300);
  const [worldReady, setWorldReady] = useState(false);
  const [artReady, setArtReady] = useState(!garden);
  const [startMarkers, setStartMarkers] = useState<StartMarker[]>([]);
  const [blockedLink, setBlockedLink] = useState<BlockedLink | null>(null);
  const size = props.board.length;
  const arrowPath = frameArrowPath(props.shape, props.flat ? FLAT_AXES : props.axes);
  const courierHome = props.celebration?.complete ? props.celebration.anchors.at(-1) ?? null : null;
  const homes = useMemo(() => props.postcard ? props.board.join('').split('').filter(isAnchor) : [], [props.postcard, props.board]);
  const neighbors = useMemo(() => communityCrowd(homes, props.postcard ? props.communityCount : null, courierHome),
    [homes, props.postcard, props.communityCount, courierHome]);
  const origins = useMemo(() => sceneryOrigins(size, props.moves), [size, props.puzzleId, props.moves]);
  const scenery = useMemo(() => origins.map((origin) => tileScenery(props.seed, origin)), [props.seed, origins]);
  const finishGardens = useMemo(() => new Set(props.postcard && props.celebration?.complete ?
    postcardGardens(props.board).map((cell) => `${cell.row},${cell.col}`) : []),
  [props.postcard, props.celebration?.complete, props.board]);
  useEffect(() => {
    if (!garden || (crafted && !props.flat)) return;
    let active = true;
    void loadGardenImages(crafted).then(() => { if (active) setArtReady(true); }).catch((error: unknown) => {
      console.error('The detailed island artwork could not load:', error);
      if (active) callbacks.current.onFallback(error instanceof Error ? error.message : 'The detailed artwork could not load. Reload to try again.');
    });
    return () => { active = false; };
  }, [garden, crafted, props.flat]);
  useEffect(() => {
    keyboardCell.current = { row: 0, col: 0 };
  }, [props.puzzleId]);
  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const measure = (): void => {
      const extent = Math.max(1, Math.floor(Math.min(element.clientWidth, element.clientHeight) - 4));
      setFlatExtent((previous) => previous === extent ? previous : extent);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    flatMotion.current?.finish();
    flatTravelerMetrics.current = measureFlatTraveler(flatMap.current, flatTraveler.current);
    positionFlatTraveler(flatTraveler.current, flatPosition.current, flatTravelerMetrics.current);
  }, [flatExtent, props.flat, props.puzzleId, size]);
  useLayoutEffect(() => {
    const last = previousFlat.current;
    previousFlat.current = { puzzle: props.puzzleId, transition: props.transition?.id ?? null, flat: props.flat };
    if (!props.flat || !props.transition || props.reduced || !last.flat ||
        last.puzzle !== props.puzzleId || last.transition === props.transition.id) return;
    const map = flatMap.current;
    const element = stage.current;
    if (!map || !element) {
      console.error('The flat exchange view is missing.');
      callbacks.current.onFallback('The exchange view could not be found. Reload the island if the map does not appear.');
      return;
    }
    const finish = (): void => {
      flatMotion.current = null;
      element.dataset['flatSwap'] = 'idle';
      callbacks.current.onBusy(false);
    };
    const fail = (error: unknown): void => {
      console.error('The flat terrain exchange could not animate:', error);
      finish();
      callbacks.current.onFallback('The exchange animation could not finish. The flat map is still playable.');
    };
    let motion: FlatExchangeAnimation;
    try {
      motion = animateFlatExchange(map, element, props.transition.move, finish, fail, props.postcard);
      flatMotion.current = motion;
      const paused = callbacks.current.paused || document.hidden;
      motion.setPaused(paused);
      element.dataset['flatSwap'] = paused ? 'paused' : 'running';
      callbacks.current.onBusy(true);
    } catch (error) {
      fail(error);
      return;
    }
    return () => {
      motion.cancel();
      if (flatMotion.current === motion) finish();
    };
  }, [props.flat, props.transition, props.puzzleId, props.reduced, props.postcard]);

  useEffect(() => {
    const element = container.current;
    setWorldReady(false);
    if (!element || props.flat) return;
    let active = true;
    let world: LivingIsland | null = null;
    void Promise.all([import('./island.ts'), garden && !crafted ? loadGardenImages() : Promise.resolve(undefined),
      crafted ? import('./craftWorld.ts').then((module) => module.loadCraftWorld()) : Promise.resolve(undefined)]).then(([module, images, cottage]) => {
      if (!active) return;
      world = new module.LivingIsland(element, {
        onCell: (cell) => callbacks.current.onCell(cell),
        onHover: (cell) => callbacks.current.onHover(cell),
        onBusy: (busy) => callbacks.current.onBusy(busy),
        onError: (message) => callbacks.current.onFallback(message),
        onProjection: (axes) => callbacks.current.onProjection(axes),
      }, callbacks.current.postcard, callbacks.current.miniature || garden, images, cottage);
      world.setAppearance(callbacks.current.dark);
      island.current = world;
      previous.current = { puzzle: '', transition: null, board: null };
      setWorldReady(true);
    }).catch((error: unknown) => {
      if (!active) return;
      console.error('The living terrain renderer could not start:', error);
      callbacks.current.onFallback('3D could not start in this browser. The accessible flat map is fully playable.');
    });
    return () => {
      active = false;
      if (island.current === world) island.current = null;
      world?.dispose();
    };
  }, [props.flat, props.onFallback, props.postcard, props.miniature, garden, crafted]);

  useEffect(() => {
    const world = island.current;
    if (!world) return;
    const last = previous.current;
    if (last.puzzle !== props.puzzleId || !props.transition || last.board === null) {
      if (last.board !== props.board || last.puzzle !== props.puzzleId) world.reset(props.board, props.theme, props.seed, origins);
    } else if (last.transition !== props.transition.id) {
      world.animateSwap(props.transition.move, props.board);
    }
    previous.current = { puzzle: props.puzzleId, transition: props.transition?.id ?? null, board: props.board };
  }, [props.board, props.puzzleId, props.theme, props.seed, props.transition, props.flat, worldReady, origins]);

  useEffect(() => { island.current?.setHighlights(props.shape, props.first, props.second, props.hover, props.invalid, props.blockedCells, props.invalidPick); },
    [props.shape, props.first, props.second, props.hover, props.invalid, props.blockedCells, props.invalidPick, props.flat, worldReady]);
  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const boundsFor = (cell: Cell, shape: Shape = { rows: 1, cols: 1 }): GuideBounds | null => {
      if (!props.flat) return island.current?.guideBounds(cell, shape) ?? null;
      const boxes = patchCells(cell, shape).map((part) => flatMap.current?.querySelector<HTMLElement>(
        `.flat-cell[data-row="${part.row}"][data-col="${part.col}"]`)?.getBoundingClientRect())
        .filter((box): box is DOMRect => box !== undefined);
      if (!boxes.length) return null;
      const x = Math.min(...boxes.map((box) => box.x)), y = Math.min(...boxes.map((box) => box.y));
      return { x, y, width: Math.max(...boxes.map((box) => box.right)) - x, height: Math.max(...boxes.map((box) => box.bottom)) - y };
    };
    const update = (): void => {
      const target = props.guideProbe ?? props.hover;
      const cell = props.guide && target ? boundsFor(target) : null;
      const patches = props.guideProbe && cell ? [cell] : props.guide ? [props.hover, props.first].filter((part): part is Cell => part !== null)
        .map((part) => boundsFor(part, props.shape)).filter((bounds): bounds is GuideBounds => bounds !== null) : [];
      callbacks.current.onGuideBounds(cell ? { cell, patches, viewport: viewportSize() } : null);
      const markers: StartMarker[] = [];
      const stageBox = element.getBoundingClientRect();
      const from = props.guideBlockedLink ? boundsFor(props.guideBlockedLink.from) : null;
      const to = props.guideBlockedLink ? boundsFor(props.guideBlockedLink.to) : null;
      const link = from && to ? {
        x1: from.x + from.width / 2 - stageBox.x, y1: from.y + from.height / 2 - stageBox.y,
        x2: to.x + to.width / 2 - stageBox.x, y2: to.y + to.height / 2 - stageBox.y,
      } : null;
      setBlockedLink((current) => current && link && current.x1 === link.x1 && current.y1 === link.y1 &&
        current.x2 === link.x2 && current.y2 === link.y2 ? current : link);
      const add = (cell: Cell | null, number: 1 | 2, preview: boolean): void => {
        if (!cell) return;
        const bounds = boundsFor(cell);
        if (bounds) markers.push({ ...bounds, x: bounds.x - stageBox.x, y: bounds.y - stageBox.y,
          row: cell.row, col: cell.col, number, preview });
      };
      if (!props.busy && !props.locked) {
        add(props.first, 1, false);
        add(props.second, 2, false);
        if (!props.second && !props.invalid && props.hover &&
            !(props.first?.row === props.hover.row && props.first.col === props.hover.col)) {
          add(props.hover, props.first ? 2 : 1, true);
        }
      }
      setStartMarkers((current) => current.length === markers.length && current.every((marker, index) => {
        const next = markers[index];
        return next && marker.x === next.x && marker.y === next.y && marker.width === next.width && marker.height === next.height &&
          marker.row === next.row && marker.col === next.col && marker.number === next.number && marker.preview === next.preview;
      }) ? current : markers);
    };
    let frame = 0;
    const schedule = (): void => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    schedule();
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, [props.guide, props.guideProbe, props.guideBlockedLink, props.first, props.second, props.hover, props.invalid, props.busy, props.locked, props.shape, props.axes, props.flat, flatExtent, worldReady]);
  useEffect(() => { callbacks.current.onReady(props.flat ? artReady : worldReady); },
    [props.flat, props.puzzleId, props.readyRevision, worldReady, artReady]);
  useEffect(() => { island.current?.setReducedMotion(props.reduced); }, [props.reduced, props.flat, worldReady]);
  useEffect(() => { island.current?.setAppearance(props.dark); }, [props.dark, props.flat, worldReady]);
  useEffect(() => { island.current?.setPaused(props.paused); }, [props.paused, props.flat, worldReady]);
  useEffect(() => { island.current?.setCommunityCount(props.communityCount); }, [props.communityCount, props.flat, worldReady]);
  useEffect(() => {
    const update = (): void => {
      const paused = props.paused || document.hidden;
      stage.current?.setAttribute('data-animation-paused', String(paused));
      if (flatMotion.current) {
        flatMotion.current.setPaused(paused);
        stage.current?.setAttribute('data-flat-swap', paused ? 'paused' : 'running');
      }
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [props.paused]);
  useEffect(() => { island.current?.setRoutes(props.routes); }, [props.routes, props.flat, props.puzzleId, worldReady]);
  useEffect(() => { island.current?.setArrivals(props.arrived); }, [props.arrived, props.flat, worldReady]);
  useEffect(() => {
    if (props.celebration) island.current?.celebrate(props.celebration);
    else island.current?.clearCelebration();
  }, [props.celebration, props.flat, worldReady]);
  useEffect(() => {
    if (props.flat) props.onProjection(FLAT_AXES);
  }, [props.flat, props.onProjection]);
  useEffect(() => {
    const playback = props.playback;
    if (!playback) {
      player.current = null;
      const home = locate(props.board, props.restingStop);
      if (!home) throw new Error('The traveler home is missing from this landscape.');
      flatPosition.current = home;
      positionFlatTraveler(flatTraveler.current, home, flatTravelerMetrics.current);
      if (flatTraveler.current) {
        flatTraveler.current.dataset['motion'] = 'idle';
        flatTraveler.current.dataset['facing'] = 'south';
      }
      island.current?.restAt(props.restingStop);
      stage.current?.setAttribute('data-traveler-stop', props.restingStop);
      callbacks.current.onMoving(false);
      return;
    }
    if (props.busy || props.paused) return;
    if (!props.flat && !worldReady) return;
    if (!player.current || player.current.revision !== playback.revision || player.current.reduced !== props.reduced) {
      player.current = { revision: playback.revision, reduced: props.reduced, animation: new JourneyPlayer(playback.plan, props.reduced) };
      flatPosition.current = null;
      positionFlatTraveler(flatTraveler.current, null, flatTravelerMetrics.current);
      stage.current?.setAttribute('data-traveler-stop', playback.plan.stops[0]?.anchor ?? '');
    }
    const animation = player.current.animation;
    let active = true;
    let frameId = 0;
    let previousTime = performance.now();
    const resetTime = (): void => { previousTime = performance.now(); };
    const tick = (now: number): void => {
      if (!active) return;
      const elapsed = document.hidden ? 0 : Math.min(60, Math.max(0, now - previousTime));
      previousTime = now;
      if (!document.hidden) {
        const frame = animation.advance(elapsed);
        callbacks.current.onMoving(frame.walking);
        island.current?.moveTraveler(frame);
        flatPosition.current = frame.position;
        positionFlatTraveler(flatTraveler.current, frame.position, flatTravelerMetrics.current);
        const motion = frame.walking ? 'walking' : 'greeting';
        if (flatTraveler.current && flatTraveler.current.dataset['motion'] !== motion) flatTraveler.current.dataset['motion'] = motion;
        if (flatTraveler.current && (frame.facing.row || frame.facing.col)) {
          const facing = frame.facing.col < 0 ? 'west' : frame.facing.col > 0 ? 'east' : frame.facing.row < 0 ? 'north' : 'south';
          if (flatTraveler.current.dataset['facing'] !== facing) flatTraveler.current.dataset['facing'] = facing;
        }
        for (const stop of frame.arrivals) {
          stage.current?.setAttribute('data-traveler-stop', stop.anchor);
          callbacks.current.onArrival(playback.revision, stop);
        }
        if (frame.finished) {
          callbacks.current.onMoving(false);
          callbacks.current.onJourneyEnd(playback.revision);
          return;
        }
      }
      frameId = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', resetTime);
    frameId = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', resetTime);
      callbacks.current.onMoving(false);
    };
  }, [props.playback, props.busy, props.paused, props.flat, props.reduced, props.restingStop, props.board, worldReady]);

  const selectedCells = (cell: Cell | null): Set<string> => new Set(
    cell ? patchCells(cell, props.shape).map((part) => `${part.row},${part.col}`) : [],
  );
  const first = selectedCells(props.first);
  const second = selectedCells(props.second);
  const guided = selectedCells(props.guide ? props.hover : null);
  const blocked = new Set(props.blockedCells.map((cell) => `${cell.row},${cell.col}`));
  const preview = props.hover && !(props.first && props.first.row === props.hover.row && props.first.col === props.hover.col)
    ? props.hover : null;
  const frameContents = (shape: Shape, number: string | number): ReactNode => <>
    {shape.kind === 'ell' && <svg className="shaped-frame-outline" viewBox={`0 0 ${shape.cols} ${shape.rows}`} preserveAspectRatio="none">
      <path d={`${patchOutline(shape).map((cell, index) => `${index ? 'L' : 'M'}${cell.col} ${cell.row}`).join('')}Z`}
        fill="currentColor" fillOpacity=".08" stroke="#fffdf1" strokeWidth="7" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
      <path d={`${patchOutline(shape).map((cell, index) => `${index ? 'L' : 'M'}${cell.col} ${cell.row}`).join('')}Z`}
        fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
    </svg>}
    <span className="flat-frame-badge">{number}</span>
  </>;
  const flatFrame = (cell: Cell, number: 1 | 2, preview: boolean, invalid = false): ReactNode =>
    <div key={invalid ? `${number}:${props.invalidPick}` : number} className={`flat-patch-frame patch-${number} ${props.shape.kind === 'ell' ? 'shaped-frame' : ''} ${preview ? 'preview' : 'selected'} ${invalid ? 'invalid' : ''}`}
      data-testid={`flat-frame-${number}`} data-preview={preview} data-invalid={invalid} aria-hidden="true"
      data-invalid-pick={invalid ? props.invalidPick ?? undefined : undefined}
      style={{ gridColumn: `${cell.col + 1} / span ${Math.min(props.shape.cols, size - cell.col)}`,
        gridRow: `${cell.row + 1} / span ${Math.min(props.shape.rows, size - cell.row)}` }}>
      {frameContents(props.shape, invalid ? '!' : number)}
    </div>;

  return <div ref={stage} className={`world-stage theme-${props.theme} ${props.flat ? 'is-flat' : ''} ${size > 6 ? 'large-world' : ''} ${props.locked ? 'input-locked' : ''} ${props.postcard ? 'postcard-preview' : ''}`} data-testid="world-stage"
    style={worldCssVariables(props.theme, props.dark, crafted)}
    data-postcard={props.postcard && props.celebration?.complete ? 'alive' : 'puzzle'} data-art={garden ? 'realistic' : 'classic'}
    data-size={size} data-art-pass={crafted ? 'sculpted' : undefined} data-playback={props.playback ? 'active' : 'idle'} data-celebration={props.celebration?.complete ? 'complete' : props.celebration ? 'destination' : 'none'}>
    {!props.flat && <div ref={container} className="world-canvas-wrap" role="application" tabIndex={0}
      aria-busy={!worldReady}
      aria-label={`${size} by ${size} landscape. Start wide patches at the left tile, tall patches at the top tile, and square or L patches at the top-left tile. Arrow keys choose a square; Space selects. Selecting the second patch swaps immediately. Home and End reach opposite corners. Escape clears the cut.`}
      onKeyDown={(event) => {
        if (!worldReady || props.locked || props.busy) { event.preventDefault(); return; }
        const cell = { ...keyboardCell.current };
        if (event.key === 'Home') { cell.row = 0; cell.col = 0; }
        else if (event.key === 'End') { cell.row = size - 1; cell.col = size - 1; }
        else if (event.key === 'ArrowUp') cell.row = Math.max(0, cell.row - 1);
        else if (event.key === 'ArrowDown') cell.row = Math.min(size - 1, cell.row + 1);
        else if (event.key === 'ArrowLeft') cell.col = Math.max(0, cell.col - 1);
        else if (event.key === 'ArrowRight') cell.col = Math.min(size - 1, cell.col + 1);
        else if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); props.onCell(cell); return; }
        else return;
        event.preventDefault();
        keyboardCell.current = cell;
        props.onHover(cell);
      }}>
      {!worldReady && <div className="world-loading" role="status"><BrandMark/><span>Opening the island...</span></div>}
    </div>}
    {props.flat && <div className="flat-map-scroll" tabIndex={0} role="region" aria-label="Accessible map" onPointerLeave={() => props.onHover(null)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) props.onHover(null); }}>
      <div ref={flatMap} className="flat-map" role="group" aria-label={`Accessible ${size} by ${size} map`}
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`, width: flatExtent, height: flatExtent }}>
      {Array.from({ length: size * size }, (_, index) => {
        const cell = { row: Math.floor(index / size), col: index % size };
        const tile = tileAt(props.board, cell);
        const origin = origins[index];
        if (origin === undefined) throw new Error('The flat scenery is missing a terrain identity.');
        const decoration = scenery[index];
        if (!decoration) throw new Error('The flat scenery is missing its decorations.');
        const detail = crafted && tile === '.' && decoration.variant % 2 === 0 ? groundDetail(props.theme, decoration.variant) : null;
        const watery = tile === '~' || tile === 'h' || tile === 'v';
        const banks = watery ? waterBanks(props.board, cell) : null;
        const waterStyle: (CSSProperties & Record<`--shore-${string}`, string>) | undefined = banks ? {
          '--shore-north': banks.north ? 'var(--world-water-light)' : 'transparent',
          '--shore-south': banks.south ? 'var(--world-water-light)' : 'transparent',
          '--shore-west': banks.west ? 'var(--world-water-light)' : 'transparent',
          '--shore-east': banks.east ? 'var(--world-water-light)' : 'transparent',
        } : undefined;
        const key = `${cell.row},${cell.col}`;
        const name = isAnchor(tile) ? `Pinned landmark ${tile}` : tile === 'o' ? 'Paving' : tile === '~' ? 'Water' :
          tile === 'x' ? 'Fixed boulder' : tile === 'h' ? 'Bridge, east and west only' : tile === 'v' ? 'Bridge, north and south only' : 'Grass';
        return <button key={key} className={`flat-cell terrain-${tile === '.' ? 'grass' : tile === '~' ? 'water' : tile === 'x' ? 'rock' : tile === 'h' || tile === 'v' ? 'bridge' : 'path'} ${first.has(key) ? 'cut-one' : ''} ${second.has(key) ? 'cut-two' : ''} ${guided.has(key) ? 'guided-cell' : ''} ${blocked.has(key) ? 'blocked-cell' : ''}`}
          data-row={cell.row} data-col={cell.col} data-tile={tile} data-scenery-origin={origin} data-blocked={blocked.has(key)} disabled={props.locked} style={waterStyle}
          aria-label={`Row ${cell.row + 1}, column ${cell.col + 1}: ${name}${first.has(key) ? ', part of selected patch 1' : second.has(key) ? ', part of selected patch 2' : ''}`}
          aria-disabled={props.busy}
          onClick={() => { if (!props.busy) props.onCell(cell); }}
          onFocus={() => { if (!props.busy) props.onHover(cell); }}
          onPointerEnter={() => { if (!props.busy) props.onHover(cell); }}>
          {crafted && banks && ([['north', banks.north], ['south', banks.south], ['east', banks.east], ['west', banks.west]] as const)
            .filter(([, visible]) => visible).map(([edge]) => <i key={edge} className={`craft-shore shore-${edge}`} aria-hidden="true"/>)}
          {walkable(tile) && <>
            {tile !== 'h' && tile !== 'v' && (crafted ? <CraftPaving variant={decoration.variant}/> : <i className="flat-stone" aria-hidden="true"/>)}
            {[{ row: -1, col: 0, name: 'north' }, { row: 1, col: 0, name: 'south' },
              { row: 0, col: -1, name: 'west' }, { row: 0, col: 1, name: 'east' }].filter((direction) =>
              canTraverse(props.board, cell, { row: cell.row + direction.row, col: cell.col + direction.col })).map((direction) =>
              <i key={direction.name} className={`flat-road-link road-${direction.name} ${tile === 'h' || tile === 'v' ? 'wooden-link' : ''}`}
                data-road-direction={direction.name} aria-hidden="true"/>)}
          </>}
          {isAnchor(tile) ? <span key={`${tile}:${props.celebration?.id ?? 0}`} style={{ fontSize: Math.max(12, Math.min(16, flatExtent / size * 0.52)) }}
            className={`flat-landmark ${props.postcard && props.celebration?.complete ? 'flat-home-awake' : ''} ${props.celebration?.anchors.includes(tile) ? 'destination-celebration' : ''}`}>
            {garden ? <GardenCottage variant={tile.charCodeAt(0) - 65} flat winter={props.theme === 'winter'} className="flat-cottage"/> :
            <svg className="flat-cottage" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <path d="M46 19V7h7v18" fill="var(--world-wood)" stroke="var(--world-wood-shade)" strokeWidth="1.5"/>
              <path className="flat-cottage-wall" d="M13 26h38v31H13Z" fill="var(--world-home-badge)" stroke="var(--home-roof)" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M5 28 32 6 59 28 55 32 32 13 9 32Z" fill="var(--home-roof)" stroke="var(--home-roof)" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="m11 27 21-17 21 17" stroke="var(--world-home-badge)" strokeOpacity=".3" strokeWidth="1.5"/>
              {props.theme === 'winter' && <path d="m8 26 24-19 24 19-4 3-20-15-20 15Z" fill="#e8f1f0"/>}
              <path d="M17 34h9v10h-9Zm21 0h9v10h-9Z" fill="var(--world-wood-light)" stroke="var(--world-wood-shade)" strokeWidth="1.5"/>
              <path d="M21.5 34v10m-4.5-5h9m16.5-5v10M38 39h9" stroke="var(--world-wood-shade)" strokeWidth="1"/>
              <rect className="flat-cottage-door" x="27" y="39" width="10" height="18" rx="1" fill="var(--world-wood)" stroke="var(--world-wood-shade)" strokeWidth="1.5"/>
              <circle cx="34.5" cy="49" r="1" fill="var(--world-wood-light)"/>
              <path d="M11 58h42" stroke="var(--world-wood-light)" strokeWidth="3" strokeLinecap="round"/>
            </svg>}
            <HomeLetter anchor={tile} compact/><span className="sr-only">{tile}</span></span> :
            tile === 'o' ? null : tile === '~' ? <><i className="flat-ripples" aria-hidden="true"/>
              {decoration.fish && <i className="flat-fish" style={{ animationDelay: `${-decoration.variant}s` }} aria-hidden="true"/>}</> :
              tile === 'x' ? crafted ? <CraftRock/> : <i className="flat-rock"/> : tile === 'h' || tile === 'v'
                ? <i className={`flat-bridge bridge-${tile}`}>
                  <svg viewBox="0 0 32 16" aria-hidden="true" data-bridge-axis={tile === 'h' ? 'east-west' : 'north-south'}>
                    <path d="M4 8h24M9 3 4 8l5 5m14-10 5 5-5 5" fill="none" stroke="#fff4d7" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 8h24M9 3 4 8l5 5m14-10 5 5-5 5" fill="none" stroke="#24333b" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </i> : <i className="flat-grass"/>}
          {tile === '.' && decoration.flowers.length > 0 && (!garden || props.theme !== 'winter') && (garden ? <GardenPlant flowers theme={props.theme} variant={decoration.variant} className="flat-flowers"/> :
          <svg className="flat-flowers" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            {decoration.flowers.map((flower, index) =>
              <g key={index} transform={`translate(${16 + flower.x * 32} ${18 + flower.z * 32}) rotate(${flower.rotation * 180 / Math.PI}) scale(${flower.scale})`}>
                <path d="M0 5V-2" stroke="var(--world-blade)" strokeWidth="1.2"/>
                <path d="M0-2q-5 0-3-3-2-4 3-3 3-4 4 0 4 3 0 4 0 4-4 2Z" fill={FLOWER_CSS_COLORS[flower.color]}/>
                <circle cy="-4" r="1.3" fill="#f3d16f"/>
              </g>)}
          </svg>)}
          {tile === '.' && props.theme !== 'meadow' && props.theme !== 'coast' && props.theme !== 'orchard' &&
            decoration.flowers.length === 0 && decoration.variant === 0 && (garden ? <GardenPlant theme={props.theme} className="flat-season-tree"/> :
            <svg className="flat-season-tree" viewBox="0 0 32 32" aria-hidden="true">
              <ellipse cx="16" cy="27" rx="10" ry="3" fill="#17382e33"/>
              <path d="M16 28V12" stroke="#88704e" strokeWidth="2.5"/>
              {props.theme === 'winter' ? <>
                <path d="m16 2-10 15h5l-7 9h24l-7-9h5Z" fill="var(--world-foliage-deep)"/>
                <path d="m16 2-7 12h14Zm0 10-9 11h18Z" fill="#dfebed"/>
              </> : <>
                <circle cx="11" cy="15" r="7" fill="var(--world-foliage-deep)"/>
                <circle cx="22" cy="14" r="7" fill="var(--world-foliage-mid)"/>
                <circle cx="16" cy="9" r="8" fill="var(--world-foliage-light)"/>
              </>}
            </svg>)}
          {finishGardens.has(key) && (garden ?
            <GardenPlant flowers theme={props.theme} variant={decoration.variant} delay={decoration.variant % 6 * 90} className="postcard-blooms"/> : <svg className="postcard-blooms" viewBox="0 0 32 32"
            style={{ animationDelay: `${decoration.variant % 6 * 90}ms` }} aria-hidden="true">
            <path d="M8 29V17m14 11V12m-14 10-4-3m18 0 4-3" fill="none" stroke="var(--world-blade)" strokeWidth="1.5"/>
            <g fill={FLOWER_CSS_COLORS[decoration.variant % 3]}><path d="M8 10q5-4 5 1 5 1 1 5 1 5-4 4-4 4-5-1-5-1-1-5-1-4 4-4ZM22 5q5-4 5 1 5 1 1 5 1 5-4 4-4 4-5-1-5-1-1-5-1-4 4-4Z"/></g>
            <g fill="#f3cf75"><circle cx="8" cy="15" r="2"/><circle cx="22" cy="10" r="2"/></g>
          </svg>)}
          {props.postcard && isAnchor(tile) && props.celebration?.complete && <span className="postcard-home-life" aria-hidden="true"
            style={{ animationDelay: `${(tile.charCodeAt(0) - 65) * 90}ms` }}>
            <i className="postcard-open-door"/>
            {(props.communityCount !== null && props.communityCount > 0
              ? neighbors.filter((person) => person.anchor === tile).map((person) => person.side)
              : tile !== courierHome && (tile === 'B' || tile === 'C' || tile === 'D') ? [-1] : []).map((side) => <svg key={side} className="postcard-neighbor" viewBox="0 0 24 40"
                style={side > 0 ? { left: 'auto', right: '2%' } : undefined}>
              <path d="M8 30v8m8-8v8" stroke="#35474d" strokeWidth="4"/>
              <path d="M7 18q5-4 10 0l2 14H5Z" fill={props.communityCount !== null && props.communityCount > 0 ? '#507e78' : `var(--world-home-${tile.toLowerCase()})`}/>
              <circle cx="12" cy="12" r="6" fill="#ebc39b"/>
              <path d="M4 8h16M8 7V4h8v3" fill="none" stroke="#e9c77f" strokeWidth="3" strokeLinecap="round"/>
              <path d="m18 20 3-10" stroke="#ebc39b" strokeWidth="3" strokeLinecap="round" className="postcard-neighbor-arm"/>
              <path d="M10 12h.2m3.6 0h.2" stroke="#253f43" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>)}
          </span>}
          {detail && <span className="craft-ground-position" aria-hidden="true"
            style={{ left: `${50 + detail.x * 100}%`, top: `${50 + detail.z * 100}%` }}>
            <CraftGroundDetail motif={detail.motif} turn={detail.turn}/>
          </span>}
          {blocked.has(key) && <span key={props.invalidPick} className="cell-rejection" data-invalid-pick={props.invalidPick ?? undefined} aria-hidden="true">
            <span className="cell-warning"><Icon name="warning" size={12}/></span>
          </span>}
        </button>;
      })}
      {!props.busy && !props.second && preview && flatFrame(preview, props.first ? 2 : 1, true, props.invalid)}
      {!props.busy && props.first && flatFrame(props.first, 1, false)}
      {!props.busy && props.second && flatFrame(props.second, 2, false)}
      {props.busy && props.transition && !props.reduced && <>
        <div className={`flat-patch-frame patch-2 flat-swap-frame ${props.transition.move.kind === 'ell' ? 'shaped-frame' : ''}`} data-flat-swap-patch="a" aria-hidden="true"
          style={{ gridColumn: `${props.transition.move.a.col + 1} / span ${props.transition.move.cols}`,
            gridRow: `${props.transition.move.a.row + 1} / span ${props.transition.move.rows}` }}>{frameContents(props.transition.move, 2)}</div>
        <div className={`flat-patch-frame patch-1 flat-swap-frame ${props.transition.move.kind === 'ell' ? 'shaped-frame' : ''}`} data-flat-swap-patch="b" aria-hidden="true"
          style={{ gridColumn: `${props.transition.move.b.col + 1} / span ${props.transition.move.cols}`,
            gridRow: `${props.transition.move.b.row + 1} / span ${props.transition.move.rows}` }}>{frameContents(props.transition.move, 1)}</div>
      </>}
      <span ref={flatTraveler} className="flat-traveler" aria-hidden="true"><GuideCourier onBoard/></span>
      </div>
    </div>}
    {!props.busy && !props.locked && startMarkers.length > 0 && <div className="patch-start-markers" aria-hidden="true">
      {startMarkers.map((marker) => <svg key={marker.number} className={`patch-start-arrow patch-${marker.number}`}
        viewBox="0 0 32 32" fill="none" focusable="false"
        data-patch={marker.number} data-row={marker.row} data-col={marker.col} data-preview={marker.preview}
        data-frame-axis={props.shape.rows > props.shape.cols ? 'row' : 'col'}
        style={{ left: marker.x, top: marker.y, width: marker.width, height: marker.height }}>
        <path d={arrowPath} stroke="#fffdf1" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d={arrowPath} stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>)}
    </div>}
    {blockedLink && <svg className="guide-blocked-link" data-testid="guide-blocked-link" aria-hidden="true">
      <g>
        <path d={`M${blockedLink.x1 * .7 + blockedLink.x2 * .3} ${blockedLink.y1 * .7 + blockedLink.y2 * .3}L${blockedLink.x1 * .3 + blockedLink.x2 * .7} ${blockedLink.y1 * .3 + blockedLink.y2 * .7}`}
          fill="none" stroke="#fffdf1" strokeWidth="7" strokeLinecap="round"/>
        <path d={`M${blockedLink.x1 * .7 + blockedLink.x2 * .3} ${blockedLink.y1 * .7 + blockedLink.y2 * .3}L${blockedLink.x1 * .3 + blockedLink.x2 * .7} ${blockedLink.y1 * .3 + blockedLink.y2 * .7}`}
          fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="3 3" strokeLinecap="round"/>
        <g transform={`translate(${(blockedLink.x1 + blockedLink.x2) / 2} ${(blockedLink.y1 + blockedLink.y2) / 2})`}>
          <path d="m-5-5 10 10m0-10-10 10" stroke="#fffdf1" strokeWidth="7" strokeLinecap="round"/>
          <path d="m-5-5 10 10m0-10-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </g>
      </g>
    </svg>}
    {props.overlay}
  </div>;
}
