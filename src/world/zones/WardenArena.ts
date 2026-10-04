import * as THREE from 'three';
import type { GameScene } from '@/core/GameScene';
import { ZoneKit } from '../props/ZoneKit';
import { pageFloor } from '../props/pageFloor';
import { RUIN, brazier, chain, column } from '../props/ruins';
import { WA, drawWardenFloor } from './wardenFloor';
import type { ZoneLayout } from './types';

const STONE = '#c9c0de';
const STONE_DARK = '#8f84b3';
const IRON = '#2b2440';

/**
 * THE WARDEN'S SANCTUM. An ancient round chamber set inside one enormous comic panel.
 * It is the first place in the game lit by violet: cool stone, quiet flames, no sunshine.
 * At the north end hangs the thing the Warden guards — a slab of blazing gold, bound in iron
 * chains whose links glow violet. It is the only thing in the room that buzzes.
 * The floor is kept completely open: this is a duel.
 */
export function buildWardenArena(scene: GameScene): ZoneLayout {
  const kit = new ZoneKit(scene, 'warden-arena', 4);
  pageFloor(kit, WA.floor, 34, drawWardenFloor, '#efe6d2');
  const R = WA.wallRadius;

  // ── the chamber wall: a tall curve at the back, dropping to a low kerb at the front ──
  const segments = 40;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const north = -Math.sin(a); // 1 at the back wall, -1 at the camera
    const h = north > 0.15 ? 5.6 + (i % 2) * 0.5 : north > -0.35 ? 2.2 : 0.45;
    const w = ((2 * Math.PI * (R + 0.5)) / segments) * 1.03;
    kit.box(Math.cos(a) * (R + 0.5), 0, Math.sin(a) * (R + 0.5), w, h, 1.0, i % 2 ? STONE : '#bfb5d8', { rotY: Math.PI / 2 - a, shadow: h > 2 });
    // tall slit windows full of violet light along the back
    if (north > 0.35 && i % 2 === 0) kit.glowBox(Math.cos(a) * (R - 0.02), 1.6, Math.sin(a) * (R - 0.02), 0.5, 3.0, 0.08, RUIN.violet, 1.5, { rotY: Math.PI / 2 - a });
  }

  // ── pillars and flames just outside the fighting circle ──
  const ringR = WA.radius + 0.75;
  for (const deg of [205, 235, 305, 335]) {
    const a = THREE.MathUtils.degToRad(deg);
    column(kit, Math.cos(a) * ringR, Math.sin(a) * ringR, 6.2, STONE, 0.62);
  }
  for (const deg of [190, 220, 250, 290, 320, 350]) {
    const a = THREE.MathUtils.degToRad(deg);
    brazier(kit, Math.cos(a) * (ringR - 0.1), Math.sin(a) * (ringR - 0.1), 1.6);
  }
  for (const deg of [30, 75, 105, 150]) {
    const a = THREE.MathUtils.degToRad(deg);
    brazier(kit, Math.cos(a) * ringR, Math.sin(a) * ringR, 0.5);
  }

  // ── the bound gold ──
  const sz = WA.sealZ;
  kit.cyl(0, 0, sz, 4.4, 4.8, 0.4, STONE_DARK, { segments: 12, shadow: true });
  kit.cyl(0, 0.4, sz, 3.4, 3.7, 0.4, STONE, { segments: 12 });
  // the slab itself: a caption box made of light, tilted as if straining at its chains
  kit.box(0, 1.9, sz + 0.15, 5.6, 2.9, 0.75, IRON, { rotZ: 0.06, rotX: -0.12 });
  kit.glowBox(0, 2.05, sz + 0.34, 5.1, 2.6, 0.5, '#ffc21a', 2.6, { rotZ: 0.06, rotX: -0.12 });
  for (const [x, y] of [[-1.5, 2.9], [0.2, 3.5], [1.4, 2.7]] as const) kit.glowBox(x, y, sz + 0.62, 2.0, 0.14, 0.04, '#fff6c9', 3.6, { rotZ: 0.06 });
  // iron bands across it
  for (const x of [-1.9, 1.9]) kit.box(x, 1.85, sz + 0.5, 0.34, 3.05, 0.3, IRON, { rotZ: 0.06, rotX: -0.12, outline: false });
  // chains from the slab's corners out to the pillars and the floor
  const chainOpts = { color: IRON, glow: RUIN.violet, glowEvery: 3, sag: 0.9, link: 0.62, intensity: 2.0 };
  const anchors: [[number, number, number], [number, number, number]][] = [
    [[-2.7, 4.6, sz + 0.4], [Math.cos(THREE.MathUtils.degToRad(235)) * ringR, 5.6, Math.sin(THREE.MathUtils.degToRad(235)) * ringR]],
    [[2.7, 4.9, sz + 0.4], [Math.cos(THREE.MathUtils.degToRad(305)) * ringR, 5.6, Math.sin(THREE.MathUtils.degToRad(305)) * ringR]],
    [[-2.8, 2.1, sz + 0.5], [-6.4, 0.25, sz + 3.4]],
    [[2.8, 2.3, sz + 0.5], [6.4, 0.25, sz + 3.4]],
  ];
  for (const [a, b] of anchors) chain(kit, a, b, chainOpts);
  for (const x of [-6.4, 6.4]) {
    kit.cyl(x, 0, sz + 3.4, 0.4, 0.5, 0.3, IRON, { segments: 8 });
    kit.collideCircle(x, sz + 3.4, 0.55);
  }
  kit.collideBox(0, sz - 0.4, 9.2, 4.6);

  // ── banners between the windows ──
  for (const deg of [222, 258, 282, 318]) {
    const a = THREE.MathUtils.degToRad(deg);
    const d = R - 0.08;
    kit.box(Math.cos(a) * d, 2.4, Math.sin(a) * d, 1.3, 3.2, 0.08, '#6b4fd0', { rotY: Math.PI / 2 - a });
    kit.box(Math.cos(a) * (d - 0.06), 3.5, Math.sin(a) * (d - 0.06), 0.6, 0.6, 0.04, RUIN.violetSoft, { rotY: Math.PI / 2 - a, rotZ: Math.PI / 4, outline: false });
  }

  // ── the giant panel border the whole sanctum sits inside ──
  const P = WA.panel;
  kit.box(0, 0, -P - 1.5, P * 2 + 1, 9, 0.9, RUIN.ink, { outline: false });
  for (const x of [-P, P]) kit.box(x, 0, -0.75, 0.9, 9 - 3.2, P * 2 + 1.5, RUIN.ink, { outline: false });

  scene.collision.setCircularBounds(WA.radius);
  kit.finish();

  return {
    playerSpawn: new THREE.Vector3(0, 0, 9.5),
    // [0] is where the Warden stands, in front of what he guards; the rest ring the room
    enemySpawns: [
      [0, -5.2],
      [-6.5, -2],
      [6.5, -2],
      [-8, 4],
      [8, 4],
      [0, 3],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    // the foot of the bound gold: where the hero walks to when the Warden falls
    exit: new THREE.Vector3(0, 0, WA.sealZ + 4.2),
  };
}
