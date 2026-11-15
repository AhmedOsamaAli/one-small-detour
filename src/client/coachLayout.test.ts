import assert from 'node:assert/strict';
import test from 'node:test';
import { placeCoach, sameGuideTarget } from './coachLayout.ts';
import type { GuideBounds, GuideTarget } from '../shared/types.ts';

const intersects = (a: GuideBounds, b: GuideBounds): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

for (const viewport of [{ width: 390, height: 844 }, { width: 248, height: 568 }, { width: 560, height: 320 }]) {
  test(`moving tutorial hints fit ${viewport.width}x${viewport.height} without hiding either selected patch`, () => {
    const cell = { x: 16, y: viewport.height / 2 - 20, width: 32, height: 32 };
    const target: GuideTarget = {
      cell,
      patches: [{ ...cell, height: 64 }, { x: viewport.width - 48, y: cell.y, width: 32, height: 64 }],
      viewport,
    };
    const controls = [{ x: 0, y: 0, width: viewport.width, height: 52 }];
    const placed = placeCoach(target, { width: Math.min(280, viewport.width - 16), height: 60 }, viewport, controls);
    assert.ok(placed.x >= 8 && placed.y >= 8);
    assert.ok(placed.x + placed.width <= viewport.width - 8);
    assert.ok(placed.y + placed.height <= viewport.height - 8);
    for (const bounds of [...target.patches, ...controls]) assert.equal(intersects(placed, bounds), false);
    assert.deepEqual(placeCoach(target, placed, viewport, controls), placed);
  });
}

test('subpixel guide measurements do not restart or jitter an unchanged tutorial target', () => {
  const first: GuideTarget = { cell: { x: 20, y: 30, width: 40, height: 40 }, patches: [{ x: 20, y: 30, width: 40, height: 80 }], viewport: { width: 390, height: 844 } };
  const second = { cell: { ...first.cell, x: 20.04 }, patches: first.patches, viewport: first.viewport };
  assert.equal(sameGuideTarget(first, second), true);
  assert.equal(sameGuideTarget(first, { ...second, cell: { ...second.cell, x: 50 } }), false);
  assert.equal(sameGuideTarget(first, { ...first, viewport: { width: 844, height: 390 } }), false);
  assert.equal(sameGuideTarget(first, null), false);
});

test('a narrow second-patch hint uses the available gap without covering the selected bottom patch', () => {
  const viewport = { width: 248, height: 568 };
  const target: GuideTarget = {
    cell: { x: 52.76, y: 293.52, width: 37.06, height: 32.04 },
    patches: [{ x: 52.76, y: 293.52, width: 73.16, height: 32.87 }, { x: 12.82, y: 417.51, width: 73.16, height: 32.87 }],
    viewport,
  };
  const controls = [{ x: 12, y: 0, width: 224, height: 56 }, { x: 10, y: 150, width: 228, height: 64 },
    { x: 10, y: 506, width: 228, height: 54 }];
  const placed = placeCoach(target, { width: 232, height: 80 }, viewport, controls);
  for (const bounds of [...target.patches, ...controls]) assert.equal(intersects(placed, bounds), false);
});

test('unsupported hint sizes report the layout error explicitly', () => {
  const cell = { x: 20, y: 20, width: 30, height: 30 };
  const viewport = { width: 248, height: 568 };
  assert.throws(() => placeCoach({ cell, patches: [cell], viewport }, { width: 400, height: 90 }, viewport, []), /larger/);
});
