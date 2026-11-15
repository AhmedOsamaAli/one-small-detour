import { applySwap, patchCells } from './rules.ts';
import type { Anchor, AuthoredPuzzle, Board, PatchFamily, Swap, Theme, Tile } from './types.ts';

const TITLES: Record<PatchFamily, readonly [string, string, string]> = {
  strip: ['A longer little patch', 'Along the garden wall', 'Three stretches home'],
  square: ['A little square garden', 'Two squares to mend', 'The courtyard exchange'],
  ell: ['Around the corner', 'Two little elbows', 'The winding garden'],
};

function frameLesson(frame: PatchFamily, minimum: 1 | 2 | 3): AuthoredPuzzle {
  const size = frame === 'ell' ? minimum === 1 ? 6 : minimum === 2 ? 8 : 10 :
    frame === 'square' ? minimum === 3 ? 8 : 6 : minimum === 1 ? 6 : 8;
  const grid = Array.from({ length: size }, () => Array<Tile>(size).fill('x'));
  const put = (row: number, col: number, tile: Tile): void => {
    const line = grid[row];
    if (!line || col < 0 || col >= size) throw new Error('A frame lesson left its island.');
    line[col] = tile;
  };
  const scrambles: Swap[] = [];
  let journey: Anchor[];
  if (frame === 'strip') {
    journey = ['A', 'B', 'C', 'D'];
    for (let index = 0; index < size; index++) {
      put(0, index, 'o'); put(index, size - 1, 'o'); put(size - 1, index, 'o');
    }
    put(0, 0, 'A'); put(0, size - 1, 'B'); put(size - 1, size - 1, 'C'); put(size - 1, 0, 'D');
    scrambles.push(
      { a: { row: 2, col: 1 }, b: { row: 0, col: 1 }, rows: 1, cols: 3 },
      { a: { row: 3, col: 4 }, b: { row: 1, col: size - 1 }, rows: 3, cols: 1 },
      { a: { row: 5, col: 1 }, b: { row: size - 1, col: 1 }, rows: 1, cols: 3 },
    );
  } else if (frame === 'square') {
    journey = ['A', 'B'];
    for (let col = 1; col < size - 1; col++) {
      put(1, col, 'o'); put(2, col, '.'); put(4, col, '.'); put(5, col, '.');
    }
    put(1, 0, 'A'); put(1, size - 1, 'B');
    for (let index = 0; index < minimum; index++) {
      scrambles.push({ a: { row: 4, col: 1 + index * 2 }, b: { row: 1, col: 1 + index * 2 }, rows: 2, cols: 2 });
    }
  } else {
    const stops: Anchor[] = ['A', 'B', 'C', 'D'];
    journey = stops.slice(0, minimum + 1);
    journey.forEach((anchor, index) => put(index * 3, index * 3, anchor));
    const parking = minimum === 1 ? [{ row: 0, col: 4 }] :
      minimum === 2 ? [{ row: 0, col: 4 }, { row: 5, col: 0 }] :
        [{ row: 0, col: 4 }, { row: 0, col: 7 }, { row: 7, col: 0 }];
    for (let index = 0; index < minimum; index++) {
      const a = parking[index];
      if (!a) throw new Error('An L lesson is missing its parking patch.');
      const b = { row: index * 3 + 1, col: index * 3 };
      const move: Swap = { a, b, rows: 3, cols: 2, kind: 'ell' };
      for (const cell of patchCells(b, move)) put(cell.row, cell.col, 'o');
      put(index * 3 + 3, index * 3 + 2, 'o');
      scrambles.push(move);
    }
  }
  const corruption = scrambles.slice(0, minimum);
  for (const move of corruption) for (const cell of patchCells(move.a, move)) put(cell.row, cell.col, '.');
  let board: Board = grid.map((row) => row.join(''));
  const area = frame === 'strip' ? 3 : 4;
  corruption.forEach((move, used) => { board = applySwap(board, move, { areas: [area], budget: minimum, frame }, used); });
  const themes: Record<PatchFamily, Theme> = { strip: 'meadow', square: 'coast', ell: 'orchard' };
  const puzzle: AuthoredPuzzle = {
    id: `frame-${frame}-v1-${minimum}`, title: TITLES[frame][minimum - 1] ?? TITLES[frame][0],
    note: frame === 'strip' ? 'Three squares in a line. Choose a tall or wide frame; the terrain does not rotate.' :
      frame === 'square' ? 'Four squares move together. This island uses only the square frame.' :
        'Four squares around a corner. The empty notch stays behind, even around a fixed boulder.',
    board, area, frame, budget: minimum, minimum, journey,
    goals: journey.slice(1).map((to, index) => {
      const from = journey[index];
      if (!from) throw new Error('A frame lesson is missing its previous home.');
      return { from, to };
    }),
    theme: themes[frame], chapter: 300 + ['strip', 'square', 'ell'].indexOf(frame) * 3 + minimum,
    practiceAfter: frame === 'strip' ? 12 : frame === 'square' ? 36 : 72,
    witness: [...corruption].reverse(),
  };
  if (frame !== 'ell' || minimum !== 2) return puzzle;
  const turn = (cell: { row: number; col: number }, rows: number) => ({ row: cell.col, col: size - cell.row - rows });
  return {
    ...puzzle,
    board: Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => {
      const tile = board[size - 1 - col]?.[row];
      if (!tile) throw new Error('The turned L lesson lost a terrain tile.');
      return tile;
    }).join('')),
    witness: puzzle.witness.map((move) => ({
      ...move, a: turn(move.a, move.rows), b: turn(move.b, move.rows), rows: move.cols, cols: move.rows,
    })),
  };
}

export const FRAME_LESSONS: readonly AuthoredPuzzle[] = (['strip', 'square', 'ell'] as const)
  .flatMap((frame) => ([1, 2, 3] as const).map((minimum) => frameLesson(frame, minimum)));
