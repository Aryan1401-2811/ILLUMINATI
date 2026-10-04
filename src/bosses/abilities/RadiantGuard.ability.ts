import * as THREE from 'three';
import { Ability, defineAbility, type AbilityContext } from '@/player/abilities/Ability';
import type { Hit, HitResult } from '@/combat/types';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';

class WardVisual extends Entity {
  private material: THREE.MeshBasicMaterial;
  private t = 0;

  constructor(public target: Entity) {
    super();
    // A half-sphere shield look
    const geo = new THREE.SphereGeometry(1.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 1.6);
    const color = new THREE.Color('#c9b2ff').multiplyScalar(2.5);
    
    this.material = new THREE.MeshBasicMaterial({ 
      color, 
      transparent: true, 
      opacity: 0.4, 
      wireframe: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending 
    });
    
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.position.y = 0.2;
    this.object.add(mesh);
  }

  update(dt: number) {
    this.t += dt;
    // Follow target exactly
    this.object.position.copy(this.target.position);
    this.object.rotation.y = this.t * 3; // Spin
    this.material.opacity = 0.35 + Math.sin(this.t * 8) * 0.15;
  }

  flash() {
    this.material.opacity = 1; // Flash bright on absorb
  }

  onRemoved() {
    this.material.dispose();
    this.object.traverse(o => {
      if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
    });
  }
}

export class RadiantGuard extends Ability {
  readonly id = 'radiantGuard';
  readonly name = 'Radiant Guard';
  readonly description = 'Hold to raise a violet ward. Absorbs energy attacks and converts them to your own energy. Melee breaks it.';
  readonly cost = 15;
  readonly cooldown = 1.5;
  readonly castTime = 0;
  readonly channel = true;
  readonly maxHold = 4;
  readonly holdMoveFactor = 0.25;
  readonly element = 'violet' as const;
  readonly color = '#c9b2ff';
  readonly glyph = '🛡';

  private ward: WardVisual | null = null;

  cast(ctx: AbilityContext) {
    this.ward = new WardVisual(ctx.player);
    ctx.scene.add(this.ward);
    events.emit('fx:onomatopoeia', { text: 'SHING', position: ctx.player.position.clone().add(new THREE.Vector3(0, 2, 0)), color: '#c9b2ff' });
  }

  onHold(ctx: AbilityContext, dt: number): boolean {
    return true; // Keep channelling
  }

  onRelease(ctx: AbilityContext) {
    if (this.ward) {
      this.ward.destroy();
      this.ward = null;
    }
  }

  interceptHit(ctx: AbilityContext, hit: Hit): HitResult | null {
    if (hit.kind === 'energy') {
      ctx.player.gainEnergy(hit.amount * 0.8);
      this.ward?.flash();
      ctx.scene.cameraRig.addShake(0.05); // Tiny shake on block
      events.emit('fx:onomatopoeia', { text: 'CLANG!', position: ctx.player.position.clone().add(new THREE.Vector3(0, 2, 0)), scale: 0.8 });
      return 'blocked';
    }
    // Melee breaks through
    return null; // returning null ends the channel
  }
}

export default defineAbility({ id: 'radiantGuard', create: () => new RadiantGuard() });
