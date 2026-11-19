import { pen, type Art } from './art';
import { mix, type Pt } from './ink';
import { TILE, plainPen, rnd, wave } from './backdrop';

/**
 * Coast Road as a marine drive, printed in the poster's identity: a bright seaside morning.
 *
 * The road becomes a promenade along an open bay - a white balustrade and seafront lamps beside it, palms,
 * then the beach, the surf and the sea all the way out to the horizon:
 * - the sea in printed bands, deep navy at the horizon through blue and teal to bright shallows, with rows
 *   of curling crests that grow as they come nearer and halftone in the troughs, a glitter path under the sun;
 * - hazy headlands with a white hill town and a domed church across the bay;
 * - a pier running out into the bay to a red-and-bone lighthouse, a bandstand halfway along, boats moored
 *   by it and buoys bobbing;
 * - a beach of striped umbrellas, towels, a lifeguard tower, a sandcastle, and the surf washing in and out.
 * Far layers are flat and screened with halftone; near things are inked, as everywhere else.
 */

export const SEA = {
  deep: '#123A5A',
  navy: '#1B4A6C',
  blue: '#236686',
  teal: '#2E8A8E',
  aqua: '#3E9EA0',
  shallow: '#5EC4B4',
  pale: '#8ED6C4',
  foam: '#F6EAD4',
  sky: '#BFE0D0',
};
const BONE = '#F3E3CC';
const SAND = '#F2C98A';
const WET = '#D9A86A';
const RED = '#E3263A';
const EMBER = '#FF6A30';
const GOLD = '#FFB23F';
const OX = '#3A0F22';
const INK = '#0A0712';
const OLIVE = '#7E8A44';
const BOTTLE = '#2A4636';

/** A row of wave crests across the tile: little curls far off, bigger hooked crests nearer. */
function crests(p: ReturnType<typeof plainPen>, y: number, size: number, seed: number, colour: string, opacity: number, filled = false) {
  for (let i = 0, x = rnd(seed, 0) * size * 4; x < TILE + size * 2; i++, x += size * (4 + rnd(seed + 1, i) * 4)) {
    const yy = y + (rnd(seed + 2, i) - 0.5) * size * 0.8;
    if (filled) {
      // A hooked crest: a swell rising to a curl that tips over, foam on its lip.
      p.shape([[x, yy], [x + size * 0.8, yy - size * 0.7], [x + size * 1.6, yy - size * 0.9], [x + size * 2, yy - size * 0.5], [x + size * 1.6, yy - size * 0.55], [x + size * 1.3, yy - size * 0.3], [x + size * 2.6, yy]], { fill: colour, stroke: null, raw: true, wobble: 0.2, opacity });
    } else p.line([[x, yy], [x + size * 0.6, yy - size * 0.45], [x + size * 1.2, yy]], { width: Math.max(1.2, size * 0.18), color: colour, raw: true, opacity, wobble: 0 });
  }
}

/** The open sea, horizon to the bay: printed bands deepening to the horizon, crest rows, halftone between. */
export function seaArt(): Art {
  const key = 'bd_c_sea';
  const h = 400;
  const p = plainPen(key);
  const bands = [SEA.deep, '#163E60', SEA.navy, '#1F587A', SEA.blue, '#2A7590', '#2E8296', '#338C98'];
  let y = 0;
  bands.forEach((c, i) => {
    const bh = (h * (i + 1)) / ((bands.length * (bands.length + 1)) / 2);
    p.rect(0, y, TILE, bh + 2, { fill: c, stroke: null, r: 0, shade: [{ pts: [[0, y + bh * 0.55], [TILE, y + bh * 0.55], [TILE, y + bh + 2], [0, y + bh + 2]], color: mix(c, '#0A1A2A', 0.35) }] });
    crests(p, y + bh * 0.4, 3 + i * 1.6, 121 + i * 7, SEA.foam, 0.45 + i * 0.05);
    y += bh;
  });
  p.rect(0, 0, TILE, 3, { fill: SEA.sky, stroke: null, r: 0, opacity: 0.8 });
  return { key, svg: p.svg(TILE, h), w: TILE, h };
}

