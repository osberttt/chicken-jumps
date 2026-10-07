import Phaser from 'phaser';
import * as C from './config.js';
import { hash01 } from './rng.js';
import { platformX, hazardPos, doorHeight } from './tower.js';

const TAU = Math.PI * 2;
const hsl = (h, s, l) => Phaser.Display.Color.HSLToColor(((h % 1) + 1) % 1, s, l).color;

// The palette drifts with height (a new hue roughly every 100m) and starts from a daily hue.
export function palette(tower, heightM) {
  const h = tower.hue + (heightM / 100) * 0.11;
  return {
    bg: hsl(h, 0.42, 0.1),
    wall: hsl(h, 0.32, 0.17),
    deco: hsl(h, 0.45, 0.6),
    plat: hsl(h, 0.3, 0.88),
    accent: hsl(h + 0.42, 0.85, 0.62),
    charge: hsl(h + 0.12, 0.95, 0.72),
    hazard: 0xff4d6d,
    player: 0xffffff,
  };
}

let pageBg = -1;
function syncPageBackground(color) {
  if (color === pageBg) return;
  pageBg = color;
  document.body.style.backgroundColor = `#${color.toString(16).padStart(6, '0')}`;
}

export function drawWorld(sc, aim) {
  const cam = sc.cameras.main;
  const g = sc.g;
  const top = cam.scrollY - 40;
  const bottom = cam.scrollY + C.H + 40;
  const col = palette(sc.tower, Math.max(0, -(cam.scrollY + C.H / 2) / C.PX_PER_M));
  sc.col = col;
  cam.setBackgroundColor(col.bg);
  syncPageBackground(col.bg);
  drawBackdrop(sc, col);

  g.clear();
  if (bottom > 0) g.fillStyle(col.wall, 1).fillRect(0, 0, C.W, bottom);
  g.fillStyle(col.wall, 1);
  g.fillRect(0, top, C.WALL, bottom - top);
  g.fillRect(C.W - C.WALL, top, C.WALL, bottom - top);

  drawMarkers(sc, g, col, top, bottom);
  drawBestLine(sc, g, col, top, bottom);
  let doorLabels = 0;
  for (const p of sc.tower.platformsIn(top - 20, bottom + 20, sc.drawPlats)) {
    if (p.type === 'door') drawDoor(sc, g, p, col, sc.doorTexts[doorLabels++]);
    else drawPlatform(sc, g, p, col);
  }
  for (; doorLabels < sc.doorTexts.length; doorLabels++) sc.doorTexts[doorLabels].setVisible(false);
  for (const hz of sc.tower.hazardsIn(top - 140, bottom + 140, sc.drawHaz)) drawHazard(sc, g, hz, col);
  drawTrail(sc, g, col);
  if (aim) drawAim(sc, g, col, aim);
  drawPlayer(sc, g, col, aim);
  for (const p of sc.particles) {
    g.fillStyle(p.color, Math.min(1, p.life / p.max) * 0.9);
    g.fillCircle(p.x, p.y, p.size * (0.4 + 0.6 * (p.life / p.max)));
  }
}

// Faint parallax outlines so the climb reads as motion even between platforms.
function drawBackdrop(sc, col) {
  const g = sc.bgG;
  g.clear();
  const par = sc.cameras.main.scrollY * 0.35;
  const CELL = 300;
  const salt = sc.tower.seed & 0xffff;
  for (let c = Math.floor(par / CELL) - 1; c <= Math.floor((par + C.H) / CELL) + 1; c++) {
    for (let k = 0; k < 2; k++) {
      const n = c * 7 + k * 3 + salt;
      const x = 30 + hash01(n + 1) * (C.W - 60);
      const y = c * CELL + hash01(n + 2) * CELL - par;
      const r3 = hash01(n + 3);
      const size = 20 + r3 * 70;
      g.lineStyle(3, col.deco, 0.07);
      const shape = Math.floor(r3 * 30) % 3;
      if (shape === 0) g.strokeCircle(x, y, size / 2);
      else if (shape === 1) g.strokeRect(x - size / 2, y - size / 2, size, size);
      else g.strokeTriangle(x, y - size / 2, x + size / 2, y + size / 2, x - size / 2, y + size / 2);
    }
  }
}

function drawMarkers(sc, g, col, top, bottom) {
  const texts = sc.markerTexts;
  let i = 0;
  const first = Math.max(10, Math.ceil(-bottom / C.PX_PER_M / 10) * 10);
  for (let m = first; m * C.PX_PER_M <= -top; m += 10) {
    const y = -m * C.PX_PER_M;
    const major = m % 50 === 0;
    g.lineStyle(2, col.plat, major ? 0.35 : 0.16);
    g.lineBetween(C.WALL, y, C.WALL + (major ? 22 : 12), y);
    const t = texts[i++];
    if (t) t.setText(`${m}`).setPosition(C.WALL + 28, y).setAlpha(major ? 0.4 : 0.22).setVisible(true);
  }
  for (; i < texts.length; i++) texts[i].setVisible(false);
}

