import type { Anchor, Board, Cell, Goal, JourneyPlan, Mode, PatchFamily, Puzzle, Repair, RouteCheck, Rules, Shape, Swap, Tile } from './types.ts';

export const RULE_VERSION = '4';
export const BOARD_SIZES = [6, 8, 10, 12] as const;
export const MAX_BOARD_SIZE = 12;
export const MAX_EXCHANGES = 2000;

export function boardSize(board: Board): number {
  return board.length;
}

export class RuleError extends Error {
  constructor(message: string, readonlyCode = 'invalid_move') {
    super(message);
    this.name = 'RuleError';
    this.code = readonlyCode;
  }
  readonly code: string;
}

export function isAnchor(tile: string | undefined): tile is Anchor {
  return tile === 'A' || tile === 'B' || tile === 'C' || tile === 'D' || tile === 'E' || tile === 'F';
}

export function tileAt(board: Board, cell: Cell): Tile {
  const tile = board[cell.row]?.[cell.col];
  if (tile === '.' || tile === 'o' || tile === '~' || tile === 'x' || tile === 'h' || tile === 'v' || isAnchor(tile)) return tile;
  throw new RuleError('That square is outside the landscape.', 'bounds');
}

export function walkable(tile: string | undefined): boolean {
  return tile === 'o' || tile === 'h' || tile === 'v' || isAnchor(tile);
}

export function connects(tile: string | undefined, row: number, col: number): boolean {
  if (Math.abs(row) + Math.abs(col) !== 1 || !walkable(tile)) return false;
  if (tile === 'h') return row === 0;
  if (tile === 'v') return col === 0;
  return true;
}

export function canTraverse(board: Board, from: Cell, to: Cell): boolean {
  const row = to.row - from.row;
  const col = to.col - from.col;
  return connects(board[from.row]?.[from.col], row, col) && connects(board[to.row]?.[to.col], -row, -col);
}

export function rulesFor(puzzle: Puzzle, mode: Mode): Rules {
  return mode === 'gentle' && !puzzle.frame
    ? { areas: [1, 2, 4], budget: Math.min(MAX_EXCHANGES, Math.max(3, puzzle.budget + 2)) }
    : { areas: [puzzle.area], budget: puzzle.budget, ...(puzzle.frame ? { frame: puzzle.frame } : {}) };
}

export function shapesFor(area: number, size = 6, frame?: PatchFamily): Shape[] {
  if (frame === 'ell') return area === 4 && size >= 3 ? [{ rows: 3, cols: 2, kind: 'ell' }, { rows: 2, cols: 3, kind: 'ell' }] : [];
  if (frame === 'square') return area === 4 && size >= 2 ? [{ rows: 2, cols: 2 }] : [];
  if (frame === 'strip' && area !== 3) return [];
  return Array.from({ length: size }, (_, index) => index + 1)
    .filter((rows) => area % rows === 0 && area / rows <= size)
    .map((rows) => ({ rows, cols: area / rows }));
}

export function patchArea(shape: Shape): number {
  return shape.kind === 'ell' ? 4 : shape.rows * shape.cols;
}

export function patchOutline(shape: Shape): Cell[] {
  if (shape.kind === 'ell') {
    if (shape.rows === 3 && shape.cols === 2) return [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 2, col: 1 },
      { row: 2, col: 2 }, { row: 3, col: 2 }, { row: 3, col: 0 },
    ];
    if (shape.rows === 2 && shape.cols === 3) return [
      { row: 0, col: 0 }, { row: 0, col: 3 }, { row: 1, col: 3 },
      { row: 1, col: 1 }, { row: 2, col: 1 }, { row: 2, col: 0 },
    ];
    throw new RuleError('Choose a supported L frame.', 'shape');
  }
  return [{ row: 0, col: 0 }, { row: 0, col: shape.cols }, { row: shape.rows, col: shape.cols }, { row: shape.rows, col: 0 }];
}

