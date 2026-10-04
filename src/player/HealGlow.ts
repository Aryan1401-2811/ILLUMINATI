import * as THREE from 'three';
import { Entity } from '@/core/Entity';

const RINGS = 4;

/** Rings of Light rising around the hero while a heal mends them. Follows the hero. */
export class HealGlow extends Entity {
  private t = 0;
  private rings: THREE.Mesh[] = [];
  private mat: THREE.MeshBasicMaterial;
  private geo: THREE.TorusGeometry;

  constructor(private readonly follow: THREE.Object3D, color: string, private readonly life: number) {
    super();
    this.geo = new THREE.TorusGeometry(0.7, 0.045, 6, 36);
    this.mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(3.5),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < RINGS; i++) {
      const ring = new THREE.Mesh(this.geo, this.mat);
      ring.rotation.x = Math.PI / 2;
      this.rings.push(ring);
      this.object.add(ring);
    }
  }

  update(dt: number) {
    this.t += dt > 0 ? dt : 1 / 60;
    this.object.position.copy(this.follow.position);
    const k = this.t / this.life;
    this.mat.opacity = Math.min(1, this.t * 6) * Math.max(0, 1 - k) * 0.8;
    this.rings.forEach((ring, i) => {
      const phase = (this.t * 1.4 + i / RINGS) % 1;
      ring.position.y = phase * 2.2;
      ring.scale.setScalar(1.1 - phase * 0.5);
    });
    if (k >= 1) this.destroy();
  }

  onRemoved() {
    this.geo.dispose();
    this.mat.dispose();
  }
}
