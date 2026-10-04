import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import { input, type Action } from '@/core/input';
import { PLAYER, type ComboStep } from '@/core/config';
import { CharacterModel } from '@/render/CharacterModel';
import type { Element, Hit, HitResult, Hurtbox } from '@/combat/types';
import { isPositiveResult } from '@/combat/types';
import { SlashArc } from '@/vfx/SlashArc';
import type { Ability } from './abilities/Ability';
import { createAbility } from './abilities/registry';

/** Hero model + clip names. Swap these when the final hero model arrives. */
export const HERO_MODEL = {
  path: 'models/robot_expressive.glb',
  height: 1.8,
  anims: { idle: 'Idle', run: 'Running', attack: 'Punch', dodge: 'Jump', cast: 'Punch', death: 'Death', victory: 'ThumbsUp', walk: 'Walking' },
};

export type PlayerState = 'move' | 'attack' | 'dodge' | 'cast' | 'hurt' | 'dead' | 'locked';

const ABILITY_ACTIONS: Action[] = ['ability1', 'ability2', 'ability3'];
const _v = new THREE.Vector3();
const _move = new THREE.Vector2();
const _ray = new THREE.Raycaster();
const _ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/**
 * The hero. Movement, 3-hit combo, dodge, energy, ability slots, health.
 *
 * Public API other systems use:
 *   player.setLoadout(['goldBolt', 'goldBurst', null])   // slots Q/RMB, E, R
 *   player.setElement('violet')                           // melee + VFX colour after the twist
 *   player.stripPowers()                                  // twist: lose abilities + energy
 *   player.setLocked(true)                                // cutscene: no control, invulnerable
 *   await player.walkTo(new THREE.Vector3(0, 0, -5))      // scripted movement in cutscenes
 *   player.heal(30); player.gainEnergy(20)
 */
export class Player extends Entity implements Hurtbox {
  readonly team = 'player' as const;
  readonly id = 'player';
  radius = PLAYER.radius;
  height = PLAYER.height;
  mass = 1;

  hp = PLAYER.maxHp;
  maxHp = PLAYER.maxHp;
  energy = 0;
  maxEnergy = PLAYER.maxEnergy;
  element: Element = 'gold';
  abilities: (Ability | null)[] = [null, null, null];

  state: PlayerState = 'move';
  stateTime = 0;
  /** Facing angle (radians). 0 = +Z (toward camera). */
  yaw = Math.PI;
  readonly velocity = new THREE.Vector3();
  readonly aimPoint = new THREE.Vector3();
  readonly aimDir = new THREE.Vector3(0, 0, -1);

  model: CharacterModel | null = null;
  /** Resolves when the model has loaded. `await scene.add(new Player()).ready` */
  readonly ready: Promise<void>;

  private knockback = new THREE.Vector3();
  private invulnLeft = 0;
  private dodgeCooldown = 0;
  private dodgeDir = new THREE.Vector3();
  private comboStep = -1;
  private comboQueued = false;
  private comboWindowLeft = 0;
  private attackHitDone = false;
  private walkTarget: THREE.Vector3 | null = null;
  private walkResolve: (() => void) | null = null;
  private castTimeLeft = 0;

  constructor() {
    super();
    this.ready = CharacterModel.load(HERO_MODEL.path, { height: HERO_MODEL.height, outlineWidth: 3 }).then((m) => {
      this.model = m;
      this.object.add(m.root);
      m.play(HERO_MODEL.anims.idle);
    });
  }

  get alive(): boolean {
    return this.state !== 'dead';
  }

