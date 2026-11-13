import { pen, type Art } from './art';
import { mix, type Pt } from './ink';
import { TILE, plainPen, rnd, wave } from './backdrop';

/**
 * The two night biomes' scenery.
 *
 * Neon Town, as a cyberpunk city: an indigo sky glowing magenta at the horizon with the city's light;
 * far megatowers with light strips and red beacons; a dense mid-city of lit windows and vertical neon
 * signs; an elevated railway; and, over each lit layer, a blurred copy of only its lights, added on top,
 * so neon and windows bloom.
 *
 * Frostpeak Pass, at blue hour under the aurora: jagged peaks lit by the moon on one side and in deep blue
 * shadow on the other; pine forests as spiky silhouettes, not stamped rows, with moonlit rims; rolling
 * snowdrifts with blue shadows; and a dark frozen lake that reflects the sky, with warm cabin windows.
 */

// ===================================================================================== Neon Town

const NEON = ['#FF3FD0', '#3FF2FF', '#FFB43F', '#B57BFF', '#FF5A7A'];

/** A tall stack of floors: a block with set-backs near the top, a spire or antennae. */
function tower(p: ReturnType<typeof plainPen>, x: number, w: number, h: number, base: number, fill: string, seed: number) {
  const top = base - h;
  p.rect(x, top, w, h + 4, { fill, stroke: null, r: 0 });
  // Set-backs: the top two storeys narrower.
  const s1 = w * 0.16;
  p.rect(x + s1, top - h * 0.08, w - s1 * 2, h * 0.08 + 2, { fill, stroke: null, r: 0 });
  const s2 = w * 0.32;
  p.rect(x + s2, top - h * 0.13, w - s2 * 2, h * 0.05 + 2, { fill, stroke: null, r: 0 });
  if (rnd(seed, 1) < 0.6) p.line([[x + w / 2, top - h * 0.13], [x + w / 2, top - h * 0.13 - 90 - rnd(seed, 2) * 80]], { width: 4, color: fill, raw: true, wobble: 0 });
  return top - h * 0.13;
}

/**
 * The megatowers on the horizon: few, very tall and slender, hazed purple with the glow beneath them.
 * With `lights`, draws only their light strips and beacons (for the bloom layer).
 */
export const MEGA_BEACONS: Pt[] = [];
export function megaArt(lights: boolean): Art {
  const key = lights ? 'bd_n_mega_glow' : 'bd_n_mega';
  const h = 1100;
  const p = plainPen(key);
  if (!lights) MEGA_BEACONS.length = 0;
  const towers: [number, number, number][] = [];
  for (let i = 0, x = 40; x < TILE - 160; i++) {
    const w = 90 + rnd(201, i) * 120;
    const th = 500 + rnd(203, i) * 520;
    towers.push([x, w, th]);
    x += w + 120 + rnd(205, i) * 260;
  }
  towers.forEach(([x, w, th], i) => {
    if (!lights) {
      const top = tower(p, x, w, th, h, '#2C1E58', 207 + i);
      // The lower part lit by the city's glow from below.
      p.rect(x, h - 220, w, 224, { fill: '#4A2A72', stroke: null, r: 0, opacity: 0.8 });
      MEGA_BEACONS.push([x + w / 2, top - 6]);
    }
    // Light strips running up the corners, and a band of light every so many floors.
    const c = NEON[i % 2 ? 1 : 0];
    const lw = lights ? 7 : 3;
    p.line([[x + 6, h], [x + 6, h - th + 30]], { width: lw, color: c, raw: true, opacity: lights ? 0.9 : 0.75, wobble: 0 });
    p.line([[x + w - 6, h], [x + w - 6, h - th + 30]], { width: lw, color: c, raw: true, opacity: lights ? 0.9 : 0.75, wobble: 0 });
    for (let y = h - 120; y > h - th + 60; y -= 140 + rnd(209, i) * 80) p.line([[x + 6, y], [x + w - 6, y]], { width: lights ? 5 : 2, color: c, raw: true, opacity: 0.6, wobble: 0 });
    // A few rows of lit windows.
    if (!lights) {
      for (let y = h - th + 80; y < h - 40; y += 26) {
        for (let wx = x + 14; wx < x + w - 14; wx += 16) {
          if (rnd(211 + i, wx * 3 + y) < 0.12) p.rect(wx, y, 8, 10, { fill: rnd(213, wx + y) < 0.5 ? '#9FE8FF' : '#FFC6F0', stroke: null, r: 1, opacity: 0.7 });
        }
      }
    }
  });
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: lights ? 9 : 0.8 };
}

