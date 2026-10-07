import { shiftDay } from './rng.js';

const KEY = 'upfall.save.v1';
const HISTORY_DAYS = 30;

const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

// Loads the save and rolls it over to `today`: a save from an earlier day is archived
// into history and the climb starts again from the bottom of the new tower.
export function load(today) {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY));
  } catch {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') raw = {};

  const history = raw.history && typeof raw.history === 'object' ? { ...raw.history } : {};
  const save = {
    day: today,
    pos: null,
    best: 0,
    falls: 0,
    bigFall: 0,
    climbed: 0,
    streak: 1,
    history,
    muted: !!raw.muted,
  };

  if (raw.day === today) {
    const pos = raw.pos;
    save.pos = pos && Number.isInteger(pos.id) && pos.id >= 0 ? { id: pos.id, offset: num(pos.offset) } : null;
    save.best = num(raw.best);
    save.falls = num(raw.falls);
    save.bigFall = num(raw.bigFall);
    save.climbed = num(raw.climbed);
    save.streak = Math.max(1, num(raw.streak, 1));
  } else {
    if (typeof raw.day === 'string') history[raw.day] = Math.max(num(history[raw.day]), num(raw.best));
    save.streak = raw.day === shiftDay(today, -1) ? num(raw.streak) + 1 : 1;
  }

  const keys = Object.keys(history).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - HISTORY_DAYS))) delete history[k];
  return save;
}

export function store(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage can be unavailable (private mode, quota); the game keeps running without it.
  }
}
