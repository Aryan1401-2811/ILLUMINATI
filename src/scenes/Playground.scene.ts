import * as THREE from 'three';
import { GameScene, defineScene } from '@/core/GameScene';
import { events } from '@/core/events';
import { Player } from '@/player/Player';
import { TrainingDummy } from '@/enemies/TrainingDummy';
import { buildPlaygroundArena } from '@/world/Arena';

/**
 * Foundation test scene: the hero, training dummies and one shooting dummy.
 * Use it to feel the combat. Press T to flip the palette (preview of the twist).
 */
class PlaygroundScene extends GameScene {
  player!: Player;

  async load() {
    buildPlaygroundArena(this);

    this.player = this.add(new Player());
    await this.player.ready;
    this.player.position.set(0, 0, 4);
    this.player.setLoadout(['goldBolt', 'goldBurst', null]);
    this.player.gainEnergy(60);
    this.cameraRig.follow(this.player.object);

    const dummies: [number, number, boolean][] = [
      [-3, -2, false],
      [0, -3.5, false],
      [3, -2, false],
      [0, -10, true],
    ];
    for (const [x, z, shoots] of dummies) this.add(new TrainingDummy({ shoots })).position.set(x, 0, z);

    this.listen(
      events.on('player:died', () => {
        setTimeout(() => this.player.revive(new THREE.Vector3(0, 0, 4)), 1800);
      }),
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyT') {
        const next = this.game.palette.mode === 'gold' ? 'violet' : 'gold';
        events.emit('palette:set', { mode: next, durationSec: 1.2 });
        this.player.setElement(next);
      }
    };
    window.addEventListener('keydown', onKey);
    this.listen(() => window.removeEventListener('keydown', onKey));

    setTimeout(() => {
      events.emit('narrator:say', { text: 'Ah, a hero at last! Strike those practice dummies — show me what you can do.' });
      events.emit('ui:prompt', { text: 'WASD move · LMB combo · SPACE dodge · Q/RMB bolt · E burst · T flip palette', durationSec: 8 });
    }, 400);
  }
}

export default defineScene({
  id: 'playground',
  title: 'Foundation playground',
  owner: 'Foundation',
  create: (game) => new PlaygroundScene(game),
});