export const BILLBOARDS: { x: number; y: number; w: number; h: number }[] = [];

/**
 * A city of blocks, built the way cyberpunk cities are painted:
 * - storeys are modules (a ledge and a band of windows), stacked to any height, with setbacks, an
 *   overhanging upper block, or a slanted crown, so the skyline is varied but believable;
 * - the light comes from the street, so each building is warm and dull at its foot, fading to cold
 *   indigo as it rises; the materials stay drab and the colour comes from windows and neon;
 * - clutter: AC units under windows, balconies, fire escapes, pipes down the walls, water tanks, dishes
 *   and aerials on the roofs, cables sagging from one building to the next;
 * - neon signs with weight: blade signs on brackets, boxes of glyphs, and shop signs, each spilling
 *   coloured light onto the wall around it (in the bloom layer).
 * With `lights`, draws only what glows, for the bloom layer added on top.
 */
export function cityArt(which: 'far' | 'mid', lights: boolean): Art {
  const key = `bd_n_${which}${lights ? '_glow' : ''}`;
  const far = which === 'far';
  const h = far ? 640 : 640;
  const p = plainPen(key);
  const seed = far ? 301 : 331;
  const tall = far ? 440 : 420;
  // Street-lit at the foot, cold at the top. Far buildings are hazier and flatter.
  const foot = far ? '#3A2452' : '#3A1E34';
  const crown = far ? '#1E1544' : '#0E0A24';
  const floor = far ? 22 : 30;
  if (!far && !lights) BILLBOARDS.length = 0;
  const roofs: Pt[] = [];
  let x = 0;
  let i = 0;
  while (x < TILE - 40) {
    const w = Math.min(TILE - 20 - x, (far ? 80 : 110) + rnd(seed, i) * (far ? 120 : 170));
    const storeys = Math.max(4, Math.round((tall * (0.35 + rnd(seed + 1, i) * 0.65)) / floor));
    const bh = storeys * floor;
    const top = h - bh;
    const kind = Math.floor(rnd(seed + 2, i) * 4);
    const shade = (y: number) => mix(foot, crown, Math.min(1, Math.max(0, (h - y) / tall)));
    // The body, in bands that cool as they rise.
    const body = (bx: number, by: number, bw: number, bb: number) => {
      if (lights) return;
      for (let y = bb; y > by; y -= floor * 2) {
        const y0 = Math.max(by, y - floor * 2);
        p.rect(bx, y0, bw, y - y0 + 1, { fill: shade(y0), stroke: null, r: 0 });
      }
    };
    body(x, top, w, h + 4);
    let roof = top;
    if (kind === 1) {
      // Setbacks: two narrower blocks on top.
      body(x + w * 0.15, top - floor * 3, w * 0.7, top);
      body(x + w * 0.3, top - floor * 5, w * 0.4, top - floor * 3);
      roof = top - floor * 5;
    } else if (kind === 2 && !far) {
      // An upper block overhanging to one side, its underside lit warm from the street.
      const side = rnd(seed + 3, i) < 0.5 ? -1 : 1;
      const ox = x + (side < 0 ? -26 : 0);
      body(ox, top - floor * 4, w + 26, top);
      if (!lights) p.rect(ox, top - 4, w + 26, 6, { fill: '#5A3046', stroke: null, r: 0 });
      roof = top - floor * 4;
    } else if (kind === 3) {
      // A slanted crown.
      if (!lights) p.shape([[x, top + 1], [x, top - floor * 2], [x + w, top - floor * 4], [x + w, top + 1]], { fill: shade(top - floor * 3), stroke: null, raw: true, wobble: 0 });
      roof = top - floor * 4;
    }
    roofs.push([x + w / 2, roof]);
    // Storeys: a ledge, and a band of windows of one kind for the whole building.
    const style = Math.floor(rnd(seed + 4, i) * 3);
    for (let s = 0, y = h - floor; y > top + 4; s++, y -= floor) {
      if (!lights) p.line([[x, y + floor - 2], [x + w, y + floor - 2]], { width: 2, color: mix(shade(y), '#000000', 0.35), raw: true, wobble: 0 });
      if (s === 0 && !far) continue; // the street level is the shop signs' and the dark's
      const lit = (k: number) => rnd(seed + 5 + s, i * 31 + k) < (far ? 0.18 : 0.32);
      const colour = (k: number) => {
        const r = rnd(seed + 9 + s, i * 17 + k);
        return r < 0.45 ? '#FFC67A' : r < 0.65 ? '#9FE8FF' : r < 0.8 ? '#FF9AE8' : '#E8E4FF';
      };
      if (style === 0) {
        // Ribbon windows: one long strip per floor, lit in stretches.
        for (let k = 0, wx = x + 8; wx < x + w - 12; k++, wx += 36) {
          const ww = Math.min(32, x + w - 10 - wx);
          if (lit(k)) p.rect(wx - (lights ? 3 : 0), y + 8 - (lights ? 3 : 0), ww + (lights ? 6 : 0), floor - 16 + (lights ? 6 : 0), { fill: colour(k), stroke: null, r: 1, opacity: lights ? 0.5 : 0.9 });
          else if (!lights) p.rect(wx, y + 8, ww, floor - 16, { fill: '#0A0818', stroke: null, r: 1, opacity: 0.7 });
        }
      } else {
        // Separate windows; with style 2, apartments: a balcony rail and an AC box under some.
        const step = far ? 14 : 22;
        for (let k = 0, wx = x + 8; wx < x + w - 14; k++, wx += step) {
          const ww = far ? 7 : 12;
          const wh = floor - (far ? 10 : 14);
          if (lit(k)) p.rect(wx - (lights ? 3 : 0), y + 6 - (lights ? 3 : 0), ww + (lights ? 6 : 0), wh + (lights ? 6 : 0), { fill: colour(k), stroke: null, r: 1, opacity: lights ? 0.5 : 0.9 });
          else if (!lights) p.rect(wx, y + 6, ww, wh, { fill: '#0A0818', stroke: null, r: 1, opacity: 0.6 });
          if (!lights && !far && style === 2 && k % 3 === 1 && rnd(seed + 12, i * 7 + k + s) < 0.5) {
            p.rect(wx - 2, y + floor - 10, 16, 8, { fill: '#2A2236', stroke: null, r: 1 });
            p.ellipse(wx + 6, y + floor - 6, 2.5, 2.5, { fill: '#14101E', stroke: null });
          }
        }
        if (!lights && !far && style === 2) p.line([[x + 4, y + floor - 4], [x + w - 4, y + floor - 4]], { width: 2, color: '#4A3A5E', raw: true, wobble: 0 });
      }
    }
    if (!lights && !far) {
      // A pipe down one side, and on some, a fire escape zigzagging up.
      const px = rnd(seed + 13, i) < 0.5 ? x + 4 : x + w - 6;
      p.line([[px, top + 10], [px, h]], { width: 3, color: '#2A2034', raw: true, wobble: 0 });
      if (rnd(seed + 14, i) < 0.35) {
        const fx = x + w * 0.62;
        const pts: Pt[] = [];
        for (let y = h - floor, k = 0; y > top + floor; y -= floor, k++) pts.push([fx + (k % 2 ? 30 : 0), y]);
        p.line(pts, { width: 2, color: '#3A2E4A', raw: true, wobble: 0 });
        for (const [, y] of pts) p.line([[fx - 4, y], [fx + 34, y]], { width: 2, color: '#3A2E4A', raw: true, wobble: 0 });
      }
    }
    // Rooftop clutter.
    if (!lights) {
      const rx = x + w * (0.2 + rnd(seed + 15, i) * 0.5);
      const kc = rnd(seed + 16, i);
      const c = shade(roof);
      if (kc < 0.3) {
        p.rect(rx - 18, roof - 40, 36, 28, { fill: c, stroke: null, r: 6 });
        for (const lx of [rx - 14, rx + 12]) p.line([[lx, roof - 12], [lx, roof]], { width: 3, color: c, raw: true, wobble: 0 });
      } else if (kc < 0.5) {
        p.ellipse(rx, roof - 16, 16, 8, { fill: c, stroke: null });
        p.line([[rx, roof - 10], [rx + 4, roof]], { width: 3, color: c, raw: true, wobble: 0 });
      } else if (kc < 0.75) {
        p.line([[rx, roof], [rx, roof - (far ? 60 : 90)]], { width: 3, color: c, raw: true, wobble: 0 });
        p.line([[rx - 10, roof - 50], [rx + 10, roof - 50]], { width: 2, color: c, raw: true, wobble: 0 });
      } else p.rect(rx - 24, roof - 14, 48, 14, { fill: c, stroke: null, r: 2 });
      if (!far && kind !== 3 && rnd(seed + 17, i) < 0.3 && w > 150 && bh > 220) BILLBOARDS.push({ x: x + 14, y: roof - 120, w: w - 28, h: 96 });
    }
    // Neon: a blade sign on brackets standing off the wall, and a shop sign over the street.
    if (!far && rnd(seed + 18, i) < 0.55) {
      const c = NEON[Math.floor(rnd(seed + 19, i) * NEON.length)];
      const sx = rnd(seed + 20, i) < 0.5 ? x + 10 : x + w - 40;
      const sy = top + 30 + rnd(seed + 21, i) * Math.max(10, bh - 300);
      const sh = 120 + rnd(seed + 22, i) * 100;
      if (lights) {
        p.rect(sx - 30, sy - 20, 90, sh + 40, { fill: c, stroke: null, r: 20, opacity: 0.25 });
        p.rect(sx - 4, sy - 4, 38, sh + 8, { fill: c, stroke: null, r: 6, opacity: 0.85 });
      } else {
        for (const by of [sy + 10, sy + sh - 14]) p.line([[sx + 15, by], [sx + (sx < x + w / 2 ? -8 : 38), by]], { width: 3, color: '#2A2034', raw: true, wobble: 0 });
        p.rect(sx, sy, 30, sh, { fill: '#0A0818', stroke: null, r: 5 });
        p.line([[sx + 3, sy + 3], [sx + 27, sy + 3], [sx + 27, sy + sh - 3], [sx + 3, sy + sh - 3], [sx + 3, sy + 3]], { width: 3, color: c, raw: true, wobble: 0 });
        for (let gy = sy + 14, k = 0; gy < sy + sh - 16; gy += 24, k++) {
          const g = Math.floor(rnd(seed + 23, i * 9 + k) * 3);
          if (g === 0) p.line([[sx + 8, gy], [sx + 22, gy], [sx + 22, gy + 10], [sx + 8, gy + 10]], { width: 3, color: c, raw: true, wobble: 0 });
          else if (g === 1) p.line([[sx + 15, gy - 2], [sx + 15, gy + 12], [sx + 8, gy + 6], [sx + 22, gy + 6]], { width: 3, color: c, raw: true, wobble: 0 });
          else p.ellipse(sx + 15, gy + 5, 6, 6, { fill: c, stroke: null });
        }
      }
    }
    if (!far && rnd(seed + 24, i) < 0.6) {
      const c = NEON[Math.floor(rnd(seed + 25, i) * NEON.length)];
      const sy = h - floor + 4;
      if (lights) {
        p.rect(x - 10, sy - 30, w + 20, 70, { fill: c, stroke: null, r: 20, opacity: 0.22 });
        p.rect(x + 8, sy - 4, w - 16, 20, { fill: c, stroke: null, r: 6, opacity: 0.8 });
      } else {
        p.rect(x + 10, sy, w - 20, 14, { fill: mix(c, '#0A0818', 0.25), stroke: null, r: 4 });
        // Shop windows at street level, warm.
        p.rect(x + 14, sy + 16, w * 0.5, floor - 18, { fill: '#5A3A30', stroke: null, r: 1 });
      }
    }
    x += w + (far ? 2 : 4) + rnd(seed + 5, i) * (far ? 10 : 16);
    i++;
  }
  // Cables sagging from one roof to the next, a few with lanterns strung on them.
  if (!far) {
    for (let k = 0; k < roofs.length - 1; k++) {
      if (rnd(seed + 26, k) < 0.4) continue;
      const [ax, ay] = roofs[k];
      const [bx, by] = roofs[k + 1];
      const y0 = Math.max(ay, by) + 40 + rnd(seed + 27, k) * 120;
      const sag = 30 + rnd(seed + 28, k) * 40;
      const pts: Pt[] = [];
      for (let t = 0; t <= 1.0001; t += 0.1) pts.push([ax + (bx - ax) * t, y0 + Math.sin(t * Math.PI) * sag]);
      if (!lights) p.line(pts, { width: 2, color: '#0A0818', raw: true, wobble: 0 });
      if (rnd(seed + 29, k) < 0.4) {
        for (const [lx, ly] of pts.slice(2, -2).filter((_, n) => n % 2 === 0)) {
          if (lights) p.ellipse(lx, ly + 8, 9, 9, { fill: '#FF6A5A', stroke: null, opacity: 0.8 });
          else p.ellipse(lx, ly + 8, 5, 6, { fill: '#FF6A5A', stroke: null });
        }
      }
    }
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: lights ? (far ? 8 : 6) : far ? 0.8 : 0 };
}

