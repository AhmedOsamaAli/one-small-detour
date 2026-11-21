import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Anchor, FrameAxes, GuideTopic, Shape, Theme, Tile } from '../shared/types.ts';
import { isAnchor, patchCells } from '../shared/rules.ts';
import { HOME_GLYPHS, HOME_PLAQUE_PATH, HOME_SPROUT_PATH } from './homeLetter.ts';
import { GardenCottage, GardenPlant, useGardenArt } from './GardenArt.tsx';
import { GARDEN_ASSETS } from './gardenAssets.ts';
import { CraftCourier, useCraftArt } from './CraftArt.tsx';

type IconName = 'sound' | 'mute' | 'undo' | 'reset' | 'book' | 'help' | 'close' | 'arrow' | 'sun' | 'moon' | 'leaf' | 'trophy' | 'map' | 'swap' | 'check' | 'chevron' | 'lock' | 'clock' | 'warning' | 'bridge' | 'play' | 'grid' | 'trash' | 'cube';

const paths: Record<IconName, ReactNode> = {
  sound: <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
  mute: <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/></>,
  undo: <><path d="m9 5-5 5 5 5"/><path d="M4 10h10a6 6 0 0 1 0 12"/></>,
  reset: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></>,
  book: <><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z"/><path d="M12 5v15"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1 .7-1.7 1.2-1.7 2.7M12 17h.01"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></>,
  moon: <path d="M20 15.4A9 9 0 0 1 8.6 4a9 9 0 1 0 11.4 11.4Z"/>,
  leaf: <><path d="M20 3C10 2 3 6 4 13c1 7 11 8 14 1 2-4 2-7 2-11Z"/><path d="M4 21c1-8 7-11 12-14"/></>,
  trophy: <><path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v6m-5 2h10"/></>,
  map: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z"/><path d="M9 3v16m6-14v16"/></>,
  swap: <><path d="M3 8h16l-4-4m6 12H5l4 4"/></>,
  check: <path d="m5 12 4 4L20 5"/>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  warning: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v1"/></>,
  bridge: <><path d="M3 12h18M7 8l-4 4 4 4m10-8 4 4-4 4"/></>,
  play: <path d="m8 4 12 8-12 8V4Z"/>,
  grid: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></>,
  cube: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5m-9 5v9"/></>,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function HomeLetter({ anchor, plaque = false, compact = false }: { anchor: Anchor; plaque?: boolean; compact?: boolean }) {
  return <svg className="home-letter" viewBox={compact ? '4 7 24 24' : '0 0 32 36'} fill="currentColor" aria-hidden="true" focusable="false" data-home-letter={anchor}>
    {plaque && <path d={HOME_PLAQUE_PATH} fill="var(--world-home-badge)" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>}
    <path d={HOME_GLYPHS[anchor]} fillRule="evenodd"/>
    {!compact && <path d={HOME_SPROUT_PATH}/>}
  </svg>;
}

export function JourneyCottage({ anchor }: { anchor: Anchor }) {
  return <span className="journey-cottage" aria-hidden="true">
    <svg className="journey-cottage-art" viewBox="0 0 44 52" fill="none" focusable="false">
      <ellipse cx="22" cy="49" rx="20" ry="2" fill="#233f3426"/>
      <path d="M30 4h6v12l-6-4Z" fill="#e5d6b7" stroke="#766954" strokeWidth="1"/>
      <path d="m31 22 9-2v25l-9 4Z" fill="#cdbd97" stroke="#766954" strokeWidth="1"/>
      <path d="m5 24 13-13 14 13v25H5Z" fill="#fff1d2" stroke="#766954" strokeWidth="1"/>
      <path className="journey-cottage-roof" d="M1 23 17 6h12l14 16-11 4-14-14L6 26Z" fill="var(--home-color)"/>
      <path d="M17 6h12l14 16-11 4-14-14Z" fill="color-mix(in srgb, var(--home-color) 76%, #203e32)"/>
      <path d="m23 10 12 13m-8-13 11 12M6 22l12-12" stroke="#fff8e6" strokeOpacity=".3" strokeWidth="1"/>
      <rect x="34" y="29" width="4" height="6" rx=".7" fill="#f3d48f" stroke="#766954" strokeWidth=".8"/>
      <rect className="journey-cottage-plaque" x="6.5" y="21" width="25.5" height="27.5" rx="3"
        fill="var(--home-color)" stroke="var(--world-home-badge)" strokeWidth="1.2"/>
      <path className="journey-cottage-outline" d="M30 4h6v10l7 8-11 4v23H5V26l-4-3L17 6h12l1 1Z"
        stroke="color-mix(in srgb, var(--home-color) 72%, #203e32)" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
    <HomeLetter anchor={anchor} compact/>
  </span>;
}

