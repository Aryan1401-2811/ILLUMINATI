import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import type { Hit, HitResult } from '@/combat/types';
import { toonMaterial, addOutline } from '@/render/toon';
import { ARMOUR_HEAVY_MULTIPLIER, ARMOUR_SHELL_COLOR, ARMOUR_CORE_COLOR, ARMOUR_CRACK_COLOR } from '../config';

/**
 * Two-layer armour system (shell + core). The backbone of FALSE DAWN's combat:
 *   - Only melee chips the shell. Heavy finisher does 3× damage.
 *   - Energy bounces off the shell with a PING.
 *   - When the shell breaks, the core is exposed for a limited window.
 *   - Only energy hurts the exposed core. Melee bounces.
 *   - If the window expires, the shell regrows to full.
 *   - When the core is destroyed, armour is permanently broken.
 *
 * The Bosses person reuses this for the Warden and the Narrator.
 */

const TIMER_SEGMENTS = 32;

export interface ArmourConfig {
  shellHp: number;
  coreHp: number;
  coreWindowSec: number;
  element?: 'gold' | 'violet';
  size?: number;
}

export class Armour {
  state: 'shell' | 'exposed' | 'broken' = 'shell';
  readonly visual: THREE.Object3D;

  private shellHp: number;
  private shellMaxHp: number;
  private coreHp: number;
  private coreMaxHp: number;
  private coreTimer = 0;
  private readonly ownerId: string;
  private readonly cfg: ArmourConfig;

  // Visuals
  private plates: THREE.Mesh[] = [];
  private plateMats: THREE.MeshToonMaterial[] = [];
  private coreMesh: THREE.Mesh;
  private coreMat: THREE.MeshBasicMaterial;
  private timerRing: THREE.Mesh;
  private timerMat: THREE.MeshBasicMaterial;
  private crackLines: THREE.LineSegments;
  private crackMat: THREE.LineBasicMaterial;
  private shardGroup: THREE.Group;

  // Animation state
  private pulsePhase = 0;
  private breakAnim = -1; // -1 = not playing
  private damageFlash = 0;

  constructor(ownerId: string, cfg: ArmourConfig) {
    this.ownerId = ownerId;
    this.cfg = cfg;
    this.shellHp = this.shellMaxHp = cfg.shellHp;
    this.coreHp = this.coreMaxHp = cfg.coreHp;

    const size = cfg.size ?? 0.9;
    this.visual = new THREE.Group();
    this.visual.name = `armour_${ownerId}`;

    // ── Shell plates: 6 hexagonal-ish plates arranged around the body ────
    const plateGeo = this.makePlateGeometry(size);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const mat = toonMaterial({
        color: ARMOUR_SHELL_COLOR,
        emissive: ARMOUR_SHELL_COLOR,
        emissiveIntensity: 0.3,
      });
      const plate = new THREE.Mesh(plateGeo, mat);
      plate.position.set(
        Math.cos(angle) * size * 0.65,
        0.8 + Math.sin(i * 1.3) * 0.15,
        Math.sin(angle) * size * 0.65,
      );
      plate.rotation.y = angle;
      plate.rotation.x = (Math.random() - 0.5) * 0.3;
      plate.castShadow = true;
      addOutline(plate, 2);
      this.plates.push(plate);
      this.plateMats.push(mat);
      this.visual.add(plate);
    }

    // ── Crack lines (appear as shell takes damage) ───────────────────────
    const crackPositions = new Float32Array(60 * 3); // up to 20 line segments
    const crackGeo = new THREE.BufferGeometry();
    crackGeo.setAttribute('position', new THREE.BufferAttribute(crackPositions, 3));
    crackGeo.setDrawRange(0, 0);
    this.crackMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(ARMOUR_CRACK_COLOR).multiplyScalar(3),
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    this.crackLines = new THREE.LineSegments(crackGeo, this.crackMat);
    this.crackLines.frustumCulled = false;
    this.visual.add(this.crackLines);

