import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GRASS_COLORS, HOME_BADGE_BG, HOME_COLORS, craftedSurroundings, craftedWorldPalette, isPaleGarden, worldCssVariables, worldPalette } from './worldTheme.ts';
import type { Theme } from '../shared/types.ts';
import { BIOME_ORDER } from '../shared/biomes.ts';

function luminance(hex: string): number {
  assert.match(hex, /^#[0-9a-f]{6}$/i);
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722;
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('all six home identities are distinct and their matching letters remain readable', () => {
  const colors = Object.values(HOME_COLORS);
  assert.equal(new Set(colors).size, 6);
  for (const [anchor, color] of Object.entries(HOME_COLORS)) {
    assert.ok(contrast(color, HOME_BADGE_BG) >= 4.5, `${anchor} badge contrast`);
    for (const dark of [false, true]) {
      const variables = worldCssVariables('meadow', dark);
      assert.equal(variables[`--world-home-${anchor.toLowerCase()}`], color);
      assert.equal(variables['--world-home-badge'], HOME_BADGE_BG);
    }
  }
});
test('stone roads, granite highlights and water marks remain distinct in every world palette', () => {
  const themes: readonly Theme[] = BIOME_ORDER;
  for (const theme of themes) for (const dark of [false, true]) {
    const palette = worldPalette(theme, dark);
    for (const grass of GRASS_COLORS) {
      assert.ok(contrast(palette.road, palette[grass]) >= 3, `${theme}/${dark}: road against ${grass}`);
      assert.ok(contrast(palette.rockLight, palette[grass]) >= 3, `${theme}/${dark}: granite edge against ${grass}`);
    }
    assert.ok(contrast(palette.foam, palette.water) >= 3, `${theme}/${dark}: water marks`);
  }
});

test('seasonal colour changes leave granite neutral rather than tinting it green, pink or gold', () => {
  for (const theme of BIOME_ORDER) for (const dark of [false, true]) {
    const palette = worldPalette(theme, dark);
    for (const role of ['rock', 'rockLight', 'rockShade'] as const) {
      const rgb = [1, 3, 5].map(offset => parseInt(palette[role].slice(offset, offset + 2), 16));
      assert.ok(Math.max(...rgb) - Math.min(...rgb) <= 20, `${theme}/${dark}: ${role} is not neutral granite/slate`);
    }
  }
});

test('paving keeps its own warm stone colour family instead of blending into granite in winter or blossoms', () => {
  const rgb = (color: string): number[] => [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
  for (const theme of BIOME_ORDER) for (const dark of [false, true]) {
    const palette = worldPalette(theme, dark), road = rgb(palette.road);
    const warmth = (road[0] ?? 0) - (road[2] ?? 0);
    assert.ok((road[0] ?? 0) > (road[1] ?? 0) && (road[1] ?? 0) > (road[2] ?? 0) && warmth >= 30,
      `${theme}/${dark}: paving lost its warm stone identity`);
    for (const role of ['rock', 'rockLight', 'rockShade'] as const) {
      const rock = rgb(palette[role]);
      assert.ok(warmth - ((rock[0] ?? 0) - (rock[2] ?? 0)) >= 40, `${theme}/${dark}: ${role} is too close to the paving colour family`);
    }
  }
});

test('Flat and 3D use the same complete terrain palette without changing its source', () => {
  for (const dark of [false, true]) {
    const before = { ...worldPalette('meadow', dark) };
    const style = worldCssVariables('meadow', dark);
    for (const [name, value] of Object.entries(before)) {
      const property = `--world-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
      assert.equal(style[property], value);
    }
    worldPalette('coast', dark);
    worldPalette('orchard', dark);
    assert.deepEqual(worldPalette('meadow', dark), before);
  }
});

test('both interface palettes meet normal-text contrast on their actual surface colours', () => {
  const css = readFileSync(new URL('./palette.css', import.meta.url), 'utf8');
  const blocks = [...css.matchAll(/:root(?:\[data-appearance="dark"\])?\s*\{([^}]+)\}/g)];
  assert.equal(blocks.length, 2);
  for (const [index, block] of blocks.entries()) {
    const tokens = Object.fromEntries([...(block[1] ?? '').matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)]
      .map((match) => [match[1], match[2]]));
    const pair = (foreground: string, background: string): void => {
      const a = tokens[foreground];
      const b = tokens[background];
      assert.ok(a && b, `Missing ${foreground}/${background}`);
      assert.ok(contrast(a, b) >= 4.5, `${index ? 'night' : 'day'}: ${foreground}/${background}`);
    };
    for (const text of ['ink', 'muted']) for (const surface of ['paper', 'surface', 'surface-raised', 'surface-soft', 'surface-selected']) {
      pair(text, surface);
    }
    pair('accent-ink', 'accent-bg');
    pair('error', 'danger-bg');
    pair('primary-ink', 'primary');
    pair('primary-ink', 'primary-light');
  }
});

test('the handcrafted palettes preserve terrain contrast and feed the same values to Flat and 3D', () => {
  for (const theme of BIOME_ORDER) for (const dark of [false, true]) {
    const palette = craftedWorldPalette(theme, dark), style = worldCssVariables(theme, dark, true);
    for (const role of GRASS_COLORS) {
      assert.ok(contrast(isPaleGarden(theme, dark) ? palette.mortar : palette.road, palette[role]) >= 3, `${theme}/${dark}: crafted road edge/${role}`);
      assert.ok(contrast(isPaleGarden(theme, dark) ? palette.rockShade : palette.rockLight, palette[role]) >= 3, `${theme}/${dark}: crafted rock edge/${role}`);
    }
    assert.ok(contrast(palette.foam, palette.water) >= 3, `${theme}/${dark}: crafted water marks`);
    assert.equal(style['--world-grass'], palette.grass);
    assert.equal(style['--world-road'], palette.road);
  }
});

test('seasonal surroundings keep live interface text readable while pale gardens use light paving with contrasting edges', () => {
  const css = readFileSync(new URL('./palette.css', import.meta.url), 'utf8');
  const blocks = [...css.matchAll(/:root(?:\[data-appearance="dark"\])?\s*\{([^}]+)\}/g)];
  for (const theme of BIOME_ORDER) for (const [index, block] of blocks.entries()) {
    const base = Object.fromEntries([...(block[1] ?? '').matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(match => [match[1], match[2]]));
    const tokens = { ...base, ...craftedSurroundings(theme, index === 1) };
    for (const text of ['--ink', '--muted', '--green']) for (const surface of ['--paper', '--surface', '--surface-raised', '--surface-soft', '--surface-selected']) {
      const foreground = tokens[text], background = tokens[surface];assert.ok(foreground && background);
      assert.ok(contrast(foreground, background) >= 4.5, `${theme}/${index}: ${text}/${surface}`);
    }
    for (const button of ['--primary', '--primary-light']) {
      const foreground = tokens['--primary-ink'], background = tokens[button];assert.ok(foreground && background);
      assert.ok(contrast(foreground, background) >= 4.5, `${theme}/${index}: primary label`);
    }
  }
  const garden = craftedWorldPalette('lavender', false);
  assert.ok(luminance(garden.grass) > .4 && luminance(garden.road) > .8);
  assert.ok(contrast(garden.mortar, garden.road) >= 3);
});
