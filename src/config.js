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

export const MAX_CHARGES = 2; // double jump; only landing on a platform refills

export const DRAG_DEADZONE = 16; // drags shorter than this cancel
export const MAX_DRAG = 190; // drag length for full power
export const SLOWMO = 0.15; // time scale reached while aiming
export const SLOWMO_RAMP = 0.9; // seconds of aiming until time is fully slowed

export const CRUMBLE_TIME = 0.9;
export const CRUMBLE_RESPAWN = 3.5;
export const BOUNCE_MIN = 1700;
export const BOUNCE_MAX = 2300;
export const HIT_COOLDOWN = 1;

export const FUNNEL_W = 150; // mouth width of the funnel (an upside-down cone)
export const FUNNEL_D = 110; // mouth to tip
export const FUNNEL_TUBE = 140; // length of the tube rising from the tip
export const FUNNEL_NECK = 22; // half-width of the tube
export const FUNNEL_SPEED = 900; // px/s while sliding through the funnel and its tube
export const PORTAL_R = 26;
export const WARP_TIME = 0.9; // seconds to fly from the blue portal to the yellow one
export const PORTAL_EXIT = 1100; // upward speed (px/s) you leave the yellow portal with
export const STAR_RESPAWN = 4; // seconds until a taken star comes back

export const MAX_HP = 5;
export const HEART_LIFE = 5; // seconds a heart lasts once it is on screen
export const HEART_CHANCE = 0.3; // chance of a heart per main platform (from HEARTS_FROM up)
// Heights (m) where each thing starts appearing in the tower.
export const BOUNCY_FROM = 100;
export const HEARTS_FROM = 250;
export const STARS_FROM = 1500;
export const SPIKES_FROM = 150; // spikes, saws and wall spikes
export const FUNNELS_FROM = 500;
export const PORTALS_FROM = 1000;
export const RESPAWN_DELAY = 0.9;

export const PX_PER_M = 40;

// Heights (px above the ground) of the two tutorial bars. The first is one jump up, about a
// third of a screen. The second is more than a full jump (PEAK) above it, so it needs the double jump.
export const TUTORIAL_BARS = [340, 340 + PEAK + 120];

export const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif';

// Render at the device's real pixel density; the camera zooms the logical playfield up to it.
const fit = Math.min(win.innerWidth / W, win.innerHeight / H);
export const RES = Math.max(1, Math.min(3, Math.ceil(fit * (win.devicePixelRatio || 1) * 4) / 4));
