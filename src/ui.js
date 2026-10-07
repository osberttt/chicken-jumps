import * as C from './config.js';
import { formatDay, parseDay, shiftDay } from './rng.js';
import { doorHeight } from './tower.js';
import { sfx, setMuted } from './audio.js';
import { palette, drawHeart, inkHeart, tint, hex, HEART } from './draw.js';
const BAR_W = 120;

export function label(scene, x, y, text, size, alpha = 1, fixed = true) {
  const t = scene.add
    .text(x, y, text, { fontFamily: C.FONT, fontSize: `${size}px`, fontStyle: 'bold', color: '#ffffff', align: 'center' })
    .setOrigin(0.5)
    .setAlpha(alpha)
    .setResolution(C.RES);
  if (fixed) t.setScrollFactor(0);
  return t;
}

// Hearts top-left, current height top-center with a thin bar filling toward the next
// door (in that door's color), pause top-right. Best lives in the world as a dashed line.
// Everything is drawn in the section's ink so it reads on any background.
export class Hud {
  constructor(sc) {
    this.sc = sc;
    this.g = sc.add.graphics().setScrollFactor(0).setDepth(50);
    this.height = label(sc, C.W / 2, 44, '0m', 34).setDepth(50);
    this.doorText = label(sc, C.W / 2 + BAR_W / 2 + 8, 78, '', 12, 0.75).setOrigin(0, 0.5).setDepth(50);
    // Right-aligned under the pause button.
    this.timer = label(sc, C.W - 34, 76, '0:00', 17, 0.75).setOrigin(1, 0.5).setDepth(50);
    this.banner = label(sc, C.W / 2, C.H * 0.34, '', 54).setDepth(60).setAlpha(0);
    this.queue = [];
    this.busy = false;
    this.doorN = -1;
    this.shownHp = sc.player.hp;
    this.hpPulse = 0;
    this.banner.setShadow(0, 3, 'rgba(0,0,0,0.35)', 10);

    this.pauseZone = sc.add
      .zone(C.W - 44, 43, 80, 80)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => sc.menu.open());
  }

  update(dt) {
    const { height, nextDoor, player, tower, col, runT } = this.sc;
    const ink = col.ink;
    tint(this.height, ink).setText(`${Math.floor(height)}m`);
    tint(this.doorText, ink);

    // Run time, under the hearts. Only re-set the text when the second changes.
    const secs = Math.floor(runT);
    if (secs !== this.shownSecs) {
      this.shownSecs = secs;
      this.timer.setText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    }
    tint(this.timer, ink);

    if (nextDoor !== this.doorN) {
      this.doorN = nextDoor;
      this.doorColor = palette(tower, nextDoor).door;
      this.doorText.setText(`${doorHeight(nextDoor)}`);
    }
    if (player.hp !== this.shownHp) {
      this.shownHp = player.hp;
      this.hpPulse = 1;
    }
    this.hpPulse = Math.max(0, this.hpPulse - dt * 3);

    const g = this.g;
    g.clear();
    for (let i = 0; i < C.MAX_HP; i++) {
      const x = 32 + i * 30;
      if (i < player.hp) inkHeart(g, x, 42, 10 * (1 + 0.25 * this.hpPulse), HEART, ink);
      else {
        g.fillStyle(ink, 0.22);
        drawHeart(g, x, 42, 10);
      }
    }

    // Progress toward the next door, in that door's color.
    const from = nextDoor > 1 ? doorHeight(nextDoor - 1) : 0;
    const k = Math.max(0, Math.min(1, (height - from) / (doorHeight(nextDoor) - from)));
    const x0 = C.W / 2 - BAR_W / 2;
    g.fillStyle(ink, 1).fillRoundedRect(x0 - 2, 74, BAR_W + 4, 8, 4);
    g.fillStyle(col.bg, 1).fillRoundedRect(x0, 76, BAR_W, 4, 2);
    if (k > 0) g.fillStyle(this.doorColor, 1).fillRoundedRect(x0, 76, Math.max(4, BAR_W * k), 4, 2);

    g.fillStyle(ink, 0.8);
    g.fillRoundedRect(C.W - 54, 31, 7, 24, 2);
    g.fillRoundedRect(C.W - 41, 31, 7, 24, 2);
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
    b.setText(text).setStroke(hex(this.sc.col.ink), 8).setAlpha(1).setScale(0.6);
    tweens.add({ targets: b, scale: 1, duration: 260, ease: 'Back.Out' });
    tweens.add({ targets: b, alpha: 0, delay: 850, duration: 450, onComplete: () => this.next() });
  }
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
        `climbed ${Math.floor(s.climbed)}m  ·  falls ${s.falls}  ·  deaths ${s.deaths}`,
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
      `CHICKEN JUMPS · ${formatDay(this.sc.day)}`,
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
