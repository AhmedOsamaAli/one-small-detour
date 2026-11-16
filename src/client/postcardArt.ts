import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function tint(geometry: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const value = new THREE.Color(color);
  const colors: number[] = [];
  for (let index = 0; index < geometry.getAttribute('position').count; index++) colors.push(value.r, value.g, value.b);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function assemble(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const result = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!result) throw new Error('The living-postcard sculpture could not be assembled.');
  return result;
}

export function carvedEarth(geometry: THREE.BufferGeometry, depth = 0.23): THREE.BufferGeometry {
  const positions = geometry.getAttribute('position');
  const colors: number[] = [];
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
    const height = Math.max(0, Math.min(1, y / depth));
    const taper = 0.93 + height * 0.07;
    positions.setXYZ(index, x * taper, y, z * taper);
    const grain = Math.sin(x * 29 + z * 17) * 0.025;
    const shade = 0.69 + height * 0.28 + grain;
    colors.push(shade, shade * (0.90 + height * 0.10), shade * (0.78 + height * 0.22));
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

export function postcardFlowers(color: string): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const [x, z, height] of [[-0.045, 0.025, 0.15], [0.055, -0.035, 0.19]]) {
    if (x === undefined || z === undefined || height === undefined) throw new Error('A postcard flower is missing its stem.');
    parts.push(tint(new THREE.CylinderGeometry(0.006, 0.008, height, 4).translate(x, height / 2, z), '#658b50'));
    parts.push(tint(new THREE.SphereGeometry(0.035, 5, 3).scale(1, 0.25, 0.5).rotateZ(-0.35).translate(x - 0.025, height * 0.5, z), '#94b45d'));
    for (let petal = 0; petal < 5; petal++) {
      const angle = petal * Math.PI * 2 / 5;
      parts.push(tint(new THREE.SphereGeometry(0.032, 5, 3).scale(1, 0.48, 1)
        .translate(x + Math.cos(angle) * 0.026, height, z + Math.sin(angle) * 0.026), color));
    }
    parts.push(tint(new THREE.SphereGeometry(0.020, 5, 3).scale(1, 0.65, 1).translate(x, height + 0.012, z), '#f5cc63'));
  }
  return assemble(parts);
}

export function postcardResident(coat: string): { body: THREE.BufferGeometry; arm: THREE.BufferGeometry } {
  const parts = [
    tint(new THREE.CapsuleGeometry(0.047, 0.075, 3, 7).translate(0, 0.13, 0), coat),
    tint(new THREE.SphereGeometry(0.044, 8, 6).scale(0.95, 1.06, 1).translate(0, 0.245, 0), '#ebc39b'),
    tint(new THREE.CylinderGeometry(0.067, 0.070, 0.014, 10).translate(0, 0.282, 0), '#e9c77f'),
    tint(new THREE.CylinderGeometry(0.042, 0.048, 0.035, 8).translate(0, 0.300, 0), '#dbb164'),
    tint(new THREE.CapsuleGeometry(0.014, 0.070, 2, 5).rotateZ(-0.10).translate(-0.060, 0.145, 0), coat),
    tint(new THREE.SphereGeometry(0.017, 5, 4).translate(-0.066, 0.095, 0), '#ebc39b'),
  ];
  for (const x of [-0.022, 0.022]) {
    parts.push(tint(new THREE.BoxGeometry(0.032, 0.06, 0.035).translate(x, 0.04, 0), '#35474d'));
    parts.push(tint(new THREE.BoxGeometry(0.035, 0.025, 0.058).translate(x, 0.012, 0.008), '#73503b'));
    parts.push(tint(new THREE.SphereGeometry(0.005, 4, 3).translate(x * 0.7, 0.249, 0.040), '#253f43'));
  }
  return {
    body: assemble(parts),
    arm: assemble([
      tint(new THREE.CapsuleGeometry(0.014, 0.060, 2, 5).translate(0, -0.033, 0), coat),
      tint(new THREE.SphereGeometry(0.017, 5, 4).translate(0, -0.078, 0), '#ebc39b'),
    ]),
  };
}

