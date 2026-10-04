import * as THREE from 'three';
import { GameScene, defineScene } from '@/core/GameScene';
import { events } from '@/core/events';
import { buildPlaygroundArena } from '@/world/Arena';
import { ModelGallery } from './ModelGallery';
import { Soul } from '../Soul';

/**
 * Visuals sandbox.  ?scene=visuals&debug
 *   view=models (default)  every character model side by side.  [ and ] cycle their clips.
 * T flips the palette (gold lie ↔ violet truth).
 */
class VisualsScene extends GameScene {
  async load() {
    buildPlaygroundArena(this, { pillars: false });
    const gallery = this.add(new ModelGallery(this.game.uiRoot));
    await gallery.ready;
    this.add(new Soul()).position.set(-2, 0, 2.2);
    this.add(new Soul({ color: '#ffc21a' })).position.set(2, 0, 2.2);

    // a still, slightly lower camera so the whole line-up reads like one comic panel
    const anchor = new THREE.Object3D();
    this.three.add(anchor);
    this.cameraRig.follow(anchor);
    this.cameraRig.setOffset(0, 6.5, 13, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyT') return;
      const next = this.game.palette.mode === 'gold' ? 'violet' : 'gold';
      events.emit('palette:set', { mode: next, durationSec: 1.2 });
    };
    window.addEventListener('keydown', onKey);
    this.listen(() => window.removeEventListener('keydown', onKey));
  }
}

export default defineScene({
  id: 'visuals',
  title: 'Visuals sandbox',
  owner: 'Visuals',
  create: (game) => new VisualsScene(game),
});
