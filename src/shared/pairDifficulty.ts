import { applySwap, assertBoard, canTraverse, checkPuzzle, checkRoutes, isAnchor, legalSwaps, patchCells, RuleError, rulesFor, validateRepair, walkable } from './rules.ts';
import type { AuthoredPuzzle, Board, Puzzle } from './types.ts';

export interface PairGeometry {
  size: number;
  neighbors: readonly number[][];
  legs: readonly (readonly [number, number])[];
  geodesic: Uint8Array;
  requiredRoadTiles: number;
  possibleRoadCells: number;
}

export function pairGeometry(puzzle: Puzzle): PairGeometry {
  assertBoard(puzzle.board);
  const { journey } = puzzle;
  if (!journey || journey.length < 2) throw new Error('Pair difficulty needs an ordered home-to-home journey.');
  const size = puzzle.board.length, state = puzzle.board.join(''), count = state.length;
  const neighbors = Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / size), col = index % size;
    return [row > 0 ? index - size : -1, row + 1 < size ? index + size : -1,
      col > 0 ? index - 1 : -1, col + 1 < size ? index + 1 : -1].filter(next => next >= 0 && state[next] !== 'x');
  });
  const geodesic = new Uint8Array(count), legs: [number, number][] = [];
  let length = 0;
  for (let leg = 1; leg < journey.length; leg++) {
    const fromAnchor = journey[leg - 1], toAnchor = journey[leg];
    if (!fromAnchor || !toAnchor) throw new Error('The pair difficulty proof has an incomplete journey.');
    const from = state.indexOf(fromAnchor), to = state.indexOf(toAnchor);
    if (from < 0 || to < 0) throw new Error('The pair difficulty proof references a missing home.');
    const distances = (start: number): Int16Array => {
      const result = new Int16Array(count).fill(-1), queue = [start];
      result[start] = 0;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const index = queue[cursor];
        if (index === undefined) throw new Error('The pair geometry lost a search cell.');
        for (const next of neighbors[index] ?? []) {
          if (result[next] !== -1 || isAnchor(state[next]) && next !== from && next !== to) continue;
          result[next] = (result[index] ?? 0) + 1; queue.push(next);
        }
      }
      return result;
    };
    const a = distances(from), b = distances(to), distance = a[to];
    if (distance === undefined || distance < 1) throw new Error('The fixed landscape cannot connect the ordered homes.');
    length += distance; legs.push([from, to]);
    for (let index = 0; index < count; index++) {
      const first = a[index], second = b[index];
      if (first !== undefined && second !== undefined && first >= 0 && second >= 0 && first + second === distance) geodesic[index] = 1;
    }
  }
  return { size, neighbors, legs, geodesic, requiredRoadTiles: length + 1 - journey.length,
    possibleRoadCells: [...geodesic].filter((value, index) => value && !isAnchor(state[index])).length };
}

export interface PairMinimumCertificate {
  method: 'tight-road-inventory-and-geodesic-cut' | 'tight-road-inventory-and-matching-deficit';
  minimum: number;
  requiredRoadTiles: number;
  suppliedRoadTiles: number;
  initiallyOutsideGeodesics: number;
  maximumImportedPerSwap: 2;
  matchingLowerBoundBonus: 0 | 1;
}

export function certifyPairMinimum(puzzle: AuthoredPuzzle): PairMinimumCertificate {
  if (puzzle.area !== 2 || puzzle.frame !== undefined) throw new Error('The pair certificate supports only two-tile patches.');
  const geometry = pairGeometry(puzzle), state = puzzle.board.join('');
  const road = [...state].flatMap((tile, index) => walkable(tile) && !isAnchor(tile) ? [index] : []);
  if (road.length !== geometry.requiredRoadTiles) throw new Error('The pair certificate requires exactly the necessary road inventory, with no spare tiles.');
  const outside = road.filter(index => !geometry.geodesic[index]).length;
  const stock = analyzePairStock(puzzle.board, geometry.geodesic);
  const matchingLowerBoundBonus = outside % 2 === 0 && outside > 0 &&
    stock.boundaryStockCells === 0 && !stock.initiallyMatchable ? 1 : 0;
  const minimum = Math.ceil(outside / 2) + matchingLowerBoundBonus;
  // Tight inventory forces every successful leg to be geometrically shortest.
  // Insulated, unmatchable stock cannot all enter in maximum-import swaps:
  // those swaps would partition the original stock into a perfect domino matching.
  if (minimum < 1 || puzzle.witness.length !== minimum || puzzle.minimum !== minimum) {
    throw new Error('The legal witness does not match the proved minimum; a longer scramble is not a certificate.');
  }
  validateRepair(puzzle, 'daily', puzzle.witness);
  return { method: matchingLowerBoundBonus ? 'tight-road-inventory-and-matching-deficit' : 'tight-road-inventory-and-geodesic-cut',
    minimum, requiredRoadTiles: geometry.requiredRoadTiles, suppliedRoadTiles: road.length,
    initiallyOutsideGeodesics: outside, maximumImportedPerSwap: 2, matchingLowerBoundBonus };
}

