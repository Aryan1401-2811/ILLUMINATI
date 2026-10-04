import * as THREE from 'three';
import { Entity } from '@/core/Entity';
import { events } from '@/core/events';
import { FX_COLORS, WISP_FX } from './config';
import { fxDt } from './fxTime';
import { glowTexture } from './textures';
import type { ImpactFx } from './ImpactFx';

const _target = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _want = new THREE.Vector3();

let count = 0;

/**
 * The first clue. When a Shade dies, a soft violet light lifts out of it, hovers for a moment
 * as if unsure, and then drifts — always — toward the top-right of the screen, where the
 * Narrator's caption box lives. It is never loud: you notice it on the second or third kill.
 */
export class Wisp extends Entity {
  private core: THREE.Sprite;
  private halo: THREE.Sprite;
  private materials: THREE.SpriteMaterial[];
  private velocity = new THREE.Vector3();
  private age = 0;
  private trailIn = 0;
  private fade = 1;
  private start = new THREE.Vector3();
  private phase = (count++ * 2.4) % (Math.PI * 2);

  constructor(
    at: THREE.Vector3,
    private fx: ImpactFx,
  ) {
    super();
    const color = new THREE.Color(FX_COLORS.violet);
    const coreMat = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color('#f3ecff').multiplyScalar(2.4), transparent: true, depthWrite: false, depthTest: false, fog: false });
    const haloMat = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false });
    this.core = new THREE.Sprite(coreMat);
    this.halo = new THREE.Sprite(haloMat);
    this.core.renderOrder = 15;
    this.halo.renderOrder = 14;
    this.materials = [coreMat, haloMat];
    this.object.add(this.halo, this.core);
    this.object.position.copy(at);
    this.object.position.y = Math.max(0.9, at.y);
    this.start.copy(this.object.position);
  }

  update(dt: number) {
    const step = fxDt(dt);
    if (step <= 0) return;
    this.age += step;
    const pos = this.object.position;

    if (this.age < WISP_FX.riseTime) {
      // lift out of the body, slowing as it rises
      const k = this.age / WISP_FX.riseTime;
      const e = 1 - (1 - k) * (1 - k);
      pos.y = this.start.y + e * WISP_FX.riseHeight;
      pos.x = this.start.x + Math.sin(this.age * 5 + this.phase) * 0.12 * k;
    } else {
      // steer toward the caption box: a point in front of the camera at the top-right of the screen
      const camera = this.scene.game.camera;
      _target.set(WISP_FX.targetNdc.x, WISP_FX.targetNdc.y, 0.5).unproject(camera);
      _dir.subVectors(_target, camera.position).normalize();
      _target.copy(camera.position).addScaledVector(_dir, WISP_FX.targetDepth);
      _want.subVectors(_target, pos);
      const dist = _want.length();
      if (dist < 0.45 || this.age > WISP_FX.maxLife) {
        this.fade -= step * 5;
        if (this.fade <= 0) {
          if (this.age <= WISP_FX.maxLife) events.emit('fx:wispAbsorbed', { position: pos.clone() });
          this.destroy();
          return;
        }
      }
      _want.multiplyScalar(Math.min(WISP_FX.maxSpeed, dist * 3) / Math.max(dist, 1e-4));
      _want.sub(this.velocity);
      const maxDv = WISP_FX.accel * step;
      if (_want.length() > maxDv) _want.setLength(maxDv);
      this.velocity.add(_want);
      pos.addScaledVector(this.velocity, step);
      // a gentle sway so it floats rather than flies
      pos.y += Math.sin(this.age * 6 + this.phase) * 0.35 * step;
    }

    const pulse = 1 + Math.sin(this.age * 7 + this.phase) * 0.08;
    const s = WISP_FX.size * pulse * (0.4 + 0.6 * this.fade);
    this.core.scale.setScalar(s);
    this.halo.scale.setScalar(s * 3.6);
    this.materials[0].opacity = this.fade;
    this.materials[1].opacity = 0.55 * this.fade;

    this.trailIn -= step;
    if (this.trailIn <= 0) {
      this.trailIn = WISP_FX.trailEvery;
      this.fx.glows.spawn((p) => {
        p.pos.copy(pos);
        p.life = 0.75;
        p.size0 = s * 1.5;
        p.size1 = 0.03;
        p.color.set(FX_COLORS.violetSoft);
        p.intensity = 1.1;
        p.alpha = 0.5 * this.fade;
        p.fadeFrom = 0;
      });
    }
  }

  onRemoved() {
    this.materials.forEach((m) => m.dispose()); // the glow texture is shared
  }
}
