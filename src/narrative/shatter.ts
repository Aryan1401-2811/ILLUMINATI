import { NARRATOR } from './config';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Draw ink cracks spreading across an element from an impact point. */
export function crackElement(el: HTMLElement): void {
  clearCracks(el);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('cb-cracks');
  // Draw in the box's real pixel size so cracks aren't stretched flat on a wide box.
  const w = el.offsetWidth || 100;
  const h = el.offsetHeight || 100;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const ox = w * (0.3 + Math.random() * 0.4);
  const oy = h * (0.35 + Math.random() * 0.3);
  const reach = Math.max(w, h) * 0.22;
  const branches = 9;
  for (let i = 0; i < branches; i++) {
    const angle = (i / branches) * Math.PI * 2 + Math.random() * 0.5;
    let x = ox;
    let y = oy;
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const segs = 3 + Math.floor(Math.random() * 3);
    for (let s = 0; s < segs; s++) {
      const a = angle + (Math.random() - 0.5) * 0.9;
      const len = reach * (0.4 + Math.random() * 0.6);
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('pathLength', '100');
    path.style.animationDelay = `${(i * 0.05).toFixed(2)}s`;
    svg.appendChild(path);
  }
  el.appendChild(svg);
}

export function clearCracks(el: HTMLElement): void {
  el.querySelectorAll('.cb-cracks').forEach((n) => n.remove());
}

interface Shard {
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
}

/**
 * Breaks an element into paper shards that fly apart under gravity. Each shard is a clone of
 * the element clipped to a triangle, so the text and cracks stay on the pieces.
 */
export class Shatter {
  private shards: Shard[] = [];
  private t = 0;

  constructor(source: HTMLElement, layer: HTMLElement) {
    const r = source.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    const cols = NARRATOR.shardCols;
    const rows = NARRATOR.shardRows;

    // Jittered grid; edge points stay on the edge so the pieces tile the whole box.
    const pts: [number, number][][] = [];
    for (let j = 0; j <= rows; j++) {
      const row: [number, number][] = [];
      for (let i = 0; i <= cols; i++) {
        const jx = i > 0 && i < cols ? (Math.random() - 0.5) * 0.7 : 0;
        const jy = j > 0 && j < rows ? (Math.random() - 0.5) * 0.7 : 0;
        row.push([((i + jx) / cols) * r.width, ((j + jy) / rows) * r.height]);
      }
      pts.push(row);
    }

    const tris: [number, number][][] = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = pts[j][i];
        const b = pts[j][i + 1];
        const c = pts[j + 1][i + 1];
        const d = pts[j + 1][i];
        if ((i + j) % 2) tris.push([a, b, c], [a, c, d]);
        else tris.push([a, b, d], [b, c, d]);
      }
    }

    for (const tri of tris) {
      const el = source.cloneNode(true) as HTMLElement;
      el.classList.add('cb-shard');
      Object.assign(el.style, {
        position: 'absolute',
        left: `${r.left - lr.left}px`,
        top: `${r.top - lr.top}px`,
        right: 'auto',
        width: `${r.width}px`,
        height: `${r.height}px`,
        maxWidth: 'none',
        margin: '0',
        clipPath: `polygon(${tri.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`,
      });
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
      const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      el.style.transformOrigin = `${cx}px ${cy}px`;
      layer.appendChild(el);

      // Fly outward from the impact centre, kicked upward a little first.
      const dx = cx - r.width / 2;
      const dy = cy - r.height / 2;
      const len = Math.hypot(dx, dy) || 1;
      const speed = 220 + Math.random() * 380;
      this.shards.push({
        el,
        x: 0,
        y: 0,
        vx: (dx / len) * speed + (Math.random() - 0.5) * 120,
        vy: (dy / len) * speed * 0.6 - 160 - Math.random() * 260,
        rot: 0,
        vrot: (Math.random() - 0.5) * 900,
      });
    }
  }

  /** Returns false once every shard has fallen away. */
  update(dt: number): boolean {
    this.t += dt;
    const life = NARRATOR.shardLifeSec;
    const fade = Math.min(1, Math.max(0, (this.t - life * 0.55) / (life * 0.45)));
    const scale = 1 - 0.35 * (this.t / life);
    for (const s of this.shards) {
      s.vy += 1500 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.vrot * dt;
      s.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) rotate(${s.rot.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
      s.el.style.opacity = String(1 - fade);
    }
    if (this.t >= life) {
      this.dispose();
      return false;
    }
    return true;
  }

  dispose() {
    for (const s of this.shards) s.el.remove();
    this.shards = [];
  }
}
