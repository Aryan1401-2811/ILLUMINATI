import * as THREE from 'three';
import type { Game } from './Game';
import { Entity } from './Entity';
import { events } from './events';
import { CombatWorld } from '@/combat/combat';
import { Collision } from '@/world/Collision';
import { CameraRig } from '@/camera/CameraRig';
import { StageLighting } from '@/render/StageLighting';

/**
 * A playable scene: a 3D world + its entities, combat registry, collision, camera and lights.
 *
 * Make one by creating a file ending in `.scene.ts` anywhere under src/ that default-exports
 * defineScene({...}). It is picked up automatically and opened with `?scene=<id>`.
 */
export abstract class GameScene {
  readonly three = new THREE.Scene();
  readonly combat = new CombatWorld();
  readonly collision = new Collision();
  readonly cameraRig: CameraRig;
  readonly lighting: StageLighting;

  private entities: Entity[] = [];
  private pending: Entity[] = [];
  private cleanups: (() => void)[] = [];
  private _v = new THREE.Vector3();

  constructor(readonly game: Game) {
    this.cameraRig = new CameraRig(game.camera);
    this.lighting = new StageLighting(this.three);
    this.listen(events.on('fx:shake', ({ strength }) => this.cameraRig.addShake(strength)));
  }

  /** Build the world: load models, add entities. Awaited before the first frame. */
  abstract load(): Promise<void>;

  /** Optional per-frame logic for the scene itself (wave spawning, triggers, scripting). */
  protected onUpdate(_dt: number, _realDt: number): void {}

  /** Add an entity. Returns it for chaining: `const p = scene.add(new Player())`. */
  add<T extends Entity>(entity: T): T {
    entity.scene = this;
    this.three.add(entity.object);
    this.pending.push(entity);
    entity.onAdded();
    return entity;
  }

  /** All live entities of a class, e.g. scene.getAll(Player). */
  getAll<T extends Entity>(ctor: abstract new (...args: any[]) => T): T[] {
    return [...this.entities, ...this.pending].filter((e): e is T => e instanceof ctor && !e.destroyed);
  }

  getFirst<T extends Entity>(ctor: abstract new (...args: any[]) => T): T | undefined {
    return this.getAll(ctor)[0];
  }

  /** Keep an unsubscribe/cleanup to run when the scene is unloaded. */
  listen(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  /** @internal called by Game every frame. */
  update(dt: number, realDt: number) {
    if (this.pending.length) {
      this.entities.push(...this.pending);
      this.pending = [];
    }
    for (const e of this.entities) if (!e.destroyed) e.update(dt);
    this.separateBodies();
    this.onUpdate(dt, realDt);

    // remove dead entities
    let write = 0;
    for (const e of this.entities) {
      if (!e.destroyed) this.entities[write++] = e;
      else this.removeEntity(e);
    }
    this.entities.length = write;

    this.lighting.update(this.game.palette.current, this.three, this.cameraRig.focus);
    this.cameraRig.update(realDt);
  }

  /** Stop characters overlapping each other. Heavier `mass` pushes lighter. */
  private separateBodies() {
    const bodies = [...this.combat.all()].filter((h) => h.alive && h.mass !== 0);
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const d = this._v.subVectors(b.position, a.position).setY(0);
        const min = a.radius + b.radius;
        const len = d.length();
        if (len >= min || len < 1e-5) continue;
        const ma = a.mass ?? 1;
        const mb = b.mass ?? 1;
        const push = (min - len) / len;
        a.position.addScaledVector(d, (-push * mb) / (ma + mb));
        b.position.addScaledVector(d, (push * ma) / (ma + mb));
      }
    }
  }

  private removeEntity(e: Entity) {
    e._runCleanups();
    e.onRemoved();
    e.object.removeFromParent();
  }

  /** @internal called by Game when switching scenes. */
  dispose() {
    for (const e of [...this.entities, ...this.pending]) this.removeEntity(e);
    this.entities = [];
    this.pending = [];
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.three.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose?.();
    });
  }
}

export interface SceneDef {
  /** URL id: ?scene=<id> */
  id: string;
  title: string;
  /** Who owns it (shown in the scene picker). */
  owner?: string;
  create(game: Game): GameScene;
}

export function defineScene(def: SceneDef): SceneDef {
  return def;
}
