import GUI from 'lil-gui';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import type { Game } from './Game';
import { SCENES } from './sceneRegistry';
import { CAMERA, FEEL, PLAYER } from './config';
import { events } from './events';

/** Debug panel + FPS meter. Open the game with ?debug to show it. */
export function setupDebug(game: Game) {
  if (!new URLSearchParams(location.search).has('debug')) return;

  const stats = new Stats();
  stats.dom.style.left = 'auto';
  stats.dom.style.right = '0px';
  stats.dom.style.top = 'auto';
  stats.dom.style.bottom = '0px';
  document.body.appendChild(stats.dom);
  game.onFrame(() => stats.update());

  const gui = new GUI({ title: 'False Dawn debug' });

  const sceneState = { scene: game.currentId || [...SCENES.keys()][0] };
  gui
    .add(sceneState, 'scene', [...SCENES.keys()])
    .name('scene')
    .onChange((id: string) => {
      const url = new URL(location.href);
      url.searchParams.set('scene', id);
      location.href = url.toString();
    });

  const pal = gui.addFolder('Palette (twist)');
  pal.add({ gold: () => events.emit('palette:set', { mode: 'gold', durationSec: 1.5 }) }, 'gold').name('→ gold (lie)');
  pal.add({ violet: () => events.emit('palette:set', { mode: 'violet', durationSec: 1.5 }) }, 'violet').name('→ violet (truth)');

  const post = gui.addFolder('Post FX').close();
  const comic = game.renderer.comic;
  post.add(comic.uniform('dotSize'), 'value', 2, 14, 0.5).name('halftone dot size');
  post.add(comic.uniform('halftoneStrength'), 'value', 0, 1, 0.01).name('halftone strength');
  post.add(comic.uniform('paperStrength'), 'value', 0, 0.15, 0.005).name('paper grain');
  post.add(comic.uniform('vignette'), 'value', 0, 2, 0.05).name('vignette');
  post.add(game.renderer.bloom, 'intensity', 0, 4, 0.05).name('bloom intensity');
  post.add(game.renderer.bloom.luminanceMaterial, 'threshold', 0, 1.5, 0.01).name('bloom threshold');

  const player = gui.addFolder('Player').close();
  player.add(PLAYER, 'moveSpeed', 2, 14, 0.1);
  player.add(PLAYER.dodge, 'speed', 5, 30, 0.5).name('dodge speed');
  player.add(PLAYER.dodge, 'duration', 0.05, 0.6, 0.01).name('dodge duration');
  player.add(PLAYER.dodge, 'cooldown', 0, 2, 0.05).name('dodge cooldown');
  player.add(PLAYER, 'comboWindow', 0.1, 1.5, 0.05);

  const feel = gui.addFolder('Feel').close();
  feel.add(FEEL, 'hitstopLight', 0, 0.2, 0.005);
  feel.add(FEEL, 'hitstopHeavy', 0, 0.3, 0.005);
  feel.add(FEEL, 'shakeLight', 0, 1, 0.01);
  feel.add(FEEL, 'shakeHeavy', 0, 1, 0.01);

  const cam = gui.addFolder('Camera').close();
  const rig = () => game.current?.cameraRig;
  cam.add(CAMERA.offset, 'y', 4, 30, 0.5).name('height').onChange(() => rig()?.resetOffset(0));
  cam.add(CAMERA.offset, 'z', 2, 30, 0.5).name('distance').onChange(() => rig()?.resetOffset(0));
  cam
    .add(CAMERA, 'fov', 20, 80, 1)
    .onChange((v: number) => {
      game.camera.fov = v;
      game.camera.updateProjectionMatrix();
    });
}