/** The elevated railway: a girder on pillars, with a line of lamps along its side. */
export function railArt(): Art {
  const key = 'bd_n_rail';
  const h = 520;
  const p = plainPen(key);
  const deck = 200;
  for (let x = 120; x < TILE; x += 400) {
    p.shape([[x - 22, h], [x - 16, deck + 40], [x + 16, deck + 40], [x + 22, h]], { fill: '#1A1432', stroke: null, raw: true, wobble: 0 });
    p.shape([[x - 60, deck + 40], [x + 60, deck + 40], [x + 20, deck + 80], [x - 20, deck + 80]], { fill: '#1A1432', stroke: null, raw: true, wobble: 0 });
  }
  p.rect(0, deck, TILE, 44, { fill: '#221A40', stroke: null, r: 0 });
  p.rect(0, deck - 10, TILE, 10, { fill: '#2E2452', stroke: null, r: 0 });
  for (let x = 0; x < TILE; x += 40) p.line([[x, deck + 4], [x + 20, deck + 40]], { width: 2, color: '#16102C', raw: true, wobble: 0 });
  for (let x = 30; x < TILE; x += 120) p.rect(x, deck + 18, 10, 6, { fill: '#FF6AD8', stroke: null, r: 2 });
  return { key, svg: p.svg(TILE, h), w: TILE, h };
}

