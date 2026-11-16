import assert from 'node:assert/strict';
import test from 'node:test';
import { communityCrowd, parcelMotion, postcardGarden, villageProgress } from './postcard.ts';
import { CelebrationHold } from '../shared/playback.ts';

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
