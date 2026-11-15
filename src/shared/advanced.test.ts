import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDailyChallenge } from './generation.ts';
import { certifyMinimum } from './difficulty.ts';
import { applySwap, checkPuzzle, findRoute, inspectPatch, legalSwaps, MAX_EXCHANGES, patchProblem, planJourney, selectionIssue, validateRepair } from './rules.ts';
import { JourneyPlayer } from './playback.ts';
import type { Board } from './types.ts';

test('bridges connect only along their planks, in both directions', () => {
  const horizontal: Board = ['AhB...', '......', '......', '......', '......', '......'];
  assert.ok(findRoute(horizontal, { from: 'A', to: 'B' }));
  assert.ok(findRoute(horizontal, { from: 'B', to: 'A' }));
  assert.equal(findRoute(['AvB...', ...horizontal.slice(1)], { from: 'A', to: 'B' }), null);
  assert.ok(findRoute(['A.....', 'v.....', 'B.....', '......', '......', '......'], { from: 'A', to: 'B' }));
  assert.equal(findRoute(['Ah....', '.oB...', '......', '......', '......', '......'], { from: 'A', to: 'B' }), null);
});

test('fixed boulders cannot be cut or traversed', () => {
  const board: Board = ['AoxooB', '......', '......', '......', '......', '......'];
  assert.match(patchProblem(board, { row: 0, col: 2 }, { rows: 1, cols: 2 }) ?? '', /boulder/i);
  assert.equal(findRoute(board, { from: 'A', to: 'B' }), null);
  assert.throws(() => applySwap(board, { a: { row: 0, col: 2 }, b: { row: 2, col: 2 }, rows: 1, cols: 2 },
    { areas: [2], budget: MAX_EXCHANGES }));
});

test('advanced maps certify actual minimums through fifteen, including fixed rocks and bridge stock', () => {
  for (const minimum of [1, 2, 5, 7, 10, 12, 15]) {
    for (const seed of [71, 802, 9031]) {
      const puzzle = generateDailyChallenge({ id: `test-${minimum}-${seed}`, title: 'A checked expedition', minimum, seed, chapter: 1 });
      assert.equal(certifyMinimum(puzzle), minimum);
      assert.equal(puzzle.budget, MAX_EXCHANGES);
      const result = validateRepair(puzzle, 'daily', puzzle.witness);
      assert.equal(checkPuzzle(result.board, puzzle).solved, true);
      if (minimum > 6) {
        assert.ok(puzzle.board.join('').includes('x'));
        assert.match(puzzle.board.join(''), /[hv]/);
      }
    }
  }
});

test('long attempts can use more than fifteen exchanges and then submit a real repair', () => {
  const puzzle = generateDailyChallenge({ id: 'long-attempt', title: 'Keep trying', minimum: 2, seed: 571, chapter: 1 });
  const reversible = legalSwaps(puzzle.board, 2)[0];
  assert.ok(reversible);
  const exploration = Array.from({ length: 16 }, () => reversible);
  const moves = [...exploration, ...puzzle.witness];
  assert.equal(validateRepair(puzzle, 'daily', moves).swaps, 18);
  assert.deepEqual(applySwap(applySwap(puzzle.board, reversible, { areas: [2], budget: MAX_EXCHANGES }),
    reversible, { areas: [2], budget: MAX_EXCHANGES }), puzzle.board);
});

test('a reachable early home cannot start playback before the full ordered road is ready', () => {
  const partial = planJourney(['AoB...', '......', '..C...', '......', '......', '......'], ['A', 'B', 'C']);
  assert.deepEqual(partial.stops.map((stop) => stop.anchor), ['A', 'B']);
  assert.equal(partial.solved, false);
  assert.throws(() => new JourneyPlayer(partial), /complete ordered road/);
  assert.throws(() => new JourneyPlayer(partial, true), /complete ordered road/);
  const complete = planJourney(['AoB...', '..o...', '..C...', '......', '......', '......'], ['A', 'B', 'C']);
  const player = new JourneyPlayer(complete, true);
  assert.deepEqual(player.advance(0).arrivals.map((stop) => stop.anchor), ['B', 'C']);
});

test('selection feedback identifies the exact fixed or overlapping cells without changing move legality', () => {
  const board: Board = ['Ax.o..', '......', '......', '......', '......', '.....B'];
  const mixed = inspectPatch(board, { row: 0, col: 0 }, { rows: 1, cols: 2 });
  assert.deepEqual(mixed?.cells, [{ row: 0, col: 0 }, { row: 0, col: 1 }]);
  assert.match(mixed?.message ?? '', /Homes and boulders/);
  const rock = inspectPatch(board, { row: 0, col: 1 }, { rows: 1, cols: 2 });
  assert.equal(rock?.code, 'boulder');
  assert.deepEqual(rock?.cells, [{ row: 0, col: 1 }]);
  assert.equal(patchProblem(board, { row: 0, col: 1 }, { rows: 1, cols: 2 }), rock?.message);
  assert.equal(selectionIssue(board, { row: 2, col: 2 }, { rows: 1, cols: 2 }, { row: 2, col: 2 }), null,
    'Selecting the first patch again must still cancel it.');
  const overlap = selectionIssue(board, { row: 2, col: 3 }, { rows: 1, cols: 2 }, { row: 2, col: 2 });
  assert.equal(overlap?.code, 'overlap');
  assert.deepEqual(overlap?.cells, [{ row: 2, col: 3 }]);
  assert.equal(inspectPatch(board, { row: 5, col: 5 }, { rows: 1, cols: 2 })?.code, 'bounds');
  assert.equal(inspectPatch(board, { row: 1.5, col: 1 }, { rows: 1, cols: 2 })?.code, 'shape');
});
