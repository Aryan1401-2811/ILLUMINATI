import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import type { Hit, HitResult, Hurtbox } from '@/combat/types';
import { CharacterModel } from '@/render/CharacterModel';
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
  /** Chance per 60 fps frame to hesitate instead of attacking (scaled by dt, so frame-rate independent). */
  hesitateProbability?: number;
  /** Probability to flinch (back away) after being hit. */
  flinchProbability?: number;
  /** If true, only heavy hits and shell breaks stagger this enemy. */
  heavyStaggerOnly?: boolean;
  /** Visual variant (used for the Narrator's summoned gold enemies) */
  variant?: 'normal' | 'gold';
}

const _v = new THREE.Vector3();
const _fwd = new THREE.Vector3();

/** How long the corpse fades (and the ink splats with it) before destroy(). */
const DEATH_SEC = 1.5;

/** One shared glow texture for every enemy (a canvas per enemy was never freed). */
let glowTexture: THREE.Texture | null = null;
function getGlowTexture(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(155,107,255,0.6)');
  grad.addColorStop(0.5, 'rgba(155,107,255,0.2)');
  grad.addColorStop(1, 'rgba(155,107,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

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
 *  - Override `onEnterState('windup')` to play the telegraph (runs once per windup)
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

  /** Random length of the current timed state (hesitate/circle/flinch), rolled once on entry. */
  protected stateDur = 0;
  /** Strafe direction while circling, rolled once on entry (+1 / -1). */
  protected circleDir = 1;

  // Death animation
  private deadFor = -1;
  private deathSplats: THREE.Mesh[] = [];

  // Shade clue: soft violet glow
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
    const spriteMat = new THREE.SpriteMaterial({
      map: getGlowTexture(),
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

  /**
   * Load a shared .glb and attach it. Returns null (and frees the copy) if the
   * enemy was removed while the file was still loading.
   */
  protected async attachModel(path: string, opts: Parameters<typeof CharacterModel.load>[1]): Promise<CharacterModel | null> {
    const model = await CharacterModel.load(path, opts);
    if (this.destroyed) {
      disposeOwnMaterials(model.root);
      return null;
    }
    this.model = model;
    this.object.add(model.root);
    return model;
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

    if (shouldStagger) this.stagger();

    return 'damaged';
  }

  /** Interrupt whatever we're doing. Shade clue: sometimes flinch away instead. */
  protected stagger(): void {
    if (Math.random() < (this.cfg.flinchProbability ?? 0)) {
      this.setAIState('flinch');
    } else {
      this.setAIState('hurt');
    }
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
    // Small ink splatters. They live in the world (not on this.object, which shrinks as it
    // fades), are faded in update() on game time and freed in onRemoved().
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
      this.deathSplats.push(splat);
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
        // Fade materials (each instance has its own toon materials)
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
      const splatOpacity = Math.max(0, 1 - this.deadFor / DEATH_SEC);
      for (const s of this.deathSplats) (s.material as THREE.MeshBasicMaterial).opacity = splatOpacity;
      if (this.deadFor > DEATH_SEC) this.destroy();
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
      if (this.chance(this.cfg.hesitateProbability ?? 0, dt)) {
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
      return;
    }

    // Lost the player
    if (dist > this.cfg.chaseRange * 1.2) {
      this.setAIState('idle');
    }
  }

  protected onStateCircle(_dt: number): void {
    if (!this.playerRef) { this.setAIState('idle'); return; }

    this.facePlayer();
    this.model?.play(ENEMY_ANIMS.run, { timeScale: 0.7 });

    // Strafe around the player (direction picked once on entry)
    const dir = this.dirToPlayer();
    _v.set(-dir.z * this.circleDir, 0, dir.x * this.circleDir);
    this.velocity.copy(_v).multiplyScalar(this.cfg.moveSpeed * 0.6);

    // After circling briefly, decide to attack
    if (this.stateTime > this.stateDur) {
      this.setAIState('windup');
      return;
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

    if (this.stateTime > this.stateDur) {
      // After hesitating, might back away or attack
      if (Math.random() < 0.4) {
        this.setAIState('flinch');
      } else {
        this.setAIState('windup');
      }
    }
  }

  /** Override this to lock facing during the wind-up. Show the telegraph in onEnterState('windup'). */
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
    if (this.stateTime >= 0.3) {
      this.setAIState('chase');
    }
  }

  protected onStateFlinch(_dt: number): void {
    // Shade clue: back away from the player
    if (this.playerRef) {
      this.facePlayer();
      const dir = this.dirToPlayer();
      this.velocity.copy(dir).multiplyScalar(-this.cfg.moveSpeed * 0.6);
    }
    this.model?.play(ENEMY_ANIMS.run, { timeScale: -0.5 });
    if (this.stateTime > this.stateDur) {
      this.setAIState('chase');
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  protected setAIState(state: EnemyAIState): void {
    this.aiState = state;
    this.stateTime = 0;
    // Random durations are rolled ONCE here. Re-rolling them every frame made the
    // effective length depend on the frame rate (it collapsed toward the minimum).
    switch (state) {
      case 'circle':
        this.stateDur = 0.6 + Math.random() * 0.8;
        this.circleDir = Math.random() < 0.5 ? 1 : -1;
        break;
      case 'hesitate':
        this.stateDur = 0.5 + Math.random() * 0.5;
        break;
      case 'flinch':
        this.stateDur = 0.5 + Math.random() * 0.3;
        break;
      case 'hurt':
        if (this.model?.has(ENEMY_ANIMS.hurt)) {
          this.model.play(ENEMY_ANIMS.hurt, { loop: false, restart: true, fade: 0.05 });
        }
        break;
    }
    this.onEnterState(state);
  }

  /**
   * Runs once each time a state is entered. Put one-shot work here (telegraphs,
   * attack anims, resetting hit flags) — checking `stateTime < 0.05` misses it
   * whenever the first frame of the state is longer than 50 ms.
   */
  protected onEnterState(_state: EnemyAIState): void {}

  /** Per-frame chance tuned at 60 fps, scaled so it behaves the same at any frame rate. */
  protected chance(perFrameAt60: number, dt: number): boolean {
    if (perFrameAt60 <= 0) return false;
    return Math.random() < 1 - Math.pow(1 - Math.min(1, perFrameAt60), dt * 60);
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

  onRemoved(): void {
    for (const s of this.deathSplats) {
      s.removeFromParent();
      s.geometry.dispose();
      (s.material as THREE.Material).dispose();
    }
    this.deathSplats.length = 0;

    // The .glb's geometry is shared with every other copy of the model (asset cache),
    // so only free the model's own materials. Everything else on this.object is ours.
    const modelRoot = this.model?.root ?? null;
    if (modelRoot) disposeOwnMaterials(modelRoot);
    this.object.traverse((o) => {
      if (modelRoot && isInside(o, modelRoot)) return;
      if (o.userData.isOutline) return; // outline materials are shared (render/toon cache)
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) mat.dispose();
      }
    });
  }
}

/** Free the per-instance materials of a loaded model, skipping shared outline materials and geometry. */
function disposeOwnMaterials(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o.userData.isOutline) return;
    const mat = (o as THREE.Mesh).material;
    if (!mat) return;
    for (const m of Array.isArray(mat) ? mat : [mat]) m.dispose();
  });
}

function isInside(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === root) return true;
  return false;
}
