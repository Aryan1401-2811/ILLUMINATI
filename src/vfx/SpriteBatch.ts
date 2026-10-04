import * as THREE from 'three';

export type SpriteMode = 'billboard' | 'flat' | 'tumble';

export interface SpriteBatchOptions {
  texture: THREE.Texture;
  capacity: number;
  /** billboard = faces the camera, flat = lies on the ground, tumble = spins freely in 3D. */
  mode: SpriteMode;
  additive?: boolean;
  depthTest?: boolean;
  renderOrder?: number;
}

/** One live sprite. Fill the fields you need in spawn(); the rest keep their defaults. */
export interface Particle {
  alive: boolean;
  age: number;
  life: number;
  readonly pos: THREE.Vector3;
  readonly vel: THREE.Vector3;
  gravity: number;
  /** Velocity damping per second (0 = none). */
  drag: number;
  /** Size in metres at birth and at death. */
  size0: number;
  size1: number;
  /** Width / height. */
  aspect: number;
  rot: number;
  spin: number;
  /** Tumble mode: extra rotation axes. */
  tiltX: number;
  tiltZ: number;
  tiltSpin: number;
  readonly color: THREE.Color;
  /** Colour multiplier. Above 1 the sprite blooms. */
  intensity: number;
  alpha: number;
  /** Fraction of life after which it starts to fade out (0 = fades all its life). */
  fadeFrom: number;
  /** Fraction of life spent fading in (0 = appears instantly). */
  fadeIn: number;
  /** Stop at this height and stay there (ink drops landing). */
  floorY: number;
}

const VERT = /* glsl */ `
attribute vec4 iColor;
attribute float iRot;
varying vec4 vColor;
varying vec2 vUv;
void main() {
  vUv = uv;
  vColor = iColor;
  #ifdef BILLBOARD
    vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 scale = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
    float c = cos(iRot);
    float s = sin(iRot);
    vec2 p = position.xy * scale;
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    gl_Position = projectionMatrix * (center + vec4(p, 0.0, 0.0));
  #else
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  #endif
}`;

const FRAG = /* glsl */ `
uniform sampler2D map;
varying vec4 vColor;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(map, vUv);
  float a = t.a * vColor.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(t.rgb * vColor.rgb, a);
}`;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const _yaw = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * A pool of textured quads drawn in ONE draw call (instancing) and simulated on the CPU.
 * Every spark, ink drop, splat, glow and paper scrap in the game goes through one of these,
 * which is what keeps the effects inside the draw-call budget.
 */
export class SpriteBatch {
  readonly mesh: THREE.InstancedMesh;
  readonly particles: Particle[] = [];
  private colors: THREE.InstancedBufferAttribute;
  private rots: THREE.InstancedBufferAttribute;
  private cursor = 0;
  private liveCount = 0;

  constructor(private opts: SpriteBatchOptions) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.colors = new THREE.InstancedBufferAttribute(new Float32Array(opts.capacity * 4), 4);
    this.rots = new THREE.InstancedBufferAttribute(new Float32Array(opts.capacity), 1);
    this.colors.setUsage(THREE.DynamicDrawUsage);
    this.rots.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iColor', this.colors);
    geo.setAttribute('iRot', this.rots);
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: opts.texture } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      defines: opts.mode === 'billboard' ? { BILLBOARD: '' } : {},
      transparent: true,
      depthWrite: false,
      depthTest: opts.depthTest ?? true,
      side: THREE.DoubleSide,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, opts.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; // instances are spread across the arena
    this.mesh.renderOrder = opts.renderOrder ?? 5;
    this.mesh.castShadow = this.mesh.receiveShadow = false;
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < opts.capacity; i++) {
      this.mesh.setMatrixAt(i, _m);
      this.particles.push(blank());
    }
  }

  get live(): number {
    return this.liveCount;
  }

  /** Start a sprite. When the pool is full the oldest one is recycled. */
  spawn(init: (p: Particle) => void): Particle {
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % this.particles.length;
    reset(p);
    init(p);
    p.alive = true;
    return p;
  }

  update(dt: number) {
    if (dt <= 0) return;
    let live = 0;
    const flat = this.opts.mode === 'flat';
    const tumble = this.opts.mode === 'tumble';
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        _m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, _m);
        continue;
      }
      live++;
      const k = p.age / p.life;
      if (p.pos.y > p.floorY || p.vel.y > 0) {
        p.vel.y -= p.gravity * dt;
        if (p.drag > 0) p.vel.multiplyScalar(Math.exp(-p.drag * dt));
        p.pos.addScaledVector(p.vel, dt);
        p.rot += p.spin * dt;
        p.tiltX += p.tiltSpin * dt;
        p.tiltZ += p.tiltSpin * 0.7 * dt;
        if (p.pos.y <= p.floorY && p.vel.y < 0) {
          p.pos.y = p.floorY;
          p.vel.set(0, 0, 0);
        }
      }
      const size = p.size0 + (p.size1 - p.size0) * (1 - (1 - k) * (1 - k));
      _s.set(size * p.aspect, size, 1);
      if (flat) _q.copy(FLAT).premultiply(_yaw.setFromAxisAngle(UP, p.rot));
      else if (tumble) _q.setFromEuler(_e.set(p.tiltX, p.rot, p.tiltZ));
      else _q.identity();
      this.mesh.setMatrixAt(i, _m.compose(p.pos, _q, _s));
      let fade = k <= p.fadeFrom ? 1 : 1 - (k - p.fadeFrom) / (1 - p.fadeFrom);
      if (k < p.fadeIn) fade *= k / p.fadeIn;
      this.colors.setXYZW(i, p.color.r * p.intensity, p.color.g * p.intensity, p.color.b * p.intensity, p.alpha * fade);
      this.rots.setX(i, p.rot);
    }
    this.liveCount = live;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.colors.needsUpdate = true;
    this.rots.needsUpdate = true;
  }

  /** Kill every sprite (scene change, palette hard-cut). */
  clear() {
    for (const p of this.particles) if (p.alive) p.life = 0;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose(); // the texture is shared — never disposed here
  }
}

function blank(): Particle {
  const p = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), color: new THREE.Color() } as Particle;
  reset(p);
  return p;
}

function reset(p: Particle) {
  p.alive = false;
  p.age = 0;
  p.life = 0.5;
  p.pos.set(0, 0, 0);
  p.vel.set(0, 0, 0);
  p.gravity = 0;
  p.drag = 0;
  p.size0 = p.size1 = 0.2;
  p.aspect = 1;
  p.rot = p.spin = 0;
  p.tiltX = p.tiltZ = p.tiltSpin = 0;
  p.color.set(0xffffff);
  p.intensity = 1;
  p.alpha = 1;
  p.fadeFrom = 0.5;
  p.fadeIn = 0;
  p.floorY = -Infinity;
}
