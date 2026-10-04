import * as THREE from 'three';

export type PaletteMode = 'gold' | 'violet';

/**
 * The world's lighting/colour mood. 'gold' = the Narrator's lie (first half),
 * 'violet' = the truth (after the twist). Visuals owner tunes these values.
 */
export interface Palette {
  background: THREE.Color;
  fog: THREE.Color;
  keyLight: THREE.Color;
  keyIntensity: number;
  skyLight: THREE.Color;
  groundLight: THREE.Color;
  ambientIntensity: number;
  /** Colour of the player's energy and the Narrator's light. */
  energy: THREE.Color;
  /** Tint applied to halftone shadows by the comic post effect. */
  inkTint: THREE.Color;
  /** Overall saturation multiplier in the comic post effect. */
  saturation: number;
}

export const PALETTES: Record<PaletteMode, Palette> = {
  gold: {
    background: new THREE.Color('#f3e2b8'),
    fog: new THREE.Color('#e9cf95'),
    keyLight: new THREE.Color('#ffd98a'),
    keyIntensity: 3.2,
    skyLight: new THREE.Color('#fff1cc'),
    groundLight: new THREE.Color('#7a4a2a'),
    ambientIntensity: 1.3,
    energy: new THREE.Color('#ffc21a'),
    inkTint: new THREE.Color('#5a2e12'),
    saturation: 1.1,
  },
  violet: {
    background: new THREE.Color('#1d1433'),
    fog: new THREE.Color('#2a1d4a'),
    keyLight: new THREE.Color('#b9a3ff'),
    keyIntensity: 2.6,
    skyLight: new THREE.Color('#8f7bff'),
    groundLight: new THREE.Color('#140b26'),
    ambientIntensity: 1.1,
    energy: new THREE.Color('#9b6bff'),
    inkTint: new THREE.Color('#0d0820'),
    saturation: 1.05,
  },
};

/** A live, blendable palette. Read `current` every frame; call blendTo() to transition. */
export class PaletteController {
  readonly current: Palette;
  private from: Palette;
  private to: Palette;
  private t = 1;
  private duration = 0;
  mode: PaletteMode;

  constructor(mode: PaletteMode = 'gold') {
    this.mode = mode;
    this.current = clonePalette(PALETTES[mode]);
    this.from = PALETTES[mode];
    this.to = PALETTES[mode];
  }

  blendTo(mode: PaletteMode, durationSec = 1.5) {
    this.from = clonePalette(this.current);
    this.to = PALETTES[mode];
    this.mode = mode;
    this.duration = durationSec;
    this.t = durationSec <= 0 ? 1 : 0;
    if (this.t >= 1) copyPalette(this.current, this.to);
  }

  update(realDt: number) {
    if (this.t >= 1) return;
    this.t = Math.min(1, this.t + realDt / this.duration);
    const k = this.t * this.t * (3 - 2 * this.t);
    lerpPalette(this.current, this.from, this.to, k);
  }
}

function clonePalette(p: Palette): Palette {
  const out = {} as Palette;
  for (const [k, v] of Object.entries(p)) (out as any)[k] = v instanceof THREE.Color ? v.clone() : v;
  return out;
}

function copyPalette(dst: Palette, src: Palette) {
  lerpPalette(dst, src, src, 1);
}

function lerpPalette(dst: Palette, a: Palette, b: Palette, k: number) {
  for (const key of Object.keys(a) as (keyof Palette)[]) {
    const va = a[key];
    const vb = b[key];
    if (va instanceof THREE.Color && vb instanceof THREE.Color) (dst[key] as THREE.Color).lerpColors(va, vb, k);
    else (dst as any)[key] = (va as number) + ((vb as number) - (va as number)) * k;
  }
}
