// Color palettes. Each section of the tower (between two doors) has one: its background is
// the color of the door that opened it. `ink` is the dark tone of that background: platforms,
// outlines and text marks use it, so every object reads on any background.
// Each family can set its own object colors (player, portals, stars...) to match its backgrounds.
//
// Preview them with `npm run palettes` (writes PNGs to palette-preview/).

const BRIGHT = {
  canJump: 0x2f80ff, // player while a jump is left
  cantJump: 0xff3b4e, // player when out of jumps
  star: 0xfff06a,
  heart: 0xff5c8a,
  portalBlue: 0x3d7bff,
  portalYellow: 0xffd400,
  bouncy: 0x9b5cff,
  hazard: 0xff3b4e,
};

export const FAMILIES = {
  pastel: {
    label: 'Pastel: light backgrounds, matching pastel objects',
    objects: {
      canJump: 0x6fa8ff,
      cantJump: 0xff8593,
      star: 0xffe27a,
      heart: 0xff9cbc,
      portalBlue: 0x86b2ff,
      portalYellow: 0xffd56b,
      bouncy: 0xbb9bff,
      hazard: 0xff8a7a,
    },
    sections: [
      { name: 'Cloud', bg: 0xd3e8f8, ink: 0x40607e },
      { name: 'Butter', bg: 0xfbefbf, ink: 0x6e5c2c },
      { name: 'Mint', bg: 0xcff0e1, ink: 0x2f6152 },
      { name: 'Peach', bg: 0xfde0d0, ink: 0x7c4838 },
      { name: 'Lavender', bg: 0xe5dcf8, ink: 0x514478 },
      { name: 'Pistachio', bg: 0xe3f1cb, ink: 0x4d6030 },
      { name: 'Blossom', bg: 0xfadbe8, ink: 0x7c405a },
      { name: 'Seafoam', bg: 0xd2eff0, ink: 0x2f6265 },
    ],
  },
  pop: {
    label: 'Pop: clear mid-light colors',
    sections: [
      { name: 'Sky', bg: 0x8fd3f4, ink: 0x0e2f44 },
      { name: 'Sunflower', bg: 0xffd45c, ink: 0x4a3400 },
      { name: 'Mint', bg: 0x86e3c3, ink: 0x0d3d30 },
      { name: 'Coral', bg: 0xff9e8a, ink: 0x4d1b12 },
      { name: 'Lilac', bg: 0xc6aef7, ink: 0x2b1b57 },
      { name: 'Lime', bg: 0xc9e77e, ink: 0x2c4211 },
      { name: 'Rose', bg: 0xf9b0cf, ink: 0x4e1733 },
      { name: 'Peach', bg: 0xffc79a, ink: 0x4a2810 },
    ],
  },
  vivid: {
    label: 'Vivid: full saturation',
    sections: [
      { name: 'Cyan', bg: 0x22c3e6, ink: 0x062b36 },
      { name: 'Yellow', bg: 0xffc20e, ink: 0x3d2a00 },
      { name: 'Teal', bg: 0x19c2a0, ink: 0x04302a },
      { name: 'Orange', bg: 0xff7a3d, ink: 0x3f1500 },
      { name: 'Violet', bg: 0xa66cff, ink: 0x1e0b47 },
      { name: 'Green', bg: 0x6dd34a, ink: 0x133b08 },
      { name: 'Magenta', bg: 0xff5fa2, ink: 0x44061f },
      { name: 'Lemon', bg: 0xd7f043, ink: 0x364000 },
    ],
  },
  soft: {
    label: 'Soft: muted, calm',
    sections: [
      { name: 'Fog', bg: 0xa9c7d8, ink: 0x1e3442 },
      { name: 'Mustard', bg: 0xe3c26b, ink: 0x3e3112 },
      { name: 'Sage', bg: 0xa8c9a1, ink: 0x22361f },
      { name: 'Clay', bg: 0xd9a08b, ink: 0x40231a },
      { name: 'Lavender', bg: 0xbbaed6, ink: 0x2a2340 },
      { name: 'Olive', bg: 0xc4c88a, ink: 0x33351a },
      { name: 'Blush', bg: 0xe3b3c0, ink: 0x43222c },
      { name: 'Sand', bg: 0xe2cfa8, ink: 0x3d321d },
    ],
  },
};

export const FAMILY = 'pastel'; // the family the game uses

// Object colors of a family (the bright set unless it has its own).
export const objectsOf = (family) => FAMILIES[family].objects || BRIGHT;
export const OBJECTS = objectsOf(FAMILY);

export function mixColor(a, b, k) {
  const ch = (s) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// Full palette for one section entry of a family.
export function expand(sec, family = FAMILY) {
  return {
    ...objectsOf(family),
    bg: sec.bg,
    door: sec.bg,
    ink: sec.ink,
    wall: mixColor(sec.bg, sec.ink, 0.14),
    deco: sec.ink,
    plat: sec.ink,
    // A light tint of the background, for the inside of funnels.
    fill: mixColor(sec.bg, 0xffffff, 0.55),
    spark: 0xffffff, // flashes and sparks
  };
}
