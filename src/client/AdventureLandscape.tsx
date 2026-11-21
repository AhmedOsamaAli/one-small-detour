import { memo, useMemo } from 'react';
import type { Theme } from '../shared/types.ts';
import { islandOutline, landscapeGrain, landscapeVignettes } from './adventureMapLayout.ts';
import type { MapMetrics } from './adventureMapLayout.ts';
import { useGardenArt } from './GardenArt.tsx';
import { LandscapeGround, LandscapeScene } from './LandscapeArt.tsx';

export const AtlasDefinitions = memo(function AtlasDefinitions() {
  return <defs>
    <g id="atlas-tree">
      <ellipse cy="15" rx="19" ry="7" className="atlas-object-shadow"/>
      <path d="M0 16V-24m0 22-12-11m12 3 11-13" className="atlas-trunk"/>
      <path d="M-23-15q-6-14 8-21-1-17 16-17 14-9 22 9 15 6 7 22-2 14-19 17-22 8-34-10Z" className="atlas-leaf"/>
      <path d="M-13-34q-3-15 13-15 13-7 18 7 12 4 8 15-17 9-39-7Z" className="atlas-leaf-light"/>
      <path d="m0 3-1-21m0 5-9-9m9 2 9-9" className="atlas-fine-branch"/>
      <path d="m-14-8 7 5m18-6 8-4" className="atlas-leaf-detail"/>
    </g>
    <g id="atlas-pine">
      <ellipse cy="14" rx="18" ry="6" className="atlas-object-shadow"/>
      <path d="M0 14v-41" className="atlas-trunk"/>
      <path d="m0-60-17 29h7L-25-5h10L-30 14h60L15-5h10L10-31h7Z" className="atlas-leaf"/>
      <path d="m0-60-11 24h10L-15-9H0L-14 9h33L6-12h9L3-34h7Z" className="atlas-leaf-light"/>
      <path d="m0-60-12 24h24Zm-2 28L-18-8h32ZM0-7-21 12h38Z" className="atlas-snow"/>
    </g>
    <g id="atlas-cherry-tree">
      <ellipse cy="15" rx="24" ry="7" className="atlas-object-shadow"/>
      <path d="M0 16V-13m0 9-15-18M0-5l15-22" className="atlas-trunk"/>
      <path d="M-29-19q-9-14 7-24 0-13 18-12 13-16 25-2 19-1 20 17 17 12 0 25-26 13-50-4Z" className="atlas-leaf"/>
      <path d="M-23-37q4-14 18-12 13-12 23-1 16-2 17 12-17 14-40 7Z" className="atlas-leaf-light"/>
      <path d="m-19-24 3-4 4 4-4 3Zm17-18 3-4 4 4-4 4Zm21 14 3-4 4 4-4 3Z" className="atlas-petal"/>
      <path d="m-26 16 4 1m7 6 4-1m19 0 5 1m13-8 4 1" className="atlas-petal-stroke"/>
    </g>
    <g id="atlas-maple-tree">
      <ellipse cy="15" rx="22" ry="7" className="atlas-object-shadow"/>
      <path d="M0 16v-42m0 19-15-15M0-9l16-18" className="atlas-trunk"/>
      <path d="m0-61 8 12 12-6 2 13 15 3-8 13 8 10-17 6-7 13-14-5-13 6-9-13-15-4 8-12-7-14 17-3 3-13 12 7Z" className="atlas-leaf"/>
      <path d="m0-57 7 14 12-7 1 13 12 1-10 12-18 5-12-11-12 2 4-12 10 5Z" className="atlas-leaf-light"/>
      <path d="M0 1v-23m0 10-12-14M0-14l12-14" className="atlas-fine-branch"/>
      <path d="m-22 22 4-3 4 3m25-3 4-3 4 3" className="atlas-petal-stroke"/>
    </g>
    <g id="atlas-ginkgo-tree">
      <ellipse cy="15" rx="22" ry="7" className="atlas-object-shadow"/>
      <path d="M0 16v-40m0 16-14-15M0-7l15-19" className="atlas-trunk"/>
      <path d="M-2-7q-25 1-31-23-3-18 12-20 8-9 16-2 10-12 21-1 19 1 17 22Q27-8 7-5Z" className="atlas-leaf"/>
      <path d="M-18-43q-1-10 10-8 8-12 19-1 17-2 17 12-16 14-46-3Z" className="atlas-leaf-light"/>
      <path d="M-2-11-20-35M0-15l-1-28m5 32 17-25" className="atlas-leaf-detail"/>
      <path d="m-26 18 5 2m9 4 4-1m18-3 6 1" className="atlas-petal-stroke"/>
    </g>
    <g id="atlas-stone">
      <ellipse cy="9" rx="17" ry="6" className="atlas-object-shadow"/>
      <path d="m-17 3 6-17 17-5L20-4l-7 14-21 1Z" className="atlas-rock"/>
      <path d="m-11-14 17-5 3 15-26 7Z" className="atlas-rock-light"/>
      <path d="m9-4 11 0-7 14-7-4Z" className="atlas-rock-shade"/>
      <path d="m-10-12 15-4 6 8-22 4Z" className="atlas-snow"/>
    </g>
    <g id="atlas-reed">
      <path d="M0 11V-10m1 18L-9-4m9 8L9-9M-2-10v-9M9-9v-6" className="atlas-reed-stem"/>
      <path d="M-2-19v-7m11 11v-7" className="atlas-reed-head"/>
    </g>
    <g id="atlas-flower-tuft">
      <path d="M-5 7v-14M2 7V-2m5 7V-9" className="atlas-reed-stem"/>
      <path d="m-5-11 3 3-3 3-3-3Zm12-2 3 3-3 3-3-3ZM2-5 5-2 2 1-1-2Z" className="atlas-petal"/>
    </g>
    <symbol id="atlas-vignette-grove" viewBox="-73 -67 146 99">
      <path d="M-65 19q53-27 128-7-2 20-56 19-49 5-72-12Z" className="atlas-clearing"/>
      <use href="#atlas-tree" transform="translate(-29 -8) scale(.8)"/>
      <use href="#atlas-tree" transform="translate(29 -7) scale(.85)"/>
      <use href="#atlas-tree" transform="translate(-2 9)"/>
      <use href="#atlas-stone" transform="translate(49 18) scale(.5)"/>
      <use href="#atlas-flower-tuft" transform="translate(-46 20)"/>
    </symbol>
    <symbol id="atlas-vignette-field" viewBox="-80 -49 160 95">
      <path d="m-72-7 76-35 68 36-77 43Z" className="atlas-field-edge"/>
      <path d="m-67-11 71-32 64 34-74 39Z" className="atlas-field"/>
      <path d="m-52-5 70-30M-36 4 34-26M-20 13 51-18M-3 22 64-9" className="atlas-field-row"/>
      <path d="m-68-10 63 37 74-38" className="atlas-field-rim"/>
      <use href="#atlas-flower-tuft" transform="translate(-54 17)"/>
      <use href="#atlas-tree" transform="translate(49 11) scale(.7)"/>
    </symbol>
    <symbol id="atlas-vignette-mill" viewBox="-72 -80 144 114">
      <path d="M-61 21q55-33 119-5l-20 14-76 2Z" className="atlas-clearing"/>
      <ellipse cx="-5" cy="21" rx="34" ry="9" className="atlas-object-shadow"/>
      <path d="m-27 16 7-57 26 9 5 58Z" className="atlas-building"/>
      <path d="m6-32 18-11 4 58-17 11Z" className="atlas-building-side"/>
      <path d="m-25-41 22-20 30 18-21 12Z" className="atlas-roof"/>
      <path d="m-10 23 1-18 9 3v18m-10-62 9 3v10l-9-3Z" className="atlas-window"/>
      <g transform="translate(-6 -29)">
        <path d="m-26-26 53 53m-53 0 53-53" className="atlas-sail-frame"/>
        <path d="m-25-28 9 5 12 15-9-5ZM7 9l9 5 12 15-9-5ZM-27 24l5-9 15-12-5 9ZM9-7l5-9 15-12-5 9Z" className="atlas-sail"/>
        <circle r="4" className="atlas-window"/>
      </g>
      <use href="#atlas-stone" transform="translate(45 18) scale(.55)"/>
      <use href="#atlas-flower-tuft" transform="translate(-46 20)"/>
    </symbol>
    <symbol id="atlas-vignette-pond" viewBox="-85 -48 170 96">
      <path d="M-79 7q-18-31 34-37 34-22 79-2 56 7 44 38Q68 39 15 37-54 44-79 7Z" className="atlas-pond-bank"/>
      <path d="M-70 5q-15-24 28-29 37-19 75-1 44 7 34 31Q56 30 15 29-45 35-70 5Z" className="atlas-pond"/>
      <path d="M-50 5q15-9 31-2m31-19q14-5 29 1M-8 18q18-6 35-1" className="atlas-pond-ripple"/>
      <path d="m-25 9 11-4 9 5-10 4Z" className="atlas-lily"/>
      <use href="#atlas-reed" transform="translate(-55 -4)"/>
      <use href="#atlas-reed" transform="translate(-42 -15) scale(.8)"/>
      <use href="#atlas-stone" transform="translate(50 19) scale(.65)"/>
    </symbol>
    <symbol id="atlas-vignette-ridge" viewBox="-83 -59 166 100">
      <path d="m-78 20 30-45 22 17 30-47 33 37 39 35-57 18Z" className="atlas-hill-shadow"/>
      <path d="m-78 20 30-45 22 17 30-47 5 45-28 28Z" className="atlas-hill"/>
      <path d="m4-55 33 37 39 35-50 7L9-10Z" className="atlas-hill-light"/>
      <path d="m4-55-11 18 13-3 12 5Z" className="atlas-snow"/>
      <path d="m-42-9 13 15m30-30-6 16m28-1 15 12" className="atlas-hill-line"/>
      <use href="#atlas-pine" transform="translate(-52 28) scale(.5)"/>
      <use href="#atlas-stone" transform="translate(50 29) scale(.6)"/>
    </symbol>
    <symbol id="atlas-vignette-orchard" viewBox="-80 -72 160 113">
      <path d="m-73 7 70-34 75 33-72 35Z" className="atlas-field"/>
      <path d="m-54 11 68-32M-37 22 31-10M-19 32 48 0" className="atlas-field-row"/>
      <use href="#atlas-tree" transform="translate(0 -14) scale(.8)"/>
      <use href="#atlas-tree" transform="translate(-38 6) scale(.8)"/>
      <use href="#atlas-tree" transform="translate(35 8) scale(.85)"/>
      <path d="M-13-39a3 3 0 1 0 .1 0m-34 29a3 3 0 1 0 .1 0m73-14a3 3 0 1 0 .1 0m15 8a3 3 0 1 0 .1 0" className="atlas-fruit"/>
    </symbol>
    <symbol id="atlas-vignette-cherry" viewBox="-82 -73 164 112">
      <path d="M-72 22q57-29 139-8-12 27-66 23-50 3-73-15Z" className="atlas-petal-ground"/>
      <use href="#atlas-cherry-tree" transform="translate(30 -6) scale(.83)"/>
      <use href="#atlas-cherry-tree" transform="translate(-28 6)"/>
      <use href="#atlas-stone" transform="translate(44 24) scale(.65)"/>
      <path d="M-3 22q21-10 37-1m-58 9 8-2" className="atlas-petal-stroke"/>
    </symbol>
    <symbol id="atlas-vignette-maple" viewBox="-82 -78 164 116">
      <path d="M-73 23q63-31 144-7-17 23-65 20-55 5-79-13Z" className="atlas-petal-ground"/>
      <use href="#atlas-maple-tree" transform="translate(31 -9) scale(.85)"/>
      <use href="#atlas-maple-tree" transform="translate(-26 8)"/>
      <use href="#atlas-stone" transform="translate(44 26) scale(.65)"/>
    </symbol>
    <symbol id="atlas-vignette-ginkgo" viewBox="-82 -71 164 110">
      <path d="M-73 22q60-27 143-6-21 24-68 20-50 5-75-14Z" className="atlas-petal-ground"/>
      <use href="#atlas-ginkgo-tree" transform="translate(29 -7) scale(.85)"/>
      <use href="#atlas-ginkgo-tree" transform="translate(-28 6)"/>
      <use href="#atlas-flower-tuft" transform="translate(47 24)"/>
    </symbol>
    <symbol id="atlas-vignette-lavender" viewBox="-88 -52 176 105">
      <path d="m-80-4 79-43 80 42L1 44Z" className="atlas-field-edge"/>
      <path d="m-78-10 77-37 77 39L0 33Z" className="atlas-field"/>
      {[-1, 0, 1, 2].map((row) => <g key={row}>
        <path d={`m${-55 + row * 17} ${-4 + row * 9} 57-30`} className="atlas-lavender-shadow"/>
        <path d={`m${-55 + row * 17} ${-8 + row * 9} 57-30`} className="atlas-lavender"/>
        <path d={`m${-49 + row * 17} ${-10 + row * 9} 4-5m10-2 4-5m11-2 4-5m10-3 4-5`} className="atlas-lavender-tip"/>
      </g>)}
      <use href="#atlas-pine" transform="translate(62 23) scale(.7)"/>
    </symbol>
    <symbol id="atlas-vignette-lighthouse" viewBox="-78 -83 156 120">
      <path d="M-70 23q11-35 65-32 57-5 74 28-35 23-139 4Z" className="atlas-pond-bank"/>
      <use href="#atlas-stone" transform="translate(-48 17) scale(.7)"/>
      <ellipse cy="21" rx="23" ry="7" className="atlas-object-shadow"/>
      <path d="m-16 21 8-70 17-6 10 68L2 28Z" className="atlas-building"/>
      <path d="m9-55 10 68L2 28 2-50Z" className="atlas-building-side"/>
      <path d="m-12-20 25-5 2 14-28 6Z" className="atlas-roof"/>
      <path d="M-11-49v-15l13-5 14 7v15l-14 5Z" className="atlas-lantern"/>
      <path d="m-16-64 18-16 18 17-18 6Z" className="atlas-roof"/>
      <path d="m-1 27 1-15 7-2 1 13m-9-87v17m-11-2 14 5 14-5" className="atlas-window-line"/>
      <use href="#atlas-reed" transform="translate(45 23)"/>
    </symbol>
    <symbol id="atlas-vignette-reeds" viewBox="-82 -51 164 101">
      <path d="M-75 15q26-30 74-21 40-12 76 16-10 28-77 25-48 5-73-20Z" className="atlas-clearing"/>
      <path d="M-65 21q28-16 52-5m13 7q28-13 59-4" className="atlas-pond-ripple"/>
      <use href="#atlas-reed" transform="translate(-33 20) scale(1.6)"/>
      <use href="#atlas-reed" transform="translate(-4 8) scale(1.4)"/>
      <use href="#atlas-reed" transform="translate(20 23) scale(1.4)"/>
      <use href="#atlas-stone" transform="translate(48 25) scale(.8)"/>
      <path d="m22-27 9-3 8 4m-21-7 7-3 7 3" className="atlas-bird"/>
    </symbol>
    <symbol id="atlas-vignette-snow-pines" viewBox="-79 -79 158 115">
      <path d="M-72 22q50-32 143-6-3 22-69 19-48 7-74-13Z" className="atlas-snow-drift"/>
      <use href="#atlas-pine" transform="translate(-30 -5) scale(.85)"/>
      <use href="#atlas-pine" transform="translate(26 8)"/>
      <use href="#atlas-pine" transform="translate(-3 22) scale(.7)"/>
      <use href="#atlas-stone" transform="translate(-48 27) scale(.6)"/>
    </symbol>
    <symbol id="atlas-vignette-pines" viewBox="-79 -79 158 115">
      <path d="M-72 22q50-32 143-6-3 22-69 19-48 7-74-13Z" className="atlas-clearing"/>
      <use href="#atlas-pine" transform="translate(-30 -5) scale(.85)"/>
      <use href="#atlas-pine" transform="translate(26 8)"/>
      <use href="#atlas-pine" transform="translate(-3 22) scale(.7)"/>
      <use href="#atlas-stone" transform="translate(-48 27) scale(.6)"/>
    </symbol>
  </defs>;
});