export interface PairStockAnalysis {
  sourceCuts: number;
  minimumBreakingCuts: number;
  adjacencyStrandingCuts: number;
  boundaryStockCells: number;
  matchingPreservingCuts: number;
  branchedStockCells: number;
  components: number;
  initiallyMatchable: boolean;
}

export function analyzePairStock(board: Board, geodesic: Uint8Array): PairStockAnalysis {
  assertBoard(board);
  const size = board.length, state = board.join('');
  if (geodesic.length !== state.length) throw new Error('The source-stock analysis has the wrong geometry mask.');
  const stock = new Set([...state].flatMap((tile, index) => walkable(tile) && !isAnchor(tile) && !geodesic[index] ? [index] : []));
  const adjacent = (index: number): number[] => {
    const row = Math.floor(index / size), col = index % size;
    return [row ? index - size : -1, row + 1 < size ? index + size : -1,
      col ? index - 1 : -1, col + 1 < size ? index + 1 : -1].filter(next => stock.has(next));
  };
  const matchable = (omitA = -1, omitB = -1): boolean => {
    const matching = new Int16Array(state.length).fill(-1);
    const remaining = stock.size - Number(stock.has(omitA)) - Number(stock.has(omitB));
    if (remaining % 2) return false;
    let pairs = 0;
    for (const index of stock) {
      if (index === omitA || index === omitB || (Math.floor(index / size) + index % size) % 2) continue;
      const seen = new Uint8Array(state.length);
      const augment = (cell: number): boolean => {
        for (const next of adjacent(cell)) {
          if (next === omitA || next === omitB || seen[next]) continue;
          seen[next] = 1;
          const previous = matching[next];
          if (previous === undefined) throw new Error('The source matching lost a square.');
          if (previous < 0 || augment(previous)) { matching[next] = cell; return true; }
        }
        return false;
      };
      if (augment(index)) pairs++;
    }
    return pairs * 2 === remaining;
  };
  const boundaryStockCells = [...stock].filter(index => {
    const row = Math.floor(index / size), col = index % size;
    return [row ? index - size : -1, row + 1 < size ? index + size : -1,
      col ? index - 1 : -1, col + 1 < size ? index + 1 : -1].some(next => next >= 0 && geodesic[next] === 1);
  }).length;
  let sourceCuts = 0, adjacencyStrandingCuts = 0, branchedStockCells = 0, components = 0;
  const seen = new Set<number>();
  for (const index of stock) {
    const neighbors = adjacent(index);
    if (neighbors.length >= 3) branchedStockCells++;
    if (!seen.has(index)) {
      components++;
      const queue = [index]; seen.add(index);
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const current = queue[cursor];
        if (current === undefined) throw new Error('The stock component lost a square.');
        for (const next of adjacent(current)) if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    for (const next of neighbors) if (next > index) {
      sourceCuts++;
      if (!matchable(index, next)) adjacencyStrandingCuts++;
    }
  }
  // Boundary-straddling swaps can import two nonadjacent stock cells at once.
  const minimumBreakingCuts = boundaryStockCells === 0 && stock.size % 2 === 0 ? adjacencyStrandingCuts : 0;
  return { sourceCuts, minimumBreakingCuts, adjacencyStrandingCuts, boundaryStockCells,
    matchingPreservingCuts: sourceCuts - adjacencyStrandingCuts,
    branchedStockCells, components, initiallyMatchable: matchable() };
}

export interface PairGreedyProbe {
  bestMoves: number | null;
  examined: number;
  trials: number;
  candidatesPerStep: number;
  stepLimit: number;
  maximumJourneyStates: number;
  orderedDeadEnds: number;
}

export const PAIR_JOURNEY_STATE_BUDGET = 4000;

export function probePatchGreedy(puzzle: Puzzle, minimum: number): PairGreedyProbe {
  if (![2, 3, 4].includes(puzzle.area) || !Number.isInteger(minimum) || minimum < 1) {
    throw new Error('The patch greedy probe needs a supported frame and a positive certified minimum.');
  }
  const geometry = pairGeometry(puzzle), count = geometry.size ** 2;
  const original = puzzle.board.join('').replaceAll('~', '.');
  const moves = legalSwaps(puzzle.board, puzzle.area, puzzle.frame).map(move => {
    const a = patchCells(move.a, move).map(cell => cell.row * geometry.size + cell.col);
    const b = patchCells(move.b, move).map(cell => cell.row * geometry.size + cell.col);
    if (a.length !== puzzle.area || b.length !== puzzle.area) throw new Error('A greedy patch move lost its footprint.');
    return { a, b };
  });
  const scoreCache = new Map<string, number>();
  const distance = new Int16Array(count), visited = new Uint8Array(count);
  const score = (state: string): number => {
    const cached = scoreCache.get(state);
    if (cached !== undefined) return cached;
    let total = 0;
    for (const [from, to] of geometry.legs) {
      distance.fill(32767); visited.fill(0); distance[from] = 0;
      const buckets: number[][] = [[from], [], [], []], heads = [0, 0, 0, 0];
      let active = 1, cost = 0, reached = false;
      while (active) {
        const slot = cost % 4, bucket = buckets[slot], head = heads[slot];
        if (!bucket || head === undefined) throw new Error('The greedy distance queue lost a bucket.');
        if (head >= bucket.length) { cost++; continue; }
        const encoded = bucket[head];
        if (encoded === undefined) throw new Error('The greedy distance queue lost an entry.');
        heads[slot] = head + 1; active--;
        const index = encoded % count, encodedCost = Math.floor(encoded / count);
        if (visited[index] || distance[index] !== encodedCost) continue;
        if (index === to) { total += encodedCost; reached = true; break; }
        visited[index] = 1;
        for (const next of geometry.neighbors[index] ?? []) {
          if (visited[next] || isAnchor(state[next]) && next !== to) continue;
          const vertical = Math.abs(next - index) === geometry.size;
          const wrongAxis = Number(state[index] === 'h' && vertical || state[index] === 'v' && !vertical) +
            Number(state[next] === 'h' && vertical || state[next] === 'v' && !vertical);
          const candidate = encodedCost + Number(!walkable(state[next])) + wrongAxis;
          if (candidate >= (distance[next] ?? 32767)) continue;
          distance[next] = candidate;
          const nextBucket = buckets[candidate % 4];
          if (!nextBucket) throw new Error('The greedy distance queue lost a destination bucket.');
          nextBucket.push(candidate * count + next); active++;
        }
      }
      if (!reached) throw new Error('The greedy probe cannot cross the fixed landscape.');
    }
    total = total * 4 + [...state].filter((tile, index) => walkable(tile) && !isAnchor(tile) && !geometry.geodesic[index]).length;
    scoreCache.set(state, total);
    return total;
  };
  const placed = (tile: string | undefined, index: number): number => Number(walkable(tile) && !isAnchor(tile) && geometry.geodesic[index] === 1);
  const boardOf = (state: string): Board => Array.from({ length: geometry.size }, (_, row) => state.slice(row * geometry.size, (row + 1) * geometry.size));
  const candidatesPerStep = 256, stepLimit = minimum + 2;
  let bestMoves: number | null = null, examined = 0, trials = 0, maximumJourneyStates = 0, orderedDeadEnds = 0;
  const diagnostics = { explored: 0, limit: PAIR_JOURNEY_STATE_BUDGET };
  probe: for (const seed of [1, 23, 71]) {
    trials++;
    let state = original;
    const seen = new Set([state]);
    for (let step = 0; step <= stepLimit; step++) {
      const board = boardOf(state), check = checkPuzzle(board, puzzle, diagnostics);
      maximumJourneyStates = Math.max(maximumJourneyStates, diagnostics.explored);
      if (maximumJourneyStates > PAIR_JOURNEY_STATE_BUDGET) break probe;
      if (check.solved) { bestMoves = Math.min(bestMoves ?? step, step); break; }
      if (checkRoutes(board, puzzle.goals).solved) orderedDeadEnds++;
      if (step === stepLimit) break;
      const options = moves.flatMap(({ a, b }, index) => {
        let changed = false, improvement = 0;
        for (let cell = 0; cell < a.length; cell++) {
          const first = a[cell], second = b[cell];
          if (first === undefined || second === undefined) throw new Error('The greedy patch footprint is incomplete.');
          changed ||= state[first] !== state[second];
          improvement += placed(state[second], first) + placed(state[first], second) - placed(state[first], first) - placed(state[second], second);
        }
        if (!changed) return [];
        const tie = ((Math.imul(index + 1, 1664525) ^ Math.imul(seed + step + 1, 1013904223)) >>> 0) / 0x100000000;
        return [{ a, b, improvement, tie }];
      }).sort((a, b) => b.improvement - a.improvement || a.tie - b.tie).slice(0, candidatesPerStep);
      let best: string | null = null, rank = Infinity;
      for (const { a, b, tie } of options) {
        const cells = [...state];
        for (let cell = 0; cell < a.length; cell++) {
          const first = a[cell], second = b[cell];
          if (first === undefined || second === undefined) throw new Error('The greedy probe lost a patch square.');
          const av = state[first], bv = state[second];
          if (!av || !bv) throw new Error('The greedy probe moved outside its board.');
          cells[first] = bv; cells[second] = av;
        }
        const next = cells.join('');
        if (seen.has(next)) continue;
        examined++;
        const candidate = score(next) + tie * .001;
        if (candidate < rank) { rank = candidate; best = next; }
      }
      if (best === null) break;
      state = best; seen.add(state);
    }
    if (bestMoves === minimum) break;
  }
  return { bestMoves, examined, trials, candidatesPerStep, stepLimit, maximumJourneyStates, orderedDeadEnds };
}

export function probePairGreedy(puzzle: Puzzle, minimum: number): PairGreedyProbe {
  if (puzzle.area !== 2 || puzzle.frame !== undefined) throw new Error('The pair greedy probe supports only two-tile patches.');
  return probePatchGreedy(puzzle, minimum);
}

export interface PairRouteAnalysis {
  givenRoadTiles: number;
  initialJunctions: number;
  solvedJunctions: number;
  pressure: number;
  maximumJourneyStates: number;
  orderedDeadEnds: number;
}

export function pairRouteJunctions(board: Board, geodesic: Uint8Array): number {
  const size = board.length;
  if (geodesic.length !== size ** 2) throw new Error('The route-junction analysis has the wrong geometry mask.');
  let junctions = 0;
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    if (!geodesic[row * size + col] || !walkable(board[row]?.[col])) continue;
    const adjacent = [{ row: row - 1, col }, { row: row + 1, col }, { row, col: col - 1 }, { row, col: col + 1 }];
    if (adjacent.filter(next => next.row >= 0 && next.col >= 0 && next.row < size && next.col < size &&
      geodesic[next.row * size + next.col] && canTraverse(board, { row, col }, next)).length >= 3) junctions++;
  }
  return junctions;
}

