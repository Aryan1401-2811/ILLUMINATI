import { rng } from '../props/canvas';
import { floorDots } from '../props/pageFloor';

/** Zone 3 measurements (metres): a round square. The exit gate is to the north. */
export const Z3 = {
  radius: 13,
  panelRadius: 14.3,
  gateZ: -15.2,
  floor: { minX: -24, maxX: 24, minZ: -21, maxZ: 18 },
  /** Straight crack segments [x0, z0, x1, z1], painted on the floor with violet in the gap. */
  cracks: [
    [1.2, 3.4, 6.5, 8.2],
    [-3.0, 2.2, -9.4, 5.6],
    [-2.6, -3.4, -7.6, -9.6],
    [3.2, -2.6, 10.2, -5.4],
  ] as [number, number, number, number][],
};

const C = {
  ink: '#140d12',
  page: '#e2cfa3',
  stoneA: '#ead9b2',
  stoneB: '#dfc999',
  joint: 'rgba(90,55,25,0.42)',
  violet: '#8f6bf0',
  violetDeep: '#2a1760',
  violetPale: '#d8c9ff',
  tape: 'rgba(255,244,176,0.86)',
};

/** Paints the worn square: paving, creeping ink, cracks leaking violet, tears, tape, stains. */
export function drawZone3Floor(g: CanvasRenderingContext2D) {
  const r = rng(33);
  const f = Z3.floor;
  const R = Z3.panelRadius;

  g.fillStyle = C.page;
  g.fillRect(f.minX, f.minZ, f.maxX - f.minX, f.maxZ - f.minZ);
  floorDots(g, f.minX, f.minZ, f.maxX - f.minX, f.maxZ - f.minZ, 'rgba(90,55,25,0.16)', 0.42, 0.12);
  // pencil construction lines that were never inked: the page is unfinished out here
  g.strokeStyle = 'rgba(90,140,200,0.45)';
  g.lineWidth = 0.04;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a) * 34, Math.sin(a) * 34);
    g.stroke();
  }
  for (const rad of [16.5, 19, 22]) {
    g.beginPath();
    g.arc(0, 0, rad, 0, Math.PI * 2);
    g.stroke();
  }
  // the path north to the gate
  g.fillStyle = C.stoneB;
  g.fillRect(-2.6, Z3.gateZ - 1.5, 5.2, -Z3.gateZ - R + 3);
  g.strokeStyle = C.ink;
  g.lineWidth = 0.18;
  g.strokeRect(-2.6, Z3.gateZ - 1.5, 5.2, -Z3.gateZ - R + 3);

  // ── the round panel: ring paving ──
  g.save();
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = C.stoneA;
  g.fillRect(-R, -R, R * 2, R * 2);
  const ringW = 1.25;
  for (let i = 0; i * ringW < R; i++) {
    const r0 = i * ringW;
    if (i % 2) {
      g.fillStyle = C.stoneB;
      g.beginPath();
      g.arc(0, 0, r0 + ringW, 0, Math.PI * 2);
      g.arc(0, 0, r0, 0, Math.PI * 2, true);
      g.fill();
    }
    g.strokeStyle = C.joint;
    g.lineWidth = 0.045;
    g.beginPath();
    g.arc(0, 0, r0 + ringW, 0, Math.PI * 2);
    g.stroke();
    const joints = Math.max(6, Math.round((r0 + ringW) * 3.2));
    for (let j = 0; j < joints; j++) {
      const a = ((j + (i % 2) * 0.5) / joints) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      g.lineTo(Math.cos(a) * (r0 + ringW), Math.sin(a) * (r0 + ringW));
      g.stroke();
    }
  }
  // heavy halftone closing in from the rim: the light is going
  for (let i = 0; i < 3; i++) {
    g.save();
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.arc(0, 0, R - 2.2 - i * 1.6, 0, Math.PI * 2, true);
    g.clip();
    floorDots(g, -R, -R, R * 2, R * 2, 'rgba(60,30,20,0.2)', 0.36, 0.1);
    g.restore();
  }
  // old stains
  g.strokeStyle = 'rgba(120,70,30,0.3)';
  g.lineWidth = 0.14;
  for (const [x, z, rad] of [[-6, 6.5, 1.5], [7.5, 2.5, 1.1], [3.5, -8, 1.7], [-9, -3, 1.2]] as const) {
    g.beginPath();
    g.arc(x, z, rad, 0.3, Math.PI * 1.85);
    g.stroke();
  }

  // ── ink creeping in over the art ──
  inkBlot(g, r, -12, -1.5, 3.8);
  inkBlot(g, r, 10, -10, 3.6);
  inkBlot(g, r, 8.8, 9.8, 3.2);
  inkBlot(g, r, -6.5, 11, 2.4);

  // ── tears: the page is ripped and something violet shines underneath ──
  tear(g, r, -5.2, -5.8, 2.1);
  tear(g, r, 6.4, 5.2, 1.7);
  tear(g, r, -8.4, 7.2, 1.3);

  // ── cracks that leak the same violet ──
  for (const [x0, z0, x1, z1] of Z3.cracks) {
    for (const [w, col] of [[0.34, C.ink], [0.13, '#b79bff']] as const) {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x0, z0);
      g.lineTo(x1, z1);
      g.stroke();
    }
    // hairline branches
    g.strokeStyle = C.ink;
    g.lineWidth = 0.06;
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      const bx = x0 + (x1 - x0) * t;
      const bz = z0 + (z1 - z0) * t;
      g.beginPath();
      g.moveTo(bx, bz);
      g.lineTo(bx + (r() - 0.5) * 2.4, bz + (r() - 0.5) * 2.4);
      g.stroke();
    }
    // somebody tried to hold the page together with tape
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    g.save();
    g.translate(mx, mz);
    g.rotate(Math.atan2(z1 - z0, x1 - x0) + Math.PI / 2 + (r() - 0.5) * 0.5);
    g.fillStyle = C.tape;
    g.fillRect(-1.0, -0.26, 2.0, 0.52);
    g.strokeStyle = 'rgba(26,16,19,0.4)';
    g.lineWidth = 0.035;
    g.strokeRect(-1.0, -0.26, 2.0, 0.52);
    g.restore();
  }
  g.restore();

  // the panel border, drawn rough and doubled: the inker's hand is no longer steady
  for (const [rad, w] of [[R, 0.32], [R + 0.42, 0.07]] as const) {
    g.strokeStyle = C.ink;
    g.lineWidth = w;
    g.beginPath();
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const rr = rad + (r() - 0.5) * 0.09;
      g[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.stroke();
  }
}

