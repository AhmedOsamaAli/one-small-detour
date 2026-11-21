import assert from 'node:assert/strict';
import test from 'node:test';
import { constructPairChallenge, pairProgressionTarget } from './pairGeneration.ts';
import { analyzePairRoute, analyzePairStock, certifyPairMinimum, evaluatePairChallenge, PAIR_JOURNEY_STATE_BUDGET, pairDifficultyRegresses, pairGeometry, pairRouteJunctions } from './pairDifficulty.ts';
import { applySwap, checkPuzzle, isAnchor, legalSwaps, patchCells, rulesFor, validateRepair, walkable } from './rules.ts';
import type { Board } from './types.ts';

test('constructed small and large pair challenges have exact stock-cut minimum certificates and no spare road', () => {
  for (const [minimum, seed] of [[3, 11], [12, 49]]) {
    assert.ok(minimum !== undefined && seed !== undefined);
    const result = constructPairChallenge(minimum, seed);
    if (result.status !== 'constructed') throw new Error(result.reason);
    const certificate = certifyPairMinimum(result.puzzle);
    assert.equal(certificate.minimum, minimum);
    assert.equal(certificate.initiallyOutsideGeodesics, minimum * 2);
    assert.equal(certificate.suppliedRoadTiles, certificate.requiredRoadTiles);
    const solved = validateRepair(result.puzzle, 'daily', result.puzzle.witness);
    assert.equal(checkPuzzle(solved.board, result.puzzle).journey?.path.length,
      certificate.suppliedRoadTiles + (result.puzzle.journey?.length ?? 0));
    const geometry = pairGeometry(result.puzzle);
    assert.equal(analyzePairStock(result.puzzle.board, geometry.geodesic).boundaryStockCells, 0);
  }
});

test('a legal wasted exchange cannot be passed off as a larger minimum', () => {
  const result = constructPairChallenge(3, 11);
  if (result.status !== 'constructed') throw new Error(result.reason);
  const { puzzle } = result;
  const noop = legalSwaps(puzzle.board, 2).find(move =>
    JSON.stringify(applySwap(puzzle.board, move, rulesFor(puzzle, 'daily'))) === JSON.stringify(puzzle.board));
  assert.ok(noop);
  const padded = { ...puzzle, minimum: 4, witness: [noop, ...puzzle.witness] };
  validateRepair(padded, 'daily', padded.witness);
  assert.throws(() => certifyPairMinimum(padded), /longer scramble is not a certificate/);
});

test('adding a spare road tile is rejected even when a witness exists', () => {
  const result = constructPairChallenge(3, 11);
  if (result.status !== 'constructed') throw new Error(result.reason);
  const { puzzle } = result;
  const row = puzzle.board.findIndex(line => line.includes('.'));
  const line = puzzle.board[row];
  assert.ok(line);
  const col = line.indexOf('.');
  const extra = puzzle.board.map((value, index) => index === row ? value.slice(0, col) + 'o' + value.slice(col + 1) : value);
  assert.throws(() => certifyPairMinimum({ ...puzzle, board: extra }), /no spare tiles/);
});

test('stock matching distinguishes a stranding middle cut from an end cut and guards boundary rescues', () => {
  const board: Board = ['A....B', '......', '......', '......', '......', 'oooooo'];
  const mask = new Uint8Array(36);
  const insulated = analyzePairStock(board, mask);
  assert.equal(insulated.initiallyMatchable, true);
  assert.equal(insulated.sourceCuts, 5);
  assert.equal(insulated.minimumBreakingCuts, 2);
  assert.equal(insulated.matchingPreservingCuts, 3);
  mask[24] = 1;
  const boundary = analyzePairStock(board, mask);
  assert.ok(boundary.boundaryStockCells > 0);
  assert.equal(boundary.adjacencyStrandingCuts, 2);
  assert.equal(boundary.minimumBreakingCuts, 0);
});

test('same-par routes can add real givens and late boards can grow without adding unnecessary road', () => {
  for (const [minimum, pairs, size] of [[3, 5, 8], [7, 14, 12], [12, 18, 12]]) {
    assert.ok(minimum !== undefined && pairs !== undefined && size !== undefined);
    const built = constructPairChallenge(minimum, 1, pairs);
    if (built.status !== 'constructed') throw new Error(built.reason);
    const certificate = certifyPairMinimum(built.puzzle), route = analyzePairRoute(built.puzzle);
    assert.equal(built.puzzle.board.length, size);
    assert.equal(certificate.minimum, minimum);
    assert.equal(certificate.suppliedRoadTiles, pairs * 2);
    assert.equal(certificate.suppliedRoadTiles, certificate.requiredRoadTiles);
    assert.equal(route.givenRoadTiles, (pairs - minimum) * 2);
    assert.ok(route.maximumJourneyStates <= PAIR_JOURNEY_STATE_BUDGET);
  }
});

