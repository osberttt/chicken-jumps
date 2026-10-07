import * as C from './config.js';
import { Rng, hashString, noise1 } from './rng.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

// Door heights in meters: 100, 200, 350, 550, 800, 1100, ... The gap grows by 50m each time
// (an ease-in curve), and 25·n·(n+1) is always a multiple of 50.
export function doorHeight(n) {
  return 50 + 25 * n * (n + 1);
}

// Index of the first door above `heightM`.
export function nextDoorIndex(heightM) {
  let n = 1;
  while (doorHeight(n) <= heightM) n++;
  return n;
}

export function platformX(p, t) {
  return p.amp ? p.x + p.amp * Math.sin(t * p.speed + p.phase) : p.x;
}

export function hazardPos(hz, t) {
  return hz.amp ? [hz.x, hz.y + hz.amp * Math.sin(t * hz.speed + hz.phase)] : [hz.x, hz.y];
}

// Path [x0, y0, x1, y1] through a funnel's tube. The funnel's mouth is at y and faces down;
// the cone narrows into a straight tube that rises from it, open at the top, where you get fired out.
export function funnelTube(x, y) {
  const neck = y - C.FUNNEL_D;
  return [x, neck, x, neck - C.FUNNEL_TUBE];
}

// Hearts drift around their spot on slow, smooth noise.
export function heartPos(ht, t) {
  const x = clamp(ht.x + 70 * noise1(ht.seed, t * 0.45), C.WALL + 24, C.W - C.WALL - 24);
  return [x, ht.y + 45 * noise1(ht.seed + 1, t * 0.4)];
}

// Buckets objects by vertical band so physics and drawing only touch what is near.
class Grid {
  constructor(size) {
    this.size = size;
    this.cells = new Map();
    this.stamp = 0;
  }

  add(obj, y0, y1) {
    for (let c = Math.floor(y0 / this.size); c <= Math.floor(y1 / this.size); c++) {
      let cell = this.cells.get(c);
      if (!cell) this.cells.set(c, (cell = []));
      cell.push(obj);
    }
  }

  query(y0, y1, out) {
    out.length = 0;
    const stamp = ++this.stamp;
    for (let c = Math.floor(y0 / this.size); c <= Math.floor(y1 / this.size); c++) {
      const cell = this.cells.get(c);
      if (!cell) continue;
      for (const obj of cell) {
        if (obj._q === stamp) continue;
        obj._q = stamp;
        out.push(obj);
      }
    }
    return out;
  }
}

// The day's tower. Generation is sequential from the date seed, so every player gets the
// same platforms and a reload rebuilds the exact tower (platform ids stay stable for saves).
//
// Path-first: each main platform is placed inside the reach of a launch from the previous
// one, so the tower is always climbable. Hazards are kept out of the column the path uses.
export class Tower {
  constructor(day) {
    this.day = day;
    this.seed = hashString(`chickenjumps:${day}`);
    this.rng = new Rng(this.seed);
    this.hue = this.rng.next();
    this.platforms = [];
    this.hazards = [];
    this.platGrid = new Grid(600);
    this.hazGrid = new Grid(600);
    this.hearts = [];
    this.heartGrid = new Grid(600);
    // Hearts and stars use their own stream so they never change the platforms or hazards.
    this.itemRng = new Rng(this.seed ^ 0x5bd1e995);
    this.stars = [];
    this.starGrid = new Grid(600);
    this.funnels = [];
    this.funnelGrid = new Grid(600);
    this.zones = []; // boxes around funnels, kept clear of everything else
    this.portals = [];
    this.portalGrid = new Grid(600);
    this.pendingPortal = null; // a blue portal waiting for its yellow exit higher up
    this.count = 0;
    this.doors = []; // doors[n] is the full-width floor at doorHeight(n)
    this.scratch = [];
    this.addPlatform({ x: C.W / 2, y: 0, w: C.W, type: 'ground' });
    // Tutorial: a full-width bar one jump up, then one only the double jump reaches.
    // The generated tower starts from the second.
    this.tutorial = C.TUTORIAL_BARS.map((y) => this.addPlatform({ x: C.W / 2, y: -y, w: C.W, type: 'ground' }));
    this.lastMain = this.tutorial[this.tutorial.length - 1];
  }

  addPlatform(p) {
    p.id = this.platforms.length;
    p.crumbleAt = null;
    this.platforms.push(p);
    this.platGrid.add(p, p.y - 4, p.y + 4);
    return p;
  }

