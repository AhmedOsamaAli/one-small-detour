import * as THREE from 'three';
import type { Theme } from '../shared/types.ts';
import type { CourierRig } from './courierArt.ts';

export interface CraftWorld {
  cottage: THREE.Mesh;
  courier: THREE.Object3D;
  trees: ReadonlyMap<Theme, THREE.Mesh>;
  rock: THREE.Mesh;
}

const THEMES: readonly Theme[] = ['meadow', 'coast', 'orchard', 'winter', 'blossom', 'maple', 'ginkgo', 'lavender'];
const WORLD = new URL('./assets/craft/world-kit.glb', import.meta.url).href;

function requiredNode(root: THREE.Object3D, name: string): THREE.Object3D {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`The miniature artwork is missing ${name}. Reload to retry.`);
  return node;
}

function requiredMesh(root: THREE.Object3D, name: string): THREE.Mesh {
  const node = requiredNode(root, name);
  if (!(node instanceof THREE.Mesh) || !node.geometry.getAttribute('color')) {
    throw new Error(`The miniature ${name} has no painted geometry.`);
  }
  return node;
}

export async function decodeCraftWorld(data: ArrayBuffer): Promise<CraftWorld> {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loaded = await new GLTFLoader().parseAsync(data, '');
  const root = loaded.scene;
  root.updateMatrixWorld(true);
  const courier = requiredNode(root, 'courier');
  for (const name of ['body', 'arm_left', 'arm_right', 'foot_left', 'foot_right', 'eyes']) requiredNode(courier, name);
  return {
    cottage: requiredMesh(root, 'cottage'),
    courier,
    trees: new Map(THEMES.map((theme) => [theme, requiredMesh(root, `tree_${theme}`)])),
    rock: requiredMesh(root, 'rock'),
  };
}

let pending: Promise<CraftWorld> | null = null;
export function loadCraftWorld(): Promise<CraftWorld> {
  if (pending) return pending;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  pending = fetch(WORLD, { signal: controller.signal }).then(async (response) => {
    if (!response.ok) throw new Error('The miniature world could not load. Reload to try again.');
    return decodeCraftWorld(await response.arrayBuffer());
  }).catch((error: unknown) => { pending = null; throw error; }).finally(() => clearTimeout(timeout));
  return pending;
}

export function cloneCraftGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const geometry = mesh.geometry.clone();
  for (const name of ['position', 'normal']) {
    const source = geometry.getAttribute(name);
    if (!source) throw new Error(`The miniature geometry is missing ${name}.`);
    const values = new THREE.Float32BufferAttribute(new Float32Array(source.count * 3), 3);
    for (let index = 0; index < source.count; index++) values.setXYZ(index, source.getX(index), source.getY(index), source.getZ(index));
    geometry.setAttribute(name, values);
  }
  return geometry.applyMatrix4(mesh.matrixWorld);
}

export function makeCraftCourier(world: CraftWorld): CourierRig {
  const root = new THREE.Group(), source = world.courier.clone(true);
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const shared = new Map<THREE.Material, THREE.Material>();
  source.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const original: unknown = object.material;
    if (!(original instanceof THREE.Material)) throw new Error('The miniature courier has an unexpected material group.');
    object.geometry = object.geometry.clone();
    geometries.push(object.geometry);
    let material = shared.get(original);
    if (!material) {
      material = original.clone();
      shared.set(original, material);
      materials.push(material);
    }
    object.material = material;
    object.castShadow = object.receiveShadow = true;
    object.layers.disable(1);
  });
  root.add(source);
  return { root, body: requiredNode(source, 'body'), armLeft: requiredNode(source, 'arm_left'),
    armRight: requiredNode(source, 'arm_right'), footLeft: requiredNode(source, 'foot_left'),
    footRight: requiredNode(source, 'foot_right'), eyes: requiredNode(source, 'eyes'), geometries, materials, textures: [] };
}
