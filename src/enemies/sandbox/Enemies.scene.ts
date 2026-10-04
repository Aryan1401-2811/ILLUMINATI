import * as THREE from 'three';
import { GameScene, defineScene } from '@/core/GameScene';
import { events } from '@/core/events';
import { Player } from '@/player/Player';
import { buildPlaygroundArena } from '@/world/Arena';
import { Grunt } from '../Grunt';
import { Brute } from '../Brute';
import { Encounter } from '../Encounter';
import { ArmouredDummy } from './ArmouredDummy';
import type { Enemy } from '../Enemy';

/**
 * Enemies sandbox scene. Test all enemy types, armour, telegraphs, and encounters.
 *
 *   Open: http://localhost:5173/?scene=enemies&debug
 *
 * Controls:
 *   - WASD to move, LMB for combo, Space to dodge, Q bolt, E burst
 *   - T to flip palette (gold ↔ violet)
 *   - G to spawn a grunt, B to spawn a brute
 *   - N to start a 3-wave encounter
 */
class EnemiesSandbox extends GameScene {
  player!: Player;
  private encounterActive = false;

  async load() {
    buildPlaygroundArena(this, { radius: 18 });

    // ── Player ───────────────────────────────────────────────────────────
    this.player = this.add(new Player());
    await this.player.ready;
    this.player.position.set(0, 0, 6);
    this.player.setLoadout(['goldBolt', 'goldBurst', null]);
    this.player.gainEnergy(100);
    this.cameraRig.follow(this.player.object);

    // ── Initial enemies: a few grunts spread out ─────────────────────────
    const gruntPositions: [number, number][] = [
      [-4, -3],
      [-2, -5],
      [2, -5],
      [4, -3],
    ];
    for (const [x, z] of gruntPositions) {
      this.add(new Grunt(1)).position.set(x, 0, z);
    }

    // ── Armoured dummies ─────────────────────────────────────────────────
    this.add(new ArmouredDummy()).position.set(-6, 0, 0);
    this.add(new ArmouredDummy()).position.set(0, 0, -4);
    this.add(new ArmouredDummy()).position.set(6, 0, 0);

    // ── One brute in the back ────────────────────────────────────────────
    this.add(new Brute(2)).position.set(0, 0, -8);

    // ── Respawn player on death ──────────────────────────────────────────
    this.listen(
      events.on('player:died', () => {
        setTimeout(() => this.player.revive(new THREE.Vector3(0, 0, 6)), 1800);
      }),
    );

    // ── Keyboard shortcuts ───────────────────────────────────────────────
    const onKey = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyT': {
          // Palette flip
          const next = this.game.palette.mode === 'gold' ? 'violet' : 'gold';
          events.emit('palette:set', { mode: next, durationSec: 1.2 });
          this.player.setElement(next);
          break;
        }
        case 'KeyG': {
          // Spawn a grunt near the player
          const angle = Math.random() * Math.PI * 2;
          const dist = 5 + Math.random() * 3;
          const x = this.player.position.x + Math.cos(angle) * dist;
          const z = this.player.position.z + Math.sin(angle) * dist;
          this.add(new Grunt(1)).position.set(x, 0, z);
          events.emit('narrator:say', { text: 'A Shade emerges from the ink…', durationSec: 2 });
          break;
        }
        case 'KeyB': {
          // Spawn a brute near the player
          const angle = Math.random() * Math.PI * 2;
          const dist = 6 + Math.random() * 3;
          const x = this.player.position.x + Math.cos(angle) * dist;
          const z = this.player.position.z + Math.sin(angle) * dist;
          this.add(new Brute(2)).position.set(x, 0, z);
          events.emit('narrator:say', { text: 'An armoured behemoth appears!', durationSec: 2 });
          break;
        }
        case 'KeyN': {
          // Start a 3-wave encounter
          if (!this.encounterActive) {
            this.startTestEncounter();
          }
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    this.listen(() => window.removeEventListener('keydown', onKey));

    // ── Welcome message ──────────────────────────────────────────────────
    setTimeout(() => {
      events.emit('narrator:say', {
        text: 'The Shades stir in the darkness. Strike them down, hero!',
        durationSec: 4,
      });
      events.emit('ui:prompt', {
        text: 'WASD move · LMB combo · SPACE dodge · Q bolt · E burst · T palette · G grunt · B brute · N encounter',
        durationSec: 10,
      });
    }, 400);
  }

  private startTestEncounter(): void {
    this.encounterActive = true;
    events.emit('narrator:say', { text: 'They come in waves! Stand your ground!', durationSec: 3 });

    const enc = this.add(new Encounter({
      id: 'sandbox-test',
      waves: [
        {
          spawns: [
            { type: 'grunt', x: -4, z: -8 },
            { type: 'grunt', x: 0, z: -9 },
            { type: 'grunt', x: 4, z: -8 },
          ],
        },
        {
          delay: 1.5,
          spawns: [
            { type: 'grunt', x: -5, z: -7 },
            { type: 'grunt', x: 5, z: -7 },
            { type: 'brute', x: 0, z: -10 },
          ],
        },
        {
          delay: 2.0,
          spawns: [
            { type: 'brute', x: -3, z: -9 },
            { type: 'brute', x: 3, z: -9 },
            { type: 'grunt', x: 0, z: -7 },
            { type: 'grunt', x: -6, z: -6 },
          ],
        },
      ],
      zone: 1,
    }));
    enc.position.set(0, 0, 0);
    enc.start();

    // One listener per run; it removes itself, so pressing N again doesn't stack them.
    const off = events.on('encounter:cleared', ({ encounterId }) => {
      if (encounterId !== 'sandbox-test') return;
      off();
      enc.destroy();
      this.encounterActive = false;
      events.emit('narrator:say', { text: 'Well fought! The Shades have fallen.', durationSec: 3 });
    });
    this.listen(off);
  }
}

export default defineScene({
  id: 'enemies',
  title: 'Enemies sandbox',
  owner: 'Enemies',
  create: (game) => new EnemiesSandbox(game),
});
