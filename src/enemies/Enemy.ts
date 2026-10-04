import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import type { Hit, HitResult, Hurtbox } from '@/combat/types';
import { CharacterModel } from '@/render/CharacterModel';
import { toonMaterial, addOutline } from '@/render/toon';
import { ENEMY_ANIMS } from './config';

/**
 * AI states — a simple state machine that all enemies share.
 * Subclasses override `onState*` methods for custom behaviour.
 */
export type EnemyAIState =
  | 'idle'
  | 'chase'
  | 'circle'      // strafe around the player before attacking
  | 'hesitate'    // Shade clue: pause before attacking
  | 'windup'
  | 'attack'
  | 'recover'
  | 'hurt'
  | 'flinch'      // Shade clue: back away after being hit
  | 'dead';

export interface EnemyConfig {
  id: string;
  type: string;
  hp: number;
  damage: number;
  knockback: number;
  moveSpeed: number;
  chaseRange: number;
  attackRange: number;
  windupSec: number;
  activeSec: number;
  recoverySec: number;
  arcDeg: number;
  radius: number;
  height: number;
  mass: number;
  /** Probability per frame to hesitate instead of attacking. */
  hesitateProbability?: number;
  /** Probability to flinch (back away) after being hit. */
  flinchProbability?: number;
  /** If true, only heavy hits and shell breaks stagger this enemy. */
  heavyStaggerOnly?: boolean;
}

const _v = new THREE.Vector3();
const _fwd = new THREE.Vector3();

/**
 * Base class for all regular enemies. Handles:
 *  - HP, Hurtbox registration, knockback, stagger, flash, death
 *  - AI state machine (idle → chase → windup → attack → recover)
 *  - Shade clues (hesitate, flinch, back away)
 *  - Death: anim, ink burst, fade, emit enemy:killed
 *
 * Subclasses must:
 *  - Call super() with an EnemyConfig
 *  - Set up `this.model` (call `await this.loadModel()` or build procedurally)
 *  - Override `onStateWindup()` to play the telegraph
 *  - Override `onStateAttack()` to deal damage
 *  - Optionally override `onStateChase()` for custom movement
 */
export abstract class Enemy extends Entity implements Hurtbox {
  readonly team = 'enemy' as const;
  readonly id: string;
  radius: number;
  height: number;
  mass: number;

  hp: number;
  readonly maxHp: number;
  readonly cfg: EnemyConfig;

  aiState: EnemyAIState = 'idle';
  stateTime = 0;
  yaw = 0;

  model: CharacterModel | null = null;
  protected readonly velocity = new THREE.Vector3();
  protected readonly knockbackVel = new THREE.Vector3();
  protected playerRef: Hurtbox | null = null;
  protected invulnLeft = 0;

  // Death animation
  private deadFor = -1;
  private deathFadeGeo: THREE.BufferGeometry | null = null;
  private deathFadeMat: THREE.Material | null = null;

  // Shade clue: soft violet glow
  private glowMat: THREE.MeshBasicMaterial;
  private glowSprite: THREE.Sprite;

