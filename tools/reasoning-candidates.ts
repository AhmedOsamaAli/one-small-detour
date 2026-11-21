import { randomSource, seedOf } from '../src/shared/generation.ts';
import { applySwap, checkPuzzle, legalSwaps, MAX_EXCHANGES, patchCells, RuleError } from '../src/shared/rules.ts';
import { certifyRepairSearch } from '../src/shared/repairSearch.ts';
import { probeReasoningGreedy, reasoningGreedyRejection, reasoningQuality, reasoningRejection } from '../src/shared/reasoningQuality.ts';
import type { AuthoredPuzzle, Board, Cell, PatchFamily, Tile } from '../src/shared/types.ts';
import type { ReasoningQuality } from '../src/shared/reasoningQuality.ts';

export type Candidate = { status: 'accepted'; puzzle: AuthoredPuzzle; quality: ReasoningQuality; expanded: number } |
  { status: 'rejected'; reason: string };

export function reasoningCandidate(seed: number, frame: PatchFamily | undefined, tier: number, size: 6 | 8 = 6, trial = 0, scrambleDepth?: number): Candidate {
  if (scrambleDepth !== undefined && (!Number.isInteger(scrambleDepth) || scrambleDepth < 1 || scrambleDepth > 10)) {
    throw new Error('The reasoning scramble depth must be a whole number from one through ten.');
  }
  const random = randomSource(seedOf(`detour:reasoning-v1:${seed}:${frame ?? 'pair'}:${size}`));
  const targetLength = (size === 6 ? 12 : 18) + Math.floor(random() * (size === 6 ? 8 : 10));
  const path: Cell[] = [], used = new Set<number>();let explored = 0;
  const visit = (): boolean => {
    const cell = path.at(-1), first = path[0];
    if (!cell || !first) throw new Error('The reasoning route lost its start.');
    if (path.length >= targetLength) return Math.abs(first.row - cell.row) + Math.abs(first.col - cell.col) >= 4;
    if (++explored > 1500) return false;
    const choices = [{ row: cell.row - 1, col: cell.col }, { row: cell.row + 1, col: cell.col },
      { row: cell.row, col: cell.col - 1 }, { row: cell.row, col: cell.col + 1 }]
      .filter(next => next.row >= 0 && next.col >= 0 && next.row < size && next.col < size && !used.has(next.row * size + next.col))
      .map(next => ({ next, order: random() })).sort((a, b) => a.order - b.order);
    for (const { next } of choices) {
      path.push(next);used.add(next.row * size + next.col);
      if (visit()) return true;
      path.pop();used.delete(next.row * size + next.col);
    }
    return false;
  };
  const start = { row: Math.floor(random() * size), col: Math.floor(random() * size) };
  path.push(start);used.add(start.row * size + start.col);
  if (!visit()) return { status: 'rejected', reason: 'route-search-limit' };
  const grid: Tile[][] = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) =>
    used.has(row * size + col) ? 'o' : random() < .48 ? 'x' : random() < .13 ? 'o' : '.'));
  const journey = seed % 3 === 0 ? ['A', 'B', 'C', 'D'] as const : ['A', 'B', 'C'] as const;
  for (let index = 1; index < path.length - 1; index++) {
    const cell = path[index], before = path[index - 1], after = path[index + 1];
    if (!cell || !before || !after) throw new Error('The reasoning route lost a square.');
    if (random() < .2) {
      const line = grid[cell.row];if (!line) throw new Error('The reasoning bridge left its island.');
      if (before.row === after.row) line[cell.col] = 'h';
      else if (before.col === after.col) line[cell.col] = 'v';
    }
  }
  journey.forEach((anchor, index) => {
    const cell = path[Math.round(index * (path.length - 1) / (journey.length - 1))];
    if (!cell) throw new Error('The reasoning route lost a home.');
    const line = grid[cell.row];if (!line) throw new Error('The reasoning home left its island.');
    line[cell.col] = anchor;
  });
  let board: Board = grid.map(row => row.join(''));
  const area = frame === 'strip' ? 3 : frame ? 4 : 2;
  const rules = { areas: [area], budget: MAX_EXCHANGES, ...(frame ? { frame } : {}) };
  const moves = legalSwaps(board, area, frame);
  if (moves.length < 8 || moves.length > (frame ? 95 : 180)) return { status: 'rejected', reason: 'patch-choice-range' };
  const footprints = moves.map(move => new Set([...patchCells(move.a, move), ...patchCells(move.b, move)].map(cell => cell.row * size + cell.col)));
  const depth = scrambleDepth ?? (tier === 1 ? 2 + seed % 2 : tier === 2 ? 3 + seed % 2 : tier === 3 ? 5 + seed % 2 : 7 + seed % 2);
  const corruption: number[] = [], states = new Set([board.join('/')]);
  const exchangeRandom = trial ? randomSource(seedOf(`detour:reasoning-v1:exchange:${seed}:${frame ?? 'pair'}:${size}:${trial}`)) : random;
  for (let step = 0; step < depth; step++) {
    const prior = corruption.at(-1), options = moves.map((move, index) => ({ move, index, order: exchangeRandom() }))
      .filter(({ index }) => prior === undefined || index !== prior && [...(footprints[index] ?? [])].some(cell => footprints[prior]?.has(cell)))
      .sort((a, b) => a.order - b.order);
    let selected = false;
    for (const item of options) {
      const next = applySwap(board, item.move, rules, step), key = next.join('/');
      if (states.has(key)) continue;
      states.add(key);board = next;corruption.push(item.index);selected = true;break;
    }
    if (!selected) return { status: 'rejected', reason: 'scramble-dead-end' };
  }
  let puzzle: AuthoredPuzzle = {
    id: `reasoning-candidate-${seed}`, title: 'The interwoven road', note: 'One road, every home. Plan what each exchange leaves behind.',
    board, area, budget: MAX_EXCHANGES, minimum: depth, chapter: 1, theme: 'meadow', journey,
    goals: journey.slice(1).map((to, index) => {
      const from = journey[index];if (!from) throw new Error('The reasoning journey lost a home.');
      return { from, to };
    }),
    witness: corruption.reverse().map(index => { const move = moves[index];if (!move) throw new Error('The reasoning scramble lost a move.');return move; }),
    ...(frame ? { frame } : {}),
  };
  try {
    if (checkPuzzle(board, puzzle).solved) return { status: 'rejected', reason: 'already-solved' };
    const quality = reasoningQuality(puzzle), reject = reasoningRejection(puzzle, quality, tier);
    if (reject) return { status: 'rejected', reason: reject };
    const proof = certifyRepairSearch(puzzle, tier >= 3 ? 2500 : 1500);
    if (proof.status === 'limit') return { status: 'rejected', reason: 'proof-limit' };
    puzzle = { ...puzzle, minimum: proof.minimum, witness: [...proof.witness] };
    if (proof.minimum < (tier === 1 ? 2 : tier === 2 ? 3 : 4)) return { status: 'rejected', reason: 'too-short' };
    const actual = reasoningQuality(puzzle), actualReject = reasoningRejection(puzzle, actual, tier);
    if (actualReject) return { status: 'rejected', reason: actualReject };
    if (tier >= 3) {
      const reject = reasoningGreedyRejection(puzzle, probeReasoningGreedy(puzzle), tier);
      if (reject) return { status: 'rejected', reason: reject };
    }
    return { status: 'accepted', puzzle, quality: actual, expanded: proof.expanded };
  } catch (error) {
    if (error instanceof RuleError && error.code === 'journey_complexity') return { status: 'rejected', reason: 'route-complexity' };
    throw error;
  }
}
