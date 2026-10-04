import { events } from '@/core/events';
import { getGame } from '@/core/Game';
import { VfxDirector } from './VfxDirector';

let installed = false;

/**
 * Puts a VfxDirector into every scene as soon as it has loaded, so effects work everywhere
 * (playground, other people's sandboxes, the real zones) without anyone wiring them up.
 *
 * This module is imported by `src/vfx/sandbox/Visuals.scene.ts`. Every `*.scene.ts` file is
 * bundled eagerly by the scene registry, so the install runs once at boot in every build.
 */
export function installVfx(): void {
  if (installed) return;
  installed = true;
  events.on('scene:loaded', () => {
    const scene = getGame().current;
    if (scene && !VfxDirector.of(scene)) scene.add(new VfxDirector());
  });
}

installVfx();
