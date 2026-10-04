import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import { Projectile } from '@/combat/Projectile';
import type { Hit, HitResult, Hurtbox } from '@/combat/types';
import { addOutline, toonMaterial } from '@/render/toon';
import { CharacterModel } from '@/render/CharacterModel';

export interface DummyOptions {
  hp?: number;
  /** Fires slow bolts at the player (for testing dodge / getting hurt). */
  shoots?: boolean;
  respawnSec?: number;
}

/**
 * A test target. Also the simplest complete example of an enemy:
 * Entity + Hurtbox, registers with combat, reacts to hits, emits enemy:killed.
 * (Enemies owner: copy this pattern for Grunts/Brutes, but don't edit this file.)
 */
export class TrainingDummy extends Entity implements Hurtbox {
  readonly team = 'enemy' as const;
  readonly id: string;
  radius = 0.55;
  height = 1.9;
  mass = 50;
  hp: number;
  readonly maxHp: number;
  private model: CharacterModel;
  private body = new THREE.Group();
  private wobble = new THREE.Vector2();
  private wobbleVel = new THREE.Vector2();
  private deadFor = -1;
  private shootTimer = 2;
  private static count = 0;

  constructor(private opts: DummyOptions = {}) {
    super();
    this.id = `dummy${TrainingDummy.count++}`;
    this.maxHp = this.hp = opts.hp ?? 80;

    const wood = toonMaterial({ color: '#c58a4b' });
    const cloth = toonMaterial({ color: opts.shoots ? '#7d5cff' : '#e8d3a8' });
    const red = toonMaterial({ color: '#d8432f' });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number, parent: THREE.Object3D = this.body) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
      m.castShadow = m.receiveShadow = true;
      addOutline(m, 3);
      parent.add(m);
      return m;
    };
    add(new THREE.CylinderGeometry(0.55, 0.65, 0.18, 20), wood, 0.09, this.object);
    add(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 10), wood, 0.65);
    add(new THREE.CapsuleGeometry(0.42, 0.55, 6, 16), cloth, 1.25);
    const ring = add(new THREE.TorusGeometry(0.3, 0.05, 8, 24), red, 1.3);
    ring.position.z = 0.4;
    add(new THREE.SphereGeometry(0.28, 16, 12), cloth, 1.95);
    const arm = add(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 8), wood, 1.45);
    arm.rotation.z = Math.PI / 2;
    this.model = CharacterModel.fromObject(this.body);
    this.object.add(this.model.root);
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  onAdded() {
    this.own(this.scene.combat.register(this));
  }

  receiveHit(hit: Hit): HitResult {
    if (!this.alive) return 'immune';
    this.hp = Math.max(0, this.hp - hit.amount);
    this.model.flash('#ffffff', 0.1);
    const dir = new THREE.Vector3().subVectors(this.position, hit.from).setY(0).normalize();
    this.wobbleVel.x += dir.z * hit.knockback * 0.9;
    this.wobbleVel.y -= dir.x * hit.knockback * 0.9;
    if (this.hp <= 0) {
      this.deadFor = 0;
      events.emit('enemy:killed', { enemyType: 'dummy', position: this.position.clone(), wisp: true });
      return 'killed';
    }
    return 'damaged';
  }

  update(dt: number) {
    this.model.update(dt);
    if (dt <= 0) return;
    // spring wobble
    this.wobbleVel.addScaledVector(this.wobble, -90 * dt);
    this.wobbleVel.multiplyScalar(Math.exp(-6 * dt));
    this.wobble.addScaledVector(this.wobbleVel, dt);
    this.body.rotation.set(this.wobble.x * 0.12, 0, this.wobble.y * 0.12);

    if (this.deadFor >= 0) {
      this.deadFor += dt;
      this.body.scale.setScalar(Math.max(0.001, 1 - this.deadFor * 4));
      if (this.deadFor > (this.opts.respawnSec ?? 2.5)) {
        this.deadFor = -1;
        this.hp = this.maxHp;
        this.body.scale.setScalar(1);
      }
      return;
    }

    if (this.opts.shoots) {
      this.shootTimer -= dt;
      const player = this.scene.combat.querySphere(this.position, 14, 'enemy').find((h) => h.team === 'player');
      if (player && this.shootTimer <= 0) {
        this.shootTimer = 2.2;
        const from = this.position.clone().setY(1.3);
        const dir = player.position.clone().setY(1.3).sub(from).normalize();
        this.scene.add(new Projectile({ team: 'enemy', from, dir, speed: 9, damage: 10, element: 'violet', radius: 0.4, lifetime: 3 }));
      }
    }
  }
}
