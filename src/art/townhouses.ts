import { pen, type Art } from './art';
import type { Pt } from './ink';
import { TILE, plainPen, rnd } from './backdrop';

/**
 * Neon Town's street, built for the future: five buildings, each its own shape rather than a box, inked like
 * the near world and lit for a rainy night - indigo and teal-navy walls, warm amber windows, and the shop's
 * own neon as the accent.
 *
 *   DINER    a capsule on two pylons, a glass bubble on top, portholes, a curved window of booths
 *   LAUNDRY  three modules stacked off-true, the top one cantilevered, round washer windows glowing
 *   CINEMA   a stepped deco tower with a spire and beacon, fins in neon, a marquee of chasing bulbs
 *   PIZZA    a geodesic dome on a drum, a round window cut like a pizza, a dish on the roof, the oven aglow
 *   HOTEL    a slim tower of balconies stepping left and right with plants on them, a floating ring on top
 *
 * Each stands on a foundation that runs on below its ground line, so on a slope it meets the road instead of
 * floating over it; the road, drawn in front, hides what is underground.
 */

export const HOUSE = { w: 420, h: 640, ground: 460 };
/** The street band's plaza top, inside its picture. */
export const STREET_TOP = 80;

const INK = '#0A0712';
const AMBER = '#FFC86B';
const AMBER_DEEP = '#FF9E4A';
const TRIM = '#B8B4E0';
const METAL = '#4A5274';
const GLASS = '#141A30';
const PLANT = '#2A4636';

type P = ReturnType<typeof pen>;
interface Look {
  wall: string;
  neon: string;
  awning: string;
}

const shade = (x0: number, y0: number, x1: number, y1: number, color: string) => [{ pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Pt[], color }];
/** A darker version of a colour, for shade. */
const dark = (hex: string, k = 0.45) => {
  const v = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k)));
  return '#' + v.map((c) => c.toString(16).padStart(2, '0')).join('');
};

/** The foundation and pavement every building stands on, running on below the ground line. */
function foundation(p: P, look: Look) {
  const { w, h, ground } = HOUSE;
  p.rect(10, ground - 18, w - 20, h - ground + 18, { fill: '#141828', width: 4, r: 3 });
  p.rect(10, ground - 18, w - 20, 8, { fill: look.neon, r: 2, stroke: null, opacity: 0.9 });
  for (let x = 40; x < w - 30; x += 60) p.line([[x, ground - 6], [x, ground + 40]], { width: 2, color: '#252C44', raw: true });
}

/** The sign band the game writes the name on: dark glass outlined in a neon tube. */
function signBand(p: P, look: Look, x0 = 40, x1 = 380) {
  p.rect(x0, 214, x1 - x0, 56, { fill: '#0B0E24', width: 4, r: 8 });
  p.rect(x0 + 6, 220, x1 - x0 - 12, 44, { width: 3, stroke: look.neon, r: 6 });
}

/** A lit window with a person-shaped or plant-shaped silhouette now and then, and a sill. */
function window_(p: P, x: number, y: number, w: number, h: number, lit: boolean, r = 4, tint = AMBER) {
  p.rect(x, y, w, h, { fill: lit ? tint : GLASS, width: 3.5, r, shade: lit ? shade(x, y + h * 0.6, x + w, y + h, AMBER_DEEP) : [] });
  if (lit && w > 30) p.line([[x + 6, y + 6], [x + w * 0.4, y + 6], [x + 6, y + h * 0.4]], { width: 2.4, color: '#FFFFFF', raw: true, opacity: 0.5 });
}

