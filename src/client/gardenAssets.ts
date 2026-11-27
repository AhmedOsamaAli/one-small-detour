import type { Theme } from '../shared/types.ts';
import { CRAFT_ASSETS } from './craftAssets.ts';

export const GARDEN_ASSETS = {
  village: new URL('./assets/garden/village.webp', import.meta.url).href,
  winterVillage: new URL('./assets/garden/winter-village.webp', import.meta.url).href,
  flora: new URL('./assets/garden/flora.webp', import.meta.url).href,
  courier: new URL('./assets/garden/courier.webp', import.meta.url).href,
  grass: new URL('./assets/garden/grass.webp', import.meta.url).href,
  stone: new URL('./assets/garden/stone.webp', import.meta.url).href,
  granite: new URL('./assets/garden/granite.webp', import.meta.url).href,
  earth: new URL('./assets/garden/earth.webp', import.meta.url).href,
  roof: new URL('./assets/garden/roof.webp', import.meta.url).href,
  plaster: new URL('./assets/garden/plaster.webp', import.meta.url).href,
} as const;
export type GardenAsset = keyof typeof GARDEN_ASSETS;
export type GardenImages = Readonly<Record<GardenAsset, HTMLImageElement>>;
export const GARDEN_TREE_CELL: Readonly<Record<Theme, number>> = {
  meadow: 0, coast: 1, orchard: 2, winter: 3, blossom: 4, maple: 5, ginkgo: 6, lavender: 7,
};

const pending = new Map<boolean, Promise<GardenImages>>();
const imageCache = new Map<string, Promise<HTMLImageElement>>();
export function loadArtworkImage(url: string, label: string): Promise<HTMLImageElement> {
  const existing = imageCache.get(url);
  if (existing) return existing;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      void image.decode().then(() => resolve(image), (cause: unknown) =>
        reject(new Error(`The detailed ${label} artwork could not decode. Check your connection and try again.`, { cause })));
    };
    image.onerror = () => reject(new Error(`The detailed ${label} artwork could not load. Check your connection and try again.`));
    image.src = url;
  }).catch((error: unknown) => {
    imageCache.delete(url);
    throw error;
  });
  imageCache.set(url, promise);
  return promise;
}

export function loadGardenImages(crafted = false): Promise<GardenImages> {
  const cached = pending.get(crafted);
  if (cached) return cached;
  const assets = crafted ? { village: CRAFT_ASSETS.village, winterVillage: CRAFT_ASSETS.winterVillage,
    flora: CRAFT_ASSETS.flora, courier: CRAFT_ASSETS.actors, grass: CRAFT_ASSETS.white, stone: CRAFT_ASSETS.white,
    granite: CRAFT_ASSETS.white, earth: CRAFT_ASSETS.white, roof: CRAFT_ASSETS.white, plaster: CRAFT_ASSETS.white } : GARDEN_ASSETS;
  const load = async (name: GardenAsset): Promise<readonly [GardenAsset, HTMLImageElement]> =>
    [name, await loadArtworkImage(assets[name], name === 'winterVillage' ? 'snow-roof cottage' : name)];
  const request = Promise.all((Object.keys(GARDEN_ASSETS) as GardenAsset[]).map(load)).then((entries) => {
    const result = Object.fromEntries(entries);
    for (const name of Object.keys(GARDEN_ASSETS) as GardenAsset[]) if (!result[name]) throw new Error(`Missing detailed artwork: ${name}`);
    return result as Record<GardenAsset, HTMLImageElement>;
  }).catch((error: unknown) => { pending.delete(crafted);throw error; });
  pending.set(crafted, request);
  return request;
}

export function gardenFlowerCell(theme: Theme, variant: number): number {
  if (theme === 'winter' || theme === 'coast') return 11;
  if (theme === 'ginkgo' || theme === 'maple') return 10;
  if (theme === 'blossom' || theme === 'lavender') return variant % 2 ? 9 : 8;
  return [8, 10, 9][variant % 3] ?? 8;
}
