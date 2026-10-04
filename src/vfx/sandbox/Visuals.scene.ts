import * as THREE from 'three';
import { GameScene, defineScene } from '@/core/GameScene';
import { events } from '@/core/events';
import { HERO_MODEL, Player } from '@/player/Player';
import { TrainingDummy } from '@/enemies/TrainingDummy';
import { buildPlaygroundArena } from '@/world/Arena';
import { buildZone1, buildZone2, buildZone3, type ZoneLayout } from '@/world/zones';
import { ModelGallery } from './ModelGallery';
import { Soul } from '../Soul';
import '../install'; // effects for every scene, see install.ts

const ZONES: Record<string, (scene: GameScene) => ZoneLayout> = {
  zone1: buildZone1,
  zone2: buildZone2,
  zone3: buildZone3,
};

/**
 * Visuals sandbox.  ?scene=visuals&view=<name>&debug
 *   view=zone1 (default), zone2, zone3   walk the arena as the hero; training dummies stand on the enemy spawns
 *   view=models            every character model side by side.  [ and ] cycle their clips.
 * T flips the palette (gold lie ↔ violet truth).
 */
class VisualsScene extends GameScene {
  player: Player | null = null;

  async load() {
    const view = new URLSearchParams(location.search).get('view') ?? 'zone1';
    if (ZONES[view]) await this.loadZone(ZONES[view]);
    else await this.loadGallery();

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyT') return;
      const next = this.game.palette.mode === 'gold' ? 'violet' : 'gold';
      events.emit('palette:set', { mode: next, durationSec: 1.2 });
      this.player?.setElement(next);
    };
    window.addEventListener('keydown', onKey);
    this.listen(() => window.removeEventListener('keydown', onKey));
  }

  private async loadZone(build: (scene: GameScene) => ZoneLayout) {
    const layout = build(this);
    // Sandbox preview only: show the real hero model until Foundation swaps HERO_MODEL for good
    // (values from public/models/MODELS.md).
    Object.assign(HERO_MODEL, {
      path: 'models/hero/hero.glb',
      anims: { idle: 'Idle', run: 'Running_A', attack: '1H_Melee_Attack_Slice_Diagonal', dodge: 'Dodge_Forward', cast: 'Spellcast_Shoot', death: 'Death_A', victory: 'Cheer', walk: 'Walking_A' },
    });
    const player = (this.player = this.add(new Player()));
    await player.ready;
    player.position.copy(layout.playerSpawn);
    player.setLoadout(['goldBolt', 'goldBurst', null]);
    player.gainEnergy(100);
    this.cameraRig.follow(player.object);
    layout.enemySpawns.slice(0, 5).forEach((p, i) => this.add(new TrainingDummy({ shoots: i === 4 })).position.copy(p));
    this.listen(events.on('player:died', () => setTimeout(() => player.revive(layout.playerSpawn), 1500)));
    setTimeout(() => events.emit('ui:prompt', { text: 'VISUALS SANDBOX · WASD · LMB combo · SPACE dodge · Q bolt · E burst · T flip palette', durationSec: 8 }), 300);
  }

  private async loadGallery() {
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
  }
}

export default defineScene({
  id: 'visuals',
  title: 'Visuals sandbox',
  owner: 'Visuals',
  create: (game) => new VisualsScene(game),
});
