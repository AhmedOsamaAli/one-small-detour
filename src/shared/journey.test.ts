import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPuzzle, checkRoutes, planJourney, RULE_VERSION, validateRepair } from './rules.ts';
import { generateChallenge, seedOf } from './generation.ts';
import { dailyPuzzleForDate, editionForDate, getSeasonPuzzles } from './puzzles.ts';
import { certifyMinimum, pavingLowerBound } from './difficulty.ts';
import { ARRIVAL_PAUSE_MS, CelebrationHold, COMPLETION_CELEBRATION_MS, JourneyPlayer, WALK_STEP_MS } from './playback.ts';
import { isPuzzle } from './validation.ts';
import type { Board, JourneyPlan } from './types.ts';

test('ordered journey cannot visit C before B, even when separate connections exist', () => {
  const board: Board = ['AoCoBo', '......', '......', '......', '......', '......'];
  assert.equal(checkRoutes(board, [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }]).solved, true);
  const journey = planJourney(board, ['A', 'B', 'C']);
  assert.equal(journey.solved, false);
  assert.deepEqual(journey.stops.map((stop) => stop.anchor), ['A']);
  const diagnostics = { explored: -1 };
  assert.deepEqual(planJourney(board, ['A', 'B', 'C'], diagnostics), journey);
  assert.ok(diagnostics.explored > 0);
});

test('journey finds a continuous no-retrace tour, and an honest reachable prefix', () => {
  const full: Board = ['AoB...', '..o...', '..C...', '......', '......', '......'];
  const plan = planJourney(full, ['A', 'B', 'C']);
  assert.equal(plan.solved, true);
  assert.deepEqual(plan.stops, [{ anchor: 'A', pathIndex: 0 }, { anchor: 'B', pathIndex: 2 }, { anchor: 'C', pathIndex: 4 }]);
  assert.equal(new Set(plan.path.map((cell) => `${cell.row}:${cell.col}`)).size, plan.path.length);
  const diagnostics = { explored: -1 };
  const original = getSeasonPuzzles()[0];
  assert.ok(original);
  const puzzle = { ...original, board: full, journey: ['A', 'B', 'C'] as const };
  const baseline = checkPuzzle(full, puzzle);
  assert.deepEqual(checkPuzzle(full, puzzle, diagnostics), baseline);
  assert.ok(diagnostics.explored > 0);
  const partial = planJourney(['AoB...', '......', '..C...', '......', '......', '......'], ['A', 'B', 'C']);
  assert.equal(partial.solved, false);
  assert.deepEqual(partial.stops.map((stop) => stop.anchor), ['A', 'B']);
  assert.throws(() => planJourney(full, ['A', 'A']));
  assert.throws(() => planJourney(full, ['A', 'F']));
});

const route: JourneyPlan = {
  path: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 2 }, { row: 2, col: 2 }],
  stops: [{ anchor: 'A', pathIndex: 0 }, { anchor: 'B', pathIndex: 2 }, { anchor: 'C', pathIndex: 4 }],
  solved: true,
};

test('B and C celebrations emit once, at arrival; full completion waits at the final stop', () => {
  const player = new JourneyPlayer(route);
  assert.deepEqual(player.advance(WALK_STEP_MS * 2 - 1).arrivals, []);
  const atB = player.advance(1);
  assert.deepEqual(atB.position, { row: 0, col: 2 });
  assert.deepEqual(atB.arrivals.map((stop) => stop.anchor), ['B']);
  assert.equal(atB.finished, false);
  assert.equal(atB.walking, false);
  const resting = player.advance(ARRIVAL_PAUSE_MS - 1);
  assert.deepEqual(resting.position, atB.position);
  assert.deepEqual(resting.arrivals, []);
  assert.deepEqual(player.advance(WALK_STEP_MS * 2).arrivals, []);
  const atC = player.advance(1);
  assert.deepEqual(atC.arrivals.map((stop) => stop.anchor), ['C']);
  assert.deepEqual(atC.position, { row: 2, col: 2 });
  assert.equal(atC.finished, false);
  assert.equal(player.advance(ARRIVAL_PAUSE_MS).finished, true);
  assert.deepEqual(player.advance(10_000).arrivals, []);
});

test('the courier takes a readable, slower step before reaching the next square', () => {
  const player = new JourneyPlayer(route);
  const moving = player.advance(200);
  assert.ok(moving.position.col > 0 && moving.position.col < 1);
  assert.equal(moving.walking, true);
  assert.deepEqual(moving.arrivals, []);
  assert.deepEqual(player.advance(80).position, { row: 0, col: 1 });
  assert.deepEqual(player.advance(280).arrivals.map((stop) => stop.anchor), ['B']);
});

test('reduced motion still emits every arrival in order without continuous walking', () => {
  const player = new JourneyPlayer(route, true);
  const frame = player.advance(0);
  assert.deepEqual(frame.arrivals.map((stop) => stop.anchor), ['B', 'C']);
  assert.equal(frame.finished, true);
  assert.equal(frame.walking, false);
  assert.deepEqual(frame.position, { row: 2, col: 2 });
  assert.deepEqual(player.advance(0).arrivals, []);
  assert.throws(() => player.advance(-1));
  assert.throws(() => new JourneyPlayer({ ...route, stops: [{ anchor: 'A', pathIndex: 2 }] }));
});

