import assert from 'node:assert/strict';
import test from 'node:test';
import { courierWorldScale, flatCourierGeometry } from './courierSizing.ts';

test('Flat couriers grow with their map tiles while staying inside edge cells', () => {
  let widthRatio: number | null = null, heightRatio: number | null = null;
  for (const size of [16, 24, 40, 80, 160, 320]) {
    const body = flatCourierGeometry(size, size);
    widthRatio ??= body.width / size;
    heightRatio ??= body.height / size;
    assert.ok(Math.abs(body.width / size - widthRatio) < 1e-12);
    assert.ok(Math.abs(body.height / size - heightRatio) < 1e-12);
    assert.ok(body.width / size > 0.55 && body.width / size < 0.6);
    assert.ok(body.height / size > 0.94 && body.height / size < 1);
    assert.ok(body.offsetX >= 0 && body.offsetY >= 0);
    assert.ok(body.offsetX + body.width <= size && body.offsetY + body.height <= size);
    assert.ok(body.width > Math.min(28 * 1.35, size * 0.5) * 1.1);
  }
});

test('3D couriers receive a modest enlargement even when dense-board scaling reaches its cap', () => {
  for (const labelScale of [0.05, 0.4, 0.9, 1.4, 2, 5]) {
    const previous = Math.min(3, 1.35 * Math.max(1, Math.min(2.4, labelScale * 1.65)));
    const current = courierWorldScale(labelScale);
    assert.ok(current > previous * 1.1 && current < previous * 1.2);
  }
});
