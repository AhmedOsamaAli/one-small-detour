import assert from 'node:assert/strict';
import test from 'node:test';
import { frameArrowPath } from './frameArrow.ts';
import type { FrameAxes } from '../shared/types.ts';

const flat: FrameAxes = { col: { x: 1, y: 0 }, row: { x: 0, y: 1 } };

function shaft(path: string): { x: number; y: number } {
  const values = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  assert.ok(values && values.length === 10);
  assert.deepEqual(values.slice(2, 4), [16, 16]);
  return { x: 16 - (values[0] ?? 0), y: 16 - (values[1] ?? 0) };
}

test('flat wide arrows point right into the first square', () => {
  assert.deepEqual(shaft(frameArrowPath({ rows: 1, cols: 2 }, flat)), { x: 12, y: 0 });
});

test('flat tall arrows point down into the first square', () => {
  assert.deepEqual(shaft(frameArrowPath({ rows: 2, cols: 1 }, flat)), { x: 0, y: 12 });
});

test('both arrows follow their actual projected frame axes without leaving the first square', () => {
  const axes: FrameAxes = { col: { x: 0.8, y: 0.6 }, row: { x: -0.6, y: 0.8 } };
  for (const shape of [{ rows: 1, cols: 2 }, { rows: 2, cols: 1 }]) {
    const path = frameArrowPath(shape, axes);
    const direction = shaft(path);
    const axis = shape.rows > shape.cols ? axes.row : axes.col;
    assert.ok(Math.abs(direction.x * axis.y - direction.y * axis.x) < 0.001);
    assert.ok(direction.x * axis.x + direction.y * axis.y > 0);
    assert.ok(path.match(/-?\d+(?:\.\d+)?/g)?.map(Number).every((value) => value >= 3 && value <= 29));
  }
});

test('invalid projections are rejected explicitly', () => {
  assert.throws(() => frameArrowPath({ rows: 1, cols: 2 }, { ...flat, col: { x: 0, y: 0 } }), /projected/);
  assert.throws(() => frameArrowPath({ rows: 2, cols: 1 }, { ...flat, row: { x: Number.NaN, y: 1 } }), /projected/);
});