/** The deck's height in the rail picture (the train runs on it). */
export const RAIL_DECK = 200;

/** A commuter train: dark carriages with a lit window strip and a magenta stripe. */
export function trainArt(): Art {
  const key = 'bd_n_train';
  const w = 1500;
  const h = 90;
  const p = plainPen(key);
  for (let c = 0; c < 4; c++) {
    const x = c * 375;
    p.rect(x + 4, 6, 366, 78, { fill: '#2A2448', stroke: null, r: c === 0 ? 30 : 8 });
    p.rect(x + 20, 22, 330, 24, { fill: '#BFF4FF', stroke: null, r: 4 });
    for (let k = 0; k < 9; k++) p.rect(x + 54 + k * 34, 22, 4, 24, { fill: '#2A2448', stroke: null, r: 0 });
    p.rect(x + 8, 58, 358, 6, { fill: '#FF3FD0', stroke: null, r: 2 });
  }
  return { key, svg: p.svg(w, h), w, h };
}

// ===================================================================================== Frostpeak Pass

/**
 * Jagged peaks under the moon (which is to the right): each mountain split by its ridge into a lit face,
 * pale lavender-white, and a face in deep blue shadow, with rock where the snow cannot hold. `far` makes a
 * paler, hazier range.
 */
export function frostPeaksArt(far: boolean): Art {
  const key = far ? 'bd_s_peaks_far' : 'bd_s_peaks';
  const h = 760;
  const p = plainPen(key);
  const seed = far ? 401 : 431;
  const lit = far ? '#B8C4E6' : '#E8EEFA';
  const shade = far ? '#7A7AB8' : '#4E4C90';
  const rock = far ? '#5E6AA0' : '#2E3A6A';
  const mts: [number, number, number][] = [];
  for (let i = 0, x = 0; x < TILE; i++) {
    const w = (far ? 380 : 460) + rnd(seed, i) * 380;
    const ht = (far ? 300 : 360) + rnd(seed + 1, i) * (far ? 260 : 340);
    mts.push([x + w / 2, w, ht]);
    x += w * (0.45 + rnd(seed + 2, i) * 0.25);
  }
  // Lower peaks first, so the tall ones stand in front of nothing and behind nothing awkwardly.
  mts.sort((a, b) => a[2] - b[2]).reverse();
  for (const [cx0, w, ht] of mts) {
    for (const shift of [-TILE, 0, TILE]) {
      const cx = cx0 + shift;
      if (cx + w / 2 < 0 || cx - w / 2 > TILE) continue;
      const base = h;
      const sx = cx + (rnd(seed + 3, cx0) - 0.5) * w * 0.2;
      const sy = base - ht;
      // The outline: jagged shoulders down each side.
      const left: Pt[] = [];
      const right: Pt[] = [];
      for (let k = 1; k <= 5; k++) {
        const t = k / 6;
        const jag = (rnd(seed + 4, cx0 + k) - 0.5) * 40;
        left.push([sx - (sx - (cx - w / 2)) * t + jag * 0.5, sy + ht * t + (k % 2 ? -18 : 12)]);
        right.push([sx + (cx + w / 2 - sx) * t + jag * 0.5, sy + ht * t + (k % 2 ? 14 : -16)]);
      }
      const outline: Pt[] = [[cx - w / 2, base], ...left.reverse(), [sx, sy], ...right, [cx + w / 2, base]];
      p.shape(outline, { fill: shade, stroke: null, raw: true, wobble: 0.2 });
      // The lit face: from the summit, the ridge comes down and to the right; everything right of it faces
      // the moon.
      const ridge: Pt[] = [[sx, sy]];
      for (let k = 1; k <= 4; k++) ridge.push([sx + w * 0.06 * k + (rnd(seed + 5, cx0 + k) - 0.5) * 30, sy + ht * 0.22 * k]);
      p.shape([...ridge, [cx + w / 2, base], ...right.slice().reverse()], { fill: lit, stroke: null, raw: true, wobble: 0.2 });
      // Gullies on the lit face, and rock on the shadow face low down.
      for (let k = 0; k < 4; k++) {
        const gx = sx + w * (0.1 + k * 0.08);
        const gy = sy + ht * (0.25 + k * 0.1);
        p.shape([[gx, gy], [gx + 14, gy + ht * 0.25], [gx + 4, gy + ht * 0.28]], { fill: mix(lit, shade, 0.45), stroke: null, raw: true, wobble: 0.3 });
      }
      for (let k = 0; k < 3; k++) {
        const rx = cx - w * (0.12 + k * 0.1);
        const ry = sy + ht * (0.45 + k * 0.12);
        p.shape([[rx, ry], [rx + 26, ry + 40], [rx - 10, ry + 70]], { fill: rock, stroke: null, raw: true, wobble: 0.3, opacity: 0.8 });
      }
    }
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: far ? 1.4 : 0.3 };
}

