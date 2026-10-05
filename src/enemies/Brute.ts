import * as THREE from 'three';
import { events } from '@/core/events';
import { Shockwave } from '@/vfx/Shockwave';
import { Enemy, type EnemyAIState } from './Enemy';
import { Armour, type ArmourConfig } from './armour/Armour';
import { Telegraph } from './fx/Telegraph';
import type { Hit, HitResult } from '@/combat/types';
import {
  ENEMY_ANIMS, ENEMY_MODELS,
  BRUTE_BASE, BRUTE_ZONES,
  type BruteStats,
} from './config';

let bruteCount = 0;

/**
 * Big, slow, armoured enemy. Has two attacks:
 *   1. Ground slam (circle telegraph) — heavy, AoE
 *   2. Short charge (line telegraph) — charges in a line
 *
 * Armoured: only heavy melee cracks the shell, then energy kills the core.
 * Ignores light-hit stagger; only heavy hits or a broken shell stagger it.
 */
export class Brute extends Enemy {
  private stats: BruteStats;
  private zone: 1 | 2 | 3;
  private variant: 'normal' | 'gold';
  private armour: Armour;
  private attackType: 'slam' | 'charge' = 'slam';
  private attackHitDone = false;
  private chargeDir = new THREE.Vector3();

  constructor(zone: 1 | 2 | 3 = 2, variant: 'normal' | 'gold' = 'normal') {
    const stats = { ...BRUTE_BASE, ...BRUTE_ZONES[zone] };
    const id = `brute${bruteCount++}`;
    super({
      id,
      type: 'brute',
      hp: stats.hp,
      damage: stats.damage,
      knockback: stats.knockback,
      moveSpeed: stats.moveSpeed,
      chaseRange: stats.chaseRange,
      attackRange: stats.attackRange,
      windupSec: stats.windupSec,
      activeSec: stats.activeSec,
      recoverySec: stats.recoverySec,
      arcDeg: 360,   // slam hits all around
      radius: stats.radius,
      height: stats.height,
      mass: stats.mass,
      heavyStaggerOnly: true,
      hesitateProbability: 0.005,
      flinchProbability: 0.2,
      variant,
    });
    this.stats = stats;
    this.zone = zone;
    this.variant = variant;

    // Set up armour
    const armourCfg: ArmourConfig = {
      shellHp: stats.shellHp,
      coreHp: stats.coreHp,
      coreWindowSec: stats.coreWindowSec,
      element: variant === 'gold' ? 'gold' : 'violet',
      size: stats.radius * 1.6,
    };
    this.armour = new Armour(id, armourCfg);
    this.object.add(this.armour.visual);
  }

  override onAdded(): void {
    super.onAdded();
    this.loadModel();
  }

  private async loadModel(): Promise<void> {
    const tint = this.variant === 'gold' ? '#ffd27a' : undefined;
    const model = await this.attachModel(ENEMY_MODELS.brute.path, {
      height: this.stats.height * this.stats.scaleMul,
      tint,
    });
    // Rise out of the ink
    model?.play(ENEMY_ANIMS.spawn, { loop: false });
  }

  // ── Armour intercept ───────────────────────────────────────────────────

  protected override onHitIntercept(hit: Hit): HitResult | null {
    const at = this.position.clone().setY(this.position.y + this.height * 0.6);
    const result = this.armour.handleHit(hit, at);
    // Brief: the Brute ignores light hits, but a heavy hit or a broken shell staggers it.
    if (result === 'shellBroken' || (result === 'shellHit' && hit.heavy)) {
      this.model?.flash('#ffffff', 0.12);
      this.stagger();
    }
    return result;
  }

  // ── Update with armour ─────────────────────────────────────────────────

  override update(dt: number): void {
    super.update(dt);
    if (dt > 0) this.armour.update(dt);
  }

  // ── AI overrides ───────────────────────────────────────────────────────

  protected override onStateChase(dt: number): void {
    if (!this.playerRef) { this.setAIState('idle'); return; }

    const dist = this.distToPlayer();
    this.facePlayer();
    this.model?.play(ENEMY_ANIMS.run, { timeScale: 0.7 });

    // Move toward player (slow and heavy)
    const dir = this.dirToPlayer();
    this.velocity.copy(dir).multiplyScalar(this.cfg.moveSpeed);

    // Decide which attack to use
    if (dist < this.cfg.attackRange * 1.2) {
      this.attackType = 'slam';
      this.setAIState('windup');
    } else if (dist < this.stats.chargeRange && dist > this.cfg.attackRange * 1.5 && this.chance(0.3, dt)) {
      this.attackType = 'charge';
      this.setAIState('windup');
    }

    if (dist > this.cfg.chaseRange * 1.2) {
      this.setAIState('idle');
    }
  }

