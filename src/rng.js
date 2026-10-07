export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Stateless hash of an integer to [0, 1), for decoration that must not consume the tower RNG.
export function hash01(n) {
  let t = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  t ^= t >>> 13;
  t = Math.imul(t, 0xc2b2ae35);
  t ^= t >>> 16;
  return (t >>> 0) / 4294967296;
}

// mulberry32
export class Rng {
  constructor(seed) {
    this.s = seed >>> 0;
  }

  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a, b) {
    return a + (b - a) * this.next();
  }

  chance(p) {
    return this.next() < p;
  }
}

// Local calendar date, so a new tower starts at the player's own midnight.
export function dayKey(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftDay(key, days) {
  const date = parseDay(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

export function formatDay(key) {
  return parseDay(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Smooth 1D gradient noise in about [-1, 1]; slow, curvy motion without the pauses of value noise.
export function noise1(seed, t) {
  const i = Math.floor(t);
  const f = t - i;
  const g0 = hash01(seed * 7919 + i) * 2 - 1;
  const g1 = hash01(seed * 7919 + i + 1) * 2 - 1;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  const a = g0 * f;
  return 2 * (a + (g1 * (f - 1) - a) * u);
}
