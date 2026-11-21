import assert from 'node:assert/strict';
import test from 'node:test';
import { communityCrowd, parcelMotion, postcardGarden, postcardGardens, villageProgress } from './postcard.ts';
import { CelebrationHold } from '../shared/playback.ts';
import { getPuzzles } from '../shared/puzzles.ts';
import { validateRepair } from '../shared/rules.ts';

test('garden parcels lift before trading places and land at the exact destination', () => {
  for (const side of [-1, 1]) {
    const start = parcelMotion(0, side), lifted = parcelMotion(0.15, side), middle = parcelMotion(0.5, side), landed = parcelMotion(1, side);
    assert.deepEqual(start, { travel: 0, lift: 0, tilt: 0 });
    assert.equal(lifted.travel, 0);
    assert.ok(lifted.lift > 0);
    assert.ok(Math.abs(middle.travel - 0.5) < 1e-10);
    assert.equal(landed.travel, 1);
    assert.ok(Math.abs(landed.lift) < 1e-10 && Math.abs(landed.tilt) < 1e-10);
    for (let step = 0; step <= 20; step++) {
      const pose = parcelMotion(step / 20, side);
      assert.ok(pose.travel >= 0 && pose.travel <= 1 && pose.lift >= 0);
    }
  }
});

test('completion gardens grow beside roads and homes, never on a path, water or fixed rock', () => {
  const board = ['A..~..', 'o..x..', '..v...', '......', '......', '......'];
  assert.equal(postcardGarden(board, { row: 0, col: 1 }), true);
  assert.equal(postcardGarden(board, { row: 1, col: 1 }), true);
  assert.equal(postcardGarden(board, { row: 2, col: 1 }), true);
  for (const cell of [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 0, col: 3 }, { row: 1, col: 3 }, { row: 2, col: 2 }, { row: 5, col: 5 }]) {
    assert.equal(postcardGarden(board, cell), false);
  }
});

test('isolated garden patches still bloom when a solved road has no bordering grass', () => {
  const board = ['AooooB', 'xxxxxx', '..x...', 'xxxxxx', '~~~~~~', 'xxxxxx'];
  assert.deepEqual(postcardGardens(board), [
    { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 2, col: 5 },
  ]);
  const roadside = ['AooooB', '.xxxxx', '..x...', 'xxxxxx', '~~~~~~', 'xxxxxx'];
  assert.deepEqual(postcardGardens(roadside), [{ row: 1, col: 0 }]);
  assert.deepEqual(postcardGardens(['AooooB', 'xxxxxx', '~~~~~~', 'xxxxxx', '~~~~~~', 'xxxxxx']), []);
});

test('every released Practice finish has real grass locations for its celebration flowers', () => {
  for (const puzzle of getPuzzles()) {
    const board = validateRepair(puzzle, 'daily', puzzle.witness).board;
    const gardens = postcardGardens(board);
    assert.ok(gardens.length > 0, puzzle.id);
    assert.ok(gardens.every((cell) => board[cell.row]?.[cell.col] === '.'), puzzle.id);
  }
});

test('fallback flowers are bounded and spread through a large isolated garden', () => {
  const board = ['AooooooB', 'xxxxxxxx', '........', '........', '........', '........', '........', '........'];
  const gardens = postcardGardens(board);
  assert.ok(gardens.length > 0 && gardens.length <= 12);
  assert.ok(gardens.some((cell) => cell.row === 2));
  assert.ok(gardens.some((cell) => cell.row === 7));
  assert.ok(gardens.every((cell) => board[cell.row]?.[cell.col] === '.'));
  assert.deepEqual(postcardGardens(board), gardens);
});

test('village opening is staggered, bounded and fully settled before the existing result hold ends', () => {
  assert.equal(villageProgress(0), 0);
  assert.equal(villageProgress(90, 2), 0);
  assert.ok(villageProgress(500, 0) > villageProgress(500, 2));
  for (let phase = 0; phase < 6; phase++) assert.equal(villageProgress(1499, phase), 1);
});

test('the preview waits three visible seconds without changing the existing production celebration', () => {
  const preview = new CelebrationHold(3000), production = new CelebrationHold();
  assert.equal(preview.advance(1500), false);
  assert.equal(production.advance(1500), true);
  assert.equal(preview.advance(9000, false), false);
  assert.equal(preview.advance(1499), false);
  assert.equal(preview.advance(1), true);
});

test('representative crowds use the real count, cap at two people per home and never invent unknown participants', () => {
  const homes = ['A', 'B', 'C'] as const;
  assert.deepEqual(communityCrowd(homes, null), []);
  assert.deepEqual(communityCrowd(homes, 0), []);
  assert.equal(communityCrowd(homes, 1).length, 1);
  const crowd = communityCrowd(homes, 100000);
  assert.equal(crowd.length, 6);
  for (const anchor of homes) assert.deepEqual(crowd.filter((person) => person.anchor === anchor).map((person) => person.side), [-1, 1]);
  assert.throws(() => communityCrowd(homes, -1), /invalid/);
});

test('finish crowds leave the courier destination clear without losing the other home greetings', () => {
  const homes = ['A', 'B', 'C'] as const;
  const crowd = communityCrowd(homes, 100000, 'B');
  assert.equal(crowd.length, 4);
  assert.ok(crowd.every(person => person.anchor !== 'B'));
  for (const anchor of ['A', 'C']) assert.deepEqual(crowd.filter(person => person.anchor === anchor).map(person => person.side), [-1, 1]);
  assert.deepEqual(communityCrowd(['A'], 1, 'A'), []);
  assert.equal(communityCrowd(homes, 1, 'C').length, 1);
});
