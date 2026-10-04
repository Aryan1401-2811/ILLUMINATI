import * as THREE from 'three';
import type { GameScene } from '@/core/GameScene';
import { ZoneKit } from '../props/ZoneKit';
import { canvasTexture, comicText, halftone, inkFrame, signTexture, speedLines } from '../props/canvas';
import { pageFloor } from '../props/pageFloor';
import { STREET, barrel, bench, crate, hydrant, kiosk, lampPost, mailbox, planter, shopfront, trafficCone, tree } from '../props/street';
import { Z1, drawZone1Floor } from './zone1Floor';
import type { ZoneLayout } from './types';

/**
 * ZONE 1 — "Sunny Side Street". A bright Saturday-morning comic panel: the tutorial arena.
 * One wide street, shops along the north, the panel border along the south, the way on to the east.
 * Everything cheerful, gold and a touch too bright — this is the Narrator's version of the world.
 */
export function buildZone1(scene: GameScene): ZoneLayout {
  const kit = new ZoneKit(scene, 'zone1');
  pageFloor(kit, Z1.floor, 40, drawZone1Floor);

  // ── north side: a row of shops, each one its own framed "panel" ──
  const front = Z1.minZ - 0.35;
  const shops: Parameters<typeof shopfront>[1][] = [
    { x: -17.2, width: 6.4, front, wall: '#f58f6c', awning: STREET.red, sign: 'BAKERY', signBg: '#fff3d6', signFg: STREET.red, door: STREET.teal, height: 6.4 },
    { x: -10.3, width: 5.6, front, wall: '#7fd0c2', awning: STREET.mustard, sign: 'COMICS', signBg: '#ffd23a', signFg: STREET.red, door: STREET.red, height: 7.6 },
    { x: -4.2, width: 7.2, front, wall: '#ffd77a', awning: STREET.blue, sign: 'SUNNY CAFE', signBg: '#fffaf0', signFg: STREET.blue, door: STREET.blue, height: 6.8 },
    { x: 3.5, width: 5.4, front, wall: '#f7a8b8', awning: STREET.teal, sign: 'TOYS', signBg: '#fff3d6', signFg: '#d6397a', door: STREET.mustard, height: 7.9 },
    { x: 9.4, width: 7.8, front, wall: '#9ccbf0', awning: STREET.red, sign: 'HERO SUPPLY', signBg: '#ffd23a', signFg: STREET.ink, door: STREET.red, height: 6.6 },
  ];
  shops.forEach((s) => shopfront(kit, s));
  // the alleys between shops are white gutters: close them with a plain paper wall
  kit.box(0, 0, front - 1.2, 36, 5.5, 0.4, STREET.white, { outline: false });

  // ── west end: a wall with the comic's own cover as a mural ──
  kit.box(Z1.minX - 2.6, 0, 0, 4, 7, 14.2, '#f2c36b', { shadow: true });
  kit.box(Z1.minX - 2.6, 7, 0, 4.5, 0.4, 14.7, STREET.ink);
  kit.box(Z1.minX - 0.55, 0, 0, 0.14, 0.42, 14.3, STREET.ink, { outline: false });
  kit.plane(kit.track(coverMural()), Z1.minX - 0.52, 2.9, 0, 7.6, 4.6, { rotY: Math.PI / 2 });

  // ── east end: the gate to the next panel ──
  const gx = Z1.maxX + 0.5;
  for (const z of [-4.6, 4.6]) {
    kit.box(gx, 0, z, 1.1, 5.2, 1.1, STREET.white, { shadow: true });
    kit.box(gx, 0, z, 1.3, 0.5, 1.3, STREET.ink, { outline: false });
    kit.glow(gx - 0.2, 3.1, z, 0.26, STREET.lamp, 2.8);
    kit.collideCircle(gx, z, 0.85);
  }
  kit.box(gx, 5.2, 0, 1.2, 0.7, 10.4, STREET.red);
  kit.plane(kit.track(signTexture('NEXT PANEL!', '#ffd23a', STREET.red, 768, 150)), gx - 0.62, 4.4, 0, 6.4, 1.25, { rotY: -Math.PI / 2 });
  // low walls closing the corners either side of the gate
  kit.box(gx + 0.3, 0, -7.4, 1.6, 2.4, 4.6, '#f58f6c', { shadow: true });
  kit.box(gx + 0.3, 0, 6.2, 1.6, 0.9, 2.2, STREET.white);

  // ── south side: the panel border itself, raised like a kerb, and low planting ──
  kit.box(0, 0, Z1.panel.maxZ, Z1.panel.maxX - Z1.panel.minX, 0.16, 0.26, '#120c10', { outline: false });
  planter(kit, -9.5, 5.55, 3.2);
  planter(kit, 4.5, 5.55, 3.2);
  bench(kit, -2.6, 5.5, Math.PI);
  hydrant(kit, 0.4, 4.3);
  trafficCone(kit, 11.6, 4.5);
  trafficCone(kit, 12.5, 5.2);

  // ── north sidewalk furniture (kept close to the shops so the road stays open for fighting) ──
  for (const x of [-13.2, -4.6, 3.1, 11.2]) lampPost(kit, x, -4.15);
  tree(kit, -8.7, -4.6, 1.0);
  tree(kit, 7.4, -4.6, 1.05);
  kiosk(kit, -0.8, -5.35, 'NEWS!');
  mailbox(kit, -11.6, -5.3);
  crate(kit, 13.6, -5.2, 1.0, 0.25);
  crate(kit, 14.5, -4.6, 0.75, -0.4);
  crate(kit, 13.75, -5.15, 0.6, 0.6, 1.0);
  barrel(kit, 5.2, -5.5);
  barrel(kit, -14.6, -5.4, STREET.red);

  kit.rectBounds(Z1.minX, Z1.maxX, Z1.minZ, Z1.maxZ);
  kit.finish();

  return {
    playerSpawn: new THREE.Vector3(-11.5, 0, 0.6),
    enemySpawns: [
      [-2.5, 0.8],
      [0.5, -1.6],
      [1.5, 2.6],
      [6, 0],
      [8.5, -2.4],
      [9, 2.8],
      [12.5, -0.8],
      [13.5, 2.2],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    exit: new THREE.Vector3(Z1.maxX - 1.4, 0, 0),
  };
}

/** The mural on the west wall: the cover of issue #1. A cheerful sunrise — the lie, on a poster. */
function coverMural(): THREE.CanvasTexture {
  return canvasTexture(1024, 620, (g, w, h) => {
    g.fillStyle = '#ffcf4a';
    g.fillRect(0, 0, w, h);
    speedLines(g, w / 2, h * 0.9, 120, 900, 34, '#fff2b0', 4, 3.2);
    halftone(g, 0, 0, w, h * 0.6, 'rgba(232,70,58,0.28)', 18, 6, 'down');
    g.fillStyle = '#fffaf0';
    g.beginPath();
    g.arc(w / 2, h * 0.92, 190, Math.PI, 0);
    g.fill();
    g.lineWidth = 12;
    g.strokeStyle = '#1a1013';
    g.stroke();
    comicText(g, 'FALSE DAWN', w / 2, h * 0.34, 190, '#e8463a', { strokeWidth: 30 });
    g.fillStyle = '#1a1013';
    g.fillRect(40, 36, 190, 64);
    comicText(g, 'ISSUE #1', 135, 70, 44, '#ffd23a', { strokeWidth: 0, shadow: false, lean: 0 });
    comicText(g, 'A HERO RISES!', w / 2, h * 0.63, 64, '#fffaf0', { strokeWidth: 14 });
    inkFrame(g, 10, 10, w - 20, h - 20, 20);
  });
}