  addHazard(hz) {
    this.hazards.push(hz);
    if (hz.kind === 'wall') this.hazGrid.add(hz, hz.y0, hz.y1);
    else this.hazGrid.add(hz, hz.y - hz.r - hz.amp, hz.y + hz.r + hz.amp);
  }

  platformsIn(y0, y1, out) {
    return this.platGrid.query(y0, y1, out);
  }

  hazardsIn(y0, y1, out) {
    return this.hazGrid.query(y0, y1, out);
  }

  heartsIn(y0, y1, out) {
    return this.heartGrid.query(y0, y1, out);
  }

  funnelsIn(y0, y1, out) {
    return this.funnelGrid.query(y0, y1, out);
  }

  portalsIn(y0, y1, out) {
    return this.portalGrid.query(y0, y1, out);
  }

  starsIn(y0, y1, out) {
    return this.starGrid.query(y0, y1, out);
  }

  // Keep at least one screen of tower generated above y.
  ensureUpTo(y) {
    while (this.lastMain.y > y - C.H) this.step();
  }

  step() {
    const r = this.rng;
    const from = this.lastMain;
    const k = ++this.count;
    const h = -from.y / C.PX_PER_M;
    const d = clamp(h / 800, 0, 1); // difficulty ramps over the first 800m
    const P = C.PEAK;

    // Wide rest ledges give rhythm and catch falls; they get rarer higher up.
    const isRest = k % Math.round(lerp(6, 13, d)) === 0;
    let tier = 'easy';
    if (!isRest && h > 12) {
      const pHard = h < 40 ? 0 : lerp(0.1, 0.35, d);
      const pMed = lerp(0.3, 0.45, d);
      const roll = r.next();
      tier = roll < pHard ? 'hard' : roll < pHard + pMed ? 'medium' : 'easy';
    }

    // Vertical gap and how far sideways the next platform may sit. A launch reaches
    // horizontally 2·sqrt(P·(P−dy)) at height dy; we only use a fraction of that.
    let dy, reach;
    if (tier === 'hard') {
      // Above a single launch's peak: needs the second, mid-air fling.
      dy = P * r.range(1.0, 1.3);
      reach = 2 * Math.sqrt(P * (P - (dy - P * 0.85))) * 0.55;
    } else {
      dy = P * (tier === 'easy' ? r.range(0.28, 0.5) : r.range(0.5, 0.78));
      reach = 2 * Math.sqrt(P * (P - dy)) * (tier === 'easy' ? 0.5 : 0.7);
    }

    let w = isRest ? r.range(290, 350) : lerp(250, 150, d) * r.range(0.85, 1.15);
    let type = 'normal';
    if (!isRest && h > 8) {
      const pBouncy = h >= C.BOUNCY_FROM ? 0.18 : 0;
      const pMove = h > 40 ? lerp(0.12, 0.25, d) : 0;
      const pCrumble = h > 80 ? lerp(0.1, 0.22, d) : 0;
      const roll = r.next();
      if (roll < pBouncy) type = 'bouncy';
      else if (roll < pBouncy + pMove) type = 'moving';
      else if (roll < pBouncy + pMove + pCrumble) type = 'crumble';
    }
    if (type === 'bouncy') w = Math.min(w, 150);

    const minC = C.WALL + w / 2 + 4;
    const maxC = C.W - C.WALL - w / 2 - 4;
    const lo = from.type === 'ground' ? minC : Math.max(minC, from.x - reach);
    const hi = from.type === 'ground' ? maxC : Math.min(maxC, from.x + reach);
    let x = hi > lo ? r.range(lo, hi) : clamp(from.x, minC, maxC);
    // Avoid boring straight-up stacks when there is room to shift.
    if (Math.abs(x - from.x) < 70 && hi - lo > 200) {
      const shift = r.range(70, 140);
      x = x < from.x ? Math.max(lo, from.x - shift) : Math.min(hi, from.x + shift);
    }

    // Keep platforms clear of door floors: drop one that would overlap a door just below it,
    // or lift it above the door when that would leave too small a gap.
    let y = from.y - dy;
    const door = this.doorNear(y, 50);
    if (door !== null) y = from.y - (door + 50) > 120 ? door + 50 : door - 50;

    this.addDoorsUpTo(y);

    const p = { x, y, w, type };
    if (type === 'moving') {
      const amp = Math.min(r.range(50, 110), x - minC, maxC - x);
      if (amp < 30) p.type = 'normal';
      else {
        p.amp = amp;
        p.speed = TAU / r.range(2.6, 4.4);
        p.phase = r.range(0, TAU);
      }
    }
    this.addPlatform(p);
    this.lastMain = p;

    if (!isRest && r.chance(lerp(0.45, 0.2, d))) this.addSideLedge(from, p, h);
    if (h >= C.SPIKES_FROM && r.chance(lerp(0.25, 0.65, d))) this.addSpike(from, p, h);
    if (h >= C.SPIKES_FROM && r.chance(0.12)) this.addWallSpikes(from, p);
    this.placePortals(from, p, h >= C.PORTALS_FROM && r.chance(0.15));
    if (h >= C.FUNNELS_FROM && r.chance(0.12)) this.addFunnel(from, p);
    this.addHeart(from, p, h);
    this.addStar(from, p, h);
  }

