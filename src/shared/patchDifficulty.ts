import { analyzePairRoute, pairGeometry, PAIR_JOURNEY_STATE_BUDGET, probePatchGreedy } from './pairDifficulty.ts';
import type { PairGeometry, PairGreedyProbe, PairRouteAnalysis } from './pairDifficulty.ts';
import { applySwap, inspectPatch, isAnchor, patchCells, RuleError, rulesFor, shapesFor, validateRepair, walkable } from './rules.ts';
import type { AuthoredPuzzle, Board, Puzzle } from './types.ts';

export interface StockCover {
  status: 'covered' | 'impossible' | 'limit';
  placements: number;
  branchingCells: number;
  explored: number;
}

export function patchStockInsulation(puzzle: Puzzle, geometry = pairGeometry(puzzle)): Uint8Array {
  const size = geometry.size, count = size ** 2, distance = new Int16Array(count).fill(-1), queue: number[] = [];
  const diameter = Math.max(...shapesFor(puzzle.area, size, puzzle.frame).map(shape => {
    const cells = patchCells({ row: 0, col: 0 }, shape);
    return Math.max(...cells.flatMap(a => cells.map(b => Math.abs(a.row - b.row) + Math.abs(a.col - b.col))));
  }));
  for (let index = 0; index < count; index++) if (geometry.geodesic[index]) { distance[index] = 0; queue.push(index); }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    if (index === undefined) throw new Error('The frame insulation lost a landscape cell.');
    const row = Math.floor(index / size), col = index % size;
    for (const next of [row > 0 ? index - size : -1, row + 1 < size ? index + size : -1,
      col > 0 ? index - 1 : -1, col + 1 < size ? index + 1 : -1]) {
      if (next < 0 || distance[next] !== -1) continue;
      distance[next] = (distance[index] ?? 0) + 1; queue.push(next);
    }
  }
  return Uint8Array.from(distance, value => Number(value > diameter));
}

export function coverPatchStock(puzzle: Puzzle, board: Board, geometry = pairGeometry(puzzle), omit: readonly number[] = []): StockCover {
  const size = board.length, state = board.join(''), excluded = new Set(omit);
  const stock = [...state].flatMap((tile, index) => !excluded.has(index) && walkable(tile) && !isAnchor(tile) &&
    !geometry.geodesic[index] ? [index] : []);
  const all = new Set(stock);
  const placements = shapesFor(puzzle.area, size, puzzle.frame).flatMap(shape =>
    stock.flatMap(index => {
      const start = { row: Math.floor(index / size), col: index % size };
      if (inspectPatch(board, start, shape)) return [];
      const cells = patchCells(start, shape).map(cell => cell.row * size + cell.col);
      return cells.every(cell => all.has(cell)) ? [cells] : [];
    }));
  const byCell = new Map(stock.map(cell => [cell, placements.filter(placement => placement.includes(cell))]));
  let explored = 0, limited = false;
  const dead = new Set<string>();
  const visit = (): boolean => {
    if (!all.size) return true;
    if (++explored > 20000) { limited = true; return false; }
    const key = [...all].sort((a, b) => a - b).join(',');
    if (dead.has(key)) return false;
    let options: number[][] | null = null;
    for (const cell of all) {
      const candidates = (byCell.get(cell) ?? []).filter(placement => placement.every(index => all.has(index)));
      if (!candidates.length) { dead.add(key); return false; }
      if (!options || candidates.length < options.length) options = candidates;
      if (options.length === 1) break;
    }
    for (const placement of options ?? []) {
      placement.forEach(cell => all.delete(cell));
      const solved = visit();
      placement.forEach(cell => all.add(cell));
      if (solved) return true;
      if (limited) return false;
    }
    dead.add(key); return false;
  };
  const covered = stock.length % puzzle.area === 0 && visit();
  return { status: covered ? 'covered' : limited ? 'limit' : 'impossible', placements: placements.length,
    branchingCells: stock.filter(cell => (byCell.get(cell)?.length ?? 0) > 1).length, explored };
}

export interface PatchCertificate {
  method: 'tight-inventory-and-frame-import-cut' | 'tight-inventory-and-impossible-stock-cover';
  minimum: number;
  suppliedRoadTiles: number;
  requiredRoadTiles: number;
  outsideRoadTiles: number;
  maximumImportedPerSwap: number;
  preparationMovesProved: 0 | 1;
}
export interface PatchEvaluation {
  boardSize: number;
  certificate: PatchCertificate;
  route: PairRouteAnalysis;
  cover: StockCover;
  initialCover: StockCover;
  stockInsulated: boolean;
  temptingCuts: number;
  minimumBreakingCuts: number;
  greedy: PairGreedyProbe;
}

function boundaryStock(board: Board, geometry: PairGeometry): boolean {
  return [...board.join('')].some((tile, index) => walkable(tile) && !isAnchor(tile) && !geometry.geodesic[index] &&
    (geometry.neighbors[index] ?? []).some(next => geometry.geodesic[next]));
}

