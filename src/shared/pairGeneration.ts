import { randomSource, seedOf } from './generation.ts';
import { analyzePairStock, certifyPairMinimum, pairGeometry } from './pairDifficulty.ts';
import { applySwap, inspectPatch, isAnchor, MAX_EXCHANGES, patchCells, RuleError, rulesFor, walkable } from './rules.ts';
import type { Anchor, AuthoredPuzzle, Cell, Shape, Swap, Tile } from './types.ts';

interface PairTemplate { size: 6 | 8 | 10 | 12; homes: readonly Cell[] }
const TEMPLATES: Readonly<Record<number, PairTemplate>> = {
  4: { size: 6, homes: [{ row: 0, col: 0 }, { row: 3, col: 2 }, { row: 0, col: 4 }] },
  5: { size: 8, homes: [{ row: 0, col: 0 }, { row: 4, col: 1 }, { row: 0, col: 4 }] },
  6: { size: 8, homes: [{ row: 0, col: 0 }, { row: 4, col: 3 }, { row: 1, col: 7 }] },
  7: { size: 8, homes: [{ row: 0, col: 0 }, { row: 5, col: 4 }, { row: 2, col: 0 }] },
  8: { size: 10, homes: [{ row: 0, col: 0 }, { row: 5, col: 4 }, { row: 0, col: 8 }] },
  9: { size: 10, homes: [{ row: 0, col: 0 }, { row: 6, col: 5 }, { row: 0, col: 2 }] },
  10: { size: 10, homes: [{ row: 0, col: 0 }, { row: 8, col: 3 }, { row: 0, col: 6 }] },
  11: { size: 10, homes: [{ row: 0, col: 0 }, { row: 4, col: 5 }, { row: 0, col: 8 }, { row: 6, col: 5 }] },
  12: { size: 10, homes: [{ row: 0, col: 0 }, { row: 6, col: 3 }, { row: 0, col: 4 }, { row: 7, col: 0 }] },
  13: { size: 10, homes: [{ row: 0, col: 0 }, { row: 6, col: 3 }, { row: 0, col: 4 }, { row: 9, col: 0 }] },
  14: { size: 12, homes: [{ row: 0, col: 0 }, { row: 6, col: 3 }, { row: 0, col: 4 }, { row: 11, col: 0 }] },
  15: { size: 12, homes: [{ row: 0, col: 0 }, { row: 6, col: 3 }, { row: 0, col: 4 }, { row: 11, col: 0 }, { row: 10, col: 2 }] },
  16: { size: 12, homes: [{ row: 0, col: 0 }, { row: 6, col: 3 }, { row: 0, col: 4 }, { row: 11, col: 0 }, { row: 10, col: 4 }] },
  17: { size: 12, homes: [{ row: 0, col: 0 }, { row: 6, col: 3 }, { row: 0, col: 4 }, { row: 11, col: 0 }, { row: 10, col: 6 }] },
  18: { size: 12, homes: [{ row: 0, col: 0 }, { row: 6, col: 3 }, { row: 0, col: 4 }, { row: 11, col: 0 }, { row: 10, col: 8 }] },
  19: { size: 12, homes: [{ row: 0, col: 0 }, { row: 6, col: 3 }, { row: 0, col: 4 }, { row: 11, col: 0 }, { row: 10, col: 10 }] },
  20: { size: 12, homes: [{ row: 0, col: 0 }, { row: 6, col: 3 }, { row: 0, col: 4 }, { row: 11, col: 0 }, { row: 10, col: 8 }, { row: 8, col: 11 }] },
  22: { size: 12, homes: [{ row: 0, col: 0 }, { row: 10, col: 1 }, { row: 0, col: 2 }, { row: 10, col: 3 }, { row: 0, col: 4 }, { row: 4, col: 5 }] },
  25: { size: 12, homes: [{ row: 0, col: 0 }, { row: 10, col: 1 }, { row: 0, col: 2 }, { row: 10, col: 3 }, { row: 0, col: 4 }, { row: 10, col: 5 }] },
};

export function pairProgressionTarget(slot: number): { minimum: number; routePairs: number; size: number } {
  if (!Number.isSafeInteger(slot) || slot < 0) throw new Error('The pair progression needs an absolute, nonnegative campaign slot.');
  const band = Math.floor(slot / 3), minimum = Math.min(12, 3 + band);
  const routePairs = Math.min(18, 4 + band * 2 + slot % 3);
  const template = TEMPLATES[routePairs];
  if (!template) throw new Error('The global pair progression has no route template.');
  return { minimum, routePairs, size: template.size };
}

