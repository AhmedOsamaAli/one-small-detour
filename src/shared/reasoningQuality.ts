import { applySwap, assertBoard, checkPuzzle, isAnchor, legalSwaps, locate, patchCells, rulesFor } from './rules.ts';
import { pavingLowerBound, replayPuzzle } from './difficulty.ts';
import type { AuthoredPuzzle, Board, Puzzle } from './types.ts';

export function reasoningFingerprint(board: Board): string {
  assertBoard(board);
  let grid = board.map(row => [...row.replaceAll('~', '.')]);
  const views: string[] = [];
  for (let turn = 0; turn < 4; turn++) {
    views.push(grid.map(row => row.join('')).join('/'), grid.map(row => [...row].reverse().join('')).join('/'));
    const size = grid.length;
    grid = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => {
      const tile = grid[size - 1 - col]?.[row];
      if (!tile) throw new Error('The reasoning fingerprint lost a terrain square.');
      return tile === 'h' ? 'v' : tile === 'v' ? 'h' : tile;
    }));
  }
  const first = views.sort()[0];
  if (!first) throw new Error('The reasoning fingerprint has no landscape.');
  return first;
}

export interface ReasoningQuality {
  lowerBound: number;
  planningGap: number;
  setupMoves: number;
  criticalPairs: number;
  dependencyCoverage: number;
  movableCoverage: number;
  freeJunctions: number;
  orientations: number;
  stoneRatio: number;
  rockForcedRatio: number;
}

export function rockForcedRouteRatio(puzzle: Puzzle): number {
  assertBoard(puzzle.board);
  const size = puzzle.board.length, count = size * size, state = puzzle.board.join('');
  const neighbors = Array.from({ length: count }, (_, cell) => {
    const row = Math.floor(cell / size), col = cell % size;
    return [row > 0 ? cell - size : -1, row < size - 1 ? cell + size : -1,
      col > 0 ? cell - 1 : -1, col < size - 1 ? cell + 1 : -1].filter(next => next >= 0 && state[next] !== 'x');
  });
  let required = 0, shortest = 0;
  for (const goal of puzzle.goals) {
    const legs = goal.via ? [[goal.from, goal.via], [goal.via, goal.to]] as const : [[goal.from, goal.to]] as const;
    for (const [from, to] of legs) {
      const start = locate(puzzle.board, from), finish = locate(puzzle.board, to);
      if (!start || !finish) throw new Error('The rock-route audit references a missing home.');
      const source = start.row * size + start.col, target = finish.row * size + finish.col;
      const previous = new Int16Array(count), queue = new Int16Array(count);
      const reach = (omitted: number): boolean => {
        previous.fill(-1);previous[source] = source;queue[0] = source;
        let head = 0, tail = 1;
        while (head < tail) {
          const current = queue[head++];
          if (current === undefined) throw new Error('The rock-route audit lost its search square.');
          if (current === target) return true;
          for (const next of neighbors[current] ?? []) {
            if (next === omitted || previous[next] !== -1 ||
                puzzle.journey && isAnchor(state[next]) && next !== target) continue;
            previous[next] = current;queue[tail++] = next;
          }
        }
        return false;
      };
      if (!reach(-1)) throw new Error(`${puzzle.id}: fixed terrain prevents even a fully paved route.`);
      const internal: number[] = [];
      let cell = previous[target];
      while (cell !== source) {
        if (cell === undefined || cell < 0) throw new Error('The rock-route audit lost its potential route.');
        internal.push(cell);cell = previous[cell];
      }
      shortest += internal.length;
      // A compulsory square must occur on this path as well as every alternative.
      for (const omitted of internal) if (!reach(omitted)) required++;
    }
  }
  return required / Math.max(1, shortest);
}

export interface ReasoningGreedyProbe {
  bestMoves: number | null;
  examined: number;
}

