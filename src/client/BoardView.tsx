import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { isAnchor, locate, patchCells, tileAt } from '../shared/rules.ts';
import type { Anchor, Board, Celebration, Cell, FrameAxes, GuideBounds, JourneyPlayback, JourneyStop, Shape, Swap, Theme } from '../shared/types.ts';
import { JourneyPlayer } from '../shared/playback.ts';
import type { LivingIsland } from './island.ts';
import { BrandMark, FLAT_AXES, Icon } from './components.tsx';

export interface Transition {
  id: number;
  move: Swap;
}

interface BoardProps {
  board: Board;
  puzzleId: string;
  theme: Theme;
  seed: number;
  shape: Shape;
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
  onGuideBounds: (bounds: GuideBounds | null) => void;
  onArrival: (revision: number, stop: JourneyStop) => void;
  onJourneyEnd: (revision: number) => void;
}

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
  const width = Math.min(13, box.width * 0.35);
  const height = Math.min(17, box.height * 0.50);
  const x = firstCell.offsetLeft + box.width * 0.70 + position.col * (box.width + colGap);
  const y = firstCell.offsetTop + box.height * 0.70 + position.row * (box.height + rowGap);
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
  const stage = useRef<HTMLDivElement>(null);
  const player = useRef<{ revision: number; reduced: boolean; animation: JourneyPlayer } | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const previous = useRef<{ puzzle: string; transition: number | null; board: Board | null }>({ puzzle: '', transition: null, board: null });
  const keyboardCell = useRef<Cell>({ row: 0, col: 0 });
  const [flatExtent, setFlatExtent] = useState(300);
  const [worldReady, setWorldReady] = useState(false);
  const size = props.board.length;
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
  }, [flatExtent, props.flat]);

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
      if (last.board !== props.board || last.puzzle !== props.puzzleId) world.reset(props.board, props.theme, props.seed);
    } else if (last.transition !== props.transition.id) {
      world.animateSwap(props.transition.move, props.board);
    }
    previous.current = { puzzle: props.puzzleId, transition: props.transition?.id ?? null, board: props.board };
  }, [props.board, props.puzzleId, props.theme, props.seed, props.transition, props.flat, worldReady]);

  useEffect(() => { island.current?.setHighlights(props.shape, props.first, props.second, props.hover, props.invalid, props.blockedCells); },
    [props.shape, props.first, props.second, props.hover, props.invalid, props.blockedCells, props.flat, worldReady]);
  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const update = (): void => {
      if (!props.guide || !props.hover) { callbacks.current.onGuideBounds(null); return; }
      if (!props.flat) {
        callbacks.current.onGuideBounds(island.current?.guideBounds(props.hover) ?? null);
        return;
      }
      const box = flatMap.current?.querySelector<HTMLElement>(
        `[data-row="${props.hover.row}"][data-col="${props.hover.col}"]`)?.getBoundingClientRect();
      callbacks.current.onGuideBounds(box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [props.guide, props.hover, props.shape, props.flat, flatExtent, worldReady]);
  useEffect(() => { callbacks.current.onReady(props.flat || worldReady); },
    [props.flat, props.puzzleId, props.readyRevision, worldReady]);
  useEffect(() => { island.current?.setReducedMotion(props.reduced); }, [props.reduced, props.flat, worldReady]);
  useEffect(() => { island.current?.setAppearance(props.dark); }, [props.dark, props.flat, worldReady]);
  useEffect(() => { island.current?.setPaused(props.paused); }, [props.paused, props.flat, worldReady]);
  useEffect(() => {
    const update = (): void => {
      stage.current?.setAttribute('data-animation-paused', String(props.paused || document.hidden));
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
  const flatFrame = (cell: Cell, number: 1 | 2, preview: boolean, invalid = false): ReactNode =>
    <div key={number} className={`flat-patch-frame patch-${number} ${preview ? 'preview' : 'selected'} ${invalid ? 'invalid' : ''}`}
      data-testid={`flat-frame-${number}`} data-preview={preview} data-invalid={invalid} aria-hidden="true"
      style={{ gridColumn: `${cell.col + 1} / span ${Math.min(props.shape.cols, size - cell.col)}`,
        gridRow: `${cell.row + 1} / span ${Math.min(props.shape.rows, size - cell.row)}` }}>
      <span className="flat-frame-badge">{invalid ? '!' : number}</span>
    </div>;

  return <div ref={stage} className={`world-stage theme-${props.theme} ${props.flat ? 'is-flat' : ''} ${size > 6 ? 'large-world' : ''} ${props.locked ? 'input-locked' : ''}`} data-testid="world-stage"
    data-size={size} data-playback={props.playback ? 'active' : 'idle'} data-celebration={props.celebration?.complete ? 'complete' : props.celebration ? 'destination' : 'none'}>
    {!props.flat && <div ref={container} className="world-canvas-wrap" role="application" tabIndex={0}
      aria-busy={!worldReady}
      aria-label={`${size} by ${size} landscape. Arrow keys choose a square; Space selects. Selecting the second patch swaps immediately. Home and End reach opposite corners. Escape clears the cut.`}
      onKeyDown={(event) => {
        if (!worldReady || props.locked) { event.preventDefault(); return; }
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
        const key = `${cell.row},${cell.col}`;
        const name = isAnchor(tile) ? `Pinned landmark ${tile}` : tile === 'o' ? 'Paving' : tile === '~' ? 'Water' :
          tile === 'x' ? 'Fixed boulder' : tile === 'h' ? 'Bridge, east and west only' : tile === 'v' ? 'Bridge, north and south only' : 'Grass';
        return <button key={key} className={`flat-cell terrain-${tile === '.' ? 'grass' : tile === '~' ? 'water' : tile === 'x' ? 'rock' : tile === 'h' || tile === 'v' ? 'bridge' : 'path'} ${first.has(key) ? 'cut-one' : ''} ${second.has(key) ? 'cut-two' : ''} ${guided.has(key) ? 'guided-cell' : ''} ${blocked.has(key) ? 'blocked-cell' : ''}`}
          data-row={cell.row} data-col={cell.col} data-blocked={blocked.has(key)} disabled={props.locked}
          aria-label={`Row ${cell.row + 1}, column ${cell.col + 1}: ${name}${first.has(key) ? ', part of selected patch 1' : second.has(key) ? ', part of selected patch 2' : ''}`}
          onClick={() => props.onCell(cell)} onFocus={() => props.onHover(cell)} onPointerEnter={() => props.onHover(cell)}>
          {isAnchor(tile) ? <span key={`${tile}:${props.celebration?.id ?? 0}`} style={{ fontSize: Math.max(12, Math.min(16, flatExtent / size * 0.52)) }}
            className={`flat-landmark ${props.celebration?.anchors.includes(tile) ? 'destination-celebration' : ''}`}>{tile}</span> :
            tile === 'o' ? <i className="flat-stone"/> : tile === '~' ? <span aria-hidden="true">~</span> :
              tile === 'x' ? <i className="flat-rock"/> : tile === 'h' || tile === 'v'
                ? <i className={`flat-bridge bridge-${tile}`}><Icon name="bridge" size={20}/></i> : <i className="flat-grass"/>}
          {blocked.has(key) && <span className="cell-warning"><Icon name="warning" size={12}/></span>}
        </button>;
      })}
      {!props.second && preview && flatFrame(preview, props.first ? 2 : 1, true, props.invalid)}
      {props.first && flatFrame(props.first, 1, false)}
      {props.second && flatFrame(props.second, 2, false)}
      <span ref={flatTraveler} className="flat-traveler" aria-hidden="true"/>
      </div>
    </div>}
    {props.overlay}
  </div>;
}
