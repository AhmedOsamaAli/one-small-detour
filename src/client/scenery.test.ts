import assert from 'node:assert/strict';
import test from 'node:test';
import { sceneryOrigins, tileScenery, waterBanks } from './scenery.ts';
import { applySwap } from '../shared/rules.ts';
import type { Swap } from '../shared/types.ts';

test('decorative terrain identities follow exchanges and reverse exactly with Undo', () => {
  const move: Swap = { a: { row: 0, col: 0 }, b: { row: 4, col: 3 }, rows: 1, cols: 2 };
  const initial = sceneryOrigins(6, []);
  const moved = sceneryOrigins(6, [move]);
  assert.equal(moved[0], initial[27]);
  assert.equal(moved[1], initial[28]);
  assert.equal(moved[27], initial[0]);
  assert.deepEqual(sceneryOrigins(6, [move, move]), initial);
  assert.equal(new Set(moved).size, 36);
});

test('flowers and fish use stable seeded choices with restrained density', () => {
  const choices = Array.from({ length: 144 }, (_, origin) => tileScenery(81723, origin));
  assert.deepEqual(choices, Array.from({ length: 144 }, (_, origin) => tileScenery(81723, origin)));
  assert.ok(choices.filter((choice) => choice.flowers.length > 0).length > 35);
  assert.ok(choices.filter((choice) => choice.flowers.length > 0).length < 80);
  assert.ok(choices.filter((choice) => choice.fish).length > 20);
  assert.ok(choices.filter((choice) => choice.fish).length < 70);
  assert.equal(new Set(choices.filter((choice) => choice.flowers.length).map((choice) => choice.flowers.length)).size, 3);
  assert.ok(new Set(choices.flatMap((choice) => choice.flowers.map((flower) => `${flower.x},${flower.z}`))).size > 50);
  for (const flower of choices.flatMap((choice) => choice.flowers)) {
    assert.ok(Math.abs(flower.x) <= 0.28 && Math.abs(flower.z) <= 0.28);
    assert.ok(flower.scale >= 0.72 && flower.scale <= 1.14);
    assert.ok(flower.rotation >= 0 && flower.rotation < Math.PI * 2);
    assert.ok([0, 1, 2].includes(flower.color));
  }
});

test('invalid visual exchanges report their bounds error', () => {
  assert.throws(() => sceneryOrigins(6, [{ a: { row: 8, col: 0 }, b: { row: 0, col: 0 }, rows: 1, cols: 2 }]), /outside/);
  assert.throws(() => sceneryOrigins(6, [{ a: { row: 0, col: 6 }, b: { row: 0, col: 0 }, rows: 1, cols: 2 }]), /outside/);
});

test('L scenery identities move with the four selected cells, not the two notch cells', () => {
  const move: Swap = { a: { row: 0, col: 0 }, b: { row: 3, col: 3 }, rows: 3, cols: 2, kind: 'ell' };
  const initial = sceneryOrigins(6, []);
  const next = sceneryOrigins(6, [move]);
  assert.equal(next[0], initial[21]);
  assert.equal(next[6], initial[27]);
  assert.equal(next[12], initial[33]);
  assert.equal(next[13], initial[34]);
  assert.equal(next[1], initial[1]);
  assert.equal(next[7], initial[7]);
  assert.equal(next[22], initial[22]);
  assert.equal(next[28], initial[28]);
  assert.deepEqual(sceneryOrigins(6, [move, move]), initial);
});

test('water squares retain every rim beside water and bridges, including inside a two-by-two pool', () => {
  assert.deepEqual(waterBanks(['.~.', 'h~v', '.~.'], { row: 1, col: 1 }), {
    west: true, east: true, south: true, north: true,
    southwest: true, southeast: true, northwest: true, northeast: true,
  });
  assert.deepEqual(waterBanks(['~~', '~~'], { row: 0, col: 0 }), {
    west: true, east: true, south: true, north: true,
    southwest: true, southeast: true, northwest: true, northeast: true,
  });
});

test('bridge rims leave valid ends open but keep the sides and incompatible bridge ends outlined', () => {
  assert.deepEqual(waterBanks(['.~.', 'ohB', '.~.'], { row: 1, col: 1 }), {
    west: false, east: false, south: true, north: true,
    southwest: true, southeast: true, northwest: true, northeast: true,
  });
  assert.deepEqual(waterBanks(['.A.', '~v~', '.o.'], { row: 1, col: 1 }), {
    west: true, east: true, south: false, north: false,
    southwest: true, southeast: true, northwest: true, northeast: true,
  });
  assert.deepEqual(waterBanks(['.~.', 'vhv', '.~.'], { row: 1, col: 1 }), {
    west: true, east: true, south: true, north: true,
    southwest: true, southeast: true, northwest: true, northeast: true,
  });
});

test('water and bridge boundaries follow the current board after an actual patch exchange', () => {
  const board = ['......', 'AhhooB', '~~~~~~', '......', '......', '......'];
  const exchanged = applySwap(board, {
    a: { row: 1, col: 1 }, b: { row: 2, col: 1 }, rows: 1, cols: 2,
  }, { areas: [2], budget: 2 });
  assert.equal(waterBanks(board, { row: 1, col: 1 }).east, false);
  assert.equal(waterBanks(exchanged, { row: 1, col: 1 }).east, true);
  const movedBridge = waterBanks(exchanged, { row: 2, col: 1 });
  assert.equal(movedBridge.west, true);
  assert.equal(movedBridge.east, false);
  assert.equal(movedBridge.north, true);
  assert.equal(movedBridge.south, true);
});
