import type { ZoneKit } from './ZoneKit';

/** Worn, inked-over props for Zone 3 and stone pieces shared with the Warden's sanctum. */

export const RUIN = {
  stone: '#d9c9a6',
  stoneDark: '#a8946c',
  ink: '#120c10',
  gold: '#f2b632',
  goldDark: '#b8860b',
  violet: '#9b6bff',
  violetSoft: '#cdb8ff',
  paper: '#e9dcc0',
};

/** A fluted stone column. `height` below ~1.4 reads as a broken stump you can see over. */
export function column(kit: ZoneKit, x: number, z: number, height = 5, color = RUIN.stone, radius = 0.55) {
  kit.box(x, 0, z, radius * 2.7, 0.35, radius * 2.7, color, { shadow: true });
  kit.cyl(x, 0.35, z, radius * 0.9, radius, height - 0.35, color, { segments: 10, shadow: true });
  if (height > 2.5) {
    kit.box(x, height, z, radius * 2.6, 0.4, radius * 2.6, color, { shadow: true });
  } else {
    // snapped top: a slanted slice and a chunk lying beside it
    kit.cyl(x, height, z, radius * 0.5, radius * 0.9, 0.3, RUIN.stoneDark, { segments: 7, rotZ: 0.25 });
    kit.cyl(x + radius * 2.2, 0.3, z + radius * 0.8, radius * 0.85, radius * 0.85, 1.1, color, { segments: 10, rotZ: Math.PI / 2, rotY: 0.6, shadow: true });
  }
  kit.collideCircle(x, z, radius * 1.45);
}

/** A few tumbled blocks. Low, no outline clutter. */
export function rubble(kit: ZoneKit, x: number, z: number, color = RUIN.stone, seed = 1) {
  const r = (n: number) => Math.abs(Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1;
  for (let i = 0; i < 4; i++) {
    const s = 0.3 + r(i) * 0.4;
    kit.box(x + (r(i + 5) - 0.5) * 1.3, 0, z + (r(i + 9) - 0.5) * 1.3, s * 1.3, s, s, i % 2 ? RUIN.stoneDark : color, { rotY: r(i + 3) * 3, shadow: i === 0 });
  }
  kit.collideCircle(x, z, 0.7);
}

/** A bare, ink-black tree: the first thing on the page the Narrator stopped colouring in. */
export function deadTree(kit: ZoneKit, x: number, z: number, scale = 1) {
  kit.cyl(x, 0, z, 0.14 * scale, 0.3 * scale, 2.4 * scale, RUIN.ink, { segments: 6, shadow: true });
  const limbs: [number, number, number, number][] = [
    [0.6, 0.5, 1.5, 2.1],
    [-0.7, 0.2, 1.3, 2.6],
    [0.2, -0.6, 1.1, 3.0],
    [-0.3, 0.6, 0.9, 3.3],
  ];
  for (const [tx, tz, len, y] of limbs) {
    kit.cyl(x + tx * 0.45 * scale, y * 0.8 * scale, z + tz * 0.45 * scale, 0.03 * scale, 0.1 * scale, len * scale, RUIN.ink, {
      segments: 5,
      rotZ: -tx * 0.9,
      rotX: tz * 0.9,
      outline: false,
    });
  }
  kit.collideCircle(x, z, 0.4 * scale);
}

/**
 * The Narrator's monument to himself: a gilded figure holding a pen aloft, on a stepped plinth.
 * It is the brightest gold thing in the square — and it is cracked.
 */
export function goldenStatue(kit: ZoneKit, x: number, z: number) {
  kit.cyl(x, 0, z, 2.0, 2.2, 0.4, RUIN.stone, { segments: 8, shadow: true });
  kit.cyl(x, 0.4, z, 1.45, 1.6, 0.5, RUIN.stoneDark, { segments: 8 });
  kit.cyl(x, 0.9, z, 0.95, 1.05, 1.1, RUIN.stone, { segments: 8, shadow: true });
  // robed figure
  kit.cyl(x, 2.0, z, 0.3, 0.72, 1.7, RUIN.gold, { segments: 9, shadow: true });
  kit.ball(x, 4.0, z, 0.36, RUIN.gold);
  kit.cyl(x, 4.2, z, 0.05, 0.75, 0.42, RUIN.goldDark, { segments: 10 }); // wide hat
  kit.cyl(x + 0.42, 3.4, z, 0.09, 0.11, 1.15, RUIN.gold, { segments: 6, rotZ: -0.5 }); // raised arm
  kit.cyl(x + 0.74, 4.25, z, 0.02, 0.07, 0.95, RUIN.ink, { segments: 5, rotZ: -0.25, outline: false }); // the pen
  kit.glow(x + 0.86, 4.78, z, 0.13, '#ffd23a', 3.2);
  // cracks: ink wedges bitten out of the robe
  kit.box(x - 0.2, 2.5, z + 0.5, 0.06, 0.9, 0.06, RUIN.ink, { rotZ: 0.4, outline: false });
  kit.box(x + 0.15, 2.9, z + 0.4, 0.05, 0.6, 0.06, RUIN.ink, { rotZ: -0.5, outline: false });
  kit.collideCircle(x, z, 2.25);
}

/** A corner of the page peeling up off the world, with violet light under it. */
export function peeledCorner(kit: ZoneKit, x: number, z: number, rotY: number, size = 5) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const out = size * (0.25 + t * 0.6);
    kit.box(x + s * out, 0.15 + t * t * 2.6, z + c * out, size * (1 - t * 0.35), 0.06, size * 0.36, RUIN.paper, { rotY, rotX: -0.2 - t * 0.75, shadow: i === 3 });
  }
  kit.glowBox(x + s * size * 0.55, 0.02, z + c * size * 0.55, size * 0.8, 0.02, size * 0.9, RUIN.violet, 1.5, { rotY });
}

