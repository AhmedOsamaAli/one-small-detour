import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { certifyMinimum } from './difficulty.ts';
import { dailyPuzzleForDate, findPuzzle, getCatalog, getPuzzles } from './puzzles.ts';
import { assertBoard, boardFingerprint, validateRepair } from './rules.ts';
import { isCatalogEntry, isPuzzle, isSwap } from './validation.ts';

const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('adding wide practice preserves every existing island and the original daily sequence', () => {
  const puzzles = getPuzzles();
  assert.equal(digest(puzzles.slice(0, 200)), 'b9d2504055c1335dd5482ebaae46ae55b99a6f6c7885bf9cfd6126f36f27cd99');
  const days = Array.from({ length: 16 }, (_, index) =>
    dailyPuzzleForDate(new Date(Date.UTC(2026, 10, 11 + index, 12))));
  assert.equal(digest(days), 'cfad3ba4fa374d7f853800bfe5868425b006e81b66dc88d254d9706e2fd2c085');
  assert.equal(puzzles[0]?.board.length, 6);
  assert.equal(puzzles[0]?.minimum, 1);
});

test('late twelve-square islands use the larger terrain and have replayed minimum proofs', () => {
  const puzzles = getPuzzles().slice(200);
  assert.equal(puzzles.length, 3);
  assert.deepEqual(puzzles.map((puzzle) => puzzle.minimum), [10, 12, 15]);
  assert.equal(new Set(puzzles.map((puzzle) => boardFingerprint(puzzle.board))).size, puzzles.length);
  for (const puzzle of puzzles) {
    assert.equal(puzzle.board.length, 12);
    assert.doesNotThrow(() => assertBoard(puzzle.board));
    assert.ok(isPuzzle(puzzle));
    assert.equal(certifyMinimum(puzzle), puzzle.minimum);
    assert.equal(puzzle.witness.length, puzzle.minimum);
    assert.ok(puzzle.witness.some((move) =>
      [move.a.row, move.a.col, move.b.row, move.b.col].some((coordinate) => coordinate >= 10)));
    assert.equal(validateRepair(puzzle, 'daily', puzzle.witness).routes.length, 1);
    const publicPuzzle = findPuzzle(puzzle.id);
    assert.ok(publicPuzzle && !('witness' in publicPuzzle));
    const entry = getCatalog().find((item) => item.id === puzzle.id);
    assert.ok(entry && isCatalogEntry(entry) && entry.size === 12);
  }
});

test('wire limits support twelve-square practice without accepting larger or ragged boards', () => {
  assert.ok(isSwap({ a: { row: 11, col: 10 }, b: { row: 0, col: 0 }, rows: 1, cols: 2 }));
  assert.equal(isSwap({ a: { row: 12, col: 0 }, b: { row: 0, col: 0 }, rows: 1, cols: 2 }), false);
  assert.throws(() => assertBoard(Array<string>(14).fill('.'.repeat(14))));
  assert.throws(() => assertBoard(['.'.repeat(11), ...Array<string>(11).fill('.'.repeat(12))]));
});
