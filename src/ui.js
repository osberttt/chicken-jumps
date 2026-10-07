import * as C from './config.js';
import { formatDay, parseDay, shiftDay } from './rng.js';
import { doorHeight } from './tower.js';
import { sfx, setMuted } from './audio.js';

export function label(scene, x, y, text, size, alpha = 1, fixed = true) {
  const t = scene.add
    .text(x, y, text, { fontFamily: C.FONT, fontSize: `${size}px`, fontStyle: 'bold', color: '#ffffff', align: 'center' })
    .setOrigin(0.5)
    .setAlpha(alpha)
    .setResolution(C.RES);
  if (fixed) t.setScrollFactor(0);
  return t;
}

export class Hud {
  constructor(sc) {
    this.sc = sc;
    this.bestLabel = label(sc, C.W / 2, 34, 'BEST TODAY', 13, 0.5).setDepth(50);
    this.best = label(sc, C.W / 2, 66, '0m', 40).setDepth(50);
    this.door = label(sc, C.W / 2, 100, '', 16, 0.75).setDepth(50);
    this.now = label(sc, C.W / 2, 124, '', 15, 0.5).setDepth(50);
    this.banner = label(sc, C.W / 2, C.H * 0.34, '', 54).setDepth(60).setAlpha(0);
    this.queue = [];
    this.busy = false;
    for (const t of [this.bestLabel, this.best, this.door, this.now, this.banner]) t.setShadow(0, 2, 'rgba(0,0,0,0.55)', 8);

    const g = sc.add.graphics().setScrollFactor(0).setDepth(50);
    g.fillStyle(0xffffff, 0.55);
    g.fillRoundedRect(C.W - 54, 31, 7, 24, 2);
    g.fillRoundedRect(C.W - 41, 31, 7, 24, 2);
    this.pauseZone = sc.add
      .zone(C.W - 44, 43, 80, 80)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => sc.menu.open());
  }

  update() {
    const { save, height, nextDoor } = this.sc;
    this.best.setText(`${Math.floor(save.best)}m`);
    this.door.setText(`next door at ${doorHeight(nextDoor)}m`);
    this.now.setText(height < save.best - 1 ? `now ${Math.floor(height)}m` : '');
  }

  announce(text) {
    this.queue.push(text);
    if (!this.busy) this.next();
  }

  next() {
    const text = this.queue.shift();
    if (text === undefined) {
      this.busy = false;
      return;
    }
    this.busy = true;
    const b = this.banner;
    const tweens = this.sc.tweens;
    tweens.killTweensOf(b);
    b.setText(text).setAlpha(1).setScale(0.6);
    tweens.add({ targets: b, scale: 1, duration: 260, ease: 'Back.Out' });
    tweens.add({ targets: b, alpha: 0, delay: 850, duration: 450, onComplete: () => this.next() });
  }
}

// Title card for the day's tower; fades out on the first touch (which also starts a drag).
export function showIntro(sc) {
  const s = sc.save;
  const lines = [sc.add.rectangle(C.W / 2, C.H / 2, C.W, C.H, sc.col.bg, 0.7).setScrollFactor(0).setDepth(69)];
  const add = (y, text, size, alpha) => lines.push(label(sc, C.W / 2, y, text, size, alpha).setDepth(70));

  add(C.H * 0.3, 'UPFALL', 72, 1);
  add(C.H * 0.3 + 58, `tower of ${formatDay(sc.day)}`, 20, 0.6);
  if (sc.restored) add(C.H * 0.3 + 92, `welcome back · ${Math.floor(sc.height)}m`, 18, 0.85);

  add(C.H * 0.56, 'drag anywhere, release to fling', 22, 0.95);
  add(C.H * 0.56 + 34, 'two flings in the air · landing refills', 17, 0.6);
  add(C.H * 0.56 + 62, 'pass a door and you can never fall below it', 17, 0.6);

  const extra = [];
  const yesterday = s.history[shiftDay(sc.day, -1)];
  if (yesterday) extra.push(`yesterday ${Math.floor(yesterday)}m`);
  if (s.streak > 1) extra.push(`${s.streak} day streak`);
  if (extra.length) add(C.H * 0.56 + 104, extra.join('   ·   '), 16, 0.5);

  return lines;
}

export function hideIntro(sc, lines) {
  sc.tweens.add({ targets: lines, alpha: 0, duration: 400, onComplete: () => lines.forEach((l) => l.destroy()) });
}

