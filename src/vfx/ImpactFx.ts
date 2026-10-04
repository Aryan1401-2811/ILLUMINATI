import * as THREE from 'three';
import type { Element } from '@/combat/types';
import { SpriteBatch } from './SpriteBatch';
import { FX_COLORS, IMPACT_FX } from './config';
import { dotTexture, glowTexture, paperScrapTexture, splatTexture, starburstTexture, seeded } from './textures';

const _dir = new THREE.Vector3();
const _side = new THREE.Vector3();
const _c = new THREE.Color();

export function elementColor(element: Element, palette?: THREE.Color): string {
  if (element === 'gold') return FX_COLORS.gold;
  if (element === 'violet') return FX_COLORS.violet;
  return palette ? `#${palette.getHexString()}` : FX_COLORS.goldHot;
}

/**
 * The particle side of every impact: sparks, ink drops, ground splats, starburst flashes.
 * It owns five sprite pools = five draw calls, no matter how busy the fight gets.
 */
export class ImpactFx {
  readonly group = new THREE.Group();
  /** Hard-edged dots: sparks and ink drops. */
  readonly dots = new SpriteBatch({ texture: dotTexture(), capacity: 320, mode: 'billboard' });
  /** Soft additive glows: flashes, wisp trails, light motes. */
  readonly glows = new SpriteBatch({ texture: glowTexture(), capacity: 160, mode: 'billboard', additive: true });
  /** Spiky comic impact stars. */
  readonly stars = new SpriteBatch({ texture: starburstTexture(), capacity: 24, mode: 'billboard', depthTest: false, renderOrder: 12 });
  /** Ink splats lying on the ground. */
  readonly splats = new SpriteBatch({ texture: splatTexture(), capacity: IMPACT_FX.maxSplats, mode: 'flat', renderOrder: 1 });
  /** Tumbling paper scraps (shell shards, collapse debris, violet ambience). */
  readonly scraps = new SpriteBatch({ texture: paperScrapTexture(), capacity: 220, mode: 'tumble' });
  private rnd = seeded(77);
  private splatY = 0.03;

  constructor() {
    this.group.name = 'impact-fx';
    for (const b of this.batches) this.group.add(b.mesh);
  }

  private get batches() {
    return [this.splats, this.dots, this.scraps, this.glows, this.stars];
  }

  update(dt: number) {
    for (const b of this.batches) b.update(dt);
  }

  dispose() {
    for (const b of this.batches) b.dispose();
    this.group.removeFromParent();
  }

  /** A hit landed: flash star + sparks flying away from the attacker + a few ink drops. */
  hit(at: THREE.Vector3, from: THREE.Vector3, color: string, heavy: boolean) {
    const r = this.rnd;
    _dir.subVectors(at, from).setY(0);
    if (_dir.lengthSq() < 1e-6) _dir.set(0, 0, 1);
    _dir.normalize();
    _side.set(-_dir.z, 0, _dir.x);

    this.stars.spawn((p) => {
      p.pos.copy(at);
      p.life = heavy ? 0.2 : 0.13;
      p.size0 = heavy ? 1.3 : 0.75;
      p.size1 = heavy ? 2.5 : 1.35;
      p.rot = r() * Math.PI;
      p.spin = 3;
      p.color.set(FX_COLORS.paper);
      p.intensity = 1.6;
      p.fadeFrom = 0.55;
    });
    this.glows.spawn((p) => {
      p.pos.copy(at);
      p.life = 0.22;
      p.size0 = heavy ? 3.2 : 1.8;
      p.size1 = p.size0 * 1.5;
      p.color.set(color);
      p.intensity = 1.5;
      p.alpha = 0.7;
      p.fadeFrom = 0;
    });
    const n = heavy ? IMPACT_FX.sparksHeavy : IMPACT_FX.sparksLight;
    for (let i = 0; i < n; i++) {
      this.dots.spawn((p) => {
        const speed = IMPACT_FX.sparkSpeed * (0.45 + r()) * (heavy ? 1.35 : 1);
        p.pos.copy(at);
        p.vel
          .copy(_dir)
          .multiplyScalar(speed * (0.35 + r() * 0.65))
          .addScaledVector(_side, (r() - 0.5) * speed * 1.3);
        p.vel.y = (r() * 0.9 + 0.1) * speed * 0.7;
        p.gravity = 16;
        p.drag = 1.6;
        p.life = 0.28 + r() * 0.3;
        p.size0 = (heavy ? 0.2 : 0.14) * (0.6 + r() * 0.8);
        p.size1 = 0.02;
        p.color.set(i % 3 === 0 ? FX_COLORS.paper : color);
        p.intensity = 3.2; // blooms
        p.fadeFrom = 0.7;
      });
    }
    this.ink(at, _dir, heavy ? IMPACT_FX.inkDropsHeavy : IMPACT_FX.inkDrops, FX_COLORS.ink, heavy ? 6 : 4);
    if (heavy) this.splat(_c.set(FX_COLORS.ink), at.x + _dir.x * 0.6, at.z + _dir.z * 0.6, 1.5 + r() * 0.5, IMPACT_FX.splatLife);
  }

  /** A hit that did nothing (deflected / blocked): a few pale ticks, no ink. */
  ping(at: THREE.Vector3, color: string) {
    const r = this.rnd;
    this.stars.spawn((p) => {
      p.pos.copy(at);
      p.life = 0.1;
      p.size0 = 0.45;
      p.size1 = 0.95;
      p.rot = r() * Math.PI;
      p.color.set(color);
      p.intensity = 1.4;
    });
    for (let i = 0; i < 5; i++) {
      this.dots.spawn((p) => {
        const a = r() * Math.PI * 2;
        p.pos.copy(at);
        p.vel.set(Math.cos(a) * 5, 2 + r() * 3, Math.sin(a) * 5);
        p.gravity = 14;
        p.life = 0.25;
        p.size0 = 0.1;
        p.size1 = 0.02;
        p.color.set(color);
        p.intensity = 2.4;
      });
    }
  }

