import type * as THREE from 'three';

/** What every arena builder returns. Positions are on the ground (y = 0). */
export interface ZoneLayout {
  /** Where the hero starts. */
  playerSpawn: THREE.Vector3;
  /** Good places for enemies to appear, roughly ordered from the first fight to the last. */
  enemySpawns: THREE.Vector3[];
  /** Where the hero leaves the arena (walk here to continue). */
  exit: THREE.Vector3;
}
