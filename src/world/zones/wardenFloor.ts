import { rng } from '../props/canvas';
import { floorDots, floorFrame } from '../props/pageFloor';

/** Warden sanctum measurements (metres): a round chamber set inside one enormous square panel. */
export const WA = {
  radius: 12.5,
  wallRadius: 14.2,
  panel: 16.5,
  sealZ: -11.4,
  floor: { minX: -24, maxX: 24, minZ: -22, maxZ: 20 },
};

const C = {
  ink: '#140d12',
  page: '#efe6d2',
  stoneA: '#d6cfe6',
  stoneB: '#bdb3d6',
  stoneC: '#a79cc6',
  line: 'rgba(40,24,70,0.5)',
  violet: '#8f6bf0',
  violetPale: '#dccfff',
};

/** Paints the sanctum floor: ringed stone, a rune band, and the great seal in the middle. */
export function drawWardenFloor(g: CanvasRenderingContext2D) {
  const r = rng(44);
  const f = WA.floor;
  const P = WA.panel;

  g.fillStyle = C.page;
  g.fillRect(f.minX, f.minZ, f.maxX - f.minX, f.maxZ - f.minZ);
  // the huge panel the sanctum sits inside
  g.fillStyle = '#8c80b4';
  g.fillRect(-P, -P - 1.5, P * 2, P * 2 + 1.5);
  floorDots(g, -P, -P - 1.5, P * 2, P * 2 + 1.5, 'rgba(20,13,18,0.28)', 0.42, 0.14);

  // ── the round chamber ──
  const R = WA.wallRadius;
  g.save();
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = C.stoneA;
  g.fillRect(-R, -R, R * 2, R * 2);
  const bands: [number, number, string][] = [
    [R, 11.2, C.stoneC],
    [11.2, 9.6, C.stoneA],
    [9.6, 8.2, C.stoneB],
    [5.0, 4.2, C.stoneB],
  ];
  for (const [outer, inner, col] of bands) {
    g.fillStyle = col;
    g.beginPath();
    g.arc(0, 0, outer, 0, Math.PI * 2);
    g.arc(0, 0, inner, 0, Math.PI * 2, true);
    g.fill();
  }
  // slab joints
  g.strokeStyle = C.line;
  g.lineWidth = 0.05;
  for (const rad of [4.2, 5.0, 8.2, 9.6, 11.2]) {
    g.beginPath();
    g.arc(0, 0, rad, 0, Math.PI * 2);
    g.stroke();
  }
  for (const [r0, r1, n] of [[5.0, 8.2, 18], [9.6, 11.2, 30], [11.2, R, 36]] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      g.stroke();
    }
  }
  // rune band: simple carved glyphs, inked, with violet in the grooves
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    g.save();
    g.translate(Math.cos(a) * 8.9, Math.sin(a) * 8.9);
    g.rotate(a + Math.PI / 2);
    for (const [w, col] of [[0.16, C.ink], [0.06, C.violetPale]] as const) {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.lineCap = 'round';
      g.beginPath();
      const k = i % 4;
      g.moveTo(-0.3, -0.42);
      g.lineTo(k === 0 ? 0.3 : -0.3, 0.42);
      if (k !== 1) {
        g.moveTo(0.3, -0.42);
        g.lineTo(k === 2 ? -0.3 : 0.3, 0.1);
      }
      if (k === 3) {
        g.moveTo(-0.3, 0);
        g.lineTo(0.3, 0);
      }
      g.stroke();
    }
    g.restore();
  }
  // the great seal: an eight-pointed star with an eye-like centre
  for (const [w, col] of [[0.3, C.ink], [0.12, C.violet]] as const) {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.lineJoin = 'miter';
    for (const turn of [0, Math.PI / 4]) {
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = turn + (i / 4) * Math.PI * 2;
        g[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * 3.9, Math.sin(a) * 3.9);
      }
      g.closePath();
      g.stroke();
    }
    g.beginPath();
    g.arc(0, 0, 1.5, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = C.violetPale;
  g.beginPath();
  g.arc(0, 0, 0.75, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = C.ink;
  g.lineWidth = 0.12;
  g.stroke();
  // age: hairline cracks and worn patches
  g.strokeStyle = 'rgba(20,13,18,0.42)';
  g.lineWidth = 0.04;
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2;
    const d = 2 + r() * 10;
    let x = Math.cos(a) * d;
    let z = Math.sin(a) * d;
    g.beginPath();
    g.moveTo(x, z);
    for (let s = 0; s < 3; s++) {
      x += (r() - 0.5) * 1.1;
      z += (r() - 0.5) * 1.1;
      g.lineTo(x, z);
    }
    g.stroke();
  }
  // dark at the rim, so the middle of the room glows by contrast
  floorDots(g, -R, -R, R * 2, R * 2, 'rgba(20,13,18,0.0)', 1, 0.1);
  g.save();
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.arc(0, 0, 11.2, 0, Math.PI * 2, true);
  g.clip();
  floorDots(g, -R, -R, R * 2, R * 2, 'rgba(20,13,18,0.3)', 0.34, 0.1);
  g.restore();
  g.restore();

  g.strokeStyle = C.ink;
  g.lineWidth = 0.3;
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.stroke();
  floorFrame(g, -P, -P - 1.5, P * 2, P * 2 + 1.5, 0.5, C.ink);
}
