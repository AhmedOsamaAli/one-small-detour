export type Anchor = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type Tile = '.' | 'o' | '~' | 'x' | 'h' | 'v' | Anchor;
export type Board = readonly string[];
export type Mode = 'daily' | 'gentle';
export type Theme = 'meadow' | 'coast' | 'orchard';
export type GuideTopic = 'basics' | 'rocks' | 'bridges';

export interface Cell {
  row: number;
  col: number;
}

export interface Celebration {
  id: number;
  anchors: Anchor[];
  complete: boolean;
}

export interface JourneyStop {
  anchor: Anchor;
  pathIndex: number;
}

export interface JourneyPlan {
  path: Cell[];
  stops: JourneyStop[];
  solved: boolean;
}

export interface JourneyPlayback {
  revision: number;
  plan: JourneyPlan;
}

export interface Shape {
  rows: number;
  cols: number;
}

export interface FrameAxes {
  col: { x: number; y: number };
  row: { x: number; y: number };
}

export interface Swap extends Shape {
  a: Cell;
  b: Cell;
}

export interface Goal {
  from: Anchor;
  to: Anchor;
  via?: Anchor;
}

export interface Rules {
  areas: readonly number[];
  budget: number;
}

export interface Puzzle {
  id: string;
  title: string;
  note: string;
  board: Board;
  area: number;
  budget: number;
  goals: readonly Goal[];
  theme: Theme;
  chapter: number;
  minimum?: number;
  journey?: readonly Anchor[];
}

export interface AuthoredPuzzle extends Puzzle {
  witness: readonly Swap[];
}

export interface Edition {
  id: string;
  number: number;
  date: string;
  puzzle: Puzzle;
}

export interface CatalogEntry {
  id: string;
  title: string;
  note: string;
  theme: Theme;
  chapter: number;
  area: number;
  budget: number;
  size: number;
  minimum?: number;
}

export interface RouteCheck {
  solved: boolean;
  routes: Cell[][];
  missing: string[];
  journey?: JourneyPlan;
}

export interface Repair {
  board: Board;
  routes: Cell[][];
  footprint: number;
  swaps: number;
}

export interface Player {
  id: string;
  name: string;
}

export interface ScoreRecord {
  userId: string;
  name: string;
  footprint: number;
  swaps: number;
  submittedAt: string;
  solveMs?: number;
}

export interface RankedScore extends ScoreRecord {
  rank: number;
  isYou: boolean;
}

export interface Leaderboard {
  entries: RankedScore[];
  players: number;
  yourBest: RankedScore | null;
  topPercent: number | null;
  source: 'local' | 'reddit';
  mode: Mode;
}

export interface MyRank {
  edition: string;
  rank: number | null;
  swaps: number | null;
  solveMs: number | null;
  participants: number;
  topPercent: number | null;
  source: 'local' | 'reddit';
}

export interface SavedRepair extends Leaderboard {
  saved: { swaps: number; solveMs: number | null };
}

export interface Bootstrap {
  edition: Edition | null;
  catalog: CatalogEntry[];
  source: 'local' | 'reddit';
  community: string;
  playerName: string | null;
  now: string;
  nextReset: string;
  seasonComplete: boolean;
  seenGuides: GuideTopic[];
}

export interface SubmitRepair {
  edition: string;
  mode: Mode;
  moves: Swap[];
  attemptId?: string;
  solveId?: string;
}

export interface AttemptStart {
  id: string | null;
  edition: string;
  startsAt: string;
  expiresAt: string;
  now: string;
}
