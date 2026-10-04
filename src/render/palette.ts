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
  /** Contrast S-curve amount in the comic post effect, 0 (flat) .. 1 (punchy). */
  contrast: number;
  /** Paper colour: the panel gutter and a faint tint in the highlights. */
  paper: THREE.Color;
  /** Colour of the gutter outside the panel border (cream page, or the void behind the torn page). */
  gutter: THREE.Color;
  /**
   * Gold buzz: how much bright gold jitters, fringes and flickers on screen. A story clue —
   * gold energy is subtly WRONG in the first half, and openly sick after the twist.
   */
  buzz: number;
  /** How torn the panel border is, 0 (clean ruled border) .. 1 (ripped page). */
  tear: number;
}

export const PALETTES: Record<PaletteMode, Palette> = {
  // The lie: a Saturday-morning page, sunny and a touch TOO bright.
  gold: {
    background: new THREE.Color('#ffe7a6'),
    fog: new THREE.Color('#ffdf9a'),
    keyLight: new THREE.Color('#fff0cf'),
    keyIntensity: 2.5,
    skyLight: new THREE.Color('#fff7e3'),
    groundLight: new THREE.Color('#b9854f'),
    ambientIntensity: 1.2,
    energy: new THREE.Color('#ffc21a'),
    inkTint: new THREE.Color('#6b3414'),
    saturation: 1.45,
    contrast: 0.7,
    paper: new THREE.Color('#fff3d6'),
    gutter: new THREE.Color('#fff3d6'),
    buzz: 1,
    tear: 0,
  },
  // The truth: a torn page lit by calm violet light over deep blue-black ink.
  violet: {
    background: new THREE.Color('#120b2a'),
    fog: new THREE.Color('#1c1240'),
    keyLight: new THREE.Color('#e9e0ff'),
    keyIntensity: 2.3,
    skyLight: new THREE.Color('#b3a4ff'),
    groundLight: new THREE.Color('#2a1b55'),
    ambientIntensity: 1.2,
    energy: new THREE.Color('#9b6bff'),
    inkTint: new THREE.Color('#0b0722'),
    saturation: 1.4,
    contrast: 0.55,
    paper: new THREE.Color('#e4dbff'),
    gutter: new THREE.Color('#07041a'),
    buzz: 1.8,
    tear: 1,
  },
};

/**
 * The palette the game is drawing with right now (the PaletteController's `current`).
 * Post effects and VFX read it here so they need no reference to the Game.
 */
export const livePalette: { current: Palette } = { current: clonePalette(PALETTES.gold) };

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
    livePalette.current = this.current;
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
