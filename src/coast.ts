import type { Art } from './art';
import { mix, type Pt } from './ink';
import { TILE, plainPen, rnd, wave } from './backdrop';

/**
 * Coast Road's scenery, after the reference boards for stylised coasts:
 * - the sea in one smooth gradient, deep blue at the horizon to turquoise in the shallows, with wave
 *   strokes that grow as they come nearer;
 * - headlands receding into the haze behind each other, each paler and bluer than the one in front;
 * - dramatic sandstone cliffs, banded in warm strata, broken into columns lit on the sunny side and in
 *   shade on the other, with grass overhanging their tops, sea stacks and an arch standing in the water,
 *   and white surf at every foot;
 * - a sandy cove close by, with umbrellas, towels, rocks with weed, and a surf line that washes in and out.
 */

const SKY = '#D6EEF6';

/** The sea, horizon to shallows. */
export function seaArt(): Art {
  const key = 'bd_c_sea';
  const h = 400;
  const p = plainPen(key);
  const n = 24;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const c = k < 0.5 ? mix('#2A62A8', '#3C94C8', k * 2) : mix('#3C94C8', '#56C8D2', (k - 0.5) * 2);
    p.rect(0, (i * h) / n, TILE, h / n + 2, { fill: c, stroke: null, r: 0 });
  }
  // Wave strokes: little ticks far off, longer curls nearer.
  for (let i = 0; i < 220; i++) {
    const y = 6 + rnd(121, i) * (h - 12);
    const x = rnd(123, i) * TILE;
    const k = y / h;
    const len = 10 + k * 70;
    p.line(
      [
        [x, y],
        [x + len * 0.5, y - 2 - k * 3],
        [x + len, y],
      ],
      { width: 1.2 + k * 2.6, color: '#E6F8FC', raw: true, opacity: 0.35 + k * 0.35, wobble: 0 },
    );
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h };
}

/** Headlands on the horizon, receding in the haze. */
export function headlandsArt(): Art {
  const key = 'bd_c_far';
  const h = 160;
  const p = plainPen(key);
  // Low headlands sitting on the horizon, the far ones palest; gaps between them, where the sea runs on.
  for (let row = 0; row < 3; row++) {
    const haze = 0.78 - row * 0.2;
    const top = wave(151 + row * 7, [34 - row * 6, 18, 8]);
    const base = h - 6;
    const at = (x: number) => Math.min(base, base - 40 - row * 10 - top(x) + Math.max(0, Math.sin((x / TILE) * Math.PI * (3 + row) + row) * 120 - 40));
    const pts: Pt[] = [];
    for (let x = 0; x <= TILE; x += 16) pts.push([x, at(x)]);
    p.shape([...pts, [TILE, base], [0, base]], { fill: mix('#C8A07A', SKY, haze), stroke: null, raw: true, wobble: 0.2 });
    p.shape([...pts.map(([x, y]): Pt => [x, y - 2]), ...pts.slice().reverse().map(([x, y]): Pt => [x, y + 10])], { fill: mix('#7EAE6A', SKY, haze), stroke: null, raw: true, wobble: 0.2 });
    p.rect(0, base - 4, TILE, 6, { fill: mix('#FFFFFF', SKY, haze * 0.5), stroke: null, r: 0, opacity: 0.8 });
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 1.2 };
}

/** The cliffs' top line and foot, in the cliffs picture's coordinates; the lighthouse stands at LIGHT.x. */
const CLIFF_H = 600;
const CLIFF_FOOT = CLIFF_H - 70;
const cliffTop = (x: number) => CLIFF_H - 360 - wave(131, [70, 40, 18])(x);
export const LIGHT = { x: 1560, lampY: cliffTop(1560) + 6 - 236 };

