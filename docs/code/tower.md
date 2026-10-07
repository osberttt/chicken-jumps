# tower.js

The day's tower. Generates platforms, doors, hazards and items from the date seed, keeps them in vertical buckets for fast lookup, and exposes small helpers for positions that change over time. It doesn't use Phaser or the DOM, so it also runs in Node ([verify-tower](scripts.md)).

## Exports

| Export | What it does |
|---|---|
| `Tower` | The generator and container. One per day. |
| `doorHeight(n)` | Height in meters of door `n` (n ≥ 1): `50 + 25·n·(n+1)` → 100, 200, 350, 550, 800, 1100, … The gap grows by 50 m each time. |
| `nextDoorIndex(m)` | The first door above `m` meters. |
| `platformX(p, t)` | A platform's center x at sim time `t`. Moving platforms swing: `x + amp·sin(t·speed + phase)`. |
| `hazardPos(hz, t)` | A spike's or saw's `[x, y]` at time `t`. Saws move up and down the same way. |
| `heartPos(ht, t)` | A heart's `[x, y]` at time `t`. It drifts around its spot on slow gradient noise (±70 px sideways, ±45 px up and down). |
| `funnelTube(x, y)` | The path through a funnel's tube: `[x, neck, x, top]`, where `y` is the mouth. |

## Determinism

Every player gets the same tower on the same day, and a reload rebuilds it exactly.

- **Seed:** `hashString("chickenjumps:YYYY-MM-DD")`.
- **Two RNG streams:**
  - `rng` drives platforms, hazards, side ledges, funnels and portals.
  - `itemRng` (seeded `seed ^ 0x5bd1e995`) drives hearts and stars, so changing heart or star odds never moves a platform.
- **`hue`:** the first draw from `rng`. It picks the starting palette ([palettes.md](palettes.md)).
- Generation is strictly sequential and depends only on the RNG and what was already generated. Never read the screen size, time or game state in here.
- **Pattern for random draws:** a function should draw all of its random numbers before deciding to bail out (see `addHeart`, `addStar`). Then the number of draws doesn't depend on the outcome, and changing a condition doesn't shift everything after it. Functions that retry in a loop (`addSpike`, `clearSpot`, `addFunnel`) are still deterministic, just more sensitive to changes.
- `npm run verify` builds every test day twice and checks the platform lists match.

## Data

Everything lives in arrays plus a `Grid` per kind.

| Array | Item shape | Notes |
|---|---|---|
| `platforms` | `{ id, x, y, w, type, crumbleAt, amp?, speed?, phase?, n?, squashT?, openT?, color? }` | `id` = index. `type` is one of `ground`, `normal`, `moving`, `crumble`, `bouncy`, `door`. `y` is the top surface. `crumbleAt`, `squashT`, `openT`, `color` are runtime state written by the scene and draw code. |
| `doors` | the door platforms | `doors[n]` is door `n` (index 0 unused). |
| `tutorial` | 2 platforms | The two full-width tutorial bars. |
| `hazards` | `{ kind: 'spike' \| 'saw', x, y, r, amp, speed, phase }` or `{ kind: 'wall', side: -1 \| 1, y0, y1 }` | Saws are spikes with `amp > 0`. |
| `hearts` | `{ x, y, seed, seenT, gone }` | `seenT` and `gone` are runtime state written by the scene. |
| `stars` | `{ x, y, takenT }` | |
| `funnels` | `{ x, y, side, tube, vx, vy }` | `y` = mouth (bottom). `vx, vy` = the speed you're shot out with. |
| `portals` | `{ color: 'blue' \| 'yellow', x, y, pair, gone? }` | `pair` links the two. A blue portal whose exit couldn't be placed gets `gone = true`. |
| `zones` | `{ x0, x1, y0, y1 }` | Boxes around funnels that other objects keep out of. |

## Spatial index: `Grid`

`Grid(600)` buckets objects into 600-px vertical bands. `add(obj, y0, y1)` puts the object in every band it spans. `query(y0, y1, out)` fills `out` with everything in those bands.

- Results are by band, so they can include objects a bit outside `[y0, y1]`. Callers do their own exact checks.
- An object spanning several bands would be returned more than once, so each query stamps objects (`obj._q`) and skips repeats.
- Public queries: `platformsIn`, `hazardsIn`, `heartsIn`, `starsIn`, `funnelsIn`, `portalsIn`, all `(y0, y1, out)`.

## Generating on demand

- `ensureUpTo(y)` calls `step()` until the last main platform is at least one screen (`H`) above `y`. The scene calls it every frame with the camera top. That's the only use of `H` here, and it only affects how far ahead generation runs, never what it generates.
- `lastMain` is the most recent main-path platform; each `step()` builds on it.

## The start

The constructor adds:
1. The ground (`id 0`, full width, `y = 0`).
2. The two tutorial bars from `TUTORIAL_BARS` (type `ground`, full width).

`lastMain` = the second bar, so generation starts above the tutorial.

## `step()`: one main platform per call

1. **Height and difficulty:** `h` = height of `from` (m), `d = clamp(h / 800, 0, 1)`.
2. **Rest ledge** every `round(lerp(6, 13, d))` steps: wide (290–350), always plain.
3. **Tier** (not for rest ledges, from 12 m):
   - `hard` from 40 m with chance `lerp(0.1, 0.35, d)`
   - `medium` with chance `lerp(0.3, 0.45, d)`
   - otherwise `easy`