/**
 * A pine weighed down with snow, as painters draw them: tiers of boughs that droop at their tips under the
 * load, each carrying a rounded pillow of snow. The moon is to the right, so the snow's right side is lit
 * and its left side falls into blue-violet shadow (never grey). The lowest tier is widest.
 */
export function snowyPine(p: ReturnType<typeof plainPen>, x: number, y: number, th: number, tree: string, lit: string, shade: string, detail: boolean) {
  const tiers = detail ? 5 : 4;
  for (let k = 0; k < tiers; k++) {
    const ty = y - th + (k * th * 0.82) / tiers;
    const tH = (th * 0.34) * (detail ? 1 : 1.1);
    const hw = th * (0.09 + (k * 0.26) / tiers);
    // The bough: out to a drooping tip each side, with a ragged underside.
    const bough: Pt[] = [
      [x, ty],
      [x + hw * 0.5, ty + tH * 0.5],
      [x + hw * 1.04, ty + tH * 1.02],
      [x + hw * 0.74, ty + tH * 0.9],
      [x + hw * 0.46, ty + tH * 1.0],
      [x + hw * 0.18, ty + tH * 0.9],
      [x - hw * 0.18, ty + tH * 0.92],
      [x - hw * 0.46, ty + tH * 1.0],
      [x - hw * 0.74, ty + tH * 0.9],
      [x - hw * 1.04, ty + tH * 1.02],
      [x - hw * 0.5, ty + tH * 0.5],
    ];
    p.shape(bough, { fill: tree, stroke: null, raw: true, wobble: 0.3 });
    // The snow on it: a soft pillow on the upper side, in shadow on the left and moonlit on the right.
    const pillow: Pt[] = [
      [x, ty - 3],
      [x + hw * 0.45, ty + tH * 0.4],
      [x + hw * 0.92, ty + tH * 0.86],
      [x + hw * 0.62, ty + tH * 0.72],
      [x + hw * 0.3, ty + tH * 0.66],
      [x, ty + tH * 0.6],
      [x - hw * 0.3, ty + tH * 0.66],
      [x - hw * 0.62, ty + tH * 0.72],
      [x - hw * 0.92, ty + tH * 0.86],
      [x - hw * 0.45, ty + tH * 0.4],
    ];
    p.shape(pillow, { fill: shade, stroke: null, wobble: 0.4 });
    p.shape(
      [
        [x + 1, ty - 2],
        [x + hw * 0.45, ty + tH * 0.4],
        [x + hw * 0.9, ty + tH * 0.84],
        [x + hw * 0.6, ty + tH * 0.68],
        [x + hw * 0.28, ty + tH * 0.6],
        [x + 2, ty + tH * 0.5],
      ],
      { fill: lit, stroke: null, wobble: 0.4 },
    );
  }
}