/** A spreading pool of ink with fingers reaching outward. */
function inkBlot(g: CanvasRenderingContext2D, r: () => number, x: number, z: number, size: number) {
  g.fillStyle = C.ink;
  g.beginPath();
  const lobes = 14;
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const rad = size * (0.5 + r() * 0.5);
    const px = x + Math.cos(a) * rad;
    const pz = z + Math.sin(a) * rad;
    if (i === 0) g.moveTo(px, pz);
    else {
      const am = a - Math.PI / lobes;
      const rm = size * (0.35 + r() * 0.3);
      g.quadraticCurveTo(x + Math.cos(am) * rm, z + Math.sin(am) * rm, px, pz);
    }
  }
  g.fill();
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const d = size * (0.9 + r() * 0.7);
    g.beginPath();
    g.arc(x + Math.cos(a) * d, z + Math.sin(a) * d, 0.06 + r() * 0.2, 0, Math.PI * 2);
    g.fill();
  }
}

/** A ragged hole in the page: curled pale edge, ink shadow, violet light inside. */
function tear(g: CanvasRenderingContext2D, r: () => number, x: number, z: number, size: number) {
  const pts: [number, number][] = [];
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = size * (0.55 + r() * 0.55);
    pts.push([x + Math.cos(a) * rad * 1.25, z + Math.sin(a) * rad * 0.8]);
  }
  const path = (dx: number, dz: number) => {
    g.beginPath();
    pts.forEach(([px, pz], i) => g[i === 0 ? 'moveTo' : 'lineTo'](px + dx, pz + dz));
    g.closePath();
  };
  path(0, 0);
  g.lineJoin = 'round';
  g.strokeStyle = '#fffaf0';
  g.lineWidth = 0.42;
  g.stroke(); // the curled paper lip
  g.strokeStyle = C.ink;
  g.lineWidth = 0.1;
  g.stroke();
  const grad = g.createRadialGradient(x, z, 0.1, x, z, size * 1.3);
  grad.addColorStop(0, C.violetPale);
  grad.addColorStop(0.45, C.violet);
  grad.addColorStop(1, C.violetDeep);
  g.fillStyle = grad;
  path(0, 0);
  g.fill();
}
