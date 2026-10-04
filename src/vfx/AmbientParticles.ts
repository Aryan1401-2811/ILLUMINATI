import * as THREE from 'three';
import { SpriteBatch, type Particle } from './SpriteBatch';
import { FX_COLORS } from './config';
import { dotTexture, glowTexture, paperScrapTexture, seeded } from './textures';

const AMBIENT = {
  /** The air volume that follows the camera focus (metres). */
  halfWidth: 17,
  north: 17,
  south: 7,
  height: 5.5,
  /** Particles per second at full strength. */
  goldMotes: 9,
  goldDots: 7,
  violetLights: 7,
  violetScraps: 5,
  violetInk: 5,
};

/**
 * The air of the page. Gold world: warm dust and drifting halftone dots in the sunlight.
 * Violet world: calm motes of true light, scraps of torn paper and specks of ink, floating
 * weightless. It cross-fades with the palette, so the twist changes the very air.
 */
export class AmbientParticles {
  readonly group = new THREE.Group();
  /** Multiplies every spawn rate (the void arena uses more, a cutscene can set 0). */
  density = 1;
  private lights = new SpriteBatch({ texture: glowTexture(), capacity: 150, mode: 'billboard', additive: true, renderOrder: 3 });
  private dots = new SpriteBatch({ texture: dotTexture(), capacity: 130, mode: 'billboard', renderOrder: 3 });
  private scraps = new SpriteBatch({ texture: paperScrapTexture(), capacity: 80, mode: 'tumble', renderOrder: 3 });
  private rnd = seeded(2024);
  private acc = [0, 0, 0, 0, 0];
  private warmed = false;

  constructor() {
    this.group.name = 'ambient';
    this.group.add(this.lights.mesh, this.dots.mesh, this.scraps.mesh);
  }

  /** `violet` is 0 in the gold world, 1 in the violet world, in between during the flip. */
  update(dt: number, focus: THREE.Vector3, violet: number) {
    if (dt <= 0) return;
    if (!this.warmed) {
      // start with the air already full instead of watching it fill up
      this.warmed = true;
      for (let i = 0; i < 70; i++) this.emit(focus, violet, true);
    }
    const gold = 1 - violet;
    const rates = [AMBIENT.goldMotes * gold, AMBIENT.goldDots * gold, AMBIENT.violetLights * violet, AMBIENT.violetScraps * violet, AMBIENT.violetInk * violet];
    for (let i = 0; i < rates.length; i++) {
      this.acc[i] += rates[i] * this.density * dt;
      while (this.acc[i] >= 1) {
        this.acc[i] -= 1;
        this.spawnKind(i, focus, false);
      }
    }
    this.lights.update(dt);
    this.dots.update(dt);
    this.scraps.update(dt);
  }

  dispose() {
    this.lights.dispose();
    this.dots.dispose();
    this.scraps.dispose();
    this.group.removeFromParent();
  }

  private emit(focus: THREE.Vector3, violet: number, aged: boolean) {
    const kinds = violet > 0.5 ? [2, 3, 4] : [0, 1];
    this.spawnKind(kinds[Math.floor(this.rnd() * kinds.length)], focus, aged);
  }

  private spawnKind(kind: number, focus: THREE.Vector3, aged: boolean) {
    const r = this.rnd;
    const place = (p: Particle, life: number) => {
      p.pos.set(focus.x + (r() * 2 - 1) * AMBIENT.halfWidth, 0.25 + r() * AMBIENT.height, focus.z - AMBIENT.north + r() * (AMBIENT.north + AMBIENT.south));
      p.life = life;
      p.fadeIn = 0.2;
      p.fadeFrom = 0.75;
      if (aged) p.age = r() * life * 0.7;
    };
    switch (kind) {
      case 0: // gold: sunlit dust
        this.lights.spawn((p) => {
          place(p, 5 + r() * 4);
          p.vel.set(0.18 + r() * 0.25, 0.05 + r() * 0.12, (r() - 0.5) * 0.15);
          p.size0 = p.size1 = 0.07 + r() * 0.11;
          p.color.set(FX_COLORS.goldHot);
          p.intensity = 1.4;
          p.alpha = 0.4 + r() * 0.25;
        });
        break;
      case 1: // gold: loose halftone dots, as if shaken off the print
        this.dots.spawn((p) => {
          place(p, 6 + r() * 4);
          p.vel.set(0.12 + r() * 0.2, 0.04 + r() * 0.08, 0);
          p.size0 = p.size1 = 0.045 + r() * 0.06;
          p.color.set('#fff6d8');
          p.alpha = 0.55;
        });
        break;
      case 2: // violet: calm motes of true light
        this.lights.spawn((p) => {
          place(p, 6 + r() * 5);
          p.vel.set((r() - 0.5) * 0.12, 0.1 + r() * 0.14, (r() - 0.5) * 0.12);
          p.size0 = p.size1 = 0.14 + r() * 0.22;
          p.color.set(r() < 0.3 ? '#f1e9ff' : FX_COLORS.violetSoft);
          p.intensity = 1.3;
          p.alpha = 0.45 + r() * 0.3;
        });
        break;
      case 3: // violet: weightless scraps of the torn page
        this.scraps.spawn((p) => {
          place(p, 8 + r() * 5);
          p.vel.set((r() - 0.5) * 0.3, 0.06 + r() * 0.16, (r() - 0.5) * 0.2);
          p.size0 = p.size1 = 0.16 + r() * 0.26;
          p.aspect = 0.7 + r() * 0.7;
          p.rot = r() * 6;
          p.spin = (r() - 0.5) * 0.9;
          p.tiltX = r() * 6;
          p.tiltSpin = (r() - 0.5) * 1.1;
          p.color.set(r() < 0.5 ? '#efe6ff' : '#cbbcf2');
          p.alpha = 0.9;
        });
        break;
      default: // violet: drifting specks of ink
        this.dots.spawn((p) => {
          place(p, 6 + r() * 4);
          p.vel.set((r() - 0.5) * 0.2, 0.08 + r() * 0.12, 0);
          p.size0 = p.size1 = 0.05 + r() * 0.09;
          p.color.set('#0b0722');
          p.alpha = 0.7;
        });
    }
  }
}
