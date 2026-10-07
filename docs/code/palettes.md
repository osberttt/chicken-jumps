# palettes.js

All colors. The tower is split into **sections** by doors; each section has its own palette, and its background is the color of the door that opened it. A **family** is a set of 8 section colors, plus the object colors that go with them.

No Phaser, no DOM: both the game and `scripts/palette-preview.mjs` import it.

## Exports

| Export | What it is |
|---|---|
| `FAMILIES` | `{ pastel, pop, vivid, soft }`. Each has a `label`, 8 `sections` (`{ name, bg, ink }`) and optionally `objects` (otherwise the bright default set is used). |
| `FAMILY` | The family the game uses. Currently `'pastel'`. |
| `objectsOf(family)` | That family's object colors. |
| `OBJECTS` | The game family's object colors. |
| `expand(sec, family)` | Builds a full palette from one section entry (below). |
| `mixColor(a, b, k)` | Blends two colors, `k` from 0 to 1. |

## A palette

`expand()` returns:

| Key | From | Used for |
|---|---|---|
| `bg` | section | Background. |
| `door` | = `bg` | Door color (a door shows the background of the section it opens). |
| `ink` | section | Platforms, outlines, HUD text, markers. A dark tone of `bg`. |
| `plat`, `deco` | = `ink` | Platforms; background shapes (drawn faint). |
| `wall` | `bg` 14% toward `ink` | Side walls and below ground. |
| `fill` | `bg` 55% toward white | Inside of funnels. |
| `spark` | white | Burst particles and the hit flash. |
| object colors | family | `canJump`, `cantJump`, `star`, `heart`, `portalBlue`, `portalYellow`, `bouncy`, `hazard`. |

## Which section gets which color

In [draw.js](draw.md), `palette(tower, n)` picks `sections[(floor(tower.hue × 8) + n) % 8]`. So:

- Each day starts on a different color (from the tower's `hue`).
- Each door moves one step through the family's list, looping after 8 doors.
- Below the first door is section 0.

## Choosing colors

The families were designed so every object stays readable on every background in the family:

- `ink` must contrast with `bg` (it's used for text and platforms).
- Object colors get an ink outline, so they can be close to a background's hue and still read. Still, avoid a section whose `bg` is the same hue as `canJump` (blue) or `cantJump` (red). The player's color carries meaning.
- In the pastel family, object colors are pastel too, so they match the light backgrounds.

To try changes:
1. Edit a family (or add one to `FAMILIES`).
2. Run `npm run palettes`. It writes one PNG per family to `palette-preview/` (git-ignored), each showing every section with the player, platforms, door, funnel, portals, star, heart, spike, aim arrow and HUD.
3. Set `FAMILY` to use it in the game.

A new object color has to be added to **every** family's `objects`, and to the default set at the top of the file, or it will be `undefined` for some families.
