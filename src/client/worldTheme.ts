import type { Theme } from '../shared/types.ts';
import type { CSSProperties } from 'react';
import { BIOMES } from '../shared/biomes.ts';

export const COURIER_SCALE = 1.55;

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
  rock: '#909298',
  rockLight: '#d7d8d6',
  rockShade: '#50545b',
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
  winter: ['#c5b7df', '#f4ddb3', '#d8dfe8'],
  blossom: ['#f4b4d2', '#fbe5ed', '#dc88b4'],
  maple: ['#d57f5b', '#e6ae6e', '#b96858'],
  ginkgo: ['#e7c55b', '#f6dc8a', '#c99f43'],
  lavender: ['#d39eba', '#f0cadd', '#b792bd'],
};

const NIGHT: WorldPalette = {
  ...DAY,
  grass: '#2c533d', grassAlt: '#345b42', grassDeep: '#254b39', grassGold: '#3b5f40',
  blade: '#83ab77', soil: '#725842', soilEdge: '#a58254',
  road: '#e7cfa5', roadLight: '#fbe7be', roadShade: '#ac8d61', mortar: '#78674e',
  rock: '#969aa4', rockLight: '#cbd0d5', rockShade: '#4c535e', moss: '#7d9b5b',
  water: '#17465f', waterLight: '#62a9ba', foam: '#bdded9', sea: '#285e65',
  wood: '#b48b54', woodLight: '#dfbd84', woodShade: '#6e5338',
};

