import type { ZoneKit } from './ZoneKit';
import { signTexture } from './canvas';

/** Street furniture and shopfronts for the city zones. Each helper also adds its collision. */

export const STREET = {
  ink: '#2a1a12',
  cream: '#fbf1dc',
  white: '#fffaf0',
  glass: '#bfeaf5',
  wood: '#d9a55b',
  woodDark: '#a8743a',
  leaf: '#62c57a',
  leafDark: '#3f9f63',
  red: '#e8463a',
  blue: '#4a90d9',
  teal: '#3fb6a8',
  mustard: '#f2b632',
  metal: '#40566b',
  lamp: '#ffe2a0',
};

export function lampPost(kit: ZoneKit, x: number, z: number, glow = STREET.lamp) {
  kit.cyl(x, 0, z, 0.2, 0.26, 0.35, STREET.metal, { segments: 8 });
  kit.cyl(x, 0.35, z, 0.07, 0.1, 3.3, STREET.metal, { segments: 8, shadow: true });
  kit.box(x, 3.6, z, 0.5, 0.1, 0.5, STREET.metal, { outline: false });
  kit.glow(x, 3.95, z, 0.3, glow, 2.6);
  kit.cyl(x, 4.2, z, 0.02, 0.3, 0.22, STREET.metal, { segments: 8, outline: false });
  kit.collideCircle(x, z, 0.28);
}

export function tree(kit: ZoneKit, x: number, z: number, scale = 1, leaf = STREET.leaf, leafDark = STREET.leafDark) {
  kit.cyl(x, 0, z, 0.16 * scale, 0.22 * scale, 1.7 * scale, STREET.woodDark, { segments: 7, shadow: true });
  kit.ball(x, 2.5 * scale, z, 1.05 * scale, leaf, { shadow: true });
  kit.ball(x - 0.7 * scale, 2.0 * scale, z + 0.2 * scale, 0.7 * scale, leafDark, { shadow: true });
  kit.ball(x + 0.75 * scale, 2.15 * scale, z - 0.1 * scale, 0.75 * scale, leaf, { shadow: true });
  // little square of soil with a kerb, like a real street tree
  kit.box(x, 0, z, 1.1 * scale, 0.08, 1.1 * scale, STREET.woodDark, { outline: false });
  kit.collideCircle(x, z, 0.4 * scale);
}

export function hydrant(kit: ZoneKit, x: number, z: number, color = STREET.red) {
  kit.cyl(x, 0, z, 0.2, 0.24, 0.6, color, { segments: 10, shadow: true });
  kit.ball(x, 0.66, z, 0.21, color);
  kit.cyl(x, 0.78, z, 0.06, 0.08, 0.14, STREET.mustard, { segments: 6, outline: false });
  kit.box(x, 0.3, z, 0.62, 0.16, 0.16, color);
  kit.collideCircle(x, z, 0.34);
}

export function mailbox(kit: ZoneKit, x: number, z: number, rotY = 0, color = STREET.blue) {
  kit.box(x, 0, z, 0.5, 0.25, 0.4, STREET.metal, { rotY, outline: false });
  kit.box(x, 0.25, z, 0.66, 0.85, 0.56, color, { rotY, shadow: true });
  kit.cyl(x, 1.1 - 0.28, z, 0.28, 0.28, 0.66, color, { rotY, rotZ: Math.PI / 2, segments: 12 });
  kit.box(x + Math.sin(rotY) * 0.29, 0.72, z + Math.cos(rotY) * 0.29, 0.42, 0.08, 0.02, STREET.ink, { rotY, outline: false });
  kit.collideCircle(x, z, 0.45);
}

export function crate(kit: ZoneKit, x: number, z: number, size = 1, rotY = 0, y = 0) {
  kit.box(x, y, z, size, size, size, STREET.wood, { rotY, shadow: true });
  const b = size * 0.12;
  kit.box(x, y + size - b, z, size * 1.04, b, size * 1.04, STREET.woodDark, { rotY, outline: false });
  kit.box(x, y, z, size * 1.04, b, size * 1.04, STREET.woodDark, { rotY, outline: false });
  if (y === 0) kit.collideCircle(x, z, size * 0.62);
}

