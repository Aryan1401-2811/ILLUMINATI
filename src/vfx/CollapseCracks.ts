import * as THREE from 'three';
import { FX_COLORS } from './config';
import { seeded } from './textures';

const VERT = /* glsl */ `
attribute float aT;
attribute float aV;
varying float vT;
varying float vV;
void main() {
  vT = aT;
  vV = aV;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform float uProgress;
uniform float uGlow;
uniform vec3 uInk;
uniform vec3 uLight;
varying float vT;
varying float vV;
void main() {
  if (vT > uProgress) discard;
  // black torn edge, violet light in the gap; the tip of a growing crack burns brightest
  float core = 1.0 - smoothstep(0.16, 0.36, abs(vV));
  float tip = smoothstep(uProgress - 0.1, uProgress, vT);
  gl_FragColor = vec4(mix(uInk, uLight * (uGlow + tip * 2.5), core), 1.0);
}`;

/**
 * Jagged cracks that race outward across the floor from a centre point, splitting as they go.
 * One mesh for all of them; growth is a single uniform (0 → 1).
 */
export class CollapseCracks {
  readonly mesh: THREE.Mesh;
  /** The outer end of every main crack (world XZ), for spawning effects where they stop. */
  readonly tips: THREE.Vector3[] = [];
  private mat: THREE.ShaderMaterial;

  constructor(center: THREE.Vector3, radius: number, count: number, seed = 7) {
    const r = seeded(seed);
    const pos: number[] = [];
    const ts: number[] = [];
    const vs: number[] = [];
    const idx: number[] = [];

    /** Emit a ribbon along a polyline. `t0` = how far along the collapse this branch starts. */
    const ribbon = (pts: THREE.Vector2[], width: number, t0: number, t1: number) => {
      const base = pos.length / 3;
      for (let i = 0; i < pts.length; i++) {
        const prev = pts[Math.max(0, i - 1)];
        const next = pts[Math.min(pts.length - 1, i + 1)];
        const dx = next.x - prev.x;
        const dz = next.y - prev.y;
        const len = Math.hypot(dx, dz) || 1;
        const k = i / (pts.length - 1);
        const w = width * (1 - k * 0.85);
        const nx = (-dz / len) * w;
        const nz = (dx / len) * w;
        pos.push(pts[i].x + nx, 0, pts[i].y + nz, pts[i].x - nx, 0, pts[i].y - nz);
        const t = t0 + (t1 - t0) * k;
        ts.push(t, t);
        vs.push(1, -1);
        if (i < pts.length - 1) {
          const a = base + i * 2;
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
    };

    for (let c = 0; c < count; c++) {
      let angle = (c / count) * Math.PI * 2 + (r() - 0.5) * 0.5;
      const p = new THREE.Vector2(center.x + Math.cos(angle) * 0.6, center.z + Math.sin(angle) * 0.6);
      const pts = [p.clone()];
      const reach = radius * (0.8 + r() * 0.3);
      while (Math.hypot(p.x - center.x, p.y - center.z) < reach) {
        angle += (r() - 0.5) * 0.95;
        // keep heading outward so a crack never curls back on itself
        const out = Math.atan2(p.y - center.z, p.x - center.x);
        angle += Math.atan2(Math.sin(out - angle), Math.cos(out - angle)) * 0.35;
        p.x += Math.cos(angle) * (0.8 + r() * 0.7);
        p.y += Math.sin(angle) * (0.8 + r() * 0.7);
        pts.push(p.clone());
        // side branch
        if (pts.length > 2 && r() < 0.32) {
          let ba = angle + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.6);
          const b = p.clone();
          const branch = [b.clone()];
          for (let s = 0; s < 2 + Math.floor(r() * 3); s++) {
            ba += (r() - 0.5) * 0.7;
            b.x += Math.cos(ba) * (0.6 + r() * 0.5);
            b.y += Math.sin(ba) * (0.6 + r() * 0.5);
            branch.push(b.clone());
          }
          const at = Math.hypot(p.x - center.x, p.y - center.z) / (radius * 1.1);
          ribbon(branch, 0.07, at, Math.min(1, at + 0.2));
        }
      }
      ribbon(pts, 0.13 + r() * 0.06, 0, Math.min(1, reach / (radius * 1.1)));
      this.tips.push(new THREE.Vector3(p.x, 0, p.y));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aT', new THREE.Float32BufferAttribute(ts, 1));
    geo.setAttribute('aV', new THREE.Float32BufferAttribute(vs, 1));
    geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uGlow: { value: 1.6 },
        uInk: { value: new THREE.Color(FX_COLORS.ink) },
        uLight: { value: new THREE.Color(FX_COLORS.violet) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.y = 0.035;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.name = 'collapse-cracks';
  }

  /** 0 = nothing, 1 = every crack has reached the rim. */
  set progress(v: number) {
    this.mat.uniforms.uProgress.value = v;
  }

  set glow(v: number) {
    this.mat.uniforms.uGlow.value = v;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