/** Headlands across the bay, hazy, and a white hill town with a domed church on the nearest of them. */
export function headlandsArt(): Art {
  const key = 'bd_c_far';
  const h = 260;
  const p = plainPen(key);
  const base = h - 6;
  for (let row = 0; row < 3; row++) {
    const haze = 0.72 - row * 0.22;
    const top = wave(151 + row * 7, [36 - row * 6, 18, 8]);
    const at = (x: number) => Math.min(base, base - 50 - row * 16 - top(x) + Math.max(0, Math.sin((x / TILE) * Math.PI * (3 + row) + row) * 130 - 40));
    const pts: Pt[] = [];
    for (let x = 0; x <= TILE; x += 16) pts.push([x, at(x)]);
    const land = mix('#2E6A5E', SEA.sky, haze);
    p.shape([...pts, [TILE, base], [0, base]], { fill: land, stroke: null, raw: true, wobble: 0.2, shade: row === 2 ? [{ pts: [...pts.map(([x, yy]): Pt => [x, yy + 26]), [TILE, base], [0, base]], color: mix(land, '#0A1A2A', 0.3) }] : [] });
    if (row === 2) {
      // The town: white houses stepping up the hill, a few red roofs, a dome and a bell tower.
      for (let i = 0, x = 700; x < 1380; i++, x += 22 + rnd(157, i) * 16) {
        const gy = at(x) + 18 + rnd(159, i) * 40;
        const hw = 14 + rnd(161, i) * 12;
        const hh = 12 + rnd(163, i) * 14;
        p.rect(x, gy - hh, hw, hh, { fill: BONE, stroke: null, r: 1 });
        p.rect(x + hw * 0.6, gy - hh, hw * 0.4, hh, { fill: '#D9C3A6', stroke: null, r: 0 });
        if (rnd(165, i) < 0.35) p.shape([[x - 2, gy - hh], [x + hw / 2, gy - hh - 7], [x + hw + 2, gy - hh]], { fill: EMBER, stroke: null, raw: true });
        if (rnd(167, i) < 0.4) p.rect(x + 3, gy - hh + 4, 3, 4, { fill: SEA.navy, stroke: null, r: 0 });
      }
      const dx = 1040;
      const dy = at(dx) + 10;
      p.rect(dx - 22, dy - 26, 44, 30, { fill: BONE, stroke: null, r: 1 });
      p.ellipse(dx, dy - 26, 22, 20, { fill: '#3E9EA0', stroke: null });
      p.rect(dx - 2, dy - 54, 4, 10, { fill: BONE, stroke: null, r: 0 });
      p.rect(dx + 40, dy - 60, 14, 62, { fill: BONE, stroke: null, r: 1 });
      p.shape([[dx + 38, dy - 60], [dx + 47, dy - 76], [dx + 56, dy - 60]], { fill: EMBER, stroke: null, raw: true });
    }
  }
  p.rect(0, base - 4, TILE, 8, { fill: SEA.foam, stroke: null, r: 0, opacity: 0.6 });
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 0.6 };
}

