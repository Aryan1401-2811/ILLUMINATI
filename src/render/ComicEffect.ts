import * as THREE from 'three';
import { BlendFunction, Effect } from 'postprocessing';

const fragmentShader = /* glsl */ `
uniform float dotSize;
uniform float halftoneStrength;
uniform vec3 inkTint;
uniform float saturation;
uniform float paperStrength;
uniform float vignette;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));

  // saturation
  c = mix(vec3(lum), c, saturation);

  // halftone dots in the darker tones, on a 45° grid
  vec2 px = uv * resolution / dotSize;
  const float a = 0.7853982;
  vec2 rp = mat2(cos(a), -sin(a), sin(a), cos(a)) * px;
  vec2 cell = fract(rp) - 0.5;
  float radius = sqrt(clamp(1.0 - lum * 1.35, 0.0, 1.0)) * 0.62;
  float aa = 1.2 / dotSize;
  float dotMask = 1.0 - smoothstep(radius - aa, radius + aa, length(cell));
  float shadowAmt = 1.0 - smoothstep(0.18, 0.7, lum);
  c = mix(c, c * inkTint * 1.4, dotMask * shadowAmt * halftoneStrength);

  // printed-paper grain
  float g = hash(floor(uv * resolution * 0.5)) - 0.5;
  c += g * paperStrength;

  // soft vignette like an inked panel
  vec2 d = uv - 0.5;
  c *= 1.0 - dot(d, d) * vignette;

  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}
`;

/**
 * Full-screen comic print look: halftone dots in shadows, paper grain, saturation, vignette.
 * Visuals owner: tune via the uniforms (also exposed in the ?debug panel).
 */
export class ComicEffect extends Effect {
  constructor() {
    super('ComicEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['dotSize', new THREE.Uniform(5.0)],
        ['halftoneStrength', new THREE.Uniform(0.55)],
        ['inkTint', new THREE.Uniform(new THREE.Color('#5a2e12'))],
        ['saturation', new THREE.Uniform(1.1)],
        ['paperStrength', new THREE.Uniform(0.035)],
        ['vignette', new THREE.Uniform(0.9)],
      ]),
    });
  }

  uniform<T = any>(name: string): THREE.Uniform<T> {
    return this.uniforms.get(name) as THREE.Uniform<T>;
  }
}
