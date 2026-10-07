# Upfall: System Design

How the game is built: architecture, the main systems and their data, and the invariants that keep the daily tower fair and deterministic. For the gameplay itself, see [GDD.md](GDD.md).

## 1. Stack and build

| Concern | Choice |
|---|---|
| Engine | Phaser 3.90 (WebGL, falls back to Canvas) |
| Language | Plain JavaScript (ES modules) |
| Bundler / dev server | Vite 8, `base: './'` so the build runs from any sub-path |
| Assets | None: all graphics are vector `Graphics` calls; all audio is WebAudio synthesis |
| Persistence | `localStorage` |
| Output | `dist/index.html` plus one JS bundle (~330 kB gzipped, almost all Phaser) |

Scripts: `npm run dev`, `npm run build`, `npm run preview`, `npm run verify`. After the page has loaded, the game makes no network requests.

## 2. Module map

```
main.js ── creates Phaser.Game (size = logical × RES) ──► GameScene
                                                            │
  config.js   constants, screen-derived H and RES           │ owns
  rng.js      seed hash, mulberry32 RNG, date helpers       ▼
  tower.js    Tower: deterministic generation, spatial grid, door heights
  physics.js  integrate(), launchSpeed(), previewPath()
  GameScene   input, fixed-step simulation, landing/hazards, doors, camera, save timing
  draw.js     drawWorld(): every frame, redraws world from state (immediate mode)
  ui.js       Hud, intro card, pause Menu (stats, chart, copy, restart)
  save.js     load(today) with daily rollover, store()
  audio.js    sfx.* tone synth, buzz() vibration
scripts/verify-tower.mjs   headless reachability + determinism check (Node)
```

Dependencies only point downward. `tower.js`, `physics.js`, `rng.js` and `config.js` don't import Phaser, so Node can run them, which is what the verification script relies on.

## 3. Frame and simulation loop

`GameScene.update(time, delta)`:

1. Real `dt` = `delta`, capped at 50 ms (so a backgrounded tab can't cause a huge jump).
2. **Time scale:** eases toward 0.2 while the player is aiming in mid-air with a charge available, otherwise toward 1 (exponential smoothing).
3. **Fixed step:** an accumulator advances `stepSim(1/120 s)` by `dt × timeScale`. The physics is therefore independent of frame rate and matches the verification script exactly.
4. Effects (particles, squash, trail) advance with the scaled `dt`.
5. Camera update, `tower.ensureUpTo(cameraTop)`, aim preview, `drawWorld`, HUD, autosave.

While paused (menu open) steps 2–4 are skipped; drawing continues.

## 4. Coordinates, resolution and camera

- **Logical units:** width `W = 540`. Height `H` follows the screen aspect ratio, clamped to 900–1200, so tall phones fill the screen and wide screens get side bars. World y points down; the ground surface is `y = 0`; the tower rises toward negative y. **40 units = 1 m.**
- **Sharp rendering:** the canvas is `W·RES × H·RES`, where `RES` is about the display scale × devicePixelRatio (1–3, in quarter steps). The main camera has `zoom = RES` and `origin (0,0)`, so all game code works in logical units. Text objects use `setResolution(RES)`. Pointer coordinates are divided by `RES`.
- **Camera:** target `scrollY = player.y − TOP_GAP` (580), smoothed with rate 5/s, then clamped so the player stays between 120 units from the top and 85% of the screen height. Because `TOP_GAP` is a constant rather than a fraction of `H`, a full fling (640) peaks just past the top edge on every device.

## 5. Player physics

State: `x, y, vx, vy, ground (platform|null), offset, charges, refill, hitT, squash, fromY`.

- **Free flight** (`physics.integrate`): semi-implicit Euler. `vy += g·dt` (capped at 2600), position += velocity·dt. Side walls clamp x to `[WALL+R, W−WALL−R]` and reflect `vx × 0.8`.
- **Grounded:** the player follows the platform: `x = platformX(p, t) + offset`, `y = p.y − R`. If the platform stops being solid (crumbled), the player is released into free fall.
- **One-way landing:** only while `vy > 0`, when the bottom of the body crosses a platform's top during the step (`prevY+R ≤ p.y ≤ y+R`) and `|x − px| ≤ w/2 + 0.4R`. If several qualify, the highest wins. Landing refills both charges and records a fall if the landing is 4 m or more below `fromY`. Bouncy pads instead set `vy = −clamp(0.9·impact, 1250, MAX_LAUNCH)`.
- **Launch:** speed = `380 + (MAX_LAUNCH − 380)·power`, with `MAX_LAUNCH = √(2·g·PEAK)`. Direction is the unit vector from the current drag point back to its start.
- **Charges:** a launch uses one; while below 2, `refill += dt/3` and a full refill adds a charge.
- **Invariant (asserted in `config.js`):** `2·MAX_LAUNCH/g < REFILL_TIME`, so flinging on the timer alone cannot keep the player in the air.
- **Hazard hit:** charges = 0, refill = 0, ground = null, `vx ×= 0.15`, `vy = max(vy, 150)`, 1 s grace period.

## 6. Tower generation

### 6.1 Determinism
- Seed = FNV-1a hash of `"upfall:YYYY-MM-DD"` (local date) → **mulberry32**. The daily hue is the RNG's first draw.
- Generation is **strictly sequential** and depends only on the RNG and earlier output, never on game state or screen size (`PEAK` is a constant for this reason). Platform `id` = position in the array, so `{id, offset}` is a stable save reference.
- Decoration (background shapes) uses a stateless `hash01(n)`, so it never consumes draws from the tower RNG.

### 6.2 `Tower.step()`: one main platform per call
1. `h` = height of the previous main platform (m); difficulty `d = clamp(h/800, 0, 1)`.
2. Rest ledge if `k % round(lerp(6,13,d)) == 0`. Otherwise roll a tier: hard (`h ≥ 40`, probability `lerp(.1,.35,d)`), medium (`lerp(.3,.45,d)`), or easy.
3. Vertical gap `dy` from the tier (multiples of PEAK). Horizontal **reach** = fraction × `2·√(P·(P−dy))`, which is the launch envelope's half-width at height `dy`. Hard gaps take the second fling into account.
4. Width and type (moving / crumbling / bouncy probabilities depend on height); the x position is chosen inside `from.x ± reach`, pushed sideways when it would stack straight up.
5. **Doors:** if the new y lies within 50 units of a door height, it's moved below the door (or above it if the gap would be too small). Any door the generator has now passed is added as a `door` platform.
6. Optional side ledge, spike/saw, and wall spikes (see 6.3).

`ensureUpTo(y)` generates until the last main platform is one screen above `y`. `ensurePlatform(id)` generates until a saved id exists.

### 6.3 Hazard placement rules
- Spikes and saws: x outside the **path column** (the horizontal span of both platforms + 40), y strictly between the two platforms (including the saw's sweep), clear of all platforms and doors. Up to 8 attempts, then give up.
- Wall spikes: only on a wall the path column stays at least 90 units away from, with no platform touching that wall in the range and no door inside it.
- Side ledges: at least 150 units from the path's midpoint, not near a hazard or a door.

### 6.4 Doors
- `doorHeight(n) = 50 + 25·n·(n+1)` m → 100, 200, 350, 550, 800…
- A door platform is full width and of type `door`, with index `n`. **Whether it's open is not stored**: `solid(door) = door.n < nextDoor`, where `nextDoor = nextDoorIndex(save.best)`. Reloading the save restores open doors for free, and a new day (best = 0) closes them all.
- When `best` passes `doorHeight(nextDoor)`, the scene increments `nextDoor`, sets `door.openT` for the sweep animation, and shows a banner.

### 6.5 Spatial index
`Grid` buckets objects into 600-unit vertical bands. Physics queries ±40–140 units around the player; drawing queries the camera view. A per-query stamp removes duplicates for objects that span bands (wall spikes, saws).

### 6.6 Runtime platform state
Crumble timing is stored lazily on the platform (`crumbleAt`); `solid(p)` reports broken between `crumbleAt` and `crumbleAt + 3.5 s`, then resets. Moving platform and saw positions are pure functions of simulation time: `x + amp·sin(t·speed + phase)`.

## 7. Input

- Scene-level `pointerdown` / `pointermove` / `pointerup` (plus `pointerupoutside`). Pointer-down starts a drag anywhere, unless the pointer is over an interactive object (pause button, menu) or the game is paused.
- `aim()` returns `{x, y, power}` or null inside the 16-unit dead zone. Releasing calls `tryLaunch`, which plays a "click" instead of launching when no charge is left. A drag held until a charge refills launches on release.
- The first touch also unlocks WebAudio and dismisses the title card.

## 8. Persistence

`localStorage["upfall.save.v1"]`:

```json
{
  "day": "2026-10-08",
  "pos": { "id": 38, "offset": -12.5 },
  "best": 214.7, "falls": 9, "bigFall": 31.2, "climbed": 640.3,
  "streak": 3,
  "history": { "2026-10-06": 180.2, "2026-10-07": 260.9 },
  "muted": false
}
```

- **Load / rollover:**
  - If `day` is today, all fields are restored.
  - Otherwise the old day's best goes into `history`, and the streak becomes +1 if the old day was yesterday, or resets to 1.
  - History is pruned to 30 days. Every field is validated, so a corrupt save starts fresh.
- **When it saves:**
  - 1 s after any landing (debounced)
  - on `visibilitychange` (hidden)
  - on `pagehide`
  - on menu actions
- **Position = last landing**, never mid-air. A tab that becomes visible on a new date saves and restarts the scene, which loads the new tower.
- If storage is unavailable (private mode, quota), the game keeps running without saving.

## 9. Rendering

- **Immediate mode:** two `Graphics` objects are cleared and redrawn every frame. One is the background, fixed to the screen with parallax done by hand; the other is the world. Only objects in view are drawn.
- **Palette:** HSL computed from the daily hue plus 0.11 per 100 m of camera height. The page `<body>` background follows the palette so the side bars match.
- The player is a manually built, rotated ellipse (24 points), avoiding Graphics transform support that differs between WebGL and Canvas.
- **Text:** small pools of world-space `Text` objects for height markers, door labels and the best line; screen-space `Text` for the HUD and menus.

## 10. UI and audio

- `Hud`: best / next door / now labels; a banner queue (NEW BEST, DOOR …).
- `Menu`: screen-fixed objects shown together, with a dim layer that captures input; the 7-day chart is drawn from `history` plus today; copy uses `navigator.clipboard` with a fallback for older browsers; restarting needs a second tap.
- `audio.js`: one oscillator and one gain envelope per sound into a master gain; nothing plays until a user gesture unlocks the context; mute is stored in the save. `buzz()` wraps `navigator.vibrate`.

## 11. Performance

- Per frame: about 10–60 drawing primitives, one simulation step every 8 ms, and grid queries that stay small.
- Generation is incremental and cheap: one step per roughly 9 m climbed. The tower keeps every generated platform in memory (a few hundred small objects for a very long climb).
- No textures; the bundle is dominated by Phaser itself.

## 12. Verification

`npm run verify [dates…]` runs in Node with the game's own modules:

1. **Determinism:** two independent generations of the same date must match exactly.
2. **Reachability:** for each pair of consecutive main platforms up to 1200 m, it brute-forces launch angles and powers from several start points with `integrate()` at 1/120 s. If no single launch works, it tries a full upward launch followed by a second fling from the apex. It counts any route that lands on the target without touching a hazard (saws are treated as their whole sweep). Moving targets are skipped because they depend on timing.

The deploy workflow runs it before building.

## 13. Deployment

GitHub Actions (`.github/workflows/deploy.yml`) runs `npm ci` → `npm run verify` → `npm run build` and publishes `dist/` to GitHub Pages on every push to `main`. The relative `base` makes the same build work at `https://<user>.github.io/<repo>/`.

## 14. Known limitations

- Closing the tab mid-fall restores the last landing, so a reload can undo a fall. Accepted, since there is no leaderboard.
- Saves are per browser and per origin; clearing site data resets them.
- Playing in two tabs at once makes them overwrite each other's save (the last write wins).
- Reachability for moving platforms is not checked automatically.
