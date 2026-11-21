import { pavingStones, STONE_OUTLINE } from './craftSurface.ts';
import type { GroundMotif } from './craftSurface.ts';

export function CraftTerrainDefinitions() {
  return <svg width="0" height="0" className="garden-art-definitions" aria-hidden="true" focusable="false"><defs>
    <linearGradient id="craft-stone-paint" x1="0" y1="0" x2="1" y2="1">
      <stop stopColor="var(--world-road-light)"/><stop offset="1" stopColor="var(--world-road)"/>
    </linearGradient>
    <linearGradient id="craft-rock-paint" x1="0" y1="0" x2="1" y2="1">
      <stop stopColor="var(--world-rock-light)"/><stop offset=".58" stopColor="var(--world-rock)"/><stop offset="1" stopColor="var(--world-rock-shade)"/>
    </linearGradient>
  </defs></svg>;
}

export function CraftPaving({ variant }: { variant: number }) {
  return <svg className="flat-stone craft-paving" viewBox="-.5 -.5 1 1" aria-hidden="true" focusable="false">
    {pavingStones(variant).map((stone, index) => <g key={index} transform={`translate(${stone.x} ${stone.z}) rotate(${-stone.turn * 180 / Math.PI})`}>
      <polygon points={STONE_OUTLINE.map(([x, z]) => `${x * stone.width},${z * stone.depth + .024}`).join(' ')} fill="var(--world-road-shade)"/>
      <polygon points={STONE_OUTLINE.map(([x, z]) => `${x * stone.width},${z * stone.depth}`).join(' ')}
        fill="url(#craft-stone-paint)" stroke="var(--world-road-shade)" strokeWidth=".018"/>
      <path d={`M${-.31 * stone.width} ${-.39 * stone.depth}L${.25 * stone.width} ${-.39 * stone.depth}`}
        stroke="var(--world-road-light)" strokeWidth=".015" strokeLinecap="round"/>
    </g>)}
  </svg>;
}

export function CraftRock() {
  return <svg className="flat-rock craft-rock" viewBox="-.5 -.5 1 1" aria-hidden="true" focusable="false">
    <ellipse cx="0" cy=".31" rx=".43" ry=".12" fill="#243d3433"/>
    <path d="M-.39.12Q-.44-.12-.20-.32Q-.05-.44.23-.29Q.42-.18.40.11L.25.34-.23.32Z" fill="url(#craft-rock-paint)" stroke="var(--world-rock-shade)" strokeWidth=".045"/>
    <path d="M-.20-.32.02-.09.23-.29M.02-.09.25.34" fill="none" stroke="var(--world-rock-light)" strokeOpacity=".35" strokeWidth=".018" strokeLinejoin="round"/>
  </svg>;
}

export function CraftGroundDetail({ motif, turn }: { motif: GroundMotif; turn: number }) {
  return <svg className={`craft-ground-detail motif-${motif}`} viewBox="-12 -12 24 24" aria-hidden="true" focusable="false"
    style={{ transform: `rotate(${turn * 180 / Math.PI}deg)` }}>
    {motif === 'maple' ? <path d="m0 9-1-5-7 1 2-4-4-3 6-1-1-6 5 3 5-3-1 6 6 1-4 3 2 4-7-1-1 5Z" fill="#df934b"/> :
      motif === 'ginkgo' ? <path d="m0 9-9-13q3-8 9-3 6-5 9 3L0 9Z" fill="#ddc27b"/> :
        motif === 'shell' ? <><path d="M-9 4Q-10-9 0-9T9 4L3 7H-3Z" fill="#e3d5b8" stroke="#bfa886"/><path d="m0 6-5-12m5 12V-8m0 14L5-6" stroke="#bfa886" strokeWidth="1.2"/></> :
          motif === 'apple' ? <><path d="M0-6q10-4 8 5-1 10-8 7-7 3-8-7-2-9 8-5Z" fill="#be7758"/><path d="M0-5q0-6 6-5" fill="none" stroke="#a2b17a" strokeWidth="2"/></> :
            motif === 'snow' ? <ellipse rx="11" ry="6" fill="#e6eeee"/> :
              motif === 'lavender' ? <><path d="M-5 9V-7M1 9V-9M6 9V-5" stroke="#789774" strokeWidth="1.3"/>{[-5, 1, 6].map((x, index) => <ellipse key={x} cx={x} cy={-4 - index % 2 * 3} rx="2.5" ry="5" fill="#b4a1c6"/>)}</> :
                <g fill="#a2b880"><ellipse cx="-4" cy="-2" rx="5" ry="3"/><ellipse cx="4" cy="-2" rx="5" ry="3"/><ellipse cy="4" rx="3" ry="5"/></g>}
  </svg>;
}
