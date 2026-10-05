import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import { NARRATOR_BOSS } from './config';
import { Armour } from '@/enemies/armour/Armour';
import { CharacterModel } from '@/render/CharacterModel';
import { toonMaterial, addOutline } from '@/render/toon';
import type { Hit, HitResult, Hurtbox } from '@/combat/types';
import { isPositiveResult } from '@/combat/types';
import { Projectile } from '@/combat/Projectile';
import { Shockwave } from '@/vfx/Shockwave';
import { SoulOrb } from './SoulOrb';
import { disposeBossVisuals, markSharedGeometry } from './dispose';

/** Clip names from public/models/MODELS.md. */
const ANIM = {
  float: 'Jump_Idle',
  fan: 'Spellcast_Shoot',
  burst: '2H_Melee_Attack_Spin',
  roar: 'Spellcast_Long',
  hit: 'Hit_A',
  death: 'Death_B',
} as const;

export class NarratorBoss extends Entity implements Hurtbox {
  readonly team = 'enemy' as const;
  readonly id = 'narrator';
  radius = 0.8;
  height = 3.5;
  mass = 10;

  hp = NARRATOR_BOSS.maxHp;
  maxHp = NARRATOR_BOSS.maxHp;
  phase = 1;

  /** Phase 1: stolen gold plates. Crack them with melee, then Lance the core. */
  private armour: Armour | null = new Armour('narrator', {
    shellHp: NARRATOR_BOSS.armourShellHp,
    coreHp: NARRATOR_BOSS.armourCoreHp,
    coreWindowSec: NARRATOR_BOSS.armourWindowSec,
    element: 'gold',
    size: 1.6,
    regrows: true,
  });
  /** Counts down after a core breaks; the plates regrow at zero (phase 1 only). */
  private regrowIn = -1;
  /** Phase 2: the stolen souls orbit him as shields. */
  private orbs: SoulOrb[] = [];
  private invulnLeft = 0;
  private pendingEcho = -1;

  private meshPivot = new THREE.Group();
  private placeholder = new THREE.Group();
  private model: CharacterModel | null = null;
  private attackTimer = 3;
  private t = 0;
  private velocity = new THREE.Vector3();
  private head: THREE.Mesh;
  private pages: THREE.Mesh[] = [];
  private phase2Aura: THREE.Mesh;

