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
  water: '#236f7f',
  waterLight: '#63aaa6',
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
  A: '#356d5c', B: '#b85b42', C: '#4f7c94',
  D: '#a67535', E: '#826084', F: '#b18331',
} as const;

const NIGHT: WorldPalette = {
  ...DAY,
  grass: '#2c533d', grassAlt: '#345b42', grassDeep: '#254b39', grassGold: '#3b5f40',
  blade: '#83ab77', soil: '#725842', soilEdge: '#a58254',
  road: '#e7cfa5', roadLight: '#fbe7be', roadShade: '#ac8d61', mortar: '#78674e',
  rock: '#78929e', rockLight: '#bfd2ce', rockShade: '#3a5368', moss: '#7d9b5b',
  water: '#205466', waterLight: '#4d9198', foam: '#bdded9', sea: '#285e65',
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
    grass: dark ? '#3a5336' : '#4c6330',
    grassAlt: dark ? '#425c3b' : '#556c35',
    grassDeep: dark ? '#304b32' : '#405b2e',
    grassGold: dark ? '#4a603b' : '#5a6931',
    blade: dark ? '#a6b36c' : '#a9b866',
    soil: dark ? '#78573c' : '#a17447',
    sea: dark ? '#345d57' : '#82aea0',
  };
  return palette;
}

export function worldCssVariables(theme: Theme, dark: boolean): CSSProperties & Record<`--world-${string}`, string> {
  return {
    ...Object.fromEntries(Object.entries(worldPalette(theme, dark)).map(([name, value]) =>
      [`--world-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value])),
    ...Object.fromEntries(Object.entries(HOME_COLORS).map(([name, value]) =>
      [`--world-home-${name.toLowerCase()}`, value])),
  };
}
