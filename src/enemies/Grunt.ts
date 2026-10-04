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
  private attackHitDone = false;

  constructor(zone: 1 | 2 | 3 = 1) {
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
    });
    this.stats = stats;
    this.zone = zone;

    // Build placeholder model: robot tinted violet
    this.buildPlaceholderModel();
  }

  private buildPlaceholderModel(): void {
    const tint = ZONE_TINTS[this.zone];
    const body = new THREE.Group();

    // Simple humanoid shape with toon materials
    const bodyMat = toonMaterial({ color: tint, emissive: tint, emissiveIntensity: 0.1 });
    const darkMat = toonMaterial({ color: '#2a1555' });

    // Torso
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28 * this.stats.scaleMul, 0.4 * this.stats.scaleMul, 4, 8),
      bodyMat,
    );
    torso.position.y = 0.9;
    torso.castShadow = true;
    addOutline(torso, 2);
    body.add(torso);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2 * this.stats.scaleMul, 12, 8),
      bodyMat,
    );
    head.position.y = 1.35;
    head.castShadow = true;
    addOutline(head, 2);
    body.add(head);

    // Eyes (slightly unsettling — they look sad, not angry)
    const eyeMat = toonMaterial({ color: '#ffffff' });
    const pupilMat = toonMaterial({ color: '#3a1e77' });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eyeMat);
      eye.position.set(side * 0.08, 1.38, 0.16);
      body.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), pupilMat);
      pupil.position.set(side * 0.08, 1.38, 0.19);
      body.add(pupil);
    }

    // Arms (thin, slightly drooped — non-threatening)
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.06 * this.stats.scaleMul, 0.5 * this.stats.scaleMul, 3, 6),
        bodyMat,
      );
      arm.position.set(side * 0.38, 0.85, 0);
      arm.rotation.z = side * 0.3; // slightly drooped
      arm.castShadow = true;
      addOutline(arm, 2);
      body.add(arm);
    }

    // Legs
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.08 * this.stats.scaleMul, 0.4 * this.stats.scaleMul, 3, 6),
        darkMat,
      );
      leg.position.set(side * 0.12, 0.3, 0);
      leg.castShadow = true;
      addOutline(leg, 2);
      body.add(leg);
    }

    // Feet
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.06, 0.18),
        darkMat,
      );
      foot.position.set(side * 0.12, 0.03, 0.04);
      body.add(foot);
    }

    this.model = CharacterModel.fromObject(body);
    this.object.add(this.model.root);
    this.object.scale.setScalar(this.stats.scaleMul);
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
