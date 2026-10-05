import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import type { SoulOrb } from './SoulOrb';

const RADIUS = 2.3;
const HEIGHT = 1.8;
const VIOLET = new THREE.Color('#7f5cff');
const GOLD = new THREE.Color('#ffc21a');

/**
 * Phase 2: the stolen souls hold a shield around the Narrator. A bubble chained to every
 * orb still held; it thins and wobbles as souls are freed, ripples when it blocks a hit,
 * and bursts when the last soul goes free.
 */
export class SoulShield extends Entity {
  private dome: THREE.Mesh;
  private rim: THREE.Mesh;
  private domeMat: THREE.MeshBasicMaterial;
  private rimMat: THREE.MeshBasicMaterial;
  private chains: THREE.LineSegments;
  private chainMat: THREE.LineBasicMaterial;
  private t = 0;
  private ripple = 0;
  private broken = false;
  private fade = 0;

  constructor(
    private readonly boss: Entity,
    private readonly orbs: SoulOrb[],
  ) {
    super();
    this.domeMat = new THREE.MeshBasicMaterial({
      color: VIOLET.clone().multiplyScalar(1.6),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 32, 20), this.domeMat);
    this.dome.position.y = HEIGHT;

    // Ink rim: a slightly larger back-face shell drawn dark, reads as a comic outline
    this.rimMat = new THREE.MeshBasicMaterial({ color: '#1a1013', side: THREE.BackSide, transparent: true, opacity: 0 });
    this.rim = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.04, 32, 20), this.rimMat);
    this.rim.position.y = HEIGHT;

    this.chainMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.8 });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(orbs.length * 6), 3));
    this.chains = new THREE.LineSegments(geo, this.chainMat);
    this.chains.frustumCulled = false;

    this.object.add(this.rim, this.dome);
  }

  onAdded() {
    // Chains live in world space (orbs and boss both move)
    this.scene.three.add(this.chains);
  }

  get held(): number {
    return this.orbs.filter((o) => o.alive).length;
  }

  /** A hit bounced off: ripple the bubble. */
  blocked() {
    this.ripple = 1;
  }

  update(dt: number) {
    const step = dt > 0 ? dt : 1 / 60;
    this.t += step;
    this.object.position.copy(this.boss.position);

    const held = this.held;
    const share = held / this.orbs.length;
    if (!this.broken && held === 0) this.burst();

    if (this.broken) {
      this.fade += step * 3;
      this.dome.scale.setScalar(1 + this.fade * 0.6);
      this.domeMat.opacity = Math.max(0, 0.5 - this.fade * 0.5);
      this.rimMat.opacity = 0;
      this.chainMat.opacity = 0;
      if (this.fade >= 1) this.destroy();
      return;
    }

    this.ripple = Math.max(0, this.ripple - step * 3);
    // Thinner and shakier the fewer souls hold it
    const wobble = (1 - share) * 0.06 * Math.sin(this.t * 23);
    this.dome.scale.setScalar(0.95 + share * 0.05 + this.ripple * 0.08 + wobble);
    this.rim.scale.copy(this.dome.scale);
    this.domeMat.opacity = 0.12 + share * 0.2 + this.ripple * 0.35 + Math.sin(this.t * 3) * 0.03;
    this.domeMat.color.copy(VIOLET).lerp(GOLD, this.ripple * 0.6).multiplyScalar(1.6);
    this.rimMat.opacity = 0.25 + share * 0.35;

    // A gold chain from the shield to every soul still held
    const pos = this.chains.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.orbs.forEach((o, i) => {
      const from = this.boss.position;
      const to = o.alive ? o.position : from;
      pos.setXYZ(i * 2, from.x, HEIGHT, from.z);
      pos.setXYZ(i * 2 + 1, to.x, to.y + 0.1, to.z);
    });
    pos.needsUpdate = true;
  }

  private burst() {
    this.broken = true;
    events.emit('fx:onomatopoeia', { text: 'SHIELD DOWN!', position: this.boss.position.clone().setY(3.5), color: '#c9b2ff', scale: 1.6 });
    events.emit('fx:shake', { strength: 0.5 });
    events.emit('fx:hitstop', { durationSec: 0.12 });
  }

  onRemoved() {
    this.scene.three.remove(this.chains);
    this.chains.geometry.dispose();
    this.dome.geometry.dispose();
    this.rim.geometry.dispose();
    this.domeMat.dispose();
    this.rimMat.dispose();
    this.chainMat.dispose();
  }
}
