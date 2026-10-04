import * as THREE from 'three';
import { Sequence } from './Sequence';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import { toonMaterial, addOutline } from '@/render/toon';
import { Telegraph } from '@/enemies/fx/Telegraph';
import { startCollapse } from '@/vfx/Collapse';
import { CharacterModel } from '@/render/CharacterModel';
import { NARRATOR_BOSS } from '@/bosses/config';
import { disposeBossVisuals, markSharedGeometry } from '@/bosses/dispose';
import type { GameScene } from '@/core/GameScene';
import type { Player } from '@/player/Player';
import type { Warden } from '@/bosses/Warden';

class NarratorFigure extends Entity {
  private pages: THREE.Mesh[] = [];
  private t = 0;
  private placeholder = new THREE.Group();
  private model: CharacterModel | null = null;

  constructor() {
    super();
    // Primitive stand-in until the .glb is in (the Warden scene preloads it)
    const bodyMat = toonMaterial({ color: '#111111', emissive: '#443300' });
    const headMat = toonMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.5 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.6, 3.5, 5), bodyMat);
    body.position.y = 1.75;
    addOutline(body, 3);

    const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), headMat);
    head.position.y = 3.8;
    addOutline(head, 4);

    this.placeholder.add(body, head);
    this.object.add(this.placeholder);

    // Floating pages orbiting him
    for (let i = 0; i < 8; i++) {
      const page = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), headMat);
      page.userData = { angle: (i / 8) * Math.PI * 2, speed: 1 + Math.random(), radius: 1.2 + Math.random() * 0.8 };
      this.pages.push(page);
      this.object.add(page);
    }
  }

  onAdded() {
    void CharacterModel.load(NARRATOR_BOSS.model, { height: NARRATOR_BOSS.modelHeight, outlineWidth: 4 }).then((model) => {
      markSharedGeometry(model.root);
      if (this.destroyed) {
        disposeBossVisuals(model.root);
        return;
      }
      this.model = model;
      this.placeholder.visible = false;
      this.object.add(model.root);
      // He steps out of the page, then gloats
      model.play('Jump_Full_Long', { loop: false });
      const gloat = () => {
        model.mixer.removeEventListener('finished', gloat);
        model.play('Cheer', { fade: 0.2 });
      };
      model.mixer.addEventListener('finished', gloat);
    });
  }

  update(dt: number) {
    this.model?.update(dt);
    this.t += dt;
    this.pages.forEach((page, i) => {
      const data = page.userData;
      const angle = data.angle + this.t * data.speed;
      page.position.set(Math.cos(angle) * data.radius, 1.5 + Math.sin(this.t * 2 + i) * 1.5, Math.sin(angle) * data.radius);
      page.rotation.x = this.t * data.speed;
      page.rotation.y = angle;
    });
  }

  onRemoved() {
    disposeBossVisuals(this.object);
  }
}

/** How the escape plays: debris keeps falling around the hero while they run to the Warden. */
const ESCAPE = {
  durationSec: 15,
  spawnEverySec: 0.8,
  warnSec: 1.0,      // telegraph time before a slab lands
  scatter: 8,        // metres around the hero
  hitRadius: 2.5,
  damage: 8,
  knockback: 9,
  dropHeight: 20,
  gravity: 40,
};

class FallingDebris extends Entity {
  private mesh: THREE.Mesh;
  private trail: THREE.Mesh;
  private velocity = 0;

  constructor(pos: THREE.Vector3) {
    super();
    this.object.position.copy(pos);
    this.object.position.y = ESCAPE.dropHeight;

    // Jagged, chaotic monolithic debris
    const geo = new THREE.TetrahedronGeometry(2 + Math.random(), 1);
    const mat = toonMaterial({ color: '#0a0a0a', emissive: '#2b00ff', emissiveIntensity: 0.1 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

    // Ghostly trail
    this.trail = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 0.1, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#2b00ff', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.trail.position.y = 4;

    this.object.add(this.mesh, this.trail);
  }

  update(dt: number) {
    if (dt <= 0) return;
    this.velocity += ESCAPE.gravity * dt;
    this.object.position.y -= this.velocity * dt;
    this.mesh.rotation.x += dt * 8;
    this.mesh.rotation.y += dt * 6;

    if (this.object.position.y <= 0) {
      this.object.position.y = 0;
      events.emit('fx:shake', { strength: 0.7 });
      events.emit('fx:onomatopoeia', { text: 'KRASH', position: this.position.clone(), color: '#555555', scale: 1.5 });
      // It lands where the telegraph warned: anyone still standing there gets hurt
      for (const target of this.scene.combat.querySphere(this.position, ESCAPE.hitRadius, 'enemy')) {
        this.scene.combat.applyHit(target, {
          amount: ESCAPE.damage,
          kind: 'melee',
          element: 'none',
          heavy: true,
          team: 'enemy',
          from: this.position.clone(),
          knockback: ESCAPE.knockback,
          sourceId: 'twistDebris',
        });
      }
      this.destroy();
    }
  }

  onRemoved() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.trail.geometry.dispose();
    (this.trail.material as THREE.Material).dispose();
  }
}

/** Rains telegraphed debris around the hero on game time (so it pauses with the game). */
class DebrisRain extends Entity {
  age = 0;
  private nextSpawn = 0;
  private pending: { at: THREE.Vector3; dropIn: number }[] = [];