// Dashed line at today's best, shown only when the player is below it.
function drawBestLine(sc, g, col, top, bottom) {
  const best = sc.save.best;
  const y = -best * C.PX_PER_M;
  const show = best >= 2 && sc.height < best - 1 && y > top && y < bottom;
  sc.bestText.setVisible(show);
  if (!show) return;
  g.lineStyle(2, col.charge, 0.6);
  for (let x = C.WALL; x < C.W - C.WALL; x += 24) g.lineBetween(x, y, Math.min(x + 14, C.W - C.WALL), y);
  sc.bestText.setText(`BEST ${Math.floor(best)}m`).setPosition(C.W - C.WALL - 8, y - 6);
}

function drawPlatform(sc, g, p, col) {
  const t = sc.simT;
  const x = platformX(p, t);
  const x0 = x - p.w / 2;
  switch (p.type) {
    case 'ground':
      g.fillStyle(col.plat, 1).fillRect(C.WALL, p.y, C.W - 2 * C.WALL, 6);
      break;
    case 'normal':
      g.fillStyle(col.plat, 1).fillRoundedRect(x0, p.y, p.w, 12, 4);
      break;
    case 'moving': {
      g.lineStyle(2, col.plat, 0.18);
      g.lineBetween(p.x - p.amp - p.w / 2, p.y + 6, p.x + p.amp + p.w / 2, p.y + 6);
      g.fillStyle(col.plat, 1).fillRoundedRect(x0, p.y, p.w, 12, 4);
      g.fillStyle(col.bg, 0.8);
      g.fillCircle(x0 + 10, p.y + 6, 2.5);
      g.fillCircle(x0 + p.w - 10, p.y + 6, 2.5);
      break;
    }
    case 'crumble': {
      if (!sc.solid(p)) {
        g.lineStyle(1.5, col.plat, 0.15).strokeRect(x0, p.y, p.w, 12);
        break;
      }
      const shaking = p.crumbleAt != null;
      const left = shaking ? Math.max(0, p.crumbleAt - t) / C.CRUMBLE_TIME : 1;
      const jitter = shaking ? Math.sin(t * 90) * 2 : 0;
      const pieces = Math.max(3, Math.round(p.w / 32));
      const pw = (p.w - (pieces - 1) * 4) / pieces;
      g.fillStyle(col.plat, shaking ? 0.4 + 0.6 * left : 1);
      for (let i = 0; i < pieces; i++) {
        const dy = shaking ? (1 - left) * (i % 2 ? 4 : -2) : 0;
        g.fillRect(x0 + i * (pw + 4) + jitter, p.y + dy, pw, 12);
      }
      break;
    }
    case 'bouncy': {
      const squash = p.squashT != null ? Math.max(0, 1 - (t - p.squashT) / 0.25) : 0;
      const hgt = 14 - 6 * squash;
      g.fillStyle(col.accent, 1).fillRoundedRect(x0 - 4 * squash, p.y + 6 * squash, p.w + 8 * squash, hgt, hgt / 2);
      break;
    }
  }
}

// A closed door is a faint dotted line marking the goal; once passed it becomes a solid
// full-width floor that sweeps open from the center.
function drawDoor(sc, g, p, col, text) {
  const x0 = C.WALL;
  const x1 = C.W - C.WALL;
  const open = sc.solid(p);
  if (!open) {
    g.fillStyle(col.plat, 0.3);
    for (let x = x0 + 6; x < x1; x += 18) g.fillCircle(x, p.y + 4, 2.5);
  } else {
    const k = p.openT != null ? Math.min(1, (sc.simT - p.openT) / 0.35) : 1;
    const half = ((x1 - x0) / 2) * (1 - (1 - k) ** 3);
    g.fillStyle(col.charge, 1).fillRect(C.W / 2 - half, p.y, half * 2, 10);
    g.fillStyle(col.bg, 0.5);
    for (let x = x0 + 20; x < x1 - 10; x += 40) if (Math.abs(x - C.W / 2) < half) g.fillRect(x, p.y + 3, 16, 4);
  }
  if (text) {
    text
      .setText(`DOOR ${doorHeight(p.n)}m`)
      .setPosition(C.W / 2, p.y + 24)
      .setAlpha(open ? 0.8 : 0.45)
      .setVisible(true);
  }
}

function star(g, x, y, r, n, rot, inner) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const rr = i % 2 ? r * inner : r;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  g.fillPoints(pts, true);
}

