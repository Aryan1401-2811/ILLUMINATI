import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import { WARDEN } from './config';
import { SCRIPT } from '@/narrative/script';
import { Armour } from '@/enemies/armour/Armour';
import { Telegraph } from '@/enemies/fx/Telegraph';
import { CharacterModel } from '@/render/CharacterModel';
import { toonMaterial, addOutline } from '@/render/toon';
import type { Hit, HitResult, Hurtbox } from '@/combat/types';
import { isPositiveResult } from '@/combat/types';
import { Shockwave } from '@/vfx/Shockwave';
import { disposeBossVisuals, markSharedGeometry } from './dispose';

type WardenState =
  | 'idle' | 'defend' | 'sidestep' | 'return'
  | 'bashWindup' | 'bashing' | 'poundWindup' | 'pounding' | 'chargeWindup' | 'charging'
  | 'recover' | 'kneel' | 'defeated';

/** Clip names from public/models/MODELS.md. */
const ANIM = {
  idle: 'Idle',
  walk: 'Walking_B',
  defend: 'Blocking',
  blockHit: 'Block_Hit',
  bashWindup: 'Block',
  bash: 'Block_Attack',
  pound: '1H_Melee_Attack_Chop',
  hit: 'Hit_A',
  kneel: 'Sit_Floor_Down',
  stand: 'Sit_Floor_StandUp',
  death: 'Death_B',
} as const;

const _v = new THREE.Vector3();

export class Warden extends Entity implements Hurtbox {
  readonly team = 'enemy' as const;
  readonly id = 'warden';
  radius = WARDEN.radius;
  height = WARDEN.height;
  mass = WARDEN.mass;

  readonly maxHp = WARDEN.maxHp;

  state: WardenState = 'idle';
  stateTime = 0;
  armourCycle = 1;

  /** Mutable: disposed and re-created on each stage change (R2 rule: no regrow inside a stage). */
  armour = this.createArmour();

  private createArmour(): Armour {
    const a = new Armour('warden', {
      shellHp: WARDEN.armourShellHp,
      coreHp: WARDEN.armourCoreHp,
      coreWindowSec: Infinity, // R2: core stays open forever (no timer regrow)
      element: 'gold',
      size: 1.5,
      regrows: false,           // R2: armour never regrows inside a stage
    });
    this.object.add(a.visual);
    return a;
  }
  private velocity = new THREE.Vector3();
  private meshPivot = new THREE.Group();
  private placeholder = new THREE.Group();
  private shieldMesh: THREE.Mesh;
  private model: CharacterModel | null = null;
  private attackCooldown = 0;
  /** Wind-up of the bash in progress (a riposte after a block is quicker). */
  private bashWindupSec = WARDEN.bashWindup;
  private chargeDir = new THREE.Vector3();
  private chargeHit = false;
  /** His post. He drifts back to it instead of chasing (story clue). */
  private home: THREE.Vector3 | null = null;

