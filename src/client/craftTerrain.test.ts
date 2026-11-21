import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { roseBloom } from './botanicalArt.ts';
import { groundSculpture, sculptedBank, sculptedBridge, sculptedPaving } from './craftTerrain.ts';
import { GROUND_MOTIFS } from './craftSurface.ts';
import { courierPose, turnToward } from './craftMotion.ts';
import { CraftCelebration } from './craftEffects.ts';

test('sculpted paving stays inside its tile with upward faces and materially different shared variants', () => {
  const variants = [0, 1, 2].map(sculptedPaving);
  for (const geometry of variants) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    assert.ok(box && box.min.x > -.45 && box.max.x < .45 && box.min.z > -.45 && box.max.z < .45);
    assert.ok((geometry.index?.count ?? 0) / 3 <= 300);
    const p = geometry.getAttribute('position'), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const face = new THREE.Vector3(), side = new THREE.Vector3();let tops = 0;
    for (let index = 0; index < (geometry.index?.count ?? 0); index += 3) {
      a.fromBufferAttribute(p, geometry.index?.getX(index) ?? 0);b.fromBufferAttribute(p, geometry.index?.getX(index + 1) ?? 0);c.fromBufferAttribute(p, geometry.index?.getX(index + 2) ?? 0);
      if (Math.min(a.y, b.y, c.y) < .050) continue;
      assert.ok(face.subVectors(b, a).cross(side.subVectors(c, a)).y > 0);
      tops++;
    }
    assert.ok(tops >= 20);
  }
  assert.notDeepEqual(variants[0]?.getAttribute('position').array, variants[1]?.getAttribute('position').array);
  variants.forEach(geometry => geometry.dispose());
});

test('the mobile flower preserves one-sided visible petals while removing over 75 percent of its triangles', () => {
  const full = roseBloom('#e1a2c2'), small = roseBloom('#e1a2c2', true);
  assert.ok(small.getAttribute('position').count < full.getAttribute('position').count / 4);
  small.computeBoundingBox();
  assert.ok(small.boundingBox && small.boundingBox.max.y > .14 && small.boundingBox.max.y < .20);
  const p = small.getAttribute('position'), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let petals = 0, upward = 0;
  for (let index = 0; index < p.count; index += 3) {
    a.fromBufferAttribute(p, index);b.fromBufferAttribute(p, index + 1);c.fromBufferAttribute(p, index + 2);
    if ((a.y + b.y + c.y) / 3 < .125) continue;
    petals++;
    if (b.sub(a).cross(c.sub(a)).y > 0) upward++;
  }
  assert.ok(petals > 100 && upward / petals > .95);
  full.dispose();small.dispose();
});

test('sculpted banks and seasonal objects remain bounded decorative geometry', () => {
  const bank = sculptedBank(), bridge = sculptedBridge();
  bank.computeBoundingBox();bridge.computeBoundingBox();
  assert.ok(bank.boundingBox && bank.boundingBox.min.x >= -.5 && bank.boundingBox.max.x <= .5 && bank.boundingBox.max.y < .03);
  assert.ok(bridge.boundingBox && bridge.boundingBox.max.y < .31 && bridge.boundingBox.min.x >= -.5 && bridge.boundingBox.max.x <= .5);
  for (const motif of new Set(Object.values(GROUND_MOTIFS))) {
    const geometry = groundSculpture(motif);geometry.computeBoundingBox();
    assert.ok(geometry.boundingBox && geometry.boundingBox.max.y < .16 && geometry.boundingBox.max.x < .2, motif);
    geometry.dispose();
  }
  bank.dispose();bridge.dispose();
});

test('courier turns take the short way around and reduced motion removes expressive movement', () => {
  const from = Math.PI - .05, target = -Math.PI + .05;
  const next = turnToward(from, target, 16);
  assert.ok(next > from && next < Math.PI + .05);
  const still = courierPose(5.2, true, 280, 1, true, true);
  assert.equal(still.stride, 0);assert.equal(still.bodyY, 0);assert.equal(still.raisedArm, 0);assert.equal(still.eyes, 1);
  assert.ok(courierPose(.1, true, null, 0, false, false).stride > 0);
  assert.ok(courierPose(.2, false, 210, 0, false, false).bodyX > 0);
});

test('the coordinated finish reuses two bounded instance batches and settles without live particle objects', () => {
  const effect = new CraftCelebration();
  effect.show([{ row: 0, col: 0 }, { row: 5, col: 5 }], 6, true, false, ['#ddba74', '#a6bf93']);
  const meshes = effect.root.children.filter((node): node is THREE.InstancedMesh => node instanceof THREE.InstancedMesh);
  assert.equal(meshes.length, 2);
  assert.ok(meshes.every(mesh => mesh.count <= 24));
  assert.equal(effect.update(1950), false);
  assert.equal(effect.active, false);
  assert.ok(meshes.every(mesh => mesh.count === 0 && !mesh.visible));
  effect.show([{ row: 0, col: 0 }], 6, false, true, ['#ddba74']);
  assert.equal(meshes[0]?.count, 0);
  effect.dispose();
});