/** Sandstone cliffs, stacks, an arch and the lighthouse. */
export function cliffsArt(): Art {
  const key = 'bd_c_cliffs';
  const h = CLIFF_H;
  const p = plainPen(key);
  const at = cliffTop;
  const foot = CLIFF_FOOT;
  // The water at the cliffs' feet, turquoise.
  p.rect(0, foot - 6, TILE, h - foot + 6, { fill: '#4CB8CC', stroke: null, r: 0 });
  p.rect(0, foot + 30, TILE, h - foot - 30, { fill: '#3E9CC4', stroke: null, r: 0 });
  // Sea stacks and an arch, standing out in the water in front of the cliff line's gaps.
  const stack = (x: number, w: number, top: number) => {
    p.shape([[x - w / 2, foot + 10], [x - w * 0.44, top + 20], [x - w * 0.3, top], [x + w * 0.32, top + 4], [x + w * 0.46, top + 26], [x + w / 2, foot + 10]], { fill: '#E2A26E', stroke: null, raw: true, wobble: 0.6 });
    p.shape([[x, top + 2], [x + w * 0.32, top + 4], [x + w * 0.46, top + 26], [x + w / 2, foot + 10], [x + w * 0.1, foot + 10]], { fill: '#F2C28A', stroke: null, raw: true, wobble: 0.6 });
    for (let k = 1; k < 5; k++) p.line([[x - w * 0.45, top + k * ((foot - top) / 5)], [x + w * 0.46, top + k * ((foot - top) / 5) - 4]], { width: 2.5, color: '#C27E52', raw: true, opacity: 0.7, wobble: 0.4 });
    p.shape([[x - w * 0.34, top + 4], [x, top - 8], [x + w * 0.34, top + 6], [x + w * 0.2, top + 14], [x - w * 0.2, top + 14]], { fill: '#8CC070', stroke: null, wobble: 0.6 });
    p.ellipse(x, foot + 10, w * 0.62, 9, { fill: '#FFFFFF', stroke: null, opacity: 0.85, wobble: 0.8 });
  };
  // The main cliff line: strata bands, then columns lit on the right (the sun is to the right).
  const pts: Pt[] = [];
  for (let x = 0; x <= TILE; x += 12) pts.push([x, at(x)]);
  p.shape([...pts, [TILE, foot], [0, foot]], { fill: '#D8955E', stroke: null, raw: true, wobble: 0.3 });
  const strata = ['#E8B07A', '#D08A56', '#E2A26E', '#C67E4E', '#DC9C68'];
  for (let k = 0; k < 5; k++) {
    const band: Pt[] = [];
    for (let x = 0; x <= TILE; x += 24) {
      const t = (at(x) + (k / 5) * (foot - at(x)));
      band.push([x, t + Math.sin(x / 90 + k) * 6]);
    }
    const next: Pt[] = band.map(([x, y]) => [x, y + (foot - at(x)) / 5 + 2]);
    p.shape([...band, ...next.reverse()], { fill: strata[k], stroke: null, raw: true, wobble: 0.3, opacity: 0.85 });
  }
  for (let i = 0, x = 10; x < TILE; i++, x += 70 + rnd(161, i) * 160) {
    const w = 30 + rnd(163, i) * 70;
    const y0 = at(x) + 18;
    // A column's sunlit face, and the crack of shadow down its left.
    p.shape([[x, y0], [x + w, at(x + w) + 18], [x + w - 4, foot], [x + 4, foot]], { fill: '#F2C28A', stroke: null, raw: true, wobble: 0.5, opacity: 0.55 });
    p.line([[x, y0], [x - 2, (y0 + foot) / 2], [x + 3, foot]], { width: 3, color: '#9A5E3E', raw: true, opacity: 0.7, wobble: 0.6 });
  }
  // Grass over the top, overhanging the edge in tufts.
  p.shape([...pts.map(([x, y]): Pt => [x, y - 6]), ...pts.slice().reverse().map(([x, y]): Pt => [x, y + 16 + Math.sin(x / 23) * 6])], { fill: '#8CC070', stroke: null, raw: true, wobble: 0.4 });
  p.shape([...pts.map(([x, y]): Pt => [x, y - 6]), ...pts.slice().reverse().map(([x, y]): Pt => [x, y + 2])], { fill: '#B4D88A', stroke: null, raw: true, wobble: 0.3 });
  // Rocks and surf all along the foot.
  for (let i = 0, x = 0; x < TILE; i++, x += 50 + rnd(165, i) * 60) {
    p.ellipse(x, foot + 2, 18 + rnd(167, i) * 22, 9, { fill: '#9A7A6A', stroke: null, wobble: 0.7 });
    p.ellipse(x + 12, foot + 10, 30 + rnd(169, i) * 30, 7, { fill: '#FFFFFF', stroke: null, opacity: 0.85, wobble: 0.9 });
  }
  // Stacks, and an arch.
  stack(560, 90, at(560) + 70);
  stack(2050, 70, at(2050) + 110);
  const ax = 960;
  const atop = at(ax) + 60;
  p.shape([[ax - 120, foot + 10], [ax - 110, atop + 30], [ax - 70, atop], [ax + 80, atop + 6], [ax + 120, atop + 34], [ax + 126, foot + 10], [ax + 66, foot + 10], [ax + 60, atop + 110], [ax, atop + 80], [ax - 56, atop + 116], [ax - 60, foot + 10]], { fill: '#E2A26E', stroke: null, raw: true, wobble: 0.5 });
  p.shape([[ax + 60, atop + 110], [ax + 66, foot + 10], [ax + 126, foot + 10], [ax + 120, atop + 34], [ax + 80, atop + 6]], { fill: '#F2C28A', stroke: null, raw: true, wobble: 0.5 });
  p.shape([[ax - 100, atop + 26], [ax - 64, atop - 6], [ax + 82, atop], [ax + 112, atop + 26], [ax, atop + 16]], { fill: '#8CC070', stroke: null, wobble: 0.5 });
  for (const fx of [ax - 90, ax + 96]) p.ellipse(fx, foot + 10, 46, 8, { fill: '#FFFFFF', stroke: null, opacity: 0.85, wobble: 0.8 });
  // The lighthouse on the highest headland, with its keeper's cottage.
  const lx = LIGHT.x;
  const ly = at(lx) + 6;
  p.shape([[lx - 34, ly], [lx - 22, ly - 210], [lx + 22, ly - 210], [lx + 34, ly]], { fill: '#F6F2EA', stroke: null, raw: true });
  p.shape([[lx + 4, ly], [lx + 6, ly - 210], [lx + 22, ly - 210], [lx + 34, ly]], { fill: '#DCD6CC', stroke: null, raw: true });
  for (const k of [0.15, 0.45, 0.75]) {
    const y0 = ly - 210 * (1 - k);
    p.shape([[lx - 34 + 12 * (1 - k), y0], [lx + 34 - 12 * (1 - k), y0], [lx + 32 - 12 * (1 - k), y0 - 34], [lx - 32 + 12 * (1 - k), y0 - 34]], { fill: '#D8463A', stroke: null, raw: true });
  }
  p.rect(lx - 26, ly - 246, 52, 36, { fill: '#FFE9A8', stroke: null, r: 3 });
  p.shape([[lx - 34, ly - 244], [lx, ly - 284], [lx + 34, ly - 244]], { fill: '#D8463A', stroke: null, raw: true });
  p.rect(lx - 40, ly - 214, 80, 8, { fill: '#3A3A4E', stroke: null, r: 2 });
  p.rect(lx + 30, ly - 60, 70, 60, { fill: '#F6F2EA', stroke: null, r: 2 });
  p.shape([[lx + 24, ly - 58], [lx + 65, ly - 90], [lx + 106, ly - 58]], { fill: '#D8463A', stroke: null, raw: true });
  p.rect(lx + 52, ly - 40, 16, 16, { fill: '#FFE9A8', stroke: null, r: 2 });
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 0.4 };
}

