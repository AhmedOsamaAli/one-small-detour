import type { Board } from './types.ts';
import { isAnchor, walkable } from './rules.ts';
import type { CampaignFrame } from './patchGeneration.ts';

export interface CurriculumBand {
  end: number;
  minimum: number;
  pairs: readonly number[];
  pressureCap: number;
  frames: readonly CampaignFrame[];
  skill: string;
}

export const PRACTICE_CURRICULUM: readonly CurriculumBand[] = [
  { end: 24, minimum: 3, pairs: [4, 5, 6, 7, 8], pressureCap: 10, frames: ['pair'], skill: 'Choose a whole source cut; protect the remaining pairs.' },
  { end: 96, minimum: 4, pairs: [7, 8, 9, 10, 11, 12, 13], pressureCap: 20, frames: ['pair', 'strip'], skill: 'Longer cargo and both bridge axes; retain the familiar pair frame.' },
  { end: 200, minimum: 4, pairs: [12, 13, 14, 16, 18, 20, 22], pressureCap: 36, frames: ['pair', 'strip', 'square'], skill: 'Square footprints and connected ordered-home choices.' },
  { end: 320, minimum: 5, pairs: [14, 16, 18, 20, 22, 25], pressureCap: 44, frames: ['pair', 'strip', 'square', 'ell'], skill: 'Concave L footprints and their untouched notch; combine known rules.' },
  { end: 460, minimum: 5, pairs: [16, 18, 20, 22, 25], pressureCap: 48, frames: ['pair', 'strip', 'square', 'ell'], skill: 'Prepare usable source parcels before repairing the road.' },
  { end: 600, minimum: 6, pairs: [18, 20, 22, 25], pressureCap: 52, frames: ['pair', 'strip', 'square', 'ell'], skill: 'Interacting home legs and recoverable tempting cuts.' },
  { end: 720, minimum: 6, pairs: [20, 22, 25], pressureCap: 56, frames: ['pair', 'strip', 'square', 'ell'], skill: 'Revisit every frame with denser route alternatives.' },
  { end: 840, minimum: 7, pairs: [20, 22, 25], pressureCap: 60, frames: ['pair', 'strip', 'square', 'ell'], skill: 'Combine source preparation, bridge axes and long home orders.' },
  { end: 940, minimum: 7, pairs: [22, 25], pressureCap: 64, frames: ['pair', 'strip', 'square', 'ell'], skill: 'Advanced combinations without larger move-count jumps.' },
  { end: 1000, minimum: 8, pairs: [22, 25], pressureCap: 68, frames: ['pair', 'strip', 'square', 'ell'], skill: 'A final synthesis of all four families; every road tile remains necessary.' },
];

export function structuralPuzzleIdentity(board: Board): { key: string; layout: string } {
  const size = board.length, relevant = board.flatMap((row, r) => [...row].flatMap((tile, c) =>
    walkable(tile) || isAnchor(tile) ? [{ row: r, col: c }] : []));
  let grid = board.map((row, r) => [...row].map((tile, c) => tile === '~' || tile === 'x' &&
    !relevant.some(cell => Math.abs(cell.row - r) + Math.abs(cell.col - c) <= 2) ? '.' : tile));
  const views: { key: string; layout: string }[] = [];
  for (let turn = 0; turn < 4; turn++) {
    for (const view of [grid, grid.map(row => [...row].reverse())]) {
      const cells = view.flatMap((row, r) => row.flatMap((tile, c) => tile !== '.' ? [{ row: r, col: c }] : []));
      if (!cells.length) throw new Error('A structural identity needs a landscape with homes or roads.');
      const top = Math.min(...cells.map(cell => cell.row)), bottom = Math.max(...cells.map(cell => cell.row));
      const left = Math.min(...cells.map(cell => cell.col)), right = Math.max(...cells.map(cell => cell.col));
      const cropped = view.slice(top, bottom + 1).map(row => row.slice(left, right + 1).join('')).join('/');
      views.push({ key: `${bottom - top + 1}x${right - left + 1}:${cropped}`, layout: view.map(row => row.join('')).join('/') });
    }
    grid = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => {
      const tile = grid[size - 1 - col]?.[row];
      if (!tile) throw new Error('The structural identity lost a landscape cell.');
      return tile === 'h' ? 'v' : tile === 'v' ? 'h' : tile;
    }));
  }
  views.sort((a, b) => a.key.localeCompare(b.key) || a.layout.localeCompare(b.layout));
  const first = views[0];
  if (!first) throw new Error('The landscape has no structural view.');
  return first;
}