export function probeReasoningGreedy(puzzle: Puzzle): ReasoningGreedyProbe {
  assertBoard(puzzle.board);
  const size = puzzle.board.length, count = size * size, original = puzzle.board.join('').replaceAll('~', '.');
  const legs = puzzle.goals.map(goal => {
    const from = locate(puzzle.board, goal.from), to = locate(puzzle.board, goal.to);
    if (!from || !to || goal.via) throw new Error('The greedy planning probe needs ordered, direct home-to-home legs.');
    return [from.row * size + from.col, to.row * size + to.col] as const;
  });
  const neighbors = Array.from({ length: count }, (_, cell) => {
    const row = Math.floor(cell / size), col = cell % size;
    return [row > 0 ? cell - size : -1, row < size - 1 ? cell + size : -1,
      col > 0 ? cell - 1 : -1, col < size - 1 ? cell + 1 : -1].filter(next => next >= 0 && original[next] !== 'x');
  });
  const moves = legalSwaps(puzzle.board, puzzle.area, puzzle.frame).map(move => ({
    a: patchCells(move.a, move).map(cell => cell.row * size + cell.col),
    b: patchCells(move.b, move).map(cell => cell.row * size + cell.col),
  }));
  const distance = new Float64Array(count), visited = new Uint8Array(count), scores = new Map<string, number>();
  const score = (state: string): number => {
    const cached = scores.get(state);
    if (cached !== undefined) return cached;
    let total = 0;
    for (const [source, target] of legs) {
      distance.fill(Infinity);visited.fill(0);distance[source] = 0;
      for (let iteration = 0; iteration < count; iteration++) {
        let current = -1, best = Infinity;
        for (let cell = 0; cell < count; cell++) {
          const value = distance[cell];
          if (!visited[cell] && value !== undefined && value < best) { current = cell;best = value; }
        }
        if (current < 0) throw new Error(`${puzzle.id}: the greedy probe cannot cross the fixed terrain.`);
        if (current === target) { total += best;break; }
        visited[current] = 1;
        for (const next of neighbors[current] ?? []) {
          if (visited[next] || isAnchor(state[next]) && next !== target) continue;
          const vertical = Math.abs(next - current) === size;
          const wrongAxis = Number(state[current] === 'h' && vertical || state[current] === 'v' && !vertical) +
            Number(state[next] === 'h' && vertical || state[next] === 'v' && !vertical);
          const candidate = best + Number(state[next] === '.') + wrongAxis;
          if (candidate < (distance[next] ?? Infinity)) distance[next] = candidate;
        }
      }
    }
    scores.set(state, total);return total;
  };
  const solved = (state: string): boolean =>
    checkPuzzle(Array.from({ length: size }, (_, row) => state.slice(row * size, (row + 1) * size)), puzzle).solved;
  let bestMoves: number | null = null, examined = 0;
  for (const seed of [1, 23, 71]) {
    let state = original;
    const seen = new Set([state]);
    for (let step = 0; step <= 12; step++) {
      if (solved(state)) { bestMoves = Math.min(bestMoves ?? step, step);break; }
      if (step === 12) break;
      let best: string | null = null, rank = Infinity;
      for (const [index, move] of moves.entries()) {
        const cells = [...state];let changed = false;
        for (let cell = 0; cell < move.a.length; cell++) {
          const a = move.a[cell], b = move.b[cell];
          if (a === undefined || b === undefined || state[a] === undefined || state[b] === undefined) {
            throw new Error('The greedy planning probe lost a patch square.');
          }
          changed ||= state[a] !== state[b];cells[a] = state[b];cells[b] = state[a];
        }
        if (!changed) continue;
        const next = cells.join('');
        if (seen.has(next)) continue;
        examined++;
        const tie = ((Math.imul(index + 1, 1664525) ^ Math.imul(seed + step + 1, 1013904223)) >>> 0) / 0x100000000;
        const candidate = score(next) + tie * .01;
        if (candidate < rank) { rank = candidate;best = next; }
      }
      if (best === null) break;
      state = best;seen.add(state);
    }
  }
  return { bestMoves, examined };
}

export function reasoningGreedyRejection(puzzle: Puzzle, probe: ReasoningGreedyProbe, tier: number): string | null {
  if (tier < 3) return null;
  const minimum = puzzle.minimum;
  if (minimum === undefined || !Number.isInteger(minimum) || minimum < 1) throw new Error('The greedy difficulty gate needs a certified positive minimum.');
  if (tier >= 4 && probe.bestMoves !== null && probe.bestMoves <= minimum + 2) return 'easy-greedy-expert';
  if (probe.bestMoves !== null && probe.bestMoves <= minimum) return 'easy-greedy-plan';
  return null;
}

