import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { canTraverse, isAnchor, locate, patchCells, patchOutline, tileAt, walkable } from '../shared/rules.ts';
import type { Anchor, Board, Celebration, Cell, FrameAxes, GuideBounds, GuideTarget, JourneyPlayback, JourneyStop, Shape, Swap, Theme } from '../shared/types.ts';
import { JourneyPlayer } from '../shared/playback.ts';
import type { LivingIsland } from './island.ts';
import { BrandMark, FLAT_AXES, GuideCourier, HomeLetter, Icon } from './components.tsx';
import { COURIER_SCALE, worldCssVariables } from './worldTheme.ts';
import { animateFlatExchange } from './flatAnimation.ts';
import { frameArrowPath } from './frameArrow.ts';
import { sceneryOrigins, tileScenery, waterBanks } from './scenery.ts';
import type { FlatExchangeAnimation } from './flatAnimation.ts';
import { viewportSize } from './viewport.ts';

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
  blockedCells: readonly Cell[];
  routes: Cell[][];
  transition: Transition | null;
  reduced: boolean;
  dark: boolean;
  flat: boolean;
  guide: boolean;
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

const FLOWER_CSS_COLORS = ['var(--world-flower-one)', 'var(--world-flower-two)', 'var(--world-flower-three)'] as const;

function positionFlatTraveler(map: HTMLDivElement | null, avatar: HTMLSpanElement | null, position: Cell | null): void {
  if (!avatar) return;
  const firstCell = map?.querySelector<HTMLButtonElement>('.flat-cell');
  if (!map || !firstCell || !position) {
    avatar.style.visibility = 'hidden';
    return;
  }
  const box = firstCell.getBoundingClientRect();
  const style = getComputedStyle(map);
  const colGap = parseFloat(style.columnGap) || 0;
  const rowGap = parseFloat(style.rowGap) || 0;
  const width = Math.min(13 * COURIER_SCALE, box.width * 0.48);
  const height = Math.min(17 * COURIER_SCALE, box.height * 0.68);
  const x = firstCell.offsetLeft + box.width * 0.74 + position.col * (box.width + colGap);
  const y = firstCell.offsetTop + box.height * 0.65 + position.row * (box.height + rowGap);
  avatar.style.visibility = 'visible';
  avatar.style.width = `${width}px`;
  avatar.style.height = `${height}px`;
  avatar.style.transform = `translate(${x - width / 2}px, ${y - height / 2}px)`;
}