export function StarRating({ stars, label }: { stars: number; label?: string }) {
  return <svg className="practice-stars" viewBox="0 0 78 24" role="img" aria-label={label ?? `${stars} of 3 stars`} focusable="false">
    {[1, 2, 3].map((number) => <path key={number} className={number <= stars ? 'star-earned' : 'star-empty'}
      transform={`translate(${(number - 1) * 27} 0)`}
      d="m12 2.5 2.9 5.9 6.5 1-4.7 4.5 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.5 6.5-1Z" strokeWidth="1.5" strokeLinejoin="round"/>)}
  </svg>;
}

export function BrandMark() {
  return <svg width="35" height="35" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <path d="m5 14 12-7 12 7-12 7L5 14Z" fill="#9eaf7d" stroke="#456b58" strokeWidth="1.3"/>
    <path d="M5 14v8l12 7 12-7v-8l-12 7L5 14Z" fill="#d4c7a6" stroke="#456b58" strokeWidth="1.3"/>
    <path d="m20 23 8-5 8 5-8 5-8-5Z" fill="#b5d7cf" stroke="#456b58" strokeWidth="1.3"/>
    <path d="M20 23v6l8 5 8-5v-6l-8 5-8-5Z" fill="#ddcfad" stroke="#456b58" strokeWidth="1.3"/>
    <path d="m12 13 5 3 5-3" stroke="#fdf9e8" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}

