import * as THREE from 'three';
import type { GameScene } from '@/core/GameScene';
import { ZoneKit } from '../props/ZoneKit';
import { canvasTexture } from '../props/canvas';
import { worldCanvas } from '../props/pageFloor';
import { VoidDrift } from '../props/VoidDrift';
import { FA, drawFinalFloor, drawScrap, pageEdge } from './finalFloor';
import type { ZoneLayout } from './types';

const VOID = {
  ink: '#0b0722',
  paper: '#f3eeff',
  caption: '#ffe9a8',
  violet: '#9b6bff',
  violetSoft: '#cdb8ff',
};

/**
 * THE FINAL ARENA — the torn page. One ragged sheet of the comic floats in a violet void;
 * its edge is the edge of the world (the collision boundary follows it). Below and around it
 * hang other scraps of the book, the broken pieces of the Narrator's caption box, and a calm
 * violet glow: the true light, finally visible. Meant to be seen in the VIOLET palette.
 */
export function buildFinalArena(scene: GameScene): ZoneLayout {
  const kit = new ZoneKit(scene, 'final-arena', 3);
  const f = FA.floor;

  // ── the page itself: a cut-out, so the void shows past its torn edge ──
  const pageTex = worldCanvas(kit, f, 40, drawFinalFloor, null);
  const page = kit.plane(pageTex, 0, 0, 0, f.maxX - f.minX, f.maxZ - f.minZ, { flat: true, lit: true, alphaTest: 0.5 });
  page.name = 'torn-page';
  // the underside, a hand lower: gives the sheet an edge and a body
  const under = kit.plane(pageTex, 0.12, -0.3, 0.18, f.maxX - f.minX, f.maxZ - f.minZ, { flat: true, alphaTest: 0.5, brightness: 0.16 });
  under.name = 'page-underside';

  // ── the light under the world: big soft violet glows deep below ──
  const glowTex = kit.track(
    canvasTexture(256, 256, (g, w, h) => {
      const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0.4)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }),
  );
  const glows: [number, number, number, number, string, number][] = [
    [0, -9, 0, 60, VOID.violet, 0.75],
    [-16, -16, -12, 44, '#6f4ce0', 0.6],
    [20, -20, -6, 50, '#b79bff', 0.42],
    [6, -26, 16, 70, '#4a2fb8', 0.6],
    [-4, -24, -46, 120, '#5b3ad0', 0.55],
    [30, -30, -34, 90, '#8f6bf0', 0.3],
  ];
  for (const [x, y, z, size, color, opacity] of glows) {
    const mat = kit.track(new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.renderOrder = -2;
    kit.root.add(mesh);
  }

  // ── other scraps of the book, hanging weightless in the void ──
  const drift = scene.add(new VoidDrift());
  const scraps: [number, number, number, number, number, number][] = [
    // x, y, z, size, tilt, seed
    [-21, -2.5, -9, 8, 0.25, 1],
    [22, -4, -6, 10, -0.2, 2],
    [-18, -6, 10, 7, 0.3, 3],
    [19, -3, 12, 6, -0.3, 4],
    [3, -7, -24, 12, 0.15, 5],
    [-9, -11, -19, 9, -0.25, 6],
    [14, -13, -18, 8, 0.3, 7],
    [-27, -9, 1, 7, 0.2, 8],
    [0, -12, 20, 9, -0.15, 9],
  ];
  for (const [x, y, z, size, tilt, seed] of scraps) {
    const tex = kit.track(canvasTexture(256, 256, (g, w, h) => drawScrap(g, w, h, seed)));
    const mesh = kit.plane(tex, x, y, z, size, size, { flat: true, alphaTest: 0.5, brightness: Math.max(0.3, 0.9 + y * 0.045) });
    mesh.rotation.x += tilt;
    mesh.rotation.z = seed * 1.3;
    drift.float(mesh, 0.35 + (seed % 3) * 0.2, 0.25 + (seed % 4) * 0.07, 0.02 + (seed % 3) * 0.012);
  }

  // ── what is left of the Narrator's caption box: yellow shards around the northern rim ──
  const shards: [number, number, number, number, number][] = [
    // angle (deg), distance, width, height above the page, lean
    [255, 13.6, 2.4, 0.0, 0.5],
    [282, 13.9, 3.0, 0.6, -0.35],
    [305, 13.4, 1.8, 0.0, 0.7],
    [232, 13.8, 1.6, 0.4, -0.6],
  ];
  for (const [deg, dist, w, lift, lean] of shards) {
    const a = THREE.MathUtils.degToRad(deg);
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    const rot = { rotY: Math.PI / 2 - a + lean * 0.4, rotZ: lean };
    // ink-framed slab with an unlit yellow face: it keeps the caption box's own colour even in violet light
    kit.box(x, lift, z, w, w * 0.62, 0.2, VOID.ink, { ...rot, shadow: true });
    kit.glowBox(x, lift + 0.09, z, w - 0.18, w * 0.62 - 0.18, 0.24, VOID.caption, 0.95, rot);
    for (const row of [0.2, 0.34]) kit.glowBox(x, lift + w * row, z, w * 0.56, 0.06, 0.27, VOID.ink, 1, rot);
  }

  // ── curls of paper lifting along the torn edge, and ink welling up through the rips ──
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.35;
    const d = pageEdge(a) - 0.5;
    kit.box(Math.cos(a) * d, 0.02, Math.sin(a) * d, 2.2, 0.05, 0.9, VOID.paper, { rotY: Math.PI / 2 - a, rotX: 0.45 + (i % 3) * 0.15, shadow: false });
  }
  for (const centre of [0.9, 3.0, 5.1]) {
    const d = pageEdge(centre) + 0.4;
    kit.glow(Math.cos(centre) * d, -0.5, Math.sin(centre) * d, 0.9, VOID.violetSoft, 1.6, [1.6, 0.5, 1.6]);
  }

  scene.collision.setCircularBounds(FA.radius);
  kit.finish();

  return {
    playerSpawn: new THREE.Vector3(0, 0, 8),
    // [0] is where the Narrator stands; the rest are for anything he summons
    enemySpawns: [
      [0, -6],
      [-7, -2],
      [7, -2],
      [-6, 5],
      [6, 5],
      [0, 0],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    // the middle of the page: where the hero writes the last caption
    exit: new THREE.Vector3(0, 0, 0),
  };
}
