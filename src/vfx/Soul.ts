import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { glowTexture } from './textures';

export interface SoulOptions {
  /** Body colour. Souls are the true (violet) light. */
  color?: THREE.ColorRepresentation;
  /** Overall size in metres (body diameter). */
  size?: number;
  /** Hover height above its position. */
  hover?: number;
}

const SOUL = {
  color: '#b79bff',
  size: 0.42,
  hover: 1.1,
  bobHeight: 0.12,
  bobSpeed: 2.1,
  glow: 2.6,
};

let instanceCount = 0;

/**
 * A freed (or stolen) soul: a small floating spirit with a tail, two ink eyes and a soft halo.
 * Built from code — no model file. Move it by setting `soul.position`; it bobs by itself.
 *
 *   const soul = scene.add(new Soul());            // violet spirit
 *   soul.position.set(x, 0, z);
 *   scene.add(new Soul({ color: '#ffc21a' }));     // a soul still trapped in gold
 */
export class Soul extends Entity {
  private body = new THREE.Group();
  private halo: THREE.Sprite;
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private phase = (instanceCount++ * 1.618) % (Math.PI * 2);
  private t = 0;
  private hover: number;

  constructor(opts: SoulOptions = {}) {
    super();
    const size = opts.size ?? SOUL.size;
    this.hover = opts.hover ?? SOUL.hover;
    const color = new THREE.Color(opts.color ?? SOUL.color);

    // values > 1 bloom: the soul is light itself, so it is unlit and bright
    const bodyMat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(SOUL.glow) });
    const inkMat = new THREE.MeshBasicMaterial({ color: '#1a1030' });
    const head = new THREE.Mesh(new THREE.SphereGeometry(size / 2, 16, 12), bodyMat);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(size * 0.36, size * 0.9, 12), bodyMat);
    tail.rotation.x = Math.PI; // point down
    tail.position.y = -size * 0.55;
    const eyeGeo = new THREE.SphereGeometry(size * 0.085, 8, 6);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, inkMat);
      eye.position.set(side * size * 0.17, size * 0.06, size * 0.43);
      eye.scale.y = 1.5;
      this.body.add(eye);
    }
    const haloMat = new THREE.SpriteMaterial({
      map: glowTexture(),
      color,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.halo = new THREE.Sprite(haloMat);
    this.halo.scale.setScalar(size * 3.4);

    this.body.add(head, tail, this.halo);
    this.object.add(this.body);
    this.materials.push(bodyMat, inkMat, haloMat);
    this.geometries.push(head.geometry, tail.geometry, eyeGeo);
  }

  update(dt: number) {
    if (dt <= 0) return;
    this.t += dt;
    const s = Math.sin(this.t * SOUL.bobSpeed + this.phase);
    this.body.position.y = this.hover + s * SOUL.bobHeight;
    this.body.rotation.z = Math.sin(this.t * 1.3 + this.phase) * 0.18;
    this.body.scale.set(1 - s * 0.04, 1 + s * 0.06, 1 - s * 0.04);
    (this.halo.material as THREE.SpriteMaterial).opacity = 0.5 + 0.15 * Math.sin(this.t * 3.1 + this.phase);
  }

  onRemoved() {
    this.materials.forEach((m) => m.dispose());
    this.geometries.forEach((g) => g.dispose());
  }
}
