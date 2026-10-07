# Upfall: Game Design Document

**Genre:** endless vertical arcade climber · **Platform:** mobile browser (also desktop) · **Mode:** offline, single player · **Engine:** Phaser 3

## 1. Pitch

Fling a blob up an endless tower with one finger. Drag anywhere on the screen and release: the blob launches in the opposite direction, like a slingshot, and a longer drag gives more power. You get two flings before you must land. Nothing kills you. Missing a jump or touching a hazard only means falling, sometimes a long way. Doors are the exception: once you pass one, you can never fall below it again. There is one tower per day, the same for every player, and your progress is saved until midnight.

## 2. Design pillars

1. **One input, full expression.** Drag direction and drag length are the whole control scheme. Skill shows in power control, bank shots and fling timing, not in extra buttons.
2. **Falling is the stake, not death.** There is no game over. The tension comes from height you could lose, and doors decide how much is at risk.
3. **Come back tomorrow.** A new tower every day, a saved position within the day, a streak and a 7-day chart. The game is designed around short daily sessions.
4. **Pure abstraction.** Circles, bars and spikes. No character, story or setting. Colour and motion carry all the feel.

## 3. Core loops

| Loop | Length | Description |
|---|---|---|
| Moment | 1–3 s | Read the next platform → drag → release → (optional mid-air fling) → land, which refills both flings. |
| Climb | minutes | Chain landings upward; recover from falls; reach the next door to lock in progress. |
| Day | one session or several | Push today's best height. Leave and come back to the same spot the same day. |
| Meta | days | New tower at midnight; streak, yesterday's best and the 7-day chart pull the player back. |

## 4. Controls

