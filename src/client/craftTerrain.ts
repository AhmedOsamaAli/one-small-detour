import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GroundMotif, SurfacePoint } from './craftSurface.ts';
import { pavingStones, STONE_OUTLINE } from './craftSurface.ts';

const TILE_OUTLINE: readonly SurfacePoint[] = [
  [-.41, -.50], [.39, -.50], [.49, -.40], [.50, .39],
  [.40, .49], [-.39, .50], [-.49, .40], [-.50, -.39],
];

function join(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  if (!geometry) throw new Error('The sculpted landscape could not be assembled.');
  return geometry;
}

function tint(geometry: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const colors = geometry.getAttribute('color');
  for (let index = 0; index < colors.count; index++) colors.setXYZ(index, colors.getX(index) * color.r, colors.getY(index) * color.g, colors.getZ(index) * color.b);
  return geometry;
}

export function softTerrain(width: number, depth: number, height: number, bevel: number, outline = TILE_OUTLINE): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const rings = [[.91, 0, .57], [1, bevel, .74], [1, height - bevel, .86], [.91, height, .96]] as const;
  for (const [scale, y, shade] of rings) for (const [x, z] of outline) {
    positions.push(x * width * scale, y, z * depth * scale);
    colors.push(shade, shade, shade);
  }
  const count = outline.length;
  for (let ring = 0; ring < rings.length - 1; ring++) for (let edge = 0; edge < count; edge++) {
    const a = ring * count + edge, b = ring * count + (edge + 1) % count;
    indices.push(a, b + count, b, a, a + count, b + count);
  }
  const top = positions.length / 3;
  positions.push(0, height + Math.min(.006, bevel * .2), 0);
  colors.push(1, 1, 1);
  const bottom = positions.length / 3;
  positions.push(0, 0, 0);colors.push(.54, .54, .54);
  for (let edge = 0; edge < count; edge++) {
    const next = (edge + 1) % count, offset = (rings.length - 1) * count;
    indices.push(top, offset + next, offset + edge, bottom, edge, next);
  }
  const geometry = new THREE.BufferGeometry().setIndex(indices)
    .setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    .setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function sculptedPaving(variant: number): THREE.BufferGeometry {
  return join(pavingStones(variant).map(stone => {
    const geometry = softTerrain(stone.width, stone.depth, .052, .012, STONE_OUTLINE);
    geometry.rotateY(stone.turn).translate(stone.x, 0, stone.z);
    return tint(geometry, new THREE.Color().setScalar(stone.shade));
  }));
}

export function sculptedRoadLink(): THREE.BufferGeometry {
  return join([-.115, .115].map((x, index) => {
    const stone = softTerrain(.23, .19, .035, .009, STONE_OUTLINE);
    stone.translate(x, 0, 0);
    return tint(stone, new THREE.Color().setScalar(index ? .98 : .9));
  }));
}

export function sculptedBridge(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 8; index++) {
    const x = (index - 3.5) * .119, arch = Math.sin((index + .5) * Math.PI / 8) * .065;
    const plank = softTerrain(.112, .49, .045, .008);
    plank.translate(x, arch, 0);
    pieces.push(tint(plank, new THREE.Color().setScalar(.85 + index % 3 * .07)));
  }
  for (const z of [-.26, .26]) {
    const rail = softTerrain(.96, .033, .035, .006);
    rail.translate(0, .27, z);pieces.push(tint(rail, new THREE.Color('#a39478')));
    for (const x of [-.40, .40]) {
      const post = softTerrain(.045, .045, .28, .008);
      post.translate(x, .015, z);pieces.push(tint(post, new THREE.Color('#9c886a')));
      const cap = softTerrain(.067, .066, .022, .004);
      cap.translate(x, .28, z);pieces.push(cap);
    }
  }
  return join(pieces);
}