/**
 * A pine forest on rolling snow. Far away it is one silhouette of tiered pines with only a hint of snow;
 * near, every tree is drawn with its drooping, snow-laden tiers, some poking well above the rest, over a
 * dark mass of trunks and shadow, with snow drifted at their feet.
 */
export function frostForestArt(key: string, h: number, colour: string, rim: string, seed: number, size: number, snow: string): Art {
  const p = plainPen(key);
  const near = size >= 1;
  const hill = wave(seed, [60, 26, 12]);
  const at = (x: number) => h - 200 - hill(x);
  // The trees, back row first.
  const trees: [number, number][] = [];
  for (let i = 0, x = 0; x < TILE; i++) {
    const tall = rnd(seed + 1, i) < 0.12 ? 1.6 : 0.65 + rnd(seed + 2, i) * 0.6;
    trees.push([x, 80 * size * tall]);
    x += (near ? 22 : 16) * size + rnd(seed + 3, i) * 18 * size;
  }
  // The dark under the canopy, so the trees read as one wood.
  const under: Pt[] = [];
  for (let x = 0; x <= TILE; x += 16) under.push([x, at(x) - 30 * size]);
  p.shape([...under, [TILE, h], [0, h]], { fill: colour, stroke: null, raw: true, wobble: 0.2 });
  const lit = near ? '#EEF2FC' : mix('#EEF2FC', '#8E9ACC', 0.45);
  const shade = near ? '#8E94D0' : mix('#8E94D0', colour, 0.4);
  for (const [x, th] of trees) {
    for (const shift of [0, x < 80 ? TILE : x > TILE - 80 ? -TILE : 0].filter((v, n) => n === 0 || v !== 0)) {
      snowyPine(p, x + shift, at(x) + 6, th, colour, lit, shade, near);
    }
  }
  // Moonlit rims on the tallest.
  for (const [x, th] of trees.filter(([, th]) => th > 90 * size)) p.line([[x + 2, at(x) - th + 6], [x + th * 0.2, at(x) - th * 0.3]], { width: 1.6, color: rim, raw: true, opacity: 0.7, wobble: 0 });
  // Snow drifted along the forest's edge, with a lit crest.
  const edge: Pt[] = [];
  for (let x = 0; x <= TILE; x += 16) edge.push([x, at(x) + 4 + Math.sin(x / 70) * 6]);
  p.shape([...edge, [TILE, h], [0, h]], { fill: snow, stroke: null, raw: true, wobble: 0.3 });
  p.line(edge, { width: 2.5, color: '#FFFFFF', raw: true, opacity: 0.8, wobble: 0 });
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: near ? 0.2 : 0.9 };
}

