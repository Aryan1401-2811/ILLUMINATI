import type { ZoneKit } from './ZoneKit';
import { STREET, stripedAwning } from './street';

/** Rooftop-market props for Zone 2. Mid-arena obstacles stay LOW so they never hide a fighter. */

const PRODUCE = ['#e8463a', '#f2b632', '#62c57a', '#ff8a3a', '#b9a0ff'];

/** A market stall with a striped canopy. Tall: only use it along the far (north) edge. */
export function marketStall(kit: ZoneKit, x: number, z: number, color: string, width = 3) {
  kit.box(x, 0, z, width, 0.95, 1.3, STREET.wood, { shadow: true });
  kit.box(x, 0.95, z, width + 0.1, 0.08, 1.4, STREET.woodDark, { outline: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.cyl(x + sx * (width / 2 - 0.1), 0, z + sz * 0.6, 0.06, 0.06, 2.5, STREET.woodDark, { segments: 6, outline: false });
  stripedAwning(kit, x, 2.55, z + 0.1, width + 0.5, 2.0, color);
  const n = Math.floor(width / 0.42);
  for (let i = 0; i < n; i++) {
    const px = x - width / 2 + 0.3 + i * 0.42;
    kit.ball(px, 1.14, z + 0.25 + (i % 2) * 0.22, 0.17, PRODUCE[i % PRODUCE.length], { outline: false });
    kit.ball(px + 0.1, 1.14, z - 0.25, 0.15, PRODUCE[(i + 2) % PRODUCE.length], { outline: false });
  }
  kit.collideBox(x, z, width + 0.1, 1.5);
}

/** Low open table of goods: cover you can see over. */
export function marketTable(kit: ZoneKit, x: number, z: number, rotY = 0, cloth = STREET.red) {
  kit.box(x, 0, z, 2.4, 0.8, 1.1, cloth, { rotY, shadow: true });
  kit.box(x, 0.8, z, 2.5, 0.07, 1.2, STREET.white, { rotY, outline: false });
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  for (let i = 0; i < 5; i++) {
    const t = -0.9 + i * 0.45;
    kit.ball(x + c * t, 0.98, z - s * t, 0.16, PRODUCE[(i * 2) % PRODUCE.length], { outline: false });
  }
  kit.collideCircle(x, z, 1.05);
}

/** Chunky air-conditioning block: the main thing to kite a Brute around. */
export function acUnit(kit: ZoneKit, x: number, z: number, w = 2.2, d = 2.2) {
  kit.box(x, 0, z, w, 1.15, d, '#cfd9df', { shadow: true });
  kit.box(x, 1.15, z, w + 0.12, 0.1, d + 0.12, STREET.metal);
  kit.cyl(x, 1.25, z, 0.62, 0.62, 0.08, STREET.ink, { segments: 14, outline: false });
  for (let i = 0; i < 4; i++) kit.box(x, 0.22 + i * 0.2, z + d / 2 + 0.01, w * 0.7, 0.07, 0.03, STREET.metal, { outline: false });
  kit.collideBox(x, z, w, d);
}

/** Round water tank on short legs. */
export function waterTank(kit: ZoneKit, x: number, z: number, r = 1.35, color = '#8fd3c7') {
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    kit.cyl(x + Math.cos(a) * r * 0.7, 0, z + Math.sin(a) * r * 0.7, 0.09, 0.09, 0.5, STREET.metal, { segments: 6, outline: false });
  }
  kit.cyl(x, 0.5, z, r, r, 1.5, color, { segments: 18, shadow: true });
  kit.cyl(x, 2.0, z, 0.15, r * 1.02, 0.55, STREET.metal, { segments: 18 });
  kit.cyl(x, 0.85, z, r * 1.02, r * 1.02, 0.1, STREET.ink, { segments: 18, outline: false });
  kit.cyl(x, 1.55, z, r * 1.02, r * 1.02, 0.1, STREET.ink, { segments: 18, outline: false });
  kit.collideCircle(x, z, r + 0.05);
}

/** Flat glass skylight: decoration only, you can walk on it. */
export function skylight(kit: ZoneKit, x: number, z: number, w = 2.4, d = 1.6) {
  kit.box(x, 0, z, w, 0.08, d, STREET.ink, { outline: false });
  kit.box(x, 0.08, z, w - 0.2, 0.03, d - 0.2, STREET.glass, { outline: false });
  kit.box(x, 0.11, z, 0.08, 0.02, d - 0.2, STREET.ink, { outline: false });
}

/** Chimney-style vent pipe. */
export function ventPipe(kit: ZoneKit, x: number, z: number, height = 1.3) {
  kit.cyl(x, 0, z, 0.3, 0.36, height, '#d98a6a', { segments: 10, shadow: true });
  kit.cyl(x, height, z, 0.42, 0.34, 0.2, STREET.ink, { segments: 10 });
  kit.collideCircle(x, z, 0.44);
}

/** A line of little triangular flags between two points (kept off the fighting space). */
export function bunting(kit: ZoneKit, x0: number, z0: number, x1: number, z1: number, y: number, count = 12) {
  const colors = [STREET.red, STREET.mustard, STREET.teal, STREET.blue, STREET.white];
  const rotY = -Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const sag = Math.sin(t * Math.PI) * 0.55;
    kit.cyl(x0 + (x1 - x0) * t, y - sag - 0.4, z0 + (z1 - z0) * t, 0.2, 0.01, 0.4, colors[i % colors.length], { segments: 3, rotY, outline: false });
  }
  for (const [px, pz] of [[x0, z0], [x1, z1]] as const) kit.cyl(px, 0, pz, 0.07, 0.09, y, STREET.metal, { segments: 6, shadow: true });
}