interface TargetPair { start: Cell; shape: Shape; tiles: readonly [Tile, Tile] }
export type PairConstruction = { status: 'constructed'; puzzle: AuthoredPuzzle; route: readonly Cell[] } |
  { status: 'rejected'; reason: 'ordered-path-budget' | 'stock-packing-budget' | 'route-verification-budget' | 'matching-repair-unavailable' };

export function constructPairChallenge(minimum: number, seed: number, routePairs?: number): PairConstruction {
  const pairCount = routePairs ?? minimum + 1, template = TEMPLATES[pairCount];
  if (!Number.isInteger(minimum) || minimum < 2 || minimum > 12 || !Number.isInteger(pairCount) ||
      pairCount <= minimum || !template || !Number.isSafeInteger(seed) || seed < 1) {
    throw new Error('Choose a minimum from 2 through 12, a supported larger route template, and a positive integer seed.');
  }
  const revision = routePairs === undefined ? 'v2' : `v3:${pairCount}`;
  const random = randomSource(seedOf(`detour:pair-engine-${revision}:${minimum}:${seed}`));
  const { size } = template, turns = Math.floor(random() * 4), mirror = random() < .5;
  const transform = (cell: Cell): Cell => {
    let row = cell.row, col = mirror ? size - 1 - cell.col : cell.col;
    for (let turn = 0; turn < turns; turn++) [row, col] = [col, size - 1 - row];
    return { row, col };
  };
  const homes = template.homes.map(transform), anchors: Anchor[] = ['A', 'B', 'C', 'D', 'E', 'F'];
  const journey = anchors.slice(0, homes.length);
  const grid: Tile[][] = Array.from({ length: size }, () => Array<Tile>(size).fill('.'));
  homes.forEach((cell, index) => {
    const line = grid[cell.row], anchor = journey[index];
    if (!line || !anchor) throw new Error('The pair constructor lost a home.');
    line[cell.col] = anchor;
  });
  const goals = journey.slice(1).map((to, index) => {
    const from = journey[index];
    if (!from) throw new Error('The pair constructor lost an ordered leg.');
    return { from, to };
  });
  const shell: AuthoredPuzzle = {
    id: `pair-candidate-${minimum}-${pairCount}-${seed}`, title: 'The careful road',
    note: 'Two tiles. Every road piece matters. Plan your cuts before you swap.',
    theme: 'meadow', chapter: 1, board: grid.map(line => line.join('')),
    area: 2, budget: MAX_EXCHANGES, journey, goals, minimum, witness: [],
  };
  const geometry = pairGeometry(shell);
  if (geometry.requiredRoadTiles !== pairCount * 2) throw new Error('A pair-engine home template does not match its exact road inventory.');
  const first = homes[0];
  if (!first) throw new Error('The pair constructor has no starting home.');
  const route: Cell[] = [first], occupied = new Set([first.row * size + first.col]);
  const homeCells = new Set(homes.map(cell => cell.row * size + cell.col));
  let visits = 0;
  const visit = (leg: number): boolean => {
    const current = route.at(-1), target = homes[leg];
    if (!current || !target) throw new Error('The ordered route lost its next home.');
    if (current.row === target.row && current.col === target.col) return leg === homes.length - 1 || visit(leg + 1);
    if (++visits > 10000) return false;
    const before = Math.abs(current.row - target.row) + Math.abs(current.col - target.col);
    const choices = [
      { row: current.row - 1, col: current.col }, { row: current.row + 1, col: current.col },
      { row: current.row, col: current.col - 1 }, { row: current.row, col: current.col + 1 },
    ].filter(cell => cell.row >= 0 && cell.col >= 0 && cell.row < size && cell.col < size &&
      !occupied.has(cell.row * size + cell.col) &&
      (!homeCells.has(cell.row * size + cell.col) || cell.row === target.row && cell.col === target.col) &&
      Math.abs(cell.row - target.row) + Math.abs(cell.col - target.col) === before - 1)
      .map(cell => ({ cell, order: random() })).sort((a, b) => a.order - b.order);
    for (const { cell } of choices) {
      occupied.add(cell.row * size + cell.col); route.push(cell);
      if (visit(leg)) return true;
      route.pop(); occupied.delete(cell.row * size + cell.col);
    }
    return false;
  };
  if (!visit(1)) return { status: 'rejected', reason: 'ordered-path-budget' };
  for (const cell of route) {
    const line = grid[cell.row];
    if (!line) throw new Error('The target road left its island.');
    if (!isAnchor(line[cell.col])) line[cell.col] = 'o';
  }
  for (let index = 1; index < route.length - 1; index++) {
    const cell = route[index], before = route[index - 1], after = route[index + 1];
    if (!cell || !before || !after) throw new Error('The target bridge lost a neighboring square.');
    const line = grid[cell.row];
    if (!line) throw new Error('The target bridge left its island.');
    if (isAnchor(line[cell.col]) || random() > .15 + minimum * .018) continue;
    if (before.row === after.row) line[cell.col] = 'h';
    else if (before.col === after.col) line[cell.col] = 'v';
  }
  const targetPairs: TargetPair[] = [];
  let segment: Cell[] = [];
  const flush = (): void => {
    if (segment.length % 2) throw new Error('The target route cannot be tiled without covering a fixed home.');
    for (let index = 0; index < segment.length; index += 2) {
      const a = segment[index], b = segment[index + 1];
      if (!a || !b) throw new Error('The target pair lost a square.');
      const start = { row: Math.min(a.row, b.row), col: Math.min(a.col, b.col) };
      const shape = { rows: a.row === b.row ? 1 : 2, cols: a.row === b.row ? 2 : 1 };
      const firstTile = grid[start.row]?.[start.col];
      const secondTile = grid[start.row + shape.rows - 1]?.[start.col + shape.cols - 1];
      if (!firstTile || !secondTile || !walkable(firstTile) || !walkable(secondTile)) throw new Error('The target pair has no usable road.');
      targetPairs.push({ start, shape, tiles: [firstTile, secondTile] });
    }
    segment = [];
  };
  for (const cell of route) {
    if (isAnchor(grid[cell.row]?.[cell.col])) flush();
    else segment.push(cell);
  }
  flush();
  if (targetPairs.length !== pairCount) throw new Error('The constructed route has the wrong number of two-tile patches.');
  const fixedCells = new Set<number>();
  for (let given = 0; given < pairCount - minimum; given++) {
    const pair = targetPairs.splice(Math.floor(random() * targetPairs.length), 1)[0];
    if (!pair) throw new Error('The constructor could not retain its opening road patches.');
    fixedCells.add(pair.start.row * size + pair.start.col);
    fixedCells.add((pair.start.row + pair.shape.rows - 1) * size + pair.start.col + pair.shape.cols - 1);
  }
  const insulated = (index: number): boolean => !geometry.geodesic[index] &&
    (geometry.neighbors[index] ?? []).every(next => !geometry.geodesic[next]);
  const starts = (shape: Shape): Cell[] => Array.from({ length: size * size }, (_, index) => ({
    row: Math.floor(index / size), col: index % size,
  })).filter(cell => cell.row + shape.rows <= size && cell.col + shape.cols <= size &&
    insulated(cell.row * size + cell.col) &&
    insulated((cell.row + shape.rows - 1) * size + cell.col + shape.cols - 1));
  const options = targetPairs.map(pair => starts(pair.shape));
  const order = targetPairs.map((_, index) => ({ index, order: random() }))
    .sort((a, b) => (options[a.index]?.length ?? 0) - (options[b.index]?.length ?? 0) || a.order - b.order);
  const stock = new Set<number>(), placements = new Map<number, Cell>();
  const clusterWeight = .6 + random() * 1.6;
  let packingVisits = 0;
  const pack = (position: number): boolean => {
    if (position === order.length) return true;
    if (++packingVisits > 4000) return false;
    const item = order[position], pair = item ? targetPairs[item.index] : null;
    if (!item || !pair) throw new Error('The stock packer lost a target pair.');
    const candidates = (options[item.index] ?? []).flatMap(cell => {
      const a = cell.row * size + cell.col, b = (cell.row + pair.shape.rows - 1) * size + cell.col + pair.shape.cols - 1;
      if (stock.has(a) || stock.has(b)) return [];
      const neighbors = [a, b].reduce((sum, index) => sum + (geometry.neighbors[index] ?? [])
        .filter(next => stock.has(next)).length, 0);
      return [{ cell, a, b, order: neighbors * clusterWeight + random() * 2 }];
    }).sort((a, b) => b.order - a.order);
    for (const candidate of candidates) {
      stock.add(candidate.a); stock.add(candidate.b); placements.set(item.index, candidate.cell);
      if (pack(position + 1)) return true;
      placements.delete(item.index); stock.delete(candidate.a); stock.delete(candidate.b);
    }
    return false;
  };
  if (!pack(0)) return { status: 'rejected', reason: 'stock-packing-budget' };
  const initial: Tile[][] = grid.map((line, row) => line.map((tile, col) => {
    if (isAnchor(tile) || fixedCells.has(row * size + col)) return tile;
    if (!geometry.geodesic[row * size + col] && !stock.has(row * size + col) && random() < .06) return 'x';
    return random() < .12 ? '~' : '.';
  }));
  const witness: Swap[] = [];
  const solveOrder = targetPairs.map((pair, index) => ({ pair, index, order: random() })).sort((a, b) => a.order - b.order);
  for (const { pair, index } of solveOrder) {
    const source = placements.get(index);
    if (!source) throw new Error('The packed stock is missing its certified source patch.');
    const line = initial[source.row], endLine = initial[source.row + pair.shape.rows - 1];
    if (!line || !endLine) throw new Error('The packed stock left its island.');
    line[source.col] = pair.tiles[0];
    endLine[source.col + pair.shape.cols - 1] = pair.tiles[1];
    witness.push({ ...pair.shape, a: source, b: pair.start });
  }
  const puzzle = { ...shell, board: initial.map(line => line.join('')), witness };
  try {
    certifyPairMinimum(puzzle);
  } catch (error) {
    if (error instanceof RuleError && error.code === 'journey_complexity') return { status: 'rejected', reason: 'route-verification-budget' };
    throw error;
  }
  return { status: 'constructed', puzzle, route };
}

