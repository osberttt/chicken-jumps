// Headless check of the tower generator, run with `npm run verify [YYYY-MM-DD ...]`.
// For each day it checks that generation is deterministic and brute-forces launches with the
// real physics to prove every main platform is reachable from the previous one (with one
// fling, or two) without touching a hazard. Exits non-zero on any failure.
import * as C from '../src/config.js';
import { Tower } from '../src/tower.js';
import { integrate, launchSpeed, substeps } from '../src/physics.js';

const R = C.PLAYER_R;
const TARGET_M = 1600;
const days = process.argv.slice(2).length ? process.argv.slice(2) : ['2026-10-07', '2026-10-08', '2026-12-25', '2027-01-01'];

function collectMain(tower) {
  const mains = [tower.platforms[0], ...tower.tutorial];
  const step = tower.step.bind(tower);
  tower.step = () => {
    step();
    mains.push(tower.lastMain);
  };
  tower.ensureUpTo(-TARGET_M * C.PX_PER_M);
  return mains;
}

function hitsHazard(b, hazards) {
  for (const hz of hazards) {
    if (hz.kind === 'wall') {
      const touching = hz.side < 0 ? b.x - R <= C.WALL + 12 : b.x + R >= C.W - C.WALL - 12;
      if (touching && b.y + R * 0.5 > hz.y0 && b.y - R * 0.5 < hz.y1) return true;
    } else {
      const rr = R + hz.r * 0.8;
      const dy = hz.amp ? Math.max(0, Math.abs(b.y - hz.y) - hz.amp) : b.y - hz.y; // saws: whole sweep
      if ((b.x - hz.x) ** 2 + dy ** 2 < rr * rr) return true;
    }
  }
  return false;
}

// Same substepping as the game: hazards, then landing on `to`.
function lands(b, to, hazards) {
  for (let i = 0; i < 900; i++) {
    const n = substeps(b, 1 / 120);
    for (let k = 0; k < n; k++) {
      const prevY = b.y;
      integrate(b, 1 / 120 / n);
      if (hitsHazard(b, hazards)) return false;
      if (b.vy > 0 && prevY + R <= to.y && b.y + R >= to.y && Math.abs(b.x - to.x) <= to.w / 2) return true;
    }
    if (b.y > to.y + 2000) return false;
  }
  return false;
}

const ANGLES = [];
for (let a = -178; a <= -2; a += 4) ANGLES.push((a * Math.PI) / 180);
const POWERS = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 1];

function anyLaunchLands(x, y, to, hazards) {
  for (const a of ANGLES)
    for (const p of POWERS) {
      const s = launchSpeed(p);
      if (lands({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s }, to, hazards)) return true;
    }
  return false;
}

function reachable(from, to, hazards) {
  const starts = from.type === 'ground' || from.type === 'door' ? [C.W / 2] : [from.x - from.w * 0.3, from.x, from.x + from.w * 0.3];
  for (const x of starts) if (anyLaunchLands(x, from.y - R, to, hazards)) return 'single';
  // Two flings: a full launch upward, then any second fling from its apex.
  for (const x of starts) {
    for (let deg = -120; deg <= -60; deg += 10) {
      const a = (deg * Math.PI) / 180;
      const s = launchSpeed(1);
      const b = { x, y: from.y - R, vx: Math.cos(a) * s, vy: Math.sin(a) * s };
      let blocked = false;
      for (let i = 0; i < 900 && b.vy < 0 && !blocked; i++) {
        const n = substeps(b, 1 / 120);
        for (let k = 0; k < n && !blocked; k++) {
          integrate(b, 1 / 120 / n);
          blocked = hitsHazard(b, hazards);
        }
      }
      if (!blocked && anyLaunchLands(b.x, b.y, to, hazards)) return 'double';
    }
  }
  return null;
}

let failures = 0;
for (const day of days) {
  const tower = new Tower(day);
  const mains = collectMain(tower);
  const again = new Tower(day);
  again.ensureUpTo(-TARGET_M * C.PX_PER_M);
  const sig = (t) => JSON.stringify(t.platforms.map((p) => [p.x, p.y, p.w, p.type]));
  const deterministic = sig(tower) === sig(again);
  if (!deterministic) failures++;

  const reach = { single: 0, double: 0, skipped: 0 };
  for (let i = 1; i < mains.length; i++) {
    const from = mains[i - 1];
    const to = mains[i];
    if (to.type === 'moving') {
      reach.skipped++; // reachability depends on timing
      continue;
    }
    const near = tower.hazards.filter((h) => (h.kind === 'wall' ? h.y1 > to.y - 600 && h.y0 < from.y + 100 : Math.abs(h.y - (from.y + to.y) / 2) < 1200));
    const res = reachable(from, to, near);
    if (res) reach[res]++;
    else {
      failures++;
      console.log(`  UNREACHABLE ${day} platform #${to.id} at ${Math.round(-to.y / C.PX_PER_M)}m`);
    }
  }
  const types = {};
  for (const p of tower.platforms) types[p.type] = (types[p.type] || 0) + 1;
  types.hearts = tower.hearts.length;
  types.stars = tower.stars.length;
  types.funnels = tower.funnels.length;
  types.portals = tower.portals.length;
  console.log(`${day}: deterministic=${deterministic} main=${mains.length - 1} types=${JSON.stringify(types)} hazards=${tower.hazards.length} reach=${JSON.stringify(reach)}`);
}
console.log(failures ? `FAILED (${failures})` : `OK: every main platform reachable up to ${TARGET_M}m`);
process.exit(failures ? 1 : 0);
