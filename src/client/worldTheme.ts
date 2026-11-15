import type { Theme } from '../shared/types.ts';
import type { CSSProperties } from 'react';

export const COURIER_SCALE = 1.35;

const DAY = {
  grass: '#355f3b',
  grassAlt: '#3d683e',
  grassDeep: '#2d5937',
  grassGold: '#456b3a',
  blade: '#8cab61',
  soil: '#8d6242',
  soilEdge: '#bd945e',
  road: '#efd8a7',
  roadLight: '#fff0cd',
  roadShade: '#b59464',
  mortar: '#816849',
  rock: '#87979d',
  rockLight: '#d4d6cc',
  rockShade: '#415663',
  moss: '#829e52',
  water: '#195b78',
  waterLight: '#70c1c6',
  foam: '#d4eee2',
  sea: '#72aba3',
  wood: '#c38d4c',
  woodLight: '#edc688',
  woodShade: '#765331',
};

export type WorldColor = keyof typeof DAY;
export type WorldPalette = Readonly<Record<WorldColor, string>>;
export const GRASS_COLORS = ['grass', 'grassAlt', 'grassDeep', 'grassGold'] as const;
export const HOME_COLORS = {
  A: '#2b6f53', B: '#ab4b2d', C: '#316c9a',
  D: '#74529a', E: '#a5476e', F: '#855d12',
} as const;
export const HOME_BADGE_BG = '#fff8e6';
export const FLOWER_COLORS: Record<Theme, readonly [string, string, string]> = {
  meadow: ['#ef8eaa', '#f4d36b', '#b6a4e6'],
  coast: ['#fff0c4', '#eaa27c', '#9ecbd6'],
  orchard: ['#f2b1c2', '#e9c66c', '#e58291'],
};

const NIGHT: WorldPalette = {
  ...DAY,
  grass: '#2c533d', grassAlt: '#345b42', grassDeep: '#254b39', grassGold: '#3b5f40',
  blade: '#83ab77', soil: '#725842', soilEdge: '#a58254',
  road: '#e7cfa5', roadLight: '#fbe7be', roadShade: '#ac8d61', mortar: '#78674e',
  rock: '#78929e', rockLight: '#bfd2ce', rockShade: '#3a5368', moss: '#7d9b5b',
  water: '#17465f', waterLight: '#62a9ba', foam: '#bdded9', sea: '#285e65',
  wood: '#b48b54', woodLight: '#dfbd84', woodShade: '#6e5338',
};

export function worldPalette(theme: Theme, dark: boolean): WorldPalette {
  const palette = dark ? NIGHT : DAY;
  if (theme === 'coast') return {
    ...palette,
    grass: dark ? '#2b5141' : '#356345',
    grassAlt: dark ? '#345b49' : '#3f6b47',
    grassDeep: dark ? '#234a3b' : '#2c5941',
    grassGold: dark ? '#3d6149' : '#476d44',
    soil: dark ? '#7a674c' : '#b28a58',
    sea: dark ? '#245c6b' : '#63a6b0',
  };
  if (theme === 'orchard') return {
    ...palette,
    grass: dark ? '#324a2e' : '#435a2a',
    grassAlt: dark ? '#3a5233' : '#4c622e',
    grassDeep: dark ? '#28432a' : '#385228',
    grassGold: dark ? '#425633' : '#515f2a',
    blade: dark ? '#a6b36c' : '#a9b866',
    soil: dark ? '#78573c' : '#a17447',
    sea: dark ? '#345d57' : '#82aea0',
  };
  return palette;
}

export function worldCssVariables(theme: Theme, dark: boolean): CSSProperties & Record<`--world-${string}`, string> {
  return {
    '--world-home-badge': HOME_BADGE_BG,
    '--world-flower-one': FLOWER_COLORS[theme][0],
    '--world-flower-two': FLOWER_COLORS[theme][1],
    '--world-flower-three': FLOWER_COLORS[theme][2],
    ...Object.fromEntries(Object.entries(worldPalette(theme, dark)).map(([name, value]) =>
      [`--world-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value])),
    ...Object.fromEntries(Object.entries(HOME_COLORS).map(([name, value]) =>
      [`--world-home-${name.toLowerCase()}`, value])),
  };
}
