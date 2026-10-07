# draw.js

Draws the whole world every frame from the scene's state. Nothing here keeps state of its own, apart from a few cached values. Two Phaser `Graphics` objects are cleared and redrawn each frame:

- `sc.bgG`: background shapes, fixed to the screen (parallax done by hand).
- `sc.g`: the world, scrolling with the camera.

Only objects near the camera view are drawn (grid queries with a margin).

## Exports

| Export | Used by | What it does |
|---|---|---|
| `drawWorld(sc, aim)` | GameScene | Draws one frame. Also sets `sc.col` to the current palette. |
| `palette(tower, section)` | GameScene, ui | Full palette for section `n` (above door `n`). See [palettes.md](palettes.md). |
| `drawHeart(g, x, y, s)` | ui | Plain heart shape, size `s`. |
| `inkHeart(g, x, y, s, fill, ink)` | ui | Heart with an ink outline. |
| `tint(text, color)` | GameScene, ui | Sets a text's color only if it changed (Phaser re-renders text on every `setColor`). |
| `hex(color)` | GameScene, ui | `0xRRGGBB` → `'#rrggbb'`. |
| `portalColor(pt)` | GameScene | The portal's fill color. |
| `HEART`, `STAR` | ui, GameScene | Object colors for HUD hearts and star sparks. |

## Draw order (`drawWorld`)

1. Palette (`currentPalette`, see below); camera background and page background follow it.
2. Background shapes (`drawBackdrop`).
3. Below-ground fill and the side walls.
4. Height markers every 10 m (`drawMarkers`, reusing a pool of 8 texts).
5. Best line (`drawBestLine`): only when you're more than 1 m below today's best.
6. Platforms and doors.
7. Hazards, funnels, portals, portal particles, stars, hearts.
8. Trail, aim arrow, player.
9. Burst particles.

Later items are drawn on top.

## Style

- **Ink outlines.** Every object (player, hearts, stars, spikes, bouncy platforms, portals, funnels) has an outline in the section's `ink` color. That keeps objects readable on any background. Two ways it's done:
  - polygons use `fillPoints` + `strokePoints`
  - hearts and the player draw a slightly bigger ink copy underneath (Phaser `Graphics` has no stroke for those compound shapes)
- **`OUTLINE`** = 2.5 px is the outline width for most objects.
- **One-way platforms** are 8 px bars with a dashed shadow under them, which hints "you can pass up through this".

## Palette fade

`currentPalette(sc)` returns `sc.colTo`, except during the 1.2 s (real time) after a door opens, when it blends every color from `sc.colFrom` with a smoothstep. The scene sets those values in `updateHeight()`.

## How each thing is drawn

| Thing | Notes |
|---|---|
| Background shapes | Circles, squares and triangles in `deco` at 8% alpha, scrolling at 35% of the camera speed. Positions come from `hash01`, so they're stable without using the tower RNG. |
| Ground / tutorial bars | 6 px full-width bar. |
| Plain platform | One-way bar. |
| Moving | One-way bar, a faint track line showing its full swing, two small dots. |
| Crumbling | Separate pieces. After touch they shake and fade; when broken, only a faint outline. |
| Bouncy | Rounded pill in `bouncy` with an ink outline; squashes for 0.25 s after a bounce. |
| Door | Drawn in the color of the section **above** it (`p.color`, cached on first draw). Closed: a row of dots. Opened: a full-width bar that sweeps out from the middle over 0.35 s. Label "DOOR N m" from a pool of 3 texts. |
| Spike / saw | 7-point slow-turning star / 10-point fast-spinning star, with an ink center. Saws show their track. |
| Wall spikes | Triangles along the wall. |
| Funnel | One filled shape (cone + tube) in `fill`. The walls are ink lines with open ends at the mouth and the top, plus a small flared lip. 12 specks flow up through it on a loop: positions from `hash01` and `simT`, no stored particles. |
| Portal | Filled circle with an ink border, a soft glow and a slight pulse. The particles come from `sc.portalFx`, created in GameScene. |
| Star | Bobbing 5-point star with a soft white glow. While respawning, only a growing faint outline. |
| Heart | Pulses; blinks in its last 1.5 s. |
| Trail | Fading circles in the player's color. |
| Aim | An arrow from the player in the launch direction. Length grows with power, filled in the player's color, faded when no jump is left. Past its tip, the dotted preview from `physics.previewPath`. |
| Player | A 24-point ellipse (works the same in WebGL and Canvas): stretched along the aim while aiming, along the velocity in flight, squashed on landing, small in a funnel, long and thin while warping. Blue (`canJump`) with a jump left, red (`cantJump`) without. Blinks white while invulnerable. |

## Changing the look

- New colors go in [palettes.js](palettes.md) (per family), not here.
- Anything new that needs drawing: add a grid query in `drawWorld` at the right place in the order, and a `drawX` function.
- Keep shapes to `fillPoints`, `fillCircle`, `fillRect`, `fillRoundedRect`, lines and `strokePoints`. They behave the same in WebGL and Canvas.