export function sculptedBank(): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  for (let step = 0; step <= 8; step++) {
    const x = step / 8 - .5, wave = Math.sin(step * .8) * .009;
    for (const [z, y, shade] of [[-.065, -.025, .61], [-.012, -.012, .83], [.048 + wave, .020, 1]] as const) {
      positions.push(x, y, z);colors.push(shade, shade, shade);
    }
  }
  for (let step = 0; step < 8; step++) for (let lane = 0; lane < 2; lane++) {
    const a = step * 3 + lane;
    indices.push(a, a + 1, a + 4, a, a + 4, a + 3);
  }
  const geometry = new THREE.BufferGeometry().setIndex(indices)
    .setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    .setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function groundSculpture(motif: GroundMotif): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  const add = (geometry: THREE.BufferGeometry, color: string): void => {
    const count = geometry.getAttribute('position').count;
    const paint = new THREE.Color(color);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: count }, () => paint.toArray()).flat(), 3));
    pieces.push(geometry.index ? geometry.toNonIndexed() : geometry);
    if (geometry.index) geometry.dispose();
  };
  if (motif === 'apple') {
    const apple = new THREE.SphereGeometry(.052, 8, 5);apple.translate(0, .047, 0);add(apple, '#be7758');
    const leaf = new THREE.PlaneGeometry(.055, .024);leaf.rotateX(-Math.PI / 2).rotateY(.6).translate(.02, .10, 0);add(leaf, '#a2b17a');
  } else if (motif === 'shell') {
    const shell = new THREE.SphereGeometry(.075, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    shell.scale(1, .34, .70);add(shell, '#e3d5b8');
    for (const x of [-.032, 0, .032]) {
      const rib = new THREE.BoxGeometry(.006, .004, .075);rib.translate(x, .020, 0);add(rib, '#bfa886');
    }
  } else if (motif === 'snow') {
    const drift = new THREE.SphereGeometry(.17, 10, 5);
    drift.scale(1, .09, .65);drift.translate(0, .012, 0);add(drift, '#e6eeee');
  } else if (motif === 'lavender') {
    for (const x of [-.065, .008, .067]) {
      const bud = new THREE.SphereGeometry(.026, 6, 5);bud.scale(.8, 2.3, .8);bud.translate(x, .072 + x * .2, 0);add(bud, '#b4a1c6');
      const stem = new THREE.CylinderGeometry(.004, .005, .07, 3);stem.translate(x, .035, 0);add(stem, '#789774');
    }
  } else {
    const shape = new THREE.Shape();
    if (motif === 'maple') {
      shape.moveTo(0, -.07);for (const [x, y] of [[-.02, -.025], [-.075, -.045], [-.055, -.005], [-.09, .02], [-.035, .035],
        [-.045, .08], [0, .055], [.045, .08], [.035, .035], [.09, .02], [.055, -.005], [.075, -.045], [.02, -.025]] as const) shape.lineTo(x, y);
      shape.closePath();
    } else if (motif === 'ginkgo') {
      shape.moveTo(0, -.07);shape.lineTo(-.09, .04);shape.quadraticCurveTo(-.055, .11, -.005, .075);
      shape.lineTo(0, .05);shape.lineTo(.005, .075);shape.quadraticCurveTo(.055, .11, .09, .04);shape.closePath();
    } else {
      for (let petal = 0; petal < 3; petal++) {
        const leaf = new THREE.SphereGeometry(.045, 6, 4);leaf.scale(1, .14, .75);
        leaf.translate(Math.cos(petal * Math.PI * 2 / 3) * .032, .01, Math.sin(petal * Math.PI * 2 / 3) * .032);add(leaf, '#a2b880');
      }
    }
    if (motif !== 'clover') {
      const leaf = new THREE.ShapeGeometry(shape, 4).rotateX(-Math.PI / 2);
      leaf.translate(0, .012, 0);add(leaf, motif === 'maple' ? '#df934b' : '#ddc27b');
    }
  }
  return join(pieces);
}
