import type { Theme } from '../shared/types.ts';
import { PRACTICE_WORLD_SIZE } from '../shared/progression.ts';

export interface MapPoint { x: number; y: number }
export interface MapMetrics {
  width: number;
  rowGap: number;
  stopScale: number;
  margin: number;
  topInset: number;
  bottomInset: number;
}

export function mapMetrics(width: number): MapMetrics {
  const stopScale = Math.min(1.5, Math.max(1, width / 640));
  return {
    width, stopScale, rowGap: Math.min(156, Math.max(94, width * .16)),
    margin: Math.max(38 * stopScale, width * .14),
    topInset: Math.max(44, 35 * stopScale + 9),
    bottomInset: Math.max(60, 35 * stopScale + 25),
  };
}

export function mapNodePosition(index: number, { width, rowGap, margin }: MapMetrics): MapPoint {
  const world = Math.floor(index / PRACTICE_WORLD_SIZE), local = index % PRACTICE_WORLD_SIZE;
  const row = Math.floor(local / 3), column = row % 2 ? 2 - local % 3 : local % 3;
  return {
    x: margin + column * (width - margin * 2) / 2 + Math.sin(row * .9) * width * .012 +
      (column === 1 ? Math.sin(row * 1.1) * width * .035 : 0),
    y: (world * 9.2 + row + 1.5 + (column === 1 ? .16 : column === 0 ? -.12 : -.08)) * rowGap,
  };
}

export function islandOutline(width: number, height: number, index: number): string {
  const bend = Math.sin((index + 1) * 2.1), sway = Math.cos((index + 1) * 1.7);
  const l = width * .055, r = width * .945, dx = width * .018;
  return `M${width * .23} 22
    C${width * .36} ${3 + bend * 8} ${width * .67} ${12 - bend * 7} ${width * .79} 27
    C${r + dx} 42 ${r - dx} ${height * .13} ${r} ${height * .22}
    C${r + dx * sway} ${height * .36} ${r - dx * 1.5} ${height * .38} ${r - dx * .5} ${height * .51}
    C${r + dx} ${height * .66} ${r - dx * sway} ${height * .72} ${r - dx} ${height * .83}
    C${r} ${height - 18} ${width * .75} ${height + 5} ${width * .59} ${height - 7}
    C${width * .45} ${height - 22} ${width * .28} ${height + 7} ${width * .17} ${height - 24}
    C${l - dx} ${height - 39} ${l + dx} ${height * .86} ${l} ${height * .76}
    C${l - dx * sway} ${height * .64} ${l + dx * 1.5} ${height * .61} ${l + dx * .5} ${height * .48}
    C${l - dx * .8} ${height * .34} ${l + dx * sway} ${height * .3} ${l} ${height * .2}
    C${l - dx} ${height * .1} ${l} 38 ${width * .23} 22Z`;
}

export function landscapeGrain(width: number, height: number, index: number): string {
  const marks: string[] = [], count = Math.min(180, Math.floor(width * height / 10_000));
  for (let mark = 0; mark < count; mark++) {
    const x = width * (.09 + ((mark * .618034 + index * .137) % 1) * .82);
    const y = 80 + ((mark * .414214 + index * .193) % 1) * (height - 110);
    marks.push(`M${x.toFixed(1)} ${y.toFixed(1)}l${mark % 2 ? '1.8 .7' : '2 -.6'}`);
  }
  return marks.join(' ');
}

export function mapWaterRipples(width: number, height: number): string {
  const marks: string[] = [];
  for (let row = 0; row * 170 < height; row++) for (let col = 0; col * 190 < width; col++) {
    const x = col * 190 + 18 + Math.sin(row * 1.7 + col * 2.9) * 21;
    const y = row * 170 + 30 + col % 3 * 17;
    marks.push(`M${x.toFixed(1)} ${y}q10-5 22 0`);
  }
  return marks.join(' ');
}

export type LandscapeMotif = 'field' | 'mill' | 'pond' | 'grove' | 'ridge' | 'orchard' |
  'cherry' | 'maple' | 'ginkgo' | 'lavender' | 'lighthouse' | 'reeds' | 'pines' | 'snow-pines';
export interface LandscapeVignette extends MapPoint { kind: LandscapeMotif; width: number; height: number }

