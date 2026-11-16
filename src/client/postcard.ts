import { walkable } from '../shared/rules.ts';
import type { Anchor, Board, Cell } from '../shared/types.ts';

const smooth = (value: number): number => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
};

export function parcelMotion(progress: number, side: number): { travel: number; lift: number; tilt: number } {
  const time = Math.max(0, Math.min(1, progress));
  const arc = time === 0 || time === 1 ? 0 : Math.sin(time * Math.PI);
  return { travel: smooth((time - 0.18) / 0.64), lift: arc * (side > 0 ? 0.80 : 1.12), tilt: arc === 0 ? 0 : arc * 0.035 * side };
}

export function postcardGarden(board: Board, cell: Cell): boolean {
  return board[cell.row]?.[cell.col] === '.' && [
    { row: -1, col: 0 }, { row: 1, col: 0 }, { row: 0, col: -1 }, { row: 0, col: 1 },
  ].some((step) => walkable(board[cell.row + step.row]?.[cell.col + step.col]));
}

export function villageProgress(elapsedMs: number, phase = 0): number {
  return smooth((elapsedMs - phase * 90) / 700);
}

export function communityCrowd(anchors: readonly Anchor[], participants: number | null): { anchor: Anchor; side: -1 | 1; phase: number }[] {
  if (participants === null) return [];
  if (!Number.isSafeInteger(participants) || participants < 0) throw new Error('The saved-finisher count is invalid.');
  const homes = [...new Set(anchors)].sort();
  return Array.from({ length: Math.min(participants, homes.length * 2) }, (_, index) => {
    const anchor = homes[index % homes.length];
    if (!anchor) throw new Error('The representative crowd is missing its home.');
    return { anchor, side: index < homes.length ? -1 : 1, phase: index % homes.length };
  });
}
