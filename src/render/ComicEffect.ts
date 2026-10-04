import * as THREE from 'three';
import { BlendFunction, Effect } from 'postprocessing';
import { events } from '@/core/events';
import { livePalette } from './palette';

const fragmentShader = /* glsl */ `
uniform float dotSize;
uniform float halftoneStrength;
uniform vec3 inkTint;
uniform float saturation;
uniform float paperStrength;
uniform float vignette;
uniform float contrast;
uniform float panelBorder;
uniform float tear;
uniform vec3 paperColor;
uniform vec3 gutterColor;
uniform float buzz;
uniform float time;
uniform float truth;
uniform float flip;
uniform vec2 flipOrigin;
uniform vec3 flipColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// How much a pixel is "gold light": bright and warm. Hot energy counts far more than sunny walls.
float goldness(vec3 c) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float warm = smoothstep(0.06, 0.28, c.r - c.b) * smoothstep(-0.06, 0.08, c.g - c.b);
  return warm * (0.22 * smoothstep(0.35, 0.6, l) + 0.78 * smoothstep(0.62, 0.9, l));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Everything is sized against a 1080p page so the print looks the same on any screen.
  float px = resolution.y / 1080.0;
  vec2 frag = uv * resolution;

  // Grade in a perceptual space: the tone mapper hands us flat, greyish colour and a comic
  // wants bold flat ink, so push saturation and contrast back in.
  // The twist flip: a shock ring bursts out of the Narrator's corner of the page. It bends the
  // picture as it passes, so sample the scene slightly displaced along the ring.
  float aspect = resolution.x / resolution.y;
  vec2 fromOrigin = (uv - flipOrigin) * vec2(aspect, 1.0);
  float ringDist = length(fromOrigin);
  float ringRadius = flip * 2.6;
  float ring = flip > 0.0 && flip < 1.0 ? exp(-pow((ringDist - ringRadius) / 0.07, 2.0)) * (1.0 - flip) : 0.0;
  vec2 bend = ringDist > 0.0001 ? (fromOrigin / ringDist) / vec2(aspect, 1.0) * ring * 0.035 : vec2(0.0);
  vec3 src = ring > 0.001 ? texture2D(inputBuffer, uv - bend).rgb : inputColor.rgb;

  // Gold buzz (story clue): wherever the picture is bright gold, the colour plates slip a pixel
  // or two and the light flickers, stepping like a badly registered print. Violet never does.
  if (buzz > 0.001) {
    float tick = floor(time * 14.0);
    vec2 jit = vec2(hash(vec2(tick, 1.3)), hash(vec2(tick, 7.1))) - 0.5;
    vec2 off = (vec2(1.7, 0.0) + jit * 2.2) * px / resolution;
    vec3 sa = texture2D(inputBuffer, uv + off).rgb;
    vec3 sb = texture2D(inputBuffer, uv - off).rgb;
    float m = clamp(max(goldness(src), max(goldness(sa), goldness(sb))) * buzz, 0.0, 1.0);
    src = mix(src, vec3(sa.r, src.g, sb.b), m);
    float hot = smoothstep(0.62, 0.9, dot(src, vec3(0.299, 0.587, 0.114)));
    src *= 1.0 + m * hot * 0.16 * (hash(vec2(tick, 3.7)) - 0.5);
  }

  vec3 c = pow(max(src, 0.0), vec3(1.0 / 2.2));
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  // (vibrance: already-neutral paper and ink stay neutral, colours get bolder)
  float chroma = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(lum), c, 1.0 + (saturation - 1.0) * smoothstep(0.04, 0.3, chroma));
  c = clamp(c, 0.0, 1.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), contrast);
  lum = dot(c, vec3(0.299, 0.587, 0.114));

  // The truth (after the twist): gold is shown for what it always was. Wherever the picture is
  // gold it turns tarnished and is eaten by ink dots, while violet stays clean and luminous.
  float tarnish = truth * goldness(src);
  if (tarnish > 0.001) {
    c = mix(c, vec3(lum) * vec3(1.0, 0.72, 0.3), tarnish * 0.55);
    lum = dot(c, vec3(0.299, 0.587, 0.114));
  }

  // Halftone: ink dots on a 45-degree screen, only where the picture is in shadow.
  float ds = max(2.0, dotSize * px);
  const float a = 0.7853982;
  vec2 rp = mat2(cos(a), -sin(a), sin(a), cos(a)) * (frag / ds);
  vec2 cell = fract(rp) - 0.5;
  // behind the flip's shock ring the whole picture is briefly swallowed by dots: a halftone wipe
  float wipe = flip > 0.0 && flip < 1.0 ? smoothstep(0.34, 0.0, ringRadius - ringDist) * step(ringDist, ringRadius) * (1.0 - flip) : 0.0;
  float shade = max(max(1.0 - smoothstep(0.16, 0.56, lum), tarnish * 0.7), wipe);
  float radius = sqrt(shade) * 0.6;
  float aa = 1.0 / ds;
  float dotMask = (1.0 - smoothstep(radius - aa, radius + aa, length(cell))) * step(0.001, shade);
  c = mix(c, c * inkTint * 1.25, dotMask * max(halftoneStrength, wipe));

  // the ring itself burns in the new light, and the very first frames print as a negative
  c += flipColor * ring * 1.6;
  float negative = flip > 0.0 ? 1.0 - smoothstep(0.0, 0.09, flip) : 0.0;
  c = mix(c, 1.0 - c, negative);

  // Printed paper: fine grain plus slow blotches, and a little of the paper colour in the lights.
  float grain = hash(floor(frag / max(1.0, 2.0 * px))) - 0.5;
  float blotch = vnoise(frag / (90.0 * px)) - 0.5;
  c += (grain + blotch * 0.6) * paperStrength;
  c = mix(c, c * paperColor, 0.14 * smoothstep(0.55, 1.0, lum));

  // Soft inked vignette (tinted with the ink, never plain black).
  vec2 d = uv - 0.5;
  float vig = clamp(dot(d, d) * vignette, 0.0, 1.0);
  c = mix(c, c * mix(inkTint, vec3(1.0), 0.25), vig);

  // The screen is one comic panel: a paper gutter and a hand-inked border. After the twist
  // (tear > 0) the border frays like ripped paper.
  if (panelBorder > 0.001) {
    vec2 edge = min(frag, resolution - frag);
    float rough = (vnoise(frag / (9.0 * px)) - 0.5) * 2.5 * px;
    float rip = (vnoise(frag / (70.0 * px)) - 0.5) * 46.0 * px * tear + (vnoise(frag / (15.0 * px)) - 0.5) * 12.0 * px * tear;
    float dist = min(edge.x, edge.y) + rough + rip;
    float gutter = (11.0 + 9.0 * tear) * px * panelBorder;
    float line = 5.0 * px * panelBorder;
    vec3 gutterCol = gutterColor * (0.94 + grain * 0.1);
    // clean page: a dark ink rule. torn page: the pale fibre of ripped paper.
    vec3 inkCol = mix(inkTint * 0.32, paperColor, tear);
    c = mix(c, inkCol, 1.0 - smoothstep(gutter + line - px, gutter + line + px, dist));
    c = mix(c, gutterCol, 1.0 - smoothstep(gutter - px, gutter + px, dist));
  }

  outputColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(2.2)), inputColor.a);
}
`;

