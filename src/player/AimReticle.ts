import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { input } from '@/core/input';
import { events } from '@/core/events';
import type { Player } from './Player';

const COLORS = { gold: '#ffd23a', violet: '#b48cff' } as const;
const INK = '#1a1013';

const AIM = {
  /** Mouse still this long → the reticle dims to idleOpacity (never fully gone while playing). */
  idleSec: 2,
  idleOpacity: 0.35,
  dashes: 9,
  dashGap: 0.55,
  trailStart: 0.9,
  trailMax: 6,
  y: 0.04,
};

/** States where the hero commits to a direction: show the facing chevron. */
const FACING_STATES = new Set(['attack', 'cast', 'channel', 'guard']);

/**
 * Where the hero is aiming: a comic ring on the floor under the mouse, a dashed trail from
 * the hero toward it, and a chevron at the hero's feet while attacking or guarding.
 */
export class AimReticle extends Entity {
  private ring = new THREE.Group();
  private trail = new THREE.Group();
  private chevron: THREE.Mesh;
  private colorMat: THREE.MeshBasicMaterial;
  private inkMat: THREE.MeshBasicMaterial;
  private chevronMat: THREE.MeshBasicMaterial;
  private geos: THREE.BufferGeometry[] = [];
  private dashes: THREE.Group[] = [];
  private lastMouse = new THREE.Vector2();
  private idle = 0;
  private shown = 0;
  private facing = 0;

  constructor(private readonly player: Player) {
    super();
    const mat = (color: string) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
    this.colorMat = mat(COLORS.gold);
    this.inkMat = mat(INK);
    this.chevronMat = mat(COLORS.gold);

    const flat = (geo: THREE.BufferGeometry, m: THREE.Material, order: number) => {
      this.geos.push(geo);
      const mesh = new THREE.Mesh(geo, m);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = order;
      return mesh;
    };

    // Ring: an ink band with a coloured band inside it, plus a centre dot
    this.ring.add(
      flat(new THREE.RingGeometry(0.26, 0.5, 40), this.inkMat, 1),
      flat(new THREE.RingGeometry(0.31, 0.44, 40), this.colorMat, 2),
      flat(new THREE.CircleGeometry(0.07, 16), this.colorMat, 2),
    );

    // Each dash: an ink outline under a coloured core, so it reads on light and dark floors
    const dashGeo = new THREE.PlaneGeometry(0.1, 0.3);
    const dashInkGeo = new THREE.PlaneGeometry(0.2, 0.4);
    for (let i = 0; i < AIM.dashes; i++) {
      const d = new THREE.Group();
      d.add(flat(dashInkGeo, this.inkMat, 1), flat(dashGeo, this.colorMat, 2));
      this.dashes.push(d);
      this.trail.add(d);
    }
    this.geos.push(dashGeo, dashInkGeo);

    // Chevron pointing along local +Z (the hero's forward)
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.32);
    shape.lineTo(0.3, -0.08);
    shape.lineTo(0.12, -0.08);
    shape.lineTo(0, 0.1);
    shape.lineTo(-0.12, -0.08);
    shape.lineTo(-0.3, -0.08);
    shape.closePath();
    const chevGeo = new THREE.ShapeGeometry(shape);
    this.geos.push(chevGeo);
    this.chevron = new THREE.Mesh(chevGeo, this.chevronMat);
    // Shape is drawn in XY with +Y as "forward"; lay it flat so +Y points along +Z
    this.chevron.rotation.x = Math.PI / 2;
    this.chevron.position.set(0, AIM.y, 1.0);
    this.chevron.renderOrder = 2;
    const chevronPivot = new THREE.Group();
    chevronPivot.add(this.chevron);
    chevronPivot.name = 'chevron';

    this.object.add(this.ring, this.trail, chevronPivot);
    this.lastMouse.copy(input.mouseNdc);
  }

  update(dt: number) {
    const step = dt > 0 ? dt : 1 / 60; // keep fading through hit-stop and pause
    const p = this.player;

    if (!input.mouseNdc.equals(this.lastMouse)) {
      this.lastMouse.copy(input.mouseNdc);
      this.idle = 0;
    } else {
      this.idle += step;
    }
    const usable = p.state !== 'locked' && p.state !== 'dead';
    const target = !usable ? 0 : this.idle < AIM.idleSec ? 1 : AIM.idleOpacity;
    this.shown += (target - this.shown) * (1 - Math.exp(-(target > this.shown ? 14 : 4) * step));
    this.facing += ((usable && FACING_STATES.has(p.state) ? 1 : 0) - this.facing) * (1 - Math.exp(-16 * step));

    const color = p.element === 'violet' ? COLORS.violet : COLORS.gold;
    this.colorMat.color.set(color);
    this.chevronMat.color.set(color);
    this.colorMat.opacity = this.shown * 0.9;
    this.inkMat.opacity = this.shown * 0.55;
    this.chevronMat.opacity = this.facing * 0.75;
    this.ring.visible = this.trail.visible = this.shown > 0.02;

    // Ring sits on the aim point and breathes a little
    this.ring.position.set(p.aimPoint.x, AIM.y, p.aimPoint.z);
    this.ring.scale.setScalar(1 + Math.sin(performance.now() * 0.006) * 0.05);

    // Dashed trail from the hero toward the aim point
    this.trail.position.set(p.position.x, AIM.y, p.position.z);
    this.trail.rotation.y = Math.atan2(p.aimDir.x, p.aimDir.z);
    const dist = Math.min(AIM.trailMax, p.position.distanceTo(_flat.set(p.aimPoint.x, p.position.y, p.aimPoint.z)) - 0.55);
    this.dashes.forEach((d, i) => {
      const z = AIM.trailStart + i * AIM.dashGap;
      d.visible = z < dist;
      d.position.set(0, 0, z);
    });

    const chevronPivot = this.object.getObjectByName('chevron')!;
    chevronPivot.visible = this.facing > 0.02;
    chevronPivot.position.set(p.position.x, 0, p.position.z);
    chevronPivot.rotation.y = p.object.rotation.y;
  }

  onRemoved() {
    for (const g of this.geos) g.dispose();
    this.colorMat.dispose();
    this.inkMat.dispose();
    this.chevronMat.dispose();
  }
}

const _flat = new THREE.Vector3();

// The mouse cursor (styles.css) follows the palette too
events.on('palette:set', ({ mode }) => (document.body.dataset.theme = mode));
