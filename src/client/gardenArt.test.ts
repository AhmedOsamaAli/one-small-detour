import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { makeCourier } from './courierArt.ts';
import { roseBloom } from './botanicalArt.ts';

test('the articulated courier stays within the fitted miniature envelope and retains independent animation pivots', () => {
  const rig = makeCourier(), bounds = new THREE.Box3().setFromObject(rig.root);
  assert.ok(bounds.max.y < .44 && bounds.min.y > -.03 && bounds.max.x < .16);
  const original = new THREE.Box3().setFromObject(rig.armRight);
  rig.armRight.rotation.z = -.45;
  assert.notDeepEqual(new THREE.Box3().setFromObject(rig.armRight).getCenter(new THREE.Vector3()).toArray(),
    original.getCenter(new THREE.Vector3()).toArray());
  assert.equal(new Set([rig.body, rig.armLeft, rig.armRight, rig.footLeft, rig.footRight]).size, 5);
  let triangles = 0, draws = 0;
  rig.root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    draws++;
    triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
    assert.equal(object.layers.isEnabled(1), false);
  });
  assert.ok(draws <= 45 && triangles <= 14000, `The courier exceeded its runtime budget: ${draws} draws/${triangles} triangles.`);
  rig.geometries.forEach(geometry => geometry.dispose());
  rig.materials.forEach(material => material.dispose());
  rig.textures.forEach(texture => texture.dispose());
});

test('layered rose geometry remains inside its source square rather than covering neighbouring terrain', () => {
  const rose = roseBloom('#e1a2c2');
  rose.computeBoundingBox();
  const bounds = rose.boundingBox;
  assert.ok(bounds);
  assert.ok(bounds.min.x > -.09 && bounds.max.x < .09 && bounds.min.z > -.09 && bounds.max.z < .09);
  assert.ok(bounds.max.y < .20 && bounds.min.y >= -.001);
  assert.ok(rose.getAttribute('position').count / 3 <= 1800);
  const colors = rose.getAttribute('color');
  assert.equal(colors.count, rose.getAttribute('position').count);
  assert.ok(new Set(Array.from({ length: colors.count }, (_, index) => colors.getX(index).toFixed(3))).size >= 10);
  rose.dispose();
});

test('rose petals face upward so one-sided runtime materials show the blossom from the game camera', () => {
  const rose = roseBloom('#e1a2c2'), positions = rose.getAttribute('position');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  let petals = 0, upward = 0;
  for (let vertex = 0; vertex < positions.count; vertex += 3) {
    a.fromBufferAttribute(positions, vertex);
    b.fromBufferAttribute(positions, vertex + 1);
    c.fromBufferAttribute(positions, vertex + 2);
    if ((a.y + b.y + c.y) / 3 <= .125) continue;
    petals++;
    if (ab.subVectors(b, a).cross(ac.subVectors(c, a)).y > 0) upward++;
  }
  assert.ok(petals > 1000);
  assert.ok(upward / petals > .95, `${upward}/${petals} petal faces point toward the viewer.`);
  rose.dispose();
});

test('the shared detailed art ships bounded atlases instead of raw scanned meshes or high-resolution textures', () => {
  const directory = new URL('./assets/garden/', import.meta.url);
  const images = fs.readdirSync(directory).filter(name => name.endsWith('.webp'));
  const bytes = images.reduce((sum, name) => sum + fs.statSync(new URL(name, directory)).size, 0);
  assert.ok(bytes <= 320 * 1024, `The shared art exceeded its download budget: ${bytes} bytes.`);
  assert.ok(fs.readdirSync(directory).every(name => !/\.(gltf|glb|bin|hdr|exr)$/i.test(name)));
});

test('the completed journey landscape stays within a separate small map-art download budget', () => {
  const directory = new URL('./assets/landscape/', import.meta.url);
  const files = fs.readdirSync(directory);
  const bytes = files.filter(name => name.endsWith('.webp'))
    .reduce((sum, name) => sum + fs.statSync(new URL(name, directory)).size, 0);
  assert.ok(bytes <= 160 * 1024, `The map-only art exceeded its download budget: ${bytes} bytes.`);
  assert.ok(files.every(name => !/\.(gltf|glb|bin|hdr|exr)$/i.test(name)));
});
