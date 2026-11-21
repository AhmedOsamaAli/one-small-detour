import { patchCells } from './rules.ts';
import type { Cell, Puzzle, Shape, Swap } from './types.ts';

export type TutorialStage = 'check' | 'frame' | 'first' | 'second' | 'home';
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
  board: ['...~..', 'A~~..B', 'o.....', 'o..~..', '.....o', 'oo.ooC'],
  area: 2,
  budget: 3,
  goals: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }],
  journey: ['A', 'B', 'C'],
};

interface TutorialRepair {
  first: string;
  second: string;
  detail: string;
}

export interface TutorialProbe {
  id: string;
  after: number;
  cell: Cell;
  instruction: string;
  answer: string;
  detail: string;
  response: string;
  blockedToward?: Cell;
}

export interface TutorialLesson {
  name: string;
  puzzle: Puzzle;
  moves: readonly Swap[];
  startShape: Shape;
  repairs: readonly TutorialRepair[];
  probes: readonly TutorialProbe[];
  takeaway: string;
}

export const TUTORIAL_LESSONS: readonly TutorialLesson[] = [
  {
    name: 'Swap patches',
    puzzle: TUTORIAL,
    moves: TUTORIAL_MOVES,
    startShape: TUTORIAL_START_SHAPE,
    repairs: [
      { first: 'Tap the orange patch.', second: 'Tap the blue patch.', detail: 'Tap either outlined square. Tap its start again to clear.' },
      { first: 'Pick the next road patch.', second: 'Swap road and water.', detail: 'Water moves to the other patch. Grass and water are not walkable.' },
      { first: 'Find the last little road.', second: 'Connect every home.', detail: 'A, then B, then C. No diagonals or visiting a square twice.' },
    ],
    probes: [],
    takeaway: 'The whole road comes first. Then the courier visits every home in order.',
  },
  {
    name: 'Homes and rocks',
    puzzle: {
      id: 'a-little-fixed-lesson', title: 'Some things stay put', chapter: 0, theme: 'coast',
      note: 'Try the house and boulder. Neither can be picked up.',
      board: ['...~..', 'A~~B..', '......', '..x...', '......', 'oo....'],
      area: 2, budget: 1, goals: [{ from: 'A', to: 'B' }], journey: ['A', 'B'],
    },
    moves: [],
    startShape: { rows: 1, cols: 2 },
    repairs: [],
    probes: [
      { id: 'fixed-home', after: 0, cell: { row: 1, col: 0 }, instruction: 'Try tapping the house.',
        answer: 'The home stays put.', detail: 'Can the house move? This check costs no move.', response: 'Move the land, not the home.' },
      { id: 'fixed-rock', after: 0, cell: { row: 3, col: 2 }, instruction: 'Now tap the boulder.',
        answer: 'The boulder stays put.', detail: 'Boulders stay fixed too. This check costs no move.', response: 'Neither patch can include a home or boulder.' },
    ],
    takeaway: 'Road, grass, water and bridges can move. Homes and boulders cannot.',
  },
  {
    name: 'Bridge rules',
    puzzle: {
      id: 'a-little-bridge-lesson', title: 'Bridge ends meet homes', chapter: 0, theme: 'meadow',
      note: 'A bridge can touch a home directly, but only its ends connect.',
      board: ['.~....', 'Aoo.~B', '...x.h', '..v..o', 'oho..o', '..~..C'],
      area: 2, budget: 2, goals: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }], journey: ['A', 'B', 'C'],
    },
    moves: [
      { rows: 1, cols: 2, a: { row: 4, col: 0 }, b: { row: 1, col: 3 } },
      { rows: 2, cols: 1, a: { row: 3, col: 2 }, b: { row: 2, col: 5 } },
    ],
    startShape: { rows: 1, cols: 2 },
    repairs: [
      { first: 'Bring this bridge to B.', second: 'Meet the home directly.', detail: 'A bridge end can meet any side of a home. No paving is needed between them.' },
      { first: 'Take the other bridge.', second: 'Point its end toward B.', detail: 'Cross along the planks, both ways. The sides never connect; bridges never rotate.' },
    ],
    probes: [
      { id: 'sideways-bridge', after: 1, cell: { row: 2, col: 5 }, instruction: 'Tap the bridge below B.',
        answer: 'Its side cannot connect.', detail: 'Its planks run sideways. Can its side meet the home?',
        response: 'Road incomplete: only bridge ends connect to homes.', blockedToward: { row: 1, col: 5 } },
    ],
    takeaway: 'Both bridge ends connect; the sides do not. Homes allow a turn, bridges do not.',
  },
];

export function tutorialLesson(id: string): TutorialLesson {
  const lesson = TUTORIAL_LESSONS.find((item) => item.puzzle.id === id);
  if (!lesson) throw new Error('That guided lesson could not be found.');
  return lesson;
}

export function pendingTutorialProbe(lesson: TutorialLesson, used: number, completed: readonly string[]): TutorialProbe | null {
  return lesson.probes.find((probe) => probe.after === used && !completed.includes(probe.id)) ?? null;
}

export function guidePatchStart(cell: Cell, move: Swap, first: Cell | null): Cell {
  const includes = (start: Cell): boolean => patchCells(start, move)
    .some((part) => part.row === cell.row && part.col === cell.col);
  if (first && includes(first)) return first;
  const target = first ? move.b : move.a;
  return includes(target) ? target : cell;
}