/** The bay, nearer: its water, the pier with a bandstand and a lighthouse at the end, boats and buoys. */
const BAY_H = 600;
const WATER_TOP = 320;
const DECK = 360;
export const LIGHT = { x: 1560, lampY: DECK - 214 };
export function bayArt(): Art {
  const key = 'bd_c_cliffs';
  const h = BAY_H;
  const p = plainPen(key);
  // The water: teal deepening to aqua as it comes in, crests growing, halftone in the troughs.
  const rows = [SEA.blue, '#2A7A8E', SEA.teal, '#3494A0', SEA.aqua, '#46AAA6'];
  let y = WATER_TOP;
  rows.forEach((c, i) => {
    const bh = ((h - WATER_TOP) * (i + 1)) / 21;
    p.rect(0, y, TILE, bh + 2, { fill: c, stroke: null, r: 0, shade: [{ pts: [[0, y + bh * 0.6], [TILE, y + bh * 0.6], [TILE, y + bh + 2], [0, y + bh + 2]], color: mix(c, '#0A1A2A', 0.3) }] });
    crests(p, y + bh * 0.45, 8 + i * 3, 131 + i * 5, SEA.foam, 0.7, i > 1);
    y += bh;
  });
  // The pier: a deck on pilings running out across the bay.
  const x0 = 260;
  const x1 = LIGHT.x + 40;
  for (let x = x0; x <= x1; x += 40) p.rect(x - 3, DECK, 6, h - DECK, { fill: OX, stroke: null, r: 0 });
  for (let x = x0; x < x1; x += 40) p.line([[x, DECK + 8], [x + 40, DECK + 40], [x + 40, DECK + 8], [x, DECK + 40]], { width: 1.6, color: OX, raw: true, opacity: 0.6, wobble: 0 });
  p.rect(x0 - 10, DECK - 10, x1 - x0 + 20, 12, { fill: '#B87A52', stroke: null, r: 0 });
  p.rect(x0 - 10, DECK - 22, x1 - x0 + 20, 4, { fill: BONE, stroke: null, r: 0 });
  for (let x = x0; x < x1; x += 16) p.rect(x, DECK - 22, 2, 12, { fill: BONE, stroke: null, r: 0 });
  // Lamps along it.
  for (let x = x0 + 60; x < x1 - 40; x += 160) {
    p.rect(x - 1.5, DECK - 60, 3, 50, { fill: INK, stroke: null, r: 0 });
    p.ellipse(x, DECK - 62, 5, 5, { fill: GOLD, stroke: null });
  }
  // A bandstand halfway along: a red-and-bone striped dome on posts.
  const bx = 900;
  p.rect(bx - 60, DECK - 70, 120, 60, { fill: BONE, stroke: null, r: 2 });
  for (let k = 0; k < 5; k++) p.rect(bx - 52 + k * 26, DECK - 64, 10, 48, { fill: SEA.blue, stroke: null, r: 4, opacity: 0.6 });
  for (let k = 0; k < 6; k++) {
    const a0 = Math.PI + (k / 6) * Math.PI;
    const a1 = Math.PI + ((k + 1) / 6) * Math.PI;
    p.shape([[bx, DECK - 70], [bx + Math.cos(a0) * 76, DECK - 70 + Math.sin(a0) * 46], [bx + Math.cos(a1) * 76, DECK - 70 + Math.sin(a1) * 46]], { fill: k % 2 ? BONE : RED, stroke: null, raw: true });
  }
  p.rect(bx - 2, DECK - 136, 4, 22, { fill: INK, stroke: null, r: 0 });
  p.shape([[bx + 2, DECK - 136], [bx + 22, DECK - 130], [bx + 2, DECK - 124]], { fill: RED, stroke: null, raw: true });
  // The lighthouse at the end: banded red and bone, a gallery, a lantern.
  const lx = LIGHT.x;
  p.shape([[lx - 26, DECK - 8], [lx - 16, DECK - 190], [lx + 16, DECK - 190], [lx + 26, DECK - 8]], { fill: BONE, stroke: null, raw: true });
  for (const k of [0.1, 0.42, 0.74]) {
    const y0 = DECK - 8 - 182 * k;
    const w0 = 26 - 10 * k;
    p.shape([[lx - w0, y0], [lx + w0, y0], [lx + w0 - 3, y0 - 34], [lx - w0 + 3, y0 - 34]], { fill: RED, stroke: null, raw: true });
  }
  p.shape([[lx + 4, DECK - 8], [lx + 6, DECK - 190], [lx + 16, DECK - 190], [lx + 26, DECK - 8]], { fill: '#0A1A2A', stroke: null, raw: true, opacity: 0.18 });
  p.rect(lx - 26, DECK - 196, 52, 8, { fill: INK, stroke: null, r: 1 });
  p.rect(lx - 16, DECK - 226, 32, 30, { fill: '#FFE9A8', stroke: null, r: 2 });
  p.shape([[lx - 22, DECK - 224], [lx, DECK - 252], [lx + 22, DECK - 224]], { fill: RED, stroke: null, raw: true });
  // Boats moored by the pier, and buoys.
  for (const [mx, c] of [[560, RED], [700, GOLD], [1260, SEA.navy]] as const) {
    const my = DECK + 70;
    p.shape([[mx - 34, my], [mx + 34, my], [mx + 24, my + 16], [mx - 24, my + 16]], { fill: BONE, stroke: null, raw: true });
    p.rect(mx - 34, my, 68, 5, { fill: c, stroke: null, r: 0 });
    p.rect(mx - 1.5, my - 60, 3, 60, { fill: OX, stroke: null, r: 0 });
    p.shape([[mx + 2, my - 58], [mx + 30, my - 6], [mx + 2, my - 6]], { fill: BONE, stroke: null, raw: true });
  }
  for (const bxx of [380, 1100, 1900, 2200]) {
    const by = DECK + 120 + (bxx % 3) * 20;
    p.shape([[bxx - 8, by], [bxx, by - 22], [bxx + 8, by]], { fill: RED, stroke: null, raw: true });
    p.rect(bxx - 8, by - 10, 16, 4, { fill: BONE, stroke: null, r: 0 });
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 0.3 };
}

