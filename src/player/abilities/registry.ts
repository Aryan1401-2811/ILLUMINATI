import type { Ability, AbilityDef } from './Ability';

/** Every `*.ability.ts` file under src/ is auto-registered by its id. */
const modules = import.meta.glob<{ default: AbilityDef }>('/src/**/*.ability.ts', { eager: true });

const ABILITIES = new Map<string, AbilityDef>();
for (const [path, mod] of Object.entries(modules)) {
  const def = mod.default;
  if (!def?.id) {
    console.warn(`[abilities] ${path} has no default defineAbility() export`);
    continue;
  }
  ABILITIES.set(def.id, def);
}

export function createAbility(id: string): Ability {
  const def = ABILITIES.get(id);
  if (!def) throw new Error(`Unknown ability "${id}". Known: ${[...ABILITIES.keys()].join(', ')}`);
  return def.create();
}

export function abilityIds(): string[] {
  return [...ABILITIES.keys()];
}
