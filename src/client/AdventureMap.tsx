import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { CatalogEntry, Theme } from '../shared/types.ts';
import { campaignAchievements, campaignGates, campaignPlaces, campaignWorlds, completedOriginalRoad, nextCampaignPlace, PRACTICE_WORLD_SIZE, worldStarRequirement, worldStars } from '../shared/progression.ts';
import type { CampaignGate, CampaignWorld, PracticeProgress } from '../shared/progression.ts';
import { Icon, StarRating } from './components.tsx';
import { HOME_COLORS } from './worldTheme.ts';
import { AtlasDefinitions, WorldLandscape } from './AdventureLandscape.tsx';
import { LANDSCAPE_EMBLEMS, mapMetrics, mapNodePosition, mapWaterRipples } from './adventureMapLayout.ts';
import type { MapMetrics, MapPoint as Point } from './adventureMapLayout.ts';
import { GardenCottage, HouseAddress, useGardenArt } from './GardenArt.tsx';
import { LandscapeDefinitions, LandscapeScene, loadLandscapeArt } from './LandscapeArt.tsx';
import { useCraftArt } from './CraftArt.tsx';

interface Drag { id: number; y: number; offset: number; moved: boolean }

interface MapProps {
  places: readonly CatalogEntry[];
  completed: readonly string[];
  progress: PracticeProgress;
  currentId: string;
  reduced: boolean;
  dark: boolean;
  loading: string | null;
  error: string | null;
  onSelect: (id: string) => void;
  onToday: () => void;
  sync?: { phase: 'loading' | 'saving' | 'saved' | 'error' | 'guest'; message: string | null; retry: () => void };
}

const StopCottage = memo(function StopCottage({ variant, winter }: { variant: number; winter: boolean }) {
  return <svg className="stop-cottage" viewBox="0 0 64 76" fill="none" aria-hidden="true">
    <path d="m3 55 27-16 31 17-28 17Z" fill="var(--art-shadow)"/>
    <path d="m7 52 24-14 27 15-24 15Z" fill="var(--stop-foundation)" stroke="var(--stop-trim)" strokeWidth="1"/>
    <path d="m11 31 24 13v20L11 51Z" fill="var(--stop-wall)" stroke="var(--stop-trim)" strokeWidth="1"/>
    <path d="m35 44 20-12v20L35 64Z" fill="var(--stop-side)" stroke="var(--stop-trim)" strokeWidth="1"/>
    <path d="m11 31 12-15 12 28Z" fill="var(--stop-wall)" stroke="var(--stop-trim)" strokeWidth="1"/>
    {variant === 1 ? <>
      <path d="m6 30 9-13 22 12 20-12 5 17-27 16Z" className="stop-roof-shade" stroke="var(--stop-trim)" strokeWidth="1"/>
      <path d="m15 17 20-12 22 12-20 12Z" className="stop-roof-light"/>
      <path d="m15 18 21 11m9-17-20 12" stroke="var(--stop-wall)" strokeOpacity=".3"/>
    </> : <>
      <path d={variant === 2 ? 'M6 31 23 6 46 12 28 37Z' : 'm6 31 17-18 22-12-17 18Z'}
        className="stop-roof-light" stroke="var(--stop-trim)" strokeWidth="1"/>
      <path d={variant === 2 ? 'm23 6 23 6 15 22-26 16Z' : 'm23 13 22-12 16 33-26 16Z'}
        className="stop-roof-shade" stroke="var(--stop-trim)" strokeWidth="1" strokeLinejoin="round"/>
      <path d={variant === 2 ? 'm29 10 14 29m-7-25 12 22' : 'm32 10 16 30m-8-35 15 29'} stroke="var(--stop-wall)" strokeOpacity=".22" strokeWidth="1"/>
    </>}
    {winter && <path d={variant === 1 ? 'm15 17 20-12 22 12-20 12Z' :
      variant === 2 ? 'M7 31 23 6l23 6-4 5-18-6L12 36Z' : 'm7 30 16-17L45 1l4 8-20 11-15 17Z'}
      fill="#edf3ee" stroke="#d4e4e0" strokeWidth="1" strokeLinejoin="round"/>}
    {variant !== 1 && <path d="m44 19 5 3V11l-5-3Z" fill="var(--stop-trim)" stroke="var(--stop-side)" strokeWidth="1"/>}
    <path d="m15 36 7 4v7l-7-4Zm25 10 7-4v7l-7 4Z" fill="var(--stop-glass)" stroke="var(--stop-trim)" strokeWidth="1"/>
    <path d="m26 59V46l6 3v13" fill="var(--stop-trim)"/>
    <path d="m9 52 26 14 22-13" stroke="var(--stop-foundation)" strokeWidth="2"/>
  </svg>;
});

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

