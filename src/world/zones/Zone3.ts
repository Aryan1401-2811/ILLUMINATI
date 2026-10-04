import * as THREE from 'three';
import type { GameScene } from '@/core/GameScene';
import { ZoneKit } from '../props/ZoneKit';
import { pageFloor } from '../props/pageFloor';
import { RUIN, column, deadTree, goldenStatue, peeledCorner, rubble } from '../props/ruins';
import { Z3, drawZone3Floor } from './zone3Floor';
import type { ZoneLayout } from './types';

/**
 * ZONE 3 — "The Worn Square". The same sunny comic, but the page is failing: ink creeps in from
 * the edges, the paving is cracked and taped, corners peel, and wherever the paper tears a calm
 * violet light shows through. Nothing here says "twist" out loud — it just feels less safe.
 * A round arena with the Narrator's gilded statue in the middle to circle around.
 */
export function buildZone3(scene: GameScene): ZoneLayout {
  const kit = new ZoneKit(scene, 'zone3');
  pageFloor(kit, Z3.floor, 36, drawZone3Floor, '#e2cfa3');
  const R = Z3.radius;

  goldenStatue(kit, 0, 0);

  // ── colonnade: tall at the back, snapped stumps at the front (never between camera and hero) ──
  const ring = R + 0.9;
  for (const deg of [200, 222, 248, 292, 318, 340]) {
    const a = THREE.MathUtils.degToRad(deg);
    column(kit, Math.cos(a) * ring, Math.sin(a) * ring, 4.6 + ((deg * 7) % 3) * 0.5);
  }
  for (const deg of [20, 58, 122, 160]) {
    const a = THREE.MathUtils.degToRad(deg);
    column(kit, Math.cos(a) * ring, Math.sin(a) * ring, 1.0 + ((deg * 3) % 2) * 0.3);
  }

  // ── standing panel boards behind the colonnade: sepia, cracked, some of them leaning ──
  for (let i = 0; i < 13; i++) {
    const deg = 196 + i * 11.4;
    if (deg > 258 && deg < 282) continue; // leave the gate clear
    const a = THREE.MathUtils.degToRad(deg);
    const h = 3.2 + ((i * 5) % 4) * 0.7;
    const d = R + 3.4;
    kit.box(Math.cos(a) * d, 0, Math.sin(a) * d, 3.0, h, 0.4, i % 3 === 0 ? '#cdb78a' : '#e0cda2', { rotY: Math.PI / 2 - a, rotZ: i % 4 === 1 ? 0.09 : i % 4 === 3 ? -0.06 : 0, shadow: true });
    kit.box(Math.cos(a) * (d - 0.22), h * 0.72, Math.sin(a) * (d - 0.22), 2.2, 0.14, 0.05, RUIN.ink, { rotY: Math.PI / 2 - a, outline: false });
  }

  // ── north: the gate to the Warden. Violet shines through it; gold chains bar it. ──
  const gz = Z3.gateZ;
  for (const x of [-2.9, 2.9]) {
    kit.box(x, 0, gz, 1.5, 6.2, 1.5, '#b9a67c', { shadow: true });
    kit.box(x, 0, gz, 1.8, 0.6, 1.8, RUIN.stoneDark);
    kit.collideBox(x, gz, 1.6, 1.6);
  }
  kit.box(0, 6.2, gz, 8.2, 1.0, 1.7, '#b9a67c', { shadow: true });
  kit.box(0, 0, gz - 0.9, 4.4, 6.2, 0.3, RUIN.ink, { outline: false });
  kit.glowBox(0, 0.1, gz - 0.7, 2.6, 5.2, 0.1, RUIN.violet, 1.5);
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9;
    const x = -2.1 + t * 4.2;
    for (const y of [1.2 + t * 2.6, 3.8 - t * 2.6]) kit.glowBox(x, y, gz - 0.35, 0.42, 0.2, 0.16, RUIN.gold, 2.4, { rotZ: i % 2 ? 0.7 : -0.7 });
  }
  kit.collideBox(0, gz - 0.9, 4.4, 1.2);

  // ── the page is coming away from the world ──
  peeledCorner(kit, 14.5, -11.5, -2.3, 6);
  peeledCorner(kit, -16.5, 4.5, 1.9, 5);

  // ── violet light leaking through the cracks (the true light, calm and steady) ──
  for (const [x0, z0, x1, z1] of Z3.cracks) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    kit.glowBox((x0 + x1) / 2, 0.01, (z0 + z1) / 2, len * 0.96, 0.008, 0.04, RUIN.violetSoft, 2.6, { rotY: -Math.atan2(z1 - z0, x1 - x0) });
  }

  // ── wreckage, kept near the rim so the middle stays open for mixed fights ──
  rubble(kit, -8.6, -6.8, RUIN.stone, 1);
  rubble(kit, 9.4, 4.6, RUIN.stone, 2);
  rubble(kit, 4.4, 10.4, RUIN.stone, 3);
  rubble(kit, -4.4, 9.2, RUIN.stoneDark, 4);
  deadTree(kit, -10.6, 3.4, 1.15);
  deadTree(kit, 10.8, -3.2, 1.0);
  deadTree(kit, 6.2, -10.2, 1.25);
  // street lamps, knocked crooked; their gold light is the only warm thing left
  for (const [x, z, lean] of [[-6.4, -10.2, 0.16], [11.4, 6.2, -0.2], [-11.2, 8.2, 0.12]] as const) {
    kit.cyl(x, 0, z, 0.08, 0.12, 3.5, '#40566b', { segments: 7, rotZ: lean, shadow: true });
    kit.glow(x - Math.sin(lean) * 1.9, 3.55, z, 0.3, '#ffd98a', 2.4);
    kit.collideCircle(x, z, 0.3);
  }

  scene.collision.setCircularBounds(R);
  kit.finish();

  const spawn = (deg: number, dist: number) => {
    const a = THREE.MathUtils.degToRad(deg);
    return new THREE.Vector3(Math.cos(a) * dist, 0, Math.sin(a) * dist);
  };
  return {
    playerSpawn: new THREE.Vector3(0, 0, 10.5),
    enemySpawns: [spawn(40, 6.5), spawn(140, 6.5), spawn(350, 8), spawn(190, 8), spawn(300, 7), spawn(240, 7), spawn(15, 10.5), spawn(165, 10.5), spawn(270, 10), spawn(90, 5)],
    exit: new THREE.Vector3(0, 0, -R + 1.2),
  };
}
