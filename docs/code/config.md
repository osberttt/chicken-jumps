# config.js

Every tuning number lives here, plus two values computed from the screen at load time (`H` and `RES`). Nothing else in the code should hard-code these.

All distances are logical pixels (40 px = 1 m), speeds are px/s, and times are seconds of **sim time** (see [README → Two clocks](README.md#conventions-used-everywhere)).

> **Determinism rule.** Anything [tower.js](tower.md) uses while generating must be the same on every device, or players get different towers on the same day. That's why `PEAK` is a constant and not derived from `H`. Don't make generation depend on `H` or `RES`.

## Screen and resolution

| Name | Value | Meaning |
|---|---|---|
| `W` | 540 | Logical playfield width. Fixed. |
| `H` | 900–1200 | Logical height: `W × screen height / screen width`, clamped. Tall phones fill the screen; wide screens get side bars. |
| `WALL` | 10 | Thickness of the side walls. |
| `RES` | 1–3 (quarter steps) | Render scale: how many device pixels per logical pixel. The canvas is `W·RES × H·RES` and the camera zooms by `RES`. |
| `TOP_GAP` | `PEAK − 60` | Where the camera keeps a standing player: this far below the top edge. A full jump therefore peaks just past the top on every screen. |
| `FONT` | system font stack | Used by every text object. |

`win` falls back to a fake 540×960 window when there is no `window` (Node), so the scripts can import this file.

## Player and physics

| Name | Value | Meaning |
|---|---|---|
| `PLAYER_R` | 16 | Player radius. |
| `GRAVITY` | 2400 | px/s². |
| `MAX_FALL` | 2600 | Terminal fall speed. |
| `PEAK` | 640 | Height of a full-power straight-up jump (16 m). The generator plans gaps around it. |
| `MIN_LAUNCH` | 380 | Launch speed at the smallest drag. |
| `MAX_LAUNCH` | √(2·g·PEAK) ≈ 1753 | Launch speed at a full drag. Derived so a full jump reaches exactly `PEAK`. |
| `WALL_BOUNCE` | 0.8 | Horizontal speed kept when bouncing off a side wall. |
| `MAX_CHARGES` | 2 | Jumps per landing (the double jump). Stars can add more until you land. |

## Input and time

| Name | Value | Meaning |
|---|---|---|
| `DRAG_DEADZONE` | 16 | Drags shorter than this cancel on release. |
| `MAX_DRAG` | 190 | Drag length for full power. |
| `SLOWMO` | 0.15 | Time scale reached while aiming. |
| `SLOWMO_RAMP` | 0.9 | Seconds of aiming before time is fully slowed. |

## Platforms and hazards

| Name | Value | Meaning |
|---|---|---|
| `CRUMBLE_TIME` | 0.9 | Seconds after first touch until a crumbling platform breaks. |
| `CRUMBLE_RESPAWN` | 3.5 | Seconds a broken platform stays gone. |
| `BOUNCE_MIN`, `BOUNCE_MAX` | 1700, 2300 | Range of the upward speed a bouncy platform gives (≈15–28 m). The actual value is `1.3 × landing speed`, clamped to this range. |
| `HIT_COOLDOWN` | 1 | Invulnerable seconds after a hit, and after respawning. |

## Funnels, portals, stars

| Name | Value | Meaning |
|---|---|---|
| `FUNNEL_W` | 150 | Width of the funnel's mouth (bottom). |
| `FUNNEL_D` | 110 | Height of the cone, from the mouth to where it meets the tube. |
| `FUNNEL_TUBE` | 140 | Length of the tube above the cone. |
| `FUNNEL_NECK` | 22 | Half-width of the tube. |
| `FUNNEL_SPEED` | 900 | How fast the player slides through the funnel. |
| `PORTAL_R` | 26 | Portal radius. |
| `WARP_TIME` | 0.9 | Seconds the flight from blue to yellow takes. |
| `PORTAL_EXIT` | 1100 | Upward speed when leaving the yellow portal (always straight up). |
| `STAR_RESPAWN` | 4 | Seconds until a taken star comes back. |

## Health and hearts

| Name | Value | Meaning |
|---|---|---|
| `MAX_HP` | 5 | Hearts. 0 = death, back to 0 m. |
| `HEART_LIFE` | 5 | Seconds a heart lasts after it shows up. |
| `HEART_CHANCE` | 0.3 | Chance of a heart per main platform, from `HEARTS_FROM`. |
| `RESPAWN_DELAY` | 0.9 | Seconds between dying and reappearing at 0 m. |

## Where things start (meters)

| Name | Value |
|---|---|
| `BOUNCY_FROM` | 100 |
| `SPIKES_FROM` | 150 (spikes, saws, wall spikes) |
| `HEARTS_FROM` | 250 |
| `FUNNELS_FROM` | 500 |
| `PORTALS_FROM` | 1000 |
| `STARS_FROM` | 1500 |

Moving platforms start at 40 m and crumbling ones at 80 m. Those thresholds are still inside `Tower.step()` in [tower.js](tower.md).

## Tutorial

| Name | Value | Meaning |
|---|---|---|
| `TUTORIAL_BARS` | `[340, 340 + PEAK + 120]` | Heights (px above ground) of the two full-width tutorial bars. The first is one jump up. The second is more than `PEAK` above the first, so only the double jump reaches it. |

## Changing things safely

- After changing anything the generator uses (`PEAK`, gravity, launch speeds, start heights, funnel or portal sizes, tutorial bars), run `npm run verify` to check every platform is still reachable.
- Changing generation changes every day's tower. Saves don't store positions, so that's safe; only the layout people see changes.