/** A violet flame in a stone bowl. `height` is the stand height; low ones go on the camera side. */
export function brazier(kit: ZoneKit, x: number, z: number, height = 1.5) {
  kit.cyl(x, 0, z, 0.2, 0.34, height, '#4a416b', { segments: 8, shadow: true });
  kit.cyl(x, height, z, 0.62, 0.26, 0.4, '#3a3257', { segments: 10 });
  kit.glow(x, height + 0.55, z, 0.34, RUIN.violet, 2.4, [1, 1.5, 1]);
  kit.glow(x, height + 0.5, z, 0.17, '#f1e9ff', 3, [1, 1.4, 1]);
  kit.collideCircle(x, z, 0.5);
}

/**
 * A heavy chain sagging between two points, built from alternating flat and upright links.
 * Every `glowEvery`-th link glows (0 = none), e.g. violet runes on the iron that binds the gold.
 */
export function chain(
  kit: ZoneKit,
  from: [number, number, number],
  to: [number, number, number],
  opts: { color?: string; glow?: string; glowEvery?: number; sag?: number; link?: number; intensity?: number } = {},
) {
  const link = opts.link ?? 0.5;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const n = Math.max(2, Math.round(Math.hypot(dx, dy, dz) / (link * 0.8)));
  const sag = opts.sag ?? 1;
  const point = (t: number): [number, number, number] => [from[0] + dx * t, from[1] + dy * t - Math.sin(t * Math.PI) * sag, from[2] + dz * t];
  for (let i = 0; i < n; i++) {
    const a = point(i / n);
    const b = point((i + 1) / n);
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const ez = b[2] - a[2];
    const len = Math.hypot(ex, ey, ez);
    const rot = { rotY: -Math.atan2(ez, ex), rotZ: Math.asin(ey / len), outline: false };
    const flat = i % 2 === 0;
    const w = flat ? link * 0.62 : link * 0.24;
    const h = flat ? link * 0.24 : link * 0.62;
    const y = (a[1] + b[1]) / 2 - h / 2;
    const glows = opts.glow && opts.glowEvery && i % opts.glowEvery === 0;
    if (glows) kit.glowBox((a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2, len * 1.15, h, w, opts.glow!, opts.intensity ?? 2.2, rot);
    else kit.box((a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2, len * 1.15, h, w, opts.color ?? '#2b2440', rot);
  }
}