export function patchCells(start: Cell, shape: Shape): Cell[] {
  if (shape.kind === 'ell') {
    const offsets = shape.rows === 3 && shape.cols === 2
      ? [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 2, col: 1 }]
      : shape.rows === 2 && shape.cols === 3
        ? [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 0 }] : null;
    if (!offsets) throw new RuleError('Choose a supported L frame.', 'shape');
    return offsets.map((cell) => ({ row: start.row + cell.row, col: start.col + cell.col }));
  }
  const cells: Cell[] = [];
  for (let r = 0; r < shape.rows; r++) {
    for (let c = 0; c < shape.cols; c++) cells.push({ row: start.row + r, col: start.col + c });
  }
  return cells;
}

export interface PatchIssue {
  code: 'shape' | 'bounds' | 'home' | 'boulder' | 'overlap';
  message: string;
  cells: Cell[];
}

export function inspectPatch(board: Board, start: Cell, shape: Shape): PatchIssue | null {
  const size = boardSize(board);
  if (![start.row, start.col, shape.rows, shape.cols].every(Number.isInteger)) {
    return { code: 'shape', message: 'Choose whole squares.', cells: [] };
  }
  if (shape.kind !== undefined && (shape.kind !== 'ell' ||
      !((shape.rows === 3 && shape.cols === 2) || (shape.rows === 2 && shape.cols === 3)))) {
    return { code: 'shape', message: 'Choose a supported frame shape.', cells: [] };
  }
  if (shape.rows < 1 || shape.cols < 1 || start.row < 0 || start.col < 0 ||
      start.row + shape.rows > size || start.col + shape.cols > size) {
    return { code: 'bounds', message: 'Keep the whole patch on the island.', cells: [] };
  }
  const cells = patchCells(start, shape);
  const homes = cells.filter((cell) => isAnchor(tileAt(board, cell)));
  const boulders = cells.filter((cell) => tileAt(board, cell) === 'x');
  if (homes.length || boulders.length) {
    return {
      code: homes.length ? 'home' : 'boulder',
      message: homes.length && boulders.length ? 'Homes and boulders stay fixed.' :
        homes.length ? 'Homes stay fixed. Cut around them.' : 'Boulders stay fixed. Cut around them.',
      cells: [...homes, ...boulders],
    };
  }
  return null;
}

export function patchProblem(board: Board, start: Cell, shape: Shape): string | null {
  return inspectPatch(board, start, shape)?.message ?? null;
}

export function selectionIssue(board: Board, start: Cell, shape: Shape, first: Cell | null): PatchIssue | null {
  const issue = inspectPatch(board, start, shape);
  if (issue) return issue;
  if (!first || (first.row === start.row && first.col === start.col) ||
      !patchesOverlap({ ...shape, a: first, b: start })) return null;
  return {
    code: 'overlap', message: 'Patches overlap. Pick another spot.',
    cells: patchCells(start, shape).filter((cell) => patchCells(first, shape).some((other) => other.row === cell.row && other.col === cell.col)),
  };
}

export function patchesOverlap(move: Swap): boolean {
  if (move.kind === 'ell') {
    const first = new Set(patchCells(move.a, move).map((cell) => `${cell.row},${cell.col}`));
    return patchCells(move.b, move).some((cell) => first.has(`${cell.row},${cell.col}`));
  }
  return move.a.row < move.b.row + move.rows && move.b.row < move.a.row + move.rows &&
    move.a.col < move.b.col + move.cols && move.b.col < move.a.col + move.cols;
}

export function applySwap(board: Board, move: Swap, rules: Rules, used = 0): Board {
  if (used >= rules.budget) throw new RuleError(rules.budget === MAX_EXCHANGES
    ? 'This attempt is too long to save. Undo or restart to continue.' : 'That is the last cut. Undo is always free.', 'budget');
  if (!rules.areas.includes(patchArea(move)) ||
      (move.kind === 'ell') !== (rules.frame === 'ell') ||
      (rules.frame === 'square' && (move.rows !== 2 || move.cols !== 2)) ||
      (rules.frame === 'strip' && !((move.rows === 1 && move.cols === 3) || (move.rows === 3 && move.cols === 1)))) {
    throw new RuleError('Use one of this island\'s frame shapes.', 'area');
  }
  const firstProblem = patchProblem(board, move.a, move);
  const secondProblem = patchProblem(board, move.b, move);
  if (firstProblem || secondProblem) throw new RuleError(firstProblem ?? secondProblem ?? 'Invalid patch.');
  if (patchesOverlap(move)) throw new RuleError('The two patches cannot overlap. Pick another spot.', 'overlap');
  const next = board.map((row) => row.split(''));
  for (const { row, col } of patchCells({ row: 0, col: 0 }, move)) {
      const a = { row: move.a.row + row, col: move.a.col + col };
      const b = { row: move.b.row + row, col: move.b.col + col };
      const targetA = next[a.row];
      const targetB = next[b.row];
      if (!targetA || !targetB) throw new RuleError('The landscape has an invalid row.', 'board');
      targetA[a.col] = tileAt(board, b);
      targetB[b.col] = tileAt(board, a);
  }
  return next.map((row) => row.join(''));
}

