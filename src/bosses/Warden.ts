import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import { WARDEN } from './config';
import { ArmourStub, TelegraphStub } from './stubs';
import { toonMaterial, addOutline } from '@/render/toon';
import type { Hit, HitResult, Hurtbox } from '@/combat/types';
import { isPositiveResult } from '@/combat/types';
import { Shockwave } from '@/vfx/Shockwave';

export class Warden extends Entity implements Hurtbox {
  readonly team = 'enemy' as const;
  readonly id = 'warden';
  radius = WARDEN.radius;
  height = WARDEN.height;
  mass = WARDEN.mass;
  
  hp = WARDEN.maxHp;
  readonly maxHp = WARDEN.maxHp;
  
  state: 'idle' | 'defend' | 'sidestep' | 'approach' | 'bashWindup' | 'bashing' | 'poundWindup' | 'pounding' | 'recover' | 'kneel' | 'defeated' = 'idle';
  stateTime = 0;
  armourCycle = 1;
  
  private armour = new ArmourStub(WARDEN.armourShellHp, WARDEN.armourCoreHp);
  private velocity = new THREE.Vector3();
  private meshPivot = new THREE.Group();
  private shieldMesh: THREE.Mesh;
  private attackCooldown = 0;
  
  constructor() {
    super();
    // Placeholder Warden Model (swap for GLB in polish phase)
    const bodyMat = toonMaterial({ color: '#c5b599' }); // gold-inlaid armor
    const coreMat = toonMaterial({ color: '#ffc21a' }); 
    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 2.4, 16), bodyMat);
    bodyMesh.position.y = 1.2;
    addOutline(bodyMesh, 4);
    
    // Core (exposed when shell breaks)
    const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), coreMat);
    coreMesh.position.y = 1.4;
    coreMesh.position.z = 0.6;
    
    // Defensive shield
    const shieldMat = toonMaterial({ color: '#d4c7b0' });
    this.shieldMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 16), shieldMat);
    this.shieldMesh.rotation.x = Math.PI / 2;
    this.shieldMesh.position.set(0, 1.2, 0.9);
    addOutline(this.shieldMesh, 4);
    
    this.meshPivot.add(bodyMesh, coreMesh, this.shieldMesh);
    this.object.add(this.meshPivot);
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
    
    // Clue: Warden lowers guard when player is hurt
    this.own(events.on('player:health', ({ hp, max }) => {
      if (hp / max < 0.3 && Math.random() < 0.6 && this.state === 'defend') {
        this.setState('idle');
      }
    }));
  }

  receiveHit(hit: Hit): HitResult {
    if (!this.alive || this.state === 'kneel') return 'immune';
    
    // Shield blocks frontal attacks when defending
    if (this.state === 'defend') {
      const toHit = hit.from.clone().sub(this.position).setY(0).normalize();
      if (toHit.dot(this.forward) > 0.3) {
        return 'blocked';
      }
    }
    
    const result = this.armour.receiveHit(hit);
    
    if (isPositiveResult(result) || result === 'shellBroken' || result === 'coreHit') {
      this.hp = Math.max(0, this.hp - hit.amount);
      this.meshPivot.position.y = -0.1; // Flinch
      
      if (result === 'shellBroken') {
        this.shieldMesh.visible = false;
        events.emit('fx:shake', { strength: 0.3 });
        events.emit('fx:hitstop', { durationSec: 0.1 });
        events.emit('armour:shellBroken', { position: this.position.clone(), ownerId: this.id });
      }
      
      if (result === 'killed' || this.hp <= 0) {
        if (this.armourCycle === 1) {
          this.setState('kneel');
          events.emit('fx:shake', { strength: 0.4 });
        } else {
          this.setState('defeated');
          events.emit('boss:defeated', { bossId: 'warden' });
        }
      }
      
      this.emitHealth();
    }
    return result;
  }

  update(dt: number) {
    if (dt <= 0) return; // Respect hitstop
    this.stateTime += dt;
    this.attackCooldown -= dt;
    
    // Reset flinch
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
        if (this.stateTime > 1.2) this.decideNextAction(dist);
        break;
        
      case 'defend':
        this.shieldMesh.position.y = 1.2;
        this.velocity.multiplyScalar(0.8);
        if (this.stateTime > 2.5) this.setState('idle');
        break;
        
      case 'sidestep':
        const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
        this.velocity.copy(right).multiplyScalar(WARDEN.moveSpeed * 1.5);
        if (this.stateTime > 1.2) this.setState('idle');
        break;
        
      case 'approach':
        if (dist > WARDEN.retreatDist) {
          this.velocity.copy(fwd).multiplyScalar(WARDEN.moveSpeed);
        } else {
          this.setState('idle');
        }
        break;
        
      case 'bashWindup':
        this.velocity.multiplyScalar(0.5);
        if (this.stateTime >= WARDEN.bashWindup) {
          this.setState('bashing');
          // Deal damage in an arc
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
              sourceId: 'wardenBash'
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
              sourceId: 'wardenPound'
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
        this.velocity.multiplyScalar(0);
        this.meshPivot.rotation.x = Math.PI / 4; // Lean forward
        if (this.stateTime > 4) {
          // Enter Cycle 2
          this.armourCycle = 2;
          this.armour.reset(WARDEN.armourShellHp, WARDEN.armourCoreHp);
          this.shieldMesh.visible = true;
          this.meshPivot.rotation.x = 0;
          this.setState('idle');
          this.emitHealth();
        } else if (this.stateTime === dt) {
          // Triggered on first frame of kneel
          events.emit('narrator:say', { text: "Finish it! Break his chains!", speaker: 'narrator', durationSec: 3 });
        }
        break;
        
      case 'defeated':
        this.velocity.multiplyScalar(0);
        this.meshPivot.rotation.x = Math.PI / 2; // Fall over
        break;
    }
    
    // Face player slowly
    if (this.state !== 'kneel' && this.state !== 'defeated' && this.state !== 'bashing') {
      const targetAngle = Math.atan2(fwd.x, fwd.z);
      const cur = this.object.rotation.y;
      let diff = targetAngle - cur;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.object.rotation.y = cur + diff * (1 - Math.exp(-8 * dt));
    }
    
    this.position.addScaledVector(this.velocity, dt);
    this.scene.collision.resolve(this.position, this.radius);
  }

  private setState(s: any) {
    this.state = s;
    this.stateTime = 0;
  }

  private decideNextAction(dist: number) {
    if (this.attackCooldown <= 0) {
      const r = Math.random();
      if (r < WARDEN.poundChance) {
        this.setState('poundWindup');
        this.attackCooldown = WARDEN.attackCooldown;
        this.scene.add(new TelegraphStub(this.position.clone(), WARDEN.groundPoundRadius, WARDEN.poundWindup));
        return;
      } else if (r < WARDEN.poundChance + WARDEN.bashChance && dist < 5) {
        this.setState('bashWindup');
        this.attackCooldown = WARDEN.attackCooldown;
        const targetPos = this.position.clone().addScaledVector(this.forward, 2);
        this.scene.add(new TelegraphStub(targetPos, 1.5, WARDEN.bashWindup));
        return;
      }
    }
    
    const r2 = Math.random();
    if (r2 < WARDEN.shieldChance) {
      this.setState('defend');
    } else if (r2 < WARDEN.shieldChance + 0.3) {
      this.setState('sidestep');
    } else if (dist > WARDEN.retreatDist) {
      this.setState('approach');
    } else {
      this.setState('defend');
    }
    
    // Clue dialogue
    if (Math.random() < 0.08) {
      events.emit('narrator:say', { text: "…you don't know what you're feeding.", speaker: 'warden', durationSec: 3 });
    }
  }

  private emitHealth() {
    events.emit('boss:health', { bossId: 'warden', name: 'THE WARDEN', hp: this.hp, max: this.maxHp, phase: this.armourCycle });
  }
}