test('the result waits for 1500ms of visible celebration and paused time does not count', () => {
  assert.equal(COMPLETION_CELEBRATION_MS, 1500);
  const hold = new CelebrationHold();
  assert.equal(hold.advance(500), false);
  assert.equal(hold.advance(5000, false), false, 'Background and menu time must not consume the celebration.');
  assert.equal(hold.advance(999), false);
  assert.equal(hold.advance(1), true);
  assert.equal(hold.advance(1000), true);
  assert.equal(new CelebrationHold().advance(0), false, 'A restarted journey needs a new hold.');
  assert.throws(() => hold.advance(-1));
  assert.throws(() => hold.advance(NaN));
});

test('the practice bank certifies ordered tours, not just independently connected roads', () => {
  for (const puzzle of getSeasonPuzzles()) {
    assert.ok(puzzle.journey);
    assert.deepEqual(puzzle.journey, ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, puzzle.journey.length));
    const solved = validateRepair(puzzle, 'daily', puzzle.witness);
    const result = checkPuzzle(solved.board, puzzle);
    assert.equal(result.journey?.solved, true, puzzle.id);
    assert.deepEqual(result.journey?.stops.map((stop) => stop.anchor), puzzle.journey, puzzle.id);
    assert.equal(certifyMinimum(puzzle), puzzle.minimum);
  }
});

test('120 daily maps are deterministic and distinct, including dates after the old season end', () => {
  const layouts = new Set<string>();
  const roads = new Set<string>();
  for (let offset = 0; offset < 120; offset++) {
    const date = new Date(Date.UTC(2026, 10, 11 + offset, 12));
    const puzzle = dailyPuzzleForDate(date);
    assert.ok(puzzle);
    assert.equal(isPuzzle(puzzle), true);
    assert.equal(certifyMinimum(puzzle), puzzle.minimum);
    layouts.add(puzzle.board.join('/'));
    roads.add(puzzle.board.map((row) => row.replace(/~/g, '.')).join('/'));
    const edition = editionForDate(date);
    assert.equal(edition?.puzzle.id, `daily-v${RULE_VERSION}-${date.toISOString().slice(0, 10)}`);
    assert.equal(JSON.stringify(edition).includes('witness'), false);
  }
  assert.equal(layouts.size, 120);
  assert.equal(roads.size, 120, 'Freshness must change road decisions, not just water/grass colors.');
  const first = dailyPuzzleForDate(new Date('2026-11-12T12:00:00Z'));
  const repeated = dailyPuzzleForDate(new Date('2026-11-12T23:59:59Z'));
  assert.deepEqual(first, repeated);
  assert.ok(dailyPuzzleForDate(new Date('2028-04-04T12:00:00Z')));
});

test('binary-cost lower bound agrees with an independent shortest-path oracle', () => {
  const oracle = (board: Board): number => {
    const startRow = board.findIndex((row) => row.includes('A'));
    const endRow = board.findIndex((row) => row.includes('C'));
    const start = startRow * board.length + (board[startRow]?.indexOf('A') ?? 0);
    const end = endRow * board.length + (board[endRow]?.indexOf('C') ?? 0);
    const n = board.length;
    const distance = Array<number>(n * n).fill(Infinity);
    const visited = new Set<number>();
    distance[start] = 0;
    for (let step = 0; step < n * n; step++) {
      const current = distance.map((cost, index) => ({ cost, index })).filter(({ index }) => !visited.has(index))
        .sort((a, b) => a.cost - b.cost)[0];
      if (!current) throw new Error('Oracle ran out of nodes.');
      if (current.index === end) return current.cost;
      visited.add(current.index);
      const row = Math.floor(current.index / n);
      const col = current.index % n;
      for (const [r, c] of [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
        if (r === undefined || c === undefined || r < 0 || c < 0 || r >= n || c >= n) continue;
        const cost = current.cost + (/[oA-F]/.test(board[r]?.[c] ?? '') ? 0 : 1);
        distance[r * n + c] = Math.min(distance[r * n + c] ?? Infinity, cost);
      }
    }
    throw new Error('Oracle did not reach C.');
  };
  for (const puzzle of getSeasonPuzzles().filter((item) => item.board.length === 6)) {
    assert.equal(pavingLowerBound(puzzle.board, [{ from: 'A', to: 'C' }]), oracle(puzzle.board), puzzle.id);
  }
});

test('daily editions follow UTC boundaries rather than a player local date', () => {
  const localAfterMidnight = editionForDate(new Date('2026-11-12T00:30:00+02:00'));
  const sameInstant = editionForDate(new Date('2026-11-11T22:30:00Z'));
  assert.deepEqual(localAfterMidnight, sameInstant);
  assert.equal(localAfterMidnight?.id, '2026-11-11');
  assert.equal(editionForDate(new Date('2026-11-12T23:59:59.999Z'))?.id, '2026-11-12');
  assert.equal(editionForDate(new Date('2026-11-13T00:00:00Z'))?.id, '2026-11-13');
});

test('release presentation changes preserve the already-scored version-three daily board', () => {
  const puzzle = generateChallenge({ id: 'daily-2026-11-12', title: 'Three homes, one way',
    minimum: 2, seed: seedOf('detour:journey-v3:2026-11-12'), chapter: 2 });
  assert.ok(puzzle);
  assert.deepEqual(puzzle.board, ['Ao...~', '..~..~', '...Bo.', '.~..oo', '.o~..o', '..~ooC']);
  assert.equal(puzzle.minimum, 2);
  assert.deepEqual(puzzle.journey, ['A', 'B', 'C']);
});
