import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { cloneCraftGeometry, decodeCraftWorld, makeCraftCourier } from './craftWorld.ts';

const world = decodeCraftWorld(Uint8Array.from(fs.readFileSync(new URL('./assets/craft/world-kit.glb', import.meta.url))).buffer);

test('the actual Blender kit retains every seasonal tree and separately paintable cottage roofs', async () => {
  const kit = await world;
  assert.equal(kit.trees.size, 8);
  const roof = kit.cottage.geometry.getAttribute('_roof');
  assert.ok(roof);
  assert.ok(Array.from({ length: roof.count }, (_, index) => roof.getX(index)).some((value) => value > .5));
});

test('the shared Blender courier has real independent limb and blink pivots without sharing mutable instances', async () => {
  const kit = await world, first = makeCraftCourier(kit), second = makeCraftCourier(kit);
  const bounds = new THREE.Box3().setFromObject(first.root);
  assert.ok(bounds.max.y < .44 && bounds.min.y > -.03 && bounds.max.x < .16);
  const before = new THREE.Box3().setFromObject(first.armRight).getCenter(new THREE.Vector3()).toArray();
  first.armRight.rotation.z = 1.3;
  assert.notDeepEqual(new THREE.Box3().setFromObject(first.armRight).getCenter(new THREE.Vector3()).toArray(), before);
  assert.deepEqual(new THREE.Box3().setFromObject(second.armRight).getCenter(new THREE.Vector3()).toArray(), before);
  assert.ok(first.eyes && second.eyes && first.eyes !== second.eyes);
  let triangles = 0, draws = 0;
  first.root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    draws++;
    triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
    assert.equal(object.layers.isEnabled(1), false);
  });
  assert.ok(draws <= 8 && triangles <= 8000, `${draws} draws/${triangles} triangles`);
  for (const rig of [first, second]) {
    rig.geometries.forEach(geometry => geometry.dispose());
    rig.materials.forEach(material => material.dispose());
  }
});

test('quantized Blender scenery is expanded safely before world transforms rather than wrapping tall vertices', async () => {
  const kit = await world;
  for (const source of [kit.cottage, ...kit.trees.values()]) {
    const geometry = cloneCraftGeometry(source);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    assert.ok(bounds && bounds.min.y > -.01 && bounds.max.y > .5 && bounds.max.y < 1.3, source.name);
    assert.ok(geometry.getAttribute('position').array instanceof Float32Array);
    geometry.dispose();
  }
});

test('the complete animated miniature kit preserves the existing 320 KiB core-art budget', () => {
  const directory = new URL('./assets/craft/', import.meta.url);
  const files = fs.readdirSync(directory);
  assert.ok(files.every(name => name === 'LICENSES.txt' || /\.(webp|glb)$/.test(name)));
  const bytes = files.filter(name => name !== 'LICENSES.txt')
    .reduce((sum, name) => sum + fs.statSync(new URL(name, directory)).size, 0);
  assert.ok(bytes <= 320 * 1024, `${bytes} bytes of miniature art.`);
});

test('all miniature Practice scenery stays inside the separate 160 KiB map-only budget', () => {
  const directory = new URL('./assets/craft-map/', import.meta.url);
  const bytes = fs.readdirSync(directory).reduce((sum, name) => sum + fs.statSync(new URL(name, directory)).size, 0);
  assert.ok(bytes <= 160 * 1024, `${bytes} bytes of map art.`);
});
