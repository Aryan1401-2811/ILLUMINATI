import { rng, speedLines } from '../props/canvas';
import { floorDots, floorFrame } from '../props/pageFloor';

/** Final arena measurements (metres): one torn sheet of the comic, adrift. */
export const FA = {
  /** Fighting circle: just inside the ragged edge, so the edge of the page IS the boundary. */
  radius: 12.6,
  floor: { minX: -17, maxX: 17, minZ: -17, maxZ: 17 },
};

const C = {
  ink: '#0b0722',
  paper: '#f3eeff',
  lip: '#ffffff',
  violet: '#9b6bff',
  panels: ['#e6dcff', '#dbe6ff', '#f4e2ff', '#e9f0ff', '#e2d6ff'],
};

/** Distance from the centre to the torn edge of the page in direction `a` (radians). */
export function pageEdge(a: number): number {
  const big = Math.sin(a * 3 + 0.7) * 0.5 + Math.sin(a * 5 + 2.1) * 0.35;
  const jag = Math.sin(a * 23 + 1.3) * 0.16 + Math.sin(a * 41 + 0.4) * 0.1;
  // three deep rips biting toward the fighting circle
  let rip = 0;
  for (const centre of [0.9, 3.0, 5.1]) {
    const d = Math.abs(Math.atan2(Math.sin(a - centre), Math.cos(a - centre)));
    rip = Math.max(rip, Math.max(0, 1 - d / 0.16));
  }
  return 14.9 + big + jag - rip * 0.9;
}

