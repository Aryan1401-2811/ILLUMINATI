import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { FX_COLORS } from './config';
import { fxDt } from './fxTime';

const SHOCK = { glow: 4, ticks: 22, margin: 1.3 };

const VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uInk;
uniform float uK;     // 0..1 life
uniform float uRing;  // current ring radius, 0..1 of the quad
varying vec2 vP;
void main() {
  float r = length(vP);
  float w = mix(0.2, 0.035, uK) * uRing + 0.01;      // the band thins as it travels
  float line = 0.018;
  float band = smoothstep(uRing - w, uRing - w + 0.01, r) * (1.0 - smoothstep(uRing, uRing + 0.01, r));
  float inkOut = smoothstep(uRing, uRing + 0.006, r) * (1.0 - smoothstep(uRing + line, uRing + line + 0.008, r));
  float inkIn = smoothstep(uRing - w - line, uRing - w - line + 0.008, r) * (1.0 - smoothstep(uRing - w - 0.004, uRing - w, r));
  // speed ticks racing ahead of the ring, like the motion lines around a comic impact
  float ang = atan(vP.y, vP.x) / 6.2831853 + 0.5;
  float cell = floor(ang * ${SHOCK.ticks}.0);
  float tickLen = (0.06 + 0.1 * fract(sin(cell * 91.7) * 43758.5)) * (1.0 - uK);
  float tick = step(0.62, fract(ang * ${SHOCK.ticks}.0)) * smoothstep(uRing + 0.04, uRing + 0.05, r) * (1.0 - smoothstep(uRing + 0.04 + tickLen, uRing + 0.05 + tickLen, r));
  float ink = max(max(inkOut, inkIn), tick);
  float fade = 1.0 - uK * uK;
  float a = max(band * fade, ink * fade);
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(uColor, uInk, step(0.5, ink) * (1.0 - band)), a);
}`;

/** Expanding inked ring of light on the ground. Fire-and-forget: scene.add(new Shockwave(pos, 4, '#ffc21a')). */
export class Shockwave extends Entity {
  private age = 0;
  private mat: THREE.ShaderMaterial;
  private half: number;

  constructor(
    at: THREE.Vector3,
    private maxRadius = 4,
    color: THREE.ColorRepresentation = '#ffc21a',
    private duration = 0.35,
  ) {
    super();
    this.half = (maxRadius + 0.3) * SHOCK.margin;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color).multiplyScalar(SHOCK.glow) },
        uInk: { value: new THREE.Color(FX_COLORS.ink) },
        uK: { value: 0 },
        uRing: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    quad.rotation.x = -Math.PI / 2;
    quad.scale.setScalar(this.half);
    quad.renderOrder = 4;
    this.object.add(quad);
    this.object.position.copy(at).setY(0.08);
  }

  update(dt: number) {
    this.age += fxDt(dt) * (dt > 0 ? 1 : 0.5);
    const k = Math.min(1, this.age / this.duration);
    const e = 1 - (1 - k) ** 3;
    this.mat.uniforms.uK.value = k;
    this.mat.uniforms.uRing.value = (0.3 + e * this.maxRadius) / this.half;
    if (k >= 1) this.destroy();
  }

  onRemoved() {
    this.mat.dispose();
    (this.object.children[0] as THREE.Mesh).geometry.dispose();
  }
}
