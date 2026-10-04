import * as THREE from 'three';
import { Entity } from '@/core/Entity';

/** Expanding glowing ring on the ground. Fire-and-forget: scene.add(new Shockwave(pos, 4, '#ffc21a')). */
export class Shockwave extends Entity {
  private age = 0;
  private mat: THREE.MeshBasicMaterial;

  constructor(
    at: THREE.Vector3,
    private maxRadius = 4,
    color: THREE.ColorRepresentation = '#ffc21a',
    private duration = 0.35,
  ) {
    super();
    this.mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(4),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), this.mat);
    ring.rotation.x = -Math.PI / 2;
    this.object.add(ring);
    this.object.position.copy(at).setY(0.08);
  }

  update(dt: number) {
    this.age += dt;
    const k = Math.min(1, this.age / this.duration);
    const e = 1 - (1 - k) ** 3;
    this.object.scale.setScalar(0.3 + e * this.maxRadius);
    this.mat.opacity = 1 - k;
    if (k >= 1) this.destroy();
  }

  onRemoved() {
    this.mat.dispose();
    (this.object.children[0] as THREE.Mesh).geometry.dispose();
  }
}