function drawHazard(sc, g, hz, col) {
  const t = sc.simT;
  if (hz.kind === 'wall') {
    g.fillStyle(col.hazard, 1);
    const wx = hz.side < 0 ? C.WALL : C.W - C.WALL;
    const dir = -hz.side;
    for (let y = hz.y0; y < hz.y1; y += 16) {
      const y1 = Math.min(y + 16, hz.y1);
      g.fillTriangle(wx, y, wx, y1, wx + dir * 13, (y + y1) / 2);
    }
    return;
  }
  const [x, y] = hazardPos(hz, t);
  if (hz.kind === 'saw') {
    g.lineStyle(2, col.hazard, 0.15).lineBetween(hz.x, hz.y - hz.amp, hz.x, hz.y + hz.amp);
    g.fillStyle(col.hazard, 1);
    star(g, x, y, hz.r, 10, t * 6, 0.72);
  } else {
    g.fillStyle(col.hazard, 1);
    star(g, x, y, hz.r, 7, t * 0.6, 0.5);
  }
  g.fillStyle(col.bg, 1).fillCircle(x, y, hz.r * 0.26);
}

function drawTrail(sc, g, col) {
  const tr = sc.trail;
  const n = tr.length / 2;
  for (let i = 0; i < n; i++) {
    const k = (i + 1) / n;
    g.fillStyle(col.player, 0.14 * k);
    g.fillCircle(tr[i * 2], tr[i * 2 + 1], C.PLAYER_R * (0.35 + 0.55 * k));
  }
}

function drawAim(sc, g, col, aim) {
  const pl = sc.player;
  const ready = pl.charges > 0;
  const band = 24 + 56 * aim.power;
  g.lineStyle(3, col.player, ready ? 0.35 : 0.15);
  g.lineBetween(pl.x, pl.y, pl.x - aim.x * band, pl.y - aim.y * band);
  g.fillStyle(col.player, ready ? 0.5 : 0.2).fillCircle(pl.x - aim.x * band, pl.y - aim.y * band, 4);

  const pts = sc.preview;
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const k = 1 - i / n;
    g.fillStyle(ready ? col.player : col.plat, (ready ? 0.85 : 0.2) * k);
    g.fillCircle(pts[i * 2], pts[i * 2 + 1], 2 + 2.4 * k);
  }
}

function ellipse(g, x, y, rx, ry, ang) {
  const pts = [];
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    const ex = Math.cos(a) * rx;
    const ey = Math.sin(a) * ry;
    pts.push({ x: x + ex * cos - ey * sin, y: y + ex * sin + ey * cos });
  }
  g.fillPoints(pts, true);
}

function drawPlayer(sc, g, col, aim) {
  const pl = sc.player;
  const R = C.PLAYER_R;
  let y = pl.y;
  let ang = 0;
  let sx = 1;
  let sy = 1;
  if (aim) {
    // Stretched along the pull, like a loaded slingshot.
    ang = Math.atan2(aim.y, aim.x);
    sx = 1 + 0.32 * aim.power;
    sy = 1 - 0.18 * aim.power;
  } else if (!pl.ground) {
    ang = Math.atan2(pl.vy, pl.vx);
    const k = Math.min(1, Math.hypot(pl.vx, pl.vy) / 2200);
    sx = 1 + 0.28 * k;
    sy = 1 - 0.16 * k;
  } else if (pl.squash > 0) {
    sx = 1 + 0.4 * pl.squash;
    sy = 1 - 0.32 * pl.squash;
    y += R * 0.32 * pl.squash;
  }
  const flash = pl.hitT > 0 && Math.floor(pl.hitT * 16) % 2 === 0;
  g.fillStyle(flash ? col.hazard : col.player, 1);
  ellipse(g, pl.x, y, R * sx, R * sy, ang);

  // Two charge arcs over the blob; a refilling charge sweeps in.
  const rr = R + 8;
  const segs = [
    [-Math.PI * 0.92, -Math.PI * 0.56],
    [-Math.PI * 0.44, -Math.PI * 0.08],
  ];
  for (let i = 0; i < segs.length; i++) {
    const [a0, a1] = segs[i];
    g.lineStyle(4, col.charge, 0.16);
    g.beginPath();
    g.arc(pl.x, pl.y, rr, a0, a1);
    g.strokePath();
    const fill = i < pl.charges ? 1 : i === pl.charges ? pl.refill : 0;
    if (fill <= 0) continue;
    g.lineStyle(4, col.charge, i < pl.charges ? 1 : 0.55);
    g.beginPath();
    g.arc(pl.x, pl.y, rr, a0, a0 + (a1 - a0) * fill);
    g.strokePath();
  }
}