export function BoardView(props: BoardProps) {
  const container = useRef<HTMLDivElement>(null);
  const island = useRef<LivingIsland | null>(null);
  const flatMap = useRef<HTMLDivElement>(null);
  const flatTraveler = useRef<HTMLSpanElement>(null);
  const flatPosition = useRef<Cell | null>(null);
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
  const [startMarkers, setStartMarkers] = useState<StartMarker[]>([]);
  const size = props.board.length;
  const origins = useMemo(() => sceneryOrigins(size, props.moves), [size, props.puzzleId, props.moves]);
  const scenery = useMemo(() => origins.map((origin) => tileScenery(props.seed, origin)), [props.seed, origins]);
  useEffect(() => {
    keyboardCell.current = { row: 0, col: 0 };
  }, [props.puzzleId]);
  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const measure = (): void => {
      const extent = Math.max(1, Math.floor(Math.min(element.clientWidth, element.clientHeight) - 16));
      setFlatExtent((previous) => previous === extent ? previous : extent);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    positionFlatTraveler(flatMap.current, flatTraveler.current, flatPosition.current);
    flatMotion.current?.finish();
  }, [flatExtent, props.flat]);
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
      motion = animateFlatExchange(map, element, props.transition.move, finish, fail);
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
  }, [props.flat, props.transition, props.puzzleId, props.reduced]);

  useEffect(() => {
    const element = container.current;
    setWorldReady(false);
    if (!element || props.flat) return;
    let active = true;
    let world: LivingIsland | null = null;
    void import('./island.ts').then((module) => {
      if (!active) return;
      world = new module.LivingIsland(element, {
        onCell: (cell) => callbacks.current.onCell(cell),
        onHover: (cell) => callbacks.current.onHover(cell),
        onBusy: (busy) => callbacks.current.onBusy(busy),
        onError: (message) => callbacks.current.onFallback(message),
        onProjection: (axes) => callbacks.current.onProjection(axes),
      });
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
  }, [props.flat, props.onFallback]);

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

  useEffect(() => { island.current?.setHighlights(props.shape, props.first, props.second, props.hover, props.invalid, props.blockedCells); },
    [props.shape, props.first, props.second, props.hover, props.invalid, props.blockedCells, props.flat, worldReady]);
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
      const cell = props.guide && props.hover ? boundsFor(props.hover) : null;
      const patches = props.guide ? [props.hover, props.first].filter((part): part is Cell => part !== null)
        .map((part) => boundsFor(part, props.shape)).filter((bounds): bounds is GuideBounds => bounds !== null) : [];
      callbacks.current.onGuideBounds(cell ? { cell, patches, viewport: viewportSize() } : null);
      const markers: StartMarker[] = [];
      const stageBox = element.getBoundingClientRect();
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
  }, [props.guide, props.first, props.second, props.hover, props.invalid, props.busy, props.locked, props.shape, props.axes, props.flat, flatExtent, worldReady]);
  useEffect(() => { callbacks.current.onReady(props.flat || worldReady); },
    [props.flat, props.puzzleId, props.readyRevision, worldReady]);
  useEffect(() => { island.current?.setReducedMotion(props.reduced); }, [props.reduced, props.flat, worldReady]);
  useEffect(() => { island.current?.setAppearance(props.dark); }, [props.dark, props.flat, worldReady]);
  useEffect(() => { island.current?.setPaused(props.paused); }, [props.paused, props.flat, worldReady]);
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
      positionFlatTraveler(flatMap.current, flatTraveler.current, home);
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
      positionFlatTraveler(flatMap.current, flatTraveler.current, null);
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
        positionFlatTraveler(flatMap.current, flatTraveler.current, frame.position);
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
  const arrowPath = frameArrowPath(props.shape, props.flat ? FLAT_AXES : props.axes);
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
    <div key={number} className={`flat-patch-frame patch-${number} ${props.shape.kind === 'ell' ? 'shaped-frame' : ''} ${preview ? 'preview' : 'selected'} ${invalid ? 'invalid' : ''}`}
      data-testid={`flat-frame-${number}`} data-preview={preview} data-invalid={invalid} aria-hidden="true"
      style={{ gridColumn: `${cell.col + 1} / span ${Math.min(props.shape.cols, size - cell.col)}`,
        gridRow: `${cell.row + 1} / span ${Math.min(props.shape.rows, size - cell.row)}` }}>
      {frameContents(props.shape, invalid ? '!' : number)}
    </div>;

  return <div ref={stage} className={`world-stage theme-${props.theme} ${props.flat ? 'is-flat' : ''} ${size > 6 ? 'large-world' : ''} ${props.locked ? 'input-locked' : ''}`} data-testid="world-stage"
    style={worldCssVariables(props.theme, props.dark)}
    data-size={size} data-playback={props.playback ? 'active' : 'idle'} data-celebration={props.celebration?.complete ? 'complete' : props.celebration ? 'destination' : 'none'}>
    {!props.flat && <div ref={container} className="world-canvas-wrap" role="application" tabIndex={0}
      aria-busy={!worldReady}
      aria-label={`${size} by ${size} landscape. Arrow keys choose a square; Space selects. Selecting the second patch swaps immediately. Home and End reach opposite corners. Escape clears the cut.`}
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
          {walkable(tile) && <>
            {tile !== 'h' && tile !== 'v' && <i className="flat-stone" aria-hidden="true"/>}
            {[{ row: -1, col: 0, name: 'north' }, { row: 1, col: 0, name: 'south' },
              { row: 0, col: -1, name: 'west' }, { row: 0, col: 1, name: 'east' }].filter((direction) =>
              canTraverse(props.board, cell, { row: cell.row + direction.row, col: cell.col + direction.col })).map((direction) =>
              <i key={direction.name} className={`flat-road-link road-${direction.name} ${tile === 'h' || tile === 'v' ? 'wooden-link' : ''}`}
                data-road-direction={direction.name} aria-hidden="true"/>)}
          </>}
          {isAnchor(tile) ? <span key={`${tile}:${props.celebration?.id ?? 0}`} style={{ fontSize: Math.max(12, Math.min(16, flatExtent / size * 0.52)) }}
            className={`flat-landmark ${props.celebration?.anchors.includes(tile) ? 'destination-celebration' : ''}`}><HomeLetter anchor={tile}/><span className="sr-only">{tile}</span></span> :
            tile === 'o' ? null : tile === '~' ? <><i className="flat-ripples" aria-hidden="true"/>
              {decoration.fish && <i className="flat-fish" style={{ animationDelay: `${-decoration.variant}s` }} aria-hidden="true"/>}</> :
              tile === 'x' ? <i className="flat-rock"/> : tile === 'h' || tile === 'v'
                ? <i className={`flat-bridge bridge-${tile}`}><Icon name="bridge" size={20}/></i> : <i className="flat-grass"/>}
          {tile === '.' && decoration.flowers.length > 0 && <svg className="flat-flowers" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            {decoration.flowers.map((flower, index) =>
              <g key={index} transform={`translate(${16 + flower.x * 32} ${18 + flower.z * 32}) rotate(${flower.rotation * 180 / Math.PI}) scale(${flower.scale})`}>
                <path d="M0 5V-2" stroke="var(--world-blade)" strokeWidth="1.2"/>
                <path d="M0-2q-5 0-3-3-2-4 3-3 3-4 4 0 4 3 0 4 0 4-4 2Z" fill={FLOWER_CSS_COLORS[flower.color]}/>
                <circle cy="-4" r="1.3" fill="#f3d16f"/>
              </g>)}
          </svg>}
          {blocked.has(key) && <span className="cell-warning"><Icon name="warning" size={12}/></span>}
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
      <span ref={flatTraveler} className="flat-traveler" aria-hidden="true"><GuideCourier/></span>
      </div>
    </div>}
    {!props.busy && !props.locked && startMarkers.length > 0 && <div className="patch-start-markers" aria-hidden="true">
      {startMarkers.map((marker) => <svg key={marker.number} className={`patch-start-arrow patch-${marker.number}`}
        viewBox="0 0 32 32" data-patch={marker.number} data-row={marker.row} data-col={marker.col} data-preview={marker.preview}
        data-frame-axis={props.shape.rows > props.shape.cols ? 'row' : 'col'}
        style={{ left: marker.x, top: marker.y, width: marker.width, height: marker.height }}>
        <path d={arrowPath} stroke="#fffdf1" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d={arrowPath} stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>)}
    </div>}
    {props.overlay}
  </div>;
}
