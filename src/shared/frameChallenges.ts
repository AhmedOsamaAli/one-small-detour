import type { AuthoredPuzzle, Board, PatchFamily, Swap } from './types.ts';

const s = (ar: number, ac: number, br: number, bc: number, rows: number, cols: number, kind?: 'ell'): Swap => ({
  a: { row: ar, col: ac }, b: { row: br, col: bc }, rows, cols, ...(kind ? { kind } : {}),
});

function challenge(index: number, frame: PatchFamily, title: string, board: Board, witness: readonly Swap[]): AuthoredPuzzle {
  return {
    id: `frame-challenge-v1-${frame}-${index % 2 + 1}`, title, board, witness,
    frame, area: frame === 'strip' ? 3 : 4, minimum: 3, budget: 2000, chapter: 500 + index,
    practiceAfter: 500 + index, theme: frame === 'strip' ? 'winter' : frame === 'square' ? 'meadow' : 'maple',
    journey: ['A', 'B', 'C'], goals: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }],
    note: 'Connect the complete ordered road. The exchanged patches affect one another; plan the sequence.',
  };
}

export const FRAME_CHALLENGES: readonly AuthoredPuzzle[] = [
  challenge(0, 'strip', 'The borrowed middle', ['Ao..o.', '.o..Bo', '......', '.....o', '.....o', '...ooC'], [
    s(0, 2, 2, 3, 1, 3), s(0, 2, 1, 1, 3, 1), s(1, 1, 5, 2, 1, 3),
  ]),
  challenge(1, 'strip', 'Three threads to follow', ['A...o.', 'o.o...', 'oo.B.o', '......', '..o..o', '.....C'], [
    s(0, 4, 2, 2, 3, 1), s(0, 3, 1, 2, 1, 3), s(0, 1, 3, 3, 1, 3),
  ]),
  challenge(2, 'square', 'A courtyard out of order', ['A.....', '...o..', '.o...o', 'o~.o..', 'o.o~.~', 'Bo...C'], [
    s(2, 3, 4, 2, 2, 2), s(1, 0, 1, 3, 2, 2), s(1, 4, 4, 3, 2, 2),
  ]),
  challenge(3, 'square', 'The pieces we borrow', ['A...o.', '...~o.', 'oo....', '..o.~.', 'o.~...', 'Boo..C'], [
    s(1, 0, 4, 3, 2, 2), s(2, 0, 2, 2, 2, 2), s(0, 4, 1, 0, 2, 2),
  ]),
  challenge(4, 'ell', 'The other side of a corner', ['A....~', 'o..o..', 'o.....', 'oo~...', 'oo...~', 'Bo...C'], [
    s(0, 3, 4, 2, 2, 3, 'ell'), s(3, 1, 4, 2, 2, 3, 'ell'), s(2, 1, 3, 3, 3, 2, 'ell'),
  ]),
  challenge(5, 'ell', 'Where two corners meet', ['Aoo...', '..oo~~', '...Bo.', '....~.', '..o...', '.o..oC'], [
    s(2, 4, 3, 1, 3, 2, 'ell'), s(3, 0, 3, 3, 2, 3, 'ell'), s(0, 4, 2, 2, 3, 2, 'ell'),
  ]),
];
