import * as THREE from 'three';
import { events } from '@/core/events';
import { CharacterModel } from '@/render/CharacterModel';
import { toonMaterial, addOutline } from '@/render/toon';
import { Enemy } from './Enemy';
import { Telegraph } from './fx/Telegraph';
import {
  ENEMY_MODELS, ENEMY_ANIMS,
  GRUNT_BASE, GRUNT_ZONES, ZONE_TINTS,
  type GruntStats,
} from './config';

let gruntCount = 0;

/**
 * Light, fast enemy that comes in groups. A short telegraphed swipe.
 * Subtle Shade clues: hesitates, circles, sometimes backs away.
 * Soft calm violet glow — they're not evil, they're victims.
 */
export class Grunt extends Enemy {
  private stats: GruntStats;
  private zone: 1 | 2 | 3;
  private variant: 'normal' | 'gold';
  private attackHitDone = false;

  constructor(zone: 1 | 2 | 3 = 1, variant: 'normal' | 'gold' = 'normal') {
    const stats = { ...GRUNT_BASE, ...GRUNT_ZONES[zone] };
    const id = `grunt${gruntCount++}`;
    super({
      id,
      type: 'grunt',
      hp: stats.hp,
      damage: stats.damage,
      knockback: stats.knockback,
      moveSpeed: stats.moveSpeed,
      chaseRange: stats.chaseRange,
      attackRange: stats.attackRange,
      windupSec: stats.windupSec,
      activeSec: stats.activeSec,
      recoverySec: stats.recoverySec,
      arcDeg: stats.arcDeg,
      radius: stats.radius,
      height: stats.height,
      mass: stats.mass,
      hesitateProbability: stats.hesitateProbability,
      flinchProbability: stats.flinchProbability,
      variant,
    });
    this.stats = stats;
    this.zone = zone;
    this.variant = variant;
  }

  override onAdded(): void {
    super.onAdded();
    this.loadModel();
  }

  private async loadModel(): Promise<void> {
    const tint = this.variant === 'gold' ? '#ffd27a' : undefined;
    
    this.model = await CharacterModel.load(ENEMY_MODELS.grunt.path, {
      height: this.stats.height * this.stats.scaleMul,
      tint,
    });
    
    // In case the entity was destroyed before the model loaded
    if (this.destroyed) return;

    this.object.add(this.model.root);
    
    // Add corrupted buzzing for gold variant
    if (this.variant === 'gold') {
       // A harsh golden buzz sound could be added here, or particles
    }
  }

  // ── AI overrides ───────────────────────────────────────────────────────

  protected override onStateWindup(dt: number): void {
    this.velocity.multiplyScalar(0.8);
    this.facePlayer();

    // Play windup anim
    if (this.stateTime < 0.05) {
      this.attackHitDone = false;
      // Show telegraph: cone in front
      this.scene.add(new Telegraph({
        shape: 'cone',
        at: this.position.clone(),
        radius: this.cfg.attackRange,
        yaw: this.yaw,
        arcDeg: this.cfg.arcDeg,
        durationSec: this.cfg.windupSec,
        color: '#bb77ff',
      }));
      if (this.model?.has(ENEMY_ANIMS.windup)) {
        this.model.play(ENEMY_ANIMS.windup, { loop: false, fade: 0.08 });
      }
    }

    if (this.stateTime >= this.cfg.windupSec) {
      this.setAIState('attack');
    }
  }

  protected override onStateAttack(dt: number): void {
    // Lunge forward slightly
    this.velocity.copy(this.forward).multiplyScalar(this.cfg.moveSpeed * 0.8);

    if (!this.attackHitDone && this.stateTime >= this.cfg.activeSec * 0.5) {
      this.attackHitDone = true;
      this.doSwipe();
    }

    if (this.model?.has(ENEMY_ANIMS.attack)) {
      this.model.play(ENEMY_ANIMS.attack, { loop: false, restart: true, fade: 0.05 });
    }

    if (this.stateTime >= this.cfg.activeSec) {
      this.setAIState('recover');
    }
  }

  private doSwipe(): void {
    // Only hit if not off-screen
    if (!this.isOnScreen()) return;

    const targets = this.scene.combat.queryArc(
      this.position, this.forward, this.cfg.attackRange, this.cfg.arcDeg, 'enemy',
    );
    for (const target of targets) {
      this.scene.combat.applyHit(target, {
        amount: this.cfg.damage,
        kind: 'melee',
        element: 'none',
        heavy: false,
        team: 'enemy',
        from: this.position.clone(),
        knockback: this.cfg.knockback,
        sourceId: 'gruntSwipe',
      });
    }
    events.emit('fx:onomatopoeia', {
      text: 'SWISH!',
      position: this.position.clone().setY(1.2),
      color: '#bb77ff',
      scale: 0.7,
    });
  }
}
