import * as THREE from 'three';
import type { Palette } from './palette';

/**
 * Default lights for a gameplay scene: sky/ground fill + one shadow-casting key light
 * that follows the action. Colours come from the live palette every frame.
 */
export class StageLighting {
  readonly hemi: THREE.HemisphereLight;
  readonly key: THREE.DirectionalLight;
  private keyOffset = new THREE.Vector3(-8, 16, 6);

  constructor(scene: THREE.Scene) {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(this.hemi);

    this.key = new THREE.DirectionalLight(0xffffff, 3);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    const s = 18;
    Object.assign(this.key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 60 });
    this.key.shadow.bias = -0.0005;
    this.key.shadow.normalBias = 0.03;
    scene.add(this.key, this.key.target);
  }

  /** Keep the shadow frustum centred on `focus` (usually the player). */
  update(palette: Palette, scene: THREE.Scene, focus: THREE.Vector3) {
    this.hemi.color.copy(palette.skyLight);
    this.hemi.groundColor.copy(palette.groundLight);
    this.hemi.intensity = palette.ambientIntensity;
    this.key.color.copy(palette.keyLight);
    this.key.intensity = palette.keyIntensity;
    this.key.position.copy(focus).add(this.keyOffset);
    this.key.target.position.copy(focus);

    if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color();
    (scene.background as THREE.Color).copy(palette.background);
    if (!scene.fog) scene.fog = new THREE.Fog(palette.fog, 30, 70);
    scene.fog.color.copy(palette.fog);
  }
}