export function analyzePairRoute(puzzle: AuthoredPuzzle, geometry = pairGeometry(puzzle)): PairRouteAnalysis {
  let board = puzzle.board, maximumJourneyStates = 0, orderedDeadEnds = 0;
  const diagnostics = { explored: 0, limit: PAIR_JOURNEY_STATE_BUDGET }, rules = rulesFor(puzzle, 'daily');
  for (let step = 0; step <= puzzle.witness.length; step++) {
    const check = checkPuzzle(board, puzzle, diagnostics);
    maximumJourneyStates = Math.max(maximumJourneyStates, diagnostics.explored);
    if (!check.solved && checkRoutes(board, puzzle.goals).solved) orderedDeadEnds++;
    const move = puzzle.witness[step];
    if (move) board = applySwap(board, move, rules, step);
  }
  const initialJunctions = pairRouteJunctions(puzzle.board, geometry.geodesic);
  const solvedJunctions = pairRouteJunctions(board, geometry.geodesic);
  const givenRoadTiles = [...puzzle.board.join('')].filter((tile, index) =>
    geometry.geodesic[index] && walkable(tile) && !isAnchor(tile)).length;
  return { givenRoadTiles, initialJunctions, solvedJunctions, pressure: solvedJunctions * 2 + initialJunctions,
    maximumJourneyStates, orderedDeadEnds };
}