  get invulnerable(): boolean {
    return this.invulnLeft > 0 || this.state === 'dodge' || this.state === 'locked';
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  onAdded() {
    this.own(this.scene.combat.register(this));
    this.object.rotation.y = this.yaw;
    this.emitStats();
  }

  // ── Public API ─────────────────────────────────────────────────

  setLoadout(ids: (string | null)[]) {
    this.abilities = [0, 1, 2].map((i) => (ids[i] ? createAbility(ids[i]!) : null));
    events.emit('player:loadout', { abilityIds: this.abilities.map((a) => a?.id ?? null) });
  }

  setElement(e: Element) {
    this.element = e;
  }

  stripPowers() {
    this.setLoadout([null, null, null]);
    this.energy = 0;
    this.emitStats();
  }

  setLocked(locked: boolean) {
    if (locked) {
      this.setState('locked');
      this.velocity.set(0, 0, 0);
      this.model?.play(HERO_MODEL.anims.idle);
    } else if (this.state === 'locked') {
      this.setState('move');
    }
  }

  /** Scripted walk (only while locked). Resolves on arrival. */
  walkTo(target: THREE.Vector3): Promise<void> {
    this.setLocked(true);
    this.walkTarget = target.clone().setY(0);
    return new Promise((r) => (this.walkResolve = r));
  }

  heal(n: number) {
    this.hp = Math.min(this.maxHp, this.hp + n);
    this.emitStats();
  }

  gainEnergy(n: number) {
    this.energy = Math.min(this.maxEnergy, this.energy + n);
    events.emit('player:energy', { energy: this.energy, max: this.maxEnergy });
  }

  spendEnergy(n: number): boolean {
    if (this.energy < n) return false;
    this.energy -= n;
    events.emit('player:energy', { energy: this.energy, max: this.maxEnergy });
    return true;
  }

  /** Full reset (respawn / checkpoint). */
  revive(at?: THREE.Vector3) {
    if (at) this.position.copy(at);
    this.hp = this.maxHp;
    this.invulnLeft = 1;
    this.setState('move');
    this.model?.play(HERO_MODEL.anims.idle, { restart: true });
    this.emitStats();
  }

  // ── Hurtbox ────────────────────────────────────────────────────

  receiveHit(hit: Hit): HitResult {
    if (this.state === 'dead' || this.invulnerable) return 'immune';
    this.hp = Math.max(0, this.hp - hit.amount);
    this.model?.flash('#ff3b3b', 0.18);
    _v.subVectors(this.position, hit.from).setY(0);
    if (_v.lengthSq() < 1e-6) _v.copy(this.forward).negate();
    this.knockback.copy(_v.normalize()).multiplyScalar(hit.knockback);
    events.emit('player:hurt', { amount: hit.amount, position: this.position.clone() });
    this.emitStats();
    if (this.hp <= 0) {
      this.setState('dead');
      this.model?.play(HERO_MODEL.anims.death, { loop: false, fade: 0.08 });
      events.emit('player:died', { position: this.position.clone() });
      return 'killed';
    }
    this.invulnLeft = PLAYER.hurtInvuln;
    this.comboStep = -1;
    this.setState('hurt');
    return 'damaged';
  }

  // ── Frame update ───────────────────────────────────────────────

  update(dt: number) {
    this.model?.update(dt);
    if (dt <= 0) return;
    this.stateTime += dt;
    this.invulnLeft = Math.max(0, this.invulnLeft - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.comboWindowLeft = Math.max(0, this.comboWindowLeft - dt);
    if (this.comboWindowLeft <= 0 && this.state !== 'attack') this.comboStep = -1;
    for (const a of this.abilities) a?.update(dt);
    this.updateAim();

    switch (this.state) {
      case 'move':
        this.updateMove(dt);
        this.tryActions();
        break;
      case 'attack':
        this.updateAttack(dt);
        break;
      case 'dodge':
        this.updateDodge();
        break;
      case 'cast':
        this.velocity.multiplyScalar(Math.exp(-20 * dt));
        if (this.stateTime >= this.castTimeLeft) this.setState('move');
        break;
      case 'hurt':
        this.velocity.multiplyScalar(Math.exp(-15 * dt));
        if (this.stateTime >= PLAYER.hurtStun) this.setState('move');
        break;
      case 'dead':
        this.velocity.set(0, 0, 0);
        break;
      case 'locked':
        this.updateScriptedWalk(dt);
        break;
    }

    // integrate
    this.position.addScaledVector(this.velocity, dt).addScaledVector(this.knockback, dt);
    this.knockback.multiplyScalar(Math.exp(-10 * dt));
    this.position.y = 0;
    this.scene.collision.resolve(this.position, this.radius);

    // face
    const cur = this.object.rotation.y;
    let diff = this.yaw - cur;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.object.rotation.y = cur + diff * (1 - Math.exp(-PLAYER.turnSpeed * dt));

    this.scene.cameraRig.lookAheadTarget = this.state === 'locked' ? null : this.aimPoint;
  }

  private updateAim() {
    _ray.setFromCamera(input.mouseNdc, this.scene.game.camera);
    if (_ray.ray.intersectPlane(_ground, _v)) this.aimPoint.copy(_v);
    this.aimDir.subVectors(this.aimPoint, this.position).setY(0);
    if (this.aimDir.lengthSq() < 1e-4) this.aimDir.copy(this.forward);
    this.aimDir.normalize();
  }

  private updateMove(dt: number) {
    input.moveVector(_move);
    // camera looks toward -Z, so screen-up is world -Z
    const target = _v.set(_move.x, 0, -_move.y).multiplyScalar(PLAYER.moveSpeed);
    const accel = PLAYER.acceleration * dt;
    const delta = target.sub(this.velocity);
    if (delta.length() > accel) delta.setLength(accel);
    this.velocity.add(delta);

    const speed = this.velocity.length();
    if (_move.lengthSq() > 0.01) this.yaw = Math.atan2(this.velocity.x, this.velocity.z);
    this.model?.play(speed > 0.6 ? HERO_MODEL.anims.run : HERO_MODEL.anims.idle, {
      timeScale: speed > 0.6 ? THREE.MathUtils.clamp(speed / PLAYER.moveSpeed, 0.6, 1.2) : 1,
    });
  }

  /** Inputs allowed from the free-movement state. */
  private tryActions(): boolean {
    if (input.pressed('dodge') && this.dodgeCooldown <= 0) {
      this.startDodge();
      return true;
    }
    if (input.pressed('attack')) {
      this.startAttack(this.comboWindowLeft > 0 ? (this.comboStep + 1) % 3 : 0);
      return true;
    }
    for (let i = 0; i < 3; i++) {
      if (input.pressed(ABILITY_ACTIONS[i]) && this.tryCast(i)) return true;
    }
    return false;
  }

  private tryCast(slot: number): boolean {
    const ability = this.abilities[slot];
    if (!ability || !ability.canCast(this)) return false;
    this.spendEnergy(ability.cost);
    ability.cooldownLeft = ability.cooldown;
    this.yaw = Math.atan2(this.aimDir.x, this.aimDir.z);
    this.object.rotation.y = this.yaw;
    this.castTimeLeft = ability.castTime;
    this.setState('cast');
    this.model?.play(ability.castAnim, { loop: false, restart: true, timeScale: 2.2, fade: 0.05 });
    ability.cast({ player: this, scene: this.scene, aimPoint: this.aimPoint.clone(), aimDir: this.aimDir.clone() });
    events.emit('player:ability', { id: ability.id, position: this.position.clone() });
    return true;
  }

  private startDodge() {
    input.moveVector(_move);
    if (_move.lengthSq() > 0.01) this.dodgeDir.set(_move.x, 0, -_move.y).normalize();
    else this.dodgeDir.copy(this.forward);
    this.yaw = Math.atan2(this.dodgeDir.x, this.dodgeDir.z);
    this.dodgeCooldown = PLAYER.dodge.cooldown + PLAYER.dodge.duration;
    this.comboStep = -1;
    this.setState('dodge');
    this.model?.play(HERO_MODEL.anims.dodge, { loop: false, restart: true, timeScale: 2.4, fade: 0.05 });
    events.emit('player:dodge', { position: this.position.clone() });
  }

  private updateDodge() {
    const k = this.stateTime / PLAYER.dodge.duration;
    this.velocity.copy(this.dodgeDir).multiplyScalar(PLAYER.dodge.speed * (1 - 0.5 * k));
    if (k >= 1) {
      this.invulnLeft = Math.max(this.invulnLeft, PLAYER.dodge.invuln - PLAYER.dodge.duration);
      this.velocity.multiplyScalar(0.3);
      this.setState('move');
    }
  }

  private get step(): ComboStep {
    return PLAYER.combo[Math.max(0, this.comboStep)];
  }

  private startAttack(step: number) {
    this.comboStep = step;
    this.comboQueued = false;
    this.attackHitDone = false;
    this.yaw = Math.atan2(this.aimDir.x, this.aimDir.z);
    this.setState('attack');
    const s = this.step;
    const total = s.windup + s.active + s.recovery;
    const clip = this.model?.clipDuration(HERO_MODEL.anims.attack) || 1;
    this.model?.play(HERO_MODEL.anims.attack, { loop: false, restart: true, fade: 0.05, timeScale: (clip / total) * 0.9 });
    events.emit('player:attack', { comboStep: step, heavy: s.heavy, position: this.position.clone() });
  }

  private updateAttack(dt: number) {
    const s = this.step;
    const t = this.stateTime;
    const lungeEnd = s.windup + s.active;
    if (input.pressed('attack')) this.comboQueued = true;

    // lunge forward during windup + active
    if (t < lungeEnd) this.velocity.copy(this.forward).multiplyScalar(s.lunge / lungeEnd);
    else this.velocity.multiplyScalar(Math.exp(-25 * dt));

    if (!this.attackHitDone && t >= s.windup) {
      this.attackHitDone = true;
      this.doMeleeHit(s);
    }

    if (t >= lungeEnd) {
      // cancel recovery into dodge / ability
      if (input.pressed('dodge') && this.dodgeCooldown <= 0) return this.startDodge();
      for (let i = 0; i < 3; i++) if (input.pressed(ABILITY_ACTIONS[i]) && this.tryCast(i)) return;
      if (this.comboQueued && this.comboStep < 2 && t >= lungeEnd + s.recovery * 0.35) {
        return this.startAttack(this.comboStep + 1);
      }
    }
    if (t >= lungeEnd + s.recovery) {
      this.comboWindowLeft = this.comboStep < 2 ? PLAYER.comboWindow : 0;
      if (this.comboStep >= 2) this.comboStep = -1;
      this.setState('move');
    }
  }

  private doMeleeHit(s: ComboStep) {
    const fwd = this.forward;
    const color = this.element === 'violet' ? '#c9b2ff' : '#fff0b8';
    this.scene.add(
      new SlashArc(this.position.clone().addScaledVector(fwd, 0.2), this.yaw, {
        radius: s.range * 0.85,
        arcDeg: s.arcDeg,
        heavy: s.heavy,
        color,
        flip: this.comboStep === 1,
      }),
    );
    const targets = this.scene.combat.queryArc(this.position, fwd, s.range, s.arcDeg, 'player');
    for (const target of targets) {
      const result = this.scene.combat.applyHit(target, {
        amount: s.damage,
        kind: 'melee',
        element: this.element,
        heavy: s.heavy,
        team: 'player',
        from: this.position.clone(),
        knockback: s.knockback,
        sourceId: `combo${this.comboStep}`,
      });
      if (isPositiveResult(result)) this.gainEnergy(s.energyGain);
    }
  }

  private updateScriptedWalk(dt: number) {
    if (!this.walkTarget) {
      this.velocity.multiplyScalar(Math.exp(-15 * dt));
      return;
    }
    _v.subVectors(this.walkTarget, this.position).setY(0);
    const d = _v.length();
    if (d < 0.15) {
      this.walkTarget = null;
      this.velocity.set(0, 0, 0);
      this.model?.play(HERO_MODEL.anims.idle);
      const r = this.walkResolve;
      this.walkResolve = null;
      r?.();
      return;
    }
    this.velocity.copy(_v.normalize()).multiplyScalar(Math.min(PLAYER.moveSpeed * 0.6, d * 4));
    this.yaw = Math.atan2(this.velocity.x, this.velocity.z);
    this.model?.play(this.model.has(HERO_MODEL.anims.walk) ? HERO_MODEL.anims.walk : HERO_MODEL.anims.run);
  }

  private setState(s: PlayerState) {
    this.state = s;
    this.stateTime = 0;
  }

  private emitStats() {
    events.emit('player:health', { hp: this.hp, max: this.maxHp });
    events.emit('player:energy', { energy: this.energy, max: this.maxEnergy });
  }
}
