import { rng } from '../props/canvas';
import { floorDots, floorFrame, floorText } from '../props/pageFloor';

/** Zone 2 measurements (metres): one wide rooftop, open in the middle. */
export const Z2 = {
  minX: -14.5,
  maxX: 14.5,
  minZ: -9.2,
  maxZ: 9.2,
  roof: { minX: -15.6, maxX: 15.6, minZ: -10.3, maxZ: 10.3 },
  floor: { minX: -27, maxX: 27, minZ: -16, maxZ: 20 },
};

const C = {
  ink: '#1a1013',
  below: '#f3dfb2',
  tile: '#f4ad8c',
  tileLine: 'rgba(160,70,40,0.42)',
  tileLight: 'rgba(255,240,220,0.38)',
  edge: '#fff3d6',
  paint: '#fffaf0',
  red: '#e8463a',
};

/** Paints the rooftop and, around it, the city far below — pushed back with a pale halftone haze. */
export function drawZone2Floor(g: CanvasRenderingContext2D) {
  const r = rng(22);
  const f = Z2.floor;
  const roof = Z2.roof;

  // ── the city far below: small pastel roofs and pale streets ──
  g.fillStyle = C.below;
  g.fillRect(f.minX, f.minZ, f.maxX - f.minX, f.maxZ - f.minZ);
  const pastel = ['#f7c6a0', '#bfe3d6', '#f9dc9c', '#f4b8b8', '#c6dcf2', '#e9d2a2'];
  for (let z = f.minZ + 0.6; z < f.maxZ - 1; z += 4.4) {
    for (let x = f.minX + 0.6; x < f.maxX - 1; ) {
      const w = 2.2 + r() * 3.2;
      const d = 2.6 + r() * 1.2;
      g.fillStyle = pastel[Math.floor(r() * pastel.length)];
      g.fillRect(x, z, w, d);
      g.strokeStyle = 'rgba(26,16,19,0.55)';
      g.lineWidth = 0.09;
      g.strokeRect(x, z, w, d);
      g.strokeStyle = 'rgba(26,16,19,0.3)';
      g.lineWidth = 0.05;
      g.strokeRect(x + 0.4, z + 0.4, w * 0.4, d * 0.4);
      x += w + 0.9;
    }
  }
  // haze: the further world is lighter and dotted, so the fighters above always pop
  g.fillStyle = 'rgba(255,244,214,0.5)';
  g.fillRect(f.minX, f.minZ, f.maxX - f.minX, f.maxZ - f.minZ);
  floorDots(g, f.minX, f.minZ, f.maxX - f.minX, f.maxZ - f.minZ, 'rgba(120,80,40,0.16)', 0.5, 0.13);
  // drop shadow of the roof on the city below (down-right, like the key light)
  g.fillStyle = 'rgba(60,30,20,0.3)';
  g.fillRect(roof.minX + 1.4, roof.minZ + 1.6, roof.maxX - roof.minX, roof.maxZ - roof.minZ);

  // ── the rooftop ──
  const rw = roof.maxX - roof.minX;
  const rd = roof.maxZ - roof.minZ;
  g.fillStyle = C.tile;
  g.fillRect(roof.minX, roof.minZ, rw, rd);
  // sun-bleached patches
  g.fillStyle = C.tileLight;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.ellipse(roof.minX + r() * rw, roof.minZ + r() * rd, 1.5 + r() * 2.5, 0.8 + r() * 1.4, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // tiles
  g.strokeStyle = C.tileLine;
  g.lineWidth = 0.04;
  for (let x = roof.minX; x <= roof.maxX; x += 1.3) {
    g.beginPath();
    g.moveTo(x, roof.minZ);
    g.lineTo(x, roof.maxZ);
    g.stroke();
  }
  for (let z = roof.minZ; z <= roof.maxZ; z += 1.3) {
    g.beginPath();
    g.moveTo(roof.minX, z);
    g.lineTo(roof.maxX, z);
    g.stroke();
  }
  floorDots(g, roof.minX, roof.minZ, rw, 3, 'rgba(160,70,40,0.3)', 0.32, 0.09, 'south');
  floorDots(g, roof.minX, roof.maxZ - 2.4, rw, 2.4, 'rgba(160,70,40,0.22)', 0.32, 0.08, 'north');
  // pale edging just inside the parapet
  g.strokeStyle = C.edge;
  g.lineWidth = 0.5;
  g.strokeRect(roof.minX + 0.65, roof.minZ + 0.65, rw - 1.3, rd - 1.3);

  // market pitch markings: a big painted ring in the middle of the roof
  for (const [rad, lw, col] of [[4.3, 0.42, C.ink], [4.3, 0.3, C.paint], [3.3, 0.1, 'rgba(255,250,240,0.7)']] as const) {
    g.strokeStyle = col;
    g.lineWidth = lw;
    g.beginPath();
    g.arc(0, 0.6, rad, 0, Math.PI * 2);
    g.stroke();
  }
  floorText(g, 'MARKET', 0, 0.75, 1.5, C.paint, { strokeWidth: 9, lean: -0.1 });
  // numbered stall pitches along the south side
  for (let i = 0; i < 5; i++) {
    const x = -10 + i * 5;
    g.strokeStyle = 'rgba(255,250,240,0.85)';
    g.lineWidth = 0.1;
    g.strokeRect(x - 1.6, 6.2, 3.2, 2.2);
    floorText(g, String(i + 1), x, 7.35, 0.9, 'rgba(255,250,240,0.85)', { strokeWidth: 0, shadow: false, lean: 0 });
  }
  // scuffs
  g.strokeStyle = 'rgba(26,16,19,0.4)';
  g.lineWidth = 0.035;
  for (let i = 0; i < 16; i++) {
    let x = roof.minX + 1 + r() * (rw - 3);
    let z = roof.minZ + 1 + r() * (rd - 2);
    g.beginPath();
    g.moveTo(x, z);
    for (let s = 0; s < 3; s++) {
      x += 0.25 + r() * 0.4;
      z += (r() - 0.5) * 0.5;
      g.lineTo(x, z);
    }
    g.stroke();
  }
  // the way on (east)
  g.fillStyle = C.ink;
  chevrons(g, Z2.maxX - 4.2, 0, 0.12);
  g.fillStyle = C.red;
  chevrons(g, Z2.maxX - 4.2, 0, 0);

  floorFrame(g, roof.minX, roof.minZ, rw, rd, 0.3, C.ink);
}

/** Three painted chevrons pointing east. */
function chevrons(g: CanvasRenderingContext2D, x: number, z: number, grow: number) {
  for (let i = 0; i < 3; i++) {
    const cx = x + i * 1.05;
    const h = 1.0 + grow;
    const t = 0.42 + grow * 1.6;
    g.beginPath();
    g.moveTo(cx - 0.5 - grow, z - h);
    g.lineTo(cx - 0.5 + t, z - h);
    g.lineTo(cx + 0.5 + t, z);
    g.lineTo(cx - 0.5 + t, z + h);
    g.lineTo(cx - 0.5 - grow, z + h);
    g.lineTo(cx + 0.5 - grow, z);
    g.closePath();
    g.fill();
  }
}