  // Doors are added as generation passes them, so their platform ids stay deterministic.
  addDoorsUpTo(y) {
    let next = this.doors.length || 1;
    while (-doorHeight(next) * C.PX_PER_M >= y) {
      this.doors[next] = this.addPlatform({ x: C.W / 2, y: -doorHeight(next) * C.PX_PER_M, w: C.W - 2 * C.WALL, type: 'door', n: next });
      next++;
    }
  }

  // A funnel: a cone with its mouth facing down and a tube rising from its tip. Shoot up into
  // the mouth and it carries you up the tube and fires you high, leaning toward the middle.
  addFunnel(from, to) {
    const r = this.rng;
    const half = C.FUNNEL_W / 2;
    const rise = r.range(450, 650);
    const speed = r.range(60, 180);
    let spot = null;
    for (let i = 0; i < 12 && !spot; i++) {
      const x = r.range(C.WALL + half + 20, C.W - C.WALL - half - 20);
      // y is the mouth. The tube's top stays at least 120px under the next main platform's
      // lowest possible spot, and the mouth 80px above `from` so it can be shot into.
      const top = C.FUNNEL_D + C.FUNNEL_TUBE;
      const y = r.range(to.y + top - 120, from.y - 80);
      if (y < to.y + top - 120) return;
      const cy = y - top / 2;
      if (this.platformNear(x, cy, half + 40, top / 2 + 40) || this.hazardNear(x, cy, half + 40, top / 2 + 40)) continue;
      if (this.doorNear(cy, top / 2 + 60) !== null || this.portalNear(x, cy, top / 2 + 60) || this.inZone(x, cy, top / 2 + 20)) continue;
      spot = { x, y };
    }
    if (!spot) return;
    const { x, y } = spot;
    const side = x < C.W / 2 ? 1 : -1;
    const f = { x, y, side, tube: funnelTube(x, y), vx: side * speed, vy: -Math.sqrt(2 * C.GRAVITY * rise) };
    this.funnels.push(f);
    const top = y - C.FUNNEL_D - C.FUNNEL_TUBE;
    this.funnelGrid.add(f, top - 30, y + 10);
    this.zones.push({ x0: x - half - 40, x1: x + half + 40, y0: top - 40, y1: y + 40 });
  }

  inZone(x, y, pad) {
    for (let i = this.zones.length - 1; i >= 0 && i >= this.zones.length - 4; i--) {
      const z = this.zones[i];
      if (x + pad > z.x0 && x - pad < z.x1 && y + pad > z.y0 && y - pad < z.y1) return true;
    }
    return false;
  }

  // A spot beside the path between `from` and `to` (outside the column the climb uses),
  // clear of platforms, hazards, doors, funnels and portals.
  clearSpot(from, to, rad, minY = -Infinity) {
    const r = this.rng;
    const x0 = Math.min(from.x - from.w / 2, to.x - to.w / 2) - 40;
    const x1 = Math.max(from.x + from.w / 2, to.x + to.w / 2) + 40;
    // Ten tries beside the column, then ten anywhere.
    for (let i = 0; i < 20; i++) {
      const x = r.range(C.WALL + rad + 8, C.W - C.WALL - rad - 8);
      const yMin = Math.max(to.y + rad + 30, minY);
      const yMax = from.y - rad - 40;
      if (yMax <= yMin) return null;
      const y = r.range(yMin, yMax);
      if (i < 10 && x + rad > x0 && x - rad < x1) continue;
      if (this.platformNear(x, y, rad + 30, rad + 40) || this.hazardNear(x, y, rad + 30, rad + 30)) continue;
      if (this.doorNear(y, rad + 60) !== null || this.inZone(x, y, rad + 10) || this.portalNear(x, y, rad * 3)) continue;
      return { x, y };
    }
    return null;
  }

