import * as THREE from 'three';
import { BlendFunction, Effect } from 'postprocessing';
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

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Everything is sized against a 1080p page so the print looks the same on any screen.
  float px = resolution.y / 1080.0;
  vec2 frag = uv * resolution;

  // Grade in a perceptual space: the tone mapper hands us flat, greyish colour and a comic
  // wants bold flat ink, so push saturation and contrast back in.
  vec3 c = pow(max(inputColor.rgb, 0.0), vec3(1.0 / 2.2));
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  // (vibrance: already-neutral paper and ink stay neutral, colours get bolder)
  float chroma = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(lum), c, 1.0 + (saturation - 1.0) * smoothstep(0.04, 0.3, chroma));
  c = clamp(c, 0.0, 1.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), contrast);
  lum = dot(c, vec3(0.299, 0.587, 0.114));

  // Halftone: ink dots on a 45-degree screen, only where the picture is in shadow.
  float ds = max(2.0, dotSize * px);
  const float a = 0.7853982;
  vec2 rp = mat2(cos(a), -sin(a), sin(a), cos(a)) * (frag / ds);
  vec2 cell = fract(rp) - 0.5;
  float shade = 1.0 - smoothstep(0.16, 0.56, lum);
  float radius = sqrt(shade) * 0.6;
  float aa = 1.0 / ds;
  float dotMask = (1.0 - smoothstep(radius - aa, radius + aa, length(cell))) * step(0.001, shade);
  c = mix(c, c * inkTint * 1.25, dotMask * halftoneStrength);

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
      ]),
    });
  }

  uniform<T = any>(name: string): THREE.Uniform<T> {
    return this.uniforms.get(name) as THREE.Uniform<T>;
  }

  /** Called by the effect pass every frame: pull the palette-driven look values. */
  update(_renderer: THREE.WebGLRenderer, _inputBuffer: THREE.WebGLRenderTarget, _deltaTime?: number) {
    const p = livePalette.current;
    this.uniform<number>('contrast').value = p.contrast;
    this.uniform<number>('tear').value = p.tear;
    this.uniform<THREE.Color>('paperColor').value.copy(p.paper);
    this.uniform<THREE.Color>('gutterColor').value.copy(p.gutter);
  }
}
