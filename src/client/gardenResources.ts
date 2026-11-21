import * as THREE from 'three';
import type { Theme } from '../shared/types.ts';
import type { GardenImages } from './gardenAssets.ts';
import { GARDEN_TREE_CELL } from './gardenAssets.ts';
import type { MiniatureSurface } from './miniatureArt.ts';

export class GardenResources {
  readonly textures: THREE.Texture[] = [];
  readonly materials: THREE.Material[] = [];
  readonly geometries: THREE.BufferGeometry[] = [];
  private readonly surfaces = new Map<string, THREE.Texture>();
  private readonly trees = new Map<Theme, THREE.BufferGeometry>();
  private readonly foliage: THREE.MeshStandardMaterial;
  private readonly images: GardenImages;

  constructor(images: GardenImages) {
    this.images = images;
    const atlas = this.texture(images.flora);
    this.foliage = new THREE.MeshStandardMaterial({
      map: atlas, roughness: 1, alphaTest: .18, side: THREE.DoubleSide,
    });
    this.materials.push(this.foliage);
  }

  private texture(image: HTMLImageElement): THREE.Texture {
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this.textures.push(texture);
    return texture;
  }

  surface(surface: MiniatureSurface | 'granite'): THREE.Texture | null {
    const name = surface === 'timber' ? null : surface === 'earth' ? 'earth' : surface;
    if (!name) return null;
    let texture = this.surfaces.get(name);
    if (!texture) {
      texture = this.texture(this.images[name]);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.setScalar(name === 'roof' ? 1 : 2);
      this.surfaces.set(name, texture);
    }
    return texture;
  }

  tree(theme: Theme): THREE.Mesh {
    let geometry = this.trees.get(theme);
    if (!geometry) {
      const cell = GARDEN_TREE_CELL[theme], col = cell % 4, row = Math.floor(cell / 4);
      geometry = new THREE.PlaneGeometry(.66, .72);
      geometry.translate(0, .36, 0);
      const uv = geometry.getAttribute('uv');
      for (let index = 0; index < uv.count; index++) uv.setXY(index, (col + uv.getX(index)) / 4, (2 - row + uv.getY(index)) / 3);
      this.geometries.push(geometry);this.trees.set(theme, geometry);
    }
    const mesh = new THREE.Mesh(geometry, this.foliage);
    mesh.userData['gardenScenery'] = true;
    mesh.rotation.x = -.3;
    mesh.position.y = .255;
    mesh.castShadow = false;mesh.receiveShadow = true;
    return mesh;
  }

  dispose(): void {
    this.textures.forEach(texture => texture.dispose());
    this.materials.forEach(material => material.dispose());
    this.geometries.forEach(geometry => geometry.dispose());
  }
}
