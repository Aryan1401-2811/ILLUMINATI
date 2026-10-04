import * as THREE from 'three';
import { GameRenderer } from '@/render/GameRenderer';
import { PaletteController } from '@/render/palette';
import { CAMERA } from './config';
import { events } from './events';
import { input } from './input';
import { time } from './time';
import type { GameScene } from './GameScene';
import { SCENES } from './sceneRegistry';

/**
 * Owns the renderer, camera, palette and the current scene, and runs the frame loop.
 * Access it anywhere with getGame().
 */
export class Game {
  readonly renderer: GameRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly palette = new PaletteController('gold');
  readonly uiRoot: HTMLElement;
  current: GameScene | null = null;
  currentId = '';
  private clock = new THREE.Clock();
  private loading = false;
  private frameHooks = new Set<(dt: number, realDt: number) => void>();

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.uiRoot = uiRoot;
    this.renderer = new GameRenderer(canvas);
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, this.renderer.aspect, 0.1, 200);
    window.addEventListener('resize', () => {
      this.camera.aspect = this.renderer.aspect;
      this.camera.updateProjectionMatrix();
    });
    input.attach(canvas);
    events.on('palette:set', ({ mode, durationSec }) => this.palette.blendTo(mode, durationSec ?? 1.5));
    _game = this;
  }

  /** Unload the current scene and load another by id. */
  async loadScene(id: string): Promise<void> {
    const def = SCENES.get(id);
    if (!def) throw new Error(`Unknown scene "${id}". Known: ${[...SCENES.keys()].join(', ')}`);
    this.loading = true;
    this.current?.dispose();
    this.current = null;
    const scene = def.create(this);
    await scene.load();
    this.current = scene;
    this.currentId = id;
    this.loading = false;
    this.clock.getDelta();
    events.emit('scene:loaded', { sceneId: id });
  }

  /** Run something every frame (UI, debug). Returns an unsubscribe. */
  onFrame(fn: (dt: number, realDt: number) => void): () => void {
    this.frameHooks.add(fn);
    return () => this.frameHooks.delete(fn);
  }

  start() {
    this.renderer.renderer.setAnimationLoop(() => this.frame());
  }

  /**
   * Dev/testing: run the simulation for `seconds` at a fixed 60 fps without waiting for
   * the browser (works even when the tab is hidden). Renders the last frame.
   *   await game.advance(0.5)
   */
  advance(seconds: number, fps = 60) {
    const steps = Math.max(1, Math.round(seconds * fps));
    for (let i = 0; i < steps; i++) this.step(1 / fps, i === steps - 1);
  }

  private frame() {
    this.step(Math.min(this.clock.getDelta(), 1 / 20), true);
  }

  private step(realDt: number, render: boolean) {
    const dt = time.tick(realDt);
    this.palette.update(realDt);
    this.renderer.applyPalette(this.palette.current);
    if (this.current && !this.loading) {
      this.current.update(dt, realDt);
      for (const fn of this.frameHooks) fn(dt, realDt);
      if (render) this.renderer.render(this.current.three, this.camera, realDt);
    }
    input.endFrame();
  }
}

let _game: Game | null = null;

export function getGame(): Game {
  if (!_game) throw new Error('Game not created yet');
  return _game;
}