export function locate(board: Board, anchor: Anchor): Cell | null {
  for (let row = 0; row < boardSize(board); row++) {
    const col = board[row]?.indexOf(anchor) ?? -1;
    if (col >= 0) return { row, col };
  }
  return null;
}

const indexOf = (cell: Cell, size: number): number => cell.row * size + cell.col;
const cellOf = (index: number, size: number): Cell => ({ row: Math.floor(index / size), col: index % size });

function neighbors(board: Board, index: number): number[] {
  const size = boardSize(board);
  const { row, col } = cellOf(index, size);
  return [{ row, col: col + 1 }, { row: row + 1, col }, { row: row - 1, col }, { row, col: col - 1 }]
    .filter((cell) => cell.row >= 0 && cell.col >= 0 && cell.row < size && cell.col < size &&
      canTraverse(board, { row, col }, cell))
    .map((cell) => indexOf(cell, size));
}

function shortestRoute(board: Board, start: number, end: number): number[] | null {
  const queue = [start];
  const previous = new Map<number, number | null>([[start, null]]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (current === undefined) break;
    if (current === end) {
      const route: number[] = [];
      let node: number | null = end;
      while (node !== null) {
        route.push(node);
        node = previous.get(node) ?? null;
      }
      return route.reverse();
    }
    for (const neighbor of neighbors(board, current)) {
      if (!previous.has(neighbor)) {
        previous.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }
  return null;
}

interface Edge {
  to: number;
  reverse: number;
  capacity: number;
  flow: number;
}

// Two vertex-disjoint paths from the stop prevent a connected dead end from
// being incorrectly accepted as an A -> stop -> B trail.
function routeVia(board: Board, start: number, end: number, stop: number): number[] | null {
  const size = boardSize(board);
  const sink = size * size * 2;
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
  const addEdge = (from: number, to: number, capacity: number): void => {
    const a = graph[from];
    const b = graph[to];
    if (!a || !b) throw new RuleError('Invalid route graph.', 'board');
    a.push({ to, reverse: b.length, capacity, flow: 0 });
    b.push({ to: from, reverse: a.length - 1, capacity: 0, flow: 0 });
  };
  for (let index = 0; index < size * size; index++) {
    const cell = cellOf(index, size);
    if (!walkable(board[cell.row]?.[cell.col])) continue;
    addEdge(index * 2, index * 2 + 1, index === stop ? 2 : 1);
    for (const neighbor of neighbors(board, index)) addEdge(index * 2 + 1, neighbor * 2, 1);
  }
  addEdge(start * 2 + 1, sink, 1);
  addEdge(end * 2 + 1, sink, 1);
  const source = stop * 2 + 1;
  for (let unit = 0; unit < 2; unit++) {
    const queue = [source];
    const previous = new Map<number, { node: number; edge: number }>();
    const visited = new Set([source]);
    for (let cursor = 0; cursor < queue.length && !visited.has(sink); cursor++) {
      const node = queue[cursor];
      if (node === undefined) break;
      for (const [edgeIndex, edge] of (graph[node] ?? []).entries()) {
        if (edge.flow < edge.capacity && !visited.has(edge.to)) {
          visited.add(edge.to);
          previous.set(edge.to, { node, edge: edgeIndex });
          queue.push(edge.to);
        }
      }
    }
    if (!visited.has(sink)) return null;
    let node = sink;
    while (node !== source) {
      const step = previous.get(node);
      if (!step) throw new RuleError('Incomplete route graph.', 'board');
      const edge = graph[step.node]?.[step.edge];
      if (!edge) throw new RuleError('Missing route edge.', 'board');
      edge.flow++;
      const reverse = graph[node]?.[edge.reverse];
      if (!reverse) throw new RuleError('Missing reverse route.', 'board');
      reverse.flow--;
      node = step.node;
    }
  }
  const extract = (node: number, visited: Set<number>): number[] | null => {
    if (node === sink) return [sink];
    visited.add(node);
    for (const edge of graph[node] ?? []) {
      if (edge.capacity > 0 && edge.flow > 0 && !visited.has(edge.to)) {
        const rest = extract(edge.to, visited);
        if (rest) {
          edge.flow--;
          return [node, ...rest];
        }
      }
    }
    visited.delete(node);
    return null;
  };
  const legs: number[][] = [];
  for (let i = 0; i < 2; i++) {
    const nodes = extract(source, new Set());
    if (!nodes) return null;
    legs.push([stop, ...nodes.filter((node) => node < sink && node % 2 === 0).map((node) => node / 2)]);
  }
  const toStart = legs.find((leg) => leg.at(-1) === start);
  const toEnd = legs.find((leg) => leg.at(-1) === end);
  if (!toStart || !toEnd) return null;
  return [...toStart.reverse(), ...toEnd.slice(1)];
}

export function findRoute(board: Board, goal: Goal): Cell[] | null {
  const start = locate(board, goal.from);
  const end = locate(board, goal.to);
  if (!start || !end) return null;
  const size = boardSize(board);
  const startIndex = indexOf(start, size);
  const endIndex = indexOf(end, size);
  const direct = shortestRoute(board, startIndex, endIndex);
  if (!direct) return null;
  if (!goal.via) return direct.map((index) => cellOf(index, size));
  const stop = locate(board, goal.via);
  if (!stop) return null;
  return routeVia(board, startIndex, endIndex, indexOf(stop, size))?.map((index) => cellOf(index, size)) ?? null;
}

export function checkRoutes(board: Board, goals: readonly Goal[]): RouteCheck {
  const routes: Cell[][] = [];
  const missing: string[] = [];
  for (const goal of goals) {
    const route = findRoute(board, goal);
    if (route) routes.push(route);
    else missing.push(goal.via ? `${goal.from} through ${goal.via} to ${goal.to}` : `${goal.from} to ${goal.to}`);
  }
  return { solved: missing.length === 0, routes, missing };
}

export function planJourney(board: Board, anchors: readonly Anchor[]): JourneyPlan {
  if (anchors.length < 2 || new Set(anchors).size !== anchors.length) {
    throw new RuleError('A journey needs distinct stops in a clear order.', 'journey');
  }
  const size = board.length;
  const stops = anchors.map((anchor) => {
    const cell = locate(board, anchor);
    if (!cell) throw new RuleError(`The journey is missing stop ${anchor}.`, 'journey');
    return indexOf(cell, size);
  });
  const start = stops[0];
  if (start === undefined) throw new RuleError('The journey has no starting point.', 'journey');
  const stopOrder = new Map(stops.map((stop, index) => [stop, index]));
  const adjacent = Array.from({ length: size * size }, (_, index) => neighbors(board, index));
  let explored = 0;
  const search = (target: number): number[] | null => {
    const route = [start];
    const failed = new Set<string>();
    const canReachNext = (current: number, next: number, visited: bigint): boolean => {
      const destination = stops[next];
      const queue = [current];
      const seen = new Set([current]);
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const node = queue[cursor];
        if (node === destination) return true;
        if (node === undefined) break;
        for (const neighbor of adjacent[node] ?? []) {
          if (seen.has(neighbor) || (visited & (1n << BigInt(neighbor))) !== 0n ||
              (stopOrder.get(neighbor) ?? -1) > next) continue;
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
      return false;
    };
    const visit = (current: number, next: number, visited: bigint): boolean => {
      if (next === target) return true;
      if (++explored > 200_000) {
        throw new RuleError('This trail is too complex to verify. Undo a cut and try a simpler arrangement.', 'journey_complexity');
      }
      if (!canReachNext(current, next, visited)) return false;
      const key = `${current}:${next}:${visited}`;
      if (failed.has(key)) return false;
      const destination = stops[next];
      if (destination === undefined) return false;
      const choices = [...(adjacent[current] ?? [])].sort((a, b) => {
        const distance = (node: number): number =>
          Math.abs(Math.floor(node / size) - Math.floor(destination / size)) + Math.abs(node % size - destination % size);
        return distance(a) - distance(b);
      });
      for (const neighbor of choices) {
        const bit = 1n << BigInt(neighbor);
        if ((visited & bit) !== 0n || (stopOrder.get(neighbor) ?? -1) > next) continue;
        route.push(neighbor);
        if (visit(neighbor, neighbor === destination ? next + 1 : next, visited | bit)) return true;
        route.pop();
      }
      failed.add(key);
      return false;
    };
    return visit(start, 1, 1n << BigInt(start)) ? route : null;
  };
  for (let target = anchors.length; target >= 2; target--) {
    const route = search(target);
    if (!route) continue;
    return {
      path: route.map((index) => cellOf(index, size)),
      stops: anchors.slice(0, target).map((anchor, index) => ({ anchor, pathIndex: route.indexOf(stops[index] ?? -1) })),
      solved: target === anchors.length,
    };
  }
  return { path: [cellOf(start, size)], stops: [{ anchor: anchors[0] ?? 'A', pathIndex: 0 }], solved: false };
}

export function checkPuzzle(board: Board, puzzle: Puzzle): RouteCheck {
  if (!puzzle.journey) return checkRoutes(board, puzzle.goals);
  const journey = planJourney(board, puzzle.journey);
  const next = puzzle.journey[journey.stops.length];
  return {
    solved: journey.solved,
    routes: journey.path.length > 1 ? [journey.path] : [],
    missing: next ? [`Visit ${next} next, in order.`] : [],
    journey,
  };
}

export function validateRepair(puzzle: Puzzle, mode: Mode, moves: readonly Swap[]): Repair {
  const rules = rulesFor(puzzle, mode);
  if (moves.length === 0) throw new RuleError('Make a repair before submitting it.', 'empty');
  if (moves.length > rules.budget) throw new RuleError('That repair uses too many exchanges.', 'budget');
  let board = puzzle.board;
  moves.forEach((move, used) => { board = applySwap(board, move, rules, used); });
  const check = checkPuzzle(board, puzzle);
  if (!check.solved) throw new RuleError(`There is still no clear trail: ${check.missing.join('; ')}.`, 'unsolved');
  return {
    board,
    routes: check.routes,
    footprint: moves.reduce((total, move) => total + 2 * patchArea(move), 0),
    swaps: moves.length,
  };
}

export function boardFingerprint(board: Board): string {
  return board.join('/');
}

export function roadFingerprint(board: Board): string {
  return board.map((row) => row.replace(/~/g, '.')).join('/');
}

export function legalSwaps(board: Board, area: number, frame?: PatchFamily): Swap[] {
  const size = boardSize(board);
  const swaps: Swap[] = [];
  for (const shape of shapesFor(area, size, frame)) {
    const positions: Cell[] = [];
    for (let row = 0; row <= size - shape.rows; row++) {
      for (let col = 0; col <= size - shape.cols; col++) {
        const cell = { row, col };
        if (!patchProblem(board, cell, shape)) positions.push(cell);
      }
    }
    positions.forEach((a, index) => {
      for (const b of positions.slice(index + 1)) {
        const swap = { a, b, ...shape };
        if (!patchesOverlap(swap)) swaps.push(swap);
      }
    });
  }
  return swaps;
}

export function assertBoard(board: Board): void {
  if (!BOARD_SIZES.some((size) => size === board.length) ||
      board.some((row) => row.length !== board.length || !/^[.o~xhvABCDEF]+$/.test(row))) {
    throw new RuleError('Every landscape must be a square 6, 8, or 10 cells wide.', 'board');
  }
  for (const anchor of ['A', 'B', 'C', 'D', 'E', 'F']) {
    if (board.join('').split(anchor).length - 1 > 1) throw new RuleError('A landmark appears more than once.', 'board');
  }
}
