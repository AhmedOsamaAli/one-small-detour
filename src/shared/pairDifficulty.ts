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
  method: 'tight-road-inventory-and-geodesic-cut';
  minimum: number;
  requiredRoadTiles: number;
  suppliedRoadTiles: number;
  initiallyOutsideGeodesics: number;
  maximumImportedPerSwap: 2;
}

export function certifyPairMinimum(puzzle: AuthoredPuzzle): PairMinimumCertificate {
  if (puzzle.area !== 2 || puzzle.frame !== undefined) throw new Error('The pair certificate supports only two-tile patches.');
  const geometry = pairGeometry(puzzle), state = puzzle.board.join('');
  const road = [...state].flatMap((tile, index) => walkable(tile) && !isAnchor(tile) ? [index] : []);
  if (road.length !== geometry.requiredRoadTiles) throw new Error('The pair certificate requires exactly the necessary road inventory, with no spare tiles.');
  const outside = road.filter(index => !geometry.geodesic[index]).length;
  const minimum = Math.ceil(outside / 2);
  // Tight inventory forces every successful leg to be geometrically shortest.
  // All outside stock must therefore enter that union, at most two tiles per swap.
  if (minimum < 1 || puzzle.witness.length !== minimum || puzzle.minimum !== minimum) {
    throw new Error('The legal witness does not match the proved minimum; a longer scramble is not a certificate.');
  }
  validateRepair(puzzle, 'daily', puzzle.witness);
  return { method: 'tight-road-inventory-and-geodesic-cut', minimum, requiredRoadTiles: geometry.requiredRoadTiles,
    suppliedRoadTiles: road.length, initiallyOutsideGeodesics: outside, maximumImportedPerSwap: 2 };
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

export function probePairGreedy(puzzle: Puzzle, minimum: number): PairGreedyProbe {
  if (puzzle.area !== 2 || puzzle.frame !== undefined || !Number.isInteger(minimum) || minimum < 1) {
    throw new Error('The pair greedy probe needs a two-tile puzzle and a positive certified minimum.');
  }
  const geometry = pairGeometry(puzzle), count = geometry.size ** 2;
  const original = puzzle.board.join('').replaceAll('~', '.');
  const moves = legalSwaps(puzzle.board, 2).map(move => {
    const a = patchCells(move.a, move).map(cell => cell.row * geometry.size + cell.col);
    const b = patchCells(move.b, move).map(cell => cell.row * geometry.size + cell.col);
    const [a0, a1] = a, [b0, b1] = b;
    if (a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined) throw new Error('A greedy pair move lost its two squares.');
    return { indices: [a0, a1, b0, b1] as const, move };
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
  const diagnostics = { explored: 0 };
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
      const options = moves.flatMap(({ indices }, index) => {
        const [a, b, c, d] = indices;
        if (state[a] === state[c] && state[b] === state[d]) return [];
        const improvement = placed(state[c], a) + placed(state[d], b) + placed(state[a], c) + placed(state[b], d) -
          placed(state[a], a) - placed(state[b], b) - placed(state[c], c) - placed(state[d], d);
        const tie = ((Math.imul(index + 1, 1664525) ^ Math.imul(seed + step + 1, 1013904223)) >>> 0) / 0x100000000;
        return [{ indices, improvement, tie }];
      }).sort((a, b) => b.improvement - a.improvement || a.tie - b.tie).slice(0, candidatesPerStep);
      let best: string | null = null, rank = Infinity;
      for (const { indices: [a, b, c, d], tie } of options) {
        const cells = [...state], av = state[a], bv = state[b], cv = state[c], dv = state[d];
        if (!av || !bv || !cv || !dv) throw new Error('The greedy probe moved outside its board.');
        cells[a] = cv; cells[b] = dv; cells[c] = av; cells[d] = bv;
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
  const diagnostics = { explored: 0 }, rules = rulesFor(puzzle, 'daily');
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
  possibleRoadCells: number;
  greedy: PairGreedyProbe;
  route: PairRouteAnalysis;
}

type PairDifficultySignal = Pick<PairChallengeEvaluation, 'boardSize' | 'certificate' | 'stock' | 'route'>;

export function pairPlanningScore(signal: PairDifficultySignal): number {
  return signal.certificate.minimum * 8 + signal.route.pressure * 4 + signal.stock.minimumBreakingCuts;
}

export function pairDifficultyRegresses(previous: PairDifficultySignal, next: PairDifficultySignal): boolean {
  return next.certificate.minimum < previous.certificate.minimum || next.boardSize < previous.boardSize ||
    next.route.pressure < previous.route.pressure || pairPlanningScore(next) < pairPlanningScore(previous);
}

export function evaluatePairChallenge(puzzle: AuthoredPuzzle, previous?: PairChallengeEvaluation):
  { status: 'accepted'; evaluation: PairChallengeEvaluation } | { status: 'rejected'; reason: string } {
  const certificate = certifyPairMinimum(puzzle), geometry = pairGeometry(puzzle);
  const stock = analyzePairStock(puzzle.board, geometry.geodesic);
  if (stock.boundaryStockCells) return { status: 'rejected', reason: 'boundary-stock-needs-general-matching' };
  if (!stock.initiallyMatchable) return { status: 'rejected', reason: 'stock-cannot-meet-minimum' };
  if (stock.minimumBreakingCuts < Math.max(1, Math.floor(certificate.minimum / 2))) return { status: 'rejected', reason: 'too-few-planning-traps' };
  if (certificate.minimum >= 6 && stock.branchedStockCells < 2) return { status: 'rejected', reason: 'stock-too-obvious' };
  if (geometry.possibleRoadCells < certificate.requiredRoadTiles + Math.max(3, certificate.minimum)) return { status: 'rejected', reason: 'obvious-geodesic-corridor' };
  try {
    const route = analyzePairRoute(puzzle, geometry);
    if (route.maximumJourneyStates > PAIR_JOURNEY_STATE_BUDGET) return { status: 'rejected', reason: 'runtime-route-check-budget' };
    if (previous && pairDifficultyRegresses(previous, { certificate, boardSize: geometry.size, stock, route })) {
      return { status: 'rejected', reason: 'global-difficulty-regression' };
    }
    if (certificate.minimum < 12 && previous?.certificate.minimum === certificate.minimum &&
        (route.pressure <= previous.route.pressure || route.initialJunctions <= previous.route.initialJunctions)) {
      return { status: 'rejected', reason: 'same-par-road-web-not-harder' };
    }
    const greedy = probePairGreedy(puzzle, certificate.minimum);
    if (greedy.maximumJourneyStates > PAIR_JOURNEY_STATE_BUDGET) return { status: 'rejected', reason: 'runtime-route-check-budget' };
    if (greedy.bestMoves === certificate.minimum) return { status: 'rejected', reason: 'greedy-optimal' };
    return { status: 'accepted', evaluation: { boardSize: geometry.size, certificate, stock,
      possibleRoadCells: geometry.possibleRoadCells, greedy, route } };
  } catch (error) {
    if (error instanceof RuleError && error.code === 'journey_complexity') return { status: 'rejected', reason: 'runtime-route-check-budget' };
    throw error;
  }
}
