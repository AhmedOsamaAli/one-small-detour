import { createContext, useContext } from 'react';
import type { Theme } from '../shared/types.ts';
import { GARDEN_ASSETS, GARDEN_TREE_CELL, gardenFlowerCell } from './gardenAssets.ts';
import { useCraftArt } from './CraftArt.tsx';
import { CRAFT_ASSETS } from './craftAssets.ts';

export const GardenArtContext = createContext(false);
export const useGardenArt = (): boolean => useContext(GardenArtContext);

export function GardenArtDefinitions() {
  const crafted = useCraftArt();
  return <svg className="garden-art-definitions" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      {[false, true].flatMap(winter => Array.from({ length: 12 }, (_, cell) => {
        const size = winter || crafted ? 192 : 256;
        return <clipPath key={`${winter}-${cell}`} id={`garden-cottage-${winter ? 'snow' : 'day'}-${cell}`}>
          <rect x={cell % 4 * size} y={Math.floor(cell / 4) * size} width={size} height={size}/>
        </clipPath>;
      }))}
      {Array.from({ length: 12 }, (_, cell) => <clipPath key={cell} id={`garden-plant-${cell}`}>
        <rect x={cell % 4 * 256} y={Math.floor(cell / 4) * 256} width="256" height="256"/>
      </clipPath>)}
    </defs>
  </svg>;
}

export function GardenCottage({ variant, flat = false, winter = false, sprite = false, className = '' }: { variant: number; flat?: boolean; winter?: boolean; sprite?: boolean; className?: string }) {
  const crafted = useCraftArt();
  const cell = variant % 6 + (flat ? 6 : 0);
  const size = winter || crafted ? 192 : 256;
  const image = crafted ? winter ? CRAFT_ASSETS.winterVillage : CRAFT_ASSETS.village : winter ? GARDEN_ASSETS.winterVillage : GARDEN_ASSETS.village;
  if (sprite) return <span className={`garden-cottage cottage-sprite ${className}`} data-snow-roof={winter} aria-hidden="true">
    <span style={{ backgroundImage: `url("${image}")`, backgroundPosition: `${cell % 4 * 100 / 3}% ${Math.floor(cell / 4) * 50}%` }}/>
  </span>;
  const clip = `garden-cottage-${winter ? 'snow' : 'day'}-${cell}`;
  return <svg className={`garden-cottage ${className}`} viewBox={`${cell % 4 * size} ${Math.floor(cell / 4) * size} ${size} ${size}`}
    fill="none" overflow="hidden" data-snow-roof={winter} aria-hidden="true" focusable="false">
    <image href={image} width={size * 4} height={size * 3} clipPath={`url(#${clip})`}/>
  </svg>;
}

export function GardenPlant({ theme, flowers = false, variant = 0, className = '', delay }: {
  theme: Theme; flowers?: boolean; variant?: number; className?: string; delay?: number;
}) {
  const crafted = useCraftArt();
  const cell = flowers ? gardenFlowerCell(theme, variant) : GARDEN_TREE_CELL[theme];
  const clip = `garden-plant-${cell}`;
  return <svg className={`garden-plant ${className}`} viewBox={`${cell % 4 * 256} ${Math.floor(cell / 4) * 256} 256 256`}
    style={delay === undefined ? undefined : { animationDelay: `${delay}ms` }}
    overflow="hidden" aria-hidden="true" focusable="false">
    <image href={crafted ? CRAFT_ASSETS.flora : GARDEN_ASSETS.flora} width="1024" height="768" clipPath={`url(#${clip})`}/>
  </svg>;
}

export function HouseAddress({ children }: { children: string | number }) {
  return <span className={`house-address ${String(children).length > 3 ? 'address-long' : ''}`} aria-hidden="true"><span>{children}</span></span>;
}