function WorldHeading({ number, title, subtitle, detail, width, theme }: { number: number; title: string; subtitle: string; detail: string | null; width: number; theme: Theme }) {
  const garden = useGardenArt();
  const crafted = useCraftArt();
  const narrow = width < 300;
  const words = `${number}. ${title}`.split(' '), split = Math.ceil(words.length / 2);
  const lines = narrow ? [words.slice(0, split).join(' '), words.slice(split).join(' ')] : [words.join(' ')];
  const emblem = width >= 260;
  const plateWidth = Math.min(360, width - 56), height = (crafted ? narrow ? 76 : 59 : narrow ? 70 : 56) + (detail ? crafted ? 18 : 13 : 0), textX = (plateWidth + (emblem ? 40 : 0)) / 2;
  return <g className={`world-map-heading world-${theme} ${narrow ? 'heading-narrow' : ''}`} data-testid="world-map-heading"
    transform={`translate(${(width - plateWidth) / 2} 8)`}>
    <rect className="world-heading-shadow" x="0" y="3" width={plateWidth} height={height} rx="13"/>
    <rect className="world-heading-paper" width={plateWidth} height={height} rx="13"/>
    {emblem && <><rect className="world-heading-emblem" x="9" y={(height - 38) / 2} width="38" height="38" rx="11"/>
      {garden ? <LandscapeScene kind={LANDSCAPE_EMBLEMS[theme]} theme={theme} x={11} y={(height - 36) / 2} width={34} height={36} className="heading-landscape"/> :
        <use href={`#atlas-vignette-${LANDSCAPE_EMBLEMS[theme]}`} x="11" y={(height - 36) / 2} width="34" height="36"/>}</>}
    <path d={`M12 14v-3h10m${plateWidth - 44} 0h10v3`} className="world-heading-detail"/>
    {lines.map((line, index) => <text key={index} x={textX} y={narrow ? 23 + index * (crafted ? 20 : 18) : 25}
      className="world-map-title" textAnchor="middle">{line}</text>)}
    <text x={textX} y={crafted ? narrow ? 63 : 46 : narrow ? 59 : 44} className="world-map-subtitle" textAnchor="middle">{subtitle}</text>
    {detail && <text x={textX} y={crafted ? narrow ? 81 : 64 : narrow ? 72 : 57} className="world-map-subtitle" textAnchor="middle">{detail}</text>}
  </g>;
}

interface SceneryProps {
  entries: readonly CatalogEntry[];
  points: readonly Point[];
  gates: ReadonlyMap<string, CampaignGate>;
  done: ReadonlySet<string>;
  worlds: readonly CampaignWorld[];
  metrics: MapMetrics;
  height: number;
  unlockedWorlds: number;
  dark: boolean;
  revision: number;
}