export function certifyPatchMinimum(puzzle: AuthoredPuzzle): PatchCertificate {
  const geometry = pairGeometry(puzzle), state = puzzle.board.join('');
  const supplied = [...state].filter(tile => walkable(tile) && !isAnchor(tile)).length;
  if (supplied !== geometry.requiredRoadTiles) throw new Error('Every paving or bridge tile must be necessary; spare road stock is rejected.');
  const outside = [...state].filter((tile, index) => walkable(tile) && !isAnchor(tile) && !geometry.geodesic[index]).length;
  if (outside === 0 || outside % puzzle.area !== 0) throw new Error('The frame import certificate needs complete outside cargo.');
  const cover = coverPatchStock(puzzle, puzzle.board, geometry);
  if (cover.status === 'limit') throw new RuleError('The offline stock-cover proof exceeded its budget.', 'stock_cover_budget');
  const insulation = patchStockInsulation(puzzle, geometry);
  const insulated = [...state].every((tile, index) => !walkable(tile) || isAnchor(tile) || geometry.geodesic[index] || insulation[index]);
  const preparationMovesProved = cover.status === 'impossible' && insulated ? 1 : 0;
  const minimum = outside / puzzle.area + preparationMovesProved;
  if (puzzle.minimum !== minimum || puzzle.witness.length !== minimum) {
    throw new Error('The legal witness must attain the independently proved frame import lower bound.');
  }
  validateRepair(puzzle, 'daily', puzzle.witness);
  return { method: preparationMovesProved ? 'tight-inventory-and-impossible-stock-cover' : 'tight-inventory-and-frame-import-cut',
    minimum, suppliedRoadTiles: supplied, requiredRoadTiles: geometry.requiredRoadTiles,
    outsideRoadTiles: outside, maximumImportedPerSwap: puzzle.area, preparationMovesProved };
}

export function patchPlanningScore(evaluation: Pick<PatchEvaluation, 'certificate' | 'route' | 'minimumBreakingCuts'>): number {
  return 8 * evaluation.certificate.minimum + 4 * evaluation.route.pressure +
    Math.min(12, evaluation.minimumBreakingCuts) + 4 * evaluation.certificate.preparationMovesProved;
}

export function evaluatePatchChallenge(puzzle: AuthoredPuzzle, rejectGreedy = true):
  { status: 'accepted'; evaluation: PatchEvaluation } | { status: 'rejected'; reason: string } {
  try {
    const certificate = certifyPatchMinimum(puzzle), geometry = pairGeometry(puzzle);
    const insulation = patchStockInsulation(puzzle, geometry);
    if (boundaryStock(puzzle.board, geometry)) return { status: 'rejected', reason: 'stock-boundary-shortcut' };
    const stockInsulated = [...puzzle.board.join('')].every((tile, index) =>
      !walkable(tile) || isAnchor(tile) || geometry.geodesic[index] || insulation[index]);
    const route = analyzePairRoute(puzzle, geometry);
    if (route.maximumJourneyStates > PAIR_JOURNEY_STATE_BUDGET) return { status: 'rejected', reason: 'runtime-route-budget' };
    const initialCover = coverPatchStock(puzzle, puzzle.board, geometry);
    const repair = puzzle.witness[0];
    const prepared = certificate.preparationMovesProved && repair ? applySwap(puzzle.board, repair, rulesFor(puzzle, 'daily'), 0) : puzzle.board;
    const cover = coverPatchStock(puzzle, prepared, geometry);
    if (cover.status !== 'covered') return { status: 'rejected', reason: 'missing-preparation-witness' };
    const source = prepared.join(''), size = prepared.length;
    const choices = shapesFor(puzzle.area, size, puzzle.frame).flatMap(shape =>
      Array.from({ length: size ** 2 }, (_, index) => ({ row: Math.floor(index / size), col: index % size }))
        .filter(start => inspectPatch(prepared, start, shape) === null)
        .map(start => patchCells(start, shape).map(cell => cell.row * size + cell.col))
        .filter(cells => cells.every(index => walkable(source[index]) && !isAnchor(source[index]) && !geometry.geodesic[index])));
    let minimumBreakingCuts = 0;
    for (const cells of choices) {
      const remaining = coverPatchStock(puzzle, prepared, geometry, cells);
      if (remaining.status === 'limit') return { status: 'rejected', reason: 'stock-cover-budget' };
      if (stockInsulated && remaining.status === 'impossible') minimumBreakingCuts++;
    }
    const greedy = probePatchGreedy(puzzle, certificate.minimum);
    if (greedy.maximumJourneyStates > PAIR_JOURNEY_STATE_BUDGET) return { status: 'rejected', reason: 'runtime-greedy-route-budget' };
    if (rejectGreedy && greedy.bestMoves === certificate.minimum) return { status: 'rejected', reason: 'trivial-greedy-optimum' };
    return { status: 'accepted', evaluation: { boardSize: size, certificate, route, cover, initialCover, stockInsulated,
      temptingCuts: choices.length, minimumBreakingCuts, greedy } };
  } catch (error) {
    if (error instanceof RuleError && (error.code === 'journey_complexity' || error.code === 'stock_cover_budget')) {
      return { status: 'rejected', reason: error.code };
    }
    throw error;
  }
}
