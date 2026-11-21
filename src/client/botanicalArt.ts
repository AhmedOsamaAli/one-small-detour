import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function roseBloom(color: string, miniature = false): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [], flower = new THREE.Color(color), leaf = new THREE.Color('#45644b');
  const stem = new THREE.CylinderGeometry(.005, .006, .12, 5);
  stem.translate(0, .06, 0);
  stem.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: stem.getAttribute('position').count }, () => leaf.toArray()).flat(), 3));
  pieces.push(stem);
  for (let layer = 0; layer < (miniature ? 3 : 4); layer++) {
    const count = 5 + layer, radius = .013 + layer * .010;
    for (let petal = 0; petal < count; petal++) {
      const geometry = new THREE.PlaneGeometry(1, 1, miniature ? 3 : 5, miniature ? 2 : 5), positions = geometry.getAttribute('position'), colors: number[] = [];
      const angle = petal / count * Math.PI * 2 + layer * .72;
      for (let index = 0; index < positions.count; index++) {
        // Keep the winding upward for the one-sided runtime material.
        const u = .5 - positions.getX(index), v = positions.getY(index) + .5;
        const breadth = Math.sin(v * Math.PI * .90 + .10) * radius * 1.7;
        const x = (u - .5) * breadth, z = radius * (.15 + v * .90);
        const y = .123 + (1 - layer / 5) * .027 + v * .025 - v * v * (.013 + layer * .006) +
          Math.pow(Math.abs(u - .5) * 2, 4) * .008;
        positions.setXYZ(index, Math.cos(angle) * x + Math.sin(angle) * z, y, -Math.sin(angle) * x + Math.cos(angle) * z);
        const shade = flower.clone().lerp(new THREE.Color('#fff3ef'), .10 + v * .20)
          .multiplyScalar(.73 + v * .24 + (petal % 3 - 1) * .025 - Math.abs(u - .5) * .05);
        colors.push(shade.r, shade.g, shade.b);
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();pieces.push(geometry.toNonIndexed());geometry.dispose();
    }
  }
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape().moveTo(0, 0).quadraticCurveTo(.032, .002, .041, .020)
      .quadraticCurveTo(.012, .030, 0, 0);
    const geometry = new THREE.ShapeGeometry(shape, 5);
    geometry.rotateX(-Math.PI / 2);geometry.rotateY(side * .9);
    geometry.translate(0, .055 + side * .014, 0);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: geometry.getAttribute('position').count }, () => leaf.toArray()).flat(), 3));
    pieces.push(geometry);
  }
  const normalized = pieces.map(piece => piece.index ? piece.toNonIndexed() : piece);
  const result = mergeGeometries(normalized);
  for (const piece of new Set([...pieces, ...normalized])) piece.dispose();
  if (!result) throw new Error('The layered rose petals could not be assembled.');
  return result;
}
