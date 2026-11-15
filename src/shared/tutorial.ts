import type { Cell, Puzzle, Shape, Swap } from './types.ts';

export type TutorialStage = 'frame' | 'first' | 'second' | 'home';
export const TUTORIAL_START_SHAPE: Shape = { rows: 1, cols: 2 };
export const TUTORIAL_MOVE: Swap = {
  rows: 2, cols: 1, a: { row: 1, col: 0 }, b: { row: 2, col: 2 },
};

export function tutorialStage(shape: Shape, first: Cell | null, solved: boolean): TutorialStage {
  if (solved) return 'home';
  if (shape.rows !== TUTORIAL_MOVE.rows || shape.cols !== TUTORIAL_MOVE.cols) return 'frame';
  return first ? 'second' : 'first';
}

export const TUTORIAL: Puzzle = {
  id: 'a-little-lesson',
  title: 'A little lesson',
  note: 'Nothing is copied. Nothing is lost. A little patch brings everything with it.',
  chapter: 0,
  theme: 'meadow',
  board: ['..A...', 'o.o...', '~..o..', '...B..', '......', '......'],
  area: 2,
  budget: 1,
  goals: [{ from: 'A', to: 'B' }],
  journey: ['A', 'B'],
};