interface LandscapeProps {
  theme: Theme;
  index: number;
  count: number;
  metrics: MapMetrics;
  dark: boolean;
}

export const WorldLandscape = memo(function WorldLandscape({ theme, index, count, metrics, dark }: LandscapeProps) {
  const garden = useGardenArt();
  const { width: w, rowGap } = metrics;
  const rows = Math.ceil(count / 3), height = (rows + 1.5) * rowGap;
  const land = useMemo(() => islandOutline(w, height, index), [w, height, index]);
  const grain = useMemo(() => landscapeGrain(w, height, index), [w, height, index]);
  const vignettes = useMemo(() => landscapeVignettes(theme, index, count, metrics), [theme, index, count, metrics]);
  const clip = `atlas-island-${index}`, gradient = `atlas-land-${index}`;
  const slope = (index % 3 - 1) * w * .035;
  return <>
    <defs>
      <linearGradient id={gradient} x1="0" y1="0" x2=".28" y2="1">
        <stop stopColor="var(--region-land-one)"/><stop offset="1" stopColor="var(--region-land-two)"/>
      </linearGradient>
      <clipPath id={clip}><path d={land}/></clipPath>
    </defs>
    <path d={land} className="atlas-island-shadow" transform="translate(0 13)"/>
    <path d={land} className="atlas-island-cliff" transform="translate(0 7)"/>
    <path d={land} className="atlas-island-beach"/>
    <path d={land} fill={`url(#${gradient})`} className="atlas-island-top" data-testid="connected-world-land"/>
    <g clipPath={`url(#${clip})`} className="atlas-terrain" data-testid="atlas-terrain">
      <path d={`M${-w * .08} 50Q${w * .4 + slope} 35 ${w * .34} ${height * .23}T${w * .49} ${height * .54}
        Q${w * .55} ${height * .79} ${w * .08} ${height + 28}H-30Z`} className="atlas-lowland"/>
      <path d={`M${w + 30} ${height * .19}Q${w * .57} ${height * .16} ${w * .62} ${height * .39}
        T${w * .62 + slope} ${height * .73}Q${w * .6} ${height * .91} ${w + 30} ${height + 5}Z`} className="atlas-upland"/>
      <path d={`M${-w * .05} ${height * .2}Q${w * .32} ${height * .05} ${w * .48} ${height * .2}
        T${w * 1.08} ${height * .16}M${-w * .07} ${height * .65}Q${w * .31} ${height * .48} ${w * .5} ${height * .63}
        T${w * 1.06} ${height * .57}`} className="atlas-contour"/>
      <path d={`M${-w * .04} ${height * .215}Q${w * .32} ${height * .067} ${w * .48} ${height * .215}
        T${w * 1.08} ${height * .175}M${-w * .07} ${height * .665}Q${w * .31} ${height * .497} ${w * .5} ${height * .645}
        T${w * 1.06} ${height * .587}`} className="atlas-contour-light"/>
      {theme === 'coast' && <>
        <path d={`M${w * .09} 50Q${w * .28} ${height * .23} ${w * .12} ${height * .39}T${w * .12} ${height * .76}
          Q${w * .23} ${height * .92} ${w * .06} ${height + 10}`} className="atlas-stream-bank"/>
        <path d={`M${w * .09} 50Q${w * .28} ${height * .23} ${w * .12} ${height * .39}T${w * .12} ${height * .76}
          Q${w * .23} ${height * .92} ${w * .06} ${height + 10}`} className="atlas-stream"/>
      </>}
      <path d={grain} className="atlas-ground-grain"/>
      {garden && <LandscapeGround theme={theme} width={w} height={height} index={index} dark={dark}/>}
      <path d={land} className="atlas-shore-highlight"/>
    </g>
    <g clipPath={`url(#${clip})`} className="atlas-scenery" data-testid="atlas-scenery">
      {vignettes.map((art, number) => garden ? <LandscapeScene key={number} kind={art.kind} theme={theme}
        x={art.x - art.width / 2} y={art.y - art.height / 2} width={art.width} height={art.height}/> :
        <use key={number} href={`#atlas-vignette-${art.kind}`} data-scenic-vignette={art.kind}
        x={art.x - art.width / 2} y={art.y - art.height / 2} width={art.width} height={art.height}/>)}
    </g>
  </>;
});