  constructor() {
    super();
    // Primitive stand-in, shown only until the .glb finishes loading
    const bodyMat = toonMaterial({ color: '#ffe666' });
    const headMat = toonMaterial({ color: '#ffffff' });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 3, 16), bodyMat);
    body.position.y = 1.5;
    addOutline(body, 3);

    this.head = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), headMat);
    this.head.position.y = 3.6;
    addOutline(this.head, 4);

    this.placeholder.add(body, this.head);
    this.meshPivot.add(this.placeholder);
    this.object.add(this.meshPivot);
    if (this.armour) this.object.add(this.armour.visual);

    // Floating pages (kept with the real model too — he is made of his own book)
    const pageMat = toonMaterial({ color: '#ffffff' });
    for (let i = 0; i < 12; i++) {
      const page = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), pageMat);
      page.userData = { angle: (i / 12) * Math.PI * 2, speed: 1.5 + Math.random(), radius: 2.5 + Math.random() * 1.5 };
      this.pages.push(page);
      this.meshPivot.add(page);
    }

    // Phase 2 Corrupted Aura (hidden initially)
    const auraGeo = new THREE.SphereGeometry(3.5, 16, 16);
    const auraMat = new THREE.MeshBasicMaterial({ color: '#ff0000', wireframe: true, transparent: true, opacity: 0 });
    this.phase2Aura = new THREE.Mesh(auraGeo, auraMat);
    this.meshPivot.add(this.phase2Aura);
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  onAdded() {
    this.own(this.scene.combat.register(this));
    this.emitHealth();
    void this.loadModel();
  }

  private async loadModel() {
    const model = await CharacterModel.load(NARRATOR_BOSS.model, { height: NARRATOR_BOSS.modelHeight, outlineWidth: 4 });
    markSharedGeometry(model.root);
    if (this.destroyed) {
      disposeBossVisuals(model.root);
      return;
    }
    this.model = model;
    this.placeholder.visible = false;
    model.root.position.y = NARRATOR_BOSS.floatHeight; // he hovers
    this.meshPivot.add(model.root);
    model.play(this.alive ? ANIM.float : ANIM.death, { loop: this.alive });
  }

  receiveHit(hit: Hit): HitResult {
    if (!this.alive) return 'immune';
    if (this.invulnLeft > 0) return 'immune';

    let result: HitResult;
    if (this.phase === 1) {
      const at = this.position.clone().setY(this.height * 0.6);
      result = this.armour?.handleHit(hit, at) ?? 'immune';
      // Only the core costs him health; cracking plates just opens him up
      if (result === 'coreHit') this.hp = Math.max(this.maxHp * NARRATOR_BOSS.phase2HpThreshold, this.hp - hit.amount);
      if (result === 'shellBroken') events.emit('fx:shake', { strength: 0.3 });
      if (this.armour?.state === 'broken' && this.regrowIn < 0) this.regrowIn = NARRATOR_BOSS.armourRegrowSec;
    } else if (this.orbs.some((o) => o.alive)) {
      // The souls he wears shield him: free them first
      events.emit('fx:onomatopoeia', { text: 'SHIELDED!', position: this.position.clone().setY(3), color: '#c9b2ff', scale: 0.8 });
      result = 'blocked';
    } else {
      this.hp = Math.max(0, this.hp - hit.amount);
      result = this.hp <= 0 ? 'killed' : 'damaged';
    }

    if (isPositiveResult(result)) {
      this.meshPivot.position.y = -0.2; // Flinch
      this.model?.flash('#ffffff', 0.12);
    }

    if (this.phase === 1 && this.hp <= this.maxHp * NARRATOR_BOSS.phase2HpThreshold) {
      this.enterPhase2();
    }

    if (this.hp <= 0) {
      this.model?.play(ANIM.death, { loop: false, fade: 0.2 });
      events.emit('boss:defeated', { bossId: 'narrator' });
    }

    this.emitHealth();
    return result;
  }

  update(dt: number) {
    this.model?.update(dt);
    if (dt <= 0 || !this.alive) return;
    this.t += dt;
    this.attackTimer -= dt;
    this.invulnLeft = Math.max(0, this.invulnLeft - dt);
    this.armour?.update(dt);

    // A broken core regrows fresh plates after a beat (phase 1 keeps cycling until 50%)
    if (this.regrowIn >= 0) {
      this.regrowIn -= dt;
      if (this.regrowIn < 0) this.armour?.reset();
    }

    // Second, smaller shockwave of the gold burst (game time, so it respects hit-stop/pause)
    if (this.pendingEcho >= 0) {
      this.pendingEcho -= dt;
      if (this.pendingEcho < 0) this.scene.add(new Shockwave(this.position, 4, '#ff0000'));
    }

    this.meshPivot.position.y += (0 - this.meshPivot.position.y) * 10 * dt;
    this.meshPivot.position.y += Math.sin(this.t * 2) * 0.1; // Bobbing
    if (this.phase === 1) {
      this.head.position.y = 3.6 + Math.sin(this.t * 4) * 0.15;
      this.head.rotation.y = this.t * 0.5;
      this.head.rotation.z = Math.sin(this.t * 2) * 0.1;
    } else {
      // Ferocious erratic movement for phase 2
      this.head.position.y = 3.8 + Math.sin(this.t * 15) * 0.4;
      this.head.rotation.x = Math.sin(this.t * 10) * 0.3;
      this.head.rotation.z = Math.cos(this.t * 12) * 0.3;
      this.meshPivot.position.y += Math.sin(this.t * 20) * 0.15;
      this.meshPivot.rotation.z = Math.sin(this.t * 8) * 0.1;

      (this.phase2Aura.material as THREE.Material).opacity = 0.4 + Math.sin(this.t * 15) * 0.2;
      this.phase2Aura.rotation.y -= dt * 2;
      this.phase2Aura.rotation.x += dt * 3;
      this.phase2Aura.scale.setScalar(1 + Math.sin(this.t * 8) * 0.1);
    }

    // Animate pages
    this.pages.forEach((page, i) => {
      const data = page.userData;
      const speedMult = this.phase === 2 ? 3 : 1; // Faster in phase 2
      const angle = data.angle + this.t * data.speed * speedMult;
      page.position.set(Math.cos(angle) * data.radius, 3 + Math.sin(this.t * 3 + i) * 2, Math.sin(angle) * data.radius);
      page.rotation.x = this.t * data.speed * speedMult;
      page.rotation.y = angle;
    });

    let targetObj: Hurtbox | null = null;
    for (const t of this.scene.combat.targets('enemy')) {
      if (t.team === 'player') targetObj = t;
    }
    if (!targetObj) return;

    const toPlayer = targetObj.position.clone().sub(this.position).setY(0);
    const dist = toPlayer.length();
    const fwd = toPlayer.clone().normalize();

    // Face player
    const targetAngle = Math.atan2(fwd.x, fwd.z);
    const cur = this.object.rotation.y;
    let diff = targetAngle - cur;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.object.rotation.y = cur + diff * dt * 5;

    // No attacks during the phase-change roar
    if (this.invulnLeft > 0) {
      this.velocity.multiplyScalar(0.9);
    } else if (this.phase === 1) {
      // Orbit slowly at a distance
      const desiredDist = 12;
      const moveFwd = fwd.clone().multiplyScalar(dist - desiredDist);
      const strafe = new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(5);
      const targetVel = moveFwd.add(strafe);
      this.velocity.lerp(targetVel, dt * 1.5);

      if (this.attackTimer <= 0) {
        this.attackTimer = 2.5 + Math.random();
        this.fireGoldFan(fwd);
      }
    } else {
      // Phase 2: Aggressive fast orbit
      const desiredDist = 6;
      const moveFwd = fwd.clone().multiplyScalar(dist - desiredDist);
      const strafe = new THREE.Vector3(fwd.z, 0, -fwd.x).multiplyScalar(10);
      const targetVel = moveFwd.add(strafe).multiplyScalar(1.5);
      this.velocity.lerp(targetVel, dt * 3);

      if (dist < 6 && this.attackTimer <= 0) {
        this.attackTimer = 2;
        this.fireGoldBurst();
      } else if (this.attackTimer <= 0) {
        this.attackTimer = 1.5;
        this.fireGoldFan(fwd);
      }
    }

    this.position.addScaledVector(this.velocity, dt);
    this.scene.collision.resolve(this.position, this.radius);
  }

  private fireGoldFan(dir: THREE.Vector3) {
    if (Math.random() > 0.6) {
      const barks = [
        'Bleed for my narrative!',
        'Your pain is merely exposition!',
        'Dance, puppet, dance!',
        'Every wound is a word I write!',
      ];
      events.emit('narrator:say', { text: barks[Math.floor(Math.random() * barks.length)], speaker: 'narrator', durationSec: 2 });
    }

    this.model?.play(ANIM.fan, { loop: false, restart: true, fade: 0.05 });
    this.model?.mixer.addEventListener('finished', this.backToFloat);
    events.emit('fx:onomatopoeia', { text: 'PEW', position: this.position.clone().add(new THREE.Vector3(0, 3, 0)) });
    const count = this.phase === 1 ? 3 : 5;
    for (let i = 0; i < count; i++) {
      const angle = (i - Math.floor(count / 2)) * 0.25;
      const vel = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).multiplyScalar(18);
      const from = this.position.clone().setY(2);
      const proj = new Projectile({
        team: 'enemy',
        element: 'gold',
        damage: 15,
        speed: 18,
        radius: 0.4,
        color: '#ffc21a',
        sourceId: this.id,
        from,
        dir: vel.clone().normalize(),
      });
      this.scene.add(proj);
    }
  }

  private fireGoldBurst() {
    if (Math.random() > 0.5) {
      const barks = [
        'I AM THE AUTHOR!',
        'OBEY THE SCRIPT!',
        'KNEEL BEFORE THE INK!',
        'YOU ARE NOTHING BUT DUST AND LETTERS!',
      ];
      events.emit('narrator:say', { text: barks[Math.floor(Math.random() * barks.length)], speaker: 'narrator', durationSec: 2.5 });
    }

    this.model?.play(ANIM.burst, { loop: false, restart: true, fade: 0.05 });
    this.model?.mixer.addEventListener('finished', this.backToFloat);
    this.scene.add(new Shockwave(this.position, 6, '#ffc21a'));
    this.pendingEcho = 0.2;
    events.emit('fx:shake', { strength: 0.5 });
    events.emit('fx:onomatopoeia', { text: 'BAM', position: this.position.clone(), scale: 2 });

    const hits = this.scene.combat.querySphere(this.position, 6, 'enemy');
    for (const h of hits) {
      this.scene.combat.applyHit(h, {
        amount: 25,
        kind: 'energy',
        element: 'gold',
        heavy: true,
        team: 'enemy',
        from: this.position.clone(),
        knockback: 12,
        sourceId: 'narratorBurst',
      });
    }
  }

  private backToFloat = () => {
    this.model?.mixer.removeEventListener('finished', this.backToFloat);
    if (this.alive) this.model?.play(ANIM.float, { fade: 0.2 });
  };

  private enterPhase2() {
    this.phase = 2;
    // The gold plates fall away: the souls are his armour now
    this.regrowIn = -1;
    this.armour?.dispose();
    this.armour = null;

    // Short invulnerable roar (brief: phase transitions get hit-stop, shake and a roar)
    this.invulnLeft = NARRATOR_BOSS.phase2RoarSec;
    events.emit('fx:hitstop', { durationSec: 0.2 });
    events.emit('story:beat', { id: 'final:phase2' });
    events.emit('narrator:say', { text: 'Blasphemy! I am the architect of this reality! You cannot unwrite your creator!', speaker: 'narrator', durationSec: 4 });
    events.emit('fx:shake', { strength: 0.8 });
    this.model?.play(ANIM.roar, { loop: false, restart: true, fade: 0.1 });
    this.model?.mixer.addEventListener('finished', this.backToFloat);

    const orbCount = 6;
    for (let i = 0; i < orbCount; i++) {
      this.orbs.push(this.scene.add(new SoulOrb(this, i, orbCount)));
    }

    this.attackTimer = 1.5;
  }

  private emitHealth() {
    events.emit('boss:health', { bossId: 'narrator', name: 'THE NARRATOR', hp: this.hp, max: this.maxHp, phase: this.phase });
  }

  onRemoved() {
    this.model?.mixer.removeEventListener('finished', this.backToFloat);
    disposeBossVisuals(this.object);
  }
}