export const LANDSCAPE_EMBLEMS: Readonly<Record<Theme, LandscapeMotif>> = {
  meadow: 'mill', coast: 'lighthouse', orchard: 'orchard', winter: 'snow-pines',
  blossom: 'cherry', maple: 'maple', ginkgo: 'ginkgo', lavender: 'lavender',
};

const COMPOSITIONS: Readonly<Record<Theme, readonly LandscapeMotif[]>> = {
  meadow: ['field', 'mill', 'pond', 'grove', 'ridge', 'field'],
  coast: ['reeds', 'lighthouse', 'pond', 'ridge', 'grove', 'reeds'],
  orchard: ['orchard', 'pond', 'field', 'grove', 'ridge', 'orchard'],
  winter: ['snow-pines', 'ridge', 'pond', 'snow-pines', 'snow-pines', 'ridge'],
  blossom: ['cherry', 'pond', 'grove', 'field', 'ridge', 'cherry'],
  maple: ['maple', 'ridge', 'pond', 'grove', 'field', 'maple'],
  ginkgo: ['ginkgo', 'pond', 'field', 'ridge', 'grove', 'ginkgo'],
  lavender: ['lavender', 'mill', 'grove', 'pond', 'ridge', 'lavender'],
};

export function landscapeVignettes(theme: Theme, index: number, count: number, metrics: MapMetrics): LandscapeVignette[] {
  const { width, margin, rowGap, stopScale } = metrics;
  const columnGap = (width - margin * 2) / 2;
  const artWidth = Math.min(180, columnGap - 48 * stopScale - 16);
  if (artWidth < 28) return [];
  const nodes = Array.from({ length: count }, (_, local) => {
    const point = mapNodePosition(index * PRACTICE_WORLD_SIZE + local, metrics);
    return { x: point.x, y: point.y - index * 9.2 * rowGap };
  });
  const placed: LandscapeVignette[] = [], plan = COMPOSITIONS[theme];
  const clear = (art: LandscapeVignette): boolean => nodes.every((node) =>
    Math.abs(node.x - art.x) > art.width / 2 + 27 * stopScale + 5 ||
    art.y + art.height / 2 < node.y - 35 * stopScale - 7 ||
    art.y - art.height / 2 > node.y + metrics.bottomInset);
  const place = (kind: LandscapeMotif, x: number, y: number, w: number, h: number): void => {
    for (const size of [1, .82, .68]) {
      for (const shift of [0, -1, 1]) {
        const candidate = {
          kind, x: x + shift * width * .018, y, width: w * size, height: h * size,
        };
        if (candidate.x - candidate.width / 2 >= 0 && candidate.x + candidate.width / 2 <= width && clear(candidate)) {
          placed.push(candidate);
          return;
        }
      }
    }
  };
  const flora: LandscapeMotif = theme === 'winter' ? 'snow-pines' : theme === 'blossom' ? 'cherry' :
    theme === 'maple' ? 'maple' : theme === 'ginkgo' ? 'ginkgo' : theme === 'orchard' ? 'orchard' :
    theme === 'coast' || theme === 'lavender' ? 'pines' : 'grove';
  if (width >= 700) {
    place(flora, width * .28, rowGap * .76, Math.min(210, width * .24), rowGap * .43);
    place('ridge', width * .74, rowGap * .79, Math.min(210, width * .24), rowGap * .4);
  }
  for (let band = 0; band < Math.ceil(count / 3) - 1; band++) {
    const kind = plan[(band + index) % plan.length];
    if (!kind) throw new Error('The island landscape composition is incomplete.');
    const left = width * .25 + margin / 2, right = width * .75 - margin / 2;
    const pocket = (band + index) % 2 ? right : left;
    place(kind, pocket, (band + 2.04) * rowGap, artWidth, Math.min(rowGap * .52, artWidth * .74));
    if (width >= 700) {
      place(flora, pocket === left ? right : left, (band + 2.18) * rowGap, artWidth * .78, rowGap * .44);
      if (band % 2 === 0) place(theme === 'coast' ? 'reeds' : flora, margin * .62, (band + 2.04) * rowGap,
        Math.min(82, margin * .6), rowGap * .34);
    }
  }
  return placed;
}
