import { applySwap, checkPuzzle, legalSwaps, MAX_EXCHANGES, patchCells, walkable } from './rules.ts';
import { certifyMinimum, pavingLowerBound, replayPuzzle } from './difficulty.ts';
import type { Anchor, AuthoredPuzzle, Board, Cell, Goal, Swap, Theme } from './types.ts';

export const PRACTICE_TARGETS = [1, 2, 2, 3, 3, 4, 5, 2, 3, 3, 4, 4, 5, 6, 2, 3, 4, 4, 5, 5, 6, 2, 3, 3, 4, 5, 5, 6, 2, 3, 4, 4, 5, 6, 6, 2, 3, 4, 4, 5, 5, 6] as const;
export const PLACE_TITLES = [
  'Across the green', 'Three homes, one way', 'The missing middle', 'Between two meadows',
  'The long way round', 'A delicate balance', 'Six doors before sunset', 'The orchard crossing',
  'A bend in the village', 'The old stone path', 'Neighbors on every side', 'The careful crossing',
  'The roads we borrow', 'A village reunited', 'Beyond the little pond', 'The far end of the lane',
  'Four corners to mend', 'The second way home', 'A road through the orchard', 'The last connection',
  'All six, together', 'A borrowed stretch', 'A path worth keeping', 'The quiet junction',
  'Along the waterline', 'Where the paths meet', 'One village, many roads', 'The final delivery',
  'A little foresight', 'Between the cottages', 'The scattered stones', 'The road less traveled',
  'The crossing at dusk', 'A place for everyone', 'No home left behind', 'The winding lane',
  'A careful arrangement', 'A different kind of shortcut', 'The village on the hill',
  'The long afternoon', 'Every door, every road', 'All the way home',
] as const;

export function seedOf(value: string): number {
  let seed = 2166136261;
  for (const character of value) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return seed >>> 0;
}

function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

interface ChallengeRequest {
  id: string;
  title: string;
  minimum: number;
  seed: number;
  chapter: number;
}

export function generateChallenge(request: ChallengeRequest): AuthoredPuzzle {
  const { minimum } = request;
  if (!Number.isInteger(minimum) || minimum < 1 || minimum > 6) throw new Error('Unsupported challenge difficulty.');
  const size = minimum <= 2 ? 6 : minimum <= 4 ? 8 : 10;
  for (let attempt = 0; attempt < 32; attempt++) {
    const seed = (request.seed + attempt * 3053) >>> 0;
    const random = randomSource(seed);
    const grid = Array.from({ length: size }, () => Array<string>(size).fill('.'));
    const path = [{ row: 0, col: 0 }];
    let row = 0;
    let col = 0;
    while (row < size - 1 || col < size - 1) {
      if (row === size - 1 || (col < size - 1 && random() < 0.5)) col++;
      else row++;
      path.push({ row, col });
    }
    for (const cell of path) {
      const line = grid[cell.row];
      if (!line) throw new Error('Generator route left the map.');
      line[cell.col] = 'o';
    }
    const allAnchors: Anchor[] = ['A', 'B', 'C', 'D', 'E', 'F'];
    const journey = allAnchors.slice(0, size === 6 ? 3 : size === 8 ? 5 : 6);
    journey.forEach((anchor, position) => {
      const cell = path[Math.round(position * (path.length - 1) / (journey.length - 1))];
      if (!cell || !grid[cell.row]) throw new Error('Generator stop left the map.');
      grid[cell.row]![cell.col] = anchor;
    });
    const goals: Goal[] = journey.slice(1).map((to, index) => {
      const from = journey[index];
      if (!from) throw new Error('Generator stop has no predecessor.');
      return { from, to };
    });
    let board: Board = grid.map((line) => line.join(''));
    const legal = legalSwaps(board, 2);
    const corruption: Swap[] = [];
    for (let depth = 1; depth <= minimum; depth++) {
      let found = false;
      for (let trial = 0; trial < 1200; trial++) {
        const move = legal[Math.floor(random() * legal.length)];
        if (!move) throw new Error('Generator has no legal patch exchange.');
        const next = applySwap(board, move, { areas: [2], budget: minimum }, depth - 1);
        if (Math.ceil(pavingLowerBound(next, [], journey) / 2) !== depth) continue;
        corruption.push(move);
        board = next;
        found = true;
        break;
      }
      if (!found) break;
    }
    if (corruption.length !== minimum) continue;
    const water = randomSource(seed + 9151);
    board = board.map((line) => [...line].map((tile) => tile === '.' && water() < 0.14 ? '~' : tile).join(''));
    const themes: Theme[] = ['meadow', 'coast', 'orchard'];
    const puzzle: AuthoredPuzzle = {
      id: request.id, title: request.title,
      note: `Visit ${journey.join(' > ')} in order. Use the fewest exchanges.`,
      board, area: 2, budget: minimum + 1, minimum, journey, goals,
      theme: themes[request.seed % themes.length] ?? 'meadow',
      chapter: request.chapter, witness: corruption.reverse(),
    };
    if (checkPuzzle(board, puzzle).solved) continue;
    certifyMinimum(puzzle);
    return puzzle;
  }
  throw new Error(`A verified landscape could not be generated for ${request.id}. No unchecked puzzle was returned.`);
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    const a = result[index];
    const b = result[other];
    if (a === undefined || b === undefined) throw new Error('The landscape shuffle lost a piece.');
    result[index] = b;
    result[other] = a;
  }
  return result;
}