function tornPath(g: CanvasRenderingContext2D, shrink = 0) {
  g.beginPath();
  for (let i = 0; i <= 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    const r = pageEdge(a) - shrink;
    g[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
}

/**
 * Paints the last page. The panels of the story so far are still printed on it, pale and
 * washed-out now, and ink is bleeding out of every border. The middle is kept clear and
 * light so the final fight reads cleanly.
 */
export function drawFinalFloor(g: CanvasRenderingContext2D) {
  const r = rng(55);
  g.save();
  tornPath(g);
  g.clip();
  g.fillStyle = C.paper;
  g.fillRect(-17, -17, 34, 34);

  // the page layout: a ring of small panels around one large central panel
  const panels: [number, number, number, number][] = [
    [-13.5, -13.5, 8.4, 5.2],
    [-4.5, -13.5, 9, 5.2],
    [5.1, -13.5, 8.4, 5.2],
    [-13.5, -7.7, 4.6, 15.4],
    [8.9, -7.7, 4.6, 15.4],
    [-13.5, 8.3, 8.4, 5.2],
    [-4.5, 8.3, 9, 5.2],
    [5.1, 8.3, 8.4, 5.2],
  ];
  panels.forEach(([x, z, w, d], i) => {
    g.fillStyle = C.panels[i % C.panels.length];
    g.fillRect(x, z, w, d);
    g.save();
    g.beginPath();
    g.rect(x, z, w, d);
    g.clip();
    // faded memories of the earlier pages
    if (i % 4 === 0) speedLines(g, x + w / 2, z + d * 0.8, 0.8, 9, 22, 'rgba(155,107,255,0.22)', i + 1, 2.2);
    else if (i % 4 === 1) floorDots(g, x, z, w, d, 'rgba(110,80,200,0.22)', 0.4, 0.14, 'south');
    else if (i % 4 === 2) {
      g.strokeStyle = 'rgba(110,80,200,0.3)';
      g.lineWidth = 0.08;
      for (let k = 1; k < 5; k++) {
        g.beginPath();
        g.arc(x + w / 2, z + d, k * 1.1, Math.PI, 0);
        g.stroke();
      }
    } else floorDots(g, x, z, w, d, 'rgba(110,80,200,0.2)', 0.5, 0.17, 'east');
    g.restore();
    floorFrame(g, x, z, w, d, 0.2, C.ink);
  });
  // the big middle panel: clean paper, a breath of halftone at its rim
  const [mx, mz, mw, md] = [-8.1, -7.7, 16.2, 15.4];
  g.fillStyle = '#f8f5ff';
  g.fillRect(mx, mz, mw, md);
  floorDots(g, mx, mz, mw, 2.6, 'rgba(110,80,200,0.2)', 0.36, 0.1, 'south');
  floorDots(g, mx, mz + md - 2.6, mw, 2.6, 'rgba(110,80,200,0.2)', 0.36, 0.1, 'north');
  floorFrame(g, mx, mz, mw, md, 0.26, C.ink);

  // ink bleeding out of the borders and running across the paper
  g.fillStyle = C.ink;
  for (let i = 0; i < 26; i++) {
    const [x, z, w, d] = i < 18 ? panels[i % panels.length] : [mx, mz, mw, md];
    const sx = x + r() * w;
    const sz = r() < 0.5 ? z : z + d;
    const len = 0.5 + r() * 2.4;
    const wd = 0.07 + r() * 0.16;
    g.beginPath();
    g.moveTo(sx - wd, sz);
    g.quadraticCurveTo(sx - wd * 0.6, sz + len * 0.7, sx, sz + len);
    g.quadraticCurveTo(sx + wd * 0.6, sz + len * 0.7, sx + wd, sz);
    g.fill();
    g.beginPath();
    g.arc(sx, sz + len, wd * 1.25, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const d = 9.5 + r() * 4;
    blot(g, r, Math.cos(a) * d, Math.sin(a) * d, 0.8 + r() * 1.2);
  }
  // long rips that have not quite gone through
  for (const centre of [0.9, 3.0, 5.1]) {
    const start = pageEdge(centre);
    for (const [w, col] of [[0.3, C.lip], [0.09, C.ink]] as const) {
      let px = Math.cos(centre) * start;
      let pz = Math.sin(centre) * start;
      const rr = rng(Math.round(centre * 100));
      g.strokeStyle = col;
      g.lineWidth = w;
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(px, pz);
      for (let s = 0; s < 6; s++) {
        px -= Math.cos(centre) * 0.7 + (rr() - 0.5) * 0.7;
        pz -= Math.sin(centre) * 0.7 + (rr() - 0.5) * 0.7;
        g.lineTo(px, pz);
      }
      g.stroke();
    }
  }
  // soft violet cast creeping in from the edge
  const grad = g.createRadialGradient(0, 0, 9, 0, 0, 16);
  grad.addColorStop(0, 'rgba(155,107,255,0)');
  grad.addColorStop(1, 'rgba(120,80,230,0.4)');
  g.fillStyle = grad;
  g.fillRect(-17, -17, 34, 34);
  g.restore();

  // the torn edge: white fibre, then a thin ink line
  g.lineJoin = 'round';
  g.save();
  tornPath(g);
  g.clip();
  tornPath(g);
  g.strokeStyle = C.lip;
  g.lineWidth = 0.7;
  g.stroke();
  tornPath(g);
  g.strokeStyle = C.ink;
  g.lineWidth = 0.14;
  g.stroke();
  g.restore();
}

function blot(g: CanvasRenderingContext2D, r: () => number, x: number, z: number, size: number) {
  g.beginPath();
  const lobes = 10;
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const rad = size * (0.55 + r() * 0.45);
    const px = x + Math.cos(a) * rad;
    const pz = z + Math.sin(a) * rad;
    if (i === 0) g.moveTo(px, pz);
    else {
      const am = a - Math.PI / lobes;
      const rm = size * (0.4 + r() * 0.3);
      g.quadraticCurveTo(x + Math.cos(am) * rm, z + Math.sin(am) * rm, px, pz);
    }
  }
  g.fill();
}

/** A torn scrap of a comic page for the void (transparent outside its ragged outline). */
export function drawScrap(g: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const r = rng(seed);
  g.beginPath();
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = 0.34 + r() * 0.14;
    g[i === 0 ? 'moveTo' : 'lineTo'](w / 2 + Math.cos(a) * rad * w, h / 2 + Math.sin(a) * rad * h);
  }
  g.closePath();
  g.save();
  g.clip();
  g.fillStyle = C.paper;
  g.fillRect(0, 0, w, h);
  g.fillStyle = C.panels[seed % C.panels.length];
  g.fillRect(w * 0.18, h * 0.2, w * 0.4, h * 0.34);
  g.fillStyle = C.panels[(seed + 2) % C.panels.length];
  g.fillRect(w * 0.62, h * 0.2, w * 0.3, h * 0.6);
  g.fillRect(w * 0.18, h * 0.6, w * 0.4, h * 0.26);
  g.strokeStyle = C.ink;
  g.lineWidth = w * 0.02;
  g.strokeRect(w * 0.18, h * 0.2, w * 0.4, h * 0.34);
  g.strokeRect(w * 0.62, h * 0.2, w * 0.3, h * 0.6);
  g.strokeRect(w * 0.18, h * 0.6, w * 0.4, h * 0.26);
  g.fillStyle = C.ink;
  g.beginPath();
  g.arc(w * (0.3 + r() * 0.4), h * (0.3 + r() * 0.4), w * 0.09, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.strokeStyle = C.lip;
  g.lineWidth = w * 0.03;
  g.stroke();
}
