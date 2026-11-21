import type { Theme } from '../shared/types.ts';

export type SurfacePoint = readonly [number, number];
export interface PavingStone { x: number; z: number; width: number; depth: number; turn: number; shade: number }
export type GroundMotif = 'clover' | 'shell' | 'apple' | 'snow' | 'maple' | 'ginkgo' | 'lavender';

export const STONE_OUTLINE: readonly SurfacePoint[] = [
  [-.42, -.5], [.33, -.48], [.49, -.31], [.47, .30],
  [.32, .48], [-.31, .50], [-.49, .31], [-.48, -.32],
];

export function pavingStones(variant: number): readonly PavingStone[] {
  const lean = variant % 3 - 1;
  return [
    { x: -.18, z: -.22, width: .39, depth: .29, turn: -.035 + lean * .025, shade: .96 },
    { x: .23, z: -.19, width: .32, depth: .35, turn: .028, shade: .89 },
    { x: -.23, z: .16, width: .29, depth: .40, turn: -.025, shade: .91 },
    { x: .16, z: .20, width: .43, depth: .32, turn: .035 - lean * .025, shade: 1 },
  ];
}

export const GROUND_MOTIFS: Readonly<Record<Theme, GroundMotif>> = {
  meadow: 'clover', coast: 'shell', orchard: 'apple', winter: 'snow',
  blossom: 'clover', maple: 'maple', ginkgo: 'ginkgo', lavender: 'lavender',
};

export function groundDetail(theme: Theme, variant: number): { motif: GroundMotif; x: number; z: number; turn: number } {
  return { motif: GROUND_MOTIFS[theme], x: (variant % 3 - 1) * .19, z: (Math.floor(variant / 3) - 1) * .17,
    turn: variant * .71 };
}
