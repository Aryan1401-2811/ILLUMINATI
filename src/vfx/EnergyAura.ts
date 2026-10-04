import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { Player } from '@/player/Player';
import { FX_COLORS } from './config';
import { fxDt } from './fxTime';
import { buzzNoise } from './GoldBuzz';

const VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uAlpha;
varying vec2 vP;
void main() {
  float r = length(vP);
  float ang = atan(vP.y, vP.x) / 6.2831853;
  // two dashed rings turning opposite ways + a soft fill
  float ringA = smoothstep(0.80, 0.83, r) * (1.0 - smoothstep(0.90, 0.93, r)) * step(0.35, fract(ang * 10.0 + uTime * 0.35));
  float ringB = smoothstep(0.56, 0.58, r) * (1.0 - smoothstep(0.62, 0.64, r)) * step(0.5, fract(ang * 16.0 - uTime * 0.5));
  float fill = (1.0 - smoothstep(0.0, 0.95, r)) * 0.22;
  float a = (max(ringA, ringB) + fill) * uAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}`;

const AURA = { radius: 1.25, glow: 3.2, fadeSpeed: 4 };

/**
 * Energy-full glow: a turning ring of light at the hero's feet while the energy bar is full,
 * telling the player "your abilities are ready" without looking at the HUD.
 * In gold it twitches (the buzz clue); in violet it turns smoothly.
 */
export class EnergyAura extends Entity {
  private mat: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private alpha = 0;
  private time = 0;

  constructor() {
    super();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uAlpha: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.rotation.x = -Math.PI / 2;
    this.quad.renderOrder = 3;
    this.object.add(this.quad);
    this.object.visible = false;
  }

  update(dt: number) {
    const step = fxDt(dt);
    const player = this.scene.getFirst(Player);
    // read the hero directly rather than the player:energy event: this effect may be created
    // after the event already fired (it is installed when the scene has finished loading)
    const want = player && player.alive && player.maxEnergy > 0 && player.energy >= player.maxEnergy ? 1 : 0;
    this.alpha += Math.sign(want - this.alpha) * Math.min(Math.abs(want - this.alpha), step * AURA.fadeSpeed);
    this.object.visible = this.alpha > 0.01;
    if (!this.object.visible || !player) return;
    this.time += step;
    const gold = player.element !== 'violet';
    this.object.position.copy(player.position).setY(0.07);
    this.mat.uniforms.uColor.value.set(gold ? FX_COLORS.gold : FX_COLORS.violet).multiplyScalar(AURA.glow);
    this.mat.uniforms.uTime.value = this.time;
    this.mat.uniforms.uAlpha.value = this.alpha * (gold ? 0.85 + buzzNoise(this.time, 9) * 0.15 : 1);
    const pulse = 1 + Math.sin(this.time * 3) * 0.04;
    this.quad.scale.setScalar(AURA.radius * pulse * (gold ? 1 + buzzNoise(this.time, 5) * 0.05 : 1));
  }

  onRemoved() {
    this.mat.dispose();
    this.quad.geometry.dispose();
  }
}
