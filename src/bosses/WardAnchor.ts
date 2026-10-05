import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import type { Hit, HitResult, Hurtbox } from '@/combat/types';
import { toonMaterial, addOutline } from '@/render/toon';
import { WARDEN } from './config';

const GOLD = '#ffc21a';

/**
 * Warden stage 2: one of the gold chain anchors holding his Chain Ward. Stands still,
 * takes any damage; break every anchor to drop the ward.
 */
export class WardAnchor extends Entity implements Hurtbox {
  readonly team = 'enemy' as const;
  readonly id: string;
  radius = 0.6;
  height = 2.2;
  mass = 0;
  hp = WARDEN.wardAnchorHp;

  private ring: THREE.Mesh;
  private flash = 0;
  private t = Math.random() * 10;
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];

  constructor(index: number) {
    super();
    this.id = `wardAnchor_${index}`;
    const stoneMat = toonMaterial({ color: '#6b5a7a' });
    const goldMat = toonMaterial({ color: GOLD });
    this.mats.push(stoneMat, goldMat);

    const baseGeo = new THREE.CylinderGeometry(0.55, 0.7, 0.4, 8);
    const pillarGeo = new THREE.CylinderGeometry(0.28, 0.36, 2, 8);
    const ringGeo = new THREE.TorusGeometry(0.5, 0.09, 6, 18);
    this.geos.push(baseGeo, pillarGeo, ringGeo);

    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.y = 0.2;
    const pillar = new THREE.Mesh(pillarGeo, goldMat);
    pillar.position.y = 1.2;
    this.ring = new THREE.Mesh(ringGeo, goldMat);
    this.ring.position.y = 1.9;
    this.ring.rotation.x = Math.PI / 2;
    for (const m of [base, pillar, this.ring]) {
      addOutline(m, 2);
      this.object.add(m);
    }
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  onAdded() {
    this.own(this.scene.combat.register(this));
    events.emit('fx:onomatopoeia', { text: 'CLANK!', position: this.position.clone().setY(2.4), color: GOLD });
  }

  receiveHit(hit: Hit): HitResult {
    if (!this.alive) return 'immune';
    this.hp -= hit.amount;
    this.flash = 1;
    if (this.hp <= 0) {
      events.emit('fx:onomatopoeia', { text: 'SNAP!', position: this.position.clone().setY(2), color: GOLD, scale: 1.3 });
      events.emit('fx:shake', { strength: 0.25 });
      this.destroy();
      return 'killed';
    }
    return 'damaged';
  }

  update(dt: number) {
    const step = dt > 0 ? dt : 1 / 60;
    this.t += step;
    this.flash = Math.max(0, this.flash - step * 5);
    this.ring.rotation.z += step * 2;
    this.ring.position.y = 1.9 + Math.sin(this.t * 3) * 0.08;
    this.object.scale.setScalar(1 + this.flash * 0.12);
  }

  onRemoved() {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