  protected override onEnterState(state: EnemyAIState): void {
    if (state !== 'windup') return;
    this.attackHitDone = false;
    this.facePlayer();

    if (this.attackType === 'slam') {
      // Ground slam telegraph: circle
      this.scene.add(new Telegraph({
        shape: 'circle',
        at: this.position.clone(),
        radius: this.stats.slamRadius,
        durationSec: this.cfg.windupSec,
        color: '#aa55ff',
      }));
    } else {
      // Charge telegraph: line
      this.chargeDir.copy(this.dirToPlayer());
      this.scene.add(new Telegraph({
        shape: 'line',
        at: this.position.clone(),
        length: this.stats.chargeRange,
        width: this.stats.chargeWidth,
        yaw: Math.atan2(this.chargeDir.x, this.chargeDir.z),
        durationSec: this.stats.chargeWindupSec,
        color: '#8844ff',
      }));
    }

    // Show windup pose
    if (this.model?.has(ENEMY_ANIMS.windup)) {
      this.model.play(ENEMY_ANIMS.windup, { loop: false, fade: 0.1 });
    }
  }

  protected override onStateWindup(_dt: number): void {
    this.velocity.multiplyScalar(0.8);

    const windupDur = this.attackType === 'charge'
      ? this.stats.chargeWindupSec
      : this.cfg.windupSec;

    if (this.stateTime >= windupDur) {
      this.setAIState('attack');
    }
  }

  protected override onStateAttack(dt: number): void {
    if (this.attackType === 'slam') {
      this.doSlamAttack(dt);
    } else {
      this.doChargeAttack(dt);
    }
  }

  private doSlamAttack(dt: number): void {
    // Brief downward motion
    this.velocity.set(0, 0, 0);

    if (!this.attackHitDone && this.stateTime >= this.cfg.activeSec * 0.5) {
      this.attackHitDone = true;

      // AoE slam
      const targets = this.scene.combat.querySphere(
        this.position, this.stats.slamRadius, 'enemy',
      );
      for (const target of targets) {
        this.scene.combat.applyHit(target, {
          amount: this.stats.slamDamage,
          kind: 'melee',
          element: 'none',
          heavy: true,
          team: 'enemy',
          from: this.position.clone(),
          knockback: this.stats.slamKnockback,
          sourceId: 'bruteSlam',
        });
      }

      // Shockwave VFX
      this.scene.add(new Shockwave(this.position.clone(), this.stats.slamRadius, '#9b6bff', 0.4));
      events.emit('fx:shake', { strength: 0.3 });
      events.emit('fx:onomatopoeia', {
        text: 'KROOM!',
        position: this.position.clone().setY(0.5),
        color: '#aa55ff',
        scale: 1.3,
      });

      if (this.model?.has(ENEMY_ANIMS.slam)) {
        this.model.play(ENEMY_ANIMS.slam, { loop: false, restart: true, fade: 0.05 });
      }
    }

    if (this.stateTime >= this.cfg.activeSec) {
      this.setAIState('recover');
    }
  }

  private doChargeAttack(dt: number): void {
    // Charge forward
    this.velocity.copy(this.chargeDir).multiplyScalar(this.stats.chargeSpeed);

    // Check for hits during charge
    if (!this.attackHitDone) {
      const targets = this.scene.combat.querySphere(
        this.position, this.stats.chargeWidth * 0.6, 'enemy',
      );
      for (const target of targets) {
        this.attackHitDone = true; // only hit once per charge
        this.scene.combat.applyHit(target, {
          amount: this.stats.chargeDamage,
          kind: 'melee',
          element: 'none',
          heavy: true,
          team: 'enemy',
          from: this.position.clone(),
          knockback: this.stats.slamKnockback,
          sourceId: 'bruteCharge',
        });
        events.emit('fx:onomatopoeia', {
          text: 'WHAM!',
          position: target.position.clone().setY(1.2),
          color: '#aa55ff',
          scale: 1.1,
        });
      }
    }

    if (this.model?.has(ENEMY_ANIMS.run)) {
      this.model.play(ENEMY_ANIMS.run, { timeScale: 1.5 });
    }

    // Charge ends after a short duration
    if (this.stateTime >= 0.5) {
      this.velocity.set(0, 0, 0);
      this.setAIState('recover');
    }
  }

  protected override onStateRecover(dt: number): void {
    this.velocity.multiplyScalar(0.85);
    this.model?.play(ENEMY_ANIMS.idle);
    // Brute has a longer recovery
    if (this.stateTime >= this.cfg.recoverySec) {
      this.setAIState('chase');
    }
  }
}
