const win = typeof window === 'undefined' ? { innerWidth: 540, innerHeight: 960, devicePixelRatio: 1 } : window;

// Logical playfield size. Width is fixed; height follows the screen's aspect so tall phones
// are filled edge to edge (wide screens get side bars instead).
export const W = 540;
export const H = Math.round(Math.min(1200, Math.max(900, (W * win.innerHeight) / win.innerWidth)));
export const WALL = 10;

export const PLAYER_R = 16;
export const GRAVITY = 2400; // px/s²
export const MAX_FALL = 2600;
// Height of a full-power vertical launch. Fixed (not tied to screen height) so the
// generated tower is identical on every device.
export const PEAK = 640;
// The camera keeps a standing player TOP_GAP below the top edge, so a full launch
// peaks just past the top of the screen.
export const TOP_GAP = PEAK - 60;
export const MIN_LAUNCH = 380; // px/s at the smallest drag
export const MAX_LAUNCH = Math.sqrt(2 * GRAVITY * PEAK); // ~1753 px/s at a full drag
export const WALL_BOUNCE = 0.8;

export const MAX_CHARGES = 2;
export const REFILL_TIME = 3; // seconds per charge while not landing

// A full-power vertical launch must come back down before one charge refills,
// otherwise the refill timer alone would allow endless flight.
console.assert((2 * MAX_LAUNCH) / GRAVITY < REFILL_TIME, 'launch airtime exceeds refill time');

export const DRAG_DEADZONE = 16; // drags shorter than this cancel
export const MAX_DRAG = 190; // drag length for full power
export const AIR_SLOWMO = 0.2; // time scale while aiming in the air

export const CRUMBLE_TIME = 0.9;
export const CRUMBLE_RESPAWN = 3.5;
export const BOUNCE_MIN = 1250;
export const BOUNCE_MAX = MAX_LAUNCH;
export const HIT_COOLDOWN = 1;

export const PX_PER_M = 40;

export const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif';

// Render at the device's real pixel density; the camera zooms the logical playfield up to it.
const fit = Math.min(win.innerWidth / W, win.innerHeight / H);
export const RES = Math.max(1, Math.min(3, Math.ceil(fit * (win.devicePixelRatio || 1) * 4) / 4));
