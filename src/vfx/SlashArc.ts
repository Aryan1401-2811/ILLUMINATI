import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { FX_COLORS } from './config';
import { fxDt } from './fxTime';

const SLASH = {
  widthLight: 0.6,
  widthHeavy: 1.0,
  glowLight: 3.2,
  glowHeavy: 5,
  segments: 40,
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// uv.x runs along the swing (0 = where the blade starts), uv.y from the inner edge (0) to the outer (1)
const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uInk;
uniform float uK;
varying vec2 vUv;
void main() {
  float t = vUv.x;
  float v = vUv.y;
  // a bright head sweeps along the arc and a tail chases it: reads as one fast stroke of a brush
  float head = uK * 1.7;
  float tail = max(0.0, head - 0.8);
  float vis = smoothstep(tail, tail + 0.3, t) * (1.0 - smoothstep(head - 0.03, head, t));
  float body = smoothstep(0.0, 0.6, v);
  float inkEdge = smoothstep(0.86, 0.9, v);
  // printed speed streaks inside the stroke
  float streak = 0.72 + 0.28 * step(0.45, fract(v * 3.0 - t * 1.5));
  vec3 col = mix(uColor * streak, uInk, inkEdge);
  float a = vis * mix(body, 1.0, inkEdge) * (1.0 - uK * uK * 0.5);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

/** Tapered crescent: fat in the middle, sharp at both ends, like a brush stroke. */
function crescentGeometry(radius: number, width: number, arc: number): THREE.BufferGeometry {
  const n = SLASH.segments;
  const pos = new Float32Array((n + 1) * 2 * 3);
  const uv = new Float32Array((n + 1) * 2 * 2);
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = -arc / 2 + arc * t;
    const taper = Math.pow(Math.sin(Math.PI * t), 0.6);
    const inner = radius - width * taper;
    pos.set([Math.cos(a) * inner, Math.sin(a) * inner, 0, Math.cos(a) * radius, Math.sin(a) * radius, 0], i * 6);
    uv.set([t, 0, t, 1], i * 4);
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/** Crescent swipe trail for melee swings: an inked brush stroke of light. Fire-and-forget. */
export class SlashArc extends Entity {
  private age = 0;
  private mat: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;

  constructor(
    at: THREE.Vector3,
    yaw: number,
    opts: { radius?: number; arcDeg?: number; color?: THREE.ColorRepresentation; heavy?: boolean; flip?: boolean } = {},
    private duration = 0.16,
  ) {
    super();
    const radius = opts.radius ?? 1.8;
    const arc = THREE.MathUtils.degToRad(opts.arcDeg ?? 140);
    const width = opts.heavy ? SLASH.widthHeavy : SLASH.widthLight;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(opts.color ?? '#fff3c4').multiplyScalar(opts.heavy ? SLASH.glowHeavy : SLASH.glowLight) },
        uInk: { value: new THREE.Color(FX_COLORS.ink) },
        uK: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(crescentGeometry(radius, width, arc), this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 6;
    const pivot = new THREE.Group();
    pivot.add(this.mesh);
    // arc centre direction is +X; rotate so it points along yaw (forward = +Z at yaw 0)
    pivot.rotation.y = yaw - Math.PI / 2;
    if (opts.flip) pivot.rotation.z = Math.PI;
    this.object.add(pivot);
    this.object.position.copy(at).setY(opts.heavy ? 0.9 : 1.05);
    this.object.rotation.z = (opts.flip ? -1 : 1) * 0.15;
  }

  update(dt: number) {
    this.age += fxDt(dt) * (dt > 0 ? 1 : 0.5); // keeps moving (slowly) through hit-stop
    const k = Math.min(1, this.age / this.duration);
    this.mat.uniforms.uK.value = k;
    this.object.scale.setScalar(0.9 + 0.2 * k);
    if (k >= 1) this.destroy();
  }

  onRemoved() {
    this.mat.dispose();
    this.mesh.geometry.dispose();
  }
}