const MapScenery = memo(function MapScenery({ entries, points, gates, done, worlds, metrics, height, unlockedWorlds, dark, revision }: SceneryProps) {
  const garden = useGardenArt();
  const crafted = useCraftArt();
  const { width, rowGap } = metrics;
  const regionHeight = 9.2 * rowGap;
  const waterRipples = useMemo(() => mapWaterRipples(width, regionHeight), [width, regionHeight]);
  // Bound decorative paint per island; interactive stops stay laid out separately.
  return <div key={revision} className="adventure-scenery" aria-hidden="true">
    <svg className="garden-art-definitions" width="0" height="0" focusable="false">
      {garden ? <LandscapeDefinitions/> : <AtlasDefinitions/>}
    </svg>
    {worlds.map((world) => {
      const top = world.index * regionHeight, span = Math.min(regionHeight, height - top);
      const priorWorld = worlds[world.index - 1], locked = world.index >= unlockedWorlds;
      const headingHeight = crafted ? 108 : 100;
      return <div key={world.index} className="adventure-region" style={{ top, height: span }}>
      <svg className="adventure-region-art" style={{ width, height: regionHeight }} viewBox={`0 0 ${width} ${regionHeight}`}>
        <path d={waterRipples} className="atlas-water-line"/>
        <g className={`campaign-world world-${world.theme} ${world.index >= unlockedWorlds ? 'world-locked' : ''}`} data-world={world.index + 1}>
          <WorldLandscape theme={world.theme} index={world.index} count={world.end - world.start} metrics={metrics} dark={dark}/>
        </g>
      </svg>
      <svg className="adventure-art" overflow="hidden" style={{ width, height: span }} viewBox={`0 ${top} ${width} ${span}`}>
    <g className="adventure-trails">{entries.slice(Math.max(1, world.start), Math.min(entries.length, world.end + 1)).map((place, local) => {
      const destination = Math.max(1, world.start) + local;
      const from = points[destination - 1], to = points[destination], prior = entries[destination - 1], gate = gates.get(place.id);
      if (!from || !to || !prior || !gate) throw new Error('The campaign road has a missing stop.');
      const crossing = destination % PRACTICE_WORLD_SIZE === 0;
      const copy = destination === world.start;
      const road = crossing ? islandCrossing(from, to, width, rowGap) : roadSegment(from, to, width, rowGap);
      return <g key={place.id} className={crossing ? 'island-crossing' : undefined} data-road-id={place.id} data-road-copy={copy}>
        <path d={road.path} className="trail-underlay"/>
        {garden && crossing && <path d={road.path} className="crossing-planks" data-crossing-id={place.id}/>}
        <path d={road.path} className={done.has(prior.id) && done.has(place.id) ? 'trail-discovered' : gate.unlocked ? 'trail-open' : 'trail-locked'}
          data-testid={copy ? undefined : 'campaign-road-link'}/>
        {crossing && <circle className="crossing-direction-halo" cx={road.middle.x} cy={road.middle.y} r="7"/>}
        <path d={crossing ? 'm-3-4 4 4-4 4' : 'm-3-3 4 3-4 3'} transform={`translate(${road.middle.x} ${road.middle.y}) rotate(${road.angle})`}
          className="trail-direction"/>
      </g>;
    })}</g>
      </svg>
      <svg className="adventure-heading-art" style={{ top: 0, width, height: headingHeight }} viewBox={`0 0 ${width} ${headingHeight}`}>
        <WorldHeading number={world.index + 1} title={world.title} width={width} theme={world.theme}
          subtitle={locked && priorWorld ? `Finish island ${world.index}` : `${world.end - world.start} stops / ${(world.end - world.start) * 3} stars`}
          detail={locked && priorWorld ? `All ${priorWorld.end - priorWorld.start} stops + ${worldStarRequirement(priorWorld)} stars` : null}/>
      </svg>
    </div>;
    })}
  </div>;
});

interface StopProps {
  place: CatalogEntry;
  index: number;
  point: Point;
  originY: number;
  theme: Theme;
  discovered: boolean;
  solved: boolean;
  credited: boolean;
  stars: number;
  unlocked: boolean;
  next: boolean;
  current: boolean;
  previewed: boolean;
  loading: boolean;
  onPreview: (id: string) => void;
  onSelect: (id: string) => void;
}

