import * as THREE from 'three';
import { Ability, defineAbility, type AbilityContext } from '@/player/abilities/Ability';
import { Entity } from '@/core/Entity';

class LanceBeamVisual extends Entity {
  private age = 0;
  private readonly maxAge = 0.35;
  private material: THREE.MeshBasicMaterial;
  private coreMaterial: THREE.MeshBasicMaterial;
  private pivot = new THREE.Group();

  constructor(from: THREE.Vector3, dir: THREE.Vector3, length: number) {
    super();
    const color = new THREE.Color('#9b6bff').multiplyScalar(4);
    
    const geo = new THREE.CylinderGeometry(0.6, 0.6, length, 12);
    geo.translate(0, length / 2, 0); // Base at origin
    
    this.material = new THREE.MeshBasicMaterial({ 
      color, 
      transparent: true, 
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending 
    });
    
    const coreGeo = new THREE.CylinderGeometry(0.2, 0.2, length, 8);
    coreGeo.translate(0, length / 2, 0);
    this.coreMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff') });
    
    const mesh = new THREE.Mesh(geo, this.material);
    const core = new THREE.Mesh(coreGeo, this.coreMaterial);
    
    // Cylinders point up (+Y), we need them along +Z for lookAt
    mesh.rotation.x = Math.PI / 2;
    core.rotation.x = Math.PI / 2;
    
    this.pivot.add(mesh, core);
    this.pivot.position.copy(from);
    this.pivot.lookAt(from.clone().add(dir));
    
    this.object.add(this.pivot);
  }

  update(dt: number) {
    this.age += dt;
    if (this.age > this.maxAge) {
      this.destroy();
      return;
    }
    const k = 1 - (this.age / this.maxAge);
    this.material.opacity = 0.8 * k;
    this.pivot.scale.set(k, k, 1);
  }

  onRemoved() {
    this.material.dispose();
    this.coreMaterial.dispose();
    this.object.traverse(o => {
      if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
    });
  }
}

export class VioletLance extends Ability {
  readonly id = 'violetLance';
  readonly name = 'Violet Lance';
  readonly description = 'Fire a piercing beam of true light that hits all enemies in a line. Pierces cores.';
  readonly cost = 25;
  readonly cooldown = 0.6;
  readonly castTime = 0.3;
  readonly element = 'violet' as const;
  readonly color = '#9b6bff';
  readonly glyph = '⚡';

  cast({ player, scene, aimDir }: AbilityContext) {
    const range = 22;
    const from = player.position.clone().setY(1.1);
    
    // Visual
    scene.add(new LanceBeamVisual(from, aimDir, range));
    
    // Query hits along the beam
    const hitIds = new Set<string>();
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const p = from.clone().addScaledVector(aimDir, (i / steps) * range);
      const targets = scene.combat.querySphere(p, 1.5, 'player');
      
      for (const target of targets) {
        if (hitIds.has(target.id)) continue;
        hitIds.add(target.id);
        
        scene.combat.applyHit(target, {
          amount: 25,
          kind: 'energy',
          element: 'violet',
          heavy: false,
          team: 'player',
          from: player.position.clone(),
          knockback: 6,
          sourceId: this.id
        });
      }
    }
    
    scene.cameraRig.addShake(0.15);
  }
}

export default defineAbility({ id: 'violetLance', create: () => new VioletLance() });
