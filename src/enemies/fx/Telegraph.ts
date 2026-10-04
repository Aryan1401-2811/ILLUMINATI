import * as THREE from 'three';
import { Entity } from '@/core/Entity';

/**
 * A ground decal that fills up over `durationSec`, then flashes at the moment of impact.
 * Usable by enemies AND bosses. Fire-and-forget:
 *
 *   scene.add(new Telegraph({ shape: 'circle', at: pos, radius: 3, durationSec: 0.6, color: '#ff4444' }))
 */

export interface TelegraphConfig {
  shape: 'circle' | 'cone' | 'line';
  at: THREE.Vector3;
  radius?: number;
  yaw?: number;       // radians, direction for cone/line
  arcDeg?: number;     // cone arc in degrees
  length?: number;     // line length
  width?: number;      // line width
  durationSec: number;
  color?: THREE.ColorRepresentation;
}

export class Telegraph extends Entity {
  private age = 0;
  private readonly dur: number;
  private fillMat: THREE.MeshBasicMaterial;
  private flashMat: THREE.MeshBasicMaterial;
  private fillMesh: THREE.Mesh;
  private flashMesh: THREE.Mesh;
  private borderMat: THREE.MeshBasicMaterial;
  private borderMesh: THREE.Mesh;
  private geometries: THREE.BufferGeometry[] = [];

  constructor(cfg: TelegraphConfig) {
    super();
    this.dur = cfg.durationSec;
    const color = new THREE.Color(cfg.color ?? '#ff4444');
    const yaw = cfg.yaw ?? 0;

    // ── Fill material (slowly fills up) ──────────────────────────────────
    this.fillMat = new THREE.MeshBasicMaterial({
      color: color.clone().multiplyScalar(1.5),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // ── Flash material (bright burst at the end) ─────────────────────────
    this.flashMat = new THREE.MeshBasicMaterial({
      color: color.clone().multiplyScalar(6),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // ── Border material ──────────────────────────────────────────────────
    this.borderMat = new THREE.MeshBasicMaterial({
      color: color.clone().multiplyScalar(3),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    let fillGeo: THREE.BufferGeometry;
    let flashGeo: THREE.BufferGeometry;
    let borderGeo: THREE.BufferGeometry;

    if (cfg.shape === 'circle') {
      const r = cfg.radius ?? 2;
      fillGeo = new THREE.CircleGeometry(r, 32);
      flashGeo = new THREE.CircleGeometry(r, 32);
      borderGeo = new THREE.RingGeometry(r - 0.08, r, 32);
    } else if (cfg.shape === 'cone') {
      const r = cfg.radius ?? 3;
      const arc = THREE.MathUtils.degToRad(cfg.arcDeg ?? 60);
      fillGeo = new THREE.CircleGeometry(r, 24, -arc / 2, arc);
      flashGeo = new THREE.CircleGeometry(r, 24, -arc / 2, arc);
      borderGeo = new THREE.RingGeometry(r - 0.08, r, 24, 1, -arc / 2, arc);
    } else {
      // Line shape: a rectangle
      const len = cfg.length ?? 6;
      const w = cfg.width ?? 1;
      fillGeo = new THREE.PlaneGeometry(w, len);
      flashGeo = new THREE.PlaneGeometry(w, len);
      borderGeo = new THREE.PlaneGeometry(w + 0.1, len + 0.1);
      // Shift so it extends forward from the origin
      fillGeo.translate(0, len / 2, 0);
      flashGeo.translate(0, len / 2, 0);
      borderGeo.translate(0, len / 2, 0);
    }

    this.geometries.push(fillGeo, flashGeo, borderGeo);

    // ── Assemble ─────────────────────────────────────────────────────────
    this.fillMesh = new THREE.Mesh(fillGeo, this.fillMat);
    this.flashMesh = new THREE.Mesh(flashGeo, this.flashMat);
    this.borderMesh = new THREE.Mesh(borderGeo, this.borderMat);

    const pivot = new THREE.Group();
    pivot.rotation.x = -Math.PI / 2; // lay flat on XZ
    pivot.add(this.borderMesh, this.fillMesh, this.flashMesh);

    // Rotate the pivot around Y to aim the shape
    const root = new THREE.Group();
    root.rotation.y = yaw;
    root.add(pivot);

    this.object.add(root);
    this.object.position.copy(cfg.at);
    this.object.position.y = 0.04; // just above the floor
  }

  update(dt: number): void {
    // Game time only: during hit-stop the enemy's wind-up is frozen, so the decal must be too,
    // or it flashes "impact" before the attack actually lands.
    if (dt <= 0) return;
    this.age += dt;
    const k = Math.min(1, this.age / this.dur);

    if (k < 1) {
      // ── Fill phase: opacity builds smoothly ────────────────────────────
      const fillK = k * k; // ease in
      this.fillMat.opacity = fillK * 0.45;
      this.fillMesh.scale.setScalar(0.2 + fillK * 0.8);
      this.borderMat.opacity = 0.3 + k * 0.5;

      // Pulsing border at the end
      if (k > 0.7) {
        const pulse = Math.sin(this.age * 20) * 0.3;
        this.borderMat.opacity = 0.6 + pulse;
      }
    } else {
      // ── Flash phase: bright burst then fade ────────────────────────────
      const flashAge = this.age - this.dur;
      const flashDur = 0.15;
      const fk = Math.min(1, flashAge / flashDur);

      this.flashMat.opacity = Math.max(0, 1 - fk * fk);
      this.fillMat.opacity = Math.max(0, 0.45 * (1 - fk));
      this.borderMat.opacity = Math.max(0, 0.8 * (1 - fk));

      if (fk >= 1) this.destroy();
    }
  }

  onRemoved(): void {
    this.fillMat.dispose();
    this.flashMat.dispose();
    this.borderMat.dispose();
    for (const geo of this.geometries) geo.dispose();
  }
}