function addBridges(board: Board, path: readonly Cell[], random: () => number): Board {
  const next = board.map((row) => row.split(''));
  for (let index = 1; index < path.length - 1; index++) {
    const cell = path[index];
    const before = path[index - 1];
    const after = path[index + 1];
    if (!cell || !before || !after || next[cell.row]?.[cell.col] !== 'o' || random() > 0.48) continue;
    const line = next[cell.row];
    if (!line) throw new Error('A bridge left the landscape.');
    if (before.row === after.row) line[cell.col] = 'h';
    else if (before.col === after.col) line[cell.col] = 'v';
  }
  return next.map((row) => row.join(''));
}

function orientLandscape(puzzle: AuthoredPuzzle, random: () => number): AuthoredPuzzle {
  const turns = Math.floor(random() * 4);
  const mirror = random() < 0.5;
  const size = puzzle.board.length;
  const transform = (cell: Cell): Cell => {
    let { row, col } = cell;
    for (let turn = 0; turn < turns; turn++) [row, col] = [col, size - 1 - row];
    return { row, col: mirror ? size - 1 - col : col };
  };
  const board = Array.from({ length: size }, () => Array<string>(size).fill('.'));
  puzzle.board.forEach((line, row) => [...line].forEach((value, col) => {
    const cell = transform({ row, col });
    const target = board[cell.row];
    if (!target) throw new Error('The oriented landscape lost a row.');
    target[cell.col] = turns % 2 && (value === 'h' || value === 'v') ? value === 'h' ? 'v' : 'h' : value;
  }));
  const witness = puzzle.witness.map((move): Swap => {
    const a = patchCells(move.a, move).map(transform);
    const b = patchCells(move.b, move).map(transform);
    return {
      a: { row: Math.min(...a.map((cell) => cell.row)), col: Math.min(...a.map((cell) => cell.col)) },
      b: { row: Math.min(...b.map((cell) => cell.row)), col: Math.min(...b.map((cell) => cell.col)) },
      rows: turns % 2 ? move.cols : move.rows,
      cols: turns % 2 ? move.rows : move.cols,
    };
  });
  const result = { ...puzzle, board: board.map((row) => row.join('')), witness };
  if (certifyMinimum(result) !== puzzle.minimum) throw new Error('Orienting the landscape changed its certified difficulty.');
  return result;
}

