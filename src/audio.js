// Tiny WebAudio synth so the game needs no audio files.
let ctx = null;
let master = null;
let muted = false;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(value) {
  muted = value;
}

function tone(freq, dur, { type = 'sine', vol = 0.5, to = null, delay = 0 } = {}) {
  if (!ctx || muted || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  launch: (power) => tone(170 + 120 * power, 0.15, { type: 'triangle', to: 420 + 700 * power, vol: 0.35 }),
  land: (strength) => tone(170, 0.09, { to: 70, vol: 0.2 + 0.4 * strength }),
  wall: () => tone(520, 0.05, { type: 'square', to: 380, vol: 0.08 }),
  refill: () => tone(1046, 0.08, { vol: 0.15 }),
  empty: () => tone(140, 0.06, { type: 'square', vol: 0.06 }),
  bounce: () => tone(260, 0.18, { to: 820, vol: 0.3 }),
  crumble: () => tone(300, 0.14, { type: 'square', to: 110, vol: 0.08 }),
  hit: () => tone(210, 0.3, { type: 'sawtooth', to: 50, vol: 0.3 }),
  best: () => [660, 880, 1320].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.22, delay: i * 0.08 })),
  door: () => [392, 523, 784, 1046].forEach((f, i) => tone(f, 0.24, { type: 'triangle', vol: 0.22, delay: i * 0.09 })),
  click: () => tone(700, 0.04, { vol: 0.12 }),
};

export function buzz(ms) {
  if (muted) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Vibration is optional.
  }
}