/**
 * Snowdrifts and the frozen lake on the valley floor: the ice dark, reflecting the night sky, with long
 * pale streaks; drifts in front with blue shadows and moonlit crests; and a few cabins with warm windows.
 */
export const LAKE_CABINS = [420, 1300, 2050];
export function frostLakeArt(): Art {
  const key = 'bd_s_lake';
  const h = 380;
  const p = plainPen(key);
  // Far shore snow.
  p.shape([[0, 118], [TILE, 118], [TILE, 200], [0, 200]], { fill: '#C6D2EE', stroke: null, raw: true, wobble: 0.3 });
  // The ice, dark near its far edge where it reflects the night, paler towards us.
  p.shape([[0, 168], [TILE, 168], [TILE, 294], [0, 294]], { fill: '#2E4678', stroke: null, raw: true, wobble: 0.3 });
  p.shape([[0, 218], [TILE, 218], [TILE, 294], [0, 294]], { fill: '#4A6496', stroke: null, raw: true, wobble: 0.3, opacity: 0.8 });
  for (let i = 0; i < 46; i++) {
    const x = rnd(91, i) * TILE;
    const y = 186 + rnd(93, i) * 96;
    p.line([[x, y], [x + 40 + rnd(95, i) * 140, y + 1]], { width: 2, color: '#9AB0E0', raw: true, opacity: 0.6, wobble: 0 });
  }
  // Cabins on the far shore, lit.
  for (const cx of LAKE_CABINS) {
    p.rect(cx - 34, 92, 68, 40, { fill: '#3A2E3E', stroke: null, r: 2 });
    p.shape([[cx - 44, 96], [cx, 62], [cx + 44, 96]], { fill: '#F4F8FF', stroke: null, raw: true });
    p.rect(cx - 20, 104, 14, 12, { fill: '#FFD27A', stroke: null, r: 1 });
    p.rect(cx + 6, 104, 14, 12, { fill: '#FFC05A', stroke: null, r: 1 });
    // Their light, reflected in the ice.
    p.line([[cx - 13, 178], [cx - 13, 230]], { width: 6, color: '#FFC05A', raw: true, opacity: 0.35, wobble: 0.3 });
    p.line([[cx + 13, 178], [cx + 13, 226]], { width: 6, color: '#FFC05A', raw: true, opacity: 0.3, wobble: 0.3 });
  }
  // Drifts in front: rolling, a blue shadow on the side away from the moon, a lit crest.
  const drift = wave(97, [26, 14, 8]);
  const dTop = (x: number) => 300 - drift(x);
  const pts: Pt[] = [];
  for (let x = 0; x <= TILE; x += 12) pts.push([x, dTop(x)]);
  p.shape([...pts, [TILE, h], [0, h]], { fill: '#DDE6F6', stroke: null, raw: true, wobble: 0.2 });
  for (let x = 0; x < TILE; x += 12) {
    const a = dTop(x);
    const b = dTop(x + 12);
    if (b > a) p.shape([[x, a], [x + 12, b], [x + 12, b + 40], [x, a + 40]], { fill: '#8E8CC8', stroke: null, raw: true, wobble: 0, opacity: 0.6 });
  }
  p.line(pts, { width: 3, color: '#FFFFFF', raw: true, opacity: 0.9, wobble: 0 });
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 0.3 };
}

