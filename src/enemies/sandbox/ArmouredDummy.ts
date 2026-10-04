import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import type { Hit, HitResult, Hurtbox } from '@/combat/types';
import { toonMaterial, addOutline } from '@/render/toon';
import { CharacterModel } from '@/render/CharacterModel';
import { Armour, type ArmourConfig } from '../armour/Armour';

let dummyCount = 0;

/**
 * An armoured test dummy for verifying the shell/core armour loop.
 * Like TrainingDummy but wrapped in Armour. Doesn't move or attack.
 * Respawns after death so you can test repeatedly.
 */
export class ArmouredDummy extends Entity implements Hurtbox {
  readonly team = 'enemy' as const;
  readonly id: string;
  radius = 0.6;
  height = 2.0;
  mass = 50;

  hp: number;
  readonly maxHp: number;
  private armour: Armour;
  private model: CharacterModel;
  private body = new THREE.Group();
  private wobble = new THREE.Vector2();
  private wobbleVel = new THREE.Vector2();
  private deadFor = -1;
  private respawnSec: number;

  constructor(opts: { hp?: number; armour?: Partial<ArmourConfig>; respawnSec?: number } = {}) {
    super();
    this.id = `armoured_dummy${dummyCount++}`;
    this.maxHp = this.hp = opts.hp ?? 60;
    this.respawnSec = opts.respawnSec ?? 3;

    // Build the dummy body
    const bodyMat = toonMaterial({ color: '#8866bb' });
    const plateMat = toonMaterial({ color: '#aa88dd' });
    const baseMat = toonMaterial({ color: '#5a3a88' });

    // Base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.18, 16), baseMat);
    base.position.y = 0.09;
    base.castShadow = base.receiveShadow = true;
    addOutline(base, 3);
    this.object.add(base); // attached to object, not body, so base stays still

    // Post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8), baseMat);
    post.position.y = 0.6;
    addOutline(post, 2);
    this.body.add(post);

    // Body
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.5, 6, 12), bodyMat);
    torso.position.y = 1.3;
    torso.castShadow = torso.receiveShadow = true;
    addOutline(torso, 3);
    this.body.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), bodyMat);
    head.position.y = 1.85;
    head.castShadow = true;
    addOutline(head, 2);
    this.body.add(head);

    // Target circle on the torso
    const target = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.04, 6, 16),
      toonMaterial({ color: '#ff4444', emissive: '#ff4444', emissiveIntensity: 0.5 }),
    );
    target.position.set(0, 1.3, 0.38);
    addOutline(target, 2);
    this.body.add(target);

    // Arms (sticking out)
    const armMat = toonMaterial({ color: '#7755aa' });
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), armMat);
      arm.position.set(side * 0.45, 1.3, 0);
      arm.rotation.z = Math.PI / 2;
      arm.castShadow = true;
      addOutline(arm, 2);
      this.body.add(arm);
    }

    this.model = CharacterModel.fromObject(this.body);
    this.object.add(this.model.root);

    // ── Armour ───────────────────────────────────────────────────────────
    const armourCfg: ArmourConfig = {
      shellHp: opts.armour?.shellHp ?? 40,
      coreHp: opts.armour?.coreHp ?? 25,
      coreWindowSec: opts.armour?.coreWindowSec ?? 4,
      element: opts.armour?.element ?? 'violet',
      size: opts.armour?.size ?? 0.8,
    };
    this.armour = new Armour(this.id, armourCfg);
    this.object.add(this.armour.visual);
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  onAdded(): void {
    this.own(this.scene.combat.register(this));
  }

  receiveHit(hit: Hit): HitResult {
    if (!this.alive) return 'immune';

    // Route through armour first
    const at = this.position.clone().setY(this.position.y + this.height * 0.6);
    const armourResult = this.armour.handleHit(hit, at);
    if (armourResult !== null) {
      // Wobble feedback
      const dir = new THREE.Vector3().subVectors(this.position, hit.from).setY(0).normalize();
      this.wobbleVel.x += dir.z * hit.knockback * 0.6;
      this.wobbleVel.y -= dir.x * hit.knockback * 0.6;
      return armourResult;
    }

    // Armour is broken — take damage normally
    this.hp = Math.max(0, this.hp - hit.amount);
    this.model.flash('#ffffff', 0.12);

    const dir = new THREE.Vector3().subVectors(this.position, hit.from).setY(0).normalize();
    this.wobbleVel.x += dir.z * hit.knockback * 0.9;
    this.wobbleVel.y -= dir.x * hit.knockback * 0.9;

    if (this.hp <= 0) {
      this.deadFor = 0;
      events.emit('enemy:killed', { enemyType: 'armouredDummy', position: this.position.clone(), wisp: true });
      return 'killed';
    }
    return 'damaged';
  }

  update(dt: number): void {
    this.model.update(dt);
    this.armour.update(dt);
    if (dt <= 0) return;

    // Spring wobble
    this.wobbleVel.addScaledVector(this.wobble, -90 * dt);
    this.wobbleVel.multiplyScalar(Math.exp(-6 * dt));
    this.wobble.addScaledVector(this.wobbleVel, dt);
    this.body.rotation.set(this.wobble.x * 0.12, 0, this.wobble.y * 0.12);

    // Death & respawn
    if (this.deadFor >= 0) {
      this.deadFor += dt;
      this.body.scale.setScalar(Math.max(0.001, 1 - this.deadFor * 3));
      if (this.deadFor > this.respawnSec) {
        this.deadFor = -1;
        this.hp = this.maxHp;
        this.body.scale.setScalar(1);
        this.armour.reset();
      }
    }
  }
}