- **Drag anywhere** on the screen (it doesn't have to start on the blob), then **release** to fling. The launch direction is opposite to the drag, like pulling back a slingshot.
- **Power** grows with drag length, up to 190 units. Releasing a drag shorter than 16 units cancels it.
- **Aim feedback:** the blob stretches along the pull, a rubber band line shows the power, and dots show the first half second of the flight (wall bounces included).
- **Mid-air aim:** while you drag in the air, time slows to **20%**.
- **Pause:** button at the top right (Esc on desktop).

## 5. Mechanics

### 5.1 Flings (charges)
- **2 flings.** A launch from a platform uses one; a fling in mid-air uses another.
- **Landing on any surface refills both instantly.**
- In the air, one fling refills every **3 s**, shown as an arc that sweeps full around the blob.
- **No endless flight:** a full-power vertical launch comes back down in about 1.46 s, which is less than the 3 s refill. Flinging on the timer alone always loses height, so platforms stay essential.

### 5.2 Movement
- Gravity 2400 units/s². A full fling rises **640 units (16 m)**.
- The camera keeps a standing player 580 units below the top edge, so a full vertical fling **peaks just past the top of the screen** on every device.
- **Side walls** bounce the blob, keeping 80% of its horizontal speed. One or two bounces are possible depending on power, which makes bank shots a real skill.
- **Platforms are one-way:** you pass up through them and land when falling onto their top. On landing the blob sticks; there is no sliding.

### 5.3 Platforms

| Type | Look | Behaviour | Appears from |
|---|---|---|---|
| Normal | solid bar | stand on it | start |
| Rest ledge | extra-wide bar | easy gap, catches falls | every 6–13 platforms (rarer higher up) |
| Moving | bar plus a faint track line | slides side to side and carries you | 40 m |
| Crumbling | segmented bar | shakes and breaks 0.9 s after you land, returns 3.5 s later | 80 m |
| Bouncy | rounded accent pill | throws you back up (at least 1250 units/s) and refills both flings | 8 m |
| Door | full-width floor | see 5.5 | 100 m |

Platforms are wide (about 250 units early, narrowing to about 150) so play stays quick and decisive.

### 5.4 Hazards
Hazards never kill. When touched they **stop the blob, empty both flings and restart the refill**, so the player falls until they land or 3 s pass. A 1 s grace period follows each hit.

| Hazard | Look | From |
|---|---|---|
| Spike | red star | 25 m |
| Saw | spinning red star moving up and down | 150 m |
| Wall spikes | red teeth along a wall section | 120 m |

Hazards are only placed **beside** the route between two platforms, never in it. They punish greedy bank shots and loose aim, not the obvious line.

### 5.5 Doors (checkpoints)
- Doors sit at **100, 200, 350, 550, 800, 1100, 1450, 1850, 2300, 2800 m…** The formula is `50 + 25·n·(n+1)`, an ease-in curve where each gap is 50 m longer than the last, and every height is a multiple of 50.
- A closed door is a faint dotted line labelled with its height.
- When today's best height passes a door, it **opens**: a full-width floor sweeps out from the center, with a banner, a chime and a vibration. From then on, **you can't fall below that door today.**
- The HUD always shows **"next door at N m"**.
- Doors are worked out from today's best height, so they stay open after a reload and reset when the day changes.

### 5.6 Score
- **Score = today's best height** in meters, measured to the blob's feet (40 units per meter).
- Re-passing your best after a fall shows **NEW BEST**.
- Stats tracked per day: best, falls (a landing at least 4 m below where the flight started), longest fall, total meters climbed.

## 6. Daily tower and retention

- **Seed = local calendar date.** Everyone gets the same tower on the same date. A new tower appears at the player's own midnight.
- **Midnight rule:** the date is only checked when the game loads or the tab becomes visible again, never in the middle of a climb.
- **Resume:** the last landing spot is saved. Returning the same day restores it exactly; a new day starts at the bottom of the new tower.
- **Retention hooks:**
  - a dashed line at today's best
  - a 7-day best-height chart and a day streak
  - yesterday's best on the title card
  - **Copy result**, which produces Wordle-style text to share
  - doors as visible mid-term goals
  - colour shifts as you climb (about one new hue every 100 m)
- **Restart tower** in the pause menu needs a second tap to confirm.

## 7. Level design and progression

The tower is generated **path-first**: each main platform is placed inside the reachable area of a launch from the previous one, so the tower can always be climbed. The automated check `npm run verify` confirms this up to 1200 m.

- **Difficulty** ramps from 0 to 1 over the first 800 m.
- **Gap tiers** (as a fraction of the full fling height P = 640):

| Tier | Vertical gap | Horizontal reach used | Share of jumps |
|---|---|---|---|
| Easy | 0.28–0.5 P | 50% of the launch envelope | most early jumps |
| Medium | 0.5–0.78 P | 70% of the envelope | 30% rising to 45% |
| Hard | 1.0–1.3 P | needs the mid-air fling | 0% before 40 m, then 10% rising to 35% |

- **Rhythm:** rest ledges every 6 to 13 platforms give tension and release, and also catch falls.
- **Side ledges** (45% of steps early, falling to 20%) give optional stepping stones and recovery spots.
- **Placement rules:** no hazard within reach of a door floor, and no platform within 50 units of a door.
- **The first 50–100 m is replayed every day,** so it stays fast and forgiving, with early bouncy pads for fun.

## 8. Presentation

- **Visual style:** flat abstract shapes on a dark background. The palette is generated from a daily base hue that drifts with height. White player, a light ink colour for platforms, a bright accent for bouncy pads and charges, and one red that always means hazard.
- **Feedback:**
  - squash on landing, stretch while aiming and in flight
  - a motion trail
  - particle bursts on launch, landing, wall bounces and hits
  - screen shake and a red flash on hits
  - floating "−42m" text after a big fall
  - parallax outline shapes in the background
- **Audio:** synthesized tones only, with no audio files. Launch pitch rises with power; landing thuds scale with impact; there are sounds for wall bounces, refills, bouncy pads, crumbling, hits, NEW BEST and doors. Short vibrations on supported phones.
- **HUD:** best today (large), next door, current height (shown only when below your best), pause button.
- **Screens:**
  - title card on first touch: name, date, how to play, yesterday and streak
  - pause menu: stats, 7-day chart, sound, copy result, restart

## 9. Tuning reference

| Parameter | Value |
|---|---|
| Full fling height (PEAK) | 640 units (16 m) |
| Standing distance from top edge | 580 units |
| Gravity | 2400 units/s² |
| Launch speed | 380 – 1753 units/s |
| Full-power drag | 190 units |
| Mid-air time scale | 0.2 |
| Flings / refill | 2 / 3 s each |
| Wall bounce | 0.8 |
| Crumble / respawn | 0.9 s / 3.5 s |
| Hit grace | 1 s |
| Units per meter | 40 |

All values live in `src/config.js`. Generator weights live in `src/tower.js`.

## 10. Out of scope / future ideas

- Online leaderboards (excluded by the offline requirement).
- Cosmetic blob shapes or trails unlocked by streaks.
- Daily modifiers (low gravity day, all-crumble day).
- Ghost replay of your previous best climb.
- A "practice tower" with a random seed.
