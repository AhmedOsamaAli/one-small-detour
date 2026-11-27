import type { Board, Cell, Swap } from '../shared/types.ts';
import { canTraverse, patchCells } from '../shared/rules.ts';

export interface Flower {
  x: number;
  z: number;
  scale: number;
  rotation: number;
  color: 0 | 1 | 2;
}

export function waterBanks(board: Board, cell: Cell) {
  // Keep each water square distinct without closing usable bridge ends.
  const bank = (row: number, col: number): boolean =>
    !canTraverse(board, cell, { row: cell.row + row, col: cell.col + col });
  return {
    west: bank(0, -1), east: bank(0, 1), south: bank(1, 0), north: bank(-1, 0),
    southwest: bank(1, -1), southeast: bank(1, 1), northwest: bank(-1, -1), northeast: bank(-1, 1),
  };
}

export function sceneryOrigins(size: number, moves: readonly Swap[]): number[] {
  if (!Number.isInteger(size) || size < 1) throw new Error('The scenery island size must be a positive whole number.');
  const origins = Array.from({ length: size * size }, (_, index) => index);
  for (const move of moves) {
    if (![move.rows, move.cols].every((span) => Number.isInteger(span) && span > 0) ||
        ![move.a, move.b].every((start) => Number.isInteger(start.row) && Number.isInteger(start.col) &&
          start.row >= 0 && start.col >= 0 && start.row + move.rows <= size && start.col + move.cols <= size)) {
      throw new Error('The scenery patch is outside its island.');
    }
    for (const { row, col } of patchCells({ row: 0, col: 0 }, move)) {
      const a = (move.a.row + row) * size + move.a.col + col;
      const b = (move.b.row + row) * size + move.b.col + col;
      const first = origins[a], second = origins[b];
      if (first === undefined || second === undefined) throw new Error('The scenery patch is missing a terrain identity.');
      origins[a] = second;
      origins[b] = first;
    }
  }
  return origins;
}

export function tileScenery(seed: number, origin: number): { flowers: Flower[]; fish: boolean; variant: number } {
  let value = (seed ^ Math.imul(origin + 1, 0x45d9f3b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  const planted = value % 5 < 2;
  const fish = value % 3 === 0, variant = value % 9;
  const random = (): number => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
  const flowers = planted ? Array.from({ length: 1 + (value >>> 8) % 3 }, (): Flower => {
    const colorChoice = random();
    return {
      x: (random() - 0.5) * 0.56, z: (random() - 0.5) * 0.56,
      scale: 0.72 + random() * 0.42, rotation: random() * Math.PI * 2,
      color: colorChoice < 1 / 3 ? 0 : colorChoice < 2 / 3 ? 1 : 2,
    };
  }) : [];
  return { flowers, fish, variant };
}
