import * as THREE from 'three';

/**
 * Small procedural textures shared by every effect (drawn once on a canvas, cached forever).
 * They are shared, so effects must NOT dispose them — only their own materials/geometries.
 */
const cache = new Map<string, THREE.CanvasTexture>();

function make(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  let tex = cache.get(key);
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

/** Deterministic pseudo-random so textures look identical on every machine. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Soft round glow (white, alpha falloff). Tint it with the material colour. */
export function glowTexture(): THREE.CanvasTexture {
  return make('glow', 128, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
}

/** Hard-edged dot, like a single printed halftone dot. */
export function dotTexture(): THREE.CanvasTexture {
  return make('dot', 64, (g, s) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
    g.fill();
  });
}

/** Spiky comic impact star (white fill, ink outline). */
export function starburstTexture(): THREE.CanvasTexture {
  return make('starburst', 256, (g, s) => {
    const rnd = seeded(7);
    const spikes = 14;
    g.translate(s / 2, s / 2);
    g.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? s * (0.36 + rnd() * 0.1) : s * (0.17 + rnd() * 0.05);
      g[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = '#fff';
    g.fill();
    g.lineJoin = 'miter';
    g.lineWidth = s * 0.035;
    g.strokeStyle = '#120c10';
    g.stroke();
  });
}

/** Ink splat: a blob with satellite droplets (white, tint with material colour). */
export function splatTexture(variant = 0): THREE.CanvasTexture {
  return make(`splat${variant}`, 256, (g, s) => {
    const rnd = seeded(31 + variant * 17);
    g.translate(s / 2, s / 2);
    g.fillStyle = '#fff';
    g.beginPath();
    const lobes = 11;
    for (let i = 0; i <= lobes; i++) {
      const a = (i / lobes) * Math.PI * 2;
      const r = s * (0.2 + rnd() * 0.12);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else {
        const am = a - Math.PI / lobes;
        const rm = s * (0.14 + rnd() * 0.2);
        g.quadraticCurveTo(Math.cos(am) * rm, Math.sin(am) * rm, x, y);
      }
    }
    g.fill();
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2;
      const d = s * (0.3 + rnd() * 0.16);
      g.beginPath();
      g.arc(Math.cos(a) * d, Math.sin(a) * d, s * (0.012 + rnd() * 0.03), 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** Torn scrap of paper with a few printed lines on it. */
export function paperScrapTexture(): THREE.CanvasTexture {
  return make('scrap', 128, (g, s) => {
    const rnd = seeded(99);
    g.beginPath();
    const pts = 12;
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const r = s * (0.3 + rnd() * 0.16);
      g[i === 0 ? 'moveTo' : 'lineTo'](s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r * 0.8);
    }
    g.closePath();
    g.fillStyle = '#fff';
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 3;
    for (let y = s * 0.3; y < s * 0.75; y += 11) {
      g.beginPath();
      g.moveTo(s * 0.22, y);
      g.lineTo(s * (0.55 + rnd() * 0.25), y);
      g.stroke();
    }
    g.restore();
  });
}
