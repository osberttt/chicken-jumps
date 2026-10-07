// Renders a mock game screen for every palette and screenshots each family with headless
// Chrome/Edge: `npm run palettes` writes palette-preview/<family>.png.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FAMILIES, expand } from '../src/palettes.js';

const OUT = resolve('palette-preview');
const TILE_W = 300;
const TILE_H = 540;
const GAP = 16;
const COLS = 4;

const browsers = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const browser = browsers.find((b) => existsSync(b));
if (!browser) throw new Error('No Chrome or Edge found');

// Drawing code runs in the page; it mirrors the shapes in src/draw.js.
const pageScript = `
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const rgba = (c, a) => 'rgba(' + ((c >> 16) & 255) + ',' + ((c >> 8) & 255) + ',' + (c & 255) + ',' + a + ')';
function starPath(ctx, x, y, r, n, rot, inner) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const rr = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 1.05);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.9, y - s * 1.3, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 1.3, x + s * 1.6, y - s * 0.1, x, y + s * 1.05);
  ctx.closePath();
}
function fillInk(ctx, fill, ink, w) {
  ctx.fillStyle = hex(fill);
  ctx.fill();
  ctx.lineWidth = w;
  ctx.strokeStyle = hex(ink);
  ctx.stroke();
}
function tile(ctx, P, next, name) {
  const W = ${TILE_W}, H = ${TILE_H}, ink = P.ink;
  ctx.save();
  ctx.fillStyle = hex(P.bg);
  ctx.fillRect(0, 0, W, H);
  // backdrop shapes
  ctx.strokeStyle = rgba(ink, 0.08);
  ctx.lineWidth = 3;
  [[60, 150, 26], [230, 330, 40], [90, 430, 18]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); });
  ctx.strokeRect(200, 120, 44, 44);
  // walls
  ctx.fillStyle = hex(P.wall);
  ctx.fillRect(0, 0, 8, H);
  ctx.fillRect(W - 8, 0, 8, H);
  // height marks
  ctx.fillStyle = rgba(ink, 0.35);
  ctx.font = 'bold 10px Segoe UI, sans-serif';
  for (let y = 120; y < H; y += 100) { ctx.fillRect(8, y, 12, 2); ctx.fillText(String(Math.round((H - y) / 4)), 24, y + 4); }

  const plat = (x, y, w) => {
    ctx.fillStyle = hex(P.plat);
    ctx.beginPath(); ctx.roundRect(x, y, w, 7, 3); ctx.fill();
    ctx.fillStyle = rgba(ink, 0.22);
    for (let px = x + 4; px < x + w - 6; px += 12) ctx.fillRect(px, y + 10, 6, 2);
  };

  // door to the next section, in that section's color
  const dy = 96;
  ctx.fillStyle = hex(next.bg);
  ctx.fillRect(8, dy, W - 16, 9);
  ctx.lineWidth = 2; ctx.strokeStyle = hex(ink); ctx.strokeRect(8, dy, W - 16, 9);
  ctx.fillStyle = hex(ink); ctx.font = 'bold 11px Segoe UI, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('DOOR 200m', W / 2, dy + 24);

  plat(30, 470, 120);
  plat(170, 380, 100);
  plat(40, 290, 90);
  plat(150, 200, 110);
  // bouncy
  ctx.beginPath(); ctx.roundRect(200, 470, 70, 12, 6); fillInk(ctx, P.bouncy, ink, 2);

  // funnel: one shape, mouth facing down, narrowing into a tube that rises, open at the top
  const fx = 236, fy = 300, fd = 60, half = 40, nw = 13, top = fy - fd - 80;
  ctx.beginPath(); ctx.moveTo(fx - half, fy); ctx.lineTo(fx - nw, fy - fd); ctx.lineTo(fx - nw, top);
  ctx.lineTo(fx + nw, top); ctx.lineTo(fx + nw, fy - fd); ctx.lineTo(fx + half, fy); ctx.closePath();
  ctx.fillStyle = rgba(P.fill, 0.9); ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = hex(ink); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(fx + s * half, fy); ctx.lineTo(fx + s * nw, fy - fd); ctx.lineTo(fx + s * nw, top); ctx.lineTo(fx + s * (nw + 5), top - 5); ctx.stroke();
  }
  ctx.fillStyle = rgba(ink, 0.45);
  [[0.1, -0.5], [0.25, 0.4], [0.4, -0.1], [0.55, 0.3], [0.7, -0.4], [0.85, 0.1], [0.95, -0.2]].forEach(([u, l]) => {
    const y = u < 0.5 ? fy - fd * (u / 0.5) : fy - fd - 90 * ((u - 0.5) / 0.5);
    const w = u < 0.5 ? half + (nw - half) * (u / 0.5) : nw;
    ctx.beginPath(); ctx.arc(fx + l * (w - 5), y, 1.8, 0, 7); ctx.fill();
  });

  // portals: one bordered circle; particles stream into blue, out of yellow
  [[205, 430, P.portalBlue, -1], [62, 168, P.portalYellow, 1]].forEach(([x, y, c, dir]) => {
    ctx.beginPath(); ctx.arc(x, y, 29, 0, 7); ctx.fillStyle = rgba(c, 0.25); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 22, 0, 7); ctx.fillStyle = hex(c); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = hex(ink); ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39996 + x;
      const r = 24 + ((i * 7) % 13) * 1.6;
      const k = dir > 0 ? 1 - (r - 24) / 22 : (r - 24) / 22 + 0.2;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.4 + 1.6 * k, 0, 7);
      ctx.fillStyle = rgba(c, Math.min(1, k * 1.5)); ctx.fill();
    }
  });

  // star, heart, spike
  starPath(ctx, 120, 340, 12, 5, -Math.PI / 2, 0.45); fillInk(ctx, P.star, ink, 2.5);
  ctx.beginPath(); ctx.arc(150, 250, 20, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
  heartPath(ctx, 150, 250, 10); fillInk(ctx, P.heart, ink, 2.5);
  starPath(ctx, 140, 135, 15, 7, 0.2, 0.5); fillInk(ctx, P.hazard, ink, 2.5);
  ctx.beginPath(); ctx.arc(140, 135, 4, 0, 7); ctx.fillStyle = hex(ink); ctx.fill();

  // players: red (no jumps) mid-air with a trail; blue (can jump) aiming with the arrow
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(160 + i * 9, 330 + i * 11, 13 - i * 1.5, 0, 7); ctx.fillStyle = rgba(P.cantJump, 0.22 - i * 0.03); ctx.fill(); }
  ctx.beginPath(); ctx.arc(152, 320, 14, 0, 7); fillInk(ctx, P.cantJump, ink, 3);
  const px = 80, py = 456, ax = 0.55, ay = -0.835, nx = -ay, ny = ax;
  const at = (al, sd) => [px + ax * al + nx * sd, py + ay * al + ny * sd];
  const arrow = (gr) => [at(20 - gr, 2.5 + gr), at(56, 4.5 + gr), at(56 - gr / 2, 11 + gr * 1.6), at(71 + gr * 1.8, 0), at(56 - gr / 2, -11 - gr * 1.6), at(56, -4.5 - gr), at(20 - gr, -2.5 - gr)];
  for (const [gr, c] of [[2.5, ink], [0, P.canJump]]) {
    ctx.beginPath(); arrow(gr).forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fillStyle = hex(c); ctx.fill();
  }
  ctx.fillStyle = rgba(ink, 0.4);
  for (let i = 0; i < 4; i++) { const [x, y] = at(84 + i * 14, i * i * 1.2); ctx.beginPath(); ctx.arc(x, y, 2.6 - i * 0.4, 0, 7); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(px, py, 14 * 1.2, 14 * 0.88, Math.atan2(ay, ax), 0, 7); fillInk(ctx, P.canJump, ink, 3);

  // HUD
  for (let i = 0; i < 5; i++) {
    heartPath(ctx, 24 + i * 22, 28, 7.5);
    if (i < 3) fillInk(ctx, P.heart, ink, 2);
    else { ctx.lineWidth = 2; ctx.strokeStyle = rgba(ink, 0.5); ctx.stroke(); }
  }
  ctx.fillStyle = hex(ink); ctx.font = 'bold 24px Segoe UI, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('124m', W / 2 + 30, 36);
  ctx.fillStyle = rgba(ink, 0.2); ctx.beginPath(); ctx.roundRect(W / 2 - 10, 48, 80, 4, 2); ctx.fill();
  ctx.fillStyle = hex(next.bg); ctx.beginPath(); ctx.roundRect(W / 2 - 10, 48, 50, 4, 2); ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = hex(ink); ctx.stroke();

  // name
  ctx.fillStyle = hex(ink); ctx.font = 'bold 15px Segoe UI, sans-serif';
  ctx.fillText(name, W / 2, H - 22);
  ctx.font = '11px Consolas, monospace'; ctx.globalAlpha = 0.7;
  ctx.fillText(hex(P.bg) + ' / ' + hex(ink), W / 2, H - 8);
  ctx.restore();
}
for (const c of document.querySelectorAll('canvas')) {
  const d = JSON.parse(c.dataset.p);
  tile(c.getContext('2d'), d.p, d.next, d.name);
}
`;

