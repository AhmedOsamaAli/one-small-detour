import type { Cell, Puzzle, Shape, Swap } from './types.ts';

export type TutorialStage = 'frame' | 'first' | 'second' | 'home';
export const TUTORIAL_START_SHAPE: Shape = { rows: 1, cols: 2 };
export const TUTORIAL_MOVES = [
  { rows: 2, cols: 1, a: { row: 2, col: 0 }, b: { row: 2, col: 5 } },
  { rows: 1, cols: 2, a: { row: 5, col: 0 }, b: { row: 1, col: 1 } },
  { rows: 1, cols: 2, a: { row: 5, col: 3 }, b: { row: 1, col: 3 } },
] as const satisfies readonly Swap[];

export function tutorialStage(shape: Shape, first: Cell | null, solved: boolean, move: Swap | null = TUTORIAL_MOVES[0]): TutorialStage {
  if (solved) return 'home';
  if (!move) throw new Error('The guided repairs ended before the road was complete.');
  if (shape.rows !== move.rows || shape.cols !== move.cols) return 'frame';
  return first ? 'second' : 'first';
}

export const TUTORIAL: Puzzle = {
  id: 'a-little-lesson',
  title: 'A little lesson',
  note: 'Nothing is copied. Nothing is lost. A little patch brings everything with it.',
  chapter: 0,
  theme: 'meadow',
  board: ['...~..', 'A....B', 'o.....', 'o..~..', '.....o', 'oo.ooC'],
  area: 2,
  budget: 3,
  goals: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }],
  journey: ['A', 'B', 'C'],
};
