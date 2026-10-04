import './styles.css';
import { Game } from '@/core/Game';
import { DEFAULT_SCENE, SCENES } from '@/core/sceneRegistry';
import { setupDebug } from '@/core/debug';
import { Hud } from '@/ui/Hud';
import { CaptionBox } from '@/narrative/CaptionBox';
import { installAudio } from '@/audio/install';

async function boot() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui-root')!;
  const loading = document.getElementById('loading')!;

  const game = new Game(canvas, uiRoot);
  new Hud(uiRoot);
  new CaptionBox(uiRoot);
  installAudio();
  // Dev only: inspect from the browser console, e.g. game.current.getFirst(...)
  if (import.meta.env.DEV) (window as any).game = game;

  const requested = new URLSearchParams(location.search).get('scene');
  const sceneId = requested && SCENES.has(requested) ? requested : DEFAULT_SCENE;
  try {
    await game.loadScene(sceneId);
  } catch (err) {
    loading.textContent = `Failed to load scene "${sceneId}": ${(err as Error).message}`;
    throw err;
  }
  setupDebug(game);
  loading.remove();
  game.start();
}

boot();