/** Rows of crests on their own, to drift over the bay so the water moves. */
export function wavesArt(): Art {
  const key = 'bd_c_waves';
  const h = 200;
  const p = plainPen(key);
  for (let r = 0; r < 6; r++) crests(p, 20 + r * 32, 7 + r * 2.4, 211 + r * 3, SEA.foam, 0.55, r > 2);
  return { key, svg: p.svg(TILE, h), w: TILE, h };
}

/** The beach, by the road: shallows, foam, wet and dry sand, and a morning's worth of beach-goers' things. */
export const COVE = { h: 280, edge: 112 };
export function coveArt(): Art {
  const key = 'bd_c_cove';
  const { h, edge } = COVE;
  const p = pen(key);
  const shore = (x: number) => edge + Math.sin((x / TILE) * Math.PI * 6) * 10 + Math.sin((x / TILE) * Math.PI * 14 + 1) * 4;
  const xs: number[] = [];
  for (let x = 0; x <= TILE; x += 12) xs.push(x);
  // The shallows, turquoise to pale where it thins over the sand.
  p.rect(0, 30, TILE, edge, { fill: SEA.shallow, stroke: null, r: 0 });
  p.rect(0, 30, TILE, 18, { fill: SEA.aqua, stroke: null, r: 0 });
  p.shape([...xs.map((x): Pt => [x, shore(x) - 26]), ...xs.slice().reverse().map((x): Pt => [x, shore(x)])], { fill: SEA.pale, stroke: null, raw: true, wobble: 0.2 });
  // Wet sand, then dry sand, ripples screened in halftone.
  p.shape([...xs.map((x): Pt => [x, shore(x)]), [TILE, h], [0, h]], { fill: WET, stroke: null, raw: true, wobble: 0.2 });
  const dry: Pt[] = xs.map((x): Pt => [x, shore(x) + 20 + Math.sin(x / 140) * 6]);
  p.shape([...dry, [TILE, h], [0, h]], { fill: SAND, stroke: null, raw: true, wobble: 0.2, shade: [{ pts: [...dry.map(([x, y]): Pt => [x, y + 70]), [TILE, h], [0, h]], color: '#D9A86A' }] });
  for (let i = 0; i < 70; i++) {
    const x = rnd(171, i) * TILE;
    const y = shore(x) + 40 + rnd(173, i) * (h - shore(x) - 50);
    p.line([[x, y], [x + 14, y - 1], [x + 26, y]], { width: 1.6, color: WET, raw: true, opacity: 0.7, wobble: 0 });
  }
  // Things on the sand: umbrellas and towels, a lifeguard tower, a sandcastle, beach balls.
  const stripes = [RED, '#2E8A8E', GOLD, EMBER];
  for (let i = 0, x = 240; x < TILE - 120; i++, x += 300 + rnd(177, i) * 220) {
    const y = shore(x) + 76 + rnd(179, i) * 40;
    const kind = i % 5;
    if (kind === 3) {
      // The lifeguard tower: a red-and-bone hut on stilts, a flag.
      for (const sx of [-26, 26]) p.line([[x + sx, y + 30], [x + sx * 0.6, y - 60]], { width: 4, color: OX, raw: true });
      p.line([[x - 24, y], [x + 24, y - 40]], { width: 2.5, color: OX, raw: true });
      p.rect(x - 30, y - 104, 60, 46, { fill: RED, width: 3.5, r: 3 });
      p.rect(x - 22, y - 96, 44, 18, { fill: BONE, width: 2.5, r: 2 });
      p.shape([[x - 38, y - 104], [x, y - 128], [x + 38, y - 104]], { fill: BONE, width: 3, raw: true });
      p.line([[x, y - 128], [x, y - 156]], { width: 2.5, raw: true });
      p.shape([[x, y - 156], [x + 22, y - 150], [x, y - 144]], { fill: RED, width: 2, raw: true });
      continue;
    }
    if (kind === 1) {
      // A sandcastle with a flag, and a bucket.
      p.shape([[x - 30, y + 26], [x - 26, y], [x - 12, y], [x - 12, y - 16], [x + 12, y - 16], [x + 12, y], [x + 26, y], [x + 30, y + 26]], { fill: '#E0B070', width: 2.8, raw: true });
      for (const tx of [-19, 19]) p.rect(x + tx - 7, y - 12, 14, 12, { fill: '#E0B070', width: 2.4, r: 1 });
      p.line([[x, y - 16], [x, y - 36]], { width: 2, raw: true });
      p.shape([[x, y - 36], [x + 14, y - 31], [x, y - 26]], { fill: RED, width: 1.6, raw: true });
      p.shape([[x + 40, y + 24], [x + 42, y + 6], [x + 58, y + 6], [x + 60, y + 24]], { fill: GOLD, width: 2.4, raw: true });
      continue;
    }
    // An umbrella over a striped towel.
    const c = stripes[i % stripes.length];
    p.rect(x + 14, y + 6, 66, 22, { fill: BONE, width: 2.4, r: 3 });
    for (let k = 0; k < 4; k++) p.rect(x + 18 + k * 16, y + 6, 7, 22, { fill: c, stroke: null, r: 0 });
    p.line([[x, y + 24], [x + 4, y - 62]], { width: 3.4, color: OX, raw: true });
    const dome: Pt[] = [];
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI + (k / 8) * Math.PI;
      dome.push([x + 4 + Math.cos(a) * 60, y - 60 + Math.sin(a) * 30]);
    }
    p.shape(dome, { fill: c, width: 3, raw: true });
    for (let k = 0; k < 8; k += 2) {
      const a0 = Math.PI + (k / 8) * Math.PI;
      const a1 = Math.PI + ((k + 1) / 8) * Math.PI;
      p.shape([[x + 4, y - 60], [x + 4 + Math.cos(a0) * 60, y - 60 + Math.sin(a0) * 30], [x + 4 + Math.cos(a1) * 60, y - 60 + Math.sin(a1) * 30]], { fill: BONE, stroke: null, raw: true });
    }
    if (i % 3 === 0) {
      p.ellipse(x + 100, y + 14, 12, 12, { fill: BONE, width: 2.4 });
      p.shape([[x + 100, y + 2], [x + 112, y + 14], [x + 100, y + 14]], { fill: RED, stroke: null, raw: true });
      p.shape([[x + 88, y + 14], [x + 100, y + 26], [x + 100, y + 14]], { fill: '#2E8A8E', stroke: null, raw: true });
    }
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h };
}