/** The cove, near the road: sand, wet sand, the water's edge, rocks with weed, and a few beach-goers' things. */
export const COVE = { h: 280, edge: 112 };
export function coveArt(): Art {
  const key = 'bd_c_cove';
  const { h, edge } = COVE;
  const p = plainPen(key);
  const shore = (x: number) => edge + Math.sin((x / TILE) * Math.PI * 6) * 10 + Math.sin((x / TILE) * Math.PI * 14 + 1) * 4;
  const xs: number[] = [];
  for (let x = 0; x <= TILE; x += 12) xs.push(x);
  // Shallow water behind the beach.
  p.rect(0, 40, TILE, edge, { fill: '#5CCAD6', stroke: null, r: 0 });
  p.rect(0, 40, TILE, 20, { fill: '#4CB8CC', stroke: null, r: 0 });
  // Wet sand, then dry sand.
  p.shape([...xs.map((x): Pt => [x, shore(x)]), [TILE, h], [0, h]], { fill: '#D8BE8E', stroke: null, raw: true, wobble: 0.2 });
  p.shape([...xs.map((x): Pt => [x, shore(x) + 22 + Math.sin(x / 140) * 6]), [TILE, h], [0, h]], { fill: '#F2DDB0', stroke: null, raw: true, wobble: 0.2 });
  // Ripples in the dry sand, shells and pebbles.
  for (let i = 0; i < 90; i++) {
    const x = rnd(171, i) * TILE;
    const y = shore(x) + 40 + rnd(173, i) * (h - shore(x) - 50);
    p.line([[x, y], [x + 14, y - 1], [x + 26, y]], { width: 1.6, color: '#D8BE8E', raw: true, opacity: 0.8, wobble: 0 });
  }
  // Rocks with weed at the water's edge.
  for (let i = 0, x = 120; x < TILE; i++, x += 380 + rnd(175, i) * 300) {
    const y = shore(x) + 6;
    p.ellipse(x, y, 30, 16, { fill: '#8A7A80', stroke: null, wobble: 0.7 });
    p.ellipse(x - 6, y - 6, 16, 6, { fill: '#B4A4A8', stroke: null, wobble: 0.5 });
    p.ellipse(x + 4, y + 12, 34, 5, { fill: '#5E8A4E', stroke: null, wobble: 0.8, opacity: 0.9 });
  }
  // Umbrellas and towels.
  for (let i = 0, x = 300; x < TILE - 100; i++, x += 520 + rnd(177, i) * 260) {
    const y = shore(x) + 70 + rnd(179, i) * 50;
    const c = ['#EE6A4D', '#3FA7B5', '#FFB23F', '#B57BFF'][i % 4];
    p.rect(x + 20, y + 8, 60, 22, { fill: ['#FFFFFF', '#FFE07A', '#7ED0E0'][i % 3], stroke: null, r: 3 });
    for (let k = 0; k < 4; k++) p.rect(x + 22 + k * 15, y + 8, 6, 22, { fill: c, stroke: null, r: 0, opacity: 0.8 });
    p.line([[x, y + 20], [x + 4, y - 60]], { width: 3, color: '#8A6A5A', raw: true, wobble: 0 });
    p.shape([[x - 50, y - 50], [x + 4, y - 80], [x + 58, y - 54], [x + 4, y - 60]], { fill: c, stroke: null, raw: true, wobble: 0.3 });
    p.shape([[x - 22, y - 62], [x + 4, y - 80], [x + 30, y - 64], [x + 4, y - 60]], { fill: '#FFFFFF', stroke: null, raw: true, wobble: 0.3 });
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h };
}

/** The surf line: a scalloped band of white foam, drawn on its own so it can wash in and out. */
export function surfArt(): Art {
  const key = 'bd_c_surf';
  const h = 40;
  const p = plainPen(key);
  for (let i = 0, x = 0; x < TILE; i++, x += 30 + rnd(181, i) * 30) {
    p.ellipse(x, 20, 26 + rnd(183, i) * 20, 7 + rnd(185, i) * 5, { fill: '#FFFFFF', stroke: null, wobble: 0.8, opacity: 0.9 });
  }
  p.rect(0, 22, TILE, 6, { fill: '#FFFFFF', stroke: null, r: 0, opacity: 0.7 });
  return { key, svg: p.svg(TILE, h), w: TILE, h };
}
