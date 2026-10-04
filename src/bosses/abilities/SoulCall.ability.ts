import * as THREE from 'three';
import { Ability, defineAbility, type AbilityContext } from '@/player/abilities/Ability';
import { Entity } from '@/core/Entity';
import { souls } from '../souls';
import type { Hurtbox } from '@/combat/types';
import { events } from '@/core/events';

class SoulSpirit extends Entity {
  private age = 0;
  private readonly maxAge = 3;
  private target: Hurtbox | null = null;
  private velocity = new THREE.Vector3();
  private material: THREE.MeshBasicMaterial;

  constructor(from: THREE.Vector3, private sourceId: string) {
    super();
    this.object.position.copy(from);
    
    this.material = new THREE.MeshBasicMaterial({ 
      color: new THREE.Color('#e0c8ff').multiplyScalar(3.5),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), this.material);
    head.position.y = 1;
    
    const trail = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.8, 8, 1, true), this.material);
    trail.rotation.x = -Math.PI / 2;
    trail.position.set(0, 1, -0.9);
    
    this.object.add(head, trail);
  }

  onAdded() {
    let closest: Hurtbox | null = null;
    let minD = Infinity;
    for (const h of this.scene.combat.targets('player')) {
      const d = h.position.distanceToSquared(this.position);
      if (d < minD) {
        minD = d;
        closest = h;
      }
    }
    this.target = closest;
    if (!this.target) this.velocity.set(0, 0, -1).multiplyScalar(15);
  }

  update(dt: number) {
    this.age += dt;
    if (this.age > this.maxAge) {
      this.destroy();
      return;
    }
    
    if (this.target && !this.target.alive) {
      this.target = null; // Lose track and fly straight
    }
    
    if (this.target) {
      const toTarget = this.target.position.clone().setY(0).sub(this.position.clone().setY(0));
      const dist = toTarget.length();
      
      if (dist < 1.2) {
        this.scene.combat.applyHit(this.target, {
          amount: 45,
          kind: 'energy',
          element: 'violet',
          heavy: false,
          team: 'player',
          from: this.position.clone(),
          knockback: 6,
          sourceId: this.sourceId
        });
        
        events.emit('fx:onomatopoeia', { text: 'WHOOSH!', position: this.target.position, color: '#e0c8ff', scale: 1.2 });
        this.scene.cameraRig.addShake(0.2);
        this.destroy();
        return;
      }
      
      toTarget.normalize().multiplyScalar(22);
      this.velocity.lerp(toTarget, dt * 6);
    }
    
    this.object.position.addScaledVector(this.velocity, dt);
    
    if (this.velocity.lengthSq() > 0.1) {
      this.object.lookAt(this.position.clone().add(this.velocity));
    }
  }

  onRemoved() {
    this.material.dispose();
    this.object.traverse(o => {
      if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
    });
  }
}

export class SoulCall extends Ability {
  readonly id = 'soulCall';
  readonly name = 'Soul Call';
  readonly description = 'Spend a freed soul charge to summon a violet spirit that seeks and strikes enemies.';
  readonly cost = 0;
  readonly cooldown = 1.0;
  readonly castTime = 0.25;
  readonly element = 'violet' as const;
  readonly color = '#e0c8ff';
  readonly glyph = '👻';

  canCast(player: any): boolean {
    return super.canCast(player) && souls.charges > 0;
  }

  cast(ctx: AbilityContext) {
    if (!souls.spendCharge()) return;
    const from = ctx.player.position.clone().addScaledVector(ctx.aimDir, 0.5);
    events.emit('fx:onomatopoeia', { text: 'PHEW~', position: from.clone().add(new THREE.Vector3(0, 2, 0)), color: '#e0c8ff' });
    ctx.scene.add(new SoulSpirit(from, this.id));
  }
}

export default defineAbility({ id: 'soulCall', create: () => new SoulCall() });
