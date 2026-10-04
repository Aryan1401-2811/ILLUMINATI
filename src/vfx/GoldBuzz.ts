import * as THREE from 'three';
import type { GameScene } from '@/core/GameScene';
import { Projectile } from '@/combat/Projectile';
import { livePalette } from '@/render/palette';
import { BUZZ_FX, FX_COLORS } from './config';
import type { ImpactFx } from './ImpactFx';
import { seeded } from './textures';

const _c = new THREE.Color();

/** True for warm (gold) colours, false for cool (violet) ones. */
export function isGold(color: THREE.Color): boolean {
  return color.r > color.b * 1.15;
}

/** A value that changes BUZZ_FX.rate times a second: stepped, never smooth — that is the wrongness. */
export function buzzNoise(time: number, seed: number): number {
  const t = Math.floor(time * BUZZ_FX.rate);
  const x = Math.sin(t * 127.1 + seed * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * The second clue: gold energy is subtly wrong. Every gold projectile in flight twitches in
 * size and sheds little static sparks; violet ones fly perfectly calm. (The screen-space half
 * of the effect — colour fringing and flicker on bright gold — lives in ComicEffect.)
 */
export class GoldBuzz {
  private time = 0;
  private spark = 0;
  private rnd = seeded(404);

  update(dt: number, scene: GameScene, fx: ImpactFx) {
    if (dt <= 0) return;
    this.time += dt;
    const strength = livePalette.current.buzz;
    const bolts = scene.getAll(Projectile);
    this.spark += dt * BUZZ_FX.sparksPerSec * strength;
    const emit = Math.floor(this.spark);
    this.spark -= emit;
    bolts.forEach((bolt, i) => {
      if (!isGold(_c.set(bolt.opts.color))) return; // violet stays calm
      // purely cosmetic: the hit test uses opts.radius, not the visual scale
      bolt.object.scale.setScalar(1 + buzzNoise(this.time, i + 1) * BUZZ_FX.scale * strength);
      for (let n = 0; n < emit; n++) {
        fx.dots.spawn((p) => {
          const r = this.rnd;
          p.pos.copy(bolt.position);
          p.pos.x += (r() - 0.5) * 0.7;
          p.pos.y += (r() - 0.5) * 0.7;
          p.pos.z += (r() - 0.5) * 0.7;
          p.vel.set((r() - 0.5) * 3, (r() - 0.5) * 3, (r() - 0.5) * 3);
          p.life = 0.09 + r() * 0.08;
          p.size0 = 0.06 + r() * 0.06;
          p.size1 = 0.03;
          // static: half hot sparks, half specks of ink — light that sheds darkness
          const ink = r() < 0.5;
          p.color.set(ink ? FX_COLORS.ink : FX_COLORS.goldHot);
          p.intensity = ink ? 1 : 3;
          p.fadeFrom = 0.8;
        });
      }
    });
  }
}