/** Look values that are not part of the palette: tweak here (or live in the ?debug panel). */
const LOOK = {
  dotSize: 5.0,
  halftoneStrength: 0.5,
  paperStrength: 0.04,
  vignette: 0.75,
  panelBorder: 1,
};

/**
 * Full-screen comic print look: colour grade, halftone dots in shadows, paper grain, inked
 * vignette and a panel border. Visuals owner: tune via the uniforms (also in the ?debug panel).
 * Palette-driven uniforms (contrast, tear, paperColor) follow the live palette automatically.
 */
export class ComicEffect extends Effect {
  private flipTime = -1;
  private flipDuration = 1.1;
  private lastMode = 'gold';

  constructor() {
    super('ComicEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['dotSize', new THREE.Uniform(LOOK.dotSize)],
        ['halftoneStrength', new THREE.Uniform(LOOK.halftoneStrength)],
        ['inkTint', new THREE.Uniform(new THREE.Color('#5a2e12'))],
        ['saturation', new THREE.Uniform(1.1)],
        ['paperStrength', new THREE.Uniform(LOOK.paperStrength)],
        ['vignette', new THREE.Uniform(LOOK.vignette)],
        ['contrast', new THREE.Uniform(0.5)],
        ['panelBorder', new THREE.Uniform(LOOK.panelBorder)],
        ['tear', new THREE.Uniform(0)],
        ['paperColor', new THREE.Uniform(new THREE.Color('#fbf1dc'))],
        ['gutterColor', new THREE.Uniform(new THREE.Color('#fbf1dc'))],
        ['buzz', new THREE.Uniform(1)],
        ['time', new THREE.Uniform(0)],
        ['truth', new THREE.Uniform(0)],
        ['flip', new THREE.Uniform(0)],
        ['flipOrigin', new THREE.Uniform(new THREE.Vector2(0.86, 0.88))],
        ['flipColor', new THREE.Uniform(new THREE.Color('#b79bff'))],
      ]),
    });
    // The palette flip is THE moment of the game: whenever the world changes palette (with a
    // real transition, not an instant set) the screen takes the hit too.
    events.on('palette:set', ({ mode, durationSec }) => {
      const changed = mode !== this.lastMode;
      this.lastMode = mode;
      if (!changed || (durationSec ?? 1.5) <= 0.05) return;
      this.playFlip(Math.min(1.4, Math.max(0.8, (durationSec ?? 1.5) * 0.75)), mode === 'violet' ? '#b79bff' : '#ffd98a');
    });
  }

  /**
   * Play the twist flip: a negative flash, then a shock ring and halftone wipe racing across the
   * screen from `origin` (uv, default: the Narrator's caption box in the top-right).
   */
  playFlip(durationSec = 1.1, color: THREE.ColorRepresentation = '#b79bff', origin?: THREE.Vector2) {
    this.flipDuration = Math.max(0.3, durationSec);
    this.flipTime = 0;
    this.uniform<THREE.Color>('flipColor').value.set(color);
    if (origin) this.uniform<THREE.Vector2>('flipOrigin').value.copy(origin);
  }

  uniform<T = any>(name: string): THREE.Uniform<T> {
    return this.uniforms.get(name) as THREE.Uniform<T>;
  }

  /** Called by the effect pass every frame: pull the palette-driven look values. */
  update(_renderer: THREE.WebGLRenderer, _inputBuffer: THREE.WebGLRenderTarget, deltaTime = 1 / 60) {
    const p = livePalette.current;
    const time = this.uniform<number>('time');
    time.value = (time.value + deltaTime) % 1000;
    this.uniform<number>('buzz').value = p.buzz;
    this.uniform<number>('truth').value = p.tear; // 0 on the gold page, 1 once the truth is out
    if (this.flipTime >= 0) {
      this.flipTime += deltaTime;
      const k = this.flipTime / this.flipDuration;
      this.uniform<number>('flip').value = k >= 1 ? 0 : Math.max(0.0001, k);
      if (k >= 1) this.flipTime = -1;
    }
    this.uniform<number>('contrast').value = p.contrast;
    this.uniform<number>('tear').value = p.tear;
    this.uniform<THREE.Color>('paperColor').value.copy(p.paper);
    this.uniform<THREE.Color>('gutterColor').value.copy(p.gutter);
  }
}
