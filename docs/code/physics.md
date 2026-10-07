# physics.js

Pure functions for moving the player in the air. No Phaser, no state of its own. The game, the aim preview and [verify-tower](scripts.md) all use these same functions, which is what makes the verifier's results match the real game.

## Exports

| Export | What it does |
|---|---|
| `MIN_X`, `MAX_X` | The range the player's center can be in: inside the walls by one radius. |
| `integrate(b, dt)` | One free-flight step for any body `{ x, y, vx, vy }`. Returns `-1` / `1` if it bounced off the left / right wall this step, else `0`. |
| `substeps(b, dt)` | How many substeps a step of `dt` needs so the body moves at most 8 px per substep. |
| `launchSpeed(power)` | Launch speed for a drag power 0–1: `MIN_LAUNCH + (MAX_LAUNCH − MIN_LAUNCH) × power`. |
| `previewPath(x, y, aim, out)` | Fills `out` with `[x0, y0, x1, y1, …]`: points along the first ~0.27 s of a launch, every 4th step. Stops at the first wall bounce, so bounces are never shown. |

## `integrate`

Semi-implicit Euler:

1. `vy += GRAVITY × dt`, capped at `MAX_FALL`.
2. `x += vx × dt`, `y += vy × dt`.
3. If `x` is past a wall: clamp it, and if moving into the wall, reflect `vx × WALL_BOUNCE` and return the side.

It doesn't know about platforms. Landing is checked by the caller after each substep.

## Why substeps

At bounce speeds (up to 2300 px/s) one 1/120 s step moves about 19 px. `substeps` splits a step so no substep moves more than 8 px. The game checks walls and landings after every substep. The landing check looks for the player's bottom *crossing* a platform's top, so it would work with big steps too; the substeps mostly keep wall bounces and landing positions precise, and keep the game and the verifier stepping identically.

Funnels, portals, hazards and pickups are checked once per full step (after the substeps), not per substep. At 19 px per step that's still well inside their sizes (the smallest is a star, 30 px pickup radius).

Substeps came in with solid platforms, which needed small moves to avoid passing through a block. Those are gone, but the stepping stayed.

**If you change the flight loop in `GameScene.stepSim`, change it the same way in `verify-tower.mjs`**, or the verifier stops proving what the game does.
