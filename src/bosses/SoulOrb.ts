import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import type { Hit, HitResult, Hurtbox } from '@/combat/types';
import { toonMaterial } from '@/render/toon';
import { souls } from './souls';
import { events } from '@/core/events';

export class SoulOrb extends Entity implements Hurtbox {
  readonly team = 'enemy' as const;
  id: string;
  radius = 0.5;
  height = 1;
  mass = 0; // Does not push
  hp = 40;
  
  private material: THREE.MeshBasicMaterial;
  private angleOffset: number;
  private orbitRadius: number;
  private speed: number;
  private t = 0;
  
  constructor(public boss: Entity, index: number, total: number) {
    super();
    this.id = `soulOrb_${index}`;
    this.angleOffset = (index / total) * Math.PI * 2;
    this.orbitRadius = 3.5;
    this.speed = 1.5;
    
    // Violet glow
    this.material = new THREE.MeshBasicMaterial({ 
      color: new THREE.Color('#9b6bff').multiplyScalar(3),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(this.radius, 16, 12), this.material);
    mesh.position.y = 1.5;
    
    // A cage/frame around it
    const frameGeo = new THREE.IcosahedronGeometry(this.radius * 1.3, 0);
    const frameMat = new THREE.MeshBasicMaterial({ color: '#ffc21a', wireframe: true });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 1.5;
    
    this.object.add(mesh, frame);
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  onAdded() {
    this.own(this.scene.combat.register(this));
    this.update(0);
  }

  receiveHit(hit: Hit): HitResult {
    if (!this.alive) return 'immune';
    
    this.hp -= hit.amount;
    this.object.scale.setScalar(0.7); // Flinch
    
    events.emit('fx:shake', { strength: 0.1 });
    
    if (this.hp <= 0) {
      // Free the soul!
      souls.addCharge();
      events.emit('fx:onomatopoeia', { text: 'FREE!', position: this.position.clone(), color: '#c9b2ff' });
      this.scene.cameraRig.addShake(0.3);
      this.destroy();
      return 'killed';
    }
    
    return 'damaged';
  }

  update(dt: number) {
    if (dt <= 0) return;
    this.t += dt;
    this.object.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 8);
    
    // If boss is gone, die
    if (!this.boss || !this.boss.scene) {
      this.destroy();
      return;
    }
    
    // Orbit boss
    const angle = this.t * this.speed + this.angleOffset;
    const x = this.boss.position.x + Math.cos(angle) * this.orbitRadius;
    const z = this.boss.position.z + Math.sin(angle) * this.orbitRadius;
    const y = Math.sin(this.t * 2 + this.angleOffset) * 0.5;
    
    this.object.position.set(x, this.boss.position.y + y, z);
  }

  onRemoved() {
    this.material.dispose();
    this.object.traverse(o => {
      if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
      if ((o as THREE.Mesh).material && (o as THREE.Mesh).material !== this.material) {
        ((o as THREE.Mesh).material as THREE.Material).dispose();
      }
    });
  }
}
