import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GRASS_COLORS, HOME_BADGE_BG, HOME_COLORS, worldCssVariables, worldPalette } from './worldTheme.ts';
import type { Theme } from '../shared/types.ts';

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
  const themes: Theme[] = ['meadow', 'coast', 'orchard'];
  for (const theme of themes) for (const dark of [false, true]) {
    const palette = worldPalette(theme, dark);
    for (const grass of GRASS_COLORS) {
      assert.ok(contrast(palette.road, palette[grass]) >= 3, `${theme}/${dark}: road against ${grass}`);
      assert.ok(contrast(palette.rockLight, palette[grass]) >= 3, `${theme}/${dark}: granite edge against ${grass}`);
    }
    assert.ok(contrast(palette.foam, palette.water) >= 3, `${theme}/${dark}: water marks`);
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