export interface PairChallengeEvaluation {
  boardSize: number;
  certificate: PairMinimumCertificate;
  stock: PairStockAnalysis;
  initialStock?: PairStockAnalysis;
  possibleRoadCells: number;
  greedy: PairGreedyProbe;
  route: PairRouteAnalysis;
}

type PairDifficultySignal = Pick<PairChallengeEvaluation, 'boardSize' | 'certificate' | 'stock' | 'route'>;

export function pairPlanningScore(signal: PairDifficultySignal): number {
  return signal.certificate.minimum * 8 + signal.route.pressure * 4 + signal.stock.minimumBreakingCuts +
    (signal.certificate.matchingLowerBoundBonus ?? 0) * 4;
}

export function pairDifficultyRegresses(previous: PairDifficultySignal, next: PairDifficultySignal): boolean {
  return next.certificate.minimum < previous.certificate.minimum || next.boardSize < previous.boardSize ||
    next.route.pressure < previous.route.pressure || pairPlanningScore(next) < pairPlanningScore(previous);
}

export function evaluatePairChallenge(puzzle: AuthoredPuzzle, previous?: PairChallengeEvaluation):
  { status: 'accepted'; evaluation: PairChallengeEvaluation } | { status: 'rejected'; reason: string } {
  const certificate = certifyPairMinimum(puzzle), geometry = pairGeometry(puzzle);
  const initialStock = analyzePairStock(puzzle.board, geometry.geodesic);
  let stock = initialStock;
  if (initialStock.boundaryStockCells) return { status: 'rejected', reason: 'boundary-stock-needs-general-matching' };
  if (certificate.matchingLowerBoundBonus) {
    const repair = puzzle.witness[0];
    if (!repair) throw new Error('The matching-repair witness is missing.');
    stock = analyzePairStock(applySwap(puzzle.board, repair, rulesFor(puzzle, 'daily'), 0), geometry.geodesic);
    if (!stock.initiallyMatchable) return { status: 'rejected', reason: 'matching-repair-not-demonstrated' };
  } else if (!stock.initiallyMatchable) return { status: 'rejected', reason: 'stock-cannot-meet-minimum' };
  const traps = certificate.matchingLowerBoundBonus ? Math.max(0, Math.floor((certificate.minimum - 1) / 2) - 1) :
    Math.max(1, Math.floor(certificate.minimum / 2));
  if (stock.minimumBreakingCuts < traps) return { status: 'rejected', reason: 'too-few-planning-traps' };
  if (certificate.minimum >= 6 && stock.branchedStockCells < 2) return { status: 'rejected', reason: 'stock-too-obvious' };
  if (geometry.possibleRoadCells < certificate.requiredRoadTiles + Math.max(3, certificate.minimum)) return { status: 'rejected', reason: 'obvious-geodesic-corridor' };
  try {
    const route = analyzePairRoute(puzzle, geometry);
    if (route.maximumJourneyStates > PAIR_JOURNEY_STATE_BUDGET) return { status: 'rejected', reason: 'runtime-route-check-budget' };
    if (previous && pairDifficultyRegresses(previous, { certificate, boardSize: geometry.size, stock, route })) {
      return { status: 'rejected', reason: 'global-difficulty-regression' };
    }
    const greedy = probePairGreedy(puzzle, certificate.minimum);
    if (greedy.maximumJourneyStates > PAIR_JOURNEY_STATE_BUDGET) return { status: 'rejected', reason: 'runtime-route-check-budget' };
    if (greedy.bestMoves === certificate.minimum) return { status: 'rejected', reason: 'greedy-optimal' };
    return { status: 'accepted', evaluation: { boardSize: geometry.size, certificate, stock, initialStock,
      possibleRoadCells: geometry.possibleRoadCells, greedy, route } };
  } catch (error) {
    if (error instanceof RuleError && error.code === 'journey_complexity') return { status: 'rejected', reason: 'runtime-route-check-budget' };
    throw error;
  }
}
