import * as THREE from 'three';

export const DISPLAY_FONT = 'Bangers';
const FONT_STACK = `${DISPLAY_FONT}, Impact, "Arial Black", sans-serif`;

export const INK = '#1a1013';
export const PAPER = '#fbf1dc';

export function comicFont(px: number): string {
  return `${Math.round(px)}px ${FONT_STACK}`;
}

/**
 * A texture drawn with the 2D canvas API. If the display font was not loaded yet when it was
 * drawn, it is redrawn automatically once the font arrives (signs must never ship in a fallback font).
 */
export function canvasTexture(width: number, height: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d')!;
  const paint = () => {
    g.save();
    g.clearRect(0, 0, width, height);
    draw(g, width, height);
    g.restore();
  };
  const fontReady = document.fonts?.check(comicFont(32)) ?? true;
  paint();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (!fontReady) {
    document.fonts
      .load(comicFont(32))
      .then(() => {
        paint();
        tex.needsUpdate = true;
      })
      .catch(() => {});
  }
  return tex;
}

/** Deterministic random so every machine draws the same page. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Ben-Day dots over a rectangle. `fade` shrinks the dots toward the bottom (a printed gradient). */
export function halftone(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, step = 12, radius = 3, fade: 'none' | 'down' | 'up' | 'right' | 'left' = 'none') {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = color;
  let row = 0;
  for (let py = y; py < y + h + step; py += step * 0.866, row++) {
    for (let px = x + (row % 2 ? step / 2 : 0); px < x + w + step; px += step) {
      let k = 1;
      if (fade === 'down') k = 1 - (py - y) / h;
      else if (fade === 'up') k = (py - y) / h;
      else if (fade === 'right') k = 1 - (px - x) / w;
      else if (fade === 'left') k = (px - x) / w;
      const r = radius * Math.max(0, Math.min(1, k));
      if (r < 0.3) continue;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

/** Slightly wobbly ink rectangle: a hand-ruled panel border. */
export function inkFrame(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lineWidth: number, color = INK) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = lineWidth;
  g.lineJoin = 'miter';
  g.strokeRect(x, y, w, h);
  g.restore();
}

/** Radial speed lines bursting from a point. */
export function speedLines(g: CanvasRenderingContext2D, cx: number, cy: number, inner: number, outer: number, count: number, color: string, seed = 1, width = 3) {
  const r = rng(seed);
  g.save();
  g.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + r() * 0.1;
    const half = (0.012 + r() * 0.02) * width;
    const r0 = inner * (0.85 + r() * 0.4);
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a - half) * outer, cy + Math.sin(a - half) * outer);
    g.lineTo(cx + Math.cos(a + half) * outer, cy + Math.sin(a + half) * outer);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** Comic lettering: thick ink outline, offset shadow, flat fill. */
export function comicText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  px: number,
  fill: string,
  opts: { stroke?: string; strokeWidth?: number; shadow?: boolean; align?: CanvasTextAlign; lean?: number; rotate?: number } = {},
) {
  g.save();
  g.translate(x, y);
  if (opts.rotate) g.rotate(opts.rotate);
  g.transform(1, 0, opts.lean ?? -0.12, 1, 0, 0);
  g.font = comicFont(px);
  g.textAlign = opts.align ?? 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const sw = opts.strokeWidth ?? px * 0.16;
  if (sw > 0) {
    g.strokeStyle = opts.stroke ?? INK;
    g.lineWidth = sw;
    if (opts.shadow ?? true) g.strokeText(text, px * 0.06, px * 0.07);
    g.strokeText(text, 0, 0);
  }
  g.fillStyle = fill;
  g.fillText(text, 0, 0);
  g.restore();
}

/** A shop / street sign: coloured board, ink frame, comic lettering. */
export function signTexture(text: string, bg: string, fg: string, w = 512, h = 160): THREE.CanvasTexture {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    halftone(g, 0, h * 0.45, w, h * 0.55, 'rgba(26,16,19,0.14)', 13, 3.4, 'up');
    inkFrame(g, 7, 7, w - 14, h - 14, 14);
    g.font = comicFont(h * 0.6);
    const fit = Math.min(1, (w - 60) / g.measureText(text).width);
    comicText(g, text, w / 2, h / 2 + 4, h * 0.6 * fit, fg);
  });
}
