import * as THREE from 'three';
import { Entity } from '@/core/Entity';

interface Drifter {
  object: THREE.Object3D;
  baseY: number;
  amp: number;
  speed: number;
  phase: number;
  spin: number;
  tilt: number;
}

/**
 * Makes set-dressing float: each registered object bobs slowly and turns, weightless.
 * Used for the scraps of page hanging in the void around the final arena.
 */
export class VoidDrift extends Entity {
  private items: Drifter[] = [];
  private t = 0;

  /** Register an object (it stays wherever it is parented). */
  float(object: THREE.Object3D, amp = 0.5, speed = 0.4, spin = 0.05): void {
    const n = this.items.length;
    this.items.push({ object, baseY: object.position.y, amp, speed, phase: n * 1.7, spin: spin * (n % 2 ? 1 : -1), tilt: object.rotation.x });
  }

  update(dt: number) {
    if (dt <= 0) return;
    this.t += dt;
    for (const d of this.items) {
      d.object.position.y = d.baseY + Math.sin(this.t * d.speed + d.phase) * d.amp;
      d.object.rotation.z += d.spin * dt;
      d.object.rotation.x = d.tilt + Math.sin(this.t * d.speed * 0.7 + d.phase) * 0.06;
    }
  }
}