export function barrel(kit: ZoneKit, x: number, z: number, color = STREET.teal) {
  kit.cyl(x, 0, z, 0.36, 0.36, 0.95, color, { segments: 12, shadow: true });
  kit.cyl(x, 0.2, z, 0.385, 0.385, 0.08, STREET.ink, { segments: 12, outline: false });
  kit.cyl(x, 0.68, z, 0.385, 0.385, 0.08, STREET.ink, { segments: 12, outline: false });
  kit.collideCircle(x, z, 0.42);
}

export function trafficCone(kit: ZoneKit, x: number, z: number) {
  kit.box(x, 0, z, 0.44, 0.06, 0.44, STREET.ink, { outline: false });
  kit.cyl(x, 0.06, z, 0.04, 0.19, 0.6, '#ff8a3a', { segments: 10 });
  kit.cyl(x, 0.28, z, 0.105, 0.135, 0.14, STREET.white, { segments: 10, outline: false });
  kit.collideCircle(x, z, 0.24);
}

/** A bench facing +Z (rotate with rotY). */
export function bench(kit: ZoneKit, x: number, z: number, rotY = 0) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  kit.box(x, 0.42, z, 1.9, 0.1, 0.55, STREET.wood, { rotY, shadow: true });
  kit.box(x - s * 0.26, 0.52, z - c * 0.26, 1.9, 0.55, 0.09, STREET.wood, { rotY });
  for (const side of [-0.8, 0.8]) kit.box(x + c * side, 0, z - s * side, 0.1, 0.42, 0.5, STREET.metal, { rotY, outline: false });
  kit.collideCircle(x, z, 0.75);
}

/** A long planter with round bushes, along X. */
export function planter(kit: ZoneKit, x: number, z: number, length = 2.4, bush = STREET.leaf) {
  kit.box(x, 0, z, length, 0.5, 0.8, STREET.cream, { shadow: true });
  kit.box(x, 0.5, z, length - 0.16, 0.06, 0.64, STREET.woodDark, { outline: false });
  const n = Math.max(1, Math.round(length / 0.85));
  for (let i = 0; i < n; i++) {
    const bx = x - length / 2 + (length / n) * (i + 0.5);
    kit.ball(bx, 0.82, z, 0.42 + (i % 2) * 0.07, i % 2 ? STREET.leafDark : bush, { squash: [1, 0.85, 0.9], shadow: true });
  }
  kit.collideBox(x, z, length, 0.8);
}

/** Newsstand with a striped awning. Front faces +Z. */
export function kiosk(kit: ZoneKit, x: number, z: number, sign = 'COMICS!', body = STREET.teal) {
  kit.box(x, 0, z, 2.6, 2.4, 1.7, body, { shadow: true });
  kit.box(x, 0.95, z + 0.86, 2.3, 0.1, 0.4, STREET.wood); // counter
  kit.box(x, 1.1, z + 0.86, 2.1, 1.0, 0.05, STREET.ink, { outline: false }); // dark opening
  for (let i = 0; i < 6; i++) kit.box(x - 0.85 + i * 0.34, 1.12, z + 0.9, 0.26, 0.36, 0.06, [STREET.red, STREET.mustard, STREET.white, STREET.blue][i % 4], { outline: false, rotX: -0.25 });
  stripedAwning(kit, x, 2.35, z + 1.25, 2.9, 1.1, STREET.red);
  kit.plane(kit.track(signTexture(sign, '#ffd23a', STREET.red, 512, 150)), x, 2.95, z + 0.88, 2.5, 0.72);
  kit.collideBox(x, z + 0.15, 2.7, 2.1);
}

/** Candy-striped fabric awning sloping toward +Z. (x, y, z) is its centre. */
export function stripedAwning(kit: ZoneKit, x: number, y: number, z: number, width: number, depth: number, color: string, alt = STREET.white) {
  const n = Math.max(2, Math.round(width / 0.48));
  const w = width / n;
  for (let i = 0; i < n; i++) {
    const sx = x - width / 2 + w * (i + 0.5);
    kit.box(sx, y, z, w, 0.07, depth, i % 2 ? alt : color, { rotX: 0.32, outline: false });
    kit.box(sx, y - depth * 0.16 - 0.22, z + depth * 0.47, w, 0.22, 0.05, i % 2 ? alt : color, { outline: false });
  }
  // one outlined slab underneath gives the whole awning a single clean ink edge
  kit.box(x, y - 0.03, z, width + 0.04, 0.05, depth + 0.04, STREET.ink, { rotX: 0.32, shadow: true });
}

