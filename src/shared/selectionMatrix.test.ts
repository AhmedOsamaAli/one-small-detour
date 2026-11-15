import assert from 'node:assert/strict';
import test from 'node:test';
import { getPuzzles } from './puzzles.ts';
import { selectionIssue } from './rules.ts';
import type { Board, Cell, Shape } from './types.ts';

function expectedIssue(board: Board, start: Cell, shape: Shape, first: Cell | null): string | null {
  const size = board.length;
  if (start.row < 0 || start.col < 0 || start.row + shape.rows > size || start.col + shape.cols > size) return 'bounds';
  const tiles = Array.from({ length: shape.rows }, (_, row) =>
    board[start.row + row]?.slice(start.col, start.col + shape.cols) ?? '').join('');
  if (/[A-F]/.test(tiles)) return 'home';
  if (tiles.includes('x')) return 'boulder';
  if (!first || (start.row === first.row && start.col === first.col)) return null;
  const occupied = new Set<string>();
  for (let row = first.row; row < first.row + shape.rows; row++) {
    for (let col = first.col; col < first.col + shape.cols; col++) occupied.add(`${row}:${col}`);
  }
  for (let row = start.row; row < start.row + shape.rows; row++) {
    for (let col = start.col; col < start.col + shape.cols; col++) {
      if (occupied.has(`${row}:${col}`)) return 'overlap';
    }
  }
  return null;
}

for (const size of [6, 8, 10, 12]) {
  test(`all first/second patch positions classify correctly on a real ${size}x${size} island`, () => {
    const puzzle = getPuzzles().find((item) => item.board.length === size);
    assert.ok(puzzle);
    for (const shape of [{ rows: 1, cols: 2 }, { rows: 2, cols: 1 }]) {
      const positions: Cell[] = [];
      for (let row = -1; row <= size; row++) for (let col = -1; col <= size; col++) positions.push({ row, col });
      const valid: Cell[] = positions.filter((start) => expectedIssue(puzzle.board, start, shape, null) === null);
      const firstChoices: (Cell | null)[] = [null, ...valid];
      for (const first of firstChoices) for (const start of positions) {
        const expected = expectedIssue(puzzle.board, start, shape, first);
        assert.equal(selectionIssue(puzzle.board, start, shape, first)?.code ?? null, expected,
          `${shape.rows}x${shape.cols}: ${JSON.stringify(first)} then ${JSON.stringify(start)}`);
      }
    }
  });
}
