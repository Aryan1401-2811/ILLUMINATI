# Character models — the catalogue everyone reads

Owner: **Visuals & World**. Ask me before changing anything in `public/models/`.

All characters are **CC0** models by Kay Lousberg (KayKit), stripped down to the meshes and clips
we use and recoloured to our palette (see `CREDITS.md`). They share one rig, so **every clip name
below is spelled the same on every character**.

| Character | Path (for `CharacterModel.load`) | Height | Size | Look |
|---|---|---|---|---|
| Hero | `models/hero/hero.glb` | `1.8` | 1.3 MB | Knight: helmet, cape, one-handed sword |
| Grunt (Shade) | `models/enemies/grunt.glb` | `1.35` | 1.0 MB | Small soft-lavender Shade, glowing eyes |
| Brute (Shade) | `models/enemies/brute.glb` | `2.6` | 1.2 MB | Big horned Shade, deeper violet |
| Warden | `models/bosses/warden.glb` | `3.2` | 1.1 MB | Silver-indigo stone guardian with a round shield |
| Narrator | `models/bosses/narrator.glb` | `2.9` | 1.1 MB | Paper-and-ink figure with gold trim, wide hat, open book |
| Soul | *(no file)* `import { Soul } from '@/vfx/Soul'` | ~0.42 | — | Code-built floating spirit |

**Facing:** every model faces **+Z** (same as the placeholder robot), so `yawOffset` is not needed.
**Tint:** none needed — the colours are baked into the textures. Use `tint` only for variants
(for example a gold-corrupted Shade: `tint: '#ffd27a'`).
**Root motion:** none. All clips play in place; move the entity yourself.
**Outline:** `outlineWidth: 3` for normal characters, `4` for the Warden and the Narrator.

```ts
const model = await CharacterModel.load('models/enemies/grunt.glb', { height: 1.35 });
this.object.add(model.root);
model.play('Idle_Combat');
model.play('Unarmed_Melee_Attack_Punch_A', { loop: false, restart: true });
model.update(dt); // every frame
```

See them all, with every clip, at **`?scene=visuals&view=models&debug`** (`[` and `]` cycle clips).

## Clip names (exact spelling) and length in seconds

### Hero — `models/hero/hero.glb`
| Use | Clip | Sec |
|---|---|---|
| idle | `Idle` | 1.07 |
| run | `Running_A` (alt `Running_B`) | 0.80 |
| walk | `Walking_A` | 1.07 |
| attack 1 | `1H_Melee_Attack_Slice_Diagonal` | 1.00 |
| attack 2 | `1H_Melee_Attack_Slice_Horizontal` | 1.07 |
| attack 3 (heavy finisher) | `1H_Melee_Attack_Chop` | 1.07 |
| extra attack | `1H_Melee_Attack_Stab` | 1.60 |
| dodge / roll | `Dodge_Forward` (also `Dodge_Backward`, `Dodge_Left`, `Dodge_Right`) | 0.40 |
| hit | `Hit_A`, `Hit_B` | 0.67 / 0.87 |
| death | `Death_A` (fast) or `Death_B` (long) | 0.80 / 2.63 |
| cast | `Spellcast_Shoot` (quick), `Spellcast_Raise`, `Spellcast_Long`, `Spellcasting` (loop) | 0.93 |
| victory | `Cheer` | 1.67 |
| write the last caption | `Interact` or `Use_Item` | 1.30 / 1.60 |
| knocked down / get up | `Lie_Down`, `Lie_Idle`, `Lie_StandUp` | 3.00 |
| other | `Unarmed_Idle`, `PickUp`, `Jump_Full_Short` | |

**For Foundation (Amey)** — swap `HERO_MODEL` in `src/player/Player.ts` to:
```ts
export const HERO_MODEL = {
  path: 'models/hero/hero.glb',
  height: 1.8,
  anims: { idle: 'Idle', run: 'Running_A', attack: '1H_Melee_Attack_Slice_Diagonal', dodge: 'Dodge_Forward',
           cast: 'Spellcast_Shoot', death: 'Death_A', victory: 'Cheer', walk: 'Walking_A' },
};
```

