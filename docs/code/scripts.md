# scripts/

Two Node tools. Both import the game's own modules, which is why `config.js`, `rng.js`, `physics.js`, `tower.js` and `palettes.js` must stay free of Phaser and the DOM.

## verify-tower.mjs: `npm run verify [YYYY-MM-DD …]`

Proves the generator still makes a climbable, deterministic tower. Without dates it checks four fixed days. It exits with code 1 on any failure, and the GitHub Pages deploy runs it before building.

For each day:

1. **Determinism.** It builds the tower twice up to 1600 m (`TARGET_M`) and compares every platform's position, width and type.
2. **Main path.** It collects the main-path platforms in order: the ground, both tutorial bars, then each `lastMain` from `step()` (it wraps `step` to record them).
3. **Reachability.** For each consecutive pair (`from` → `to`):
   - **Single jump:** from 3 start points on `from` (just the middle for full-width platforms), tries 45 angles × 11 powers. It simulates with the game's own `integrate` and `substeps` at 1/120 s, and succeeds if the body lands on `to` without touching a hazard.
   - **Double jump:** if no single jump works, it tries a full-power jump at 7 angles, stops at the top of the arc, and runs the single-jump search again from there.
   - **Hazards:** saws count as their whole sweep, which is stricter than the game.
   - **Moving targets** are skipped, because whether you land depends on timing.
4. **Output.** It prints counts per day: platform types, hearts, stars, funnels, portals, hazards, and how many gaps were single / double / skipped. Every unreachable platform is listed with its id and height.

**What it doesn't check:** funnels, portals, stars, bouncy launches and side ledges. They're optional extras, and the main path never needs them.

**Keep it in sync.** The flight loop in `lands()` must match `GameScene.stepSim`: same substeps, landing rule and hazard shapes. If you change one, change the other.

## palette-preview.mjs: `npm run palettes`

Renders every family in [palettes.js](palettes.md) to a PNG in `palette-preview/` (git-ignored).

How it works:

1. For each family, it writes an HTML page with one 300×540 canvas per section. The page's script draws a mock game screen with every object: player (blue aiming with the arrow, red in the air), platforms, bouncy platform, the door in the next section's color, funnel, both portals with particles, star, heart, spike and HUD. Section name and hex values go at the bottom.
2. It screenshots the page with headless Chrome (or Edge) via `--screenshot`.

It looks for Chrome or Edge at the usual Windows, Linux and macOS paths. The drawing code in the page copies the shapes in [draw.js](draw.md) by hand. If you change how something looks in the game, update the preview too, or the screenshots will lie.
