import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import type { GameScene } from '@/core/GameScene';
import { getOutlineMaterial, toonMaterial } from '@/render/toon';
import { smoothNormalCopy } from '@/world/props/ZoneKit';
import { CollapseCracks } from './CollapseCracks';
import { COLLAPSE_FX, FX_COLORS } from './config';
import { fxDt } from './fxTime';
import { Shockwave } from './Shockwave';
import { seeded } from './textures';
import { VfxDirector } from './VfxDirector';

export interface CollapseOptions {
  /** How long the world keeps falling apart (seconds). The damage stays afterwards. */
  durationSec?: number;
  /** Middle of the collapse. Default: the scene origin. */
  center?: THREE.Vector3;
  /** How far the cracks and falling panels reach (metres). */
  radius?: number;
  /** 0..1.5 — scales shake, debris and noise. */
  intensity?: number;
}

interface Slab {
  mesh: THREE.Mesh;
  startAt: number;
  vel: number;
  spin: THREE.Vector3;
  landed: boolean;
  restX: number;
  restZ: number;
}

const SLAB_COLORS = ['#fbf1dc', '#ffe9a8', '#e6dcff', '#fff6e0'];
const WORDS = ['KRAK!', 'CRASH!', 'RRRIP!'];

/**
 * The twist: the page comes apart. Cracks race across the floor and leak violet light, comic
 * panels tear loose and slam down around the arena, paper flies, the screen rumbles.
 * Start it with startCollapse(scene). It is only visual: no damage, no collision.
 */
export class Collapse extends Entity {
  /** Resolves when the collapse has played out (the cracks and fallen panels remain). */
  readonly finished: Promise<void>;
  private resolve!: () => void;
  private cracks: CollapseCracks;
  private slabs: Slab[] = [];
  private slabMats: THREE.MeshToonMaterial[] = [];
  private slabGeo = new THREE.BoxGeometry(1, 1, 1);
  private outlineGeo: THREE.BufferGeometry;
  private t = 0;
  private rumbleIn = 0;
  private scrapAcc = 0;
  private words = 0;
  private done = false;
  private stopped = false;
  private rnd = seeded(909);
  private duration: number;
  private center: THREE.Vector3;
  private radius: number;
  private intensity: number;

  constructor(opts: CollapseOptions = {}) {
    super();
    this.duration = opts.durationSec ?? COLLAPSE_FX.durationSec;
    this.center = (opts.center ?? new THREE.Vector3()).clone().setY(0);
    this.radius = opts.radius ?? COLLAPSE_FX.radius;
    this.intensity = opts.intensity ?? 1;
    this.finished = new Promise((r) => (this.resolve = r));
    // box corners need averaged normals or the ink outline splits open at every edge
    const flat = this.slabGeo.toNonIndexed();
    this.outlineGeo = smoothNormalCopy(flat);
    flat.dispose();
    this.cracks = new CollapseCracks(this.center, this.radius, COLLAPSE_FX.cracks);
    this.object.add(this.cracks.mesh);
    this.buildSlabs();
  }

  /** Stop spawning and shaking now; whatever has already broken stays broken. */
  stop() {
    this.stopped = true;
    this.finish();
  }

  private buildSlabs() {
    const r = this.rnd;
    this.slabMats = SLAB_COLORS.map((c) => toonMaterial({ color: c }));
    const outlineMat = getOutlineMaterial(4);
    for (let i = 0; i < COLLAPSE_FX.slabs; i++) {
      const mesh = new THREE.Mesh(this.slabGeo, this.slabMats[i % this.slabMats.length]);
      mesh.scale.set(2.2 + r() * 2.6, 3.0 + r() * 2.4, 0.2);
      mesh.castShadow = true;
      const outline = new THREE.Mesh(this.outlineGeo, outlineMat);
      outline.userData.isOutline = true;
      mesh.add(outline);
      // land in a ring around the middle, never on top of the people standing there
      const a = (i / COLLAPSE_FX.slabs) * Math.PI * 2 + r() * 0.5;
      const d = COLLAPSE_FX.safeRadius + r() * (this.radius * 1.05 - COLLAPSE_FX.safeRadius);
      mesh.position.set(this.center.x + Math.cos(a) * d, 16 + r() * 10, this.center.z + Math.sin(a) * d);
      mesh.rotation.order = 'YXZ'; // yaw last, so "lying flat" stays flat whatever way it faces
      mesh.rotation.set(r() * 6, r() * 6, r() * 6);
      mesh.visible = false;
      this.object.add(mesh);
      this.slabs.push({
        mesh,
        startAt: 0.5 + (i / COLLAPSE_FX.slabs) * this.duration * 0.7 + r() * 0.3,
        vel: 0,
        spin: new THREE.Vector3((r() - 0.5) * 3, (r() - 0.5) * 2, (r() - 0.5) * 3),
        landed: false,
        // behind the action a panel stays stabbed into the floor at a lean; in front of it
        // (toward the camera) it lies flat, so it never hides a fighter
        restX: Math.sin(a) < -0.2 ? 0.25 + r() * 0.35 : Math.PI / 2 + (r() - 0.5) * 0.2,
        restZ: (r() - 0.5) * 0.3,
      });
    }
  }

