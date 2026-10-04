import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import { Enemy } from './Enemy';
import { createEnemy, type EnemyType } from './spawn';
import { SpawnSplash } from './fx/SpawnSplash';
import { MAX_ALIVE_ENEMIES } from './config';

/**
 * A spawn point within a wave.
 */
export interface SpawnDef {
  type: EnemyType;
  x: number;
  z: number;
}

/**
 * A single wave of enemies.
 */
export interface WaveDef {
  /** Delay in seconds before this wave starts (after the previous wave is cleared). */
  delay?: number;
  spawns: SpawnDef[];
}

/**
 * Configuration for an encounter (a sequence of waves).
 */
export interface EncounterConfig {
  id: string;
  waves: WaveDef[];
  zone?: 1 | 2 | 3;
}

/**
 * Encounter (wave spawner). The Narrative person builds zones with it:
 *
 *   const enc = scene.add(new Encounter({
 *     id: 'zone1-a',
 *     waves: [
 *       { spawns: [{ type: 'grunt', x: -3, z: -6 }, { type: 'grunt', x: 3, z: -6 }] },
 *       { delay: 1.0, spawns: [{ type: 'brute', x: 0, z: -8 }] },
 *     ],
 *     zone: 1,
 *   }));
 *   enc.start();   // emits 'encounter:cleared' { encounterId } when every wave is dead
 */
export class Encounter extends Entity {
  private cfg: EncounterConfig;
  private waveIndex = -1;
  private waveDelay = 0;
  private active = false;
  private aliveEnemies: Enemy[] = [];
  private allDead = false;
  /** Spawns of the current wave still waiting for room under MAX_ALIVE_ENEMIES. */
  private queued: SpawnDef[] = [];
  /** Ink splashes playing whose enemy hasn't appeared yet. */
  private pendingSplashes = 0;

  constructor(cfg: EncounterConfig) {
    super();
    this.cfg = cfg;
  }

  /** Begin the encounter. Call once after adding to the scene. */
  start(): void {
    this.active = true;
    this.waveIndex = -1;
    this.allDead = false;
    this.queued = [];
    this.nextWave();
  }

  /** True when every wave has been spawned and every enemy is dead. */
  get cleared(): boolean {
    return this.allDead;
  }

  update(dt: number): void {
    if (!this.active || this.allDead) return;
    if (dt <= 0) return;

    // Waiting for delay before next wave
    if (this.waveDelay > 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) {
        this.spawnCurrentWave();
      }
      return;
    }

    // Clean up dead enemies, then let queued spawns in as room frees up
    this.aliveEnemies = this.aliveEnemies.filter((e) => e.alive && !e.destroyed);
    this.spawnQueued();

    // Current wave cleared? Counting splashes (not a wall-clock timer) means a wave can
    // never be skipped while its enemies are still rising out of the ink — even if the
    // game is paused, in hit-stop, or the tab is in the background.
    if (this.pendingSplashes === 0 && this.queued.length === 0 && this.aliveEnemies.length === 0) {
      if (this.waveIndex >= this.cfg.waves.length - 1) {
        // All waves cleared
        this.allDead = true;
        this.active = false;
        events.emit('encounter:cleared', { encounterId: this.cfg.id });
        return;
      }
      this.nextWave();
    }
  }

  private nextWave(): void {
    this.waveIndex++;
    if (this.waveIndex >= this.cfg.waves.length) return;

    const wave = this.cfg.waves[this.waveIndex];
    const delay = wave.delay ?? 0;

    if (delay > 0) {
      this.waveDelay = delay;
    } else {
      this.spawnCurrentWave();
    }
  }

  private spawnCurrentWave(): void {
    const wave = this.cfg.waves[this.waveIndex];
    if (!wave) return;
    this.queued = [...wave.spawns];
    this.spawnQueued();
  }

  /** Spawn as many queued enemies as MAX_ALIVE_ENEMIES allows; the rest wait their turn. */
  private spawnQueued(): void {
    const zone = this.cfg.zone ?? 1;
    while (this.queued.length > 0 && this.aliveEnemies.length + this.pendingSplashes < MAX_ALIVE_ENEMIES) {
      const spawnDef = this.queued.shift()!;
      const spawnPos = new THREE.Vector3(
        this.position.x + spawnDef.x,
        0,
        this.position.z + spawnDef.z,
      );

      // Ink-splash spawn-in effect
      this.pendingSplashes++;
      this.scene.add(new SpawnSplash(spawnPos, () => {
        this.pendingSplashes--;
        if (this.destroyed || !this.active) return; // encounter was torn down mid-splash
        const enemy = createEnemy(spawnDef.type, { zone });
        this.scene.add(enemy);
        enemy.position.copy(spawnPos);
        this.aliveEnemies.push(enemy);
      }));
    }
  }
}
