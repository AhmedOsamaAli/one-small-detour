import test from 'node:test';
import assert from 'node:assert/strict';
import { applySwap, assertBoard, checkPuzzle, checkRoutes, legalSwaps, MAX_EXCHANGES, patchProblem, rulesFor, validateRepair } from './rules.ts';
import { certifyMinimum, connectedDeliveries, pavingLowerBound, replayPuzzle } from './difficulty.ts';
import { AUTHORED, getPuzzles, getSeasonPuzzles } from './puzzles.ts';
import { isPuzzle, isScoreRecord, parseSubmission } from './validation.ts';
import type { Board } from './types.ts';

test('progression covers exact minima 1 through 6, larger maps, and three to six landmarks', () => {
  const puzzles = getSeasonPuzzles();
  assert.deepEqual([...new Set(puzzles.map((puzzle) => puzzle.minimum))].sort(), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...new Set(puzzles.map((puzzle) => puzzle.board.length))].sort(), [6, 8, 10].sort());
  for (const puzzle of puzzles) {
    assert.equal(certifyMinimum(puzzle), puzzle.minimum, puzzle.id);
    assert.ok(puzzle.goals.length >= 2 && puzzle.goals.length <= 5, puzzle.id);
    assert.equal(puzzle.witness.length, puzzle.minimum);
    for (let count = 0; count < puzzle.witness.length; count++) {
      const partial = replayPuzzle(puzzle, puzzle.witness.slice(0, count));
      assert.equal(checkRoutes(partial, puzzle.goals).solved, false, `${puzzle.id} prefix ${count}`);
    }
    const solved = validateRepair(puzzle, 'daily', puzzle.witness);
    assert.equal(solved.routes.length, 1);
    assert.equal(checkPuzzle(solved.board, puzzle).journey?.stops.length, puzzle.journey?.length);
    assert.equal([...solved.board.join('')].sort().join(''), [...puzzle.board.join('')].sort().join(''));
    for (const route of solved.routes) {
      assert.equal(new Set(route.map((cell) => `${cell.row}:${cell.col}`)).size, route.length);
      assert.ok(route.every((cell) => cell.row < puzzle.board.length && cell.col < puzzle.board.length));
    }
  }
  assert.ok(puzzles.some((puzzle) => puzzle.witness.length > 1 &&
    !checkPuzzle(replayPuzzle(puzzle, [...puzzle.witness].reverse()), puzzle).solved),
  'The bank must include order-dependent repairs, not only independent pothole fixes.');
});

test('minimum proof rejects a scramble-count claim with a shorter real solution', () => {
  const original = getSeasonPuzzles()[0];
  assert.ok(original);
  const move = original.witness[0];
  assert.ok(move);
  assert.throws(() => certifyMinimum({ ...original, budget: 4, witness: [move, move, move] }), /do not match/);
});

test('a legal area-two exchange cannot evade the terrain lower bound', () => {
  const puzzle = getSeasonPuzzles()[1];
  assert.ok(puzzle);
  const lower = pavingLowerBound(puzzle.board, puzzle.goals, puzzle.journey);
  assert.ok(lower >= 3);
  for (const move of legalSwaps(puzzle.board, puzzle.area)) {
    const after = applySwap(puzzle.board, move, { areas: [2], budget: 1 });
    assert.equal(checkRoutes(after, puzzle.goals).solved, false);
    assert.ok(pavingLowerBound(after, puzzle.goals, puzzle.journey) >= lower - 2);
  }
});

test('fixing one delivery can break another; live progress must check all goals', () => {
  const puzzle = AUTHORED[4];
  assert.ok(puzzle);
  assert.deepEqual(connectedDeliveries(puzzle.board, puzzle.goals), [false, true]);
  const borrowed = applySwap(puzzle.board, {
    a: { row: 3, col: 2 }, b: { row: 0, col: 2 }, rows: 2, cols: 2,
  }, { areas: [4], budget: 1 });
  assert.deepEqual(connectedDeliveries(borrowed, puzzle.goals), [true, false]);
  assert.deepEqual(connectedDeliveries(validateRepair(puzzle, 'daily', puzzle.witness).board, puzzle.goals), [true, true]);
});

test('six landmarks are pinned on 10x10 maps and wire validation respects expanded limits', () => {
  const puzzle = getSeasonPuzzles().find((item) => item.minimum === 6);
  assert.ok(puzzle);
  assert.equal(puzzle.board.length, 10);
  assert.equal(isPuzzle(puzzle), true);
  const eRow = puzzle.board.findIndex((row) => row.includes('E'));
  const fRow = puzzle.board.findIndex((row) => row.includes('F'));
  assert.ok(eRow >= 0 && fRow >= 0);
  assert.ok(patchProblem(puzzle.board, { row: eRow, col: puzzle.board[eRow]?.indexOf('E') ?? -1 }, { rows: 1, cols: 1 }));
  assert.ok(patchProblem(puzzle.board, { row: fRow, col: puzzle.board[fRow]?.indexOf('F') ?? -1 }, { rows: 1, cols: 1 }));
  assert.equal(patchProblem(puzzle.board, { row: 9, col: 9 }, { rows: 1, cols: 2 }), 'Keep the whole patch on the island.');
  assert.equal(parseSubmission({ edition: '2026-11-24', mode: 'daily', moves: puzzle.witness }).moves.length, 6);
  assert.equal(isScoreRecord({ userId: 'player', name: 'You', footprint: 48, swaps: 6, submittedAt: new Date().toISOString() }), true);
  assert.equal(parseSubmission({ edition: '2026-11-24', mode: 'daily', moves: Array(16).fill(puzzle.witness[0]) }).moves.length, 16);
  assert.throws(() => parseSubmission({ edition: '2026-11-24', mode: 'daily', moves: Array(MAX_EXCHANGES + 1).fill(puzzle.witness[0]) }));
});

test('board dimension guards reject ragged/unsupported maps and keep old studies playable', () => {
  for (const size of [6, 8, 10]) {
    const board: Board = Array.from({ length: size }, () => '.'.repeat(size));
    assert.doesNotThrow(() => assertBoard(board));
  }
  assert.throws(() => assertBoard(['......', ...Array(5).fill('.....')]));
  assert.throws(() => assertBoard(Array(7).fill('.......')));
  for (const puzzle of getPuzzles()) {
    assert.equal(isPuzzle(puzzle), true, puzzle.id);
    assert.ok(rulesFor(puzzle, 'gentle').budget >= puzzle.witness.length);
  }
});

test('waypoint trails on a 10x10 board still reject a connected dead end', () => {
  const original = AUTHORED[3];
  assert.ok(original);
  const board = [...original.board.map((row) => row + '....'), ...Array<string>(4).fill('..........')];
  const larger = { ...original, id: 'large-waypoint-test', board };
  assert.equal(isPuzzle(larger), true);
  assert.equal(validateRepair(larger, 'daily', original.witness).routes.length, 1);
  const shortcut = applySwap(board, {
    a: { row: 4, col: 0 }, b: { row: 0, col: 3 }, rows: 1, cols: 2,
  }, { areas: [2], budget: 1 });
  assert.equal(checkRoutes(shortcut, [{ from: 'A', to: 'B' }]).solved, true);
  assert.equal(checkRoutes(shortcut, original.goals).solved, false);
});
