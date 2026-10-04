import * as THREE from 'three';
import { GameScene, defineScene } from '@/core/GameScene';
import { events } from '@/core/events';
import { Player } from '@/player/Player';
import { buildPlaygroundArena } from '@/world/Arena';
import { Sequence } from '@/sequences/Sequence';
import { Warden } from './Warden';
import { runTwist } from '@/sequences/twist';

class WardenScene extends GameScene {
  async load() {
    // Swap for buildWardenArena when Visuals person merges it
    buildPlaygroundArena(this);
    
    const player = this.add(new Player());
    await player.ready;
    player.position.set(0, 0, 8);
    player.loadFromRun();
    this.cameraRig.follow(player.object);
    
    const warden = this.add(new Warden());
    warden.position.set(0, 0, -4);
    
    // Cinematic Boss Intro
    const seq = new Sequence(this);
    await seq.lockPlayer();
    await seq.camera(0, 10, 14, 1.2);
    await seq.say('THE WARDEN', 1.5, 'narrator'); // Name card presentation
    seq.beat('warden:start');
    await seq.wait(0.5);
    await seq.resetCamera(0.8);
    seq.unlockPlayer();
    
    this.listen(events.on('boss:defeated', ({ bossId }) => {
      if (bossId === 'warden') {
        console.log("Warden defeated! Transitioning to twist sequence...");
        runTwist(this, player, warden);
      }
    }));
    
    // Player death handling
    this.listen(events.on('player:died', () => {
      setTimeout(() => player.revive(new THREE.Vector3(0, 0, 8)), 2000);
    }));
  }
}

export default defineScene({ 
  id: 'warden', 
  title: 'The Warden', 
  owner: 'Bosses', 
  create: (g) => new WardenScene(g) 
});
