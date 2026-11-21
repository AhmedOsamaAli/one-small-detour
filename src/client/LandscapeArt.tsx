import type { Theme } from '../shared/types.ts';
import type { LandscapeMotif } from './adventureMapLayout.ts';
import { loadArtworkImage } from './gardenAssets.ts';
import { useCraftArt } from './CraftArt.tsx';
import { CRAFT_ASSETS } from './craftAssets.ts';
import { craftedWorldPalette } from './worldTheme.ts';

const SCENES = new URL('./assets/landscape/scenes.webp', import.meta.url).href;
const GROUND = new URL('./assets/landscape/ground.webp', import.meta.url).href;
const SCENE_CELLS: Readonly<Record<LandscapeMotif, number>> = {
  field: 0, mill: 1, pond: 2, grove: 3, ridge: 4, orchard: 5, maple: 6, ginkgo: 7,
  lavender: 8, lighthouse: 9, reeds: 10, 'snow-pines': 11, pines: 10, cherry: 3,
};
const GROUND_CELLS: Readonly<Record<Theme, number>> = {
  meadow: 0, coast: 1, orchard: 2, winter: 3, maple: 4, ginkgo: 5, lavender: 6, blossom: 0,
};
const ready = new Map<boolean, Promise<void>>();

export function loadLandscapeArt(crafted = false): Promise<void> {
  const cached = ready.get(crafted);
  if (cached) return cached;
  const request = Promise.all(crafted ? [loadArtworkImage(CRAFT_ASSETS.map, 'miniature landscape')] : [
    loadArtworkImage(SCENES, 'seasonal landscape'), loadArtworkImage(GROUND, 'landscape ground'),
  ]).then(() => undefined).catch((error: unknown) => { ready.delete(crafted);throw error; });
  ready.set(crafted, request);
  return request;
}

export function LandscapeDefinitions() {
  return <defs>{Array.from({ length: 16 }, (_, cell) => <clipPath key={cell} id={`journey-scene-${cell}`}>
    <rect x={cell % 4 * 256} y={Math.floor(cell / 4) * 192} width="256" height="192"/>
  </clipPath>)}</defs>;
}

function sceneCell(kind: LandscapeMotif, theme: Theme): number {
  if (theme === 'winter') return kind === 'pond' ? 13 : kind === 'ridge' ? 12 : 11;
  if (kind === 'ridge' && theme === 'coast') return 14;
  if (theme === 'lavender' && (kind === 'field' || kind === 'grove' || kind === 'pines')) return 8;
  if (kind === 'grove' || kind === 'pines' || kind === 'cherry') {
    if (theme === 'maple') return 6;
    if (theme === 'ginkgo') return 7;
    if (theme === 'orchard') return 5;
    if (theme === 'coast') return 14;
  }
  return SCENE_CELLS[kind];
}

export function LandscapeScene({ kind, theme, x = 0, y = 0, width, height, className = '' }: {
  kind: LandscapeMotif; theme: Theme; x?: number; y?: number; width: number; height: number; className?: string;
}) {
  const crafted = useCraftArt();
  const cell = sceneCell(kind, theme);
  const clip = `journey-scene-${cell}`;
  return <svg className={`landscape-scene ${className}`} x={x} y={y} width={width} height={height}
    viewBox={`${cell % 4 * 256} ${Math.floor(cell / 4) * 192} 256 192`} overflow="hidden"
    data-scenic-vignette={kind} data-landscape-cell={cell} aria-hidden="true" focusable="false">
    <image href={crafted ? CRAFT_ASSETS.map : SCENES} width="1024" height="768" clipPath={`url(#${clip})`}/>
  </svg>;
}

export function LandscapeGround({ theme, width, height, index, dark }: { theme: Theme; width: number; height: number; index: number; dark: boolean }) {
  const crafted = useCraftArt();
  if (crafted) {
    const palette = craftedWorldPalette(theme, dark);
    return <g className="landscape-ground" aria-hidden="true">
      <rect width={width} height={height} fill={palette.grass} opacity={dark ? .36 : .22} data-terrain-tile={index}/>
      <rect x="3" y="3" width={Math.max(0, width - 6)} height={Math.max(0, height - 6)} fill="none" stroke={palette.blade} opacity=".10" rx="26"/>
    </g>;
  }
  const cell = GROUND_CELLS[theme] + (dark ? 7 : 0), span = Math.max(160, Math.min(320, width * .52));
  const offsetX = index % 2 * span / 2, offsetY = index % 3 * span / 3;
  const pattern = `journey-ground-${index}`;
  return <g className="landscape-ground" aria-hidden="true">
    <defs><pattern id={pattern} patternUnits="userSpaceOnUse" x={-offsetX} y={-offsetY} width={span} height={span}
      viewBox={`${cell % 4 * 256 + 16} ${Math.floor(cell / 4) * 256 + 16} 224 224`} preserveAspectRatio="none" overflow="hidden">
      <image href={GROUND} width="1024" height="1024"/>
    </pattern></defs>
    <rect width={width} height={height} fill={`url(#${pattern})`} data-terrain-tile={index}/>
  </g>;
}
