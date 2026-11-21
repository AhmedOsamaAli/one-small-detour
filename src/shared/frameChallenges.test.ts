import test from 'node:test';
import assert from 'node:assert/strict';
import { FRAME_CHALLENGES } from './frameChallenges.ts';
import { applySwap, checkPuzzle, patchCells, rulesFor } from './rules.ts';
import { certifyMinimum } from './difficulty.ts';

test('advanced shape examples have certified minimums and interacting patches, not order-independent stock replacements', () => {
  const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const puzzle of FRAME_CHALLENGES) {
    assert.equal(certifyMinimum(puzzle), 3);
    const rules = rulesFor(puzzle, 'daily');
    const solvedOrders = orders.filter((order) => {
      let board = puzzle.board;
      for (const index of order) {
        const move = puzzle.witness[index];
        assert.ok(move);
        board = applySwap(board, move, rules, 0);
      }
      return checkPuzzle(board, puzzle).solved;
    }).length;
    assert.ok(solvedOrders >= 1 && solvedOrders <= 2, `${puzzle.id}: the demonstrated sequence must require ordering`);
    const footprints = puzzle.witness.map((move) => new Set([...patchCells(move.a, move), ...patchCells(move.b, move)]
      .map((cell) => `${cell.row},${cell.col}`)));
    assert.ok(footprints.some((cells, index) => footprints.slice(index + 1).some((other) => [...cells].some((cell) => other.has(cell)))));
    assert.ok(puzzle.witness.filter((move) => move.a.row !== move.b.row && move.a.col !== move.b.col).length >= 2);
    if (puzzle.frame !== 'square') assert.equal(new Set(puzzle.witness.map((move) => move.rows)).size, 2);
  }
});
