import * as THREE from 'three';
import type { Hit, HitResult } from '@/combat/types';
import { Entity } from '@/core/Entity';

/**
 * Temporary stub for Armour since Enemies person hasn't merged yet.
 * Delete this and use the real Armour from src/enemies/ when it's ready.
 */
export class ArmourStub {
  shellHp: number;
  coreHp: number;
  exposed = false;

  constructor(shellHp: number, coreHp: number) {
    this.shellHp = shellHp;
    this.coreHp = coreHp;
  }

  receiveHit(hit: Hit): HitResult {
    if (!this.exposed) {
      if (hit.kind === 'melee' && hit.heavy) {
        this.shellHp -= hit.amount;
        if (this.shellHp <= 0) {
          this.exposed = true;
          return 'shellBroken';
        }
        return 'shellHit';
      }
      return 'deflected';
    } else {
      if (hit.kind === 'energy') {
        this.coreHp -= hit.amount;
        if (this.coreHp <= 0) return 'killed';
        return 'coreHit';
      }
      return 'deflected';
    }
  }

  reset(shellHp: number, coreHp: number) {
    this.shellHp = shellHp;
    this.coreHp = coreHp;
    this.exposed = false;
  }
}

/**
 * Temporary stub for Telegraph since Enemies person hasn't merged yet.
 */
export class TelegraphStub extends Entity {
  private age = 0;
  private material: THREE.MeshBasicMaterial;

  constructor(position: THREE.Vector3, private radius: number, private duration: number) {
    super();
    this.object.position.copy(position);
    this.object.position.y = 0.05; // Slightly above ground
    
    const geo = new THREE.RingGeometry(0, radius, 32);
    geo.rotateX(-Math.PI / 2); // Flat on ground
    
    this.material = new THREE.MeshBasicMaterial({ 
      color: 0xff0000, 
      transparent: true, 
      opacity: 0.3,
      depthWrite: false 
    });
    
    this.object.add(new THREE.Mesh(geo, this.material));
  }

  update(dt: number) {
    this.age += dt;
    const t = this.age / this.duration;
    
    this.material.opacity = 0.2 + (t * 0.4); // Pulse
    
    if (this.age >= this.duration) {
      this.destroy();
    }
  }

  onRemoved() {
    this.material.dispose();
    this.object.traverse(o => {
      if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
    });
  }
}
