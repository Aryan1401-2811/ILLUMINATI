import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { CharacterModel } from '@/render/CharacterModel';
import { MODEL_CATALOG, type CatalogEntry } from './modelCatalog';

const GALLERY = { spacing: 3.4, z: -1.5, loopOnce: ['attack', 'attack2', 'heavy', 'dodge', 'hit', 'death', 'cast', 'castBig', 'slam', 'bash', 'kneel', 'spawn', 'give'] };

/**
 * Sandbox-only: lines up every shipped character and plays the same "role" clip on all of them,
 * so the toon look, outlines, heights and clip names can be checked at a glance.
 */
export class ModelGallery extends Entity {
  readonly ready: Promise<void>;
  private models: { entry: CatalogEntry; model: CharacterModel }[] = [];
  private roleIndex = 0;
  private replayIn = 0;
  private label = document.createElement('div');

  constructor(private uiRoot: HTMLElement) {
    super();
    this.label.style.cssText =
      'position:absolute;left:18px;bottom:18px;padding:10px 14px;background:#1a1013;color:#fbf1dc;' +
      'font:700 15px/1.5 "Comic Neue",sans-serif;border:3px solid #fbf1dc;white-space:pre';
    this.ready = this.loadAll();
  }

  private async loadAll() {
    const loaded = await Promise.all(
      MODEL_CATALOG.map((entry) => CharacterModel.load(entry.path, { height: entry.height, tint: entry.tint, outlineWidth: 3 })),
    );
    const x0 = -((loaded.length - 1) * GALLERY.spacing) / 2;
    loaded.forEach((model, i) => {
      model.root.position.set(x0 + i * GALLERY.spacing, 0, GALLERY.z);
      this.object.add(model.root);
      this.models.push({ entry: MODEL_CATALOG[i], model });
    });
    this.playRole(0);
  }

  onAdded() {
    this.uiRoot.appendChild(this.label);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'BracketRight') this.playRole(this.roleIndex + 1);
      if (e.code === 'BracketLeft') this.playRole(this.roleIndex - 1);
    };
    window.addEventListener('keydown', onKey);
    this.own(() => window.removeEventListener('keydown', onKey));
    this.own(() => this.label.remove());
  }

  /** Every role name used by at least one model, in first-seen order. */
  get roles(): string[] {
    const out: string[] = [];
    for (const { entry } of this.models) for (const r of Object.keys(entry.clips)) if (!out.includes(r)) out.push(r);
    return out;
  }

  playRole(index: number) {
    const roles = this.roles;
    if (!roles.length) return;
    this.roleIndex = ((index % roles.length) + roles.length) % roles.length;
    const role = roles[this.roleIndex];
    const once = GALLERY.loopOnce.includes(role);
    const lines = [`[ / ]  cycle clips  —  role: ${role.toUpperCase()}`];
    let longest = 0;
    for (const { entry, model } of this.models) {
      const clip = entry.clips[role] ?? entry.clips.idle;
      model.play(clip, { loop: !once || !entry.clips[role], restart: true });
      longest = Math.max(longest, model.clipDuration(clip));
      lines.push(`${entry.label.padEnd(15)} ${clip}${model.has(clip) ? '' : '   ← MISSING CLIP'}`);
    }
    this.replayIn = once ? longest + 0.8 : 0;
    this.label.textContent = lines.join('\n');
  }

  update(dt: number) {
    for (const { model } of this.models) model.update(dt);
    if (this.replayIn > 0 && (this.replayIn -= dt) <= 0) this.playRole(this.roleIndex);
  }
}
