import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CatalogEntry } from '../shared/types.ts';
import { campaignGates, campaignPlaces } from '../shared/progression.ts';
import { Icon, LandscapeIllustration, ShapeGlyph } from './components.tsx';
import { shapesFor } from '../shared/rules.ts';

interface Point { x: number; y: number }
interface Drag { id: number; y: number; offset: number; moved: boolean }

interface MapProps {
  places: readonly CatalogEntry[];
  completed: readonly string[];
  currentId: string;
  reduced: boolean;
  loading: string | null;
  error: string | null;
  onSelect: (id: string) => void;
  onToday: () => void;
}

function nodePosition(index: number, width: number, rowGap: number): Point {
  const row = Math.floor(index / 3);
  const column = row % 2 ? 2 - index % 3 : index % 3;
  const margin = Math.max(32, width * 0.16);
  return {
    x: margin + column * (width - margin * 2) / 2 + Math.sin(row * 0.9) * width * 0.012 +
      (column === 1 ? Math.sin(row * 1.1) * width * 0.035 : 0),
    y: (row + 0.75 + (column === 1 ? 0.16 : column === 0 ? -0.12 : -0.08)) * rowGap,
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

export function AdventureMap({ places, completed, currentId, reduced, loading, error, onSelect, onToday }: MapProps) {
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
  const gates = useMemo(() => campaignGates(entries, completed), [entries, completed]);
  const done = useMemo(() => new Set(completed), [completed]);
  const nextIndex = entries.findIndex((place) => !done.has(place.id));
  const currentIndex = entries.findIndex((place) => place.id === currentId);
  const focusIndex = nextIndex >= 0 ? nextIndex : Math.max(0, currentIndex >= 0 ? currentIndex : entries.length - 1);
  const rowGap = Math.max(64, viewport.width * 0.19);
  const points = useMemo(() => entries.map((_, index) => nodePosition(index, viewport.width, rowGap)),
    [entries, viewport.width, rowGap]);
  const rows = Math.ceil(entries.length / 3);
  const worldHeight = Math.max(viewport.height, (rows + 0.65) * rowGap);
  const maxOffset = Math.max(0, worldHeight - viewport.height);
  const panY = Math.max(0, Math.min(maxOffset, offsetRows * rowGap));
  const focusY = points[focusIndex]?.y ?? 0;
  const focusRow = points.slice(Math.floor(focusIndex / 3) * 3, Math.floor(focusIndex / 3) * 3 + 3);
  const rowFocusY = focusRow.length ? (Math.min(...focusRow.map((point) => point.y)) + Math.max(...focusRow.map((point) => point.y))) / 2 : focusY;
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
      target = rowFocusY - viewport.height * 0.5;
      focusedStop.current = targetId;
      followingNext.current = true;
      setPreviewId(null);
      drag.current = null;
      suppressClick.current = false;
      setDragging(false);
    } else if (followingNext.current) {
      target = rowFocusY - viewport.height * 0.5;
    } else if (revealedPreview.current !== previewId) {
      const selectedIndex = entries.findIndex((place) => place.id === previewId);
      const selected = selectedIndex >= 0 ? points[selectedIndex] : null;
      if (selected) {
        if (selected.y - target < 36) target = selected.y - 36;
        else if (selected.y - target > viewport.height - 36) target = selected.y - viewport.height + 36;
      }
    }
    revealedPreview.current = previewId;
    const rows = Math.max(0, Math.min(maxOffset, target)) / rowGap;
    offset.current = rows;
    setOffsetRows(rows);
  }, [entries, points, previewId, focusIndex, rowFocusY, viewport.height, rowGap, maxOffset]);
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
  const replay = preview !== null && done.has(preview.id);
  const status = replay ? 'Completed' : previewGate?.unlocked ? 'Ready to play' : 'Locked';
  const w = viewport.width;
  const land = `M${w * 0.2} 20Q${w * 0.5} -8 ${w * 0.8} 20Q${w * 0.96} 38 ${w * 0.93} 92
    L${w * 0.93} ${worldHeight - 65}Q${w * 0.91} ${worldHeight + 4} ${w * 0.67} ${worldHeight - 8}
    L${w * 0.3} ${worldHeight - 8}Q${w * 0.05} ${worldHeight - 12} ${w * 0.07} ${worldHeight - 80}
    L${w * 0.07} 90Q${w * 0.03} 38 ${w * 0.2} 20Z`;

  return <div className="adventure-map" data-campaign-count={entries.length}>
    <div className="adventure-tools">
      <div className="adventure-progress"><strong>Your road</strong><span aria-label={`${completedCount} of ${entries.length} stops completed`}>{completedCount} / {entries.length} <span className="progress-unit">completed</span></span></div>
      <div className="adventure-controls">
        <button className="secondary-button adventure-focus" disabled={!entries.length} aria-label="Find my next stop"
          title="Find my next stop" onClick={() => { setPreviewId(entries[focusIndex]?.id ?? null); panTo(rowFocusY - viewport.height * 0.5, true, true); }}>
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
          <linearGradient id="campaign-land" x1="0" y1="0" x2="0" y2={worldHeight} gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--map-land-one)"/><stop offset=".5" stopColor="var(--map-land-two)"/><stop offset="1" stopColor="var(--map-land-three)"/>
          </linearGradient>
        </defs>
        <rect width={w} height={worldHeight} fill="var(--map-water)"/>
        <rect width={w} height={worldHeight} fill="url(#adventure-waves)"/>
        <path d={land} fill="#79987b" opacity=".2" transform="translate(0 8)"/>
        <path d={land} fill="url(#campaign-land)" stroke="var(--map-border)" strokeWidth="2" data-testid="connected-world-land"/>
        {Array.from({ length: rows }, (_, row) => <g key={row}>
          <g transform={`translate(${w * (row % 2 ? 0.66 : 0.3)} ${(row + 1.3) * rowGap}) scale(${Math.min(0.9, w / 580)})`}>
            {row % 5 === 2 ? <MapWindmill/> : <><MapTree x={0} y={0} orchard={row < rows / 3}/>
              <MapTree x={35} y={10} orchard={row < rows / 3}/></>}
          </g>
          {row % 7 === 4 && <path d={`M${w * .08} ${(row + .45) * rowGap}Q${w * .5} ${(row + .15) * rowGap} ${w * .92} ${(row + .42) * rowGap}`}
            fill="none" stroke="#a5c6b5" strokeWidth="9" opacity=".6"/>}
        </g>)}
        <g className="adventure-trails">{entries.slice(1).map((place, index) => {
          const from = points[index];
          const to = points[index + 1];
          const prior = entries[index];
          const gate = gates.get(place.id);
          if (!from || !to || !prior || !gate) throw new Error('The campaign road has a missing stop.');
          const road = roadSegment(from, to, w, rowGap);
          return <g key={place.id}>
            <path d={road.path} className="trail-underlay"/>
            <path d={road.path} className={done.has(prior.id) && done.has(place.id) ? 'trail-discovered' : gate.unlocked ? 'trail-open' : 'trail-locked'}
              data-testid="campaign-road-link"/>
            <path d="m-3-3 4 3-4 3" transform={`translate(${road.middle.x} ${road.middle.y}) rotate(${road.angle})`}
              className="trail-direction"/>
          </g>;
        })}</g>
        {['The orchard', 'The meadow', 'The coast'].map((name, index) =>
          <text key={name} x={w / 2} y={Math.floor(index * rows / 3) * rowGap + rowGap * .25}
            className="campaign-land-label" textAnchor="middle">{name}</text>)}
      </svg>
      {entries.map((place, index) => {
        const point = points[index];
        const gate = gates.get(place.id);
        if (!point || !gate) throw new Error('The campaign stop is missing.');
        const y = point.y - panY;
        if (y < 31 || y > viewport.height - 31) return null;
        const discovered = done.has(place.id);
        return <button key={place.id} className={`adventure-stop ${discovered ? 'is-discovered' : ''} ${!gate.unlocked ? 'is-locked' : ''} ${index === nextIndex ? 'is-next' : ''} ${place.id === currentId ? 'is-current' : ''} ${place.id === preview?.id ? 'is-previewed' : ''}`}
          style={{ left: point.x, top: y }} disabled={loading !== null} data-campaign-stop={place.id} data-ordinal={index + 1}
          aria-pressed={place.id === preview?.id}
          aria-label={`Preview stop ${index + 1}. ${place.title}. ${discovered ? 'Completed; replay available.' : gate.unlocked ? 'Ready to play.' : 'Locked.'}`}
          onFocus={() => { followingNext.current = false; setPreviewId(place.id); }}
          onClick={() => { followingNext.current = false; setPreviewId(place.id); }}>
          <span>{index + 1}</span>
          {(discovered || !gate.unlocked) && <span className="campaign-stop-badge"><Icon name={discovered ? 'check' : 'lock'} size={11}/></span>}
        </button>;
      })}
    </div>
    <section className={`campaign-preview ${replay ? 'preview-done' : previewGate?.unlocked ? 'preview-ready' : 'preview-locked'}`}
      aria-label="Selected stop preview" data-testid="campaign-preview">
      {preview && previewGate ? <>
        <div className="preview-picture">{previewFrame ? <ShapeGlyph shape={previewFrame}/> : <LandscapeIllustration theme={preview.theme}/>}</div>
        <div className="preview-copy">
          <div className="preview-eyebrow"><span>STOP {previewIndex + 1}</span><span className="preview-state">
            <Icon name={replay ? 'check' : previewGate.unlocked ? 'play' : 'lock'} size={12}/>{status}
          </span></div>
          <h3>{preview.title}</h3>
          <div className="preview-facts">
            <span><Icon name="grid" size={14}/>{preview.size} x {preview.size}</span>
            <span title="Proved minimum number of exchanges"><Icon name="swap" size={14}/>Goal: {preview.minimum ?? '?'} {preview.minimum === 1 ? 'move' : 'moves'}</span>
          </div>
        </div>
        <p className={`preview-message ${error ? 'adventure-error' : ''}`} role={error ? 'alert' : 'status'}>
          {error ?? (loading ? 'Opening your stop...' : !previewGate.unlocked
            ? `Finish stop ${nextIndex + 1} to unlock this stop.` : preview.frame ? preview.note : 'Connect the full road through every home.')}
        </p>
        <button className="primary-button campaign-play" disabled={!previewGate.unlocked || loading !== null}
          onClick={() => onSelect(preview.id)}
          aria-label={loading ? 'Opening practice stop' : previewGate.unlocked ? `${replay ? 'Replay' : 'Play'} stop ${previewIndex + 1}` : `Stop ${previewIndex + 1} is locked; finish stop ${nextIndex + 1} first`}>
          <Icon name={!previewGate.unlocked ? 'lock' : replay ? 'reset' : 'play'} size={17}/>
          {loading ? 'Opening...' : !previewGate.unlocked ? `Finish stop ${nextIndex + 1} first` : error ? 'Try again' : `${replay ? 'Replay' : 'Play'} stop ${previewIndex + 1}`}
        </button>
      </> : <p className="preview-message" role="status">Preparing your road...</p>}
    </section>
    <span className="campaign-map-hint"><Icon name="map" size={13}/>Drag the map. Tap a number to preview.</span>
  </div>;
}
