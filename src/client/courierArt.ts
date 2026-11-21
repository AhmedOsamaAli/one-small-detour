import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface CourierRig {
  root: THREE.Group;
  body: THREE.Object3D;
  armLeft: THREE.Object3D;
  armRight: THREE.Object3D;
  footLeft: THREE.Object3D;
  footRight: THREE.Object3D;
  eyes?: THREE.Object3D;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  textures: THREE.Texture[];
}

export function makeCourier(): CourierRig {
  const root = new THREE.Group(), body = new THREE.Group();
  const armLeft = new THREE.Group(), armRight = new THREE.Group();
  const footLeft = new THREE.Group(), footRight = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [], textures: THREE.Texture[] = [];
  const cloth = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const value = 235 + ((x % 3 + y % 3) % 3) * 5;
    cloth.set([value, value, value, 255], (y * 32 + x) * 4);
  }
  const weave = new THREE.DataTexture(cloth, 32, 32);
  weave.colorSpace = THREE.SRGBColorSpace;
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  weave.repeat.set(3, 3); weave.needsUpdate = true; textures.push(weave);
  const surface = (color: string, roughness: number, woven = false): THREE.MeshStandardMaterial => {
    const material = new THREE.MeshStandardMaterial({ color, roughness, ...(woven ? { map: weave } : {}) });
    materials.push(material);
    return material;
  };
  const coat = surface('#396f70', .94, true), coatShade = surface('#2a565c', .96, true);
  const skin = surface('#e9bf9f', .82), hair = surface('#654938', .93);
  const hat = surface('#dab971', .91, true), hatLight = surface('#edd29a', .9, true);
  const leather = surface('#865d3e', .78), leatherLight = surface('#b58150', .81);
  const scarf = surface('#c78659', .97, true), scarfLight = surface('#e1a571', .96, true);
  const boot = surface('#5c4637', .85), sole = surface('#3b3e39', .98);
  const trouser = surface('#3b4e52', .98, true), brass = surface('#d5b570', .44);
  const eye = surface('#273b3a', .3), glint = surface('#ffefd4', .34);
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Group, x: number, y: number, z: number): THREE.Mesh => {
    geometries.push(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);object.castShadow = object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const sphere = (radius: number, material: THREE.Material, parent: THREE.Group, x: number, y: number, z: number, scale?: readonly [number, number, number]): THREE.Mesh => {
    const object = add(new THREE.SphereGeometry(radius, 12, 9), material, parent, x, y, z);
    if (scale) object.scale.set(...scale);
    return object;
  };
  const bodyShape = [
    new THREE.Vector2(.055, .066), new THREE.Vector2(.078, .076), new THREE.Vector2(.077, .105),
    new THREE.Vector2(.066, .185), new THREE.Vector2(.052, .219), new THREE.Vector2(.026, .226),
  ];
  const jacket = add(new THREE.LatheGeometry(bodyShape, 16), coat, body, 0, 0, 0);
  jacket.scale.z = .78;
  const hem = add(new THREE.TorusGeometry(.074, .0035, 5, 20), coatShade, body, 0, .079, 0);
  hem.rotation.x = Math.PI / 2;hem.scale.y = .79;
  const head = sphere(.069, skin, body, 0, .285, .002, [.96, 1.09, .96]);
  head.rotation.x = -.025;
  sphere(.062, hair, body, 0, .302, -.014, [1.01, .83, 1]);
  sphere(.012, skin, body, -.065, .285, -.001, [.55, .94, .72]);
  sphere(.012, skin, body, .065, .285, -.001, [.55, .94, .72]);
  sphere(.018, hair, body, -.054, .315, .019, [.55, 1.1, .7]);
  for (const x of [-.024, .024]) {
    sphere(.0075, eye, body, x, .288, .063, [1, 1.13, .57]);
    sphere(.0025, glint, body, x - .002, .291, .068);
    const brow = add(new THREE.CapsuleGeometry(.0025, .012, 2, 5), hair, body, x, .307, .06);
    brow.rotation.z = x < 0 ? 1.36 : -1.36;
    sphere(.009, surface('#dbac91', .9), body, x * 1.7, .27, .053, [1, .50, .25]);
  }
  sphere(.011, skin, body, 0, .276, .072, [.9, .8, 1]);
  const smile = add(new THREE.TorusGeometry(.014, .0022, 4, 12, Math.PI * .74),
    surface('#95634f', .9), body, -.003, .26, .065);
  smile.rotation.z = Math.PI * 1.13;
  const brim = add(new THREE.CylinderGeometry(.104, .108, .012, 28), hatLight, body, 0, .34, -.003);
  brim.scale.z = .86;
  add(new THREE.CylinderGeometry(.063, .077, .058, 24), hat, body, 0, .374, -.006);
  sphere(.063, hat, body, 0, .402, -.006, [1, .16, 1]);
  add(new THREE.CylinderGeometry(.076, .079, .013, 24), leather, body, 0, .350, -.006);
  const brimEdge = add(new THREE.TorusGeometry(.105, .0022, 4, 28), hat, body, 0, .337, -.003);
  brimEdge.rotation.x = Math.PI / 2;brimEdge.scale.y = .86;
  const neck = add(new THREE.TorusGeometry(.043, .013, 6, 18), scarf, body, 0, .226, 0);
  neck.rotation.x = Math.PI / 2;
  const scarfEnd = add(new THREE.CapsuleGeometry(.010, .039, 3, 6), scarfLight, body, -.024, .193, .063);
  scarfEnd.rotation.z = -.22;scarfEnd.scale.z = .4;
  for (const y of [.107, .141, .176]) sphere(.0038, brass, body, .006, y, .056);
  const seam = add(new THREE.CylinderGeometry(.0015, .0015, .11, 4), coatShade, body, -.003, .144, .059);
  seam.rotation.z = .025;
  const pocket = add(new THREE.BoxGeometry(.031, .027, .005), coatShade, body, -.037, .125, .056);
  pocket.rotation.z = -.06;
  const strap = add(new THREE.BoxGeometry(.013, .186, .006), leatherLight, body, .005, .164, .066);
  strap.rotation.z = .59;
  const satchel = add(new THREE.CapsuleGeometry(.039, .035, 4, 12), leather, body, .086, .12, .016);
  satchel.scale.set(1.25, 1, .8);satchel.rotation.z = Math.PI / 2;
  const flap = add(new THREE.BoxGeometry(.096, .041, .009), leatherLight, body, .087, .146, .049);
  flap.rotation.z = -.03;
  add(new THREE.BoxGeometry(.013, .021, .006), brass, body, .087, .135, .056);
  for (const [arm, x] of [[armLeft, -.079], [armRight, .079]] as const) {
    arm.position.set(x, .193, 0);
    const sleeve = add(new THREE.CapsuleGeometry(.021, .062, 4, 9), coat, arm, 0, -.035, 0);
    sleeve.rotation.z = x < 0 ? -.08 : .08;
    add(new THREE.CylinderGeometry(.019, .019, .012, 10), coatShade, arm, 0, -.077, 0);
    sphere(.017, skin, arm, 0, -.092, .002, [.9, 1.08, .9]);
    sphere(.0065, skin, arm, x < 0 ? .013 : -.013, -.088, .009, [.8, 1, .85]);
    body.add(arm);
  }
  for (const [foot, x] of [[footLeft, -.033], [footRight, .033]] as const) {
    add(new THREE.CapsuleGeometry(.020, .054, 3, 8), trouser, foot, x, .040, -.003);
    sphere(.031, boot, foot, x, -.003, .013, [.8, .64, 1.28]);
    sphere(.032, sole, foot, x, -.016, .015, [.82, .18, 1.28]);
    add(new THREE.BoxGeometry(.026, .004, .025), leatherLight, foot, x, .012, .021);
  }
  // Merge rigid material groups, retaining only the body/limb pivots needed for animation.
  for (const group of [body, armLeft, armRight, footLeft, footRight]) {
    group.updateMatrixWorld(true);
    const sets = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of group.children) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
      const entries = sets.get(child.material) ?? [];entries.push(child);sets.set(child.material, entries);
    }
    for (const [material, entries] of sets) {
      if (entries.length < 2) continue;
      const pieces = entries.map(part => { part.updateMatrix();return part.geometry.clone().applyMatrix4(part.matrix); });
      const merged = mergeGeometries(pieces);
      pieces.forEach(piece => piece.dispose());
      if (!merged) throw new Error('The courier material groups could not be combined.');
      geometries.push(merged);
      const combined = new THREE.Mesh(merged, material);combined.castShadow = combined.receiveShadow = true;
      group.add(combined);entries.forEach(part => group.remove(part));
    }
  }
  root.add(body, footLeft, footRight);
  return { root, body, armLeft, armRight, footLeft, footRight, geometries, materials, textures };
}
