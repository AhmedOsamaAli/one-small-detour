import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CatalogEntry, Theme } from '../shared/types.ts';
import { campaignGates, campaignPlaces, campaignWorlds, nextCampaignPlace, PRACTICE_WORLD_SIZE, practiceStars, worldStarRequirement, worldStars } from '../shared/progression.ts';
import type { PracticeProgress } from '../shared/progression.ts';
import { Icon, LandscapeIllustration, ShapeGlyph, StarRating } from './components.tsx';
import { shapesFor } from '../shared/rules.ts';

interface Point { x: number; y: number }
interface Drag { id: number; y: number; offset: number; moved: boolean }
const STOP_TOP_INSET = 34;
const STOP_BOTTOM_INSET = 40;

interface MapProps {
  places: readonly CatalogEntry[];
  completed: readonly string[];
  progress: PracticeProgress;
  currentId: string;
  reduced: boolean;
  loading: string | null;
  error: string | null;
  onSelect: (id: string) => void;
  onToday: () => void;
}

function nodePosition(index: number, width: number, rowGap: number): Point {
  const world = Math.floor(index / PRACTICE_WORLD_SIZE), local = index % PRACTICE_WORLD_SIZE;
  const row = Math.floor(local / 3);
  const column = row % 2 ? 2 - local % 3 : local % 3;
  const margin = Math.max(32, width * 0.16);
  return {
    x: margin + column * (width - margin * 2) / 2 + Math.sin(row * 0.9) * width * 0.012 +
      (column === 1 ? Math.sin(row * 1.1) * width * 0.035 : 0),
    y: (world * 9.2 + row + 1.5 + (column === 1 ? 0.16 : column === 0 ? -0.12 : -0.08)) * rowGap,
  };
}

function roadSegment(a: Point, b: Point, width: number, rowGap: number): { path: string; middle: Point; angle: number } {
  const control = Math.abs(a.y - b.y) < rowGap / 2 ? (a.x + b.x) / 2 :
    a.x > width / 2 ? Math.min(width - 12, a.x + width * 0.08) : Math.max(12, a.x - width * 0.08);
  return {
    path: `M${a.x} ${a.y}C${control} ${a.y} ${control} ${b.y} ${b.x} ${b.y}`,
    middle: { x: (a.x + b.x) * 0.125 + control * 0.75, y: (a.y + b.y) / 2 },
    angle: Math.atan2((b.y - a.y) * 1.5, (b.x - a.x) * 0.75) * 180 / Math.PI,
  };
}

function islandCrossing(a: Point, b: Point, width: number, rowGap: number): { path: string; middle: Point; angle: number } {
  const shore = Math.max(12, Math.min(20, width * .04));
  const leave = a.y + rowGap * .95, arrive = b.y - rowGap * .45;
  return {
    path: `M${a.x} ${a.y}C${a.x} ${a.y + rowGap * .5} ${shore} ${a.y + rowGap * .4} ${shore} ${leave}L${shore} ${arrive}Q${shore} ${b.y} ${b.x} ${b.y}`,
    middle: { x: shore, y: (leave + arrive) / 2 },
    angle: 90,
  };
}

function WorldHeading({ number, title, subtitle, width }: { number: number; title: string; subtitle: string; width: number }) {
  const narrow = width < 300;
  const words = title.split(' '), split = Math.ceil(words.length / 2);
  const lines = narrow ? [words.slice(0, split).join(' '), words.slice(split).join(' ')] : [title];
  const plateWidth = Math.min(320, width - 56), height = narrow ? 70 : 56;
  return <g className={`world-map-heading ${narrow ? 'heading-narrow' : ''}`} data-testid="world-map-heading"
    transform={`translate(${(width - plateWidth) / 2} 8)`}>
    <rect className="world-heading-shadow" x="0" y="3" width={plateWidth} height={height} rx="13"/>
    <rect className="world-heading-paper" width={plateWidth} height={height} rx="13"/>
    <path d={`M12 14v-3h10m${plateWidth - 44} 0h10v3`} className="world-heading-detail"/>
    {lines.map((line, index) => <text key={index} x={plateWidth / 2} y={narrow ? 23 + index * 18 : 25}
      className="world-map-title" textAnchor="middle">{index === 0 ? `${number}. ` : ''}{line}</text>)}
    <text x={plateWidth / 2} y={narrow ? 59 : 44} className="world-map-subtitle" textAnchor="middle">{subtitle}</text>
  </g>;
}