mkdirSync(OUT, { recursive: true });
for (const [key, fam] of Object.entries(FAMILIES)) {
  const secs = fam.sections;
  const tiles = secs
    .map((s, i) => {
      const data = { p: expand(s, key), next: expand(secs[(i + 1) % secs.length], key), name: `${i + 1}. ${s.name}` };
      return `<canvas width="${TILE_W}" height="${TILE_H}" data-p='${JSON.stringify(data)}'></canvas>`;
    })
    .join('');
  const rows = Math.ceil(secs.length / COLS);
  const width = COLS * TILE_W + (COLS + 1) * GAP;
  const height = rows * TILE_H + (rows + 1) * GAP + 44;
  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#16161c;font:bold 18px Segoe UI,sans-serif;color:#eee}
h1{font-size:18px;margin:0;padding:14px ${GAP}px 0}
.g{display:grid;grid-template-columns:repeat(${COLS},${TILE_W}px);gap:${GAP}px;padding:${GAP}px}
canvas{border-radius:10px}
</style><h1>${fam.label}</h1><div class="g">${tiles}</div><script>${pageScript}</script>`;
  const file = resolve(OUT, `${key}.html`);
  writeFileSync(file, html);
  const png = resolve(OUT, `${key}.png`);
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${width},${height}`, `--screenshot=${png}`, pathToFileURL(file).href], { stdio: 'ignore', timeout: 60000 });
  console.log(png);
}
