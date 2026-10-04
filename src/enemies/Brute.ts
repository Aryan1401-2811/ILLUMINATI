import * as THREE from 'three';
import { events } from '@/core/events';
import { CharacterModel } from '@/render/CharacterModel';
import { toonMaterial, addOutline } from '@/render/toon';
import { Shockwave } from '@/vfx/Shockwave';
import { Enemy } from './Enemy';
import { Armour, type ArmourConfig } from './armour/Armour';
import { Telegraph } from './fx/Telegraph';
import type { Hit, HitResult } from '@/combat/types';
import {
  ENEMY_ANIMS,
  BRUTE_BASE, BRUTE_ZONES, ZONE_TINTS,
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
  private armour: Armour;
  private attackType: 'slam' | 'charge' = 'slam';
  private attackHitDone = false;
  private chargeDir = new THREE.Vector3();

  constructor(zone: 1 | 2 | 3 = 2) {
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
    });
    this.stats = stats;
    this.zone = zone;

    // Set up armour
    const armourCfg: ArmourConfig = {
      shellHp: stats.shellHp,
      coreHp: stats.coreHp,
      coreWindowSec: stats.coreWindowSec,
      element: 'violet',
      size: stats.radius * 1.6,
    };
    this.armour = new Armour(id, armourCfg);

    this.buildPlaceholderModel();
    this.object.add(this.armour.visual);
  }

  private buildPlaceholderModel(): void {
    const tint = ZONE_TINTS[this.zone];
    const body = new THREE.Group();

    const bodyMat = toonMaterial({ color: tint, emissive: tint, emissiveIntensity: 0.08 });
    const darkMat = toonMaterial({ color: '#1a0e33' });
    const accentMat = toonMaterial({ color: '#6b3fff', emissive: '#6b3fff', emissiveIntensity: 0.15 });

    // Massive torso
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.5 * this.stats.scaleMul, 0.6 * this.stats.scaleMul, 6, 12),
      bodyMat,
    );
    torso.position.y = 1.2;
    torso.castShadow = true;
    addOutline(torso, 3);
    body.add(torso);

    // Broad shoulders
    const shoulders = new THREE.Mesh(
      new THREE.BoxGeometry(1.2 * this.stats.scaleMul, 0.25 * this.stats.scaleMul, 0.4 * this.stats.scaleMul),
      bodyMat,
    );
    shoulders.position.y = 1.6;
    shoulders.castShadow = true;
    addOutline(shoulders, 3);
    body.add(shoulders);

    // Head (smaller relative to body — looks imposing)
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22 * this.stats.scaleMul, 12, 8),
      darkMat,
    );
    head.position.y = 1.95;
    head.castShadow = true;
    addOutline(head, 2);
    body.add(head);

    // Glowing eyes
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 6, 4),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color('#9b6bff').multiplyScalar(4),
        }),
      );
      eye.position.set(side * 0.1, 1.98, 0.18);
      body.add(eye);
    }

    // Thick arms
    for (const side of [-1, 1]) {
      const upperArm = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.12 * this.stats.scaleMul, 0.5 * this.stats.scaleMul, 4, 8),
        bodyMat,
      );
      upperArm.position.set(side * 0.65, 1.3, 0);
      upperArm.rotation.z = side * 0.15;
      upperArm.castShadow = true;
      addOutline(upperArm, 3);
      body.add(upperArm);

      // Fists
      const fist = new THREE.Mesh(
        new THREE.SphereGeometry(0.14 * this.stats.scaleMul, 8, 6),
        accentMat,
      );
      fist.position.set(side * 0.7, 0.75, 0);
      fist.castShadow = true;
      addOutline(fist, 2);
      body.add(fist);
    }

    // Thick legs
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.13 * this.stats.scaleMul, 0.5 * this.stats.scaleMul, 4, 8),
        darkMat,
      );
      leg.position.set(side * 0.22, 0.35, 0);
      leg.castShadow = true;
      addOutline(leg, 3);
      body.add(leg);
    }

    // Big feet
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.1, 0.3),
        darkMat,
      );
      foot.position.set(side * 0.22, 0.05, 0.06);
      body.add(foot);
    }

    this.model = CharacterModel.fromObject(body);
    this.object.add(this.model.root);
    this.object.scale.setScalar(this.stats.scaleMul);
  }

  // ── Armour intercept ───────────────────────────────────────────────────

  protected override onHitIntercept(hit: Hit): HitResult | null {
    const at = this.position.clone().setY(this.position.y + this.height * 0.6);
    return this.armour.handleHit(hit, at);
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
    } else if (dist < this.stats.chargeRange && dist > this.cfg.attackRange * 1.5 && Math.random() < 0.3) {
      this.attackType = 'charge';
      this.setAIState('windup');
    }

    if (dist > this.cfg.chaseRange * 1.2) {
      this.setAIState('idle');
    }
  }

  protected override onStateWindup(dt: number): void {
    this.velocity.multiplyScalar(0.8);

    if (this.stateTime < 0.05) {
      this.attackHitDone = false;

      if (this.attackType === 'slam') {
        // Ground slam telegraph: circle
        this.facePlayer();
        this.scene.add(new Telegraph({
          shape: 'circle',
          at: this.position.clone(),
          radius: this.stats.slamRadius,
          durationSec: this.cfg.windupSec,
          color: '#aa55ff',
        }));
      } else {
        // Charge telegraph: line
        this.facePlayer();
        this.chargeDir.copy(this.dirToPlayer());
        this.scene.add(new Telegraph({
          shape: 'line',
          at: this.position.clone(),
          length: this.stats.chargeRange,
          width: this.stats.chargeWidth,
          yaw: this.yaw,
          durationSec: this.stats.chargeWindupSec,
          color: '#8844ff',
        }));
      }

      // Show windup pose
      if (this.model?.has(ENEMY_ANIMS.windup)) {
        this.model.play(ENEMY_ANIMS.windup, { loop: false, fade: 0.1 });
      }
    }

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

      if (this.model?.has(ENEMY_ANIMS.attack)) {
        this.model.play(ENEMY_ANIMS.attack, { loop: false, restart: true, fade: 0.05 });
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
