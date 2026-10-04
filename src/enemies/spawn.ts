import { Grunt } from './Grunt';
import { Brute } from './Brute';
import type { Enemy } from './Enemy';

export type EnemyType = 'grunt' | 'brute';

export interface SpawnOptions {
  zone?: 1 | 2 | 3;
}

/**
 * Factory function for creating enemies by type.
 * The Narrative person uses this (through Encounter) to build zone fights.
 *
 *   const grunt = createEnemy('grunt', { zone: 2 });
 *   scene.add(grunt).position.set(3, 0, -5);
 */
export function createEnemy(type: EnemyType, opts: SpawnOptions = {}): Enemy {
  const zone = opts.zone ?? 1;

  switch (type) {
    case 'grunt':
      return new Grunt(zone);
    case 'brute':
      return new Brute(zone);
    default:
      throw new Error(`Unknown enemy type: "${type}". Known: grunt, brute`);
  }
}