4. **Gap and reach.** A launch reaches `2·√(P·(P−dy))` sideways at height `dy`; only part of it is used.
   - easy: `dy` = 0.28–0.5 P, reach × 0.5
   - medium: `dy` = 0.5–0.78 P, reach × 0.7
   - hard: `dy` = 1.0–1.3 P, above a single jump, so it needs the double jump
5. **Width:** `lerp(250, 150, d)` ± 15% (bouncy max 150).
6. **Type:** one roll against `bouncy` (0.18 from `BOUNCY_FROM`), `moving` (from 40 m, `lerp(.12, .25, d)`), `crumble` (from 80 m, `lerp(.1, .22, d)`). Otherwise plain.
7. **x:** random inside `from.x ± reach` and the walls. If it lands within 70 px of `from.x` and there's room, it's pushed 70–140 px sideways, to avoid straight stacks.
8. **Doors:** if the new `y` is within 50 px of a door, it's moved to just below the door (or just above when the gap would be too small). Then `addDoorsUpTo(y)` adds any doors the tower has now passed, in order, so their ids stay deterministic.
9. **Moving** platforms get `amp` (50–110, limited by the walls; under 30 → plain), `speed`, `phase`.
10. **Extras around the new gap, in this order:**
    1. side ledge (not on rests, chance `lerp(.45, .2, d)`)
    2. spike/saw (from `SPIKES_FROM`, chance `lerp(.25, .65, d)`)
    3. wall spikes (from `SPIKES_FROM`, 12%)
    4. portals (from `PORTALS_FROM`, 15% to start a new pair; a pending yellow exit is placed regardless)
    5. funnel (from `FUNNELS_FROM`, 12%)
    6. heart
    7. star

## Placement rules

Everything except the main path checks that it isn't on top of something else. The checks:

- `platformNear(x, y, padX, padY)`: any platform (including a moving one's whole swing) in the box.
- `hazardNear(x, y, padX, padY)`: any spike or saw (including a saw's sweep).
- `doorNear(y, pad)`: y of a door within `pad`, or `null`.
- `doorBetween(y0, y1)`: the lowest door strictly between two heights, or `null`.
- `portalNear(x, y, pad)`, `inZone(x, y, pad)` (the last 4 funnel zones).

| Object | Rules |
|---|---|
| Side ledge | 80–140 wide, 35–70% of the way up the gap, at least 150 px from the path's middle. Not near hazards, doors, funnels or portals. Crumbling (30%) from 80 m. |
| Spike / saw | Outside the path column (both platforms' spans + 40), strictly between the two heights (including a saw's sweep), clear of platforms, doors, funnels, portals. Saws (40%) from 150 m. Up to 8 tries. |
| Wall spikes | Only on a wall the path stays 90+ px away from, 110–240 long, no platform touching that wall in range, no door or funnel there. |
| Funnel | Mouth at least 80 px above `from`. Tube top no more than 120 px above `to`, so the next main platform (always 180+ px above `to`) stays clear. The whole shape clear of platforms, hazards, doors, portals and other funnels. Up to 12 tries. Shoots out with `vy` for a 450–650 px rise and `vx` 60–180 toward the middle. |
| Portal pair | See below. |
| Heart | From `HEARTS_FROM`, chance `HEART_CHANCE`, 30–80% up the gap. Not near hazards, funnels, portals. |
| Star | From `STARS_FROM`. 50% on gaps taller than 0.7 P (where the extra jump helps), else 10%. Near the line between the platforms, 45–70% up. Clear of everything. |

**`clearSpot(from, to, rad, minY)`** finds a free spot between two platforms. It tries 10 times outside the path column, then 10 more times anywhere, so it rarely fails. Portals use it.

### Portals

`placePortals(from, to, wantNew)`:

1. **A blue portal is waiting for its exit** (`pendingPortal`). Once the main path has passed the target height, place the yellow one with `clearSpot` (and above `minY`, if a door is involved). If there's no room for 4 steps in a row, mark the blue one `gone` and give up.
2. **Otherwise, if `wantNew`:** place a blue portal with `clearSpot` and set the yellow target 700–1300 px (17–33 m) higher. If a door lies between them, the target moves to just below that door. A pair never straddles a door. If that leaves less than 450 px, the pair is skipped.

The scene can ask for more steps when you enter a blue portal whose exit doesn't exist yet. See [GameScene → Portals](GameScene.md#portals).

## Adding a new kind of object

1. Add an array and `new Grid(600)` in the constructor, plus an `xIn(y0, y1, out)` query.
2. Write an `addX(from, to, h)` that draws all its random numbers first, then checks placement with the helpers above. Use `itemRng` if it shouldn't affect the layout, `rng` if it should.
3. Call it at the end of `step()`. Adding a call that uses `rng` changes every tower after the first time it's called; that's fine, but run `npm run verify`.
4. If other things must keep away from it, either give it a `…Near()` helper and use it in the other placers, or push a box to `zones`.
5. Gate it by height with a constant in [config.js](config.md).
