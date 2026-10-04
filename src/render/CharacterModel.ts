import * as THREE from 'three';
import { loadModel } from '@/core/assets';
import { toonify, type ToonifyOptions } from './toon';

export interface CharacterModelOptions extends ToonifyOptions {
  /** Scale the model so it is this tall (metres). */
  height?: number;
  /** Extra yaw (radians) if the model doesn't face +Z. */
  yawOffset?: number;
}

export interface PlayOptions {
  loop?: boolean;
  /** Crossfade seconds. */
  fade?: number;
  timeScale?: number;
  /** Restart even if already playing. */
  restart?: boolean;
}

/**
 * An animated, toon-shaded character loaded from a .glb.
 *
 *   const model = await CharacterModel.load('models/hero.glb', { height: 1.8 });
 *   entity.object.add(model.root);
 *   model.play('Running');
 *   model.update(dt);           // every frame
 *   model.flash();              // white hit flash
 */
export class CharacterModel {
  readonly root = new THREE.Group();
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private currentName = '';
  private materials: THREE.MeshToonMaterial[] = [];
  private flashLeft = 0;
  private flashDur = 0;
  private flashColor = new THREE.Color();
  private baseEmissive: THREE.Color[] = [];

  private constructor(model: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
    model.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (!m || o.userData.isOutline) return;
      for (const mat of Array.isArray(m) ? m : [m]) {
        if ((mat as THREE.MeshToonMaterial).isMeshToonMaterial) {
          this.materials.push(mat as THREE.MeshToonMaterial);
          this.baseEmissive.push((mat as THREE.MeshToonMaterial).emissive.clone());
        }
      }
    });
  }

  static async load(path: string, opts: CharacterModelOptions = {}): Promise<CharacterModel> {
    const { root, animations } = await loadModel(path);
    if (opts.height) {
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root, true);
      const h = box.max.y - box.min.y;
      if (h > 0) root.scale.multiplyScalar(opts.height / h);
      root.updateMatrixWorld(true);
      const box2 = new THREE.Box3().setFromObject(root, true);
      root.position.y -= box2.min.y;
    }
    if (opts.yawOffset) root.rotation.y += opts.yawOffset;
    toonify(root, opts);
    return new CharacterModel(root, animations);
  }

  /** Wrap an already-built Object3D (procedural/placeholder characters). */
  static fromObject(obj: THREE.Object3D, clips: THREE.AnimationClip[] = []): CharacterModel {
    return new CharacterModel(obj, clips);
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  get playing(): string {
    return this.currentName;
  }

  clipDuration(name: string): number {
    return this.actions.get(name)?.getClip().duration ?? 0;
  }

  play(name: string, opts: PlayOptions = {}): THREE.AnimationAction | null {
    const action = this.actions.get(name);
    if (!action) return null;
    const { loop = true, fade = 0.12, timeScale = 1, restart = false } = opts;
    action.timeScale = timeScale;
    if (this.current === action && !restart) return action;
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.enabled = true;
    action.setEffectiveWeight(1);
    if (this.current && this.current !== action) action.crossFadeFrom(this.current, fade, false);
    action.play();
    this.current = action;
    this.currentName = name;
    return action;
  }

  /** Brief emissive flash (hit feedback). */
  flash(color: THREE.ColorRepresentation = 0xffffff, durationSec = 0.12) {
    this.flashColor.set(color);
    this.flashLeft = this.flashDur = durationSec;
  }

  /** Set a constant emissive glow on every material (e.g. charged-up state). */
  setGlow(color: THREE.ColorRepresentation, intensity: number) {
    const c = new THREE.Color(color).multiplyScalar(intensity);
    this.baseEmissive.forEach((b) => b.copy(c));
    this.materials.forEach((m, i) => m.emissive.copy(this.baseEmissive[i]));
  }

  update(dt: number) {
    this.mixer.update(dt);
    if (this.flashLeft > 0) {
      this.flashLeft -= dt > 0 ? dt : 1 / 60;
      const k = Math.max(0, this.flashLeft / this.flashDur);
      this.materials.forEach((m, i) => m.emissive.copy(this.baseEmissive[i]).lerp(this.flashColor, k));
    }
  }
}
