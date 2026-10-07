# save.js

Loads and stores the save in `localStorage`. The game only remembers stats and best heights, not where you are: every page load starts at 0 m.

## Exports

| Export | What it does |
|---|---|
| `load(today)` | Reads the save, validates every field, rolls it over if it's from an earlier day, and returns the save object. Never throws. |
| `store(save)` | Writes the save. Silently does nothing if storage is unavailable (private mode, full quota). |

## Storage

- **Key:** `chickenjumps.save.v1`.
- **Old name:** if that key is missing, `load` reads `upfall.save.v1` once, so saves from before the rename carry over. The next `store` removes the old key.

```json
{
  "day": "2026-10-08",
  "best": 214.7,
  "falls": 9,
  "bigFall": 31.2,
  "climbed": 640.3,
  "deaths": 2,
  "streak": 3,
  "history": { "2026-10-06": 180.2, "2026-10-07": 260.9 },
  "muted": false
}
```

| Field | Meaning |
|---|---|
| `day` | The day these stats belong to (local date). |
| `best` | Today's best height (m). Also decides which doors are open: see [GameScene → Doors](GameScene.md#doors-and-colors). |
| `falls` | Landings more than 4 m below where the flight started. |
| `bigFall` | Longest such fall (m). |
| `climbed` | Total meters travelled upward today. |
| `deaths` | Times all hearts were lost today. |
| `streak` | Days in a row played. |
| `history` | Best height per past day, at most 30 days. |
| `muted` | Sound off. Kept across days. |

## Rollover

When the stored `day` isn't today:

- The old day's best goes into `history` (keeping the higher value if that day is already there).
- The streak becomes `old + 1` if the old day was yesterday, otherwise 1.
- Today's stats start at zero.

The scene also checks the date when the tab becomes visible again. If it changed, it restarts, which calls `load` again.

## Adding a field

1. Add it with a default to the `save` object in `load`.
2. Restore it in the `raw.day === today` branch with `num()` (or your own check). Saved data can be anything, so validate it.
3. If it should survive across days, like `muted`, read it outside that branch.

If you ever change the meaning of an existing field, bump the key (`v2`) or migrate it in `load`.
