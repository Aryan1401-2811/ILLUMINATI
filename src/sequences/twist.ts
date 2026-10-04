import * as THREE from 'three';
import { Sequence } from './Sequence';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import { toonMaterial, addOutline } from '@/render/toon';
import { TelegraphStub } from '@/bosses/stubs';
import type { GameScene } from '@/core/GameScene';
import type { Player } from '@/player/Player';
import type { Warden } from '@/bosses/Warden';

class NarratorFigure extends Entity {
  constructor() {
    super();
    // Tall figure made of golden paper and ink
    const bodyMat = toonMaterial({ color: '#ffe666' });
    const headMat = toonMaterial({ color: '#ffffff' }); // white caption box head
    
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 3, 16), bodyMat);
    body.position.y = 1.5;
    addOutline(body, 3);
    
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1), headMat);
    head.position.y = 3.6;
    addOutline(head, 4);
    
    this.object.add(body, head);
  }
}

class FallingDebris extends Entity {
  constructor(pos: THREE.Vector3) {
    super();
    this.object.position.copy(pos);
    this.object.position.y = 15;
    
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = toonMaterial({ color: '#222222' });
    const mesh = new THREE.Mesh(geo, mat);
    
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    this.object.add(mesh);
    
    let velocity = 0;
    this.own(this.scene.game.onFrame((dt) => {
      velocity += 30 * dt;
      this.object.position.y -= velocity * dt;
      mesh.rotation.x += dt * 5;
      mesh.rotation.y += dt * 3;
      
      if (this.object.position.y <= 0) {
        this.object.position.y = 0;
        events.emit('fx:shake', { strength: 0.5 });
        this.destroy(); // Despawns on hit to prevent clutter
      }
    }));
  }
}

export async function runTwist(scene: GameScene, player: Player, warden: Warden) {
  const seq = new Sequence(scene);
  seq.setSkippable(false); // Too important to skip
  
  try {
    // 0. Initial lock
    await seq.lockPlayer();
    
    // Move Warden to center
    warden.position.set(0, 0, -8);
    warden.object.lookAt(player.position);
    
    // 1. Caption Box Swell
    await seq.camera(0, 5, 8, 2);
    await seq.say("At last... the final spark to burn this miserable draft to ash!", 3.5, 'narrator');
    
    // 2. Shatter
    seq.beat('twist:start');
    await seq.wait(1.5);
    seq.beat('twist:narratorFreed');
    seq.shake(0.8);
    events.emit('fx:onomatopoeia', { text: 'CRACK', position: new THREE.Vector3(0, 8, 0), scale: 2 });
    await seq.wait(2);
    
    // 3. Narrator steps out
    const narrator = scene.add(new NarratorFigure());
    narrator.position.set(0, 0, -2);
    await seq.camera(0, 8, 12, 1.5);
    await seq.say("Did you truly believe yourself the author of this tale? A puppet, dancing on strings woven of my ink.", 4.5, 'narrator');
    await seq.say("Every soul you slaughtered, every drop of blood you shed... was merely ink for my quill.", 4, 'narrator');
    
    // 4. Powers stripped
    seq.beat('twist:powersStripped');
    player.stripPowers(); // Empties loadout, hero falls
    seq.palette('violet', 2);
    seq.shake(0.6);
    await seq.say("I unmake you. Fade back into the blank parchment from whence you crawled.", 3.5, 'narrator');
    
    // 5. Collapse & Escape
    seq.beat('twist:collapse');
    // Call Visuals person's startCollapse if available
    import('@/vfx/Collapse').then(mod => mod.startCollapse(scene)).catch(() => {});
    
    await seq.say("Let the void swallow this pathetic stage!", 2.5, 'narrator');
    narrator.destroy(); // Vanishes/ascends
    
    seq.prompt('Run to the Warden!', 6);
    seq.unlockPlayer();
    await seq.resetCamera(1);
    
    // The interactive escape: 15s timer
    const endTime = performance.now() + 15000;
    
    const spawner = setInterval(() => {
      if (performance.now() > endTime) return;
      const tx = player.position.x + (Math.random() - 0.5) * 8;
      const tz = player.position.z + (Math.random() - 0.5) * 8;
      const targetPos = new THREE.Vector3(tx, 0, tz);
      
      scene.add(new TelegraphStub(targetPos, 2.5, 1));
      setTimeout(() => {
        // If we are still in this scene
        if (scene.game.current === scene) {
          scene.add(new FallingDebris(targetPos));
        }
      }, 1000);
    }, 800);
    
    // Wait until player reaches Warden OR time runs out
    await seq.until(() => {
      const reached = player.position.distanceTo(warden.position) < 3;
      const timeout = performance.now() > endTime;
      return reached || timeout;
    });
    
    clearInterval(spawner);
    
    // 6. True Light Granted
    await seq.lockPlayer();
    await seq.camera(0, 3, 5, 1);
    await seq.walkPlayer(warden.position.clone().add(new THREE.Vector3(0, 0, 1.5)));
    
    await seq.say("The ink... it does not bind you...", 2.5, 'warden');
    await seq.say("Burn his pages... take the true light... and end this.", 3, 'warden');
    
    seq.beat('twist:trueLightGranted');
    seq.slowMo(0.2, 2);
    seq.shake(1);
    
    // Equip violet abilities!
    player.setLoadout(['violetLance', 'radiantGuard', 'soulCall']);
    player.setElement('violet');
    player.gainEnergy(100);
    
    events.emit('fx:onomatopoeia', { text: 'FWASH', position: player.position.clone(), color: '#9b6bff', scale: 3 });
    await seq.wait(2.5);
    
    warden.destroy();
    await seq.wait(1.5);
    
    // 7. Transition to Final Boss
    player.saveToRun();
    await scene.game.loadScene('final');
    
  } finally {
    seq.dispose();
  }
}