function diner(p: P, look: Look) {
  // Two pylons carry the capsule; the capsule's long rounded body, a neon ring round its waist.
  for (const x of [96, 324]) p.shape([[x - 26, 460], [x - 14, 380], [x + 14, 380], [x + 26, 460]], { fill: METAL, raw: true, width: 4 });
  p.rect(26, 100, 368, 300, { fill: look.wall, width: 5, r: 120, shade: shade(220, 90, 400, 410, dark(look.wall)) });
  p.rect(26, 186, 368, 8, { fill: TRIM, stroke: null, r: 2, opacity: 0.7 });
  // A glass bubble on the roof, booths lit inside it.
  p.ellipse(210, 104, 84, 56, { fill: AMBER, width: 4.5, shade: shade(210, 40, 300, 170, AMBER_DEEP) });
  p.line([[150, 80], [190, 64]], { width: 3, color: '#FFFFFF', raw: true, opacity: 0.6 });
  p.rect(120, 124, 180, 14, { fill: INK, r: 3, stroke: null });
  // Portholes along the top.
  for (const x of [84, 130, 290, 336]) {
    p.ellipse(x, 160, 17, 17, { fill: x % 2 ? AMBER : look.neon, width: 4 });
    p.ellipse(x, 160, 21, 21, { stroke: TRIM, width: 2.5 });
  }
  signBand(p, look, 60, 360);
  // A curved shop window full of booths and diners, and a round-topped door.
  p.rect(56, 292, 236, 92, { fill: AMBER, width: 4.5, r: 30, shade: shade(56, 350, 292, 390, AMBER_DEEP) });
  for (const x of [96, 156, 216]) {
    p.rect(x - 16, 340, 32, 30, { fill: look.awning, r: 6, width: 2.5 });
    p.ellipse(x, 328, 9, 9, { fill: dark(look.wall, 0.3), stroke: null });
  }
  p.shape([[310, 386], [310, 316], [338, 296], [366, 316], [366, 386]], { fill: dark(look.wall, 0.2), width: 4 });
  p.rect(322, 320, 32, 40, { fill: look.neon, width: 2.5, r: 10 });
  p.rect(26, 282, 368, 8, { fill: look.neon, r: 3, stroke: null });
}

function laundry(p: P, look: Look) {
  // The bottom module: a long glass front of round washer windows, all spinning mint.
  p.rect(30, 290, 360, 170, { fill: look.wall, width: 5, r: 18, shade: shade(280, 280, 400, 470, dark(look.wall)) });
  for (const x of [80, 150, 220]) {
    p.ellipse(x, 360, 28, 28, { fill: METAL, width: 4 });
    p.ellipse(x, 360, 20, 20, { fill: look.neon, width: 3 });
    p.line([[x - 10, 354], [x + 6, 366]], { width: 3, color: '#FFFFFF', raw: true, opacity: 0.6 });
  }
  p.rect(280, 316, 84, 144, { fill: GLASS, width: 4, r: 10 });
  p.rect(292, 330, 60, 70, { fill: AMBER, width: 3, r: 8 });
  // The middle module, shifted right, carrying the sign.
  p.rect(64, 196, 340, 96, { fill: dark(look.wall, 0.15), width: 5, r: 16, shade: shade(300, 190, 410, 300, dark(look.wall)) });
  signBand(p, look, 78, 390);
  // The top module, cantilevered off to the left over the street on a strut, with a big round window and a balcony.
  p.line([[60, 196], [130, 150]], { width: 8, color: METAL });
  p.rect(14, 52, 236, 144, { fill: look.wall, width: 5, r: 22, shade: shade(170, 40, 260, 200, dark(look.wall)) });
  p.ellipse(84, 122, 44, 44, { fill: AMBER, width: 4.5, shade: shade(84, 130, 130, 170, AMBER_DEEP) });
  p.line([[84, 78], [84, 166]], { width: 3, raw: true });
  p.line([[40, 122], [128, 122]], { width: 3, raw: true });
  window_(p, 158, 84, 64, 64, false, 10);
  p.rect(140, 184, 116, 8, { fill: TRIM, width: 2.5, r: 2 });
  for (let x = 146; x < 252; x += 14) p.line([[x, 166], [x, 184]], { width: 2, color: TRIM, raw: true });
  p.line([[140, 166], [256, 166]], { width: 2.4, color: TRIM, raw: true });
  // A vent stack with a curl of steam, and an antenna.
  p.rect(316, 120, 30, 78, { fill: METAL, width: 4, r: 6 });
  p.rect(310, 112, 42, 12, { fill: TRIM, width: 3, r: 3 });
  p.line([[372, 196], [372, 120], [390, 104]], { width: 3, raw: true });
  p.ellipse(390, 102, 5, 5, { fill: look.neon, stroke: null });
}