  constructor() {
    super();
    // Primitive stand-in, shown only until the .glb finishes loading
    const bodyMat = toonMaterial({ color: '#c5b599' }); // gold-inlaid armor
    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 2.4, 16), bodyMat);
    bodyMesh.position.y = 1.2;
    addOutline(bodyMesh, 4);

    const shieldMat = toonMaterial({ color: '#d4c7b0' });
    this.shieldMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 16), shieldMat);
    this.shieldMesh.rotation.x = Math.PI / 2;
    this.shieldMesh.position.set(0, 1.2, 0.9);
    addOutline(this.shieldMesh, 4);

    this.placeholder.add(bodyMesh, this.shieldMesh);
    this.meshPivot.add(this.placeholder);
    this.object.add(this.meshPivot);
  }

  /**
   * The bar is the true state of the fight: each armour cycle is half of it, and within a
   * cycle the shell is 40% and the core 60%. If the core window runs out and the shell
   * regrows, the bar refills to match.
   */
  get hp(): number {
    if (this.armourCycle > 2 || this.state === 'defeated') return 0;
    const perCycle = this.maxHp / 2;
    const cyclesAfterThis = 2 - this.armourCycle;
    const thisCycle = 0.4 * this.armour.shellFraction + 0.6 * this.armour.coreFraction;
    return Math.round(perCycle * (cyclesAfterThis + thisCycle));
  }

  get alive(): boolean {
    return this.state !== 'defeated';
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.object.rotation.y), 0, Math.cos(this.object.rotation.y));
  }

  onAdded() {
    this.own(this.scene.combat.register(this));
    this.emitHealth();
    void this.loadModel();

    // Clue: Warden lowers guard when player is hurt
    this.own(events.on('player:health', ({ hp, max }) => {
      if (hp / max < 0.3 && Math.random() < 0.6 && this.state === 'defend') {
        this.setState('idle');
      }
    }));
  }

  private async loadModel() {
    const model = await CharacterModel.load(WARDEN.model, { height: WARDEN.modelHeight, outlineWidth: 4 });
    markSharedGeometry(model.root);
    if (this.destroyed) {
      disposeBossVisuals(model.root);
      return;
    }
    this.model = model;
    this.placeholder.visible = false;
    this.meshPivot.rotation.x = 0;
    this.meshPivot.add(model.root);
    this.onEnter(this.state, true); // pick up the right pose for wherever the fight is
  }

  receiveHit(hit: Hit): HitResult {
    if (!this.alive || this.state === 'kneel') return 'immune';

    // His tower shield blocks anything from the front while he defends, armour or not.
    // A heavy finisher smashes the guard aside instead; a blocked hit may get punished.
    if (this.state === 'defend') {
      _v.copy(hit.from).sub(this.position).setY(0).normalize();
      if (_v.dot(this.forward) > 0.3) {
        if (hit.kind === 'melee' && hit.heavy) {
          this.setState('recover');
          this.stateTime = 1.5 - WARDEN.guardBreakStunSec; // recover lasts 1.5 s; this is the stun
          events.emit('fx:onomatopoeia', { text: 'GUARD BREAK!', position: this.position.clone().setY(this.height), color: '#ffc21a', scale: 1.2 });
          events.emit('fx:shake', { strength: 0.3 });
        } else {
          this.model?.play(ANIM.blockHit, { loop: false, restart: true, fade: 0.05 });
          events.emit('fx:onomatopoeia', { text: 'BLOCKED', position: this.position.clone().setY(this.height), color: '#ffe9a8', scale: 0.8 });
          if (Math.random() < WARDEN.riposteChance) {
            this.bashWindupSec = WARDEN.riposteWindup;
            this.setState('bashWindup');
          }
          return 'blocked';
        }
      }
    }

    const at = this.position.clone().setY(this.height * 0.6);
    const result = this.armour.handleHit(hit, at);
    if (result === null) return 'immune'; // between cycles the armour is broken and he's done

    if (isPositiveResult(result)) {
      this.meshPivot.position.y = -0.1; // Flinch
      this.model?.flash('#ffffff', 0.12);
    }
    if (result === 'shellBroken') {
      // Armour already emits armour:shellBroken; the guard drops with the shell
      events.emit('fx:shake', { strength: 0.3 });
      events.emit('fx:hitstop', { durationSec: 0.1 });
      if (this.state === 'defend') this.setState('idle');
    }
    if (this.armour.state === 'broken') this.endCycle();

    this.emitHealth();
    return result;
  }

  /**
   * R2 stage-change logic:
   *  Stage 1 core broken → kneel (stagger), then stand up with brand-new armour.
   *  Stage 2 core broken → defeated.
   */
  private endCycle() {
    if (this.armourCycle === 1) {
      this.setState('kneel');
      events.emit('fx:shake', { strength: 0.4 });
    } else {
      this.setState('defeated');
      events.emit('boss:defeated', { bossId: 'warden' });
    }
  }

  /** Replace the old armour with a fresh set for the next stage. */
  private advanceStage() {
    this.armourCycle = 2;
    this.armour.dispose();
    this.armour = this.createArmour();
    events.emit('narrator:say', { text: SCRIPT.warden.shieldUp, speaker: 'warden', durationSec: 2 });
    events.emit('fx:onomatopoeia', {
      text: 'CLANG!',
      position: this.position.clone().setY(this.height * 0.5),
      color: '#ffc21a',
      scale: 1.4,
    });
  }

  update(dt: number) {
    this.model?.update(dt);
    if (dt <= 0) return; // Respect hitstop
    this.home ??= this.position.clone();
    this.armour.update(dt);
    this.stateTime += dt;
    this.attackCooldown -= dt;

    // Recover from the flinch
    this.meshPivot.position.y += (0 - this.meshPivot.position.y) * 10 * dt;

    // Find player
    let targetObj: Hurtbox | null = null;
    for (const t of this.scene.combat.targets('enemy')) {
      if (t.team === 'player') targetObj = t;
    }
    if (!targetObj) return;

    const toPlayer = targetObj.position.clone().sub(this.position).setY(0);
    const dist = toPlayer.length();
    const fwd = toPlayer.clone().normalize();

    switch (this.state) {
      case 'idle':
        this.velocity.multiplyScalar(0.8);
        if (this.stateTime > WARDEN.minAttackGap) this.decideNextAction(dist);
        break;

      case 'defend':
        this.velocity.multiplyScalar(0.8);
        if (this.stateTime > WARDEN.defendSec) this.setState('idle');
        break;

      case 'chargeWindup':
        this.velocity.set(0, 0, 0);
        if (this.stateTime >= WARDEN.chargeWindup) {
          this.chargeHit = false;
          this.setState('charging');
        }
        break;

      case 'charging': {
        this.velocity.copy(this.chargeDir).multiplyScalar(WARDEN.chargeSpeed);
        if (!this.chargeHit) {
          for (const h of this.scene.combat.queryArc(this.position, this.chargeDir, this.radius + 0.7, 140, 'enemy')) {
            this.chargeHit = true;
            this.scene.combat.applyHit(h, {
              amount: WARDEN.chargeDamage,
              kind: 'melee',
              element: 'none',
              heavy: true,
              team: 'enemy',
              from: this.position.clone(),
              knockback: WARDEN.chargeKnockback,
              sourceId: 'wardenCharge',
            });
          }
        }
        if (this.stateTime >= WARDEN.chargeRange / WARDEN.chargeSpeed || this.chargeHit) {
          this.velocity.multiplyScalar(0.3);
          this.setState('recover');
        }
        break;
      }

      case 'sidestep': {
        const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
        this.velocity.copy(right).multiplyScalar(WARDEN.moveSpeed * 1.5);
        if (this.stateTime > 1.2) this.setState('idle');
        break;
      }

      case 'return': {
        // Walk back to his post. He guards; he never chases.
        _v.copy(this.home).sub(this.position).setY(0);
        if (_v.length() > 0.3 && this.stateTime < 4) {
          this.velocity.copy(_v.normalize()).multiplyScalar(WARDEN.moveSpeed);
        } else {
          this.setState('defend');
        }
        break;
      }

      case 'bashWindup':
        // Facing is locked to the cone he telegraphed, so the bash lands where it was shown
        this.velocity.multiplyScalar(0.5);
        if (this.stateTime >= this.bashWindupSec) {
          this.setState('bashing');
          const hits = this.scene.combat.queryArc(this.position, this.forward, 3.5, 90, 'enemy');
          for (const h of hits) {
            this.scene.combat.applyHit(h, {
              amount: WARDEN.shieldBashDamage,
              kind: 'melee',
              element: 'none',
              heavy: true,
              team: 'enemy',
              from: this.position.clone(),
              knockback: WARDEN.shieldBashKnockback,
              sourceId: 'wardenBash',
            });
          }
        }
        break;

      case 'bashing':
        this.velocity.copy(this.forward).multiplyScalar(10 * (1 - this.stateTime / 0.3));
        if (this.stateTime > 0.3) this.setState('recover');
        break;

      case 'poundWindup':
        this.velocity.multiplyScalar(0);
        if (this.stateTime >= WARDEN.poundWindup) {
          this.setState('pounding');
          this.scene.add(new Shockwave(this.position, WARDEN.groundPoundRadius, '#ffc21a'));
          events.emit('fx:shake', { strength: 0.4 });

          // Area damage
          const hits = this.scene.combat.querySphere(this.position, WARDEN.groundPoundRadius, 'enemy');
          for (const h of hits) {
            this.scene.combat.applyHit(h, {
              amount: WARDEN.groundPoundDamage,
              kind: 'melee',
              element: 'none',
              heavy: true,
              team: 'enemy',
              from: this.position.clone(),
              knockback: WARDEN.groundPoundKnockback,
              sourceId: 'wardenPound',
            });
          }
        }
        break;

      case 'pounding':
        if (this.stateTime > 0.5) this.setState('recover');
        break;

      case 'recover':
        this.velocity.multiplyScalar(0.8);
        if (this.stateTime > 1.5) this.setState('idle');
        break;

      case 'kneel':
        this.velocity.set(0, 0, 0);
        if (this.stateTime > WARDEN.staggerSec) {
          if (this.armourCycle === 1) {
            // Stage transition: stand up with a brand-new shield
            this.advanceStage();
            this.placeholder.rotation.x = 0;
            this.model?.play(ANIM.stand, { loop: false, fade: 0.15 });
            this.setState('idle');
            this.emitHealth();
          }
          // If armourCycle === 2, he's defeated — endCycle already handled it.
        }
        break;

      case 'defeated':
        this.velocity.set(0, 0, 0);
        break;
    }

    // Face player slowly (not while kneeling, fallen, or committed to a telegraphed bash)
    if (!['kneel', 'defeated', 'bashWindup', 'bashing', 'chargeWindup', 'charging'].includes(this.state)) {
      const targetAngle = Math.atan2(fwd.x, fwd.z);
      const cur = this.object.rotation.y;
      let diff = targetAngle - cur;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.object.rotation.y = cur + diff * (1 - Math.exp(-8 * dt));
    }

    this.position.addScaledVector(this.velocity, dt);
    this.scene.collision.resolve(this.position, this.radius);
  }

  private setState(s: WardenState) {
    this.state = s;
    this.stateTime = 0;
    this.onEnter(s);
  }

  /** One-shot work for each state: pose, telegraph, lines. */
  private onEnter(s: WardenState, poseOnly = false) {
    const m = this.model;
    switch (s) {
      case 'idle':
      case 'recover':
        m?.play(ANIM.idle);
        break;
      case 'defend':
        m?.play(ANIM.defend);
        break;
      case 'sidestep':
      case 'return':
        m?.play(ANIM.walk);
        break;
      case 'bashWindup': {
        m?.play(ANIM.bashWindup, { loop: false, fade: 0.1 });
        if (!poseOnly) {
          // R2 Task 3: use the live forward direction for the telegraph yaw
          const dir = this.forward;
          this.scene.add(new Telegraph({
            shape: 'cone',
            at: this.position.clone(),
            radius: 3.5,
            yaw: Math.atan2(dir.x, dir.z),
            arcDeg: 90,
            durationSec: this.bashWindupSec,
            color: '#ffc21a',
          }));
        }
      }
        break;
      case 'bashing':
        m?.play(ANIM.bash, { loop: false, restart: true, fade: 0.05 });
        this.bashWindupSec = WARDEN.bashWindup;
        break;
      case 'chargeWindup': {
        m?.play(ANIM.bashWindup, { loop: false, fade: 0.1 });
        if (!poseOnly) {
          const target = this.findPlayer();
          if (target) this.chargeDir.copy(target.position).sub(this.position).setY(0).normalize();
          else this.chargeDir.copy(this.forward);
          this.object.rotation.y = Math.atan2(this.chargeDir.x, this.chargeDir.z);
          this.scene.add(new Telegraph({
            shape: 'line',
            at: this.position.clone(),
            length: WARDEN.chargeRange,
            width: WARDEN.chargeWidth,
            yaw: this.object.rotation.y,
            durationSec: WARDEN.chargeWindup,
            color: '#ffc21a',
          }));
        }
        break;
      }
      case 'charging':
        m?.play(ANIM.walk, { timeScale: 2.5 });
        events.emit('fx:onomatopoeia', { text: 'CHARGE!', position: this.position.clone().setY(this.height), color: '#ffc21a' });
        break;
      case 'poundWindup':
        m?.play(ANIM.pound, { loop: false, restart: true, fade: 0.1 });
        if (!poseOnly) {
          this.scene.add(new Telegraph({
            shape: 'circle',
            at: this.position.clone(),
            radius: WARDEN.groundPoundRadius,
            durationSec: WARDEN.poundWindup,
            color: '#ffc21a',
          }));
        }
        break;
      case 'kneel':
        if (m) m.play(ANIM.kneel, { loop: false, fade: 0.15 });
        else this.placeholder.rotation.x = Math.PI / 4; // lean forward
        if (!poseOnly) {
          events.emit('narrator:say', { text: SCRIPT.warden.kneel, speaker: 'narrator', durationSec: 3 });
        }
        break;
      case 'defeated':
        if (m) m.play(ANIM.death, { loop: false, fade: 0.2 });
        else this.placeholder.rotation.x = Math.PI / 2; // fall over
        break;
    }
  }

  private findPlayer(): Hurtbox | null {
    for (const t of this.scene.combat.targets('enemy')) if (t.team === 'player') return t;
    return null;
  }

  private decideNextAction(dist: number) {
    if (this.attackCooldown <= 0) {
      // Close: bash or pound. Kept at a distance: he charges you down.
      const next: WardenState =
        dist < 4.5 ? (Math.random() < 0.6 ? 'bashWindup' : 'poundWindup') : dist < WARDEN.chargeRange + 1.5 ? 'chargeWindup' : 'defend';
      if (next !== 'defend') {
        this.attackCooldown = WARDEN.attackCooldown * (this.armourCycle === 2 ? WARDEN.stage2CooldownMul : 1);
        this.setState(next);
        return;
      }
    }

    const fromHome = this.home ? this.position.distanceTo(this.home) : 0;
    const r2 = Math.random();
    if (fromHome > WARDEN.homeLeash) {
      this.setState('return');
    } else if (r2 < WARDEN.shieldChance) {
      this.setState('defend');
    } else if (r2 < WARDEN.shieldChance + 0.3) {
      this.setState('sidestep');
    } else {
      this.setState('defend');
    }

    // Clue dialogue
    if (Math.random() < 0.08) {
      events.emit('narrator:say', { text: SCRIPT.warden.clue, speaker: 'warden', durationSec: 3 });
    }
  }

  private emitHealth() {
    events.emit('boss:health', { bossId: 'warden', name: 'THE WARDEN', hp: this.hp, max: this.maxHp, phase: this.armourCycle });
  }

  /** Called by the scene's flow:skip handler to instantly end the fight. */
  forceDefeat() {
    if (this.state === 'defeated') return;
    this.armour.dispose();
    this.armourCycle = 3; // forces HP to 0
    this.setState('defeated');
    // Emulate the core shattering for the death effects
    events.emit('fx:shake', { strength: 0.4 });
    events.emit('fx:onomatopoeia', { text: 'SHATTER!', position: this.position.clone().setY(this.position.y + 0.8), color: '#ffaa33', scale: 1.5 });
    this.emitHealth();
    // Do NOT emit boss:defeated — the scene already handles the transition.
  }

  onRemoved() {
    disposeBossVisuals(this.object);
  }
}
