# FALSE DAWN

*A comic-book action game where the light was never on your side.*

**Play it:** https://amey-op.itch.io/false-dawn — _coming soon_
**Latest dev build:** GitHub Pages — _enabled once Pages is switched on (Settings → Pages → Source: GitHub Actions)_

Themes: **Comic · Twist · Light** — Team **Illuminati**

---

## Controls

| Action | Keyboard / mouse |
|---|---|
| Move | `W A S D` / arrow keys |
| Aim | Mouse |
| Attack (3-hit combo, 3rd hit is a heavy finisher) | Left mouse / `J` |
| Dodge (brief invulnerability) | `Space` / `Shift` |
| Ability 1 | `Q` / right mouse |
| Ability 2 | `E` |
| Ability 3 | `R` |
| Pause | `Esc` |

## Run it locally

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check + production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Type-check only |

**Useful URL options**

- `?scene=<id>` — open a specific scene (e.g. `?scene=playground`)
- `?debug` — debug panel (scene picker, palette flip, post-FX, tuning) + FPS meter

## Tech

- **[three.js](https://threejs.org)** (WebGL) + **TypeScript** + **Vite**
- **postprocessing** for bloom, tone mapping and a custom comic-print pass (halftone, paper grain, vignette)
- Toon shading + inverted-hull ink outlines for the comic look
- No game engine editor: the whole game is code, built to the `dist/` folder and uploaded to itch.io as HTML5

## Project structure

```
src/
  core/       game loop, events bus, input, time (hit-stop), scenes, assets, config, debug   [Foundation]
  player/     hero controller, combo, dodge, energy, abilities                              [Foundation]
  combat/     hit/hurtbox types, combat queries, projectiles                                [Foundation]
  camera/     comic-panel follow camera + shake                                             [Foundation]
  render/     renderer, post-FX, toon materials, outlines, palette (gold ↔ violet)          [Foundation → Visuals]
  enemies/    Grunts, Brutes, two-layer armour                                               [Enemies]
  bosses/     the Warden, the Narrator                                                       [Bosses]
  sequences/  scripted moments: the twist, collapse, ending                                  [Bosses]
  world/      arenas, props, collision                                                       [Visuals]
  vfx/        particles, slashes, impact text, wisps                                         [Visuals]
  narrative/  narrator caption box, dialogue, story flow                                     [Narrative]
  ui/         HUD, menus                                                                     [Narrative]
  audio/      music + sound effects                                                          [Narrative]
public/       models, textures, audio files (served as-is)
```

How the pieces talk:
- **Events** (`src/core/events.ts`) — modules never reach into each other; they `events.emit(...)` and `events.on(...)`.
- **Scenes** — any file named `*.scene.ts` is auto-registered and opened with `?scene=<id>`.
- **Abilities** — any file named `*.ability.ts` is auto-registered and given to the player with `player.setLoadout([...])`.

## Team

| Member | Role |
|---|---|
| _name_ | Foundation & Player |
| _name_ | Enemies & Armour |
| _name_ | Bosses & Twist |
| _name_ | Visuals & World |
| _name_ | Narrative, UI, Audio & Release |

## Credits & AI disclosure

See [CREDITS.md](CREDITS.md). Code is written with AI assistance (Claude); all design and direction are the team's.

## License

[MIT](LICENSE)
