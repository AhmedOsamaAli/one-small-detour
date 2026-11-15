import { applySwap, assertBoard, checkPuzzle, checkRoutes, legalSwaps, locate, rulesFor, validateRepair, walkable } from './rules.ts';
import type { Anchor, AuthoredPuzzle, Board, Goal, Puzzle, Swap } from './types.ts';

export function difficultyLabel(minimum: number | undefined): string {
  if (!minimum || minimum <= 1) return 'Warm-up';
  if (minimum === 2) return 'Thoughtful';
  if (minimum === 3) return 'Tricky';
  if (minimum === 4) return 'Challenging';
  return minimum === 5 ? 'Expert' : 'Master';
}

function missingPavingBetween(board: Board, from: Anchor, to: Anchor): number {
  const start = locate(board, from);
  const end = locate(board, to);
  if (!start || !end) throw new Error('Difficulty proof references a missing landmark.');
  const size = board.length;
  const count = size * size;
  const distances = Array<number>(count).fill(Infinity);
  const visited = new Uint8Array(count);
  let front = [start.row * size + start.col];
  const back: number[] = [];
  distances[start.row * size + start.col] = 0;
  while (front.length || back.length) {
    if (!front.length) {
      front = back.splice(0, back.length).reverse();
    }
    const best = front.pop();
    if (best === undefined || visited[best]) continue;
    const cost = distances[best] ?? Infinity;
    if (!Number.isFinite(cost)) break;
    if (best === end.row * size + end.col) return cost;
    visited[best] = 1;
    const row = Math.floor(best / size);
    const col = best % size;
    for (const [r, c] of [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
      if (r === undefined || c === undefined || r < 0 || c < 0 || r >= size || c >= size) continue;
      if (board[r]?.[c] === 'x') continue;
      const next = r * size + c;
      const paved = walkable(board[r]?.[c]);
      const candidate = cost + (paved ? 0 : 1);
      if (candidate < (distances[next] ?? Infinity)) {
        distances[next] = candidate;
        if (paved) front.push(next);
        else back.push(next);
      }
    }
  }
  throw new Error('Difficulty proof could not cross the landscape.');
}

// Every final trail needs at least this many initially unpaved cells. Exchanging
// two area-N patches can add at most N new paved cells, even when it also breaks
// existing roads. A matching legal witness makes the lower bound an exact minimum.
export function pavingLowerBound(board: Board, goals: readonly Goal[], journey?: readonly Anchor[]): number {
  let lower = 0;
  for (const goal of goals) {
    lower = Math.max(lower, missingPavingBetween(board, goal.from, goal.to));
    if (goal.via) {
      lower = Math.max(lower,
        missingPavingBetween(board, goal.from, goal.via),
        missingPavingBetween(board, goal.via, goal.to));
    }
  }
  if (journey && journey.length >= 2) {
    const first = journey[0];
    const last = journey.at(-1);
    if (first && last) lower = Math.max(lower, missingPavingBetween(board, first, last));
  }
  return lower;
}

export function certifyMinimum(puzzle: AuthoredPuzzle): number {
  assertBoard(puzzle.board);
  const minimum = Math.ceil(pavingLowerBound(puzzle.board, puzzle.goals, puzzle.journey) / puzzle.area);
  validateRepair(puzzle, 'daily', puzzle.witness);
  if (minimum >= 1 && minimum < puzzle.witness.length && puzzle.frame && puzzle.witness.length <= 3) {
    const swaps = legalSwaps(puzzle.board, puzzle.area, puzzle.frame);
    const rules = rulesFor(puzzle, 'daily');
    let frontier: Board[] = [puzzle.board];
    const seen = new Set([puzzle.board.join('/')]);
    for (let depth = 0; depth < puzzle.witness.length; depth++) {
      const next: Board[] = [];
      for (const board of frontier) {
        if (checkPuzzle(board, puzzle).solved) throw new Error(`${puzzle.id}: a shorter ${depth}-move repair exists.`);
        if (depth + 1 === puzzle.witness.length) continue;
        for (const move of swaps) {
          const candidate = applySwap(board, move, rules, depth);
          const key = candidate.join('/');
          if (seen.has(key)) continue;
          seen.add(key);
          if (seen.size > 20_000) throw new Error(`${puzzle.id}: the exact frame proof exceeded its verified search limit.`);
          next.push(candidate);
        }
      }
      frontier = next;
    }
    return puzzle.witness.length;
  }
  if (minimum < 1 || minimum !== puzzle.witness.length) {
    throw new Error(`${puzzle.id}: ${puzzle.witness.length} witness moves do not match the ${minimum}-move lower bound.`);
  }
  return minimum;
}

export function replayPuzzle(puzzle: Puzzle, moves: readonly Swap[]): Board {
  let board = puzzle.board;
  moves.forEach((move, used) => { board = applySwap(board, move, rulesFor(puzzle, 'daily'), used); });
  return board;
}

export function connectedDeliveries(board: Board, goals: readonly Goal[]): boolean[] {
  return goals.map((goal) => checkRoutes(board, [goal]).solved);
}
