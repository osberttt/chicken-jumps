# GameScene.js

The game itself. One Phaser scene that owns all runtime state: the player, the tower, input, the simulation, pickups, doors, the camera, effects and saving. Drawing is delegated to [draw.js](draw.md) and the HUD/menu to [ui.js](ui.md).

## State

Set up in `create()`.

### Scene

| Field | Meaning |
|---|---|
| `day` | Today's date key (`YYYY-MM-DD`, local time). |
| `save` | The save object from [save.js](save.md): best, stats, history, mute. |
| `tower` | The day's [Tower](tower.md). |
| `simT` | Sim time in seconds. Only advances in `stepSim`. |
| `runT` | Real seconds since this run began. Advances while unpaused, unaffected by slow motion, reset by `respawn()`. Shown as the HUD timer. |
| `acc` | Fixed-step accumulator. |
| `timeScale` | Current time scale (1 normally, down to `SLOWMO` while aiming). |
| `paused` | Pause menu open. |
| `drag` | `{ sx, sy, x, y, t }` while a finger/mouse is down: start point, current point, seconds aimed. `null` otherwise. |
| `height` | Current height in meters. |
| `nextDoor` | Index of the next door to open. Derived from `save.best` at start. |
| `aboveBest` | Whether the player is at their best. Used to show NEW BEST only after dropping 3 m below it and coming back. |
| `col`, `colFrom`, `colTo`, `colT` | Palette in use, and the fade between sections (see [Doors and colors](#doors-and-colors)). |
| `dirty`, `lastSave` | Save debouncing. |
| `particles`, `portalFx`, `trail`, `preview` | Effect buffers, read by `draw.js`. |
| `near`, `drawPlats`, `nearItems`, … | Scratch arrays for grid queries (one per use; see [README](README.md#conventions-used-everywhere)). |
| `tutorialTexts` | The two world-space tutorial lines. |

### Player (`this.player`)

| Field | Meaning |
|---|---|
| `x, y, vx, vy` | Center position and velocity. |
| `ground` | Platform being stood on, or `null` in the air. |
| `offset` | Horizontal offset from the platform's center while standing (so moving platforms carry you). |
| `charges` | Jumps left. Landing sets it to `MAX_CHARGES` (2); a star adds 1; a hit sets 0. |
| `hp` | Hearts, `MAX_HP` max. |
| `dead` | Seconds until respawn (0 = alive). |
| `funnel` | `{ f, pts, seg, along }` while being carried through a funnel. |
| `warp` | `{ to, x0, y0, x1, y1, t, ang }` while flying between portals. |
| `portalT` | Short cooldown after leaving a portal. |
| `hitT` | Invulnerability after a hit or respawn (the player blinks). |
| `squash` | Landing squash amount, decays over time. |
| `fromY` | Where the current flight started; used to count falls. |

At most one of `ground`, `funnel`, `warp`, `dead` is active at a time. When none is, the player is in free flight.

## Frame loop: `update(time, delta)`

1. `dt` = frame time, capped at 50 ms (a backgrounded tab can't cause a huge jump).
2. `aim` = current aim, or `null` when paused, dead, in a funnel or warping.
3. If not paused:
   - **Slow motion:** while aiming with a jump left, `drag.t` grows and the target time scale eases from 1 to `SLOWMO` over `SLOWMO_RAMP` seconds (smoothstep). `timeScale` follows the target smoothly. When you release, it snaps back toward 1.
   - **Fixed steps:** `acc += dt × timeScale`, then `stepSim(1/120)` as many times as fit. Physics is frame-rate independent and matches [verify-tower](scripts.md) exactly.
   - `updateEffects(scaled dt)`.
4. `updateCamera(dt)`, then `tower.ensureUpTo(camera top)` so the tower is always generated a screen ahead.
5. Aim preview path, `drawWorld`, tutorial text colors, `hud.update`.
6. If `dirty` and more than 1 s since the last save, `persist()`.

## One sim step: `stepSim(dt)`

In this order:

1. `simT += dt`.
2. **Dead:** count down `dead`; at 0, `respawn()`. Nothing else runs.
3. Count down `hitT` and `portalT`.
4. **Funnel or warp:** move along it (`slideFunnel` / `slideWarp`), update height, stop.
5. **Standing:** if the platform stopped being landable (`solid()` false, i.e. it crumbled), fall. Otherwise follow it: `x = platformX + offset`, `y = platform top − R`.
6. **Flying:** run `substeps()` substeps of [`integrate`](physics.md). Each substep can bounce off a wall (`onWall`), adds to the climbed stat, and checks landing while falling. Then check funnels, then portals.
7. Hazards (unless invulnerable or in a funnel).
8. Hearts and stars (unless dead).
9. `updateHeight()`: best, NEW BEST, doors.

## Input

- `pointerdown` anywhere (not over a button, not paused) starts `drag`. It also unlocks audio on the first touch.
- `pointermove` updates the drag point.
- `pointerup` / `pointerupoutside` computes `aim()` and calls `tryLaunch(aim)`.
- **Esc** toggles the pause menu.

Pointer positions are divided by `RES` to get logical pixels.

**`aim()`** returns `{ x, y, power }`: the unit vector from the current point back to the start (slingshot style), and power 0–1 from the drag length between `DRAG_DEADZONE` and `MAX_DRAG`. It returns `null` inside the dead zone.

**`tryLaunch(aim)`** does nothing while dead, in a funnel or warping. With no jumps left it plays the "empty" sound. Otherwise it leaves the ground, sets velocity to `aim × launchSpeed(power)` and uses a charge.

`jumpsLeft()` is the single place that says how many jumps the player has. It's used for slow motion, the player color and the arrow.

## Platforms and landing

- **`solid(p)`** means "can be landed on right now". It isn't about collision from the side or from below; every platform is one-way.
  - A door is solid once opened: `p.n < nextDoor`.
  - A crumbling platform is not solid from `crumbleAt` until `crumbleAt + CRUMBLE_RESPAWN`; then it resets.
- **`checkLanding(prevY)`** only runs while falling. A platform is landed on when the player's bottom crosses its top during the substep and the player is within `w/2 + 0.4R` horizontally. If several match, the highest wins.
- **`land(p, px)`** refills `charges`, records a fall, then:
  - **Bouncy:** sets `vy = −clamp(1.3 × impact, BOUNCE_MIN, BOUNCE_MAX)`, squashes the platform, and stays in the air.
  - **Anything else:** stands on it. Stores `offset`, squash and sound by impact, starts the crumble timer on first touch, and marks the save dirty.
- **`recordFall()`:** a landing more than 4 m below `fromY` counts as a fall (stat). 10 m or more also floats a "−N m" text.

## Hazards, damage, death

- **`checkHazards()`:**
  - Wall spikes hit when the player touches that wall inside the spike segment.
  - Spikes and saws hit within `R + 0.8 × hazard radius`.
- **`hit()`:** −1 HP. At 0 → `die()`. Otherwise: 1 s invulnerability, jumps drained, knocked off the platform, horizontal speed cut, pushed down, camera shake.
- **`die()`:** hides the player for `RESPAWN_DELAY`, bursts, counts a death and saves.
- **`respawn()`:** back on the ground at 0 m, full HP, full jumps, short invulnerability, camera snaps, "BACK TO 0m" banner. Opened doors stay open: they're one-way, so you can climb back up through them.

## Funnels

- **`checkFunnels()`:** the player is caught if their center is inside the cone. The cone's half-width shrinks from `FUNNEL_W/2` at the mouth (bottom) to `FUNNEL_NECK` at the top of the cone. Velocity is zeroed and the path becomes `[player position, ...f.tube]`.
- **`slideFunnel(dt)`:** moves along that path at `FUNNEL_SPEED`. At the end, `ejectFunnel()` places the player at the top of the tube with the funnel's stored `vx, vy` (set by the generator: a strong upward shot, slightly toward the middle).
- No hazards apply and no jumps can be used while inside.

## Portals

- **`checkPortals()`:** only blue portals take you in, and only when `portalT` is 0.
  - If the yellow exit hasn't been generated yet, the tower generates ahead (up to 80 steps) until it exists.
  - If the blue portal was dropped (`gone`), it's ignored.
- **`slideWarp(dt)`:** moves the player from blue to yellow over `WARP_TIME` with smoothstep easing (`draw.js` stretches the player along the way).
- **On arrival:** `vx = 0`, `vy = −PORTAL_EXIT`, whatever the entry speed was. `portalT = 0.3` so the player doesn't immediately re-enter.

## Stars

**`updateStars()`:** touching an available star gives `charges + 1` and starts its `STAR_RESPAWN` timer. Since landing sets `charges` back to 2, a star's extra jump only lasts until you land.

## Hearts

**`updateHearts()`** only looks at hearts in or near the camera view.

- A heart's `HEART_LIFE` countdown starts the first time it comes on screen (`seenT`). When it runs out, the heart vanishes with a small burst (`gone`).
- Touching it gives +1 HP and removes it.
- At full HP you pass through it; it stays (until its time runs out) for when you need it.
- Every heart in the tower shows; there's no HP-based chance.

## Doors and colors

**`updateHeight()`** runs every step:

- Updates `height` and `save.best`. NEW BEST is announced only when you pass your best after having dropped more than 3 m below it.
- While the new best is above `doorHeight(nextDoor)`:
  - That door opens (its `openT` starts the sweep animation) and a "DOOR N m" banner shows.
  - `nextDoor` goes up by one.
  - The palette starts fading: `colFrom` = current colors, `colTo` = the new section's palette, `colT` = now. [draw.js](draw.md) blends over 1.2 s of real time.

Because `nextDoor` is derived from `save.best`, opened doors survive reloads for the rest of the day.

## Camera

- **`cameraTarget()`** is `player.y − TOP_GAP`.
- **`updateCamera(dt)`** eases toward the target (rate 5/s), then clamps so the player is never closer than 120 px to the top, nor further down than 85% of the screen.
- Respawning snaps the camera instead of easing.

## Effects

- **`burst(x, y, color, n, speed, dirX, dirY)`** adds `n` particles with gravity and a 0.3–0.6 s life. An optional direction biases them.
- **`trail`:** recent flight positions (up to 12), cleared on landing.
- **`updatePortalFx(dt)`:** about 40 particles per second for each portal on screen. They're sucked into the blue one and sprayed out of the yellow one.
- **`floatText(x, y, text)`:** a text that rises and fades (used for big falls).
- `squash` decays over time.

## Saving and lifecycle

- **`persist()`:** writes the save immediately.
- **When it saves:**
  - 1 s after anything marks it `dirty` (landing, heart pickup, hit)
  - on death
  - when the tab is hidden or closed (`visibilitychange`, `pagehide`)
  - when sound is toggled
- **New day:** if the tab becomes visible on a different day, the scene saves and restarts, which loads the new tower and rolls the save over.
- **`restartTower()`** (pause menu) clears today's best and stats, then restarts the scene.

## Tutorial

**`addTutorial()`** places the two tutorial texts in world space: one halfway between the ground and the first tutorial bar, one 40% of the way from the first bar to the second. They take the section's ink color every frame (`tint` only re-renders when the color changes).

## Dev helper

**`devStart()`** (dev builds only): `?at=300` generates the tower up to there and puts the player on the nearest static platform. Doors and best update as soon as the game starts, so you'll see door banners.

## Adding a new pickup

1. Generate it in [tower.js](tower.md#adding-a-new-kind-of-object) with its own grid and an `…In()` query.
2. Add an `updateX()` here that queries near the player each step and applies the effect. Call it from `stepSim` next to `updateStars()`.
3. Draw it in [draw.js](draw.md), and add any new color to [palettes.js](palettes.md).
4. If it changes where the player can go, think about whether [verify-tower](scripts.md) needs to know about it.