test('road junctions exclude parking stock and count actual bridge-axis connections, not visual contact', () => {
  const board: Board = ['....o.', '...ooo', '....o.', '.o....', 'ooo...', '......'];
  const mask = new Uint8Array(36);
  for (const index of [19, 24, 25, 26]) mask[index] = 1;
  assert.equal(pairRouteJunctions(board, mask), 1);
  assert.equal(pairRouteJunctions(board, new Uint8Array(36).fill(1)), 2);
  assert.equal(pairRouteJunctions(board.map((row, index) => index === 4 ? 'oho...' : row), mask), 0);
  assert.equal(pairRouteJunctions(board.map((row, index) => index === 3 ? '.h....' : row), mask), 0);
});

test('absolute-slot progression never restarts at island boundaries and caps moves and supported size', () => {
  const targets = Array.from({ length: 1000 }, (_, slot) => pairProgressionTarget(slot));
  assert.deepEqual(targets.slice(0, 7).map(target => target.minimum), [3, 3, 3, 4, 4, 4, 5]);
  for (let slot = 1; slot < targets.length; slot++) {
    const before = targets[slot - 1], after = targets[slot];
    assert.ok(before && after);
    assert.ok(after.minimum >= before.minimum && after.size >= before.size && after.routePairs >= before.routePairs);
    assert.ok(after.minimum <= 12 && after.size <= 12 && after.routePairs > after.minimum);
  }
  for (const stop of [20, 40]) {
    const before = targets[stop - 1], after = targets[stop];
    assert.ok(before && after);
    assert.ok(after.minimum > 3 && after.minimum >= before.minimum);
  }
  assert.throws(() => pairProgressionTarget(-1), /absolute/);
});

test('evaluation accepts measured planning choices, not merely a long construction', () => {
  const result = constructPairChallenge(12, 49);
  if (result.status !== 'constructed') throw new Error(result.reason);
  const evaluated = evaluatePairChallenge(result.puzzle);
  if (evaluated.status !== 'accepted') throw new Error(evaluated.reason);
  assert.ok(evaluated.evaluation.stock.minimumBreakingCuts >= 6);
  assert.ok(evaluated.evaluation.stock.branchedStockCells >= 2);
  assert.notEqual(evaluated.evaluation.greedy.bestMoves, 12);
  assert.ok(evaluated.evaluation.route.maximumJourneyStates <= PAIR_JOURNEY_STATE_BUDGET);
  assert.ok(evaluated.evaluation.greedy.maximumJourneyStates <= PAIR_JOURNEY_STATE_BUDGET);
  const higherPressure = { ...evaluated.evaluation, route: { ...evaluated.evaluation.route, pressure: evaluated.evaluation.route.pressure + 1 } };
  assert.equal(pairDifficultyRegresses(higherPressure, evaluated.evaluation), true);
  assert.equal(pairDifficultyRegresses(evaluated.evaluation, higherPressure), false);
  const moreStockTraps = { ...evaluated.evaluation, stock: { ...evaluated.evaluation.stock,
    minimumBreakingCuts: evaluated.evaluation.stock.minimumBreakingCuts + 1 } };
  assert.equal(pairDifficultyRegresses(moreStockTraps, higherPressure), false,
    'A harder road web may compensate for fewer stock traps, instead of forcing an artificial trap-count cliff.');
  const geometry = pairGeometry(result.puzzle);
  const wrong = legalSwaps(result.puzzle.board, 2).find(move => {
    const cells = [...patchCells(move.a, move), ...patchCells(move.b, move)];
    const stock = cells.filter(cell => !geometry.geodesic[cell.row * geometry.size + cell.col] &&
      walkable(result.puzzle.board[cell.row]?.[cell.col]) && !isAnchor(result.puzzle.board[cell.row]?.[cell.col]));
    const gaps = cells.filter(cell => geometry.geodesic[cell.row * geometry.size + cell.col] &&
      !walkable(result.puzzle.board[cell.row]?.[cell.col]));
    return stock.length === 2 && gaps.length === 2 &&
      !analyzePairStock(applySwap(result.puzzle.board, move, rulesFor(result.puzzle, 'daily')), geometry.geodesic).initiallyMatchable;
  });
  assert.ok(wrong, 'A real minimum-breaking stock cut should be legal, but recoverable rather than a soft lock.');
  assert.equal(validateRepair(result.puzzle, 'daily', [wrong, wrong, ...result.puzzle.witness]).swaps, 14);
  const repeated = constructPairChallenge(12, 49);
  if (repeated.status !== 'constructed') throw new Error(repeated.reason);
  assert.deepEqual(repeated.puzzle.board, result.puzzle.board);
  assert.deepEqual(repeated.puzzle.witness, result.puzzle.witness);
});