/** The surf line: a scalloped band of foam in bone, drawn on its own so it can wash in and out. */
export function surfArt(): Art {
  const key = 'bd_c_surf';
  const h = 40;
  const p = plainPen(key);
  for (let i = 0, x = 0; x < TILE; i++, x += 26 + rnd(181, i) * 26) p.ellipse(x, 20, 24 + rnd(183, i) * 18, 6 + rnd(185, i) * 5, { fill: SEA.foam, stroke: null, wobble: 0.8, opacity: 0.95 });
  p.rect(0, 22, TILE, 5, { fill: SEA.foam, stroke: null, r: 0, opacity: 0.8 });
  for (let i = 0, x = 10; x < TILE; i++, x += 40 + rnd(187, i) * 40) p.ellipse(x, 30, 4, 2, { fill: '#FFFFFF', stroke: null });
  return { key, svg: p.svg(TILE, h), w: TILE, h };
}

/** The sun over the bay, printed: a warm white core breaking up into halftone at its rim. */
export function coastSunArt(): Art {
  const s = 360;
  const c = s / 2;
  let dots = '';
  const step = 12;
  for (let y = 0; y < s; y += step) {
    for (let x = (y / step) % 2 ? step / 2 : 0; x < s; x += step) {
      const d = Math.hypot(x - c, y - c) / (c - 4);
      if (d < 0.6 || d > 1) continue;
      const k = 1 - (d - 0.6) / 0.4;
      dots += `<circle cx="${x}" cy="${y}" r="${(step * 0.52 * Math.sqrt(k)).toFixed(2)}" fill="#FFE6A0"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle cx="${c}" cy="${c}" r="${(c - 4) * 0.61}" fill="#FFF6DE"/>${dots}</svg>`;
  return { key: 'bd_c_sun', svg, w: s, h: s };
}

/** A palm for the promenade: a curved, ringed trunk and a crown of arching fronds, coconuts under them. */
export function palmArt(): Art {
  const key = 'palm';
  const w = 300;
  const h = 460;
  const p = pen(key);
  const trunk: Pt[] = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    trunk.push([150 + Math.sin(t * 1.6) * 46 - t * 10, h - 8 - t * 330]);
  }
  p.line(trunk, { width: 22, color: '#8A5A3A' });
  p.line(trunk.map(([x, y]): Pt => [x - 5, y]), { width: 6, color: '#B87A52', opacity: 0.8 });
  for (let k = 1; k < 10; k++) {
    const [x, y] = trunk[k];
    p.line([[x - 11, y + 2], [x + 11, y - 2]], { width: 2.4, color: OX, raw: true });
  }
  const [cx, cy] = trunk[10];
  // Fronds: long arching blades, lit on top in olive, bottle green beneath with halftone.
  const fronds: [number, number][] = [[-2.9, 150], [-2.3, 160], [-1.7, 120], [-1.2, 130], [-0.6, 160], [-0.1, 150], [0.5, 120], [3.4, 120]];
  for (const [a, len] of fronds) {
    const tip: Pt = [cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.55 + len * 0.35];
    const mid: Pt = [cx + Math.cos(a) * len * 0.5, cy + Math.sin(a) * len * 0.55 * 0.5 - 18];
    const nx = -Math.sin(a) * 16;
    const ny = Math.cos(a) * 10;
    const blade: Pt[] = [[cx, cy], [mid[0] + nx, mid[1] - Math.abs(ny)], tip, [mid[0] - nx, mid[1] + Math.abs(ny) + 6]];
    p.shape(blade, { fill: OLIVE, width: 3.2, shade: [{ pts: [[cx, cy + 4], [mid[0] - nx, mid[1] + 20], tip, [mid[0], mid[1] + 4]], color: BOTTLE }] });
    p.line([[cx, cy], mid, tip], { width: 2, color: BOTTLE, opacity: 0.8 });
  }
  for (const [dx, dy] of [[-8, 10], [6, 12], [-1, 18]] as const) p.ellipse(cx + dx, cy + dy, 9, 9, { fill: '#6A2E2E', width: 2.4 });
  return { key, svg: p.svg(w, h), w, h };
}

/** A seafront lamp: a slim post with a curled arm and a lantern, a ringed base. */
export function promLampArt(): Art {
  const key = 'bd_c_lamp';
  const w = 120;
  const h = 360;
  const p = pen(key);
  p.rect(52, 60, 10, h - 80, { fill: INK, width: 2.5, r: 2 });
  p.rect(42, h - 40, 30, 30, { fill: '#2E8A8E', width: 3, r: 4 });
  p.rect(38, h - 14, 38, 10, { fill: INK, width: 2.5, r: 2 });
  p.line([[57, 70], [70, 46], [92, 44], [96, 60]], { width: 5, color: INK });
  p.shape([[84, 60], [108, 60], [104, 84], [88, 84]], { fill: '#FFE9A8', width: 3, raw: true });
  p.shape([[82, 60], [96, 48], [110, 60]], { fill: INK, width: 2.5, raw: true });
  p.ellipse(57, 56, 7, 7, { fill: GOLD, width: 2.5 });
  return { key, svg: p.svg(w, h), w, h };
}

/** A dolphin, mid-leap: a sleek grey-blue body, a bone belly, a fin. */
export function dolphinArt(): Art {
  const key = 'bd_c_dolphin';
  const p = pen(key);
  p.shape([[8, 40], [30, 22], [70, 16], [104, 22], [118, 30], [104, 34], [70, 40], [36, 44], [20, 52]], { fill: '#3E6E86', width: 3, shade: [{ pts: [[20, 34], [110, 30], [110, 50], [20, 50]], color: '#22465E' }] });
  p.shape([[40, 38], [70, 36], [100, 32], [70, 42]], { fill: BONE, stroke: null });
  p.shape([[62, 18], [72, 2], [80, 18]], { fill: '#3E6E86', width: 2.6, raw: true });
  p.shape([[8, 40], [0, 30], [4, 42], [0, 54], [14, 46]], { fill: '#3E6E86', width: 2.6, raw: true });
  p.ellipse(104, 24, 2.4, 2.4, { fill: INK, stroke: null });
  return { key, svg: p.svg(124, 60), w: 124, h: 60 };
}

/** A sailboat for the open sea: a bone hull with a red band, a bone sail with a red stripe. */
export function sailArt(): Art {
  const key = 'bd_c_sail';
  const p = pen(key);
  p.shape([[6, 70], [90, 70], [78, 86], [16, 86]], { fill: BONE, width: 2.6, raw: true });
  p.rect(6, 70, 84, 5, { fill: RED, stroke: null, r: 0 });
  p.line([[46, 70], [46, 6]], { width: 2.4, raw: true });
  p.shape([[48, 8], [84, 66], [48, 66]], { fill: BONE, width: 2.4, raw: true });
  p.shape([[48, 40], [68, 40], [76, 52], [48, 52]], { fill: RED, stroke: null, raw: true });
  p.shape([[44, 14], [20, 66], [44, 66]], { fill: '#F2E0C4', width: 2.4, raw: true });
  return { key, svg: p.svg(96, 92), w: 96, h: 92 };
}
