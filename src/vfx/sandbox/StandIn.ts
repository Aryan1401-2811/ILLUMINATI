import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { CharacterModel } from '@/render/CharacterModel';
import { MODEL_CATALOG } from './modelCatalog';

/**
 * Sandbox-only: a character model standing in an arena, looping one clip. It cannot be hit and
 * has no AI — it exists so the art can be judged with the real cast on the real floors
 * (do the Shades pop? is the Warden readable against his sanctum?) before the Enemies and
 * Bosses code lands.
 */
export class StandIn extends Entity {
  readonly ready: Promise<void>;
  private model: CharacterModel | null = null;

  constructor(id: string, role = 'idle', yaw = 0, lift = 0) {
    super();
    const entry = MODEL_CATALOG.find((m) => m.id === id);
    if (!entry) throw new Error(`StandIn: no model "${id}" in the catalogue`);
    this.ready = CharacterModel.load(entry.path, { height: entry.height, tint: entry.tint, outlineWidth: entry.height > 2.8 ? 4 : 3 }).then((model) => {
      this.model = model;
      model.root.position.y = lift;
      this.object.add(model.root);
      this.object.rotation.y = yaw;
      model.play(entry.clips[role] ?? entry.clips.idle);
      model.mixer.update(Math.random() * 2); // de-sync the crowd
    });
  }

  update(dt: number) {
    this.model?.update(dt);
  }

  onRemoved() {
    if (this.model) disposeSkeletons(this.model.root);
  }
}

/** Free the bone textures of a skinned model (CharacterModel has no dispose of its own yet). */
export function disposeSkeletons(root: THREE.Object3D) {
  root.traverse((o) => (o as THREE.SkinnedMesh).skeleton?.dispose());
}

/** Face from `from` toward `to` (yaw in radians; models face +Z). */
export function yawToward(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}
