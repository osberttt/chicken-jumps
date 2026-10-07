# ui.js

Screen-fixed interface: the HUD, the banner queue and the pause menu. Also `label()`, the helper every text in the game is created with.

## Exports

| Export | What it is |
|---|---|
| `label(scene, x, y, text, size, alpha = 1, fixed = true)` | Creates a bold, centered text at the render resolution (`RES`). `fixed` pins it to the screen; pass `false` for world-space text (markers, door labels, tutorial). Text is white by default; recolor it with `tint()` from draw.js. |
| `Hud` | Hearts, height, door progress, pause button, banners. |
| `Menu` | The pause menu. |

## Hud

Everything is redrawn each frame in `update(dt)`, in the section's `ink`.

| Element | Position | Details |
|---|---|---|
| Hearts | top-left | `MAX_HP` hearts: full ones in `heart` with an outline, empty ones faint. When HP changes, the hearts pulse for about 0.3 s. |
| Run timer | under the pause button | `m:ss` since this run began (`scene.runT`). Real seconds, so slow motion doesn't slow it; it stops while paused and resets on death. The text is only rebuilt when the second changes. |
| Height | top-center | Current height in meters. |
| Door progress | under the height | A bar from the last door (or 0 m) to the next, filled in the **next door's color**, with the next door's height next to it. |
| Pause | top-right | Two bars; an 80×80 invisible zone opens the menu. |

**Banners.** `announce(text)` queues a big centered message: NEW BEST, DOOR N m, BACK TO 0m. Each one pops in (0.26 s), holds, and fades (0.45 s) before the next. The text has an ink stroke so it reads on any background.

## Menu

Opening it sets `scene.paused` (which stops the simulation) and cancels any drag. A full-screen dim rectangle catches touches so they don't start a drag behind it.

| Part | What it does |
|---|---|
| Stats | Date, best, climbed, falls, deaths, longest fall, streak. |
| Chart | Best height for each of the last 7 days (from `save.history` plus today), today highlighted. |
| RESUME | Closes the menu. |
| SOUND | Toggles mute and saves. |
| COPY RESULT | Copies a short text summary. Uses `navigator.clipboard`, with a hidden-textarea fallback for older browsers. |
| RESTART TOWER | Needs a second tap. Clears today's best and stats and restarts. |

The layout is authored for a 960-tall screen and centered vertically on other heights (`oy`).

The menu still uses fixed dark-overlay colors (white text on black), not the section palette.