function MapTree({ x, y, orchard = false }: { x: number; y: number; orchard?: boolean }) {
  return <g transform={`translate(${x} ${y})`}>
    <ellipse cy="15" rx="15" ry="5" fill="var(--art-shadow)"/>
    <path d="M0 14V-8" stroke="var(--bark)" strokeWidth="5" strokeLinecap="round"/>
    <path d="M-17-5q-8-18 7-25 9-16 21-4 22 3 16 24Q14 8-7 4L-17-5Z" fill="var(--leaf)"/>
    <path d="M-6-29q9-17 20-3 15 1 11 18Q6-8-6-29Z" fill="var(--leaf-light)"/>
    <path d="m0 1-7-11m7 4 9-13" stroke="var(--map-border)" strokeWidth="1.5" strokeLinecap="round"/>
    {orchard && <><circle cx="-10" cy="-11" r="3" fill="#c47b44"/><circle cx="9" cy="-20" r="3" fill="#e3ac59"/></>}
  </g>;
}

function MapWindmill() {
  return <g>
    <ellipse cy="9" rx="13" ry="4" fill="#58795420"/>
    <path d="m-8 7 3-29H5L8 7H-8Z" fill="#fbefcf" stroke="#b1a17b"/>
    <path d="m-9-22 9-8 9 8H-9Z" fill="#91a27a"/>
    <path d="M-2 7v-8H3v8" fill="#978665"/>
    <g transform="translate(0 -20)"><g className="map-windmill-sails">
      <path d="M0-18V18M-18 0h36" stroke="#8b7b56" strokeWidth="2"/>
      <path d="M-3-17H1V-5H-3Zm8 14H17V1H5Zm-6 8H3V17H-1Zm-16-6H-5V3H-17Z" fill="#fff7dc" stroke="#bda97d"/>
    </g></g>
    <circle cy="-20" r="2.5" fill="#937e52"/>
  </g>;
}

function MapLighthouse() {
  return <g>
    <path d="M-25 16q25-15 50 0" fill="#cfbf8a" stroke="#799e9f" strokeWidth="2"/>
    <path d="m-11 13 5-43H6l5 43Z" fill="#faf0cf" stroke="#6b8d92" strokeWidth="2"/>
    <path d="M-8-7H8v9H-9Z" fill="#ac6954"/>
    <path d="M-8-30v-12H8v12M-12-30h24" stroke="#507786" strokeWidth="3" fill="#f3d37e"/>
    <path d="m-12-43 12-10 12 10Z" fill="#517f88"/>
    <path d="M-3 13V4h6v9" fill="#577c7e"/>
  </g>;
}

function MapWorldScenery({ theme, width, height, rows, rowGap }: { theme: Theme; width: number; height: number; rows: number; rowGap: number }) {
  return <g className="world-scenery">
    {theme === 'coast' && <>
      <path d={`M${width * .1} 80Q${width * .32} ${height * .38} ${width * .14} ${height * .58}T${width * .22} ${height - 28}`}
        stroke="var(--region-shore)" strokeWidth="26" fill="none"/>
      <path d={`M${width * .08} 80Q${width * .27} ${height * .38} ${width * .10} ${height * .58}T${width * .16} ${height - 28}`}
        stroke="var(--region-water)" strokeWidth="17" fill="none"/>
    </>}
    {Array.from({ length: rows }, (_, row) => <g key={row}
      transform={`translate(${width * (row % 2 ? .64 : .34)} ${(row + 1.9) * rowGap}) scale(${Math.min(.9, width / 580)})`}>
      {theme === 'coast' ? row % 3 === 0 ? <MapLighthouse/> :
        <><path d="m-20 15 9-7 11 8 14-10 14 9" stroke="#eef2d5" strokeWidth="2" fill="none"/>
          <path d="M-7 5V-12m0 9-8-7m8 10 8-7m13 12V-8" stroke="#70997d" strokeWidth="3"/></> :
        theme === 'orchard' ? <><MapTree x={-18} y={0} orchard/><MapTree x={23} y={10} orchard/></> :
          row % 3 === 1 ? <MapWindmill/> : <>
            <path d="m-29-8 39-12 25 24-41 13Z" fill="#b9c982" stroke="#82995b"/>
            <path d="m-20-6 28-9m-19 17 28-9m-18 17 28-9" stroke="#e8d494" strokeWidth="3"/>
            <MapTree x={28} y={-3}/>
          </>}
    </g>)}
  </g>;
}