function cinema(p: P, look: Look) {
  // Wings either side of the tower.
  for (const [x0, x1] of [[26, 126], [294, 394]]) p.rect(x0, 160, x1 - x0, 300, { fill: dark(look.wall, 0.1), width: 5, r: 6, shade: x0 > 200 ? shade(x0, 150, x1 + 4, 470, dark(look.wall)) : [] });
  // The tower: stepped setbacks to a spire with a beacon.
  p.rect(120, 80, 180, 380, { fill: look.wall, width: 5, r: 4, shade: shade(232, 70, 304, 470, dark(look.wall)) });
  p.rect(140, 50, 140, 34, { fill: look.wall, width: 4.5, r: 3 });
  p.rect(162, 26, 96, 28, { fill: look.wall, width: 4, r: 3 });
  p.shape([[196, 28], [210, -40 + 46], [224, 28]], { fill: TRIM, raw: true, width: 3.5 });
  p.ellipse(210, 8, 8, 8, { fill: look.neon, width: 2.5 });
  // Neon fins up the tower, and lit slots between them.
  for (const x of [148, 210, 272]) p.rect(x - 4, 90, 8, 116, { fill: look.neon, width: 2, r: 3 });
  for (const x of [179, 241]) for (let y = 100; y < 200; y += 26) p.rect(x - 9, y, 18, 16, { fill: (x + y) % 3 ? AMBER : GLASS, width: 2.5, r: 2 });
  // The marquee: the sign band framed in chasing bulbs.
  signBand(p, look, 30, 390);
  for (let x = 40; x < 384; x += 16) {
    p.dot(x, 206, 3.4, look.neon);
    p.dot(x, 278, 3.4, look.neon);
  }
  // Posters in lit frames, a ticket window, the doors.
  for (const x of [44, 324]) {
    p.rect(x, 300, 52, 80, { fill: AMBER, width: 4, r: 3 });
    p.rect(x + 8, 310, 36, 40, { fill: look.awning, width: 2, r: 2 });
    p.ellipse(x + 26, 364, 10, 6, { fill: dark(look.wall, 0.2), stroke: null });
  }
  p.rect(150, 300, 120, 160, { fill: GLASS, width: 4.5, r: 6 });
  p.rect(166, 316, 88, 36, { fill: AMBER, width: 3, r: 18 });
  p.line([[210, 362], [210, 458]], { width: 3, color: TRIM, raw: true });
}

function pizza(p: P, look: Look) {
  // The drum the dome sits on.
  p.rect(30, 300, 360, 160, { fill: dark(look.wall, 0.1), width: 5, r: 10, shade: shade(280, 290, 400, 470, dark(look.wall)) });
  // The geodesic dome: a half-disc of facets.
  const cx = 210;
  const cy = 300;
  const R = 186;
  const dome: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (i / 24) * Math.PI;
    dome.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.92]);
  }
  p.shape(dome, { fill: look.wall, raw: true, width: 5, shade: [{ pts: [[cx + 20, 80], [cx + R + 10, 80], [cx + R + 10, cy + 6], [cx + 20, cy + 6]], color: dark(look.wall) }] });
  for (let k = 1; k < 4; k++) {
    const y = cy - R * 0.92 * (k / 4);
    const hw = R * Math.sqrt(1 - (k / 4) * (k / 4));
    p.line([[cx - hw, y], [cx + hw, y]], { width: 2, color: TRIM, raw: true, opacity: 0.35 });
  }
  for (let i = 1; i < 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    p.line([[cx, cy], [cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.92]], { width: 2, color: TRIM, raw: true, opacity: 0.35 });
  }
  // A round window at the crown, cut like a pizza.
  p.ellipse(cx, 150, 44, 44, { fill: AMBER, width: 4.5, shade: shade(cx, 150, cx + 50, 200, AMBER_DEEP) });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI;
    p.line([[cx - Math.cos(a) * 42, 150 - Math.sin(a) * 42], [cx + Math.cos(a) * 42, 150 + Math.sin(a) * 42]], { width: 3, raw: true });
  }
  for (const [x, y] of [[cx - 18, 140], [cx + 14, 160], [cx + 8, 132]] as const) p.dot(x, y, 5, look.awning);
  // A dish on the roof.
  p.line([[340, 196], [362, 160]], { width: 4, color: METAL });
  p.shape([[338, 150], [376, 132], [388, 168], [356, 176]], { fill: TRIM, raw: true, width: 3.5 });
  p.dot(368, 156, 3.5, look.neon);
  signBand(p, look, 40, 380);
  // The shop front: the oven glowing ember through a wide window, a door.
  p.rect(52, 312, 230, 132, { fill: '#2A1A1A', width: 4.5, r: 10 });
  p.shape([[90, 444], [90, 360], [130, 332], [204, 332], [244, 360], [244, 444]], { fill: look.neon, width: 3.5, shade: shade(90, 400, 250, 450, AMBER_DEEP) });
  p.ellipse(167, 404, 46, 24, { fill: AMBER, width: 2.5 });
  p.rect(300, 324, 74, 136, { fill: GLASS, width: 4, r: 8 });
  p.rect(312, 338, 50, 52, { fill: AMBER, width: 3, r: 8 });
}

