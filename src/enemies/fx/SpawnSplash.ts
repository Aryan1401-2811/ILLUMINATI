import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { toonMaterial, addOutline } from '@/render/toon';

/**
 * Ink-splash spawn-in effect: enemies never just pop in. A splash of ink
 * expands on the ground, the enemy rises from it, and the splash fades.
 *
 *   const splash = scene.add(new SpawnSplash(position, onComplete));
 */
export class SpawnSplash extends Entity {
  private age = 0;
  private readonly dur = 0.6;
  private inkMat: THREE.MeshBasicMaterial;
  private inkMesh: THREE.Mesh;
  private droplets: THREE.Mesh[] = [];
  private dropletMats: THREE.MeshBasicMaterial[] = [];
  private onComplete?: () => void;
  private completed = false;

  constructor(at: THREE.Vector3, onComplete?: () => void) {
    super();
    this.onComplete = onComplete;

    // ── Main ink splash circle on the ground ─────────────────────────────
    this.inkMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#1a0e33').multiplyScalar(2),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.inkMesh = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), this.inkMat);
    this.inkMesh.rotation.x = -Math.PI / 2;
    this.inkMesh.position.y = 0.03;
    this.object.add(this.inkMesh);

    // ── Ink droplet splashes ─────────────────────────────────────────────
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 0.6 + Math.random() * 0.8;
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#2a1555').multiplyScalar(2),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const droplet = new THREE.Mesh(
        new THREE.CircleGeometry(0.15 + Math.random() * 0.2, 8),
        mat,
      );
      droplet.rotation.x = -Math.PI / 2;
      droplet.position.set(
        Math.cos(angle) * dist,
        0.03,
        Math.sin(angle) * dist,
      );
      this.dropletMats.push(mat);
      this.droplets.push(droplet);
      this.object.add(droplet);
    }

    // ── Rising column (visible through the enemy rising up) ──────────────
    const colMat = toonMaterial({
      color: '#3a1e77',
      emissive: '#6b3fff',
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.5,
    });
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.6, 2.0, 12, 1, true),
      colMat,
    );
    col.position.y = 1.0;
    addOutline(col, 2, '#1a0e33');
    this.object.add(col);

    this.object.position.copy(at);
    this.object.position.y = 0;
  }

  update(dt: number): void {
    this.age += dt > 0 ? dt : 1 / 60;
    const k = Math.min(1, this.age / this.dur);

    // ── Splash expands quickly ───────────────────────────────────────────
    const expandK = Math.min(1, k * 3); // quick expand in first third
    const ease = 1 - (1 - expandK) * (1 - expandK);
    this.inkMesh.scale.setScalar(0.1 + ease * 1.0);
    this.inkMat.opacity = k < 0.5 ? ease * 0.8 : 0.8 * (1 - (k - 0.5) * 2);

    // ── Droplets splatter outward ────────────────────────────────────────
    for (let i = 0; i < this.droplets.length; i++) {
      const d = this.droplets[i];
      const delay = i * 0.03;
      const dk = Math.max(0, Math.min(1, (this.age - delay) / (this.dur * 0.5)));
      this.dropletMats[i].opacity = dk < 0.7 ? dk : Math.max(0, 1 - (dk - 0.7) / 0.3) * 0.7;
      const splash = 1 - (1 - dk) ** 2;
      d.scale.setScalar(0.5 + splash * 0.8);
    }

    // ── Trigger the spawn callback at the halfway point ──────────────────
    if (!this.completed && k >= 0.3) {
      this.completed = true;
      this.onComplete?.();
    }

    // ── Column fades out ─────────────────────────────────────────────────
    const col = this.object.children[this.object.children.length - 1];
    if (col) {
      const colK = Math.max(0, (k - 0.2) / 0.8);
      col.scale.setScalar(1 - colK * 0.5);
      col.position.y = 1.0 - colK * 0.5;
      const mat = (col as THREE.Mesh).material;
      if (mat && 'opacity' in mat) {
        (mat as THREE.MeshToonMaterial).opacity = Math.max(0, 0.5 * (1 - colK));
      }
    }

    if (k >= 1) this.destroy();
  }

  onRemoved(): void {
    this.inkMat.dispose();
    this.inkMesh.geometry.dispose();
    for (const m of this.dropletMats) m.dispose();
    for (const d of this.droplets) d.geometry.dispose();
    this.object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry && mesh !== this.inkMesh && !this.droplets.includes(mesh)) {
        mesh.geometry.dispose();
      }
      if (mesh.material && mesh !== this.inkMesh) {
        (mesh.material as THREE.Material).dispose?.();
      }
    });
  }
}