const MapStop = memo(function MapStop({ place, index, point, originY, theme, discovered, solved, credited, stars, unlocked, next, current, previewed, loading, onPreview, onSelect }: StopProps) {
  const garden = useGardenArt();
  const roof = Object.values(HOME_COLORS)[index % 6] ?? HOME_COLORS.A;
  const style: CSSProperties & { '--house-enamel': string } = { left: point.x, top: point.y - originY, color: roof, '--house-enamel': roof };
  return <button className={`adventure-stop stop-${theme} ${discovered ? 'is-discovered' : ''} ${!unlocked ? 'is-locked' : ''} ${next ? 'is-next' : ''} ${current ? 'is-current' : ''} ${previewed ? 'is-previewed' : ''}`}
    style={style} disabled={loading} data-campaign-stop={place.id} data-ordinal={index + 1} data-previewed={previewed}
    aria-current={next ? 'step' : current ? 'location' : undefined}
    aria-label={`${unlocked ? solved ? 'Replay' : 'Play' : 'Preview locked'} stop ${index + 1}. ${place.title}. ${credited && !solved ? `Earlier ${stars} stars kept; new route.` : discovered ? `Completed; ${stars} of 3 stars.` : unlocked ? 'Ready to play.' : 'Locked.'}`}
    onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) onPreview(place.id); }}
    onClick={() => { onPreview(place.id); if (unlocked) onSelect(place.id); }}>
    {garden ? <GardenCottage sprite variant={index % 6} winter={theme === 'winter'} className="stop-cottage"/> :
      <StopCottage variant={index % 3} winter={theme === 'winter'}/>}
    <span className="stop-number">{garden ? <HouseAddress>{index + 1}</HouseAddress> : index + 1}</span>
    {discovered && <StarRating stars={stars}/>}
    {(discovered || !unlocked) && <span className="campaign-stop-badge"><Icon name={discovered ? 'check' : 'lock'} size={11}/></span>}
  </button>;
});

