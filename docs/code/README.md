# Code documentation

One page per source file: what it does, what it exports, how it works inside, and what to watch out for when you change it. These pages describe the code as it is now; where they disagree with [SYSTEM_DESIGN.md](../SYSTEM_DESIGN.md), these pages are right (see [Known gaps](#known-gaps-in-the-older-docs)).

## Files

| File | Page | In one line |
|---|---|---|
| `src/main.js` | [main.md](main.md) | Creates the Phaser game. |
| `src/config.js` | [config.md](config.md) | Every tuning constant, plus screen size and render resolution. |
| `src/GameScene.js` | [GameScene.md](GameScene.md) | The game: input, fixed-step simulation, player state, pickups, doors, camera, saving. |
| `src/tower.js` | [tower.md](tower.md) | The day's tower: deterministic generation, spatial index, door heights. |
| `src/physics.js` | [physics.md](physics.md) | Free flight, substeps, launch speed, aim preview path. |
| `src/draw.js` | [draw.md](draw.md) | Draws the whole world every frame (immediate mode). |
| `src/palettes.js` | [palettes.md](palettes.md) | Color families and how a palette is built for a section. |
| `src/ui.js` | [ui.md](ui.md) | HUD, banners, pause menu. |
| `src/save.js` | [save.md](save.md) | `localStorage` save with daily rollover. |
| `src/audio.js` | [audio.md](audio.md) | Synthesized sound effects and vibration. |
| `src/rng.js` | [rng.md](rng.md) | Seeded RNG, hashes, noise, date helpers. |
| `scripts/*.mjs` | [scripts.md](scripts.md) | `npm run verify` (tower check) and `npm run palettes` (palette screenshots). |

## How the pieces fit

```
main.js ──► GameScene (one Phaser scene, owns all state)
              │
              ├─ tower.js ──── generates platforms, hazards, items on demand
              │    └─ uses rng.js (seed, noise), config.js
              ├─ physics.js ── moves the player in flight (pure functions)
              ├─ draw.js ───── redraws everything each frame from scene state
              │    └─ palettes.js (colors)
              ├─ ui.js ─────── HUD and pause menu (reads scene state)
              ├─ save.js ───── load at start, store on landing / hide / menu
              └─ audio.js ──── sfx.* and buzz()

scripts/verify-tower.mjs    runs tower.js + physics.js in Node (no Phaser)
scripts/palette-preview.mjs renders palettes.js to PNGs with headless Chrome
```

Dependencies point one way. `config.js`, `rng.js`, `physics.js`, `tower.js` and `palettes.js` never import Phaser or touch the DOM, so Node can run them. Keep it that way: the verification script depends on it.

## Conventions used everywhere

- **Units.** Logical pixels. The playfield is `W = 540` wide; `H` depends on the screen (900–1200). **40 px = 1 m** (`PX_PER_M`).
- **World y points down.** The ground is at `y = 0` and the tower rises into negative y. Height in meters is `-y / 40`.
- **Two clocks.**
  - **Sim time** (`scene.simT`) only advances while unpaused, slows during aiming, and runs in fixed 1/120 s steps. Gameplay timers use it: crumble, heart life, star respawn, warp, animations.
  - **Real time** (`scene.time.now`) is used for the palette fade and save debounce.
- **Colors** are `0xRRGGBB` numbers. `hex()` in `draw.js` turns one into a CSS string.
- **Scratch arrays.** Grid queries fill an array you pass in (`tower.platformsIn(y0, y1, out)`) instead of allocating. The scene keeps one per use (`near`, `drawPlats`, `nearItems`…). Don't share one array between two queries that are alive at the same time.
- **Dev-only URL options** (only with `npm run dev`): `?at=300` starts on the platform nearest 300 m.

## Common tasks

| I want to… | Look at |
|---|---|
| Tune a number (gravity, HP, heart odds, start heights…) | [config.md](config.md) |
| Change what appears in the tower, or where | [tower.md → step()](tower.md#step-one-main-platform-per-call) |
| Add a new pickup or object | [tower.md → Adding a new kind of object](tower.md#adding-a-new-kind-of-object), then [GameScene.md](GameScene.md#adding-a-new-pickup) and [draw.md](draw.md) |
| Change colors | [palettes.md](palettes.md), then `npm run palettes` |
| Change how something looks | [draw.md](draw.md) |
| Change the HUD or pause menu | [ui.md](ui.md) |
| Make sure the tower is still climbable | `npm run verify` ([scripts.md](scripts.md)) |

## Known gaps in the older docs

[SYSTEM_DESIGN.md](../SYSTEM_DESIGN.md) and [GDD.md](../GDD.md) were written before many changes and still describe some old behavior. Some examples:

- They describe a charge refill timer; there isn't one any more. Only landing refills, and stars add one jump.
- They say the position is saved; it isn't. Every page load starts at 0 m.
- They describe a title card; the game now starts straight into the tutorial bars.
- They say the palette is HSL drifting with height; colors now come per section from [palettes.js](../../src/palettes.js).
- They don't cover HP, hearts, stars, funnels, portals, bouncy-platform heights, or the per-feature start heights.
