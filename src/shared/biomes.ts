import type { Theme } from './types.ts';

export const BIOMES: Readonly<Record<Theme, { name: string; flora: string; foliage: readonly [string, string, string] }>> = {
  meadow: { name: 'Meadow villages', flora: 'Clover, meadow flowers and broadleaf trees', foliage: ['#315938', '#597849', '#90aa60'] },
  coast: { name: 'Riverlands', flora: 'Reeds and coastal pines', foliage: ['#294e46', '#507468', '#85a58b'] },
  orchard: { name: 'Amber orchards', flora: 'Apple trees and orchard wildflowers', foliage: ['#6c5830', '#9d7b40', '#c4a259'] },
  winter: { name: 'Winter pines', flora: 'Snow-covered evergreen pines', foliage: ['#244c48', '#3f6b62', '#dce9e9'] },
  blossom: { name: 'Sakura gardens', flora: 'Flowering cherry trees and fallen pink petals', foliage: ['#a85e7d', '#d48fae', '#f4c8db'] },
  maple: { name: 'Crimson maple hills', flora: 'Japanese maple trees in autumn', foliage: ['#72292f', '#b74739', '#dc7952'] },
  ginkgo: { name: 'Golden ginkgo walk', flora: 'Ginkgo trees in golden autumn foliage', foliage: ['#94722d', '#c5a43d', '#efce64'] },
  lavender: { name: 'Lavender country', flora: 'Lavender flower rows and evergreen windbreaks', foliage: ['#375846', '#55775b', '#8ca074'] },
};

export const BIOME_ORDER: readonly Theme[] = ['meadow', 'coast', 'orchard', 'winter', 'maple', 'ginkgo', 'lavender'];
export const SEASONAL_DAILY_START = '2026-11-18';

function hash(value: number): number {
  let state = value >>> 0;
  state = Math.imul(state ^ state >>> 16, 0x45d9f3b);
  return (state ^ state >>> 16) >>> 0;
}

export function dailyLandscapeTheme(edition: string, previous: Theme): Theme {
  if (edition < SEASONAL_DAILY_START) return previous;
  const timestamp = Date.parse(`${edition}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== edition) throw new Error('The Daily theme needs a valid edition.');
  const day = Math.floor(timestamp / 86_400_000), block = Math.floor(day / BIOME_ORDER.length);
  const bag = (block: number): Theme[] => BIOME_ORDER.map((theme, index) => ({ theme, rank: hash(block * 97 + index * 1901) }))
    .sort((a, b) => a.rank - b.rank).map((value) => value.theme);
  const current = bag(block);
  if (current[0] === bag(block - 1).at(-1)) {
    const first = current[0], second = current[1];
    if (!first || !second) throw new Error('The Daily theme bag is empty.');
    [current[0], current[1]] = [second, first];
  }
  const theme = current[day % BIOME_ORDER.length];
  if (!theme) throw new Error('The Daily theme schedule is incomplete.');
  return theme;
}