  update(dt: number) {
    const step = fxDt(dt);
    if (step <= 0) return;
    this.t += step;
    const k = Math.min(1, this.t / this.duration);
    // strength: quick ramp up, long hold, eases off at the end
    const env = this.stopped ? 0 : Math.min(1, this.t / 0.6) * (1 - Math.max(0, (k - 0.8) / 0.2)) * this.intensity;

    const grow = Math.min(1, this.t / (this.duration * COLLAPSE_FX.crackGrowth));
    this.cracks.progress = 1 - (1 - grow) * (1 - grow);
    this.cracks.glow = 1.5 + Math.sin(this.t * 2.2) * 0.25; // slow, calm pulse: this is the true light

    const fx = VfxDirector.of(this.scene)?.impact;

    // constant low rumble
    this.rumbleIn -= step;
    if (env > 0.01 && this.rumbleIn <= 0) {
      this.rumbleIn = 0.14;
      events.emit('fx:shake', { strength: COLLAPSE_FX.rumble * env });
    }

    // paper streaming up and away, as if the page were being torn from under the world
    if (fx && env > 0.01) {
      this.scrapAcc += COLLAPSE_FX.scrapsPerSec * env * step;
      while (this.scrapAcc >= 1) {
        this.scrapAcc -= 1;
        const r = this.rnd;
        const a = r() * Math.PI * 2;
        const d = r() * this.radius * 1.2;
        fx.scraps.spawn((p) => {
          p.pos.set(this.center.x + Math.cos(a) * d, 0.1, this.center.z + Math.sin(a) * d);
          p.vel.set((r() - 0.3) * 5, 3 + r() * 6, (r() - 0.5) * 4);
          p.gravity = -1.5;
          p.drag = 0.5;
          p.life = 1.6 + r() * 1.6;
          p.size0 = 0.2 + r() * 0.4;
          p.size1 = p.size0;
          p.aspect = 0.6 + r() * 0.8;
          p.rot = r() * 6;
          p.spin = (r() - 0.5) * 8;
          p.tiltSpin = (r() - 0.5) * 9;
          p.color.set(r() < 0.35 ? FX_COLORS.violetSoft : FX_COLORS.paper);
          p.fadeFrom = 0.6;
        });
        // light spilling up out of the cracks
        if (r() < 0.35) {
          fx.glows.spawn((p) => {
            p.pos.set(this.center.x + Math.cos(a) * d, 0.2, this.center.z + Math.sin(a) * d);
            p.vel.set(0, 1.5 + r() * 2, 0);
            p.life = 1 + r();
            p.size0 = 0.5 + r() * 0.7;
            p.size1 = 0.1;
            p.color.set(FX_COLORS.violet);
            p.intensity = 1.2;
            p.alpha = 0.6;
            p.fadeIn = 0.2;
            p.fadeFrom = 0.4;
          });
        }
      }
    }

    // panels of the comic tearing loose and slamming down
    for (const s of this.slabs) {
      if (s.landed || this.t < s.startAt || (this.stopped && !s.mesh.visible)) continue;
      s.mesh.visible = true;
      s.vel += COLLAPSE_FX.gravity * step;
      s.mesh.position.y -= s.vel * step;
      s.mesh.rotation.x += s.spin.x * step;
      s.mesh.rotation.y += s.spin.y * step;
      s.mesh.rotation.z += s.spin.z * step;
      if (s.mesh.position.y <= this.restHeight(s)) this.land(s);
    }

    if (!this.done && k >= 1) this.finish();
  }

  private land(s: Slab) {
    s.landed = true;
    s.mesh.position.y = this.restHeight(s);
    s.mesh.rotation.set(s.restX, s.mesh.rotation.y, s.restZ);
    const at = s.mesh.position.clone().setY(0.4);
    const fx = VfxDirector.of(this.scene)?.impact;
    fx?.shatter(at, FX_COLORS.paper);
    fx?.ink(at, new THREE.Vector3(0, 0, 0), 8, FX_COLORS.ink, 6);
    this.scene.add(new Shockwave(at, 3.2, FX_COLORS.violetSoft, 0.4));
    events.emit('fx:shake', { strength: COLLAPSE_FX.landingShake * this.intensity });
    if (this.words < WORDS.length) events.emit('fx:onomatopoeia', { text: WORDS[this.words++], position: at.clone().setY(1.2), color: '#f1e9ff', scale: 1.7 });
  }

  /** Centre height of a slab at rest: flat on the floor, or stuck in it up to a fifth of its length. */
  private restHeight(s: Slab): number {
    const upright = s.restX < 1;
    return upright ? s.mesh.scale.y * 0.5 * Math.cos(s.restX) * 0.8 : 0.14;
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    this.resolve();
  }

  onRemoved() {
    this.cracks.dispose();
    this.slabMats.forEach((m) => m.dispose());
    this.slabGeo.dispose();
    this.outlineGeo.dispose();
    this.finish();
  }
}

/**
 * Start the collapse of the world (the twist). Purely visual; safe to call in any arena.
 *
 *   const collapse = startCollapse(scene);                       // defaults: 7 s around (0,0,0)
 *   startCollapse(scene, { center: warden.position, durationSec: 5 });
 *   await collapse.finished;                                     // optional: wait for it
 *   collapse.stop();                                             // optional: cut it short
 */
export function startCollapse(scene: GameScene, opts: CollapseOptions = {}): Collapse {
  return scene.add(new Collapse(opts));
}
