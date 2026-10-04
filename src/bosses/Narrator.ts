import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import { NARRATOR_BOSS } from './config';
import { ArmourStub } from './stubs';
import { toonMaterial, addOutline } from '@/render/toon';
import type { Hit, HitResult, Hurtbox } from '@/combat/types';
import { isPositiveResult } from '@/combat/types';
import { Projectile } from '@/combat/Projectile';
import { Shockwave } from '@/vfx/Shockwave';
import { SoulOrb } from './SoulOrb';

export class NarratorBoss extends Entity implements Hurtbox {
  readonly team = 'enemy' as const;
  readonly id = 'narrator';
  radius = 0.8;
  height = 3.5;
  mass = 10;
  
  hp = NARRATOR_BOSS.maxHp;
  maxHp = NARRATOR_BOSS.maxHp;
  phase = 1;
  
  private armour = new ArmourStub(120, 100);
  private meshPivot = new THREE.Group();
  private attackTimer = 3;
  private t = 0;
  private velocity = new THREE.Vector3();
  private head: THREE.Mesh;
  
  constructor() {
    super();
    // Tall figure made of golden paper/boxes
    const bodyMat = toonMaterial({ color: '#ffe666' });
    const headMat = toonMaterial({ color: '#ffffff' });
    
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 3, 16), bodyMat);
    body.position.y = 1.5;
    addOutline(body, 3);
    
    this.head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1), headMat);
    this.head.position.y = 3.6;
    addOutline(this.head, 4);
    
    this.meshPivot.add(body, this.head);
    this.object.add(this.meshPivot);
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  onAdded() {
    this.own(this.scene.combat.register(this));
    this.emitHealth();
  }

  receiveHit(hit: Hit): HitResult {
    if (!this.alive) return 'immune';
    
    if (this.phase === 2) {
       // Direct damage in phase 2
       this.hp = Math.max(0, this.hp - hit.amount);
    } else {
       const result = this.armour.receiveHit(hit);
       if (isPositiveResult(result) || result === 'shellBroken' || result === 'coreHit') {
         this.hp = Math.max(0, this.hp - hit.amount);
         if (result === 'shellBroken') {
           events.emit('fx:shake', { strength: 0.3 });
           events.emit('armour:shellBroken', { position: this.position.clone(), ownerId: this.id });
         }
       }
    }
    
    this.meshPivot.position.y = -0.2; // Flinch
    
    if (this.phase === 1 && this.hp <= this.maxHp * NARRATOR_BOSS.phase2HpThreshold) {
      this.enterPhase2();
    }
    
    if (this.hp <= 0) {
      events.emit('boss:defeated', { bossId: 'narrator' });
    }
    
    this.emitHealth();
    return 'damaged';
  }

  update(dt: number) {
    if (dt <= 0 || !this.alive) return;
    this.t += dt;
    this.attackTimer -= dt;
    
    this.meshPivot.position.y += (0 - this.meshPivot.position.y) * 10 * dt;
    this.meshPivot.position.y += Math.sin(this.t * 2) * 0.1; // Bobbing
    if (this.head) {
      if (this.phase === 1) {
        this.head.position.y = 3.6 + Math.sin(this.t * 4) * 0.15;
      } else {
        // Ferocious erratic movement for phase 2
        this.head.position.y = 3.8 + Math.sin(this.t * 15) * 0.4;
        this.head.rotation.x = Math.sin(this.t * 10) * 0.3;
        this.head.rotation.z = Math.cos(this.t * 12) * 0.3;
        this.meshPivot.position.y += Math.sin(this.t * 20) * 0.15;
        this.meshPivot.rotation.z = Math.sin(this.t * 8) * 0.1;
      }
    }
    
    let targetObj: Hurtbox | null = null;
    for (const t of this.scene.combat.targets('enemy')) {
      if (t.team === 'player') targetObj = t;
    }
    if (!targetObj) return;

    const toPlayer = targetObj.position.clone().sub(this.position).setY(0);
    const dist = toPlayer.length();
    const fwd = toPlayer.clone().normalize();
    
    // Face player
    const targetAngle = Math.atan2(fwd.x, fwd.z);
    const cur = this.object.rotation.y;
    let diff = targetAngle - cur;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.object.rotation.y = cur + diff * dt * 5;
    
    if (this.phase === 1) {
      this.velocity.lerp(new THREE.Vector3(), dt);
      if (this.attackTimer <= 0) {
        this.attackTimer = 2.5 + Math.random();
        this.fireGoldFan(fwd);
      }
    } else {
      if (dist < 5) {
        this.velocity.lerp(fwd.clone().multiplyScalar(-4), dt * 3);
        if (this.attackTimer <= 0) {
          this.attackTimer = 2;
          this.fireGoldBurst();
        }
      } else {
        this.velocity.lerp(new THREE.Vector3(), dt * 2);
        if (this.attackTimer <= 0) {
          this.attackTimer = 1.5;
          this.fireGoldFan(fwd);
        }
      }
    }
    
    this.position.addScaledVector(this.velocity, dt);
    this.scene.collision.resolve(this.position, this.radius);
  }

  private fireGoldFan(dir: THREE.Vector3) {
    events.emit('fx:onomatopoeia', { text: 'PEW', position: this.position.clone().add(new THREE.Vector3(0, 3, 0)) });
    const count = this.phase === 1 ? 3 : 5;
    for (let i = 0; i < count; i++) {
      const angle = (i - Math.floor(count / 2)) * 0.25;
      const vel = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).multiplyScalar(18);
      const from = this.position.clone().setY(2);
      const proj = new Projectile({
        team: 'enemy',
        element: 'gold',
        damage: 15,
        speed: 18,
        radius: 0.4,
        color: '#ffc21a',
        sourceId: this.id,
        from,
        dir: vel.clone().normalize()
      });
      this.scene.add(proj);
    }
  }

  private fireGoldBurst() {
    this.scene.add(new Shockwave(this.position, 6, '#ffc21a'));
    events.emit('fx:shake', { strength: 0.5 });
    events.emit('fx:onomatopoeia', { text: 'BAM', position: this.position.clone(), scale: 2 });
    
    const hits = this.scene.combat.querySphere(this.position, 6, 'enemy');
    for (const h of hits) {
      this.scene.combat.applyHit(h, {
        amount: 25,
        kind: 'energy',
        element: 'gold',
        heavy: true,
        team: 'enemy',
        from: this.position.clone(),
        knockback: 12,
        sourceId: 'narratorBurst'
      });
    }
  }

  private enterPhase2() {
    this.phase = 2;
    events.emit('story:beat', { id: 'final:phase2' });
    events.emit('narrator:say', { text: "Blasphemy! I am the architect of this reality! You cannot unwrite your creator!", speaker: 'narrator', durationSec: 4 });
    events.emit('fx:shake', { strength: 0.8 });
    this.scene.cameraRig.addShake(0.8);
    
    const orbCount = 6;
    for (let i = 0; i < orbCount; i++) {
      this.scene.add(new SoulOrb(this, i, orbCount));
    }
    
    this.attackTimer = 1.5;
  }

  private emitHealth() {
    events.emit('boss:health', { bossId: 'narrator', name: 'THE NARRATOR', hp: this.hp, max: this.maxHp, phase: this.phase });
  }
}