export function generateDailyChallenge(request: ChallengeRequest & { size?: 12 }): AuthoredPuzzle {
  if (!Number.isInteger(request.minimum) || request.minimum < 1 || request.minimum > 15) {
    throw new Error('Daily landscapes support certified minimums from one through fifteen.');
  }
  if (request.size !== undefined && (request.size !== 12 || request.minimum <= 6)) {
    throw new Error('Wide practice landscapes require size twelve and a certified minimum above six.');
  }
  const random = randomSource(request.seed ^ 0x7f4a7c15);
  if (request.minimum <= 6) {
    const classic = generateChallenge(request);
    const repaired = replayPuzzle(classic, classic.witness);
    const journey = checkPuzzle(repaired, classic).journey;
    if (!journey?.solved) throw new Error('The classic daily has no complete ordered route.');
    let board = addBridges(repaired, journey.path, random);
    [...classic.witness].reverse().forEach((move, used) => {
      board = applySwap(board, move, { areas: [2], budget: MAX_EXCHANGES }, used);
    });
    const reserved = new Set(classic.witness.flatMap((move) =>
      [...patchCells(move.a, move), ...patchCells(move.b, move)].map((cell) => `${cell.row}:${cell.col}`)));
    board = board.map((line, row) => [...line].map((tile, col) =>
      !walkable(tile) && !reserved.has(`${row}:${col}`) && !walkable(repaired[row]?.[col]) && random() < 0.13 ? 'x' : tile).join(''));
    return orientLandscape({ ...classic, board, budget: MAX_EXCHANGES }, random);
  }

  const size = request.size ?? 10;
  const stockStart = size - 3;
  const grid = Array.from({ length: size }, () => Array<string>(size).fill('x'));
  const path: Cell[] = [{ row: 0, col: 0 }];
  const spiral = request.minimum > 10 || random() < 0.5;
  const corners = size === 12 ? spiral
    ? [[0, 7], [11, 7], [11, 0], [2, 0], [2, 5], [9, 5], [9, 2], [4, 2], [4, 3]]
    : [[0, 7], [2, 7], [2, 0], [4, 0], [4, 7], [6, 7], [6, 0], [8, 0], [8, 7], [10, 7]]
    : spiral
      ? [[0, 5], [9, 5], [9, 0], [2, 0], [2, 3], [7, 3], [7, 2]]
      : [[0, 5], [2, 5], [2, 0], [4, 0], [4, 5], [6, 5], [6, 0], [8, 0], [8, 5]];
  let row = 0;
  let col = 0;
  for (const [r, c] of corners) {
    if (r === undefined || c === undefined) throw new Error('The long trail has an invalid corner.');
    while (row !== r || col !== c) {
      if (row !== r) row += Math.sign(r - row);
      else col += Math.sign(c - col);
      path.push({ row, col });
    }
  }
  path.forEach((cell) => {
    const line = grid[cell.row];
    if (!line) throw new Error('The long trail left the island.');
    line[cell.col] = 'o';
  });
  const journey: Anchor[] = ['A', 'B', 'C', 'D'];
  const stopIndices = [0, 3 + 2 * Math.floor(random() * 5), path.length - 4 - 2 * Math.floor(random() * 5), path.length - 1];
  const stops = new Set(stopIndices);
  stopIndices.forEach((index, position) => {
    const cell = path[index];
    const anchor = journey[position];
    if (!cell || !anchor || !grid[cell.row]) throw new Error('The long trail has an invalid stop.');
    grid[cell.row]![cell.col] = anchor;
  });
  for (let r = 0; r < size; r++) {
    for (let c = stockStart; c < size; c++) {
      const line = grid[r];
      if (!line) throw new Error('The stock garden lost a row.');
      line[c] = random() < 0.22 ? '~' : '.';
    }
  }
  let board = addBridges(grid.map((line) => line.join('')), path, random);
  const pairs: { cell: Cell; rows: number; cols: number }[] = [];
  for (let index = 1; index < path.length - 1;) {
    if (stops.has(index)) { index++; continue; }
    const a = path[index];
    const b = path[index + 1];
    if (!a || !b || stops.has(index + 1)) throw new Error('The long trail cannot be cut into safe pairs.');
    pairs.push({
      cell: { row: Math.min(a.row, b.row), col: Math.min(a.col, b.col) },
      rows: Math.abs(a.row - b.row) + 1, cols: Math.abs(a.col - b.col) + 1,
    });
    index += 2;
  }
  let selected = shuffle(pairs, random).slice(0, request.minimum);
  if (request.minimum === 15 && selected.filter((pair) => pair.rows === 1).length % 2) {
    const omitted = pairs.find((pair) => !selected.includes(pair));
    const replace = selected.findIndex((pair) => pair.rows !== omitted?.rows);
    if (!omitted || replace < 0) throw new Error('The expert stock garden cannot match its trail pieces.');
    selected[replace] = omitted;
    selected = shuffle(selected, random);
  }
  const horizontal = selected.filter((pair) => pair.rows === 1).length;
  if (horizontal > size) throw new Error('The long trail needs more horizontal stock than the garden can hold.');
  const stockHorizontal: Cell[] = [];
  const stockVertical: Cell[] = [];
  let remainingHorizontal = horizontal;
  for (let r = 0; r < size; r += 2) {
    const count = Math.min(2, remainingHorizontal);
    if (count) stockHorizontal.push({ row: r, col: stockStart });
    if (count === 2) stockHorizontal.push({ row: r + 1, col: stockStart });
    if (!count) stockVertical.push({ row: r, col: stockStart }, { row: r, col: stockStart + 1 });
    stockVertical.push({ row: r, col: stockStart + 2 });
    remainingHorizontal -= count;
  }
  const horizontalStock = shuffle(stockHorizontal, random);
  const verticalStock = shuffle(stockVertical, random);
  const corruption: Swap[] = [];
  selected.forEach((pair, used) => {
    const stock = pair.rows === 1 ? horizontalStock.pop() : verticalStock.pop();
    if (!stock) throw new Error('The stock garden ran out of matching patches.');
    const move = { a: pair.cell, b: stock, rows: pair.rows, cols: pair.cols };
    board = applySwap(board, move, { areas: [2], budget: MAX_EXCHANGES }, used);
    corruption.push(move);
  });
  const themes: Theme[] = ['meadow', 'coast', 'orchard'];
  return orientLandscape({
    id: request.id, title: request.title, board, area: 2, budget: MAX_EXCHANGES,
    minimum: request.minimum, chapter: request.chapter, journey,
    goals: journey.slice(1).map((to, index) => {
      const from = journey[index];
      if (!from) throw new Error('The long trail has a missing predecessor.');
      return { from, to };
    }),
    note: 'Boulders stay put. Bridges connect along their planks. Visit the homes in order.',
    theme: themes[request.seed % themes.length] ?? 'meadow',
    witness: corruption.reverse(),
  }, random);
}
