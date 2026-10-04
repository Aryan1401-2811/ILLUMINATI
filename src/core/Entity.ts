import * as THREE from 'three';
import type { GameScene } from './GameScene';

/**
 * Base class for anything that lives in a scene and updates every frame:
 * player, enemies, bosses, projectiles, VFX, pickups, triggers.
 *
 *   const e = scene.add(new MyThing());   // adds e.object to the 3D scene, calls onAdded()
 *   e.destroy();                          // removed at end of frame, onRemoved() called
 */
export abstract class Entity {
  /** Root 3D object. Put your meshes under it. Its position IS the entity's position. */
  readonly object = new THREE.Group();
  /** Set by scene.add(). Valid from onAdded() onward. */
  scene!: GameScene;
  /** True after destroy(); the scene removes it at the end of the frame. */
  destroyed = false;
  /** Cleanups run on removal (event unsubscribes, hurtbox unregisters…). */
  private cleanups: (() => void)[] = [];

  get position(): THREE.Vector3 {
    return this.object.position;
  }

  /** Called once after being added to a scene. */
  onAdded(): void {}

  /** Called every frame with scaled delta time (0 during hit-stop/pause). */
  update(_dt: number): void {}

  /** Called once when removed from the scene. */
  onRemoved(): void {}

  /** Mark for removal at the end of this frame. */
  destroy(): void {
    this.destroyed = true;
  }

  /** Register a cleanup (e.g. the return value of events.on or combat.register). */
  own(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  /** @internal called by GameScene. */
  _runCleanups(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
  }
}
