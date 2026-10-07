import Phaser from 'phaser';
import * as C from './config.js';
import { Tower, platformX, hazardPos, doorHeight, nextDoorIndex } from './tower.js';
import { integrate, launchSpeed, previewPath, MIN_X, MAX_X } from './physics.js';
import { dayKey } from './rng.js';
import * as Save from './save.js';
import { sfx, unlockAudio, setMuted, buzz } from './audio.js';
import { drawWorld, palette } from './draw.js';
import { Hud, Menu, label, showIntro, hideIntro } from './ui.js';

const STEP = 1 / 120;
const clamp = Phaser.Math.Clamp;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  create() {
    this.day = dayKey();
    this.save = Save.load(this.day);
    setMuted(this.save.muted);
    this.tower = new Tower(this.day);

    this.simT = 0;
    this.acc = 0;
    this.timeScale = 1;
    this.paused = false;
    this.drag = null;
    this.dirty = false;
    this.lastSave = 0;
    this.particles = [];
    this.trail = [];
    this.preview = [];
    this.near = [];
    this.drawPlats = [];
    this.drawHaz = [];

    const R = C.PLAYER_R;
    this.player = {
      x: C.W / 2,
      y: -R,
      vx: 0,
      vy: 0,
      ground: this.tower.platforms[0],
      offset: 0,
      charges: C.MAX_CHARGES,
      refill: 0,
      hitT: 0,
      squash: 0,
      fromY: -R, // where the current flight started, to measure falls
    };
    this.lastPos = { id: 0, offset: 0 };
    this.restored = false;
    this.restorePosition();
    this.height = this.heightOf(this.player.y);
    this.aboveBest = true; // re-passing the best after dropping below it triggers NEW BEST
    this.nextDoor = nextDoorIndex(this.save.best);
    this.col = palette(this.tower, this.height);

    const cam = this.cameras.main;
    cam.setZoom(C.RES).setOrigin(0, 0);
    cam.scrollY = this.cameraTarget();

    this.bgG = this.add.graphics().setScrollFactor(0);
    this.g = this.add.graphics();
    this.markerTexts = Array.from({ length: 8 }, () => label(this, 0, 0, '', 14, 0.3, false).setOrigin(0, 0.5));
    this.bestText = label(this, 0, 0, '', 14, 0.8, false).setOrigin(1, 1);
    this.doorTexts = Array.from({ length: 3 }, () => label(this, 0, 0, '', 15, 0.6, false));
    this.hud = new Hud(this);
    this.menu = new Menu(this);
    this.intro = showIntro(this);

    this.setupInput();
    this.setupLifecycle();
  }

  // ---------------------------------------------------------------- setup

  restorePosition() {
    const pos = this.save.pos;
    if (!pos) return;
    this.tower.ensurePlatform(pos.id);
    const p = this.tower.platforms[pos.id];
    if (!p || p.type === 'bouncy') return;
    const pl = this.player;
    pl.ground = p;
    pl.offset = clamp(pos.offset, -p.w / 2, p.w / 2);
    pl.x = clamp(platformX(p, 0) + pl.offset, MIN_X, MAX_X);
    pl.y = p.y - C.PLAYER_R;
    pl.fromY = pl.y;
    if (p.type === 'crumble') p.crumbleAt = C.CRUMBLE_TIME + 1.5;
    this.lastPos = { id: p.id, offset: pl.offset };
    this.restored = p.id > 0;
  }

  setupInput() {
    const toLogical = (p) => ({ x: p.x / C.RES, y: p.y / C.RES });

    this.input.on('pointerdown', (pointer, over) => {
      unlockAudio();
      this.dismissIntro();
      if (this.paused || over.length) return;
      const { x, y } = toLogical(pointer);
      this.drag = { sx: x, sy: y, x, y };
    });
    this.input.on('pointermove', (pointer) => {
      if (!this.drag) return;
      const { x, y } = toLogical(pointer);
      this.drag.x = x;
      this.drag.y = y;
    });
    const release = (pointer) => {
      if (!this.drag) return;
      const { x, y } = toLogical(pointer);
      this.drag.x = x;
      this.drag.y = y;
      const aim = this.aim();
      this.drag = null;
      if (aim && !this.paused) this.tryLaunch(aim);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.keyboard?.on('keydown-ESC', () => (this.paused ? this.menu.close() : this.menu.open()));
  }

  setupLifecycle() {
    // Save when the tab is hidden or closed; when it comes back on a new day, load the new tower.
    const onVisibility = () => {
      if (document.hidden) this.persist();
      else if (dayKey() !== this.day) {
        this.persist();
        this.scene.restart();
      }
    };
    const onHide = () => this.persist();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
    });
  }

  dismissIntro() {
    if (!this.intro) return;
    hideIntro(this, this.intro);
    this.intro = null;
  }

  persist() {
    this.save.pos = this.lastPos;
    Save.store(this.save);
    this.dirty = false;
    this.lastSave = this.time.now;
  }

  restartTower() {
    Object.assign(this.save, { pos: null, best: 0, falls: 0, bigFall: 0, climbed: 0 });
    Save.store(this.save);
    this.scene.restart();
  }

  // ---------------------------------------------------------------- input

  aim() {
    const d = this.drag;
    if (!d) return null;
    const dx = d.sx - d.x;
    const dy = d.sy - d.y;
    const len = Math.hypot(dx, dy);
    if (len < C.DRAG_DEADZONE) return null;
    const power = Math.min(1, (len - C.DRAG_DEADZONE) / (C.MAX_DRAG - C.DRAG_DEADZONE));
    return { x: dx / len, y: dy / len, power };
  }

  tryLaunch(aim) {
    const pl = this.player;
    if (pl.charges <= 0) {
      sfx.empty();
      return;
    }
    const speed = launchSpeed(aim.power);
    if (pl.ground) {
      pl.ground = null;
      pl.fromY = pl.y;
    }
    pl.vx = aim.x * speed;
    pl.vy = aim.y * speed;
    pl.charges--;
    sfx.launch(aim.power);
    this.burst(pl.x, pl.y, this.col.player, 6, 160, -aim.x, -aim.y);
  }

  // ---------------------------------------------------------------- simulation

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    const pl = this.player;
    const aim = this.paused ? null : this.aim();

    if (!this.paused) {
      // Aiming in mid-air slows time so a fling can be lined up on a phone.
      const slow = aim && !pl.ground && pl.charges > 0;
      this.timeScale += ((slow ? C.AIR_SLOWMO : 1) - this.timeScale) * (1 - Math.exp(-dt * 14));
      const sdt = dt * this.timeScale;
      this.acc += sdt;
      while (this.acc >= STEP) {
        this.stepSim(STEP);
        this.acc -= STEP;
      }
      this.updateEffects(sdt);
    }

    this.updateCamera(dt);
    this.tower.ensureUpTo(this.cameras.main.scrollY);
    if (aim) previewPath(pl.x, pl.y, aim, this.preview);
    drawWorld(this, aim);
    this.hud.update();
    if (this.dirty && time - this.lastSave > 1000) this.persist();
  }

  stepSim(dt) {
    const pl = this.player;
    this.simT += dt;

    if (pl.charges < C.MAX_CHARGES) {
      pl.refill += dt / C.REFILL_TIME;
      if (pl.refill >= 1) {
        pl.charges++;
        pl.refill = pl.charges < C.MAX_CHARGES ? pl.refill - 1 : 0;
        sfx.refill();
      }
    }
    if (pl.hitT > 0) pl.hitT -= dt;

    if (pl.ground) {
      const p = pl.ground;
      if (!this.solid(p)) {
        pl.ground = null;
        sfx.crumble();
      } else {
        pl.x = clamp(platformX(p, this.simT) + pl.offset, MIN_X, MAX_X);
        pl.y = p.y - C.PLAYER_R;
      }
    }
    if (!pl.ground) {
      const prevY = pl.y;
      const wall = integrate(pl, dt);
      if (wall) this.onWall(wall);
      if (pl.vy < 0) this.save.climbed += (-pl.vy * dt) / C.PX_PER_M;
      if (pl.vy > 0) this.checkLanding(prevY);
    }
    if (pl.hitT <= 0) this.checkHazards();
    this.updateHeight();
  }

  // Doors are solid once today's best has passed them. Crumbling platforms break
  // CRUMBLE_TIME after first touch and come back after CRUMBLE_RESPAWN.
  solid(p) {
    if (p.type === 'door') return p.n < this.nextDoor;
    if (p.crumbleAt == null || this.simT < p.crumbleAt) return true;
    if (this.simT < p.crumbleAt + C.CRUMBLE_RESPAWN) return false;
    p.crumbleAt = null;
    return true;
  }

  // Platforms are one-way: only a falling body that crosses a top surface lands.
  checkLanding(prevY) {
    const pl = this.player;
    const R = C.PLAYER_R;
    let hit = null;
    let hitX = 0;
    for (const p of this.tower.platformsIn(pl.y - 40, pl.y + 60, this.near)) {
      if (prevY + R > p.y + 0.01 || pl.y + R < p.y || !this.solid(p)) continue;
      const px = platformX(p, this.simT);
      if (Math.abs(pl.x - px) > p.w / 2 + R * 0.4) continue;
      if (!hit || p.y < hit.y) {
        hit = p;
        hitX = px;
      }
    }
    if (hit) this.land(hit, hitX);
  }

  land(p, px) {
    const pl = this.player;
    const impact = pl.vy;
    pl.y = p.y - C.PLAYER_R;
    pl.charges = C.MAX_CHARGES;
    pl.refill = 0;
    this.recordFall();
    pl.fromY = pl.y;

    if (p.type === 'bouncy') {
      pl.vy = -clamp(impact * 0.9, C.BOUNCE_MIN, C.BOUNCE_MAX);
      p.squashT = this.simT;
      sfx.bounce();
      buzz(10);
      this.burst(pl.x, p.y, this.col.accent, 8, 220, 0, -1);
      return;
    }

    pl.ground = p;
    pl.offset = clamp(pl.x - px, -p.w / 2, p.w / 2);
    pl.vx = 0;
    pl.vy = 0;
    pl.squash = Math.min(1, impact / 1600);
    if (p.type === 'crumble' && p.crumbleAt == null) p.crumbleAt = this.simT + C.CRUMBLE_TIME;
    this.lastPos = { id: p.id, offset: pl.offset };
    this.dirty = true;
    sfx.land(pl.squash);
    buzz(6);
    this.burst(pl.x, p.y, this.col.plat, 5 + Math.round(pl.squash * 6), 140 + 160 * pl.squash, 0, -1);
  }

  // A landing below the spot the flight started from counts as a fall.
  recordFall() {
    const pl = this.player;
    const drop = (pl.y - pl.fromY) / C.PX_PER_M;
    if (drop <= 4) return;
    const s = this.save;
    s.falls++;
    s.bigFall = Math.max(s.bigFall, drop);
    if (drop >= 10) this.floatText(pl.x, pl.y - 34, `-${Math.round(drop)}m`);
  }

  onWall(side) {
    const pl = this.player;
    sfx.wall();
    this.burst(pl.x - side * C.PLAYER_R, pl.y, this.col.plat, 4, 120, -side, 0);
  }

  checkHazards() {
    const pl = this.player;
    const R = C.PLAYER_R;
    for (const hz of this.tower.hazardsIn(pl.y - 140, pl.y + 140, this.near)) {
      if (hz.kind === 'wall') {
        const touching = hz.side < 0 ? pl.x - R <= C.WALL + 12 : pl.x + R >= C.W - C.WALL - 12;
        if (touching && pl.y + R * 0.5 > hz.y0 && pl.y - R * 0.5 < hz.y1) return this.hit();
      } else {
        const [hx, hy] = hazardPos(hz, this.simT);
        const rr = R + hz.r * 0.8;
        if ((pl.x - hx) ** 2 + (pl.y - hy) ** 2 < rr * rr) return this.hit();
      }
    }
  }

  // Hazards never kill: they stop you and drain both charges, so you drop.
  hit() {
    const pl = this.player;
    pl.hitT = C.HIT_COOLDOWN;
    pl.charges = 0;
    pl.refill = 0;
    pl.ground = null;
    pl.vx *= 0.15;
    pl.vy = Math.max(pl.vy, 150);
    this.cameras.main.shake(160, 0.006);
    sfx.hit();
    buzz(40);
    this.burst(pl.x, pl.y, this.col.hazard, 12, 260);
  }

  heightOf(y) {
    return Math.max(0, -(y + C.PLAYER_R) / C.PX_PER_M);
  }

  updateHeight() {
    const h = this.heightOf(this.player.y);
    this.height = h;
    const s = this.save;
    if (h > s.best) {
      const prev = s.best;
      s.best = h;
      if (!this.aboveBest) {
        this.aboveBest = true;
        this.hud.announce('NEW BEST');
        sfx.best();
      }
      // Passing a door opens its floor: from now on today you can't fall below it.
      while (h >= doorHeight(this.nextDoor)) {
        const door = this.tower.doors[this.nextDoor];
        if (door) door.openT = this.simT;
        this.hud.announce(`DOOR ${doorHeight(this.nextDoor)}m`);
        sfx.door();
        buzz(30);
        this.nextDoor++;
      }
    } else if (h < s.best - 3) {
      this.aboveBest = false;
    }
  }

  // ---------------------------------------------------------------- camera & effects

  // A standing player sits TOP_GAP below the top edge on every screen size, so a full
  // launch always peaks just past the top. Extra screen height shows more below.
  cameraTarget() {
    return this.player.y - C.TOP_GAP;
  }

  updateCamera(dt) {
    const cam = this.cameras.main;
    const pl = this.player;
    const s = cam.scrollY + (this.cameraTarget() - cam.scrollY) * (1 - Math.exp(-dt * 5));
    cam.scrollY = clamp(s, pl.y - C.H * 0.85, pl.y - 120); // never lose the player off-screen
  }

  updateEffects(dt) {
    const pl = this.player;
    pl.squash = Math.max(0, pl.squash - dt * 6);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    if (!pl.ground) this.trail.push(pl.x, pl.y);
    if (this.trail.length > 24 || (pl.ground && this.trail.length)) this.trail.splice(0, 2);
  }

  burst(x, y, color, n, speed, dirX = 0, dirY = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      const life = 0.3 + Math.random() * 0.3;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v + dirX * speed * 0.6,
        vy: Math.sin(a) * v + dirY * speed * 0.6,
        life,
        max: life,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  floatText(x, y, text) {
    const t = label(this, x, y, text, 22, 1, false).setColor('#ff8fa3').setDepth(40);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, delay: 500, duration: 900, onComplete: () => t.destroy() });
  }
}
