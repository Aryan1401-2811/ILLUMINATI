import * as THREE from 'three';
import { GameScene, defineScene } from '@/core/GameScene';
import { events } from '@/core/events';
import { Player } from '@/player/Player';
import { buildWardenArena } from '@/world/zones';
import { loadGLTF } from '@/core/assets';
import { WARDEN, NARRATOR_BOSS } from './config';
import { Sequence } from '@/sequences/Sequence';
import { Warden } from './Warden';
import { runTwist } from '@/sequences/twist';

class WardenScene extends GameScene {
  async load() {
    const layout = buildWardenArena(this);
    // Warm the cache so the Warden and the Narrator (who steps out in the twist) don't pop in
    await Promise.all([loadGLTF(WARDEN.model), loadGLTF(NARRATOR_BOSS.model)]);

    const player = this.add(new Player());
    await player.ready;
    player.position.copy(layout.playerSpawn);
    player.loadFromRun();
    this.cameraRig.follow(player.object);
    
    const warden = this.add(new Warden());
    warden.position.copy(layout.enemySpawns[0] ?? new THREE.Vector3(0, 0, -4));
    
    // Cinematic Boss Intro (un-awaited so load() can finish and game can render)
    void (async () => {
      const seq = new Sequence(this);
      await seq.lockPlayer();
      await seq.camera(0, 10, 14, 1.2);
      await seq.say('THE WARDEN', 1.5, 'narrator'); // Name card presentation
      seq.beat('warden:start');
      await seq.wait(0.5);
      await seq.resetCamera(0.8);
      seq.unlockPlayer();
    })();
    
    // ── Normal defeat path (shared by real kill and skip) ──────────────
    const triggerDefeat = () => {
      events.emit('story:beat', { id: 'warden:defeated' });
      console.log("Warden defeated! Transitioning to twist sequence...");
      runTwist(this, player, warden);
    };

    let defeated = false;
    this.listen(events.on('boss:defeated', ({ bossId }) => {
      if (bossId === 'warden' && !defeated) {
        defeated = true;
        triggerDefeat();
      }
    }));

    // ── R2 Task 4: SKIP support ───────────────────────────────────────
    this.listen(events.on('flow:skip', ({ sceneId }) => {
      if (sceneId !== 'warden' || defeated) return;
      defeated = true;
      // Force the Warden through the normal defeat path so music/story beats fire
      warden.forceDefeat();
      triggerDefeat();
    }));
    
  }
}

export default defineScene({ 
  id: 'warden', 
  title: 'The Warden', 
  owner: 'Bosses', 
  create: (g) => new WardenScene(g) 
});
