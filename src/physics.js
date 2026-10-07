import * as C from './config.js';

export const MIN_X = C.WALL + C.PLAYER_R;
export const MAX_X = C.W - C.WALL - C.PLAYER_R;

// Free-flight step for any body {x, y, vx, vy}. Returns -1 / 1 when it bounced off the left / right wall.
export function integrate(b, dt) {
  b.vy = Math.min(b.vy + C.GRAVITY * dt, C.MAX_FALL);
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (b.x < MIN_X) {
    b.x = MIN_X;
    if (b.vx < 0) {
      b.vx = -b.vx * C.WALL_BOUNCE;
      return -1;
    }
  } else if (b.x > MAX_X) {
    b.x = MAX_X;
    if (b.vx > 0) {
      b.vx = -b.vx * C.WALL_BOUNCE;
      return 1;
    }
  }
  return 0;
}

export function launchSpeed(power) {
  return C.MIN_LAUNCH + (C.MAX_LAUNCH - C.MIN_LAUNCH) * power;
}

// Short dotted preview of the first half second of a launch, wall bounces included.
export function previewPath(x, y, aim, out) {
  const speed = launchSpeed(aim.power);
  const b = { x, y, vx: aim.x * speed, vy: aim.y * speed };
  const dt = 1 / 120;
  out.length = 0;
  for (let i = 1; i <= 60; i++) {
    integrate(b, dt);
    if (i % 4 === 0) out.push(b.x, b.y);
  }
  return out;
}