export interface ShopOptions {
  /** Left edge (X) and width of the building. */
  x: number;
  width: number;
  /** Z of the front wall (the shop faces +Z, toward the camera). */
  front: number;
  height?: number;
  depth?: number;
  wall: string;
  trim?: string;
  awning?: string;
  door?: string;
  sign?: string;
  signBg?: string;
  signFg?: string;
}

/**
 * A comic shopfront. Only the lowest ~5 m are ever on camera, so the detail is spent there:
 * plinth, big window, door, striped awning and a lettered sign.
 */
export function shopfront(kit: ZoneKit, o: ShopOptions) {
  const H = o.height ?? 7;
  const D = o.depth ?? 6;
  const cx = o.x + o.width / 2;
  const f = o.front;
  const trim = o.trim ?? STREET.ink;
  kit.box(cx, 0, f - D / 2, o.width, H, D, o.wall, { shadow: true });
  kit.box(cx, 0, f + 0.06, o.width + 0.12, 0.42, 0.14, trim, { outline: false }); // plinth
  kit.box(cx, H, f - D / 2, o.width + 0.5, 0.4, D + 0.5, trim); // cornice
  // corner pilasters make each building read as its own framed panel
  for (const side of [-1, 1]) kit.box(cx + side * (o.width / 2 - 0.14), 0, f + 0.05, 0.28, H, 0.12, o.signBg ?? STREET.white, { outline: false });

  const doorW = 1.15;
  const winW = Math.max(1.6, o.width - doorW - 2.2);
  const winX = cx - o.width / 2 + 0.9 + winW / 2;
  const doorX = cx + o.width / 2 - 0.85 - doorW / 2;
  // shop window: ink frame, pale glass, a diagonal glint
  kit.box(winX, 0.62, f + 0.05, winW + 0.24, 1.95, 0.1, trim, { outline: false });
  kit.box(winX, 0.74, f + 0.09, winW, 1.71, 0.08, STREET.glass, { outline: false });
  kit.box(winX - winW * 0.22, 1.2, f + 0.14, 0.14, 1.5, 0.02, STREET.white, { outline: false, rotZ: -0.5 });
  kit.box(winX - winW * 0.08, 1.2, f + 0.14, 0.06, 1.5, 0.02, STREET.white, { outline: false, rotZ: -0.5 });
  kit.box(winX, 0.74, f + 0.14, 0.09, 1.71, 0.04, trim, { outline: false });
  // door with a round window and a step
  kit.box(doorX, 0, f + 0.05, doorW + 0.24, 2.42, 0.1, trim, { outline: false });
  kit.box(doorX, 0.08, f + 0.1, doorW, 2.22, 0.08, o.door ?? STREET.red, { outline: false });
  kit.cyl(doorX, 1.5, f + 0.17, 0.26, 0.26, 0.04, STREET.glass, { rotX: Math.PI / 2, segments: 12, outline: false });
  kit.glow(doorX + doorW * 0.32, 1.05, f + 0.17, 0.06, STREET.lamp, 2.2);
  kit.box(doorX, 0, f + 0.32, doorW + 0.5, 0.1, 0.5, STREET.cream, { outline: false });

  if (o.awning) stripedAwning(kit, winX, 2.86, f + 0.75, winW + 0.7, 1.35, o.awning);
  if (o.sign) kit.plane(kit.track(signTexture(o.sign, o.signBg ?? STREET.white, o.signFg ?? STREET.red)), cx, 3.85, f + 0.13, Math.min(o.width - 0.9, 4.6), 1.15);

  // upper windows (only glimpsed when the hero hugs the north kerb)
  const cols = Math.max(1, Math.floor((o.width - 1) / 1.9));
  for (let row = 0; row * 2.1 + 5.0 + 1.5 < H; row++) {
    for (let i = 0; i < cols; i++) {
      const wx = cx - ((cols - 1) * 1.9) / 2 + i * 1.9;
      kit.box(wx, 4.9 + row * 2.1, f + 0.04, 1.1, 1.4, 0.08, trim, { outline: false });
      kit.box(wx, 5.0 + row * 2.1, f + 0.08, 0.9, 1.2, 0.06, STREET.glass, { outline: false });
    }
  }
  kit.collideBox(cx, f - D / 2, o.width, D);
}