export class Menu {
  constructor(sc) {
    this.sc = sc;
    this.items = [];
    const oy = (C.H - 960) / 2; // layout is authored for a 960-tall screen; center it
    this.oy = oy;
    const item = (obj) => {
      this.items.push(obj.setScrollFactor(0).setDepth(100 + this.items.length * 0.01).setVisible(false));
      return obj;
    };

    // Full-screen dim that also swallows touches so they don't start a drag.
    item(sc.add.rectangle(C.W / 2, C.H / 2, C.W, C.H, 0x000000, 0.8).setInteractive());
    item(label(sc, C.W / 2, oy + 110, 'PAUSED', 34));
    this.stats = item(label(sc, C.W / 2, oy + 220, '', 18, 0.85).setLineSpacing(10));
    this.chart = item(sc.add.graphics());
    this.chartTexts = [];
    for (let i = 0; i < 7; i++) {
      this.chartTexts.push(item(label(sc, 0, 0, '', 13, 0.5)), item(label(sc, 0, 0, '', 12, 0.8)));
    }

    this.resumeBtn = item(this.button(oy + 640, 'RESUME', () => this.close()));
    this.soundBtn = item(this.button(oy + 712, '', () => this.toggleSound()));
    this.copyBtn = item(this.button(oy + 784, 'COPY RESULT', () => this.copy()));
    this.restartBtn = item(this.button(oy + 856, '', () => this.restart()));
  }

  button(y, text, fn) {
    return label(this.sc, C.W / 2, y, text, 20)
      .setPadding(30, 12, 30, 12)
      .setBackgroundColor('rgba(255,255,255,0.10)')
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        sfx.click();
        fn();
      });
  }

  open() {
    if (this.sc.paused) return;
    this.sc.dismissIntro();
    this.sc.paused = true;
    this.sc.drag = null;
    this.armed = false;
    this.refresh();
    this.items.forEach((o) => o.setVisible(true));
  }

  close() {
    this.sc.paused = false;
    this.items.forEach((o) => o.setVisible(false));
  }

  refresh() {
    const s = this.sc.save;
    this.stats.setText(
      [
        `${formatDay(this.sc.day)}  ·  best ${Math.floor(s.best)}m`,
        `climbed ${Math.floor(s.climbed)}m  ·  falls ${s.falls}`,
        `longest fall ${Math.floor(s.bigFall)}m  ·  streak ${s.streak}`,
      ].join('\n'),
    );
    this.soundBtn.setText(s.muted ? 'SOUND: OFF' : 'SOUND: ON');
    this.restartBtn.setText('RESTART TOWER');
    this.copyBtn.setText('COPY RESULT');
    this.drawChart();
  }

  // Best height for each of the last 7 days, today on the right.
  drawChart() {
    const s = this.sc.save;
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const key = shiftDay(this.sc.day, -i);
      days.push({ key, value: i === 0 ? s.best : s.history[key] || 0 });
    }
    const max = Math.max(10, ...days.map((d) => d.value));
    const g = this.chart;
    const base = this.oy + 520;
    const bw = 44;
    const gap = 16;
    const x0 = C.W / 2 - (7 * bw + 6 * gap) / 2;
    g.clear();
    g.lineStyle(1, 0xffffff, 0.15).lineBetween(x0 - 10, base, x0 + 7 * bw + 6 * gap + 10, base);
    days.forEach((d, i) => {
      const x = x0 + i * (bw + gap);
      const h = d.value > 0 ? Math.max(4, (d.value / max) * 150) : 0;
      g.fillStyle(0xffffff, i === 6 ? 0.9 : 0.35).fillRoundedRect(x, base - h, bw, h, Math.min(6, h / 2));
      this.chartTexts[i * 2].setText(`${parseDay(d.key).getDate()}`).setPosition(x + bw / 2, base + 16);
      this.chartTexts[i * 2 + 1].setText(d.value > 0 ? `${Math.floor(d.value)}` : '').setPosition(x + bw / 2, base - h - 12);
    });
  }

  toggleSound() {
    const s = this.sc.save;
    s.muted = !s.muted;
    setMuted(s.muted);
    this.soundBtn.setText(s.muted ? 'SOUND: OFF' : 'SOUND: ON');
    this.sc.persist();
  }

  copy() {
    const s = this.sc.save;
    const text = [
      `UPFALL · ${formatDay(this.sc.day)}`,
      `▲ ${Math.floor(s.best)}m today`,
      `${s.falls} falls · longest ${Math.floor(s.bigFall)}m`,
      `${s.streak} day streak`,
    ].join('\n');
    const done = (ok) => {
      this.copyBtn.setText(ok ? 'COPIED' : 'COPY FAILED');
      this.sc.time.delayedCall(1400, () => this.copyBtn.setText('COPY RESULT'));
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => done(fallbackCopy(text)));
    else done(fallbackCopy(text));
  }

  restart() {
    if (!this.armed) {
      this.armed = true;
      this.restartBtn.setText('TAP AGAIN TO RESTART');
      return;
    }
    this.sc.restartTower();
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}
