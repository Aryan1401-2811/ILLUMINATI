import * as THREE from 'three';
import { CAMERA } from '@/core/config';
import { settings } from '@/core/settings';

const _ahead = new THREE.Vector3();

/**
 * Fixed-angle follow camera framed like a comic panel, with trauma-based shake.
 *
 *   rig.follow(player.object)          // track something
 *   rig.lookAheadTarget = aimPoint     // lean toward where the player aims
 *   rig.setOffset(x, y, z, 1.0)        // cinematic re-frame over 1s (boss intros, twist)
 *   rig.addShake(0.3)
 */
export class CameraRig {
  /** Current focus point on the ground. */
  readonly focus = new THREE.Vector3();
  readonly offset = new THREE.Vector3(CAMERA.offset.x, CAMERA.offset.y, CAMERA.offset.z);
  lookAheadTarget: THREE.Vector3 | null = null;
  lookAhead = CAMERA.lookAhead;
  sharpness = CAMERA.followSharpness;

  private target: THREE.Object3D | null = null;
  private trauma = 0;
  private offsetFrom = new THREE.Vector3();
  private offsetTo = new THREE.Vector3();
  private offsetT = 1;
  private offsetDur = 0;
  private t = 0;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  follow(obj: THREE.Object3D | null, snap = true) {
    this.target = obj;
    if (obj && snap) {
      this.focus.copy(obj.position);
      this.apply(0);
    }
  }

  /** Smoothly move to a new camera offset. */
  setOffset(x: number, y: number, z: number, durationSec = 0.8) {
    this.offsetFrom.copy(this.offset);
    this.offsetTo.set(x, y, z);
    this.offsetDur = durationSec;
    this.offsetT = durationSec <= 0 ? 1 : 0;
    if (this.offsetT >= 1) this.offset.copy(this.offsetTo);
  }

  resetOffset(durationSec = 0.8) {
    this.setOffset(CAMERA.offset.x, CAMERA.offset.y, CAMERA.offset.z, durationSec);
  }

  /** 0..1, stacks and decays. */
  addShake(amount: number) {
    if (!settings.screenShake) return; // accessibility setting
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(realDt: number) {
    this.t += realDt;
    if (this.offsetT < 1) {
      this.offsetT = Math.min(1, this.offsetT + realDt / this.offsetDur);
      const k = this.offsetT * this.offsetT * (3 - 2 * this.offsetT);
      this.offset.lerpVectors(this.offsetFrom, this.offsetTo, k);
    }
    if (this.target) {
      _ahead.copy(this.target.position);
      if (this.lookAheadTarget) {
        const dir = this.lookAheadTarget.clone().sub(this.target.position).setY(0);
        const len = dir.length();
        if (len > 0.01) _ahead.addScaledVector(dir, Math.min(len, this.lookAhead * 3) / (len * 3) * this.lookAhead);
      }
      const k = 1 - Math.exp(-this.sharpness * realDt);
      this.focus.lerp(_ahead, k);
    }
    this.apply(realDt);
  }

  private apply(realDt: number) {
    this.camera.position.copy(this.focus).add(this.offset);
    this.camera.lookAt(this.focus.x, this.focus.y + 0.8, this.focus.z);
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma;
      const n = (seed: number) => Math.sin(this.t * 47 + seed) * Math.sin(this.t * 31 + seed * 2.3);
      this.camera.position.x += n(1) * 0.6 * s;
      this.camera.position.y += n(2) * 0.4 * s;
      this.camera.rotateZ(n(3) * 0.03 * s);
      this.trauma = Math.max(0, this.trauma - realDt * 1.6);
    }
  }
}