export function AdventureMap({ places, completed, progress, currentId, reduced, loading, error, onSelect, onToday }: MapProps) {
  const scene = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const animation = useRef(0);
  const offset = useRef(0);
  const focusedStop = useRef<string | null>(null);
  const followingNext = useRef(true);
  const revealedPreview = useRef<string | null>(null);
  const [viewport, setViewport] = useState({ width: 320, height: 360 });
  const [offsetRows, setOffsetRows] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const entries = useMemo(() => campaignPlaces(places), [places]);
  const gates = useMemo(() => campaignGates(entries, completed, progress), [entries, completed, progress]);
  const worlds = useMemo(() => campaignWorlds(entries.length), [entries.length]);
  const done = useMemo(() => new Set(completed), [completed]);
  const next = useMemo(() => nextCampaignPlace(entries, completed, progress), [entries, completed, progress]);
  const nextIndex = next ? entries.findIndex((place) => place.id === next.id) : -1;
  const currentIndex = entries.findIndex((place) => place.id === currentId);
  const focusIndex = nextIndex >= 0 ? nextIndex : Math.max(0, currentIndex >= 0 ? currentIndex : entries.length - 1);
  const rowGap = Math.max(80, viewport.width * 0.19);
  const points = useMemo(() => entries.map((_, index) => nodePosition(index, viewport.width, rowGap)),
    [entries, viewport.width, rowGap]);
  const worldHeight = Math.max(viewport.height, (points.at(-1)?.y ?? 0) + rowGap * 1.1);
  const maxOffset = Math.max(0, worldHeight - viewport.height);
  const panY = Math.max(0, Math.min(maxOffset, offsetRows * rowGap));
  const focusY = points[focusIndex]?.y ?? 0;
  const focusWorldStart = Math.floor(focusIndex / PRACTICE_WORLD_SIZE) * PRACTICE_WORLD_SIZE;
  const focusRowStart = focusWorldStart + Math.floor((focusIndex - focusWorldStart) / 3) * 3;
  const focusRow = points.slice(focusRowStart, Math.min(focusRowStart + 3, focusWorldStart + PRACTICE_WORLD_SIZE));
  const rowFocusY = focusRow.length ? (Math.min(...focusRow.map((point) => point.y)) + Math.max(...focusRow.map((point) => point.y))) / 2 : focusY;
  const headingTop = Math.floor(focusIndex / PRACTICE_WORLD_SIZE) * 9.2 * rowGap + 8;
  const focusOffset = focusRow.length > 0 && focusRowStart === focusWorldStart &&
    viewport.height >= Math.max(...focusRow.map((point) => point.y + STOP_BOTTOM_INSET)) - headingTop + 4
    ? headingTop - 4 : rowFocusY - (viewport.height + STOP_TOP_INSET - STOP_BOTTOM_INSET) / 2;
  const completedCount = entries.filter((place) => done.has(place.id)).length;

  useLayoutEffect(() => {
    const element = scene.current;
    if (!element) return;
    const measure = (): void => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (!width || !height) return;
      setViewport((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    cancelAnimationFrame(animation.current);
    const targetId = entries[focusIndex]?.id ?? null;
    let target = Math.max(0, Math.min(maxOffset, offset.current * rowGap));
    if (focusedStop.current !== targetId) {
      target = focusOffset;
      focusedStop.current = targetId;
      followingNext.current = true;
      setPreviewId(null);
      drag.current = null;
      suppressClick.current = false;
      setDragging(false);
    } else if (followingNext.current) {
      target = focusOffset;
    } else if (revealedPreview.current !== previewId) {
      const selectedIndex = entries.findIndex((place) => place.id === previewId);
      const selected = selectedIndex >= 0 ? points[selectedIndex] : null;
      if (selected) {
        if (selected.y - target < STOP_TOP_INSET) target = selected.y - STOP_TOP_INSET;
        else if (selected.y - target > viewport.height - STOP_BOTTOM_INSET) target = selected.y - viewport.height + STOP_BOTTOM_INSET;
      }
    }
    revealedPreview.current = previewId;
    const rows = Math.max(0, Math.min(maxOffset, target)) / rowGap;
    offset.current = rows;
    setOffsetRows(rows);
  }, [entries, points, previewId, focusIndex, focusOffset, viewport.height, rowGap, maxOffset]);
  useEffect(() => () => cancelAnimationFrame(animation.current), []);

  const panTo = (pixels: number, animate = false, follow = false): void => {
    followingNext.current = follow;
    revealedPreview.current = previewId;
    cancelAnimationFrame(animation.current);
    const target = Math.max(0, Math.min(maxOffset, pixels)) / rowGap;
    const from = offset.current;
    if (!animate || reduced) { offset.current = target; setOffsetRows(target); return; }
    const began = performance.now();
    const tick = (now: number): void => {
      const progress = Math.min(1, (now - began) / 480);
      const eased = 1 - (1 - progress) ** 3;
      const value = from + (target - from) * eased;
      offset.current = value;
      setOffsetRows(value);
      if (progress < 1) animation.current = requestAnimationFrame(tick);
    };
    animation.current = requestAnimationFrame(tick);
  };
  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false): void => {
    if (drag.current?.id !== event.pointerId) return;
    suppressClick.current = !cancelled && drag.current.moved;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const preview = entries.find((place) => place.id === previewId) ?? entries[focusIndex] ?? null;
  const previewFrame = preview?.frame ? shapesFor(preview.area, preview.size, preview.frame)[0] : null;
  if (preview?.frame && !previewFrame) throw new Error('The selected Practice island has no supported frame.');
  const previewGate = preview ? gates.get(preview.id) : null;
  const previewIndex = preview ? entries.findIndex((place) => place.id === preview.id) : -1;
  const previewWorld = worlds[Math.floor(Math.max(0, previewIndex) / PRACTICE_WORLD_SIZE)];
  const previewStars = preview ? practiceStars(preview, progress.bests[preview.id], done.has(preview.id)) : 0;
  const starsHere = previewWorld ? worldStars(previewWorld, entries, completed, progress) : 0;
  const replay = preview !== null && done.has(preview.id);
  const status = replay ? 'Completed' : previewGate?.unlocked ? 'Ready to play' : 'Locked';
  const w = viewport.width;

  return <div className="adventure-map" data-campaign-count={entries.length}>
    <div className="adventure-tools">
      <div className="adventure-progress"><strong>{previewWorld?.title ?? 'Your road'}</strong>
        <span aria-label={`${completedCount} of ${entries.length} stops completed`}>{completedCount} / {entries.length} <span className="progress-unit">completed</span></span>
        {previewWorld && <small className="world-star-total" data-testid="world-star-total">{starsHere} / {(previewWorld.end - previewWorld.start) * 3} stars</small>}
      </div>
      <div className="adventure-controls">
        <button className="secondary-button adventure-focus" disabled={!entries.length} aria-label="Find my next stop"
          title="Find my next stop" onClick={() => { setPreviewId(entries[focusIndex]?.id ?? null); panTo(focusOffset, true, true); }}>
          <Icon name="map" size={18}/><span className="control-full">Find my stop</span><span className="control-short">Find stop</span>
        </button>
        <button className="secondary-button adventure-daily" onClick={onToday} aria-label="Today's daily island">
          <Icon name="sun" size={18}/><span className="control-full">Daily challenge</span><span className="control-short">Daily</span>
        </button>
      </div>
    </div>
    <div className="campaign-legend" aria-label="Map legend">
      <span className="legend-done"><Icon name="check" size={13}/>Done</span>
      <span className="legend-ready"><Icon name="play" size={13}/>Ready</span>
      <span className="legend-locked"><Icon name="lock" size={13}/>Locked</span>
    </div>
    <div ref={scene} className={`adventure-scene connected-world ${dragging ? 'is-dragging' : ''}`} tabIndex={0} role="region"
      aria-label="Connected ordered practice map. Drag or use arrow keys to explore. Home and End reach opposite ends."
      data-campaign-offset={Math.round(panY)} data-next-stop={nextIndex >= 0 ? nextIndex + 1 : 'complete'}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        cancelAnimationFrame(animation.current);
        suppressClick.current = false;
        drag.current = { id: event.pointerId, y: event.clientY, offset: panY, moved: false };
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        const distance = event.clientY - current.y;
        if (!current.moved && Math.abs(distance) <= 6) return;
        if (!current.moved) {
          current.moved = true;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        event.preventDefault();
        panTo(current.offset - distance);
      }}
      onPointerUp={(event) => finishDrag(event)}
      onPointerCancel={(event) => finishDrag(event, true)}
      onClickCapture={(event) => {
        if (suppressClick.current && event.detail > 0) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); }
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        let target: number;
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') target = panY + rowGap;
        else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') target = panY - rowGap;
        else if (event.key === 'PageDown') target = panY + viewport.height * 0.75;
        else if (event.key === 'PageUp') target = panY - viewport.height * 0.75;
        else if (event.key === 'Home') target = 0;
        else if (event.key === 'End') target = maxOffset;
        else return;
        event.preventDefault();
        panTo(target);
      }}>
      <svg className="adventure-art" viewBox={`0 ${panY} ${w} ${viewport.height}`} aria-hidden="true">
        <defs>
          <pattern id="adventure-waves" width="72" height="52" patternUnits="userSpaceOnUse">
            <path className="campaign-wave" d="M10 26q14-7 28 0" fill="none" stroke="var(--world-foam)" strokeWidth="1.2" opacity=".35"/>
          </pattern>
        </defs>
        <rect width={w} height={worldHeight} fill="var(--map-water)"/>
        <rect width={w} height={worldHeight} fill="url(#adventure-waves)"/>
        {worlds.map((world) => {
          const rows = Math.ceil((world.end - world.start) / 3), height = (rows + 1.5) * rowGap;
          const land = `M${w * .2} 20Q${w * .5} -8 ${w * .8} 20Q${w * .96} 38 ${w * .93} 92
            L${w * .93} ${height - 65}Q${w * .91} ${height + 4} ${w * .67} ${height - 8}
            L${w * .3} ${height - 8}Q${w * .05} ${height - 12} ${w * .07} ${height - 80}
            L${w * .07} 90Q${w * .03} 38 ${w * .2} 20Z`;
          return <g key={world.index} className={`campaign-world world-${world.theme} ${world.index >= progress.unlockedWorlds ? 'world-locked' : ''}`}
            data-world={world.index + 1} transform={`translate(0 ${world.index * 9.2 * rowGap})`}>
            <defs><linearGradient id={`campaign-land-${world.index}`} x2="0" y2="1">
              <stop stopColor="var(--region-land-one)"/><stop offset="1" stopColor="var(--region-land-two)"/>
            </linearGradient></defs>
            <path d={land} fill="var(--region-shadow)" transform="translate(0 8)" opacity=".4"/>
            <path d={land} fill={`url(#campaign-land-${world.index})`} stroke="var(--map-border)" strokeWidth="2" data-testid="connected-world-land"/>
            <MapWorldScenery theme={world.theme} width={w} height={height} rows={rows} rowGap={rowGap}/>
          </g>;
        })}
        <g className="adventure-trails">{entries.slice(1).map((place, index) => {
          const from = points[index];
          const to = points[index + 1];
          const prior = entries[index];
          const gate = gates.get(place.id);
          if (!from || !to || !prior || !gate) throw new Error('The campaign road has a missing stop.');
          const crossing = (index + 1) % PRACTICE_WORLD_SIZE === 0;
          const road = crossing ? islandCrossing(from, to, w, rowGap) : roadSegment(from, to, w, rowGap);
          return <g key={place.id} className={crossing ? 'island-crossing' : undefined}>
            <path d={road.path} className="trail-underlay"/>
            <path d={road.path} className={done.has(prior.id) && done.has(place.id) ? 'trail-discovered' : gate.unlocked ? 'trail-open' : 'trail-locked'}
              data-testid="campaign-road-link"/>
            {crossing && <circle className="crossing-direction-halo" cx={road.middle.x} cy={road.middle.y} r="7"/>}
            <path d={crossing ? 'm-3-4 4 4-4 4' : 'm-3-3 4 3-4 3'} transform={`translate(${road.middle.x} ${road.middle.y}) rotate(${road.angle})`}
              className="trail-direction"/>
          </g>;
        })}</g>
        {worlds.map((world) => {
          const prior = worlds[world.index - 1], locked = world.index >= progress.unlockedWorlds;
          return <g key={world.index} transform={`translate(0 ${world.index * 9.2 * rowGap})`}>
            <WorldHeading number={world.index + 1} title={world.title} width={w}
              subtitle={locked && prior ? `${worldStarRequirement(prior)} stars + clear island ${world.index}` :
                `${world.end - world.start} stops / ${(world.end - world.start) * 3} stars`}/>
          </g>;
        })}
      </svg>
      {entries.map((place, index) => {
        const point = points[index];
        const gate = gates.get(place.id);
        if (!point || !gate) throw new Error('The campaign stop is missing.');
        const y = point.y - panY;
        if (y < STOP_TOP_INSET || y > viewport.height - STOP_BOTTOM_INSET) return null;
        const discovered = done.has(place.id);
        const stars = practiceStars(place, progress.bests[place.id], discovered);
        return <button key={place.id} className={`adventure-stop ${discovered ? 'is-discovered' : ''} ${!gate.unlocked ? 'is-locked' : ''} ${index === nextIndex ? 'is-next' : ''} ${place.id === currentId ? 'is-current' : ''} ${place.id === preview?.id ? 'is-previewed' : ''}`}
          style={{ left: point.x, top: y }} disabled={loading !== null} data-campaign-stop={place.id} data-ordinal={index + 1}
          aria-pressed={place.id === preview?.id}
          aria-label={`Preview stop ${index + 1}. ${place.title}. ${discovered ? `Completed; ${stars} of 3 stars; replay available.` : gate.unlocked ? 'Ready to play.' : 'Locked.'}`}
          onFocus={() => { followingNext.current = false; setPreviewId(place.id); }}
          onClick={() => { followingNext.current = false; setPreviewId(place.id); }}>
          <span>{index + 1}</span>
          {discovered && <StarRating stars={stars}/>}
          {(discovered || !gate.unlocked) && <span className="campaign-stop-badge"><Icon name={discovered ? 'check' : 'lock'} size={11}/></span>}
        </button>;
      })}
    </div>
    <section className={`campaign-preview ${replay ? 'preview-done' : previewGate?.unlocked ? 'preview-ready' : 'preview-locked'}`}
      aria-label="Selected stop preview" data-testid="campaign-preview">
      {preview && previewGate ? <>
        <div className="preview-picture">{previewFrame ? <ShapeGlyph shape={previewFrame}/> : <LandscapeIllustration theme={previewWorld?.theme ?? preview.theme}/>}</div>
        <div className="preview-copy">
          <div className="preview-eyebrow"><span>STOP {previewIndex + 1}</span><span className="preview-state">
            <Icon name={replay ? 'check' : previewGate.unlocked ? 'play' : 'lock'} size={12}/>{status}
          </span></div>
          <h3>{preview.title}</h3>
          <StarRating stars={previewStars} label={`${previewStars} of 3 stars kept for this stop`}/>
          <div className="preview-facts">
            <span><Icon name="grid" size={14}/>{preview.size} x {preview.size}</span>
            <span title="Proved minimum number of exchanges"><Icon name="swap" size={14}/>Goal: {preview.minimum ?? '?'} {preview.minimum === 1 ? 'move' : 'moves'}</span>
          </div>
        </div>
        <p className={`preview-message ${error ? 'adventure-error' : ''}`} role={error ? 'alert' : 'status'}>
          {error ?? (loading ? 'Opening your stop...' : !previewGate.unlocked ? previewGate.reason :
            preview.minimum !== undefined ? `${replay && progress.bests[preview.id] === undefined ? 'Earlier clear: 1 star kept; replay to record moves. ' : ''}
              3 stars: ${preview.minimum} ${preview.minimum === 1 ? 'move' : 'moves'}. 2 stars: ${preview.minimum + 2} or fewer. Finish for 1 star. No time targets.` :
              preview.frame ? preview.note : 'Connect the full road through every home.')}
        </p>
        <button className="primary-button campaign-play" disabled={!previewGate.unlocked || loading !== null}
          onClick={() => onSelect(preview.id)}
          aria-label={loading ? 'Opening practice stop' : previewGate.unlocked ? `${replay ? 'Replay' : 'Play'} stop ${previewIndex + 1}` : `Stop ${previewIndex + 1} is locked. ${previewGate.reason}`}>
          <Icon name={!previewGate.unlocked ? 'lock' : replay ? 'reset' : 'play'} size={17}/>
          {loading ? 'Opening...' : !previewGate.unlocked ? 'Island locked' : error ? 'Try again' : `${replay ? 'Replay' : 'Play'} stop ${previewIndex + 1}`}
        </button>
      </> : <p className="preview-message" role="status">Preparing your road...</p>}
    </section>
    <span className="campaign-map-hint"><Icon name="map" size={13}/>Drag the map. Tap a number to preview.</span>
  </div>;
}
