import test from 'node:test';
import assert from 'node:assert/strict';
import { applySwap, assertBoard, boardFingerprint, checkRoutes, legalSwaps, RULE_VERSION, RuleError, validateRepair } from './rules.ts';
import { AUTHORED, editionById, editionForDate, getPuzzles, getSeasonPuzzles } from './puzzles.ts';
import { TUTORIAL, TUTORIAL_MOVES } from './tutorial.ts';
import type { Board, Swap } from './types.ts';

function histogram(board: Board): string {
  return [...board.join('')].sort().join('');
}

test('all fourteen original places start unsolved and have a legal winning witness', () => {
  assert.equal(AUTHORED.length, 14);
  for (const puzzle of AUTHORED) {
    assertBoard(puzzle.board);
    assert.equal(checkRoutes(puzzle.board, puzzle.goals).solved, false, puzzle.id);
    const repair = validateRepair(puzzle, 'daily', puzzle.witness);
    assert.equal(histogram(repair.board), histogram(puzzle.board), puzzle.id);
    for (const route of repair.routes) {
      assert.equal(new Set(route.map((cell) => `${cell.row},${cell.col}`)).size, route.length, puzzle.id);
      route.slice(1).forEach((cell, index) => {
        const previous = route[index];
        assert.ok(previous);
        assert.equal(Math.abs(cell.row - previous.row) + Math.abs(cell.col - previous.col), 1);
      });
    }
  }
});

test('the 212 campaign places are distinct, cached and solvable while the classic 42 remain', () => {
  const puzzles = getPuzzles();
  assert.equal(getSeasonPuzzles().length, 42);
  assert.equal(puzzles.length, 212);
  assert.equal(new Set(puzzles.map((puzzle) => boardFingerprint(puzzle.board))).size, 212);
  for (const puzzle of puzzles) {
    assertBoard(puzzle.board);
    assert.equal(checkRoutes(puzzle.board, puzzle.goals).solved, false, puzzle.id);
    validateRepair(puzzle, 'daily', puzzle.witness);
  }
  assert.equal(getPuzzles(), puzzles);
});

test('paper counts are reproduced against the exact legal input and route rules', () => {
  const expected = [[561, 1], [662, 3], [399, 2], [612, 1], [256, 1], [661, 0], [476, 4]];
  AUTHORED.slice(0, 7).forEach((puzzle, index) => {
    const moves = legalSwaps(puzzle.board, puzzle.area);
    const winners = moves.filter((move) =>
      checkRoutes(applySwap(puzzle.board, move, { areas: [puzzle.area], budget: 1 }), puzzle.goals).solved);
    assert.deepEqual([moves.length, winners.length], expected[index], puzzle.id);
  });
});

test('a connected dead-end stop does not count as a valid non-retracing trail', () => {
  const puzzle = AUTHORED[3];
  assert.ok(puzzle);
  const shortcut: Swap = { a: { row: 4, col: 0 }, b: { row: 0, col: 3 }, rows: 1, cols: 2 };
  const board = applySwap(puzzle.board, shortcut, { areas: [2], budget: 1 });
  assert.equal(checkRoutes(board, [{ from: 'A', to: 'B' }]).solved, true);
  assert.equal(checkRoutes(board, puzzle.goals).solved, false);
  assert.throws(() => validateRepair(puzzle, 'daily', [shortcut]), { code: 'unsolved' });
});

test('the gentlest repair can use more exchanges but disturb less land', () => {
  const puzzle = AUTHORED[2];
  assert.ok(puzzle);
  const small: Swap[] = [
    { a: { row: 1, col: 4 }, b: { row: 2, col: 1 }, rows: 1, cols: 2 },
    { a: { row: 0, col: 4 }, b: { row: 1, col: 1 }, rows: 1, cols: 1 },
  ];
  assert.equal(validateRepair(puzzle, 'gentle', puzzle.witness).footprint, 8);
  assert.equal(validateRepair(puzzle, 'gentle', small).footprint, 6);
  assert.throws(() => validateRepair(puzzle, 'daily', small), RuleError);
});

test('Sunday permits meaningfully different routes; tutorial is separate and solvable', () => {
  const sunday = AUTHORED[6];
  assert.ok(sunday);
  const cafe: Swap = { a: { row: 0, col: 0 }, b: { row: 3, col: 2 }, rows: 1, cols: 2 };
  const park = validateRepair(sunday, 'daily', sunday.witness);
  const alternate = validateRepair(sunday, 'daily', [cafe]);
  assert.notDeepEqual(park.board, alternate.board);
  assert.notDeepEqual(park.routes, alternate.routes);
  validateRepair(TUTORIAL, 'daily', TUTORIAL_MOVES);
});

test('out-of-bounds, overlap, pinned buildings, fractional inputs and exhausted budgets are rejected', () => {
  const puzzle = AUTHORED[1];
  assert.ok(puzzle);
  const valid = puzzle.witness[0];
  assert.ok(valid);
  assert.throws(() => applySwap(puzzle.board, { ...valid, a: { row: 5, col: 5 } }, { areas: [2], budget: 1 }), RuleError);
  assert.throws(() => applySwap(puzzle.board, { ...valid, b: valid.a }, { areas: [2], budget: 1 }), { code: 'overlap' });
  assert.throws(() => applySwap(puzzle.board, { ...valid, a: { row: 2, col: 0 } }, { areas: [2], budget: 1 }), RuleError);
  assert.throws(() => applySwap(puzzle.board, { ...valid, a: { row: 0.5, col: 1 } }, { areas: [2], budget: 1 }), RuleError);
  assert.throws(() => applySwap(puzzle.board, valid, { areas: [2], budget: 1 }, 1), { code: 'budget' });
});

test('editions change on UTC midnight, omit witnesses, and continue after the old season end', () => {
  const first = editionForDate(new Date('2026-11-11T23:59:59Z'));
  const second = editionForDate(new Date('2026-11-12T00:00:00Z'));
  assert.equal(first?.puzzle.id, `daily-v${RULE_VERSION}-2026-11-11`);
  assert.equal(second?.puzzle.id, `daily-v${RULE_VERSION}-2026-11-12`);
  assert.equal(first?.puzzle.minimum, 1);
  assert.equal(second?.puzzle.minimum, 2);
  assert.equal(first?.number, 1);
  assert.equal(second?.number, 2);
  assert.ok(second);
  assert.equal('witness' in second.puzzle, false);
  assert.equal(editionForDate(new Date('2026-11-10T12:00:00Z')), null);
  assert.equal(editionForDate(new Date('2026-12-23T12:00:00Z'))?.puzzle.id, `daily-v${RULE_VERSION}-2026-12-23`);
  assert.equal(editionById('2026-02-31'), null);
  assert.equal(editionById('not-a-date'), null);
});