  constructor(cfg: EnemyConfig) {
    super();
    this.id = cfg.id;
    this.cfg = cfg;
    this.hp = this.maxHp = cfg.hp;
    this.radius = cfg.radius;
    this.height = cfg.height;
    this.mass = cfg.mass;

    // Soft violet glow sprite — calm, not threatening (Shade clue)
    this.glowMat = new THREE.MeshBasicMaterial(); // not actually used for sprite
    const glowTex = this.makeGlowTexture();
    const spriteMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: '#9b6bff',
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.25,
    });
    this.glowSprite = new THREE.Sprite(spriteMat);
    this.glowSprite.scale.setScalar(this.height * 1.2);
    this.glowSprite.position.y = this.height * 0.5;
    this.object.add(this.glowSprite);
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  get forward(): THREE.Vector3 {
    return _fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  onAdded(): void {
    this.own(this.scene.combat.register(this));
  }

  // ── Hurtbox ────────────────────────────────────────────────────────────

  receiveHit(hit: Hit): HitResult {
    if (!this.alive) return 'immune';
    if (this.invulnLeft > 0) return 'immune';

    // Subclass may intercept (e.g. armour)
    const intercepted = this.onHitIntercept(hit);
    if (intercepted !== null) return intercepted;

    // Apply damage
    this.hp = Math.max(0, this.hp - hit.amount);

    // Visual feedback
    this.model?.flash('#ffffff', 0.12);

    // Knockback
    _v.subVectors(this.position, hit.from).setY(0);
    if (_v.lengthSq() < 1e-6) _v.copy(this.forward).negate();
    _v.normalize();
    this.knockbackVel.addScaledVector(_v, hit.knockback);

    if (this.hp <= 0) {
      this.die();
      return 'killed';
    }

    // Stagger check
    const shouldStagger = this.cfg.heavyStaggerOnly
      ? hit.heavy
      : true;

    if (shouldStagger) {
      // Shade clue: sometimes flinch away instead of just staggering
      if (Math.random() < (this.cfg.flinchProbability ?? 0)) {
        this.setAIState('flinch');
      } else {
        this.setAIState('hurt');
      }
    }

    return 'damaged';
  }

  /**
   * Override in subclass to intercept hits before HP is reduced.
   * Return a HitResult to swallow the hit, or null to let it through.
   * The Brute uses this for its Armour.
   */
  protected onHitIntercept(_hit: Hit): HitResult | null {
    return null;
  }

  // ── Death ──────────────────────────────────────────────────────────────

  protected die(): void {
    this.setAIState('dead');
    this.deadFor = 0;
    this.velocity.set(0, 0, 0);
    events.emit('enemy:killed', {
      enemyType: this.cfg.type,
      position: this.position.clone(),
      wisp: true,
    });

    // Ink burst on death
    this.spawnDeathBurst();

    // Play death anim if available
    if (this.model?.has(ENEMY_ANIMS.death)) {
      this.model.play(ENEMY_ANIMS.death, { loop: false, fade: 0.08 });
    }
  }

  private spawnDeathBurst(): void {
    // Small ink splatters
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
      const geo = new THREE.CircleGeometry(0.1 + Math.random() * 0.15, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#2a1555').multiplyScalar(2),
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const splat = new THREE.Mesh(geo, mat);
      splat.rotation.x = -Math.PI / 2;
      splat.position.set(
        this.position.x + Math.cos(angle) * (0.3 + Math.random() * 0.5),
        0.03,
        this.position.z + Math.sin(angle) * (0.3 + Math.random() * 0.5),
      );
      this.scene.three.add(splat);
      // Fade and clean up after a bit
      const startTime = Date.now();
      const cleanup = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 1.5) {
          mat.dispose();
          geo.dispose();
          splat.removeFromParent();
          return;
        }
        mat.opacity = Math.max(0, 1 - elapsed / 1.5);
        requestAnimationFrame(cleanup);
      };
      requestAnimationFrame(cleanup);
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────

  update(dt: number): void {
    this.model?.update(dt);
    if (dt <= 0) return;

    this.stateTime += dt;
    this.invulnLeft = Math.max(0, this.invulnLeft - dt);

    // Update glow pulse
    this.glowSprite.material.opacity = this.alive
      ? 0.15 + Math.sin(this.stateTime * 2) * 0.08
      : 0;

    // Find the player
    this.playerRef = this.findPlayer();

    // Death fade
    if (this.deadFor >= 0) {
      this.deadFor += dt;
      const fadeK = Math.min(1, this.deadFor / 1.2);
      this.object.scale.setScalar(1 - fadeK * 0.5);
      if (this.model) {
        // Fade materials
        this.model.root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.material && !o.userData.isOutline) {
            const mat = mesh.material as THREE.Material;
            if ('opacity' in mat) {
              mat.transparent = true;
              (mat as THREE.MeshToonMaterial).opacity = Math.max(0, 1 - fadeK);
            }
          }
        });
      }
      if (this.deadFor > 1.5) this.destroy();
      return;
    }

    // ── AI state machine ─────────────────────────────────────────────────
    switch (this.aiState) {
      case 'idle':
        this.onStateIdle(dt);
        break;
      case 'chase':
        this.onStateChase(dt);
        break;
      case 'circle':
        this.onStateCircle(dt);
        break;
      case 'hesitate':
        this.onStateHesitate(dt);
        break;
      case 'windup':
        this.onStateWindup(dt);
        break;
      case 'attack':
        this.onStateAttack(dt);
        break;
      case 'recover':
        this.onStateRecover(dt);
        break;
      case 'hurt':
        this.onStateHurt(dt);
        break;
      case 'flinch':
        this.onStateFlinch(dt);
        break;
      case 'dead':
        break;
    }

    // ── Integrate velocity + knockback ───────────────────────────────────
    this.position.addScaledVector(this.velocity, dt);
    this.position.addScaledVector(this.knockbackVel, dt);
    this.knockbackVel.multiplyScalar(Math.exp(-8 * dt));
    this.position.y = 0;
    this.scene.collision.resolve(this.position, this.radius);

    // Face direction
    const cur = this.object.rotation.y;
    let diff = this.yaw - cur;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.object.rotation.y = cur + diff * (1 - Math.exp(-10 * dt));
  }

  // ── AI state handlers (override in subclasses) ─────────────────────────

  protected onStateIdle(_dt: number): void {
    this.velocity.multiplyScalar(0.9);
    this.model?.play(ENEMY_ANIMS.idle);
    if (this.playerRef) {
      const dist = this.distToPlayer();
      if (dist < this.cfg.chaseRange) {
        this.setAIState('chase');
      }
    }
  }

  protected onStateChase(dt: number): void {
    if (!this.playerRef) { this.setAIState('idle'); return; }

    const dist = this.distToPlayer();
    this.facePlayer();
    this.model?.play(ENEMY_ANIMS.run);

    // Move toward player
    const dir = this.dirToPlayer();
    this.velocity.copy(dir).multiplyScalar(this.cfg.moveSpeed);

    // Shade clue: sometimes hesitate instead of going straight to attack
    if (dist < this.cfg.attackRange * 1.8) {
      if (Math.random() < (this.cfg.hesitateProbability ?? 0)) {
        this.setAIState('hesitate');
        return;
      }
    }

    // Close enough to attack? First circle a bit (Shade clue: they don't rush in)
    if (dist < this.cfg.attackRange * 1.5) {
      if (Math.random() < 0.3) {
        this.setAIState('circle');
      } else {
        this.setAIState('windup');
      }
    }

    // Lost the player
    if (dist > this.cfg.chaseRange * 1.2) {
      this.setAIState('idle');
    }
  }

  protected onStateCircle(dt: number): void {
    if (!this.playerRef) { this.setAIState('idle'); return; }

    this.facePlayer();
    this.model?.play(ENEMY_ANIMS.run, { timeScale: 0.7 });

    // Strafe around the player
    const dir = this.dirToPlayer();
    const perpDir = (this.stateTime * 1000) % 2 < 1 ? 1 : -1;
    const perp = new THREE.Vector3(-dir.z * perpDir, 0, dir.x * perpDir);
    this.velocity.copy(perp).multiplyScalar(this.cfg.moveSpeed * 0.6);

    // After circling briefly, decide to attack
    if (this.stateTime > 0.6 + Math.random() * 0.8) {
      this.setAIState('windup');
    }

    // Too far? Chase again
    if (this.distToPlayer() > this.cfg.attackRange * 2.5) {
      this.setAIState('chase');
    }
  }

  protected onStateHesitate(_dt: number): void {
    // Shade clue: enemy pauses, looks uncertain
    this.velocity.multiplyScalar(0.85);
    this.model?.play(ENEMY_ANIMS.idle);
    if (this.playerRef) this.facePlayer();

    if (this.stateTime > 0.5 + Math.random() * 0.5) {
      // After hesitating, might back away or attack
      if (Math.random() < 0.4) {
        this.setAIState('flinch');
      } else {
        this.setAIState('windup');
      }
    }
  }

  /** Override this to show telegraph and lock facing. */
  protected onStateWindup(_dt: number): void {
    this.velocity.multiplyScalar(0.85);
    if (this.stateTime >= this.cfg.windupSec) {
      this.setAIState('attack');
    }
  }

  /** Override this to deal damage. */
  protected onStateAttack(_dt: number): void {
    if (this.stateTime >= this.cfg.activeSec) {
      this.setAIState('recover');
    }
  }

  protected onStateRecover(_dt: number): void {
    this.velocity.multiplyScalar(0.9);
    this.model?.play(ENEMY_ANIMS.idle);
    if (this.stateTime >= this.cfg.recoverySec) {
      this.setAIState('chase');
    }
  }

  protected onStateHurt(_dt: number): void {
    this.velocity.multiplyScalar(0.85);
    if (this.model?.has(ENEMY_ANIMS.hurt)) {
      this.model.play(ENEMY_ANIMS.hurt, { loop: false });
    }
    if (this.stateTime >= 0.3) {
      this.setAIState('chase');
    }
  }

  protected onStateFlinch(dt: number): void {
    // Shade clue: back away from the player
    if (this.playerRef) {
      this.facePlayer();
      const dir = this.dirToPlayer();
      this.velocity.copy(dir).multiplyScalar(-this.cfg.moveSpeed * 0.6);
    }
    this.model?.play(ENEMY_ANIMS.run, { timeScale: -0.5 });
    if (this.stateTime > 0.5 + Math.random() * 0.3) {
      this.setAIState('chase');
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  protected setAIState(state: EnemyAIState): void {
    this.aiState = state;
    this.stateTime = 0;
  }

  protected findPlayer(): Hurtbox | null {
    for (const h of this.scene.combat.targets('enemy')) {
      if (h.team === 'player' && h.alive) return h;
    }
    return null;
  }

  protected distToPlayer(): number {
    if (!this.playerRef) return Infinity;
    return _v.subVectors(this.playerRef.position, this.position).setY(0).length();
  }

  protected dirToPlayer(): THREE.Vector3 {
    if (!this.playerRef) return new THREE.Vector3(0, 0, -1);
    return new THREE.Vector3()
      .subVectors(this.playerRef.position, this.position)
      .setY(0)
      .normalize();
  }

  protected facePlayer(): void {
    if (!this.playerRef) return;
    const dir = this.dirToPlayer();
    this.yaw = Math.atan2(dir.x, dir.z);
  }

  /** Ensure the enemy doesn't attack from off-screen. */
  protected isOnScreen(): boolean {
    // Simple check: within reasonable distance of player
    return this.distToPlayer() < 18;
  }

  private makeGlowTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(155,107,255,0.6)');
    grad.addColorStop(0.5, 'rgba(155,107,255,0.2)');
    grad.addColorStop(1, 'rgba(155,107,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  onRemoved(): void {
    this.object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) mat.dispose();
      }
    });
  }
}
