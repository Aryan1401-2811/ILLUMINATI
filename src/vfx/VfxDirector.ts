import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events, type GameEvents } from '@/core/events';
import type { GameScene } from '@/core/GameScene';
import { livePalette } from '@/render/palette';
import { AmbientParticles } from './AmbientParticles';
import { ComicWords } from './ComicWords';
import { ImpactFx, elementColor } from './ImpactFx';
import { FX_COLORS, WORDS } from './config';
import { fxDt } from './fxTime';

/**
 * One per scene. Listens to gameplay events and turns them into visual effects, so no other
 * module ever has to call the VFX code: emit `combat:hit`, `enemy:killed`, `fx:onomatopoeia`…
 * and the page reacts. It is added to every scene automatically by `vfx/install.ts`.
 *
 *   VfxDirector.of(scene)?.impact.splat(...)   // direct access for other effects in src/vfx
 */
export class VfxDirector extends Entity {
  readonly words = new ComicWords();
  readonly impact = new ImpactFx();
  readonly ambient = new AmbientParticles();
  private lastShatterAt = new THREE.Vector3(1e9, 0, 0);
  private lastShatterAge = 99;

  static of(scene: GameScene): VfxDirector | undefined {
    return scene.getFirst(VfxDirector);
  }

  onAdded() {
    this.object.add(this.ambient.group, this.impact.group, this.words.group);
    this.own(events.on('combat:hit', (e) => this.onHit(e)));
    this.own(events.on('fx:onomatopoeia', (e) => this.onWord(e)));
    this.own(events.on('enemy:killed', ({ position }) => this.impact.death(position, FX_COLORS.violetSoft)));
    this.own(events.on('armour:shellBroken', ({ position }) => this.shatter(position, true)));
    this.own(events.on('armour:coreBroken', ({ position }) => this.impact.shatter(position, FX_COLORS.violetSoft)));
  }

  update(dt: number) {
    const step = fxDt(dt);
    this.lastShatterAge += step;
    this.impact.update(step);
    this.words.update(step);
    // `tear` is 0 on the gold page and 1 on the violet one, and blends during the flip
    this.ambient.update(step, this.scene.cameraRig.focus, livePalette.current.tear);
  }

  onRemoved() {
    this.impact.dispose();
    this.words.dispose();
    this.ambient.dispose();
  }

  private onHit({ hit, result, position, targetTeam }: GameEvents['combat:hit']) {
    const energy = hit.kind === 'energy';
    const color = energy ? elementColor(hit.element) : hit.element === 'violet' ? FX_COLORS.violetSoft : FX_COLORS.goldHot;
    switch (result) {
      case 'immune':
        return;
      case 'deflected':
        this.impact.ping(position, FX_COLORS.steel);
        this.words.popStyle(WORDS.deflected, position);
        return;
      case 'blocked':
        this.impact.ping(position, FX_COLORS.steel);
        this.words.popStyle(WORDS.blocked, position);
        return;
      case 'shellHit':
        this.impact.hit(position, hit.from, FX_COLORS.steel, false);
        this.words.popStyle(WORDS.shellHit, position);
        return;
      case 'shellBroken':
        this.impact.hit(position, hit.from, FX_COLORS.steel, true);
        this.shatter(position, false);
        this.words.popStyle(WORDS.shellBroken, position);
        return;
      case 'coreHit':
        this.impact.hit(position, hit.from, color, hit.heavy);
        this.words.popStyle(WORDS.coreHit, position);
        return;
      case 'killed':
        this.impact.hit(position, hit.from, color, true);
        if (targetTeam !== 'player') this.words.popStyle(WORDS.ko, position);
        return;
      case 'damaged':
        if (targetTeam === 'player') {
          this.impact.hit(position, hit.from, FX_COLORS.danger, false);
          this.words.popStyle(WORDS.ouch, position);
          return;
        }
        this.impact.hit(position, hit.from, color, hit.heavy);
        if (hit.heavy) this.words.popStyle(WORDS.heavy, position);
        else if (energy) this.words.popStyle(hit.element === 'violet' ? WORDS.energyViolet : WORDS.energy, position);
        else this.words.popStyle(WORDS.light, position);
    }
  }

  /** Any module can print its own sound effect: events.emit('fx:onomatopoeia', { text, position }). */
  private onWord({ text, position, color, scale }: GameEvents['fx:onomatopoeia']) {
    const fill = color ?? WORDS.light.fill;
    const fill2 = color ? `#${new THREE.Color(color).multiplyScalar(0.6).getHexString()}` : WORDS.light.fill2;
    const s = scale ?? 1;
    this.words.pop(text, position, fill, fill2, 1.1 * s, 0.7 + 0.2 * s, s >= 1.5);
  }

  /** Shell shards. `combat:hit` and `armour:shellBroken` both report a break — only burst once. */
  private shatter(position: THREE.Vector3, withWord: boolean) {
    if (this.lastShatterAge < 0.2 && this.lastShatterAt.distanceToSquared(position) < 9) return;
    this.lastShatterAge = 0;
    this.lastShatterAt.copy(position);
    this.impact.shatter(position, FX_COLORS.steel);
    if (withWord) this.words.popStyle(WORDS.shellBroken, position);
  }
}