function hotel(p: P, look: Look) {
  // The slim tower.
  p.rect(116, 30, 188, 430, { fill: look.wall, width: 5, r: 12, shade: shade(230, 20, 310, 470, dark(look.wall)) });
  // Rows of lit windows, and balconies stepping out left and right with plants on them.
  for (let row = 0; row < 7; row++) {
    const y = 50 + row * 56;
    if (y > 200 && y < 290) continue;
    for (let k = 0; k < 3; k++) window_(p, 136 + k * 54, y, 40, 30, (row + k) % 3 !== 0, 6);
    const left = row % 2 === 0;
    const bx = left ? 60 : 284;
    p.rect(bx, y + 34, 76, 12, { fill: TRIM, width: 3, r: 6 });
    p.line([[bx + 4, y + 20], [bx + 72, y + 20]], { width: 2.4, color: TRIM, raw: true });
    for (let x = bx + 8; x < bx + 72; x += 12) p.line([[x, y + 20], [x, y + 34]], { width: 1.8, color: TRIM, raw: true });
    for (const dx of [14, 30, 56]) p.dot(bx + dx, y + 18, 7, PLANT);
  }
  // A floating ring round the top, lit, and an antenna.
  p.ellipse(210, 30, 120, 22, { stroke: look.neon, width: 6 });
  p.ellipse(210, 30, 120, 22, { stroke: INK, width: 2 });
  p.line([[210, 30], [210, -10 + 12]], { width: 3, raw: true });
  signBand(p, look, 70, 350);
  // The entrance: a canopy, a revolving door, two potted trees.
  p.shape([[100, 300], [320, 300], [340, 322], [80, 322]], { fill: look.awning, raw: true, width: 4 });
  p.rect(90, 320, 240, 6, { fill: look.neon, r: 2, stroke: null });
  p.rect(150, 336, 120, 124, { fill: GLASS, width: 4.5, r: 8 });
  p.ellipse(210, 400, 40, 40, { fill: AMBER, width: 4 });
  p.line([[210, 360], [210, 440]], { width: 3, raw: true });
  p.line([[172, 400], [248, 400]], { width: 3, raw: true });
  for (const x of [112, 308]) {
    p.rect(x - 14, 420, 28, 40, { fill: METAL, width: 3, r: 3 });
    p.ellipse(x, 404, 22, 26, { fill: PLANT, width: 3 });
  }
}

const BUILDERS = [diner, laundry, cinema, pizza, hotel];

/** One of the street's buildings, by shop number, in that shop's colours. */
export function houseArt(n: number, look: Look): Art {
  const key = `shop_${n}`;
  const p = pen(key);
  foundation(p, look);
  BUILDERS[n % BUILDERS.length](p, look);
  return { key, svg: p.svg(HOUSE.w, HOUSE.h), w: HOUSE.w, h: HOUSE.h };
}

/**
 * The street level between the road and the city: a dark plaza for the distant buildings and the railway's
 * pillars to stand on, with a lit kerb, low planters, benches and street lamps, so nothing floats over a
 * gap of sky.
 */
export function streetArt(): Art {
  const key = 'bd_n_street';
  const h = 500;
  const T = 80;
  const p = plainPen(key);
  p.rect(0, T, TILE, h - T, { fill: '#121628', stroke: null, r: 0 });
  p.rect(0, T, TILE, 10, { fill: '#2A3150', stroke: null, r: 0 });
  p.rect(0, T + 10, TILE, 4, { fill: '#5ED6C2', stroke: null, r: 0, opacity: 0.35 });
  p.rect(0, T + 14, TILE, 60, { fill: '#181E36', stroke: null, r: 0 });
  for (let x = 0; x < TILE; x += 90) p.line([[x, T + 14], [x - 20, T + 74]], { width: 2, color: '#232A46', raw: true, wobble: 0 });
  for (let i = 0, x = 40; x < TILE - 40; i++, x += 160 + rnd(711, i) * 140) {
    const kind = Math.floor(rnd(713, i) * 3);
    if (kind === 0) {
      // A street lamp: a slim post and a warm head.
      p.rect(x - 2, T - 56, 4, 70, { fill: '#2A3150', stroke: null, r: 1 });
      p.rect(x - 12, T - 62, 24, 6, { fill: AMBER, stroke: null, r: 3 });
    } else if (kind === 1) {
      // A planter with a little tree.
      p.rect(x - 22, T - 8, 44, 18, { fill: '#2A3150', stroke: null, r: 3 });
      p.ellipse(x, T - 24, 20, 18, { fill: '#1E3A3A', stroke: null });
    } else {
      // A bench.
      p.rect(x - 24, T - 2, 48, 6, { fill: '#2A3150', stroke: null, r: 2 });
      p.rect(x - 22, T + 4, 4, 8, { fill: '#2A3150', stroke: null, r: 1 });
      p.rect(x + 18, T + 4, 4, 8, { fill: '#2A3150', stroke: null, r: 1 });
    }
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h };
}