export function constructMatchingRepair(minimum: number, seed: number, routePairs: number): PairConstruction {
  if (!Number.isInteger(minimum) || minimum < 3 || minimum > 12) throw new Error('Published matching-repair puzzles need a minimum from 3 through 12.');
  const base = constructPairChallenge(minimum - 1, seed, routePairs);
  if (base.status === 'rejected') return base;
  const geometry = pairGeometry(base.puzzle), size = geometry.size;
  const random = randomSource(seedOf(`detour:matching-repair:${minimum}:${routePairs}:${seed}`));
  const frames = [{ rows: 1, cols: 2 }, { rows: 2, cols: 1 }].flatMap(shape =>
    Array.from({ length: size ** 2 }, (_, index) => ({ row: Math.floor(index / size), col: index % size }))
      .filter(start => inspectPatch(base.puzzle.board, start, shape) === null)
      .map(start => ({ start, shape, cells: patchCells(start, shape) }))
      .filter(frame => frame.cells.every(cell => {
        const index = cell.row * size + cell.col;
        return !geometry.geodesic[index] && (geometry.neighbors[index] ?? []).every(next => !geometry.geodesic[next]);
      }))
      .map(frame => ({ ...frame, roads: frame.cells.filter(cell => walkable(base.puzzle.board[cell.row]?.[cell.col])).length })));
  const choices = frames.filter(frame => frame.roads > 0).flatMap(source =>
    frames.filter(target => target.roads === 0 && target.shape.rows === source.shape.rows &&
      !source.cells.some(a => target.cells.some(b => a.row === b.row && a.col === b.col)))
      .map(target => ({ move: { ...source.shape, a: source.start, b: target.start }, order: random() })))
    .sort((a, b) => a.order - b.order).slice(0, 64);
  for (const { move } of choices) {
    const board = applySwap(base.puzzle.board, move, rulesFor(base.puzzle, 'daily'), 0);
    const stock = analyzePairStock(board, geometry.geodesic);
    if (stock.initiallyMatchable || stock.boundaryStockCells) continue;
    const puzzle = { ...base.puzzle, id: `${base.puzzle.id}-repair`, board, minimum, witness: [move, ...base.puzzle.witness] };
    try { certifyPairMinimum(puzzle); }
    catch (error) {
      if (error instanceof RuleError && error.code === 'journey_complexity') continue;
      throw error;
    }
    return { status: 'constructed', puzzle, route: base.route };
  }
  return { status: 'rejected', reason: 'matching-repair-unavailable' };
}
