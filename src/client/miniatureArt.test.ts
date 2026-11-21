import assert from 'node:assert/strict';
import test from 'node:test';
import { miniatureFoliage, miniatureSurfacePixels } from './miniatureArt.ts';
import type { MiniatureSurface } from './miniatureArt.ts';

test('procedural surfaces are deterministic and preserve opaque, restrained colour while separating relief from roughness', () => {
  const surfaces: MiniatureSurface[] = ['stone', 'timber', 'plaster', 'earth', 'roof', 'grass'];
  const signatures = new Set<string>();
  for (const surface of surfaces) {
    const first = miniatureSurfacePixels(surface), repeated = miniatureSurfacePixels(surface);
    assert.deepEqual(first, repeated);
    const heights = new Set<number>(), tones = new Set<number>();
    for (let at = 0; at < first.color.length; at += 4) {
      assert.equal(first.color[at + 3], 255);
      assert.equal(first.relief[at + 3], 255);
      assert.ok((first.color[at] ?? 0) >= 210 && (first.color[at] ?? 0) <= 255);
      assert.ok((first.relief[at + 1] ?? 0) > 180);
      heights.add(first.relief[at] ?? 0);
      tones.add(first.color[at] ?? 0);
    }
    assert.ok(heights.size > 20);
    assert.ok(tones.size > 5);
    signatures.add(Buffer.from(first.relief).toString('base64'));
  }
  assert.equal(signatures.size, surfaces.length);
});

test('the natural canopy remains inside its original miniature footprint with valid matching colour and normal attributes', () => {
  const geometry = miniatureFoliage();
  try {
    const positions = geometry.getAttribute('position'), colors = geometry.getAttribute('color'), normals = geometry.getAttribute('normal');
    assert.equal(colors.count, positions.count);
    assert.equal(normals.count, positions.count);
    for (let index = 0; index < positions.count; index++) {
      const length = Math.hypot(positions.getX(index), positions.getY(index), positions.getZ(index));
      assert.ok(Number.isFinite(length) && length <= .2 && length >= .18);
      assert.ok(Math.abs(Math.hypot(normals.getX(index), normals.getY(index), normals.getZ(index)) - 1) < .001);
      assert.ok(colors.getX(index) >= .8 && colors.getY(index) <= 1.1);
    }
  } finally { geometry.dispose(); }
});
