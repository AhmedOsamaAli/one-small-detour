import { assertBoard, checkPuzzle, legalSwaps, patchCells, validateRepair } from './rules.ts';
import type { AuthoredPuzzle, Board, Swap } from './types.ts';

export type RepairProof = {
  status: 'certified' | 'shorter';
  minimum: number;
  witness: readonly Swap[];
  expanded: number;
  examined: number;
  lowerBound: number;
} | {
  status: 'limit';
  expanded: number;
  examined: number;
  lowerBound: number;
  provedThrough: number;
};

interface SearchMove {
  move: Swap;
  a: readonly number[];
  b: readonly number[];
}

const paved = (value: number): boolean => value === 111 || value === 104 || value === 118 || value >= 65 && value <= 70;

export function certifyRepairSearch(puzzle: AuthoredPuzzle, maxStates = 100_000): RepairProof {
  assertBoard(puzzle.board);
  validateRepair(puzzle, 'daily', puzzle.witness);
  if (!Number.isSafeInteger(maxStates) || maxStates < 1 || maxStates > 2_000_000) throw new Error('The exact repair search needs a bounded positive state budget.');
  if (puzzle.witness.length > 10) throw new Error('The exact repair search supports witnesses up to ten exchanges.');
  const size = puzzle.board.length, count = size * size;
  const original = puzzle.board.join('').replaceAll('~', '.');
  const boardOf = (state: string): Board => Array.from({ length: size }, (_, row) => state.slice(row * size, (row + 1) * size));
  const moves: SearchMove[] = legalSwaps(puzzle.board, puzzle.area, puzzle.frame).map(move => ({
    move, a: patchCells(move.a, move).map(cell => cell.row * size + cell.col),
    b: patchCells(move.b, move).map(cell => cell.row * size + cell.col),
  }));
  const neighbors = Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / size), col = index % size;
    return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]].flatMap(([r, c]) => {
      if (r === undefined || c === undefined || r < 0 || c < 0 || r >= size || c >= size) return [];
      const next = r * size + c;
      return original[next] === 'x' ? [] : [next];
    });
  });
  const anchors = new Map([...original].flatMap((tile, index) => /^[A-F]$/.test(tile) ? [[tile, index] as const] : []));
  const pairs = puzzle.goals.map(goal => [goal.from, goal.to] as const);
  const first = puzzle.journey?.[0], last = puzzle.journey?.at(-1);
  if (first && last) pairs.unshift([first, last]);
  const endpoints = [...new Set(pairs.map(pair => pair.join('')))].map(pair => {
    const a = anchors.get(pair[0] ?? ''), b = anchors.get(pair[1] ?? '');
    if (a === undefined || b === undefined) throw new Error('The exact repair proof references a missing home.');
    return [a, b] as const;
  });
  const distance = new Int16Array(count), visited = new Uint8Array(count), queue = new Int16Array(count * 8 + 1);
  const lowerBound = (state: string): number => {
    let missing = 0;
    for (const [from, to] of endpoints) {
      distance.fill(32767);visited.fill(0);
      let head = count * 4, tail = head;
      distance[from] = 0;queue[tail++] = from;
      while (head < tail) {
        const index = queue[head++];
        if (index === undefined) throw new Error('The repair proof queue exceeded its bounds.');
        if (visited[index]) continue;
        visited[index] = 1;
        const cost = distance[index];
        if (cost === undefined) throw new Error('The repair proof lost a distance.');
        if (index === to) break;
        const adjacent = neighbors[index];
        if (!adjacent) throw new Error('The repair proof lost a terrain square.');
        for (const next of adjacent) {
          if (visited[next]) continue;
          const value = paved(state.charCodeAt(next)) ? 0 : 1;
          const previous = distance[next];
          if (previous === undefined) throw new Error('The repair proof lost a neighboring distance.');
          if (cost + value >= previous) continue;
          distance[next] = cost + value;
          if (value) queue[tail++] = next;else queue[--head] = next;
          if (head < 0 || tail > queue.length) throw new Error('The repair proof queue exceeded its bounded capacity.');
        }
      }
      const required = distance[to];
      if (required === undefined || required === 32767) throw new Error('The proof cannot connect the fixed landscape geometry.');
      missing = Math.max(missing, required);
    }
    return Math.ceil(missing / puzzle.area);
  };
  const startBound = lowerBound(original);
  const dead = new Map<string, number>();
  const path: Swap[] = [];
  let expanded = 0, examined = 0, limited = false;
  const result: { witness: Swap[] | null } = { witness: null };
  const visit = (state: string, remaining: number, previousMove: number): boolean => {
    examined++;
    const bound = lowerBound(state);
    if (bound > remaining) return false;
    if (bound === 0 && checkPuzzle(boardOf(state), puzzle).solved) { result.witness = [...path];return true; }
    if (!remaining || (dead.get(state) ?? -1) >= remaining) return false;
    if (++expanded > maxStates) { limited = true;return false; }
    for (let index = 0; index < moves.length; index++) {
      if (index === previousMove) continue;
      const candidate = moves[index];
      if (!candidate) throw new Error('The repair proof lost a legal move.');
      let changed = false;
      const cells = [...state];
      for (let cell = 0; cell < candidate.a.length; cell++) {
        const a = candidate.a[cell], b = candidate.b[cell];
        if (a === undefined || b === undefined) throw new Error('The repair proof lost a patch square.');
        const av = state[a], bv = state[b];
        if (av === undefined || bv === undefined) throw new Error('The repair proof moved outside the board.');
        changed ||= av !== bv;cells[a] = bv;cells[b] = av;
      }
      if (!changed) continue;
      const next = cells.join('');
      path.push(candidate.move);
      if (visit(next, remaining - 1, index)) return true;
      path.pop();
      if (limited) return false;
    }
    // Only completed unsuccessful subtrees can be reused as depth certificates.
    dead.set(state, Math.max(dead.get(state) ?? -1, remaining));
    return false;
  };
  for (let depth = startBound; depth < puzzle.witness.length; depth++) {
    if (visit(original, depth, -1)) {
      if (!result.witness) throw new Error('The repair proof found a solution without its moves.');
      return { status: 'shorter', minimum: result.witness.length, witness: result.witness, expanded, examined, lowerBound: startBound };
    }
    if (limited) return { status: 'limit', expanded, examined, lowerBound: startBound, provedThrough: depth - 1 };
  }
  return { status: 'certified', minimum: puzzle.witness.length, witness: puzzle.witness, expanded, examined, lowerBound: startBound };
}
