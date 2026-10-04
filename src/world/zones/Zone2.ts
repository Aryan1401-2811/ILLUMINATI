import * as THREE from 'three';
import type { GameScene } from '@/core/GameScene';
import { ZoneKit } from '../props/ZoneKit';
import { signTexture } from '../props/canvas';
import { pageFloor } from '../props/pageFloor';
import { STREET, barrel, crate, lampPost, planter } from '../props/street';
import { acUnit, bunting, marketStall, marketTable, skylight, ventPipe, waterTank } from '../props/market';
import { Z2, drawZone2Floor } from './zone2Floor';
import type { ZoneLayout } from './types';

/**
 * ZONE 2 — "Rooftop Market". Wider and more open than the street, with chunky low cover
 * (air-con blocks, a water tank, tables) placed so a Brute can be kited in circles around them.
 * Still bright and gold: this is where the Narrator hands over his "Light".
 */
export function buildZone2(scene: GameScene): ZoneLayout {
  const kit = new ZoneKit(scene, 'zone2');
  pageFloor(kit, Z2.floor, 36, drawZone2Floor, '#f3dfb2');
  const roof = Z2.roof;

  // ── parapet: tall at the back, low at the front so it never blocks the camera ──
  const wall = '#fff3d6';
  kit.box(0, 0, roof.minZ + 0.3, roof.maxX - roof.minX, 1.0, 0.6, wall, { shadow: true });
  kit.box(roof.minX + 0.3, 0, 0, 0.6, 1.0, roof.maxZ - roof.minZ, wall, { shadow: true });
  kit.box(0, 0, roof.maxZ - 0.25, roof.maxX - roof.minX, 0.32, 0.5, wall);
  // east side has a gap for the gangway
  for (const [z0, z1] of [[roof.minZ, -2.2], [2.2, roof.maxZ]] as const) kit.box(roof.maxX - 0.3, 0, (z0 + z1) / 2, 0.6, 1.0, z1 - z0, wall, { shadow: true });
  for (const z of [-2.2, 2.2]) {
    kit.box(roof.maxX - 0.3, 0, z, 0.9, 2.6, 0.9, STREET.white, { shadow: true });
    kit.glow(roof.maxX - 0.55, 2.2, z, 0.24, STREET.lamp, 2.8);
  }
  kit.plane(kit.track(signTexture('ONWARD!', '#ffd23a', STREET.red, 512, 150)), roof.maxX - 0.8, 3.3, 0, 4.2, 1.2, { rotY: -Math.PI / 2 });
  kit.box(roof.maxX - 0.3, 2.6, 0, 0.5, 0.35, 5.3, STREET.red);
  // the gangway to the next roof
  kit.box(roof.maxX + 3, -0.12, 0, 6, 0.14, 3.4, STREET.wood);
  for (let i = 0; i < 6; i++) kit.box(roof.maxX + 0.5 + i, 0.02, 0, 0.06, 0.02, 3.4, STREET.woodDark, { outline: false });
  for (const z of [-1.6, 1.6]) kit.box(roof.maxX + 3, 0, z, 6, 0.75, 0.1, STREET.woodDark);

  // ── north: the taller building next door, with the market's big sign and awnings ──
  kit.box(0, 0, roof.minZ - 2.6, roof.maxX - roof.minX + 6, 7.5, 4, '#f58f6c', { shadow: true });
  kit.box(0, 0, roof.minZ - 0.56, roof.maxX - roof.minX + 6, 0.45, 0.14, STREET.ink, { outline: false });
  kit.plane(kit.track(signTexture('ROOFTOP MARKET', '#fff3d6', STREET.red, 1024, 190)), 0, 4.3, roof.minZ - 0.55, 11, 2.0);
  for (const x of [-11.5, -7.2, 7.2, 11.5]) {
    kit.box(x, 1.3, roof.minZ - 0.56, 2.0, 2.2, 0.12, STREET.ink, { outline: false });
    kit.box(x, 1.42, roof.minZ - 0.52, 1.76, 1.96, 0.1, STREET.glass, { outline: false });
  }
  marketStall(kit, -9.4, roof.minZ + 2.0, STREET.red, 3.2);
  marketStall(kit, -3.2, roof.minZ + 2.0, STREET.teal, 3.0);
  marketStall(kit, 3.2, roof.minZ + 2.0, STREET.mustard, 3.0);
  marketStall(kit, 9.4, roof.minZ + 2.0, STREET.blue, 3.2);
  bunting(kit, -14.6, roof.minZ + 0.9, 14.6, roof.minZ + 0.9, 4.4, 30);

  // ── west: the stairwell the hero arrives from ──
  kit.box(roof.minX + 2.4, 0, -5.2, 3.4, 3.0, 3.4, '#9ccbf0', { shadow: true });
  kit.box(roof.minX + 2.4, 3.0, -5.2, 3.8, 0.3, 3.8, STREET.ink);
  kit.box(roof.minX + 4.12, 0, -5.2, 0.08, 2.3, 1.3, STREET.red, { outline: false });
  kit.collideBox(roof.minX + 2.4, -5.2, 3.5, 3.5);

  // ── cover to kite around: low, chunky, well spaced (gaps ≥ 3 m so a Brute fits) ──
  acUnit(kit, -5.6, -1.2);
  acUnit(kit, 6.2, 2.4, 2.4, 2.0);
  waterTank(kit, 7.0, -4.4);
  marketTable(kit, -8.6, 4.6, 0.25);
  marketTable(kit, -0.4, 5.6, -0.12, STREET.blue);
  ventPipe(kit, -1.4, -4.6);
  ventPipe(kit, 11.6, 6.0, 1.1);
  crate(kit, -12.6, 2.2, 1.0, 0.3);
  crate(kit, -12.2, 3.3, 0.8, -0.2);
  crate(kit, 12.3, -6.4, 1.0, 0.15);
  crate(kit, 12.4, -6.4, 0.7, 0.5, 1.0);
  barrel(kit, 2.6, -6.2, STREET.red);
  barrel(kit, -11.0, -1.4);
  skylight(kit, 0.6, -1.8);
  skylight(kit, -9.6, -1.6, 1.8, 1.4);
  lampPost(kit, -13.6, 8.0);
  lampPost(kit, 13.4, -8.2);
  planter(kit, 5.5, 8.5, 3.0);
  planter(kit, -5.0, 8.5, 3.0);

  kit.rectBounds(Z2.minX, Z2.maxX, Z2.minZ, Z2.maxZ);
  kit.finish();

  return {
    playerSpawn: new THREE.Vector3(-10.6, 0, -4.4),
    enemySpawns: [
      [-1.5, 1.8],
      [2.4, 3.6],
      [3.6, -1.2],
      [-3.4, -3.2],
      [9.6, 0],
      [11.4, 3.4],
      [10.6, -3.6],
      [-6.6, 2.4],
      [0.6, 7.2],
      [12.4, 7.2],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    exit: new THREE.Vector3(Z2.maxX - 0.8, 0, 0),
  };
}
