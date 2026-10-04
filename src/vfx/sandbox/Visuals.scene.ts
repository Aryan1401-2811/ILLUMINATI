import * as THREE from 'three';
import { GameScene, defineScene } from '@/core/GameScene';
import { events } from '@/core/events';
import { HERO_MODEL, Player } from '@/player/Player';
import { TrainingDummy } from '@/enemies/TrainingDummy';
import { buildPlaygroundArena } from '@/world/Arena';
import { buildFinalArena, buildWardenArena, buildZone1, buildZone2, buildZone3, type ZoneLayout } from '@/world/zones';
import { ModelGallery } from './ModelGallery';
import { StandIn, yawToward } from './StandIn';
import { Soul } from '../Soul';
import { startCollapse } from '../Collapse';
import '../install'; // effects for every scene, see install.ts

const ZONES: Record<string, (scene: GameScene) => ZoneLayout> = {
  zone1: buildZone1,
  zone2: buildZone2,
  zone3: buildZone3,
  warden: buildWardenArena,
  final: buildFinalArena,
};

/** Which models stand on the enemy spawns of each arena (after the first three, which get dummies). */
const CAST: Record<string, string[]> = {
  zone1: ['grunt', 'grunt', 'grunt', 'grunt', 'grunt'],
  zone2: ['brute', 'grunt', 'grunt', 'brute', 'grunt', 'grunt', 'grunt'],
  zone3: ['grunt', 'brute', 'grunt', 'grunt', 'brute', 'grunt', 'grunt'],
  warden: ['warden'],
  final: ['narrator'],
};
const DUMMIES = 3;

/**
 * Visuals sandbox.  ?scene=visuals&view=<name>&debug
 *   view=zone1 (default), zone2, zone3, warden, final   walk the arena as the hero. Three training
 *                          dummies to hit, plus the real character models standing in as the cast.
 *   view=models            every character model side by side.  [ and ] cycle their clips.
 * T flips the palette (gold lie ↔ violet truth).  C starts the collapse.  X plays the whole twist.
 */
class VisualsScene extends GameScene {
  player: Player | null = null;

  async load() {
    const view = new URLSearchParams(location.search).get('view') ?? 'zone1';
    if (ZONES[view]) await this.loadZone(ZONES[view], CAST[view] ?? []);
    else await this.loadGallery();
    // the final arena only exists after the twist: show it in the violet truth
    if (view === 'final') {
      events.emit('palette:set', { mode: 'violet', durationSec: 0 });
      this.player?.setElement('violet');
    }

    const flip = () => {
      const next = this.game.palette.mode === 'gold' ? 'violet' : 'gold';
      events.emit('palette:set', { mode: next, durationSec: 1.2 });
      this.player?.setElement(next);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyT') flip();
      if (e.code === 'KeyC') startCollapse(this);
      if (e.code === 'KeyX') {
        // the whole twist beat, as the Bosses sequence will play it
        if (this.game.palette.mode === 'gold') flip();
        startCollapse(this);
      }
    };
    window.addEventListener('keydown', onKey);
    this.listen(() => window.removeEventListener('keydown', onKey));
  }

  private async loadZone(build: (scene: GameScene) => ZoneLayout, cast: string[]) {
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
    // Boss arenas: the boss stands on spawn 0 and the dummies move down the list.
    const boss = cast.length === 1;
    const spawns = [...layout.enemySpawns];
    const standIns: Promise<void>[] = [];
    if (boss) {
      const at = spawns.shift()!;
      const s = this.add(new StandIn(cast[0], cast[0] === 'narrator' ? 'float' : 'block', yawToward(at, layout.playerSpawn), cast[0] === 'narrator' ? 0.7 : 0));
      s.position.copy(at);
      standIns.push(s.ready);
      if (cast[0] === 'narrator') for (const [dx, dz] of [[-2.2, 0.6], [2.2, 0.6], [0, -1.8]]) this.add(new Soul()).position.set(at.x + dx, 1.4, at.z + dz);
    }
    spawns.slice(0, DUMMIES).forEach((p) => this.add(new TrainingDummy()).position.copy(p));
    if (!boss) {
      spawns.slice(DUMMIES).forEach((p, i) => {
        if (!cast[i]) return;
        const s = this.add(new StandIn(cast[i], 'idle', yawToward(p, layout.playerSpawn)));
        s.position.copy(p);
        standIns.push(s.ready);
      });
    }
    await Promise.all(standIns);
    this.listen(events.on('player:died', () => setTimeout(() => player.revive(layout.playerSpawn), 1500)));
    setTimeout(() => events.emit('ui:prompt', { text: 'VISUALS SANDBOX · WASD · LMB combo · SPACE dodge · Q bolt · E burst · T flip · C collapse · X twist', durationSec: 8 }), 300);
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
