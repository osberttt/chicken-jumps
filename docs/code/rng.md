# rng.js

Seeded randomness, hashing, smooth noise and date helpers. No Phaser, no DOM.

## Exports

| Export | What it does |
|---|---|
| `hashString(str)` | FNV-1a 32-bit hash. Turns `"chickenjumps:YYYY-MM-DD"` into the tower's seed. |
| `hash01(n)` | Stateless hash of an integer to `[0, 1)`. For decoration that must look random but stay stable without using an RNG stream: background shapes, funnel specks. |
| `Rng` | mulberry32 generator: `next()` → `[0, 1)`, `range(a, b)`, `chance(p)`. Small, fast and the same in every browser and Node. |
| `noise1(seed, t)` | Smooth 1D gradient (Perlin-style) noise, roughly −1 to 1, with no pauses at the integer points. Hearts use it to drift on slow, curvy paths. |
| `dayKey(date)` | `YYYY-MM-DD` in **local** time, so a new tower starts at the player's own midnight. |
| `parseDay(key)`, `shiftDay(key, days)`, `formatDay(key)` | Parse a key to a `Date`, move it by whole days, format it like "Oct 8" in the user's locale. |

## Notes

- Never use `Math.random()` for anything that must be the same for every player (the tower). Use the tower's `Rng` streams, or `hash01` for decoration.
- `Math.random()` is fine for effects (particles). Gameplay doesn't use it.
