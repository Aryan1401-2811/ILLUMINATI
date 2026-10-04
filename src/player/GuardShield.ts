import * as THREE from 'three';
import { addOutline } from '@/render/toon';

const COLORS = { gold: '#ffd23a', violet: '#b48cff' } as const;

/**
 * The guard: a curved shield of Light held in front of the hero. Lives on the player object,
 * fades in/out with the guard, flares on a block and dims as stability wears down.
 */
export class GuardShield {
  readonly object = new THREE.Group();
  private mat: THREE.MeshBasicMaterial;
  private shield: THREE.Mesh;
  private shown = 0;
  private target = 0;
  private flare = 0;
  private stability = 1;

  constructor() {
    // A slice of a cylinder: a curved pane in front of the hero
    const geo = new THREE.CylinderGeometry(1.05, 1.05, 1.5, 28, 1, true, -Math.PI * 0.42, Math.PI * 0.84);
    this.mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(COLORS.gold).multiplyScalar(2),
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.shield = new THREE.Mesh(geo, this.mat);
    this.shield.position.y = 0.95;
    addOutline(this.shield, 2);

    this.object.add(this.shield);
    this.object.visible = false;
  }

  setElement(element: string) {
    const c = new THREE.Color(element === 'violet' ? COLORS.violet : COLORS.gold);
    this.mat.color.copy(c).multiplyScalar(2);
  }

  set(active: boolean, stability: number) {
    this.target = active ? 1 : 0;
    this.stability = stability;
  }

  /** A hit landed on the shield. */
  hit(strength = 1) {
    this.flare = Math.max(this.flare, strength);
  }

  update(dt: number) {
    const step = dt > 0 ? dt : 1 / 60; // keeps animating through hit-stop
    this.shown += (this.target - this.shown) * (1 - Math.exp(-18 * step));
    this.flare = Math.max(0, this.flare - step * 4);
    this.object.visible = this.shown > 0.02;
    const wobble = this.stability < 0.35 ? Math.sin(performance.now() * 0.05) * 0.08 : 0;
    this.mat.opacity = this.shown * (0.16 + 0.22 * this.stability + this.flare * 0.5 + wobble);
    this.shield.scale.setScalar(0.9 + this.shown * 0.1 + this.flare * 0.08);
  }

  dispose() {
    this.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (o.userData.isOutline) return; // outline material is shared
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    });
  }
}
