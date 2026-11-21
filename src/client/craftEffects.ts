import * as THREE from 'three';
import type { Cell } from '../shared/types.ts';

export class CraftCelebration {
  readonly root = new THREE.Group();
  private readonly petals: THREE.InstancedMesh;
  private readonly rings: THREE.InstancedMesh;
  private readonly petalMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, side: THREE.DoubleSide });
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ color: '#e9c583', transparent: true, depthWrite: false, side: THREE.DoubleSide });
  private readonly pose = new THREE.Object3D();
  private readonly tint = new THREE.Color();
  private cells: readonly Cell[] = [];
  private center = 0;
  private complete = false;
  private reduced = false;
  private running = false;

  constructor() {
    this.petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(.055, .09), this.petalMaterial, 24);
    this.rings = new THREE.InstancedMesh(new THREE.RingGeometry(.30, .33, 24).rotateX(-Math.PI / 2), this.ringMaterial, 6);
    for (const mesh of [this.petals, this.rings]) {
      mesh.count = 0;mesh.visible = false;mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.root.add(mesh);
    }
  }

  get active(): boolean { return this.running; }

  show(cells: readonly Cell[], size: number, complete: boolean, reduced: boolean, colors: readonly string[]): void {
    if (!cells.length || cells.length > 6 || !colors.length) throw new Error('The miniature celebration needs one to six homes and a palette.');
    this.cells = cells;this.center = (size - 1) / 2;this.complete = complete;this.reduced = reduced;this.running = true;
    this.rings.count = cells.length;this.rings.visible = true;
    this.petals.count = reduced ? 0 : complete ? 24 : 6;this.petals.visible = !reduced;
    for (let index = 0; index < this.petals.count; index++) {
      const color = colors[index % colors.length];
      if (!color) throw new Error('The miniature celebration palette is incomplete.');
      this.petals.setColorAt(index, this.tint.set(color));
    }
    if (this.petals.instanceColor) this.petals.instanceColor.needsUpdate = true;
    this.update(0);
  }

  update(elapsedMs: number): boolean {
    if (!this.running) return false;
    const duration = this.reduced ? 650 : this.complete ? 1900 : 850;
    if (elapsedMs >= duration) { this.clear();return false; }
    const progress = elapsedMs / duration;
    this.ringMaterial.opacity = (1 - progress) * .60;
    this.petalMaterial.opacity = Math.min(1, (1 - progress) * 2);
    this.cells.forEach((cell, index) => {
      const delay = this.complete ? index * 75 : 0, local = Math.max(0, elapsedMs - delay) / duration;
      this.pose.position.set(cell.col - this.center, .383, cell.row - this.center);
      this.pose.rotation.set(0, 0, 0);this.pose.scale.setScalar(this.reduced ? 1 : .9 + local * .65);
      this.pose.updateMatrix();this.rings.setMatrixAt(index, this.pose.matrix);
    });
    for (let index = 0; index < this.petals.count; index++) {
      const cell = this.cells[index % this.cells.length];
      if (!cell) throw new Error('The miniature celebration is missing its home.');
      const angle = index * 2.39996, time = Math.max(0, elapsedMs - (this.complete ? index % this.cells.length * 75 : 0)) / 1000;
      this.pose.position.set(cell.col - this.center + Math.cos(angle) * time * .24,
        .58 + Math.sin(Math.min(1, time / 1.35) * Math.PI) * .44, cell.row - this.center + Math.sin(angle) * time * .20);
      this.pose.rotation.set(time * 1.4, angle + time, time * .6);this.pose.scale.setScalar(.85 + index % 3 * .12);
      this.pose.updateMatrix();this.petals.setMatrixAt(index, this.pose.matrix);
    }
    this.rings.instanceMatrix.needsUpdate = true;this.petals.instanceMatrix.needsUpdate = true;
    return true;
  }

  clear(): void {
    this.running = false;this.petals.count = this.rings.count = 0;
    this.petals.visible = this.rings.visible = false;this.cells = [];
  }

  dispose(): void {
    for (const mesh of [this.petals, this.rings]) { mesh.geometry.dispose();mesh.dispose(); }
    this.petalMaterial.dispose();this.ringMaterial.dispose();this.root.clear();
  }
}
