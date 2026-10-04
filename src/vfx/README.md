# Visuals: how to use it (owner: Visuals & World)

Everything here is driven by events. **You never call the VFX code** — a `VfxDirector` is added to
every scene automatically (see `install.ts`). Emit the normal game events and the page reacts.

| You emit | You get |
|---|---|
| `scene.combat.applyHit(...)` → `combat:hit` | Sparks, ink, a comic word. `THWACK!` light, `WHAM!` heavy, `ZAP!` energy, `CLANG!` shell hit, `SHATTER!` shell broken, `PING!` deflected, `TINK!` blocked, `KO!` kill, `OOF!` when the hero is hurt |
| `enemy:killed` `{ position, wisp }` | Ink burst and dissolve. With `wisp: true`, a violet wisp drifts to the caption box (top-right) |
| `armour:shellBroken` / `armour:coreBroken` | Shards burst |
| `fx:onomatopoeia` `{ text, position, color?, scale? }` | Any word you like. `scale >= 1.5` adds a starburst |
| `palette:set` `{ mode: 'violet', durationSec }` | The twist flip: negative frame, shock ring, halftone wipe, shake, torn paper |
| `player:dodge` | Afterimages (automatic) |
| *(energy bar full)* | A ring of light at the hero's feet (automatic) |

**Events I emit:** `fx:wispAbsorbed { position }` when a wisp reaches the caption box — UI can pulse the box.

## Things you call directly

```ts
import { startCollapse } from '@/vfx/Collapse';
const collapse = startCollapse(scene);                 // the twist: cracks, falling panels, paper, rumble (7 s)
startCollapse(scene, { center: warden.position, durationSec: 5, radius: 14 });
await collapse.finished;                               // optional
collapse.stop();                                       // optional

import { Soul } from '@/vfx/Soul';
scene.add(new Soul()).position.set(x, 0, z);            // freed soul (violet). { color: '#ffc21a' } = trapped

import { Shockwave } from '@/vfx/Shockwave';            // scene.add(new Shockwave(pos, radius, color))
import { SlashArc } from '@/vfx/SlashArc';
```

`VfxDirector.of(scene)?.ambient.density = 0` turns the ambient particles off (for a cutscene); `1` is normal.

## Arenas

```ts
import { buildZone1, buildZone2, buildZone3, buildWardenArena, buildFinalArena } from '@/world/zones';
const { playerSpawn, enemySpawns, exit } = buildZone1(this);   // inside your scene's load()
```
Each builder adds meshes + collision. In the boss arenas `enemySpawns[0]` is where the boss stands.
The final arena is meant for the **violet** palette.

## Sandbox

`?scene=visuals&view=zone1|zone2|zone3|warden|final|models&debug`
`T` flip palette · `C` collapse · `X` whole twist · `[` `]` cycle clips (models view)

## Tuning

All effect numbers are in `src/vfx/config.ts`. The look (halftone, grain, border, palettes) is in
`src/render/ComicEffect.ts` and `src/render/palette.ts`.
