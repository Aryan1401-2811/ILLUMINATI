import * as THREE from 'three';
import { GameScene, defineScene } from '@/core/GameScene';
import { events } from '@/core/events';
import { Player } from '@/player/Player';
import { TrainingDummy } from '@/enemies/TrainingDummy';
import { buildPlaygroundArena } from '@/world/Arena';
import { Sequence } from '@/sequences/Sequence';

/**
 * Boss development sandbox. Use ?scene=bosses&debug to test boss features.
 *
 * On load: runs a 15-second demo cutscene that exercises every Sequence method.
 * After the cutscene: free play with training dummies.
 *
 * Key bindings (sandbox only):
 *   V — swap to violet loadout (test violet abilities)
 *   G — swap back to gold loadout
 *   T — flip palette
 */
class BossesSandbox extends GameScene {
  player!: Player;

  async load() {
    buildPlaygroundArena(this);

    // Spawn the hero
    this.player = this.add(new Player());
    await this.player.ready;
    this.player.position.set(0, 0, 6);
    this.player.setLoadout(['goldBolt', 'goldBurst', null]);
    this.player.gainEnergy(100);
    this.cameraRig.follow(this.player.object);

    // A few dummies for free play after the cutscene
    const dummyPositions: [number, number, boolean][] = [
      [-4, -3, false],
      [0, -5, false],
      [4, -3, false],
      [0, -10, true], // this one shoots gold bolts for testing Radiant Guard
    ];
    for (const [x, z, shoots] of dummyPositions) {
      this.add(new TrainingDummy({ shoots })).position.set(x, 0, z);
    }

    // Player respawn on death
    this.listen(
      events.on('player:died', () => {
        setTimeout(() => this.player.revive(new THREE.Vector3(0, 0, 6)), 1800);
      }),
    );

    // Sandbox key bindings
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyV') {
        // Swap to violet loadout
        this.player.setLoadout(['violetLance', 'radiantGuard', 'soulCall']);
        this.player.setElement('violet');
        this.player.gainEnergy(100);
        events.emit('narrator:say', { text: 'Violet loadout equipped. Q = Lance, E = Guard, R = Soul Call.' });
      }
      if (e.code === 'KeyG') {
        // Swap back to gold loadout
        this.player.setLoadout(['goldBolt', 'goldBurst', null]);
        this.player.setElement('gold');
        this.player.gainEnergy(100);
        events.emit('narrator:say', { text: 'Gold loadout equipped. Q = Bolt, E = Burst.' });
      }
      if (e.code === 'KeyT') {
        const next = this.game.palette.mode === 'gold' ? 'violet' : 'gold';
        events.emit('palette:set', { mode: next, durationSec: 1.2 });
        this.player.setElement(next);
      }
    };
    window.addEventListener('keydown', onKey);
    this.listen(() => window.removeEventListener('keydown', onKey));

    // Run the demo cutscene after a brief delay
    setTimeout(() => this.runDemoCutscene(), 600);
  }

  /**
   * A 15-second demo cutscene that exercises every Sequence API method.
   * This proves the tool works before other team members depend on it.
   */
  private async runDemoCutscene() {
    const seq = new Sequence(this);

    try {
      // --- Lock the player and start the show ---
      await seq.lockPlayer();
      seq.prompt('Press ENTER to skip dialogue', 4);

      await seq.say('Welcome to the boss testing grounds, hero.', 2.5, 'narrator');
      await seq.wait(0.3);

      // --- Dramatic camera move ---
      await seq.say('Let me show you what awaits…', 2, 'narrator');
      await seq.camera(3, 12, 14, 1.2);
      await seq.wait(0.5);

      // --- Shake + palette flip ---
      seq.shake(0.5);
      await seq.wait(0.3);
      seq.palette('violet', 1.5);
      await seq.say('The true light… it was always violet.', 2.5, 'narrator');
      await seq.wait(0.5);

      // --- Flip back ---
      seq.palette('gold', 1.5);
      await seq.say('But you believed my lie. How charming.', 2, 'narrator');
      await seq.wait(0.3);

      // --- Hit-stop demo ---
      seq.hitstop(0.15);
      await seq.wait(0.3);
      seq.shake(0.3);

      // --- Reset and unlock ---
      await seq.resetCamera(0.8);
      await seq.wait(0.3);
      seq.unlockPlayer();

      seq.prompt('V = violet loadout · G = gold · T = flip palette · Free play!', 6);
      await seq.say('Now fight. Prove your worth.', 2, 'narrator');

    } finally {
      seq.dispose();
    }
  }
}

export default defineScene({
  id: 'bosses',
  title: 'Bosses sandbox',
  owner: 'Bosses',
  create: (game) => new BossesSandbox(game),
});