  /** Ink drops that fly, land and dry on the floor. */
  ink(at: THREE.Vector3, dir: THREE.Vector3, count: number, color: string, speed: number) {
    const r = this.rnd;
    for (let i = 0; i < count; i++) {
      this.dots.spawn((p) => {
        const a = r() * Math.PI * 2;
        p.pos.copy(at);
        p.vel.set(Math.cos(a), 0, Math.sin(a)).multiplyScalar(speed * (0.3 + r() * 0.7)).addScaledVector(dir, speed * 0.5);
        p.vel.y = 2 + r() * 4.5;
        p.gravity = 20;
        p.life = 1.5 + r() * 1.2;
        p.size0 = 0.1 + r() * 0.16;
        p.size1 = p.size0 * 0.75;
        p.color.set(color);
        p.fadeFrom = 0.75;
        p.floorY = 0.05;
      });
    }
  }

  /** Stamp an ink splat on the floor. */
  splat(color: THREE.Color, x: number, z: number, size: number, life: number) {
    const r = this.rnd;
    // each splat sits a hair above the previous one so overlapping splats never z-fight
    this.splatY = this.splatY > 0.05 ? 0.03 : this.splatY + 0.0006;
    const y = this.splatY;
    this.splats.spawn((p) => {
      p.pos.set(x, y, z);
      p.life = life;
      p.size0 = size * 0.35;
      p.size1 = size;
      p.rot = r() * Math.PI * 2;
      p.color.copy(color);
      p.alpha = 0.82;
      p.fadeFrom = 0.7;
    });
  }

  /** A Shade dies: it bursts into ink that splashes the page, and its light lifts out of it. */
  death(at: THREE.Vector3, bodyColor: string) {
    const r = this.rnd;
    const mid = _dir.copy(at).setY(Math.max(0.8, at.y));
    this.stars.spawn((p) => {
      p.pos.copy(mid);
      p.life = 0.24;
      p.size0 = 1.4;
      p.size1 = 3.2;
      p.rot = r() * Math.PI;
      p.spin = -4;
      p.color.set(FX_COLORS.paper);
      p.intensity = 1.8;
    });
    for (let i = 0; i < IMPACT_FX.deathDrops; i++) {
      this.dots.spawn((p) => {
        const a = (i / IMPACT_FX.deathDrops) * Math.PI * 2 + r() * 0.4;
        const speed = 2.5 + r() * 5.5;
        p.pos.copy(mid);
        p.pos.y += (r() - 0.5) * 0.8;
        p.vel.set(Math.cos(a) * speed, 2 + r() * 6, Math.sin(a) * speed);
        p.gravity = 19;
        p.life = 1.6 + r() * 1.6;
        p.size0 = 0.12 + r() * 0.24;
        p.size1 = p.size0 * 0.7;
        p.color.set(i % 4 === 0 ? bodyColor : FX_COLORS.ink);
        p.fadeFrom = 0.75;
        p.floorY = 0.05;
      });
    }
    // dissolve: soft motes of its light rise and thin out
    for (let i = 0; i < IMPACT_FX.deathMotes; i++) {
      this.glows.spawn((p) => {
        p.pos.set(at.x + (r() - 0.5) * 0.9, 0.2 + r() * 1.5, at.z + (r() - 0.5) * 0.9);
        p.vel.set((r() - 0.5) * 0.6, 0.9 + r() * 1.4, (r() - 0.5) * 0.6);
        p.drag = 0.6;
        p.life = 0.8 + r() * 0.7;
        p.size0 = 0.5 + r() * 0.4;
        p.size1 = 0.05;
        p.color.set(bodyColor);
        p.intensity = 1.3;
        p.alpha = 0.75;
        p.fadeFrom = 0.3;
      });
    }
    this.splat(_c.set(FX_COLORS.ink), at.x, at.z, 2.6 + r() * 0.6, IMPACT_FX.splatLife * 1.6);
    this.splat(_c.set(bodyColor).multiplyScalar(0.55), at.x + (r() - 0.5), at.z + (r() - 0.5), 1.3, IMPACT_FX.splatLife * 1.3);
  }

  /** Armour shell cracks open: shards of it fly like torn card. */
  shatter(at: THREE.Vector3, color: string) {
    const r = this.rnd;
    this.glows.spawn((p) => {
      p.pos.copy(at);
      p.life = 0.3;
      p.size0 = 4;
      p.size1 = 7;
      p.color.set(FX_COLORS.paper);
      p.intensity = 1.6;
      p.alpha = 0.8;
      p.fadeFrom = 0;
    });
    for (let i = 0; i < 18; i++) {
      this.scraps.spawn((p) => {
        const a = (i / 18) * Math.PI * 2 + r() * 0.3;
        const speed = 4 + r() * 6;
        p.pos.copy(at);
        p.vel.set(Math.cos(a) * speed, 3 + r() * 6, Math.sin(a) * speed);
        p.gravity = 17;
        p.drag = 0.8;
        p.life = 0.9 + r() * 0.8;
        p.size0 = 0.3 + r() * 0.35;
        p.size1 = p.size0 * 0.6;
        p.aspect = 0.6 + r() * 0.8;
        p.rot = r() * 6;
        p.spin = (r() - 0.5) * 14;
        p.tiltSpin = (r() - 0.5) * 16;
        p.color.set(i % 3 === 0 ? FX_COLORS.paper : color);
        p.intensity = 1.2;
        p.fadeFrom = 0.7;
        p.floorY = 0.06;
      });
    }
  }
}
