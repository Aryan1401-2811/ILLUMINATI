import * as THREE from 'three';
import { Entity } from '@/core/Entity';

/** Crescent swipe trail for melee swings. Fire-and-forget. */
export class SlashArc extends Entity {
  private age = 0;
  private mat: THREE.MeshBasicMaterial;
  private mesh: THREE.Mesh;

  constructor(
    at: THREE.Vector3,
    yaw: number,
    opts: { radius?: number; arcDeg?: number; color?: THREE.ColorRepresentation; heavy?: boolean; flip?: boolean } = {},
    private duration = 0.16,
  ) {
    super();
    const radius = opts.radius ?? 1.8;
    const arc = THREE.MathUtils.degToRad(opts.arcDeg ?? 140);
    const width = opts.heavy ? 0.55 : 0.32;
    this.mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(opts.color ?? '#fff3c4').multiplyScalar(opts.heavy ? 5 : 3),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // RingGeometry arc: thetaStart measured from +X, counter-clockwise (seen from +Y after rotation)
    const geo = new THREE.RingGeometry(radius - width, radius, 32, 1, -arc / 2, arc);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    const pivot = new THREE.Group();
    pivot.add(this.mesh);
    // ring centre direction is +X; rotate so it points along yaw (forward = +Z at yaw 0)
    pivot.rotation.y = yaw - Math.PI / 2;
    if (opts.flip) pivot.rotation.z = Math.PI;
    this.object.add(pivot);
    this.object.position.copy(at).setY(opts.heavy ? 0.9 : 1.05);
    this.object.rotation.z = (opts.flip ? -1 : 1) * 0.15;
  }

  update(dt: number) {
    this.age += dt > 0 ? dt : 1 / 120;
    const k = Math.min(1, this.age / this.duration);
    this.mat.opacity = 1 - k * k;
    this.object.scale.setScalar(0.85 + 0.25 * k);
    if (k >= 1) this.destroy();
  }

  onRemoved() {
    this.mat.dispose();
    this.mesh.geometry.dispose();
  }
}