### Grunt — `models/enemies/grunt.glb`
| Use | Clip | Sec |
|---|---|---|
| idle | `Idle_Combat` (wary, long) or `Idle` | 4.27 / 1.07 |
| run | `Running_A` (alt `Running_B`) | 0.80 |
| walk | `Walking_A` | 1.07 |
| attack | `Unarmed_Melee_Attack_Punch_A`, `Unarmed_Melee_Attack_Punch_B`, `1H_Melee_Attack_Chop` | 1.47 |
| hit | `Hit_A`, `Hit_B` | 0.67 |
| death | `Death_A`, `Death_B`, `Death_C_Skeletons` (falls apart) | 0.80 |
| block / hesitate (story clue!) | `Block` (raise), `Blocking` (hold loop), `Block_Hit` | 1.07 |
| spawn | `Spawn_Ground` | 1.30 |
| other | `Taunt`, `Dodge_Backward` | |

### Brute — `models/enemies/brute.glb`
| Use | Clip | Sec |
|---|---|---|
| idle | `Idle_Combat` or `Idle` | 4.27 / 1.07 |
| walk | `Walking_B` (heavy) or `Walking_A`; `Running_A` if it must run | 1.07 |
| slam | `2H_Melee_Attack_Chop` | 1.63 |
| other attacks | `2H_Melee_Attack_Slice`, `2H_Melee_Attack_Spin`, `1H_Melee_Attack_Jump_Chop`, `Unarmed_Melee_Attack_Kick` | |
| hit | `Hit_A`, `Hit_B` | 0.67 / 0.87 |
| death | `Death_B` (long), `Death_A`, `Death_C_Skeletons` | 2.63 |
| block | `Block`, `Blocking`, `Block_Hit` | 1.07 |
| spawn / roar | `Spawn_Ground`, `Taunt`, `Taunt_Longer` | |

### Warden — `models/bosses/warden.glb`
| Use | Clip | Sec |
|---|---|---|
| idle | `Idle` | 1.07 |
| walk | `Walking_B` (heavy) or `Walking_A` | 1.07 |
| block (his main stance) | `Block` (raise), `Blocking` (hold loop), `Block_Hit` (takes a hit on the shield) | 1.07 |
| bash | `Block_Attack` (shield bash) | 1.07 |
| other attacks | `1H_Melee_Attack_Chop`, `1H_Melee_Attack_Slice_Horizontal`, `Unarmed_Melee_Attack_Kick` | |
| hit | `Hit_A`, `Hit_B` | |
| kneel (defeated) | `Sit_Floor_Down` → hold `Sit_Floor_Idle` (→ `Sit_Floor_StandUp`) | 1.00 |
| pass on the true light | `Spellcast_Raise` or `Interact` | 2.10 |
| death | `Death_B` (slow, dignified) or `Lie_Down` → `Lie_Idle` | 2.63 |

### Narrator — `models/bosses/narrator.glb`
| Use | Clip | Sec |
|---|---|---|
| idle | `Idle` | 1.07 |
| float (lift the entity ~0.6 m and loop this) | `Jump_Idle` | 1.07 |
| cast | `Spellcast_Shoot` (quick), `Spellcast_Raise`, `Spellcast_Long` (big), `Spellcasting` (loop) | 0.93 |
| throw / summon | `Throw`, `2H_Melee_Attack_Spin` | |
| step out of the page | `Jump_Full_Long` | 2.33 |
| gloat | `Cheer` | 1.67 |
| hit | `Hit_A`, `Hit_B` | |
| death | `Death_B` (long) or `Death_A`, then `Lie_Idle` | 2.63 |
| other | `Walking_A`, `Running_A`, `Dodge_Backward`, `Interact`, `Use_Item`, `Unarmed_Idle` | |

### Soul — code, not a file
```ts
import { Soul } from '@/vfx/Soul';
const soul = scene.add(new Soul());                 // violet (free)
scene.add(new Soul({ color: '#ffc21a', size: 0.5 })); // still trapped in gold
soul.position.set(x, 0, z);                         // it hovers and bobs by itself
```

## Adding or changing a model
1. CC0 / CC-BY / AI-generated only. Never paid. Add the `CREDITS.md` row in the same commit.
2. Keep each `.glb` under 5 MB. Do **not** use Draco or Meshopt compression — our loader has no decoder.
3. Check it in `?scene=visuals&view=models`, then add it to this file.
