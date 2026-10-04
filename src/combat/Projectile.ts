import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import type { DamageKind, Element, Hurtbox, HitResult, Team } from './types';

export interface ProjectileOptions {
  team: Team;
  /** Spawn point (usually chest height). */
  from: THREE.Vector3;
  /** Unit direction. */
  dir: THREE.Vector3;
  speed?: number;
  radius?: number;
  damage?: number;
  kind?: DamageKind;
  element?: Element;
  heavy?: boolean;
  knockback?: number;
  lifetime?: number;
  /** How many targets it passes through before dying (0 = dies on first hit). */
  pierce?: number;
  color?: THREE.ColorRepresentation;
  sourceId?: string;
  onHit?: (target: Hurtbox, result: HitResult) => void;
}

const glowTexture = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

/**
 * A glowing energy shot. Used by player abilities AND enemies/bosses (set team).
 *   scene.add(new Projectile({ team: 'player', from, dir, damage: 15, element: 'gold' }))
 */
export class Projectile extends Entity {
  readonly opts: Required<Omit<ProjectileOptions, 'onHit' | 'sourceId'>> & Pick<ProjectileOptions, 'onHit' | 'sourceId'>;
  private velocity: THREE.Vector3;
  private age = 0;
  private hitIds = new Set<string>();
  private pierceLeft: number;

  constructor(opts: ProjectileOptions) {
    super();
    this.opts = {
      speed: 22,
      radius: 0.35,
      damage: 12,
      kind: 'energy',
      element: 'gold',
      heavy: false,
      knockback: 3,
      lifetime: 1.6,
      pierce: 0,
      color: opts.element === 'violet' ? '#9b6bff' : '#ffc21a',
      ...opts,
    };
    this.pierceLeft = this.opts.pierce;
    this.velocity = opts.dir.clone().setY(0).normalize().multiplyScalar(this.opts.speed);
    this.object.position.copy(opts.from);

    const color = new THREE.Color(this.opts.color);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(this.opts.radius * 0.55, 16, 12),
      new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(6) }),
    );
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    halo.scale.setScalar(this.opts.radius * 4.5);
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(this.opts.radius * 0.5, this.opts.radius * 5, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.5), transparent: true, opacity: 0.55, depthWrite: false }),
    );
    tail.rotation.x = -Math.PI / 2;
    tail.position.z = -this.opts.radius * 2.5;
    const pivot = new THREE.Group();
    pivot.add(tail);
    pivot.lookAt(this.velocity);
    this.object.add(core, halo, pivot);
  }

  update(dt: number) {
    this.age += dt;
    if (this.age > this.opts.lifetime) return this.destroy();
    this.object.position.addScaledVector(this.velocity, dt);
    if (this.scene.collision.blocked(this.object.position, this.opts.radius * 0.5)) return this.destroy();

    for (const target of this.scene.combat.querySphere(this.object.position, this.opts.radius, this.opts.team)) {
      if (this.hitIds.has(target.id)) continue;
      this.hitIds.add(target.id);
      const result = this.scene.combat.applyHit(target, {
        amount: this.opts.damage,
        kind: this.opts.kind,
        element: this.opts.element,
        heavy: this.opts.heavy,
        team: this.opts.team,
        from: this.object.position.clone().sub(this.velocity.clone().normalize()),
        knockback: this.opts.knockback,
        sourceId: this.opts.sourceId,
      });
      this.opts.onHit?.(target, result);
      if (result === 'immune') continue;
      if (this.pierceLeft-- <= 0) return this.destroy();
    }
  }

  onRemoved() {
    this.object.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
  }
}