export function GuideCourier({ portrait = false, onBoard = false }: { portrait?: boolean; onBoard?: boolean }) {
  const id = useId();
  const garden = useGardenArt();
  const crafted = useCraftArt();
  if (garden && crafted) return <CraftCourier portrait={portrait} onBoard={onBoard}/>;
  if (garden) return <svg className={`guide-courier detailed-courier ${portrait ? 'courier-portrait' : ''}`} width="64" height="84"
    viewBox={portrait ? '35 0 186 166' : onBoard ? '48 0 160 256' : '0 0 256 256'} aria-hidden="true" focusable="false">
    <image href={GARDEN_ASSETS.courier} width="256" height="256"/>
  </svg>;
  return <svg className={`guide-courier ${portrait ? 'courier-portrait' : ''}`} width="64" height="84"
    viewBox={portrait ? '12 0 74 68' : '0 0 96 128'} fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-coat`} x1="25" y1="66" x2="70" y2="104" gradientUnits="userSpaceOnUse">
        <stop stopColor="#428082"/><stop offset="1" stopColor="#204851"/>
      </linearGradient>
      <linearGradient id={`${id}-skin`} x1="32" y1="22" x2="65" y2="62" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f4d5ad"/><stop offset=".6" stopColor="#e9bb93"/><stop offset="1" stopColor="#ce9471"/>
      </linearGradient>
      <linearGradient id={`${id}-hat`} x1="27" y1="8" x2="67" y2="34" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f2d794"/><stop offset=".55" stopColor="#dfb35e"/><stop offset="1" stopColor="#b9873c"/>
      </linearGradient>
    </defs>
    <ellipse cx="47" cy="121" rx="31" ry="5" fill="#102c3430"/>
    <path d="m33 94-4 23h15l6-20m4-3 2 23h15l-7-25" fill="#34454c"/>
    <path d="m31 98 11 2-3 14h-9m26-15 9-2 4 17H57" fill="#243740"/>
    <path d="M29 113h15v9H23q-1-6 6-9Zm27 0h13q9 3 9 9H56v-9Z" fill="#664b36"/>
    <path d="M24 120h20m13 0h20" stroke="#b18c60" strokeWidth="2"/>
    <path d="M29 67q18-13 36 0l7 35q-25 8-48-1l5-34Z" fill={`url(#${id}-coat)`} stroke="#244b51" strokeWidth="1.5"/>
    <path d="M45 73v29m-17-6q18 5 40 0" stroke="#78a29a" strokeOpacity=".45" strokeWidth="1.4"/>
    <path d="m29 69-15 23 8 7 19-24" fill="#366e73" stroke="#244b51" strokeWidth="1.5"/>
    <path d="m16 88 8 6" stroke="#9fb4a0" strokeWidth="3"/>
    <circle cx="18" cy="97" r="6" fill={`url(#${id}-skin)`} stroke="#b17e60"/>
    <g className="guide-point">
      <path d="m65 70 14 12 1 11" stroke="#244b51" strokeWidth="14" strokeLinecap="round"/>
      <path d="m65 70 14 12 1 11" stroke="#39777a" strokeWidth="10" strokeLinecap="round"/>
      <path d="m76 91 8-1" stroke="#9fb4a0" strokeWidth="3"/>
      <path d="M77 98v-8q0-5 4-5t4 5l2 11q0 5-4 7l-6-8q-5 0-7-4-1-4 3-4l4 6Z" fill={`url(#${id}-skin)`} stroke="#b17e60" strokeWidth="1.2"/>
    </g>
    <path d="m32 69 29 28" stroke="#183d44" strokeWidth="8"/>
    <path d="m32 68 29 28" stroke="#d6b074" strokeWidth="5"/>
    <rect x="52" y="86" width="22" height="20" rx="5" fill="#a96f3d" stroke="#694d34" strokeWidth="1.5"/>
    <path d="M53 88h20v7q-10 5-20 0v-7Z" fill="#cf9857"/>
    <path d="M55 103h16" stroke="#d6ab72" strokeWidth="1.2" strokeDasharray="2 2"/>
    <rect x="61" y="93" width="5" height="6" rx="1" fill="#f3d58c" stroke="#8c6938"/>
    <path d="M36 53h25v14q-12 9-25-1V53Z" fill="#d9a67e"/>
    <path d="m32 63q16 9 33 0l-2 9q-17 8-31-1v-8Z" fill="#c77742"/>
    <path d="m34 69 10 4-9 18-7-7 6-15Z" fill="#df9a58"/>
    <path d="m30 83 7 4" stroke="#f4c888" strokeWidth="2"/>
    <ellipse cx="48" cy="38" rx="23" ry="26" fill={`url(#${id}-skin)`} stroke="#b98462" strokeWidth="1.2"/>
    <path d="M26 34q-3-27 21-27 25-1 24 29l-7-10-32 1-6 7Z" fill="#6b4c35"/>
    <path d="M25 25q0-21 23-21 24-1 24 22l-47-1Z" fill={`url(#${id}-hat)`} stroke="#9d7538" strokeWidth="1.2"/>
    <path d="M25 21q23-6 47 0v8H25v-8Z" fill="#765238"/>
    <path d="M16 28q32-11 65 0-12 12-61 7-6 0-4-7Z" fill="#eac77e" stroke="#a47c40" strokeWidth="1.3"/>
    <path d="M20 29q29-7 57 0" stroke="#fff0bc" strokeWidth="2" strokeLinecap="round"/>
    <path d="m35 40 6-1m15 0 6 2" stroke="#795239" strokeWidth="2" strokeLinecap="round"/>
    <ellipse cx="38" cy="45" rx="2.6" ry="3" fill="#253b3e"/><ellipse cx="59" cy="45" rx="2.6" ry="3" fill="#253b3e"/>
    <circle cx="37" cy="44" r=".9" fill="#fff5da"/><circle cx="58" cy="44" r=".9" fill="#fff5da"/>
    <path d="m48 46-2 6 4 1" stroke="#bb805e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M42 57q6 5 13-1" stroke="#975f49" strokeWidth="2" strokeLinecap="round"/>
    <ellipse cx="32" cy="53" rx="4" ry="2.5" fill="#cf8a70" fillOpacity=".55"/>
    <ellipse cx="65" cy="53" rx="4" ry="2.5" fill="#cf8a70" fillOpacity=".55"/>
  </svg>;
}

export function BotanicalFrame() {
  return <div className="botanical-frame" aria-hidden="true">{['tl', 'tr', 'bl', 'br'].map((corner) =>
    <svg key={corner} className={`botanical-corner corner-${corner}`} viewBox="0 0 64 64" fill="none">
      <path d="M7 59V25Q7 7 25 7h34" stroke="var(--bark)" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M7 48Q24 47 20 34 8 32 7 48Zm0-17Q-1 25 3 17q12 2 8 12M19 9Q18 24 32 22 35 9 19 9Zm18-2Q42-1 51 3q-2 12-14 8"
        fill="var(--leaf)" stroke="var(--leaf-light)" strokeWidth=".7"/>
      <path d="m8 45 9-8M23 11l7 8M38 9l10-4" stroke="var(--leaf-light)" strokeWidth=".8" strokeLinecap="round"/>
      <path d="m7 58 2-5 2 5-2 3-2-3Zm47-51 4-2 3 2-3 2-4-2Z" fill="var(--accent-border)"/>
      <circle cx="10" cy="11" r="2.2" fill="var(--accent-border)"/>
    </svg>)}</div>;
}

export function ScenicBackdrop() {
  const id = useId();
  const garden = useGardenArt();
  if (garden) return <div className="world-backdrop garden-backdrop" aria-hidden="true"/>;
  return <div className="world-backdrop" aria-hidden="true">
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none">
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="1">
          <stop stopColor="var(--sky-top)"/><stop offset="1" stopColor="var(--sky-bottom)"/>
        </linearGradient>
        <radialGradient id={`${id}-glow`}><stop stopColor="var(--sky-glow)" stopOpacity=".4"/><stop offset="1" stopColor="var(--sky-glow)" stopOpacity="0"/></radialGradient>
      </defs>
      <path d="M0 0h1440v900H0Z" fill={`url(#${id}-sky)`}/>
      <ellipse cx="1120" cy="180" rx="420" ry="350" fill={`url(#${id}-glow)`}/>
      <g className="art-sun"><circle cx="1270" cy="150" r="34" fill="var(--sky-glow)" opacity=".55"/><circle cx="1270" cy="150" r="45" stroke="var(--sky-glow)" opacity=".2"/></g>
      <g className="art-moon" fill="var(--sky-glow)"><path d="M1295 120a31 31 0 1 1-39 40 31 31 0 0 0 39-40Z"/>
        <path d="m1096 108 2-6 2 6 6 2-6 2-2 6-2-6-6-2 6-2Zm218 151 2-5 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/></g>
      <g stroke="var(--edge-light)" strokeWidth="10" strokeLinecap="round" opacity=".65">
        <path d="M72 172h90m-29 17h61m935 91h70m-17 17h49"/>
      </g>
      <path d="M0 646Q125 518 294 654t290 17q217-143 438-19 237-171 418-72v320H0V646Z" fill="var(--hill-far)" opacity=".32"/>
      <path d="M0 759q196-154 390-28t387 9q166-120 367-27 187-162 296-95v282H0V759Z" fill="var(--hill-mid)" opacity=".38"/>
      <path d="M0 846q178-129 381-23t424 5q231-103 420-33 113-90 215-85v190H0v-54Z" fill="var(--hill-near)" opacity=".28"/>
      <g stroke="var(--hill-near)" strokeLinecap="round" opacity=".23">
        <path d="M59 900V779m0 72-31-28m31 11 30-28m1241 94V756m0 68-28-24m28 8 27-27" strokeWidth="8"/>
        <path d="m23 808 36-79 39 79H23Zm1276-29 31-71 33 71h-64Z" fill="var(--hill-near)" stroke="none"/>
      </g>
    </svg>
  </div>;
}

export function LandscapeIllustration({ theme = 'meadow' }: { theme?: Theme }) {
  const orchard = theme === 'orchard';
  const coast = theme === 'coast';
  const id = useId();
  const garden = useGardenArt();
  if (garden) return <div className={`landscape-illustration garden-vignette art-${theme}`} aria-hidden="true">
    <GardenPlant theme={theme}/><GardenCottage variant={theme === 'blossom' ? 4 : theme === 'winter' ? 2 : 0} winter={theme === 'winter'}/>
    <GardenPlant theme={theme} flowers className="vignette-flowers"/><GuideCourier/>
  </div>;
  return <svg className={`landscape-illustration art-${theme}`} width="180" height="112" viewBox="0 0 240 150" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-land`} x2=".8" y2="1">
        <stop stopColor="var(--map-land-one)"/><stop offset="1" stopColor="var(--map-land-three)"/>
      </linearGradient>
      <linearGradient id={`${id}-wall`}><stop stopColor="#fff1cd"/><stop offset="1" stopColor="#d8bd8b"/></linearGradient>
    </defs>
    <ellipse cx="119" cy="129" rx="97" ry="12" fill="var(--art-shadow)"/>
    <path d="M14 79Q-6 30 64 23q58-35 116 2 65 10 44 62 2 54-102 44Q31 146 14 79Z" fill="var(--surface-soft)"/>
    <circle className="art-sun" cx="187" cy="25" r="16" fill="#eac67a"/>
    <path className="art-moon" d="M199 13a16 16 0 1 1-22 22 16 16 0 0 0 22-22Z" fill="#e3dfab"/>
    <path d="m19 83 94-48 109 47v15l-99 47L19 98V83Z" fill="var(--world-soil, #8d6242)"/>
    <path d="m19 91 104 45 99-46" stroke="var(--world-soil-edge, #bd945e)" strokeWidth="3"/>
    <path d="m19 81 94-48 109 47-99 49L19 81Z" fill={`url(#${id}-land)`} stroke="var(--map-border)" strokeWidth="1.2" strokeLinejoin="round"/>
    {coast && <><path d="m140 94 48-23 30 12-61 30-17-19Z" fill="var(--world-water, #236f7f)"/>
      <path d="m157 98 14-7m8 5 15-7" stroke="var(--world-foam, #d4eee2)" strokeWidth="1.7" strokeLinecap="round"/></>}
    <path d="m63 102 39-20q12-6 24 0l8 3q8 3 17-2l28-15" stroke="var(--world-mortar, #816849)" strokeWidth="13" strokeLinejoin="round"/>
    <path d="m63 100 39-20q12-6 24 0l8 3q8 3 17-2l28-15" stroke="var(--world-road, #efd8a7)" strokeWidth="10" strokeLinejoin="round"/>
    <path d="m85 85 4 8m16-18 2 10m15-9-3 9m18-6-1 9m17-13 3 8m12-15 4 8" stroke="var(--world-road-shade, #b59464)" strokeWidth="1.5"/>
    <g transform="translate(49 61)">
      <ellipse cx="7" cy="35" rx="26" ry="7" fill="#193a3429"/>
      <path d="m-12 11 25-8 17 9v24l-17 7-25-13V11Z" fill={`url(#${id}-wall)`} stroke="#b39a70"/>
      <path d="m13 3 17 9v24l-17 7V3Z" fill="#c9ae80"/>
      <path d="m-18 12 20-25 31 21-20 9-31-5Z" fill="#326b59" stroke="#274e45" strokeLinejoin="round"/>
      <path d="m2-13 13 26 18-5L2-13Z" fill="#497f63"/>
      <path d="m-10 3 28 8m-23-15 28 10" stroke="#8caf7e" strokeOpacity=".6"/>
      <path d="m-3 35 9 4V21l-9-4v18Z" fill="#795333"/>
      <path d="m17 18 7-3v8l-7 3v-8Z" fill="#f1c768" stroke="#98733d"/>
      <path d="m-8 15 7 3v7l-7-3v-7Z" fill="#e7bc65"/>
      <path d="m21 0 1-14 6 2v14" fill="#b68e64"/>
    </g>
    <g transform="translate(166 39) scale(.8)">
      <path d="m-10 13 23-9 18 10v26l-18 7-23-13V13Z" fill={`url(#${id}-wall)`} stroke="#b39a70"/>
      <path d="m13 4 18 10v26l-18 7V4Z" fill="#c9ae80"/>
      <path d="m-17 14 18-25 34 23-22 8-30-6Z" fill="#a95740" stroke="#884832" strokeLinejoin="round"/>
      <path d="m1-25 14 31 20-5L1-25Z" fill="#c47b52" transform="translate(0 14)"/>
      <path d="m0 40 7 3V23l-7-4v21Z" fill="#795333"/>
      <path d="m18 21 7-3v8l-7 3v-8Z" fill="#f1c768"/>
    </g>
    {[{ x: 34, y: 58, s: 0.8 }, { x: 98, y: 45, s: 0.9 }, { x: 203, y: 101, s: 0.8 }].map(({ x, y, s }) =>
      <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
        <ellipse cy="17" rx="15" ry="5" fill="#17382e25"/><path d="M0 17V-9" stroke="#8e6e45" strokeWidth="4"/>
        <path d="M-14-1q-6-16 8-23 9-11 18 0 15 5 6 23-14 12-32 0Z" fill="var(--world-foliage-mid, var(--leaf))"/>
        <path d="M-6-22Q9-35 16-17q6 11-2 15-14-2-20-20Z" fill="var(--world-foliage-light, var(--leaf-light))"/>
        {orchard && <><circle cx="-8" cy="-4" r="3" fill="#d4874d"/><circle cx="9" cy="-10" r="3" fill="#dba45e"/></>}
      </g>)}
    <g transform="translate(116 75) scale(.24)"><GuideCourier/></g>
    <path d="m35 108 3-6m5 9 3-7m126 17 3-6m6 2 3-6" stroke="var(--leaf)" strokeWidth="2" strokeLinecap="round"/>
    <path d="M113 17h22m-9 9h24" stroke="var(--edge-light)" strokeWidth="3" strokeLinecap="round"/>
  </svg>;
}

export function CompletionSeal({ perfect }: { perfect: boolean }) {
  const id = useId();
  return <svg className="completion-seal" width="64" height="64" viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <defs><linearGradient id={`${id}-metal`} x1="12" y1="8" x2="66" y2="68" gradientUnits="userSpaceOnUse">
      <stop stopColor={perfect ? '#fae9ad' : '#dbe6bd'}/><stop offset=".4" stopColor={perfect ? '#d4a84e' : '#88ab78'}/>
      <stop offset=".55" stopColor={perfect ? '#fff1be' : '#e5edcc'}/><stop offset="1" stopColor={perfect ? '#b78632' : '#64895f'}/>
    </linearGradient></defs>
    <path d="m20 56-3 22 14-6 9 5 2-19m18-3 3 23-14-6-9 5-2-19" fill={perfect ? '#cba762' : '#94b28b'} stroke="#fff8e7" strokeWidth="2"/>
    <circle cx="40" cy="36" r="32" fill={`url(#${id}-metal)`} stroke={perfect ? '#9a722e' : '#50704e'} strokeWidth="2"/>
    <circle cx="40" cy="36" r="28.5" stroke="#fff4d1" strokeOpacity=".8"/>
    <circle cx="40" cy="36" r="26" stroke="#fffaf0" strokeWidth="2" strokeDasharray="3 4"/>
    <path d="M19 45h12q8 0 8-9t9-9h13" stroke="#fff8e9" strokeWidth="7" strokeLinecap="round"/>
    <path d="M19 45h12q8 0 8-9t9-9h13" stroke={perfect ? '#aa8541' : '#6f9164'} strokeWidth="2" strokeLinecap="round"/>
    <path d="M14 47V36h12v11H14Zm40-18V18h12v11H54Z" fill="#fff5da"/>
    <path d="m11 37 9-8 9 8H11Zm40-18 9-8 9 8H51Z" fill="#4f785d"/>
    <path d="m29 22 6 6 11-12" stroke="#3d674d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

export function TileGlyph({ tile, trees = false }: { tile: Tile; trees?: boolean }) {
  const bridge = tile === 'h' || tile === 'v';
  return <svg className="tile-guide-glyph" width="40" height="40" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="30" height="30" rx="6"
      fill={tile === '~' || bridge ? 'var(--world-water, #236f7f)' : 'var(--world-grass, #426f46)'} stroke="var(--world-grass-deep, #386942)"/>
    {tile === 'o' && <><path d="M16 1v30M1 16h30" stroke="var(--world-road, #efd8a7)" strokeWidth="10"/>
      <rect x="6" y="6" width="20" height="20" rx="3" fill="var(--world-road, #efd8a7)" stroke="var(--world-mortar, #816849)"/>
      <path d="M6 13h20M6 20h20m-11-14v7m5 0v7m-6 0v6" stroke="var(--world-road-shade, #b59464)" strokeWidth="1.4"/></>}
    {tile === '~' && <path d="M5 11q4-4 8 0t8 0m-12 9q4-4 8 0t8 0" stroke="var(--world-foam, #d4eee2)" strokeWidth="1.5" strokeLinecap="round"/>}
    {tile === '.' && <path d="m7 22 2-6m4 7 2-8m5 8 2-6" stroke="var(--world-blade, #8cab61)" strokeWidth="1.8" strokeLinecap="round"/>}
    {tile === '.' && trees && <g data-rule-tree="true">
      <path d="M21 25V12m0 8-4-4m4 3 4-4" stroke="var(--world-wood-shade, #765331)" strokeWidth="2" strokeLinecap="round"/>
      <path d="M13 13q-2-5 3-7 1-6 7-4 6-1 6 6 4 5-2 8-7 3-14-3Z"
        fill="var(--world-blade, #8cab61)" stroke="var(--world-grass-deep, #386942)" strokeWidth="1"/>
    </g>}
    {tile === 'x' && <><path d="m9 5 14 2 5 11-6 9-14-1-5-9L9 5Z" fill="var(--world-rock, #87979d)" stroke="var(--world-rock-shade, #415663)"/>
      <path d="m9 5 8 10 6-8-14-2Z" fill="var(--world-rock-light, #d4d6cc)"/>
      <path d="m17 15 5 12 6-9-11-3Z" fill="var(--world-rock-shade, #415663)"/>
      <path d="m9 5 8 10-14 2m14-2 5 12" stroke="var(--world-rock-light, #d4d6cc)" strokeWidth=".8"/></>}
    {bridge && <g transform={tile === 'v' ? 'rotate(90 16 16)' : undefined}>
      <rect x="1" y="8" width="30" height="16" rx="2" fill="var(--world-wood-light, #edc688)" stroke="var(--world-wood-shade, #765331)" strokeWidth="2"/>
      <path d="M8 9v14m8-14v14m8-14v14" stroke="var(--world-wood, #c38d4c)"/>
      <g transform="translate(4 4)" stroke="#5b573f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths.bridge}</g>
    </g>}
    {isAnchor(tile) && <><rect x="8" y="13" width="16" height="14" rx="1" fill="#fff2db" stroke="#a99a7b"/>
      <path d="m6 14 10-9 10 9H6Z" fill={`var(--world-home-${tile.toLowerCase()})`}/><rect x="14" y="20" width="4" height="7" fill="#9c8259"/></>}
  </svg>;
}

export function TileGuide({ only }: { only?: readonly GuideTopic[] }) {
  const entries: { tiles: Tile[]; name: string; label: string; description: string }[] = [
    { tiles: ['o'], name: 'Paving', label: 'Moves', description: 'Walkable stone road. Connects on all four sides.' },
    { tiles: ['.', '~'], name: 'Grass, trees & water', label: 'Moves', description: 'Not walkable. Trees travel with the grass; water is exchanged, not erased.' },
    { tiles: ['x', 'A'], name: 'Boulders & homes', label: 'Fixed', description: 'Cannot move. Neither selected patch may include them.' },
    { tiles: ['h', 'v'], name: 'Wooden bridges', label: 'Straight only', description: 'Ends connect to roads or homes, in both directions. Cross along the planks, never sideways. Bridges move but do not rotate.' },
  ];
  return <section className="tile-guide" aria-label="Tile rules">
    <h3>Read the landscape.</h3>
    <div className="tile-guide-grid">{entries.filter((entry) => !only ||
      (only.includes('rocks') && entry.tiles.includes('x')) ||
      (only.includes('bridges') && entry.tiles.includes('h'))).map((entry) => <div className="tile-guide-item" key={entry.name}>
      <div className="tile-guide-pictures">{entry.tiles.map((tile) => <TileGlyph key={tile} tile={tile} trees={tile === '.'}/>)}</div>
      <div><h4>{entry.name} <span className={`tile-guide-tag ${entry.label === 'Fixed' ? 'fixed-tag' : ''}`}>{entry.label}</span></h4>
        <p>{entry.description}</p></div>
    </div>)}</div>
  </section>;
}

export function WalkthroughFeatures({ section, places }: { section: 'tools' | 'places'; places: number }) {
  const entries: { icon: IconName; title: string; text: string }[] = section === 'tools' ? [
    { icon: 'grid', title: '1. Choose a frame', text: 'Wide: start at the left tile. Tall: start at the top tile. Pieces do not rotate.' },
    { icon: 'swap', title: '2. Tap two patches', text: 'The outline shows the whole patch. Tap its starting square, then another matching patch. Both exchange places.' },
    { icon: 'check', title: 'Check before exchanging', text: 'Tap the same starting square again to clear a selection. Every completed exchange counts; there is no Undo.' },
  ] : [
    { icon: 'sun', title: 'One daily island', text: 'One shared UTC puzzle. Its countdown starts after this practice.' },
    { icon: 'trophy', title: 'Earn your comparison', text: 'Your first saved Daily finish counts. Fewest moves, then fastest time. Replays are unranked.' },
    { icon: 'map', title: `Practice: ${places} places`, text: 'Explore themed islands and improve your stars. Finish each island and meet its star goal to open the next.' },
    { icon: 'help', title: 'A guide nearby', text: 'Tap the top question mark to replay this walkthrough or read every tile rule.' },
  ];
  return <div className="tour-feature-grid">{entries.map((entry) =>
    <div className="tour-feature" key={entry.title}><span className="state-emblem"><Icon name={entry.icon} size={23}/></span>
      <div><h3>{entry.title}</h3><p>{entry.text}</p></div></div>)}</div>;
}

export const FLAT_AXES: FrameAxes = { col: { x: 1, y: 0 }, row: { x: 0, y: 1 } };

export function ShapeGlyph({ shape, axes = FLAT_AXES, tiles }: { shape: Shape; axes?: FrameAxes; tiles?: Tile[] }) {
  const scale = tiles ? 25 : 16;
  const point = (row: number, col: number) => ({
    x: (col * axes.col.x + row * axes.row.x) * scale,
    y: (col * axes.col.y + row * axes.row.y) * scale,
  });
  const corners = [point(0, 0), point(0, shape.cols), point(shape.rows, 0), point(shape.rows, shape.cols)];
  const left = Math.min(...corners.map((corner) => corner.x)) - 3;
  const top = Math.min(...corners.map((corner) => corner.y)) - 3;
  const width = Math.max(...corners.map((corner) => corner.x)) - left + 3;
  const height = Math.max(...corners.map((corner) => corner.y)) - top + 3;
  return <svg className={`shape-glyph ${tiles ? 'terrain-glyph' : ''}`} width={width} height={height}
    viewBox={`${left} ${top} ${width} ${height}`} fill="none" aria-hidden="true">
    {patchCells({ row: 0, col: 0 }, shape).map(({ row, col }, index) => {
      const polygon = [point(row + 0.06, col + 0.06), point(row + 0.06, col + 0.94),
        point(row + 0.94, col + 0.94), point(row + 0.94, col + 0.06)]
        .map((corner) => `${corner.x},${corner.y}`).join(' ');
      const tile = tiles?.[index];
      return <polygon key={index} points={polygon}
        fill={tile === '~' ? '#85c5cd' : tile === 'o' ? '#f1e5c7' : tiles ? '#adc58a' : 'currentColor'}
        fillOpacity={tiles ? 1 : 0.18} stroke={tiles ? '#6d7f65' : 'currentColor'} strokeWidth={1.4} strokeLinejoin="round"/>;
    })}
  </svg>;
}

type DialogKind = 'guide' | 'map' | 'erase';
const dialogIdentity: Record<DialogKind, { icon: IconName; label: string }> = {
  guide: { icon: 'book', label: 'FIELD GUIDE' },
  map: { icon: 'map', label: 'PRACTICE PLACES' },
  erase: { icon: 'lock', label: 'YOUR DATA' },
};

export function Modal({ title, children, onClose, wide = false, className = '', kind = 'guide', emblem, headerControl, eyebrow }: {
  title: string; children: ReactNode; onClose: () => void; wide?: boolean; className?: string; kind?: DialogKind; emblem?: ReactNode; headerControl?: ReactNode; eyebrow?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.scrollTo(0, 0);
    if (dialog?.classList.contains('walkthrough-dialog')) {
      dialog.querySelector<HTMLButtonElement>('.dialog-actions .primary-button')?.focus({ preventScroll: true });
    }
  }, [title]);
  const identity = dialogIdentity[kind];
  return <dialog ref={ref} className={`dialog dialog-${kind} ${wide ? 'dialog-wide' : ''} ${className}`} aria-labelledby={id}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <BotanicalFrame/>
    <div className={`dialog-heading ${headerControl ? 'has-control' : ''}`}>
      <span className="dialog-emblem">{emblem ?? <Icon name={identity.icon} size={25}/>}</span>
      <div className="dialog-title"><p className="eyebrow">{eyebrow ?? identity.label}</p><h2 id={id}>{title}</h2></div>
      {headerControl}
      <button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close"/></button>
    </div>
    {children}
  </dialog>;
}

export function GuideIllustration({ step }: { step: number }) {
  return <svg className="guide-picture" viewBox="0 0 150 100" fill="none" aria-hidden="true">
    <rect x="18" y="23" width="114" height="65" rx="10" fill="var(--world-soil, #8d6242)"/>
    <rect x="18" y="18" width="114" height="65" rx="10" fill="var(--world-grass-deep, #386942)" stroke="var(--world-soil-edge, #bd945e)"/>
    {Array.from({ length: 6 }, (_, index) => <g key={index} transform={`translate(${25 + index % 3 * 34} ${25 + Math.floor(index / 3) * 26})`}>
      <rect width="31" height="23" rx="4" fill={index === 2 ? 'var(--world-water, #236f7f)' : 'var(--world-grass, #426f46)'}/>
      {index === 2 ? <path d="M5 10q5-4 10 0t10 0" stroke="var(--world-foam, #d4eee2)" strokeWidth="1.5"/> :
        <><rect x="3" y="3" width="25" height="17" rx="2" fill="var(--world-road, #efd8a7)" stroke="var(--world-mortar, #816849)"/>
          <path d="M4 11h23M14 4v7m5 0v8" stroke="var(--world-road-shade, #b59464)" strokeWidth="1.2"/></>}
    </g>)}
    {step === 1 && <><rect x="22" y="21" width="68" height="31" rx="6" stroke="#fff7de" strokeWidth="6"/>
      <rect x="22" y="21" width="68" height="31" rx="6" stroke="#a9530b" strokeWidth="3"/>
      <path d="m43 27-9 9m0-7v7h7" stroke="#a9530b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></>}
    {step === 2 && <><path d="M42 38q28-20 62 15m-1-9 1 9-9-1" stroke="#fff7de" strokeWidth="6" strokeLinecap="round"/>
      <path d="M42 38q28-20 62 15m-1-9 1 9-9-1" stroke="#11649a" strokeWidth="2.5" strokeLinecap="round"/>
      <rect x="57" y="49" width="68" height="29" rx="6" stroke="#11649a" strokeDasharray="4 3" strokeWidth="2.5"/></>}
    {step === 3 && <><path d="M40 37h34v26h34" stroke="#f9edc8" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      {([{ x: 38, y: 37, label: 'A' }, { x: 72, y: 63, label: 'B' }, { x: 106, y: 63, label: 'C' }] as const).map((stop) =>
        <g key={stop.label} transform={`translate(${stop.x - 10} ${stop.y - 11.25}) scale(.625)`} style={{ color: `var(--world-home-${stop.label.toLowerCase()})` }}>
          <path d={HOME_PLAQUE_PATH} fill="var(--world-home-badge)" stroke="currentColor" strokeWidth="1.25"/>
          <path d={HOME_GLYPHS[stop.label]} fill="currentColor" fillRule="evenodd"/><path d={HOME_SPROUT_PATH} fill="currentColor"/>
        </g>)}</>}
  </svg>;
}