  // Portals come in pairs: blue beside the path, yellow 17–33m higher. They only work one way,
  // blue to yellow, as a shortcut up. A pair never straddles a door.
  placePortals(from, to, wantNew) {
    const r = this.rng;
    const R = C.PORTAL_R;
    const pend = this.pendingPortal;
    if (pend) {
      if (to.y > pend.y) return;
      const spot = this.clearSpot(from, to, R + 14, pend.minY);
      if (!spot) {
        // No room for the exit within a few platforms: drop the blue portal instead.
        if (++pend.tries >= 4) {
          pend.blue.gone = true;
          this.pendingPortal = null;
        }
        return;
      }
      const yellow = this.addPortal({ color: 'yellow', ...spot, pair: pend.blue });
      pend.blue.pair = yellow;
      this.pendingPortal = null;
      return;
    }
    if (!wantNew) return;
    const spot = this.clearSpot(from, to, R + 14);
    if (!spot) return;
    let target = spot.y - r.range(700, 1300);
    let minY = -Infinity;
    const door = this.doorBetween(target, spot.y);
    if (door !== null) {
      target = door + 160;
      minY = door + 80;
      if (spot.y - target < 450) return;
    }
    const blue = this.addPortal({ color: 'blue', ...spot, pair: null });
    this.pendingPortal = { y: target, minY, blue, tries: 0 };
  }

  addPortal(pt) {
    this.portals.push(pt);
    this.portalGrid.add(pt, pt.y - C.PORTAL_R, pt.y + C.PORTAL_R);
    return pt;
  }

  portalNear(x, y, pad) {
    for (const pt of this.portalsIn(y - pad, y + pad, this.scratch)) if (Math.abs(pt.x - x) < pad && Math.abs(pt.y - y) < pad) return true;
    return false;
  }

  // y (px) of the lowest door strictly between y0 (higher) and y1 (lower), or null.
  doorBetween(y0, y1) {
    for (let n = 1; ; n++) {
      const dy = -doorHeight(n) * C.PX_PER_M;
      if (dy < y0) return null;
      if (dy < y1) return dy;
    }
  }

  addHeart(from, to, h) {
    const r = this.itemRng;
    const roll = r.next();
    const x = r.range(C.WALL + 60, C.W - C.WALL - 60);
    const y = lerp(from.y, to.y, r.range(0.3, 0.8));
    const seed = Math.floor(r.range(0, 1e6));
    if (h < C.HEARTS_FROM || roll > C.HEART_CHANCE || this.hazardNear(x, y, 110, 90) || this.inZone(x, y, 60) || this.portalNear(x, y, 80)) return;
    const ht = { x, y, seed, seenT: null, gone: false };
    this.hearts.push(ht);
    this.heartGrid.add(ht, y - 60, y + 60);
  }

  // Stars (+1 jump) hang in the air along the climb, more often across the big gaps.
  addStar(from, to, h) {
    const r = this.itemRng;
    const roll = r.next();
    const x = clamp(lerp(from.x, to.x, r.range(0.3, 0.7)) + r.range(-40, 40), C.WALL + 30, C.W - C.WALL - 30);
    const y = lerp(from.y, to.y, r.range(0.45, 0.7));
    const big = from.y - to.y > C.PEAK * 0.7;
    if (h < C.STARS_FROM || roll > (big ? 0.5 : 0.1)) return;
    if (this.hazardNear(x, y, 50, 50) || this.inZone(x, y, 30) || this.portalNear(x, y, 70) || this.platformNear(x, y, 30, 40)) return;
    const st = { x, y, takenT: null };
    this.stars.push(st);
    this.starGrid.add(st, y - 20, y + 20);
  }