    // ── Core (hidden until shell breaks) ─────────────────────────────────
    this.coreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(ARMOUR_CORE_COLOR).multiplyScalar(5),
      transparent: true,
      opacity: 0,
    });
    this.coreMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size * 0.35, 1),
      this.coreMat,
    );
    this.coreMesh.position.y = 0.9;
    this.visual.add(this.coreMesh);

    // ── Timer ring (shows remaining expose window) ───────────────────────
    this.timerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(ARMOUR_CORE_COLOR).multiplyScalar(3),
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.timerRing = new THREE.Mesh(
      new THREE.RingGeometry(size * 0.55, size * 0.65, TIMER_SEGMENTS, 1, 0, Math.PI * 2),
      this.timerMat,
    );
    this.timerRing.rotation.x = -Math.PI / 2;
    this.timerRing.position.y = 0.05;
    this.visual.add(this.timerRing);

    // ── Shard particles (on shell break) ─────────────────────────────────
    this.shardGroup = new THREE.Group();
    this.shardGroup.name = 'shards';
    this.visual.add(this.shardGroup);
  }

  private makePlateGeometry(size: number): THREE.BufferGeometry {
    // Slightly irregular quadrilateral plate
    const w = size * 0.4;
    const h = size * 0.55;
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      -w * 0.8, -h * 0.5, 0,
       w * 0.9,  -h * 0.4, 0,
       w * 0.7,   h * 0.5, 0,
      -w * 0.6,   h * 0.45, 0,
    ]);
    const indices = [0, 1, 2, 0, 2, 3];
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Route EVERY hit through this first. Returns a HitResult if the armour handled it,
   * or null when the armour is broken and the hit should damage health normally.
   */
  handleHit(hit: Hit, at: THREE.Vector3): HitResult | null {
    if (this.state === 'broken') return null;

    if (this.state === 'shell') {
      if (hit.kind === 'energy') {
        // Energy bounces off the shell
        this.damageFlash = 0.15;
        events.emit('fx:onomatopoeia', { text: 'PING!', position: at.clone().setY(at.y + 0.5), color: '#88ddff' });
        return 'deflected';
      }
      // Melee chips the shell. Heavy finisher does big damage.
      const dmg = hit.heavy ? hit.amount * ARMOUR_HEAVY_MULTIPLIER : hit.amount;
      this.shellHp = Math.max(0, this.shellHp - dmg);
      this.damageFlash = 0.12;
      this.updateCracks();

      if (this.shellHp <= 0) {
        this.state = 'exposed';
        this.coreTimer = this.cfg.coreWindowSec;
        this.spawnShards();
        events.emit('armour:shellBroken', { position: at.clone(), ownerId: this.ownerId });
        events.emit('fx:onomatopoeia', { text: 'KRAKK!', position: at.clone().setY(at.y + 0.8), color: '#ff8844', scale: 1.4 });
        return 'shellBroken';
      }
      events.emit('fx:onomatopoeia', { text: 'CRACK!', position: at.clone().setY(at.y + 0.3), color: '#ddbbff', scale: 0.8 });
      return 'shellHit';
    }

    if (this.state === 'exposed') {
      if (hit.kind === 'melee') {
        // Melee bounces off exposed core
        this.damageFlash = 0.1;
        events.emit('fx:onomatopoeia', { text: 'CLANG!', position: at.clone().setY(at.y + 0.5), color: '#ff9955' });
        return 'deflected';
      }
      // Energy damages the core
      this.coreHp = Math.max(0, this.coreHp - hit.amount);
      this.damageFlash = 0.15;

      if (this.coreHp <= 0) {
        this.state = 'broken';
        events.emit('armour:coreBroken', { position: at.clone(), ownerId: this.ownerId });
        events.emit('fx:onomatopoeia', { text: 'SHATTER!', position: at.clone().setY(at.y + 0.8), color: '#ffaa33', scale: 1.5 });
        return 'coreHit';
      }
      return 'coreHit';
    }

    return null;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    this.pulsePhase += dt * 3;

    // ── Shell state visuals ──────────────────────────────────────────────
    if (this.state === 'shell') {
      const hpFrac = this.shellHp / this.shellMaxHp;
      const pulse = 0.3 + Math.sin(this.pulsePhase) * 0.15;
      for (let i = 0; i < this.plates.length; i++) {
        const plate = this.plates[i];
        const mat = this.plateMats[i];
        plate.visible = true;
        mat.emissiveIntensity = this.damageFlash > 0 ? 2 : pulse;
        // Plates drift apart as shell weakens
        const driftScale = 1 + (1 - hpFrac) * 0.15;
        const angle = (i / 6) * Math.PI * 2;
        const size = this.cfg.size ?? 0.9;
        plate.position.x = Math.cos(angle) * size * 0.65 * driftScale;
        plate.position.z = Math.sin(angle) * size * 0.65 * driftScale;
        // Slight wobble as damage accumulates
        plate.rotation.z = Math.sin(this.pulsePhase + i) * (1 - hpFrac) * 0.2;
      }
      this.coreMesh.visible = false;
      this.coreMat.opacity = 0;
      this.timerMat.opacity = 0;
      this.crackLines.visible = true;
    }

    // ── Exposed state visuals ────────────────────────────────────────────
    if (this.state === 'exposed') {
      this.coreTimer -= dt;

      // Hide plates
      for (const plate of this.plates) plate.visible = false;
      this.crackLines.visible = false;

      // Core glows and pulses hot
      this.coreMesh.visible = true;
      const corePulse = 0.7 + Math.sin(this.pulsePhase * 4) * 0.3;
      this.coreMat.opacity = this.damageFlash > 0 ? 1 : corePulse;
      const coreHpFrac = this.coreHp / this.coreMaxHp;
      this.coreMesh.scale.setScalar(0.8 + coreHpFrac * 0.2 + Math.sin(this.pulsePhase * 5) * 0.05);
      this.coreMesh.rotation.y += dt * 2;
      this.coreMesh.rotation.x += dt * 1.3;

      // Timer ring shrinks
      const timerFrac = Math.max(0, this.coreTimer / this.cfg.coreWindowSec);
      this.timerMat.opacity = 0.7;
      // Show the remaining arc by drawing only part of the full ring (6 indices per segment)
      this.timerRing.geometry.setDrawRange(0, Math.ceil(TIMER_SEGMENTS * timerFrac) * 6);
      // Flash red when almost out
      if (timerFrac < 0.3) {
        const flash = Math.sin(this.pulsePhase * 10) > 0;
        this.timerMat.color.setHex(flash ? 0xff3333 : 0xff6b40);
      }

      // Window expired → shell regrows
      if (this.coreTimer <= 0) {
        this.state = 'shell';
        this.shellHp = this.shellMaxHp;
        this.resetCracks();
      }
    }

    // ── Broken state visuals ─────────────────────────────────────────────
    if (this.state === 'broken') {
      for (const plate of this.plates) plate.visible = false;
      this.crackLines.visible = false;
      this.coreMesh.visible = false;
      this.timerMat.opacity = 0;
    }

    // ── Shard animation ──────────────────────────────────────────────────
    if (this.breakAnim >= 0) {
      this.breakAnim += dt;
      for (const shard of this.shardGroup.children) {
        const vel = shard.userData.vel as THREE.Vector3;
        shard.position.addScaledVector(vel, dt);
        vel.y -= 9.8 * dt;
        shard.rotation.x += dt * 8;
        shard.rotation.z += dt * 6;
        const opacity = Math.max(0, 1 - this.breakAnim * 2);
        ((shard as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = opacity;
      }
      if (this.breakAnim > 0.8) {
        // Clean up shards
        while (this.shardGroup.children.length > 0) {
          const child = this.shardGroup.children[0];
          ((child as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
          ((child as THREE.Mesh).material as THREE.Material).dispose();
          this.shardGroup.remove(child);
        }
        this.breakAnim = -1;
      }
    }

    // ── Damage flash decay ───────────────────────────────────────────────
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt);
  }

  /** Free everything the armour created. Call from the owner's onRemoved() unless the owner
   *  already disposes its object tree (the Enemy base class does). Outline materials are shared, so skip them. */
  dispose(): void {
    this.visual.traverse((o) => {
      if (o.userData.isOutline) return;
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (mat) for (const m of Array.isArray(mat) ? mat : [mat]) m.dispose();
    });
    this.visual.removeFromParent();
  }

  /** Regrow the full armour (boss cycles). */
  reset(): void {
    this.state = 'shell';
    this.shellHp = this.shellMaxHp;
    this.coreHp = this.coreMaxHp;
    this.coreTimer = 0;
    this.resetCracks();
    for (const plate of this.plates) plate.visible = true;
    this.coreMesh.visible = false;
    this.timerMat.opacity = 0;
  }

  private updateCracks(): void {
    const hpFrac = this.shellHp / this.shellMaxHp;
    const numCracks = Math.floor((1 - hpFrac) * 20) * 2; // pairs of vertices for line segments
    const attr = this.crackLines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const size = this.cfg.size ?? 0.9;
    for (let i = 0; i < numCracks; i += 2) {
      const angle = Math.random() * Math.PI * 2;
      const r1 = size * (0.3 + Math.random() * 0.4);
      const r2 = r1 + size * (0.1 + Math.random() * 0.2);
      const y = 0.5 + Math.random() * 0.8;
      attr.setXYZ(i, Math.cos(angle) * r1, y, Math.sin(angle) * r1);
      attr.setXYZ(i + 1, Math.cos(angle + 0.1) * r2, y + (Math.random() - 0.5) * 0.3, Math.sin(angle + 0.1) * r2);
    }
    attr.needsUpdate = true;
    this.crackLines.geometry.setDrawRange(0, numCracks);
  }

  private resetCracks(): void {
    this.crackLines.geometry.setDrawRange(0, 0);
  }

  private spawnShards(): void {
    this.breakAnim = 0;
    const size = this.cfg.size ?? 0.9;
    for (let i = 0; i < 12; i++) {
      const geo = new THREE.TetrahedronGeometry(size * 0.08 + Math.random() * size * 0.06);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(ARMOUR_SHELL_COLOR).multiplyScalar(3),
        transparent: true,
        depthWrite: false,
      });
      const shard = new THREE.Mesh(geo, mat);
      const angle = Math.random() * Math.PI * 2;
      shard.position.set(
        Math.cos(angle) * size * 0.5,
        0.7 + Math.random() * 0.6,
        Math.sin(angle) * size * 0.5,
      );
      shard.userData.vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        2 + Math.random() * 4,
        (Math.random() - 0.5) * 6,
      );
      this.shardGroup.add(shard);
    }
  }
}
