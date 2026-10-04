import * as THREE from 'three';
import { GameScene, defineScene } from '@/core/GameScene';
import { events } from '@/core/events';
import { Player } from '@/player/Player';
import { buildPlaygroundArena } from '@/world/Arena';
import { Sequence } from '@/sequences/Sequence';
import { NarratorBoss } from './Narrator';
import { souls } from './souls';

class FinalScene extends GameScene {
  async load() {
    // Swap for buildFinalArena when Visuals person merges it
    buildPlaygroundArena(this);
    
    const player = this.add(new Player());
    await player.ready;
    player.position.set(0, 0, 8);
    player.loadFromRun(); // Loads violet abilities granted in the twist
    
    // Ensure we're in violet palette
    events.emit('palette:set', { mode: 'violet', durationSec: 0 });
    this.cameraRig.follow(player.object);
    
    // Boss intro
    const seq = new Sequence(this);
    await seq.lockPlayer();
    
    const narrator = this.add(new NarratorBoss());
    narrator.position.set(0, 0, -4);
    
    await seq.camera(0, 12, 16, 1.5);
    await seq.say('THE NARRATOR', 2, 'narrator'); // Name card presentation
    seq.beat('final:start');
    await seq.resetCamera(0.8);
    seq.unlockPlayer();
    
    // Defeat cinematic
    this.listen(events.on('boss:defeated', async ({ bossId }) => {
      if (bossId === 'narrator') {
        const endSeq = new Sequence(this);
        endSeq.setSkippable(false);
        await endSeq.lockPlayer();
        
        endSeq.slowMo(0.15, 4);
        endSeq.shake(1.5);
        events.emit('fx:onomatopoeia', { text: 'THE PAGES... THEY TEAR... I AM... ENDLESS—!', position: narrator.position.clone(), scale: 3 });
        
        // Massive flash of light
        events.emit('palette:set', { mode: 'gold', durationSec: 0.1 });
        await endSeq.wait(0.2);
        events.emit('palette:set', { mode: 'violet', durationSec: 0.1 });
        await endSeq.wait(0.2);
        
        // Every remaining soul charge freed at once
        while(souls.charges < 5) souls.addCharge();
        
        await endSeq.say("The final period is mine.", 4, 'hero');
        
        narrator.destroy();
        await endSeq.wait(2);
        
        // Load ending scene (owned by Narrative person)
        await this.game.loadScene('ending');
      }
    }));
    
    // Player death handling
    this.listen(events.on('player:died', () => {
      setTimeout(() => player.revive(new THREE.Vector3(0, 0, 8)), 2000);
    }));
  }
}

export default defineScene({ 
  id: 'final', 
  title: 'The Narrator', 
  owner: 'Bosses', 
  create: (g) => new FinalScene(g) 
});