  constructor(private player: Player) {
    super();
  }

  get done(): boolean {
    return this.age >= ESCAPE.durationSec;
  }

  update(dt: number) {
    if (dt <= 0) return;
    this.age += dt;
    this.nextSpawn -= dt;
    if (!this.done && this.nextSpawn <= 0) {
      this.nextSpawn = ESCAPE.spawnEverySec;
      const at = new THREE.Vector3(
        this.player.position.x + (Math.random() - 0.5) * ESCAPE.scatter,
        0,
        this.player.position.z + (Math.random() - 0.5) * ESCAPE.scatter,
      );
      this.scene.add(new Telegraph({ shape: 'circle', at, radius: ESCAPE.hitRadius, durationSec: ESCAPE.warnSec, color: '#9b6bff' }));
      // Release it so it lands just as the telegraph fills
      const fallSec = Math.sqrt((2 * ESCAPE.dropHeight) / ESCAPE.gravity);
      this.pending.push({ at, dropIn: ESCAPE.warnSec - fallSec });
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.dropIn -= dt;
      if (p.dropIn <= 0) {
        this.scene.add(new FallingDebris(p.at));
        this.pending.splice(i, 1);
      }
    }
  }
}

export async function runTwist(scene: GameScene, player: Player, warden: Warden) {
  const seq = new Sequence(scene);
  seq.setSkippable(false); // Too important to skip
  let rain: DebrisRain | undefined;
  
  try {
    // 0. Initial lock
    await seq.lockPlayer();
    
    // Move Warden to center
    warden.position.set(0, 0, -8);
    warden.object.lookAt(player.position);
    
    // 1. Caption Box Swell
    await seq.camera(0, 5, 8, 2);
    await seq.say("At last... the final spark to burn this miserable draft to ash!", 3.5, 'narrator');
    await seq.say("I have watched you stumble through my chapters...", 3.5, 'narrator');
    await seq.say("Blindly believing in your own free will.", 3, 'narrator');
    
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
    await seq.say("Did you truly believe yourself the author of this tale? A puppet, dancing on strings woven of my ink.", 5, 'narrator');
    await seq.say("Every soul you slaughtered, every drop of blood you shed... was merely ink for my quill.", 4.5, 'narrator');
    await seq.say("And now... the story concludes. Not with a hero's triumph...", 4, 'narrator');
    await seq.say("But with the absolute erasure of your very existence.", 4, 'narrator');
    
    // 4. Powers stripped
    seq.beat('twist:powersStripped');
    player.stripPowers(); // Empties loadout, hero falls
    seq.palette('violet', 2);
    seq.shake(0.6);
    await seq.say("I unmake you. Fade back into the blank parchment from whence you crawled.", 3.5, 'narrator');
    
    // 5. Collapse & Escape
    seq.beat('twist:collapse');
    startCollapse(scene, { center: player.position.clone() });
    
    await seq.say("Let the void swallow this pathetic stage!", 2.5, 'narrator');
    narrator.destroy(); // Vanishes/ascends
    
    seq.prompt('Run to the Warden!', 6);
    seq.unlockPlayer();
    await seq.resetCamera(1);
    
    // The interactive escape: run to the Warden through telegraphed falling debris
    const escape = scene.add(new DebrisRain(player));
    rain = escape;

    // Wait until player reaches Warden OR time runs out
    await seq.until(() => player.position.distanceTo(warden.position) < 3 || escape.done);
    escape.destroy();
    rain = undefined;

    
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
    rain?.destroy();
    seq.dispose();
  }
}