export function worldPalette(theme: Theme, dark: boolean): WorldPalette {
  const palette = dark ? NIGHT : DAY;
  if (theme === 'winter') return {
    ...palette,
    grass: dark ? '#80929e' : '#b8c5c6', grassAlt: dark ? '#7c8e9b' : '#b2c0c2',
    grassDeep: dark ? '#718696' : '#a7b8bd', grassGold: dark ? '#899ba5' : '#c3cecd',
    blade: dark ? '#6d8987' : '#829b90', soil: dark ? '#586575' : '#81929b',
    soilEdge: dark ? '#a6bdc9' : '#d7e4ea',
    road: dark ? '#3a2615' : '#684522', roadLight: dark ? '#765334' : '#a07a4d',
    roadShade: dark ? '#281a10' : '#49321f', mortar: dark ? '#a6b8bf' : '#cdd9d7',
    rock: '#646b74', rockLight: dark ? '#262931' : '#41444d',
    rockShade: '#383b44', moss: '#687a66', water: dark ? '#224963' : '#326a86',
    waterLight: dark ? '#79afc9' : '#a9d8e6', foam: '#edf7f6', sea: dark ? '#426b83' : '#96b8c7',
  };
  if (theme === 'blossom') return {
    ...palette,
    grass: dark ? '#a17b91' : '#e1bdce', grassAlt: dark ? '#947487' : '#d8afc3',
    grassDeep: dark ? '#8c6a7f' : '#cca4bc', grassGold: dark ? '#ac879b' : '#e7c7d4',
    blade: dark ? '#d2a8c1' : '#ad638b', soil: dark ? '#68515d' : '#aa7b8e',
    soilEdge: dark ? '#b293a8' : '#cfa0b6',
    road: dark ? '#362313' : '#624022', roadLight: dark ? '#775234' : '#9a704e',
    roadShade: dark ? '#271a11' : '#442f20', mortar: dark ? '#c1a8b3' : '#f6dce5',
    rock: '#75757a', rockLight: dark ? '#25262c' : '#45464c',
    rockShade: '#303139', water: dark ? '#274e6d' : '#426e8a', sea: dark ? '#4c697d' : '#adc0c5',
  };
  if (theme === 'maple') return {
    ...palette,
    grass: dark ? '#4f312a' : '#64402b', grassAlt: dark ? '#5b382c' : '#714b31',
    grassDeep: dark ? '#462d28' : '#573629', grassGold: dark ? '#62412d' : '#7b5030',
    blade: dark ? '#b36b4c' : '#cb8052', soil: dark ? '#5d4435' : '#876145',
    sea: dark ? '#325455' : '#8aa59a',
  };
  if (theme === 'ginkgo') return {
    ...palette,
    grass: dark ? '#42432c' : '#60552d', grassAlt: dark ? '#4b4b2d' : '#6b5e31',
    grassDeep: dark ? '#393d2a' : '#544d2a', grassGold: dark ? '#53502f' : '#746235',
    blade: dark ? '#b3aa65' : '#d5bb5f', soil: dark ? '#65513b' : '#957348',
    sea: dark ? '#4b625d' : '#9aac91',
  };
  if (theme === 'lavender') return {
    ...palette,
    grass: dark ? '#3d384b' : '#51475f', grassAlt: dark ? '#464053' : '#5a4d68',
    grassDeep: dark ? '#343345' : '#454154', grassGold: dark ? '#4a4358' : '#62536e',
    blade: dark ? '#ae9fc4' : '#c0a6d7', soil: dark ? '#5f4b51' : '#907277',
    sea: dark ? '#4b5e73' : '#9aafbf',
  };
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

export function craftedWorldPalette(theme: Theme, dark: boolean): WorldPalette {
  const original = worldPalette(theme, dark);
  if (theme === 'winter') return original;
  const grass: Readonly<Record<Theme, readonly [string, string, string, string]>> = {
    meadow: ['#657b55', '#6b805c', '#5f7652', '#707d53'],
    coast: ['#5c795f', '#657e65', '#55705b', '#697e5f'],
    orchard: ['#687a4e', '#6f7f55', '#617448', '#737e50'],
    winter: ['#b8c5c6', '#b2c0c2', '#a7b8bd', '#c3cecd'],
    blossom: ['#657b55', '#6b805c', '#5f7652', '#707d53'],
    maple: ['#81704d', '#887654', '#776849', '#8a7750'],
    ginkgo: ['#78764a', '#7f7b50', '#6f7046', '#7f7b4d'],
    lavender: ['#d6b7cd', '#dec4d7', '#c8a9c1', '#e6cfdf'],
  };
  const night: Readonly<Record<Theme, readonly [string, string, string, string]>> = {
    meadow: ['#435e4b', '#4b6552', '#3c5745', '#53694e'], coast: ['#355966', '#3e6370', '#30505e', '#466773'],
    orchard: ['#4b5e3a', '#536641', '#435635', '#5a6b45'], winter: grass.winter,
    blossom: ['#435e4b', '#4b6552', '#3c5745', '#53694e'],
    maple: ['#5d443c', '#664d42', '#523d36', '#6b5040'], ginkgo: ['#535536', '#5a5c3c', '#4b4e33', '#606140'],
    lavender: ['#4d4a62', '#55536b', '#454459', '#5d596e'],
  };
  const earth: Readonly<Record<Theme, readonly [string, string]>> = {
    meadow: ['#b49872', '#d2bc98'], coast: ['#b8a07b', '#d9c6a0'], orchard: ['#a98b64', '#cbb18a'],
    winter: ['#81929b', '#d7e4ea'], blossom: ['#b49872', '#d2bc98'],
    maple: ['#b08a68', '#d3b18a'], ginkgo: ['#b39a69', '#d7c18b'], lavender: ['#9a8d91', '#c8b7b4'],
  };
  const tones = dark ? night[theme] : grass[theme];
  const pale = isPaleGarden(theme, dark);
  return { ...original, grass: tones[0], grassAlt: tones[1], grassDeep: tones[2], grassGold: tones[3],
    blade: dark ? '#93aa82' : '#a9b687', soil: dark ? '#806a50' : earth[theme][0], soilEdge: dark ? '#b4976d' : earth[theme][1],
    road: pale ? '#fbf2df' : dark ? '#e2d0ad' : '#efdfbd', roadLight: pale ? '#fff8eb' : dark ? '#f0dfbd' : '#f8ebcf',
    roadShade: pale ? '#77506f' : dark ? '#aa9068' : '#b9a17c', mortar: pale ? '#77506f' : dark ? '#826f54' : '#a88f6d',
    rock: pale ? '#aaa7ae' : '#929994', rockLight: dark ? '#c7cecb' : '#d6d9d4', rockShade: pale ? '#655a68' : '#5d6864',
    water: dark ? '#2b566e' : '#497b8e', waterLight: dark ? '#7aa4b6' : '#9fc4c8',
    foam: dark ? '#d3e6df' : '#e5efe5', sea: pale ? '#c8b7d0' : dark ? '#416a70' : '#aac8be',
    wood: dark ? '#aa895e' : '#b89869', woodLight: dark ? '#dac09a' : '#e3ccaa', woodShade: '#806547' };
}

export function isPaleGarden(theme: Theme, dark: boolean): boolean {
  return theme === 'lavender' && !dark;
}

export function craftedSurroundings(theme: Theme, dark: boolean): Record<`--${string}`, string> {
  const daylight: Readonly<Record<Theme, readonly [string, string, string, string, string]>> = {
    meadow: ['#eef0e2', '#e3ece1', '#faf3df', '#f7dfa2', '#b6c8a9'],
    coast: ['#e9f1eb', '#dcecf0', '#fbf2df', '#e6efc5', '#a8c6ba'],
    orchard: ['#f3eddd', '#e7ecd8', '#fff0d6', '#f6d796', '#bdc49d'],
    winter: ['#e8eef0', '#dce8f1', '#f4f4ee', '#e4eff8', '#b1c6d1'],
    blossom: ['#eef0e2', '#e3ece1', '#faf3df', '#f7dfa2', '#b6c8a9'],
    maple: ['#f6eadb', '#f1dfcb', '#fff5e5', '#ffe0a6', '#d7b17e'],
    ginkgo: ['#f3efda', '#ede8cc', '#fff7df', '#fae7a9', '#cbc18e'],
    lavender: ['#f3e6ee', '#eadde9', '#fff4ef', '#fff1c8', '#d8b8ce'],
  };
  const mood = daylight[theme];
  const result: Record<`--${string}`, string> = {
    '--paper': dark ? theme === 'lavender' ? '#241f2b' : theme === 'maple' ? '#27211f' : '#17262c' : mood[0],
    '--sky-top': dark ? theme === 'lavender' ? '#342c43' : theme === 'maple' ? '#38302d' : '#203946' : mood[1],
    '--sky-bottom': dark ? '#111d25' : mood[2],
    '--sky-glow': dark ? '#cbd6c4' : mood[3],
    '--hill-far': dark ? '#375157' : mood[4],
  };
  if (theme === 'lavender') Object.assign(result, dark ? {
    '--surface': '#312b37', '--surface-raised': '#3a3242', '--surface-soft': '#362f3e', '--surface-selected': '#4a3b50',
    '--ink': '#faf0df', '--muted': '#d2c3cf', '--green': '#e3bad3', '--border-strong': '#a889a0', '--line': '#6f596d',
    '--primary': '#674b62', '--primary-light': '#7d5c74', '--primary-ink': '#fff9e6',
  } : {
    '--surface': '#fcf5f7', '--surface-raised': '#fffafd', '--surface-soft': '#eedce8', '--surface-selected': '#e3cadc',
    '--ink': '#493647', '--muted': '#6b5065', '--green': '#68405f', '--border-strong': '#98728e', '--line': '#d7bdcf',
    '--primary': '#704a69', '--primary-light': '#825c7b', '--primary-ink': '#fff9e6',
  });
  if (theme === 'maple' && !dark) Object.assign(result, {
    '--surface': '#fcf3e6', '--surface-raised': '#fffaf0', '--surface-soft': '#efdec7', '--surface-selected': '#e6ccac',
    '--ink': '#44382b', '--muted': '#6c5340', '--green': '#70492c', '--border-strong': '#9c7951', '--line': '#d1b695',
    '--primary': '#784d31', '--primary-light': '#865c3e', '--primary-ink': '#fff9e6',
  });
  return result;
}

export function craftLighting(theme: Theme, dark: boolean): { sun: string; sky: string; ground: string } {
  const sunlight: Readonly<Record<Theme, string>> = {
    meadow: '#ffe6bc', coast: '#ecf2e7', orchard: '#ffe0aa', winter: '#dceaff',
    blossom: '#ffe6bc', maple: '#ffd9ad', ginkgo: '#fff0bd', lavender: '#ebe2ff',
  };
  return { sun: dark ? theme === 'winter' ? '#b8d5fa' : '#cbd8f3' : sunlight[theme],
    sky: dark ? theme === 'lavender' ? '#c1bfdf' : '#bfd1e7' : theme === 'winter' ? '#eaf2fa' : '#f0f3e7',
    ground: dark ? '#506459' : theme === 'coast' ? '#a0a58a' : theme === 'winter' ? '#899daa' : '#8c9877' };
}

export function worldCssVariables(theme: Theme, dark: boolean, crafted = false): CSSProperties & Record<`--${string}`, string> {
  return {
    '--world-home-badge': HOME_BADGE_BG,
    '--world-flower-one': FLOWER_COLORS[theme][0],
    '--world-flower-two': FLOWER_COLORS[theme][1],
    '--world-flower-three': FLOWER_COLORS[theme][2],
    '--world-foliage-deep': BIOMES[theme].foliage[0],
    '--world-foliage-mid': BIOMES[theme].foliage[1],
    '--world-foliage-light': BIOMES[theme].foliage[2],
    ...Object.fromEntries(Object.entries(crafted ? craftedWorldPalette(theme, dark) : worldPalette(theme, dark)).map(([name, value]) =>
      [`--world-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value])),
    ...Object.fromEntries(Object.entries(HOME_COLORS).map(([name, value]) =>
      [`--world-home-${name.toLowerCase()}`, value])),
    ...(crafted ? craftedSurroundings(theme, dark) : {}),
  };
}