  // Optional ledge off to the side: a stepping stone or a place to land after a miss.
  addSideLedge(from, to, h) {
    const r = this.rng;
    const w = r.range(80, 140);
    const crumble = h > 80 && r.chance(0.3);
    const y = from.y - (from.y - to.y) * r.range(0.35, 0.7);
    const minC = C.WALL + w / 2 + 4;
    const maxC = C.W - C.WALL - w / 2 - 4;
    const mid = (from.x + to.x) / 2;
    const x = clamp(mid < C.W / 2 ? r.range(mid + 150, maxC) : r.range(minC, mid - 150), minC, maxC);
    if (this.hazardNear(x, y, w / 2 + 40, 70) || this.doorNear(y, 50) !== null) return;
    if (this.inZone(x, y, w / 2 + 20) || this.portalNear(x, y, w / 2 + 50)) return;
    this.addPlatform({ x, y, w, type: crumble ? 'crumble' : 'normal' });
  }

  // Spiky ball beside the path, never in the column between `from` and `to`.
  addSpike(from, to, h) {
    const r = this.rng;
    const x0 = Math.min(from.x - from.w / 2, to.x - to.w / 2) - 40;
    const x1 = Math.max(from.x + from.w / 2, to.x + to.w / 2) + 40;
    for (let i = 0; i < 8; i++) {
      const rad = r.range(16, 26);
      const amp = h > 150 && r.chance(0.4) ? r.range(40, 90) : 0;
      const x = r.range(C.WALL + rad + 8, C.W - C.WALL - rad - 8);
      const yMin = to.y + rad + amp + 20;
      const yMax = from.y - rad - amp - 40;
      if (yMax <= yMin) return;
      const y = r.range(yMin, yMax);
      if (x + rad > x0 && x - rad < x1) continue;
      if (this.platformNear(x, y, rad + 30, rad + amp + 60)) continue;
      if (this.doorNear(y, rad + amp + 70) !== null) continue;
      if (this.inZone(x, y, rad + amp + 30) || this.portalNear(x, y, rad + amp + 70)) continue;
      this.addHazard({ kind: amp ? 'saw' : 'spike', x, y, r: rad, amp, speed: TAU / r.range(2, 3.5), phase: r.range(0, TAU) });
      return;
    }
  }

  // Spikes on a wall segment: punishes careless bank shots.
  addWallSpikes(from, to) {
    const r = this.rng;
    const x0 = Math.min(from.x - from.w / 2, to.x - to.w / 2);
    const x1 = Math.max(from.x + from.w / 2, to.x + to.w / 2);
    const side = r.chance(0.5) ? -1 : 1;
    if (side < 0 ? x0 < C.WALL + 90 : x1 > C.W - C.WALL - 90) return;
    const span = from.y - to.y - 80;
    if (span < 100) return;
    const len = Math.min(span, r.range(110, 240));
    const y0 = to.y + 40 + r.range(0, span - len);
    if (this.doorNear(y0 + len / 2, len / 2 + 60) !== null) return;
    const wallX = side < 0 ? C.WALL : C.W - C.WALL;
    if (this.inZone(wallX, y0 + len / 2, len / 2 + 60)) return;
    for (const p of this.platformsIn(y0 - 40, y0 + len + 40, this.scratch)) {
      const px0 = p.x - p.w / 2 - (p.amp || 0);
      const px1 = p.x + p.w / 2 + (p.amp || 0);
      if (p.y > y0 - 40 && p.y < y0 + len + 40 && (side < 0 ? px0 < wallX + 50 : px1 > wallX - 50)) return;
    }
    this.addHazard({ kind: 'wall', side, y0, y1: y0 + len });
  }

  // y (px) of a door floor within `pad` of y, or null.
  doorNear(y, pad) {
    for (let n = 1; ; n++) {
      const dy = -doorHeight(n) * C.PX_PER_M;
      if (Math.abs(dy - y) < pad) return dy;
      if (dy < y - pad) return null;
    }
  }

  platformNear(x, y, padX, padY) {
    for (const p of this.platformsIn(y - padY, y + padY, this.scratch)) {
      const half = p.w / 2 + (p.amp || 0);
      if (Math.abs(p.y - y) < padY && x + padX > p.x - half && x - padX < p.x + half) return true;
    }
    return false;
  }

  hazardNear(x, y, padX, padY) {
    for (const hz of this.hazardsIn(y - padY - 120, y + padY + 120, this.scratch)) {
      if (hz.kind === 'wall') continue;
      if (Math.abs(hz.y - y) < padY + hz.r + hz.amp && Math.abs(hz.x - x) < padX + hz.r) return true;
    }
    return false;
  }
}
