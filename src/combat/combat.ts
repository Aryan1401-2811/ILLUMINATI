import * as THREE from 'three';
import { events } from '@/core/events';
import { FEEL } from '@/core/config';
import { type Hit, type HitResult, type Hurtbox, type Team, isPositiveResult } from './types';

const _v = new THREE.Vector3();

/**
 * Registry of everything hittable in the current scene, plus helpers to find
 * and hit targets. One instance per GameScene (scene.combat).
 */
export class CombatWorld {
  private hurtboxes = new Set<Hurtbox>();

  /** Register a hurtbox. Returns an unregister function — call it when the thing is removed. */
  register(h: Hurtbox): () => void {
    this.hurtboxes.add(h);
    return () => this.hurtboxes.delete(h);
  }

  all(): Iterable<Hurtbox> {
    return this.hurtboxes;
  }

  /** Living hurtboxes not on `excludeTeam`. */
  *targets(excludeTeam: Team): Iterable<Hurtbox> {
    for (const h of this.hurtboxes) if (h.alive && h.team !== excludeTeam && h.team !== 'neutral') yield h;
  }

  /** Targets within a cone in front of `origin` (flat, XZ plane). Used for melee swings. */
  queryArc(origin: THREE.Vector3, forward: THREE.Vector3, range: number, arcDeg: number, excludeTeam: Team): Hurtbox[] {
    const out: Hurtbox[] = [];
    const halfCos = Math.cos(THREE.MathUtils.degToRad(arcDeg / 2));
    for (const h of this.targets(excludeTeam)) {
      _v.subVectors(h.position, origin).setY(0);
      const dist = _v.length() - h.radius;
      if (dist > range) continue;
      if (dist < 0.3) {
        out.push(h); // overlapping: always hit
        continue;
      }
      _v.normalize();
      if (_v.dot(forward) >= halfCos) out.push(h);
    }
    return out;
  }

  /** Targets whose body overlaps a sphere. Used for bursts and projectiles. */
  querySphere(center: THREE.Vector3, radius: number, excludeTeam: Team): Hurtbox[] {
    const out: Hurtbox[] = [];
    for (const h of this.targets(excludeTeam)) {
      // treat body as a vertical capsule
      const y = THREE.MathUtils.clamp(center.y, h.position.y, h.position.y + h.height);
      _v.set(h.position.x, y, h.position.z);
      if (_v.distanceTo(center) <= radius + h.radius) out.push(h);
    }
    return out;
  }

  /**
   * Deliver a hit. Always use this (not target.receiveHit directly) so feedback
   * events fire consistently: combat:hit, hit-stop, shake.
   */
  applyHit(target: Hurtbox, hit: Hit): HitResult {
    const result = target.receiveHit(hit);
    if (result === 'immune') return result;
    const position = target.position.clone().setY(target.position.y + target.height * 0.6);
    events.emit('combat:hit', { hit, result, position, targetTeam: target.team });
    if (isPositiveResult(result)) {
      const big = hit.heavy || result === 'shellBroken' || result === 'killed';
      events.emit('fx:hitstop', { durationSec: big ? FEEL.hitstopHeavy : FEEL.hitstopLight });
      events.emit('fx:shake', { strength: big ? FEEL.shakeHeavy : FEEL.shakeLight });
    }
    return result;
  }
}
