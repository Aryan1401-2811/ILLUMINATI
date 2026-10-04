import { rng, speedLines } from '../props/canvas';
import { floorDots, floorFrame, floorText } from '../props/pageFloor';

/** Zone 1 measurements (metres). The street runs west → east; the camera looks north. */
export const Z1 = {
  /** Play area. */
  minX: -16,
  maxX: 16,
  minZ: -6.3,
  maxZ: 6.3,
  /** Kerbs: road between them, sidewalks outside. */
  kerbN: -3.4,
  kerbS: 3.4,
  /** The comic panel that contains the street. */
  panel: { minX: -17.2, maxX: 17.2, minZ: -9, maxZ: 7.1 },
  floor: { minX: -26, maxX: 26, minZ: -10, maxZ: 20 },
  crosswalkX: 9.5,
};

const C = {
  ink: '#1a1013',
  paper: '#fbf1dc',
  sidewalk: '#fff0cf',
  road: '#f6cd7c',
  roadDot: 'rgba(196,120,40,0.34)',
  kerb: '#fffaf0',
  paint: '#fffaf0',
  sun: 'rgba(255,255,240,0.3)',
  red: '#e8463a',
  teal: '#3fb6a8',
};

/** Paints the Zone 1 street as one big comic panel, with the rest of the page below it. */
export function drawZone1Floor(g: CanvasRenderingContext2D) {
  const r = rng(11);
  const p = Z1.panel;
  const pw = p.maxX - p.minX;

  // ── the street panel ──
  g.fillStyle = C.sidewalk;
  g.fillRect(p.minX, p.minZ, pw, p.maxZ - p.minZ);
  // paving slabs
  g.strokeStyle = 'rgba(120,70,30,0.3)';
  g.lineWidth = 0.035;
  for (const [z0, z1] of [[p.minZ, Z1.kerbN], [Z1.kerbS, p.maxZ]] as const) {
    for (let x = p.minX; x < p.maxX; x += 1.5) {
      g.beginPath();
      g.moveTo(x, z0);
      g.lineTo(x, z1);
      g.stroke();
    }
    for (let z = z0 + 1.45; z < z1; z += 1.45) {
      g.beginPath();
      g.moveTo(p.minX, z);
      g.lineTo(p.maxX, z);
      g.stroke();
    }
  }
  // road
  g.fillStyle = C.road;
  g.fillRect(p.minX, Z1.kerbN, pw, Z1.kerbS - Z1.kerbN);
  floorDots(g, p.minX, Z1.kerbN, pw, 2.2, C.roadDot, 0.3, 0.085, 'south');
  floorDots(g, p.minX, Z1.kerbS - 1.5, pw, 1.5, C.roadDot, 0.3, 0.07, 'north');
  // slanting morning sunbeams falling between the buildings
  g.fillStyle = C.sun;
  for (const x of [-12.5, -5, 2.5, 11]) {
    g.beginPath();
    g.moveTo(x, p.minZ);
    g.lineTo(x + 2.3, p.minZ);
    g.lineTo(x + 2.3 + 5, p.maxZ);
    g.lineTo(x + 5, p.maxZ);
    g.closePath();
    g.fill();
  }
  // kerbs: pale stone with an ink line each side
  for (const z of [Z1.kerbN, Z1.kerbS]) {
    g.fillStyle = C.kerb;
    g.fillRect(p.minX, z - 0.14, pw, 0.28);
    g.fillStyle = C.ink;
    g.fillRect(p.minX, z - 0.17, pw, 0.055);
    g.fillRect(p.minX, z + 0.115, pw, 0.055);
  }
  // dashed centre line
  for (let x = p.minX + 0.8; x < p.maxX - 2; x += 3) {
    if (Math.abs(x + 0.9 - Z1.crosswalkX) < 2.6) continue;
    g.fillStyle = C.ink;
    g.fillRect(x - 0.05, -0.16, 1.9, 0.32);
    g.fillStyle = C.paint;
    g.fillRect(x, -0.11, 1.8, 0.22);
  }
  // zebra crossing
  for (let i = 0; i < 6; i++) {
    const z = Z1.kerbN + 0.5 + i * 1.06;
    g.fillStyle = C.ink;
    g.fillRect(Z1.crosswalkX - 1.55, z - 0.05, 3.1, 0.72);
    g.fillStyle = C.paint;
    g.fillRect(Z1.crosswalkX - 1.5, z, 3.0, 0.62);
  }
  // manhole covers
  for (const [x, z] of [[-7.5, 1.6], [3.2, -1.7]] as const) {
    g.fillStyle = C.ink;
    g.beginPath();
    g.arc(x, z, 0.62, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c99a4e';
    g.beginPath();
    g.arc(x, z, 0.54, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = C.ink;
    g.lineWidth = 0.05;
    for (let i = -3; i <= 3; i++) {
      const h = Math.sqrt(Math.max(0, 0.5 * 0.5 - (i * 0.15) ** 2));
      g.beginPath();
      g.moveTo(x + i * 0.15, z - h);
      g.lineTo(x + i * 0.15, z + h);
      g.stroke();
    }
  }
  // a few hand-drawn cracks and scuffs so the road is not a flat fill
  g.strokeStyle = 'rgba(26,16,19,0.5)';
  g.lineWidth = 0.035;
  for (let i = 0; i < 14; i++) {
    let x = p.minX + 1 + r() * (pw - 2);
    let z = Z1.kerbN + 0.4 + r() * (Z1.kerbS - Z1.kerbN - 0.8);
    g.beginPath();
    g.moveTo(x, z);
    for (let s = 0; s < 3; s++) {
      x += 0.25 + r() * 0.4;
      z += (r() - 0.5) * 0.5;
      g.lineTo(x, z);
    }
    g.stroke();
  }
  // the way on: a big painted arrow and impact lines at the exit
  speedLines(g, Z1.maxX - 1.6, 0, 1.3, 4.6, 26, 'rgba(255,255,240,0.55)', 5, 2.2);
  g.fillStyle = C.ink;
  arrow(g, Z1.maxX - 4.6, 0, 3.3, 1.16);
  g.fillStyle = C.red;
  arrow(g, Z1.maxX - 4.5, 0, 3.0, 0.92);
  floorText(g, 'GO!', Z1.minX + 6.2, 2.1, 0.95, C.paint, { strokeWidth: 12, lean: -0.2 });

  // the panel's ink border
  floorFrame(g, p.minX, p.minZ, pw, p.maxZ - p.minZ, 0.26, C.ink);

  // ── the rest of the page: the panels below the street ──
  const top = p.maxZ + 0.75; // the white gutter
  const bottom = Z1.floor.maxZ - 0.6;
  const panels: [number, number, string][] = [
    [p.minX, -6.2, '#ffd98a'],
    [-5.5, 6.4, '#9fdccf'],
    [7.1, p.maxX, '#f7b4a3'],
  ];
  panels.forEach(([x0, x1, fill], i) => {
    g.fillStyle = fill;
    g.fillRect(x0, top, x1 - x0, bottom - top);
    floorDots(g, x0, top, x1 - x0, bottom - top, 'rgba(26,16,19,0.13)', 0.42, 0.13, i === 1 ? 'south' : 'north');
    g.save();
    g.beginPath();
    g.rect(x0, top, x1 - x0, bottom - top);
    g.clip();
    if (i === 0) speedLines(g, (x0 + x1) / 2, top + 5.5, 1.6, 12, 30, 'rgba(255,250,240,0.75)', 3, 2.4);
    if (i === 2) speedLines(g, x1 - 2, top + 2, 1.2, 14, 26, 'rgba(26,16,19,0.2)', 9, 2);
    g.restore();
    floorFrame(g, x0, top, x1 - x0, bottom - top, 0.22, C.ink);
  });
  floorText(g, 'KRAK!', -11.7, top + 4.6, 2.4, C.red, { rotate: -0.16 });
  // a caption box, like the Narrator's
  g.fillStyle = C.ink;
  g.fillRect(-4.75, top + 0.75, 7.3, 1.75);
  g.fillStyle = '#ffe9a8';
  g.fillRect(-4.9, top + 0.6, 7.3, 1.75);
  floorFrame(g, -4.9, top + 0.6, 7.3, 1.75, 0.1, C.ink);
  floorText(g, 'MEANWHILE, IN THE CITY…', -1.25, top + 1.5, 0.78, C.ink, { strokeWidth: 0, shadow: false, lean: 0 });
  floorText(g, 'POW!', 12.3, top + 5, 2.2, '#ffd23a', { rotate: 0.12 });
}

/** Chunky right-pointing arrow centred on (x, z). */
function arrow(g: CanvasRenderingContext2D, x: number, z: number, length: number, half: number) {
  const shaft = half * 0.45;
  g.beginPath();
  g.moveTo(x - length / 2, z - shaft);
  g.lineTo(x + length * 0.08, z - shaft);
  g.lineTo(x + length * 0.08, z - half);
  g.lineTo(x + length / 2, z);
  g.lineTo(x + length * 0.08, z + half);
  g.lineTo(x + length * 0.08, z + shaft);
  g.lineTo(x - length / 2, z + shaft);
  g.closePath();
  g.fill();
}
