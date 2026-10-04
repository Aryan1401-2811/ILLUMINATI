import * as THREE from 'three';
import { FX_COLORS, WORD_FX, type WordStyle } from './config';
import { seeded } from './textures';

interface LiveWord {
  sprite: THREE.Sprite;
  age: number;
  life: number;
  size: number;
  aspect: number;
  tilt: number;
  big: boolean;
}

interface CachedTexture {
  texture: THREE.CanvasTexture;
  aspect: number;
}

const CANVAS_H = 192;
const PAD = 44;

/**
 * Onomatopoeia: comic sound-effect words that pop into the world (THWACK!, KRAK!, SHATTER!).
 * Each distinct word/colour is drawn once on a canvas and cached; live words are plain sprites.
 */
export class ComicWords {
  readonly group = new THREE.Group();
  private live: LiveWord[] = [];
  private cache = new Map<string, CachedTexture>();
  private sinceSmall = 99;
  private rnd = seeded(1234);
  private counters = new Map<string, number>();

  constructor() {
    this.group.name = 'comic-words';
    // The display font arrives a moment after boot; redraw any word that was made with the fallback.
    document.fonts?.load(`${CANVAS_H}px ${WORD_FX.font}`).then(() => this.clearCache()).catch(() => {});
  }

  /** Pop a styled word. Small words are rate-limited so a 4-enemy swing prints one word, not four. */
  popStyle(style: WordStyle, position: THREE.Vector3): boolean {
    const big = style.burst;
    if (!big && this.sinceSmall < WORD_FX.minGap) return false;
    const key = style.words.join('|');
    const n = this.counters.get(key) ?? 0;
    this.counters.set(key, n + 1);
    this.pop(style.words[n % style.words.length], position, style.fill, style.fill2, style.size, style.life, big);
    return true;
  }

  /** Pop any word (used by the `fx:onomatopoeia` event). */
  pop(text: string, position: THREE.Vector3, fill: string, fill2: string, size: number, life: number, burst: boolean) {
    if (!burst) this.sinceSmall = 0;
    while (this.live.length >= WORD_FX.maxLive) this.remove(this.oldestSmall());
    const { texture, aspect } = this.getTexture(text, fill, fill2, burst);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, fog: false });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = burst ? 21 : 20; // always readable over the fight
    sprite.position.copy(position);
    sprite.position.x += (this.rnd() - 0.5) * WORD_FX.jitter * 2;
    sprite.position.y += WORD_FX.lift + this.rnd() * 0.3;
    const tilt = THREE.MathUtils.degToRad((this.rnd() - 0.5) * 2 * WORD_FX.tiltDeg);
    mat.rotation = tilt;
    sprite.scale.set(0.001, 0.001, 1);
    this.group.add(sprite);
    this.live.push({ sprite, age: 0, life, size, aspect, tilt, big: burst });
  }

  update(dt: number) {
    if (dt <= 0) return;
    this.sinceSmall += dt;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const w = this.live[i];
      w.age += dt;
      if (w.age >= w.life) {
        this.remove(w);
        continue;
      }
      // pop: 0 → overshoot → 1, like a rubber stamp hitting the page
      const p = Math.min(1, w.age / WORD_FX.popTime);
      const settle = Math.min(1, Math.max(0, (w.age - WORD_FX.popTime) / (WORD_FX.popTime * 1.4)));
      const scale = p < 1 ? p * WORD_FX.overshoot : WORD_FX.overshoot + (1 - WORD_FX.overshoot) * settle;
      const s = w.size * scale;
      w.sprite.scale.set(s * w.aspect, s, 1);
      w.sprite.position.y += WORD_FX.riseSpeed * dt * (w.big ? 0.6 : 1);
      const fadeStart = w.life * 0.68;
      const mat = w.sprite.material;
      mat.opacity = w.age < fadeStart ? 1 : 1 - (w.age - fadeStart) / (w.life - fadeStart);
      mat.rotation = w.tilt + Math.sin(w.age * 38) * 0.035 * (1 - settle); // tiny impact wobble
    }
  }

  dispose() {
    for (const w of [...this.live]) this.remove(w);
    this.clearCache();
    this.group.removeFromParent();
  }

  private oldestSmall(): LiveWord {
    return this.live.find((w) => !w.big) ?? this.live[0];
  }

  private remove(w: LiveWord) {
    w.sprite.removeFromParent();
    w.sprite.material.dispose();
    const i = this.live.indexOf(w);
    if (i >= 0) this.live.splice(i, 1);
  }

  private clearCache() {
    const inUse = new Set(this.live.map((w) => w.sprite.material.map));
    for (const [key, c] of this.cache) {
      if (!inUse.has(c.texture)) c.texture.dispose();
      this.cache.delete(key);
    }
  }

  private getTexture(text: string, fill: string, fill2: string, burst: boolean): CachedTexture {
    const key = `${text}|${fill}|${fill2}|${burst}`;
    let c = this.cache.get(key);
    if (c) return c;
    if (this.cache.size > 40) this.clearCache();
    c = drawWord(text, fill, fill2, burst);
    this.cache.set(key, c);
    return c;
  }
}

/** Draw one comic word: optional starburst, offset ink shadow, thick outline, gradient fill, shine. */
function drawWord(text: string, fill: string, fill2: string, burst: boolean): CachedTexture {
  const font = `${Math.round(CANVAS_H * 0.62)}px ${WORD_FX.font}, ${WORD_FX.fallbackFonts}`;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = font;
  const textW = Math.ceil(probe.measureText(text).width);
  const w = textW + PAD * (burst ? 5 : 2.4);
  const h = burst ? CANVAS_H * 1.5 : CANVAS_H;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w);
  canvas.height = Math.ceil(h);
  const g = canvas.getContext('2d')!;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  if (burst) {
    const rnd = seeded(text.length * 131 + text.charCodeAt(0));
    const spikes = 16;
    g.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const outer = i % 2 === 0;
      const rx = (canvas.width / 2 - 10) * (outer ? 0.86 + rnd() * 0.14 : 0.62 + rnd() * 0.06);
      const ry = (canvas.height / 2 - 10) * (outer ? 0.86 + rnd() * 0.14 : 0.56 + rnd() * 0.06);
      g[i === 0 ? 'moveTo' : 'lineTo'](cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    g.closePath();
    g.fillStyle = FX_COLORS.paper;
    g.fill();
    g.lineJoin = 'miter';
    g.lineWidth = 9;
    g.strokeStyle = FX_COLORS.ink;
    g.stroke();
  }

  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.save();
  g.translate(cx, cy + 6);
  g.transform(1, 0, -0.14, 1, 0, 0); // forward lean = speed
  // offset drop shadow, like cheap two-plate printing
  g.fillStyle = FX_COLORS.ink;
  g.strokeStyle = FX_COLORS.ink;
  g.lineWidth = 22;
  g.strokeText(text, 9, 10);
  g.strokeText(text, 0, 0);
  const grad = g.createLinearGradient(0, -CANVAS_H * 0.3, 0, CANVAS_H * 0.3);
  grad.addColorStop(0, fill);
  grad.addColorStop(1, fill2);
  g.fillStyle = grad;
  g.fillText(text, 0, 0);
  // paper-white shine on the upper half of the letters only
  const shine = g.createLinearGradient(0, -CANVAS_H * 0.32, 0, 0);
  shine.addColorStop(0, 'rgba(255,255,255,0.6)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = shine;
  g.fillText(text, 0, 0);
  g.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, aspect: canvas.width / canvas.height };
}
