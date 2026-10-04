import type { SceneDef } from './GameScene';

/** Every `*.scene.ts` file under src/ is auto-registered. No central list to edit. */
const modules = import.meta.glob<{ default: SceneDef }>('/src/**/*.scene.ts', { eager: true });

export const SCENES = new Map<string, SceneDef>();
for (const [path, mod] of Object.entries(modules)) {
  const def = mod.default;
  if (!def?.id) {
    console.warn(`[scenes] ${path} has no default defineScene() export`);
    continue;
  }
  if (SCENES.has(def.id)) console.warn(`[scenes] duplicate scene id "${def.id}" in ${path}`);
  SCENES.set(def.id, def);
}

/** Scene opened when no ?scene= is given. Narrative owner switches this to the real game flow. */
export const DEFAULT_SCENE = SCENES.has('game') ? 'game' : 'playground';
