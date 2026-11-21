import { createContext, useContext, useState } from 'react';
import { CRAFT_ASSETS } from './craftAssets.ts';

export const CraftArtContext = createContext(false);
export const useCraftArt = (): boolean => useContext(CraftArtContext);

export function CraftScene() {
  const [failed, setFailed] = useState(false);
  return <div className="craft-scene">
    {failed ? <p className="inline-error" role="alert">The preview picture could not load. Reload to try again.</p> :
      <img src={CRAFT_ASSETS.world} width="720" height="420" alt="" decoding="async" onError={() => {
        console.error('The handmade welcome illustration could not load.');
        setFailed(true);
      }}/>}
  </div>;
}

export function CraftCourier({ portrait = false, onBoard = false, celebrating = false }: { portrait?: boolean; onBoard?: boolean; celebrating?: boolean }) {
  const [failed, setFailed] = useState(false);
  return failed ? <p className="inline-error" role="alert">The courier picture could not load. Reload to try again.</p> :
    <svg className={`guide-courier detailed-courier craft-courier ${portrait ? 'courier-portrait' : ''} ${celebrating ? 'craft-finish-courier' : ''}`}
      width="64" height="84" viewBox={portrait ? '35 0 186 166' : onBoard ? '48 0 160 256' : '0 0 256 256'} aria-hidden="true" focusable="false">
      <g className="craft-courier-direction"><g className="craft-courier-acting"><image className="craft-courier-sheet" href={CRAFT_ASSETS.actors} width="1536" height="256" onError={() => {
        console.error('The miniature courier artwork could not load.');
        setFailed(true);
      }}/></g></g>
    </svg>;
}

export function CraftFinishCourier() { return <CraftCourier celebrating/>; }