/**
 * Neon Town's near strip, in place of grass: a wet kerb and gutter close to the camera, with puddles
 * holding long, wavering reflections of the neon.
 */
export function wetStreetArt(): Art {
  const key = 'town_wet';
  const w = 1200;
  const h = 190;
  const p = plainPen(key);
  p.rect(-10, h - 70, w + 20, 90, { fill: '#0C0818', stroke: null, r: 0 });
  p.rect(-10, h - 78, w + 20, 10, { fill: '#2A2448', stroke: null, r: 0 });
  p.line([[-10, h - 78], [w + 10, h - 78]], { width: 2, color: '#6A5AA0', raw: true, wobble: 0 });
  for (let i = 0; i < 7; i++) {
    const cx = 80 + i * 170 + rnd(501, i) * 60;
    const rw = 50 + rnd(503, i) * 50;
    p.ellipse(cx, h - 34, rw, 14, { fill: '#18122E', stroke: null, wobble: 0.6 });
    for (let k = 0; k < 4; k++) {
      const c = NEON[Math.floor(rnd(505 + k, i) * NEON.length)];
      const sx = cx - rw * 0.6 + k * rw * 0.4;
      p.line([[sx, h - 44], [sx + 2, h - 24]], { width: 5, color: c, raw: true, opacity: 0.55, wobble: 0.6 });
    }
  }
  // A drain grate or two.
  for (const gx of [300, 900]) for (let k = 0; k < 5; k++) p.line([[gx + k * 8, h - 64], [gx + k * 8, h - 52]], { width: 3, color: '#3A3458', raw: true, wobble: 0 });
  return { key, svg: p.svg(w, h), w, h };
}

/** The roadside pine on the pass: big, inked like the near world, its tiers bowed under pillows of snow. */
export function roadsidePineArt(): Art {
  const key = 'snowpine';
  const w = 300;
  const h = 460;
  const p = pen(key);
  p.rect(w / 2 - 12, h - 70, 24, 70, { fill: '#4A3438', width: 3.5, r: 3 });
  snowyPine(p, w / 2, h - 50, 400, '#1E3450', '#F4F8FF', '#9EA2DA', true);
  return { key, svg: p.svg(w, h), w, h };
}

/** Frostpeak's near strip, in place of grass: pillowy drifts close to the camera, blue in the hollows, sparkling. */
export function snowNearArt(): Art {
  const key = 'snow_near';
  const w = 1200;
  const h = 190;
  const p = plainPen(key);
  const top = (x: number) => h - 70 - Math.sin((x / w) * Math.PI * 6) * 14 - Math.sin((x / w) * Math.PI * 14 + 1) * 6;
  const pts: Pt[] = [];
  for (let x = 0; x <= w; x += 10) pts.push([x, top(x)]);
  p.shape([...pts, [w, h], [0, h]], { fill: '#C6CCEE', stroke: null, raw: true, wobble: 0 });
  p.shape([...pts.map(([x, y]): Pt => [x, y + 4]), [w, h], [0, h]], { fill: '#E6ECFA', stroke: null, raw: true, wobble: 0, opacity: 0.9 });
  for (let x = 0; x < w; x += 10) {
    const a = top(x);
    const b = top(x + 10);
    if (b > a) p.shape([[x, a + 4], [x + 10, b + 4], [x + 10, b + 50], [x, a + 50]], { fill: '#9E9CD6', stroke: null, raw: true, wobble: 0, opacity: 0.45 });
  }
  p.line(pts, { width: 3, color: '#FFFFFF', raw: true, wobble: 0 });
  for (let i = 0; i < 70; i++) p.ellipse(rnd(601, i) * w, top(rnd(601, i) * w) + 8 + rnd(603, i) * 60, 1.6, 1.6, { fill: '#FFFFFF', stroke: null });
  return { key, svg: p.svg(w, h), w, h };
}
