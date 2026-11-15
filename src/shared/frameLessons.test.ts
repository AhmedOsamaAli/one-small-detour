import assert from 'node:assert/strict';
import test from 'node:test';
import { certifyMinimum, replayPuzzle } from './difficulty.ts';
import { FRAME_LESSONS } from './frameLessons.ts';
import { applySwap, checkPuzzle, patchArea, patchCells, patchesOverlap, patchOutline, rulesFor, selectionIssue, shapesFor, validateRepair } from './rules.ts';
import { isPuzzle, isSwap, parseSubmission } from './validation.ts';
import type { Board, Shape, Swap } from './types.ts';

test('L exchanges move only four cells and leave pinned homes and rocks in their notches', () => {
  const board: Board = ['oA....', '~x....', 'oo....', '...~B.', '...ox.', '...oo.'];
  const move: Swap = { a: { row: 0, col: 0 }, b: { row: 3, col: 3 }, rows: 3, cols: 2, kind: 'ell' };
  const rules = { areas: [4], frame: 'ell', budget: 2 } as const;
  assert.equal(selectionIssue(board, move.a, move, null), null);
  const next = applySwap(board, move, rules);
  const first = patchCells(move.a, move), second = patchCells(move.b, move);
  for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) {
    const a = first.findIndex((cell) => cell.row === row && cell.col === col);
    const b = second.findIndex((cell) => cell.row === row && cell.col === col);
    const source = a >= 0 ? second[a] : b >= 0 ? first[b] : { row, col };
    assert.ok(source);
    assert.equal(next[row]?.[col], board[source.row]?.[source.col]);
  }
  assert.deepEqual(applySwap(next, move, rules, 1), board);
  assert.equal(selectionIssue(board, { row: 0, col: 1 }, move, null)?.code, 'home');
});

test('L bounding boxes can overlap when their actual cells do not', () => {
  const board: Board = ['......', 'o.....', '......', '......', '......', '......'];
  const move: Swap = { a: { row: 1, col: 0 }, b: { row: 0, col: 1 }, rows: 3, cols: 2, kind: 'ell' };
  assert.equal(patchesOverlap(move), false);
  assert.doesNotThrow(() => applySwap(board, move, { areas: [4], frame: 'ell', budget: 1 }));
  const overlapping = { ...move, b: { row: 1, col: 1 } };
  assert.equal(selectionIssue(board, overlapping.b, move, move.a)?.code, 'overlap');
  assert.throws(() => applySwap(board, overlapping, { areas: [4], frame: 'ell', budget: 1 }), { code: 'overlap' });
});

test('each Practice island accepts only its own family, never an equal-area substitute', () => {
  const board: Board = Array<string>(6).fill('......');
  const a = { row: 0, col: 0 }, b = { row: 3, col: 3 };
  assert.throws(() => applySwap(board, { a, b, rows: 1, cols: 4 }, { areas: [4], frame: 'square', budget: 1 }), { code: 'area' });
  assert.throws(() => applySwap(board, { a, b, rows: 2, cols: 2 }, { areas: [4], frame: 'ell', budget: 1 }), { code: 'area' });
  assert.throws(() => applySwap(board, { a, b, rows: 3, cols: 2, kind: 'ell' }, { areas: [4], budget: 1 }), { code: 'area' });
  assert.throws(() => applySwap(board, { a, b, rows: 1, cols: 2 }, { areas: [3], frame: 'strip', budget: 1 }), { code: 'area' });
  for (const shape of shapesFor(4, 6, 'ell')) {
    const outline = patchOutline(shape);
    const area = Math.abs(outline.reduce((sum, cell, index) => {
      const next = outline[(index + 1) % outline.length];
      assert.ok(next);
      return sum + cell.col * next.row - next.col * cell.row;
    }, 0)) / 2;
    assert.equal(area, patchCells(a, shape).length);
    assert.equal(area, 4);
  }
});

test('all shape lessons have exact minima and genuinely require their full repair sequence', () => {
  assert.equal(FRAME_LESSONS.length, 9);
  for (const puzzle of FRAME_LESSONS) {
    assert.ok(isPuzzle(puzzle));
    assert.equal(certifyMinimum(puzzle), puzzle.minimum, puzzle.id);
    for (let count = 0; count < puzzle.witness.length; count++) {
      assert.equal(checkPuzzle(replayPuzzle(puzzle, puzzle.witness.slice(0, count)), puzzle).solved, false, puzzle.id);
    }
    const repair = validateRepair(puzzle, 'daily', puzzle.witness);
    assert.equal(repair.footprint, puzzle.witness.reduce((sum, move) => sum + 2 * patchArea(move), 0));
    assert.deepEqual([...repair.board.join('')].sort(), [...puzzle.board.join('')].sort());
    const frames: Shape[] = shapesFor(puzzle.area, puzzle.board.length, puzzle.frame);
    assert.ok(frames.every((shape) => patchArea(shape) === puzzle.area));
    assert.ok(puzzle.witness.every((move) => frames.some((shape) => JSON.stringify(shape) === JSON.stringify(
      { rows: move.rows, cols: move.cols, ...(move.kind ? { kind: move.kind } : {}) }))));
    assert.equal(rulesFor(puzzle, 'gentle').frame, puzzle.frame);
  }
});

test('the exact small-square proof rejects redundant moves rather than calling a scramble optimal', () => {
  const puzzle = FRAME_LESSONS.find((place) => place.frame === 'square' && place.minimum === 1);
  assert.ok(puzzle);
  const move = puzzle.witness[0];
  assert.ok(move);
  assert.throws(() => certifyMinimum({ ...puzzle, budget: 3, witness: [move, move, move] }), /shorter 1-move/);
});

test('wire validation retains canonical L frames and rejects invented or malformed footprints', () => {
  const move = { a: { row: 0, col: 0 }, b: { row: 3, col: 3 }, rows: 3, cols: 2, kind: 'ell' };
  assert.ok(isSwap(move));
  assert.equal(parseSubmission({ edition: '2026-11-15', mode: 'daily', moves: [move] }).moves[0]?.kind, 'ell');
  assert.equal(isSwap({ ...move, rows: 3, cols: 3 }), false);
  assert.equal(isSwap({ ...move, kind: 'custom' }), false);
  assert.equal(isSwap({ ...move, kind: ['ell'] }), false);
  const puzzle = FRAME_LESSONS[0];
  assert.ok(puzzle);
  assert.equal(isPuzzle({ ...puzzle, frame: 'ell', area: 3 }), false);
  assert.equal(isPuzzle({ ...puzzle, frame: 'custom' }), false);
});