export function AdventureMap({ places, completed, progress, currentId, reduced, dark, loading, error, onSelect, onToday, sync }: MapProps) {
  const garden = useGardenArt();
  const crafted = useCraftArt();
  const scene = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const offset = useRef(0);
  const focusedStop = useRef<string | null>(null);
  const followingNext = useRef(true);
  const revealedPreview = useRef<string | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [artError, setArtError] = useState<string | null>(null);
  const [artRetry, setArtRetry] = useState(0);
  const [artRevision, setArtRevision] = useState(0);
  useEffect(() => {
    if (!garden) return;
    let active = true;
    setArtError(null);
    void loadLandscapeArt(crafted).then(() => {
      if (active && artRetry > 0) setArtRevision(value => value + 1);
    }).catch((error: unknown) => {
      console.error('The seasonal journey artwork could not load:', error);
      if (active) setArtError(error instanceof Error ? error.message : 'The journey artwork could not load. Please try again.');
    });
    return () => { active = false; };
  }, [garden, crafted, artRetry]);
  const entries = useMemo(() => campaignPlaces(places), [places]);
  const gates = useMemo(() => campaignGates(places, completed, progress), [places, completed, progress]);
  const worlds = useMemo(() => campaignWorlds(entries.length), [entries.length]);
  const achievements = useMemo(() => campaignAchievements(places, completed, progress), [places, completed, progress]);
  const done = useMemo(() => new Set([...achievements].filter(([, value]) => value.completed).map(([id]) => id)), [achievements]);
  const next = useMemo(() => nextCampaignPlace(places, completed, progress), [places, completed, progress]);
  const nextIndex = next ? entries.findIndex((place) => place.id === next.id) : -1;
  const needsStars = next !== null && done.has(next.id);
  const starWorld = needsStars ? worlds[progress.unlockedWorlds - 1] : null;
  const currentPlace = places.find(place => place.id === currentId);
  const currentIndex = currentPlace?.campaignSlot ?? currentPlace?.originalSlot ?? entries.findIndex((place) => place.id === currentId);
  const focusIndex = starWorld?.start ?? (nextIndex >= 0 ? nextIndex : Math.max(0, currentIndex >= 0 ? currentIndex : entries.length - 1));
  const metrics = useMemo(() => mapMetrics(viewport.width), [viewport.width]);
  const { rowGap, topInset, bottomInset } = metrics;
  const points = useMemo(() => entries.map((_, index) => mapNodePosition(index, metrics)), [entries, metrics]);
  const worldHeight = Math.max(viewport.height, (points.at(-1)?.y ?? 0) + rowGap * 1.1);
  const maxOffset = Math.max(0, worldHeight - viewport.height);
  const focusY = points[focusIndex]?.y ?? 0;
  const focusWorldStart = Math.floor(focusIndex / PRACTICE_WORLD_SIZE) * PRACTICE_WORLD_SIZE;
  const focusRowStart = focusWorldStart + Math.floor((focusIndex - focusWorldStart) / 3) * 3;
  const focusRow = points.slice(focusRowStart, Math.min(focusRowStart + 3, focusWorldStart + PRACTICE_WORLD_SIZE));
  const rowFocusY = focusRow.length ? (Math.min(...focusRow.map((point) => point.y)) + Math.max(...focusRow.map((point) => point.y))) / 2 : focusY;
  const headingTop = Math.floor(focusIndex / PRACTICE_WORLD_SIZE) * 9.2 * rowGap + 8;
  const focusOffset = focusRow.length > 0 && focusRowStart === focusWorldStart &&
    viewport.height >= Math.max(...focusRow.map((point) => point.y + bottomInset)) - headingTop + 4
    ? headingTop - 4 : rowFocusY - (viewport.height + topInset - bottomInset) / 2;
  const completedCount = entries.filter((place) => done.has(place.id)).length;
  const rememberScroll = useCallback((element: HTMLDivElement): void => {
    const pixels = element.scrollTop;
    offset.current = pixels / rowGap;
    const value = String(Math.round(pixels));
    if (element.dataset['campaignOffset'] !== value) element.dataset['campaignOffset'] = value;
  }, [rowGap]);

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
    const element = scene.current;
    if (!element || !viewport.width) return;
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
        if (selected.y - target < topInset) target = selected.y - topInset;
        else if (selected.y - target > viewport.height - bottomInset) target = selected.y - viewport.height + bottomInset;
      }
    }
    revealedPreview.current = previewId;
    const rows = Math.max(0, Math.min(maxOffset, target)) / rowGap;
    element.scrollTop = rows * rowGap;
    rememberScroll(element);
  }, [entries, points, previewId, focusIndex, focusOffset, viewport.width, viewport.height, rowGap, maxOffset, topInset, bottomInset, rememberScroll]);

  const panTo = (pixels: number, animate = false, follow = false): void => {
    followingNext.current = follow;
    revealedPreview.current = previewId;
    const element = scene.current;
    if (!element) return;
    element.scrollTo({ top: Math.max(0, Math.min(maxOffset, pixels)), behavior: animate && !reduced ? 'smooth' : 'instant' });
    rememberScroll(element);
  };
  const previewStop = useCallback((id: string): void => {
    followingNext.current = false;
    setPreviewId(id);
  }, []);
  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false): void => {
    if (drag.current?.id !== event.pointerId) return;
    suppressClick.current = !cancelled && drag.current.moved;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const preview = entries.find((place) => place.id === previewId) ?? (needsStars ? null : entries[focusIndex] ?? null);
  const previewGate = preview ? gates.get(preview.id) : null;
  const previewIndex = preview ? entries.findIndex((place) => place.id === preview.id) : -1;
  const previewWorld = preview ? worlds[Math.floor(Math.max(0, previewIndex) / PRACTICE_WORLD_SIZE)] : starWorld;
  const previewAchievement = preview ? achievements.get(preview.id) : undefined;
  const previewStars = previewAchievement?.stars ?? 0;
  const starsHere = previewWorld ? worldStars(previewWorld, places, completed, progress) : 0;
  const starsNeeded = starWorld ? Math.max(0, worldStarRequirement(starWorld) - starsHere) : 0;
  const replay = previewAchievement?.solved === true;
  const credited = previewAchievement?.credited === true;
  const originalRoad = preview && credited ? completedOriginalRoad(places, completed, preview.id) : null;
  const status = replay ? 'Completed' : credited ? 'Stars kept' : previewGate?.unlocked ? 'Ready' : 'Locked';
  const sceneStyle: CSSProperties & { '--map-stop-scale': number } = { '--map-stop-scale': metrics.stopScale };
  const markers = useMemo(() => worlds.map((world) => {
    const top = world.index * 9.2 * rowGap;
    return <div key={world.index} className="adventure-marker-region" style={{ top, height: Math.min(9.2 * rowGap, worldHeight - top) }}>
      {entries.slice(world.start, world.end).map((place, local) => {
        const index = world.start + local, point = points[index], gate = gates.get(place.id);
        if (!point || !gate) throw new Error('The campaign stop is missing.');
        const discovered = done.has(place.id);
        return <MapStop key={place.id} place={place} index={index} point={point} originY={top} theme={world.theme}
          discovered={discovered} solved={achievements.get(place.id)?.solved === true} credited={achievements.get(place.id)?.credited === true}
          stars={achievements.get(place.id)?.stars ?? 0} unlocked={gate.unlocked}
          next={!needsStars && index === nextIndex} current={place.id === currentId} previewed={place.id === preview?.id}
          loading={loading !== null} onPreview={previewStop} onSelect={onSelect}/>;
      })}
    </div>;
  }), [entries, points, gates, done, achievements, worlds, rowGap, worldHeight, needsStars, nextIndex, currentId, preview?.id, loading, previewStop, onSelect]);

  return <div className="adventure-map" data-campaign-count={entries.length}>
    <div className="adventure-tools">
      <div className="adventure-progress"><strong>{previewWorld?.title ?? 'Your road'}</strong>
        <span aria-label={`${completedCount} of ${entries.length} stops completed`}>{completedCount} / {entries.length} <span className="progress-unit">completed</span></span>
        {previewWorld && <small className="world-star-total" data-testid="world-star-total">{starsHere} / {(previewWorld.end - previewWorld.start) * 3} stars</small>}
      </div>
      <div className="adventure-controls">
        <button className="secondary-button adventure-focus" disabled={!entries.length} aria-label={needsStars ? 'Find island needing stars' : 'Find my next stop'}
          title={needsStars ? 'Find island needing stars' : 'Find my next stop'}
          onClick={() => { setPreviewId(needsStars ? null : entries[focusIndex]?.id ?? null); panTo(focusOffset, true, true); }}>
          <Icon name="map" size={18}/><span className="control-full">{needsStars ? 'Find island' : 'Find my stop'}</span><span className="control-short">{needsStars ? 'Island' : 'Find stop'}</span>
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
    <div ref={scene} className={`adventure-scene connected-world ${dragging ? 'is-dragging' : ''}`} style={sceneStyle} tabIndex={0} role="region"
      aria-label="Connected ordered practice map. Scroll, swipe, drag or use arrow keys to explore. Home and End reach opposite ends."
      data-campaign-offset={Math.round(offset.current * rowGap)} data-next-stop={needsStars ? 'stars' : nextIndex >= 0 ? nextIndex + 1 : 'complete'}
      onScroll={(event) => rememberScroll(event.currentTarget)}
      onWheelCapture={(event) => { if (!event.ctrlKey && event.deltaY) followingNext.current = false; }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        followingNext.current = false;
        suppressClick.current = false;
        if (event.pointerType !== 'mouse') return;
        const element = event.currentTarget;
        element.scrollTo({ top: element.scrollTop, behavior: 'instant' });
        drag.current = { id: event.pointerId, y: event.clientY, offset: element.scrollTop, moved: false };
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
        const panY = event.currentTarget.scrollTop;
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
      {viewport.width > 0 && <div className="adventure-world" style={{ height: worldHeight }}>
        <MapScenery entries={entries} points={points} gates={gates} done={done} worlds={worlds} metrics={metrics}
          height={worldHeight} unlockedWorlds={progress.unlockedWorlds} dark={dark} revision={artRevision}/>
        <div className="adventure-markers">{markers}</div>
      </div>}
    </div>
    <section className={`campaign-preview ${!preview ? 'preview-choice' : replay ? 'preview-done' : previewGate?.unlocked ? 'preview-ready' : 'preview-locked'}`}
      aria-label={preview ? 'Selected stop preview' : 'Choose a Practice stop'} data-testid="campaign-preview">
      {preview && previewGate ? <>
        <div className="preview-copy">
          <div className="preview-eyebrow"><span>STOP {previewIndex + 1}</span><span className="preview-state">
            <Icon name={replay ? 'check' : previewGate.unlocked ? 'play' : 'lock'} size={12}/>{status}
          </span></div>
          <h3>{preview.title}</h3>
          <StarRating stars={previewStars} label={`${previewStars} of 3 stars kept for this stop`}/>
          {credited && !replay && <span className="legacy-credit-note">Earlier stars kept. A new road awaits.</span>}
          <div className="preview-facts">
            <span><Icon name="grid" size={14}/>{preview.size} x {preview.size}</span>
          </div>
        </div>
        <p className={`preview-message ${error || artError ? 'adventure-error' : ''}`} role={error || artError ? 'alert' : 'status'}>
          {error ?? artError ?? (loading ? 'Opening your stop...' : !previewGate.unlocked ? previewGate.reason :
            replay ? crafted ? 'Your best is kept. Try a smaller detour.' : 'Your stars are kept. Find a more efficient road to improve them.' :
              crafted ? 'One road. Every home. In order.' : 'Connect every home in order. Discover your own best route.')}
        </p>
        <button className="primary-button campaign-play" disabled={!previewGate.unlocked || loading !== null}
          onClick={() => onSelect(preview.id)}
          aria-label={loading ? 'Opening practice stop' : previewGate.unlocked ? `${replay ? 'Replay' : 'Play'} stop ${previewIndex + 1}` : `Stop ${previewIndex + 1} is locked. ${previewGate.reason}`}>
          <Icon name={!previewGate.unlocked ? 'lock' : replay ? 'reset' : 'play'} size={17}/>
          {loading ? 'Opening...' : !previewGate.unlocked ? 'Island locked' : error ? 'Try again' : `${replay ? 'Replay' : 'Play'} stop ${previewIndex + 1}`}
        </button>
        {originalRoad && <button className="text-button original-route-preview" disabled={loading !== null}
          onClick={() => onSelect(originalRoad)}><Icon name="book" size={16}/>Replay original road</button>}
      </> : starWorld ? <>
        <div className="preview-copy"><div className="preview-eyebrow">MORE STARS</div><h3>Choose a stop.</h3></div>
        <p className={`star-choice-message ${artError ? 'adventure-error' : ''}`} role={artError ? 'alert' : 'status'} data-testid="practice-star-choice">
          {artError ?? <>Pick a completed stop on this island with fewer than 3 stars. {starsNeeded} more {starsNeeded === 1 ? 'star opens' : 'stars open'} the next island.</>}
        </p>
      </> : <p className="preview-message" role="status">Preparing your road...</p>}
      {artError && <button className="text-button" onClick={() => setArtRetry(value => value + 1)}>Retry map artwork</button>}
    </section>
    <div className={`campaign-map-hint progress-sync ${sync?.phase === 'error' ? 'progress-sync-error' : ''}`} role={sync?.phase === 'error' ? 'alert' : 'status'}
      data-testid="practice-sync-status">
      <Icon name={sync?.phase === 'error' ? 'warning' : 'check'} size={13}/>
      <span>{sync?.phase === 'error' ? sync.message : sync?.phase === 'loading' ? 'Loading saved stops...' :
        sync?.phase === 'saving' ? 'Saving your stops...' : sync?.phase === 'saved' ? crafted ? 'Stops and stars saved.' : sync.message ?? 'Progress saved to your account' :
          crafted ? 'Saved on this device.' : 'Guest progress saved on this device'}</span>
      {sync?.phase === 'error' && <button className="text-button" onClick={sync.retry}>Retry sync</button>}
    </div>
  </div>;
}
