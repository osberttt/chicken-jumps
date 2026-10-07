# Upfall

Endless vertical slingshot climber for mobile browsers, built with Phaser 3. Offline, single player, abstract shapes.

- Drag anywhere and release to fling the blob; a longer drag gives more power. It bounces off the side walls.
- Two flings: landing anywhere refills both; otherwise one refills every 3 seconds. Aiming mid-air slows time.
- Hazards never kill: they stop you and drain your flings, so you fall. A miss can drop you a long way.
- Doors at 100, 200, 350, 550, 800m…: once you pass one, you can't fall below it today.
- No death, no end. Score is today's best height.
- One tower per day for everyone (seeded by the local date). Your position is saved in the browser; the same day resumes where you left off, a new day starts a new tower from the bottom.

## Run

```sh
npm install
npm run dev      # dev server, also reachable from a phone on the same network
npm run build    # static build in dist/ (relative paths, works from any folder or itch.io)
npm run preview  # serve the build
npm run verify   # headless check that every generated tower is deterministic and climbable
```

Pushing to `main` on GitHub deploys to GitHub Pages via `.github/workflows/deploy.yml`
(set **Settings → Pages → Source** to **GitHub Actions** once).

Docs: [Game Design Document](docs/GDD.md) · [System Design](docs/SYSTEM_DESIGN.md)

## Code map

- `src/config.js` – tuning constants (gravity, launch speeds, refill time, drag lengths)
- `src/tower.js` – daily tower generator (path-first platform placement, hazards beside the path)
- `src/physics.js` – flight integration and the aim preview
- `src/GameScene.js` – input, simulation, landing/hazards, camera, saving
- `src/draw.js` – all rendering (shapes only, palette drifts with height)
- `src/ui.js` – HUD, intro card, pause menu (stats, 7-day chart, copy result, restart)
- `src/save.js` – localStorage save with daily rollover, history and streak
- `src/audio.js` – synthesized sound effects (no audio files)
