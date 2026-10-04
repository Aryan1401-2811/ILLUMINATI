import * as THREE from 'three';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import { ComicEffect } from './ComicEffect';
import { outlineResolution } from './toon';
import type { Palette } from './palette';

/**
 * WebGL renderer + post-processing chain:
 *   scene → bloom (glowing energy) → tone mapping → comic print (halftone/grain/vignette)
 */
export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly composer: EffectComposer;
  readonly bloom: BloomEffect;
  readonly comic: ComicEffect;
  private renderPass: RenderPass;
  private size = new THREE.Vector2();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      powerPreference: 'high-performance',
      antialias: false,
      stencil: false,
      depth: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;

    const samples = Math.min(4, this.renderer.capabilities.maxSamples);
    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: samples });
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);

    this.bloom = new BloomEffect({
      intensity: 1.4,
      luminanceThreshold: 0.85,
      luminanceSmoothing: 0.2,
      mipmapBlur: true,
      radius: 0.7,
    });
    const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    this.comic = new ComicEffect();
    this.composer.addPass(new EffectPass(new THREE.PerspectiveCamera(), this.bloom, toneMapping));
    this.composer.addPass(new EffectPass(new THREE.PerspectiveCamera(), this.comic));

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.renderer.getDrawingBufferSize(this.size);
    outlineResolution.value.copy(this.size);
  }

  get aspect() {
    return window.innerWidth / window.innerHeight;
  }

  /** Apply the live palette to post effects (called every frame). */
  applyPalette(p: Palette) {
    this.comic.uniform<THREE.Color>('inkTint').value.copy(p.inkTint);
    this.comic.uniform<number>('saturation').value = p.saturation;
  }

  render(scene: THREE.Scene, camera: THREE.Camera, dt: number) {
    this.renderPass.mainScene = scene;
    this.renderPass.mainCamera = camera;
    for (const pass of this.composer.passes) pass.mainCamera = camera;
    this.composer.render(dt);
  }
}