export function reasoningQuality(puzzle: AuthoredPuzzle): ReasoningQuality {
  if (!puzzle.witness.length) throw new Error('Reasoning quality needs a witnessed repair.');
  const size = puzzle.board.length, movable = new Set<number>();
  puzzle.board.forEach((row, r) => [...row].forEach((tile, col) => { if (tile !== 'x' && !isAnchor(tile)) movable.add(r * size + col); }));
  const seen = new Set<number>();let largest = 0, junctions = 0;
  const neighbors = (index: number): number[] => {
    const row = Math.floor(index / size), col = index % size;
    return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
      .flatMap(([r, c]) => r !== undefined && c !== undefined && r >= 0 && c >= 0 && r < size && c < size && movable.has(r * size + c) ? [r * size + c] : []);
  };
  for (const cell of movable) {
    if (neighbors(cell).length >= 3) junctions++;
    if (seen.has(cell)) continue;
    const queue = [cell];seen.add(cell);
    for (let index = 0; index < queue.length; index++) for (const next of neighbors(queue[index] ?? cell)) {
      if (!seen.has(next)) { seen.add(next);queue.push(next); }
    }
    largest = Math.max(largest, queue.length);
  }
  const graph = puzzle.witness.map(() => new Set<number>());
  const footprints = puzzle.witness.map(move => new Set([...patchCells(move.a, move), ...patchCells(move.b, move)].map(cell => cell.row * size + cell.col)));
  let criticalPairs = 0;
  for (let a = 0; a < puzzle.witness.length; a++) for (let b = a + 1; b < puzzle.witness.length; b++) {
    if (![...(footprints[a] ?? [])].some(cell => footprints[b]?.has(cell))) continue;
    const moves = [...puzzle.witness], first = moves[a], second = moves[b];
    if (!first || !second) throw new Error('A reasoning dependency lost a move.');
    moves[a] = second;moves[b] = first;
    if (checkPuzzle(replayPuzzle(puzzle, moves), puzzle).solved) continue;
    graph[a]?.add(b);graph[b]?.add(a);criticalPairs++;
  }
  let dependent = 0;
  for (let index = 0; index < graph.length; index++) {
    const reached = new Set([index]), queue = [index];
    for (let cursor = 0; cursor < queue.length; cursor++) for (const next of graph[queue[cursor] ?? index] ?? []) {
      if (!reached.has(next)) { reached.add(next);queue.push(next); }
    }
    dependent = Math.max(dependent, reached.size);
  }
  const lowerBound = Math.ceil(pavingLowerBound(puzzle.board, puzzle.goals, puzzle.journey) / puzzle.area);
  let board = puzzle.board, before = pavingLowerBound(board, puzzle.goals, puzzle.journey), setupMoves = 0;
  for (const move of puzzle.witness) {
    board = applySwap(board, move, rulesFor(puzzle, 'daily'), 0);
    const after = pavingLowerBound(board, puzzle.goals, puzzle.journey);
    if (after >= before) setupMoves++;
    before = after;
  }
  return { lowerBound, planningGap: puzzle.witness.length - lowerBound, setupMoves, criticalPairs,
    dependencyCoverage: dependent / puzzle.witness.length, movableCoverage: largest / Math.max(1, movable.size),
    freeJunctions: junctions, orientations: new Set(puzzle.witness.map(move => `${move.rows}:${move.cols}`)).size,
    stoneRatio: puzzle.board.join('').split('').filter(tile => tile === 'x').length / (size * size),
    rockForcedRatio: rockForcedRouteRatio(puzzle) };
}

export function reasoningRejection(puzzle: AuthoredPuzzle, quality: ReasoningQuality, tier: number): string | null {
  if (quality.movableCoverage < .84) return 'separated-stock';
  if (quality.stoneRatio > .38 || quality.freeJunctions < 4) return 'forced-corridor';
  if (tier >= 2 && quality.rockForcedRatio > 1 / tier) return 'rock-dictated-route';
  if (tier >= 2 && quality.planningGap < 1) return 'independent-gap-repairs';
  if (tier >= 3 && quality.planningGap < 2) return 'insufficient-lookahead';
  if (tier >= 4 && (quality.planningGap < 3 || quality.setupMoves < 2)) return 'insufficient-expert-planning';
  if (tier >= 4 && quality.criticalPairs < puzzle.witness.length * (puzzle.witness.length - 1) / 2 - 1) return 'weak-expert-dependencies';
  if (tier >= 2 && quality.setupMoves < 1) return 'greedy-only';
  if (tier >= 2 && (quality.dependencyCoverage < .75 || quality.criticalPairs < puzzle.witness.length - 2)) return 'separable-moves';
  if (tier >= 3 && quality.dependencyCoverage < 1) return 'disconnected-plan';
  if (puzzle.frame && puzzle.frame !== 'square' && tier >= 2 && quality.orientations < 2) return 'one-orientation';
  return null;
}
