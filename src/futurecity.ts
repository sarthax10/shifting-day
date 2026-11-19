import type { Art } from './art';
import type { Pt } from './ink';
import { TILE, plainPen, rnd } from './backdrop';

/**
 * Neon Town's skyline, built for the future, after the city prints people pin: a synthwave sun striped low
 * behind a skyline of spires, and towers no box ever looked like -
 *
 *   needle    a slim shaft carrying a flying-saucer deck ringed with lights, a spire above
 *   twins     two slabs joined by glass sky-bridges
 *   arcology  a stepped pyramid of terraces, each edge lit
 *   dome      a glass dome on a podium, ribbed, a mast on top
 *   rocket    a tapered spire on three fins, a neon line up its spine
 *   pods      a core shaft with pods cantilevered left and right, a window glowing in each
 *
 * With `lights`, draws only what glows (for the bloom layer added on top). Beacon points for the blinking
 * red lights are collected into `beacons`.
 */

const NEON = ['#FF6A6A', '#5ED6C2', '#FFB23F', '#FF8AA0', '#F3E3CC'];
const BODY = '#2C2A5E';
const BODY_DARK = '#201E48';
const WIN = ['#FFC86B', '#F3E3CC', '#5ED6C2', '#FF8AA0'];

export function futureSkylineArt(lights: boolean, beacons: Pt[]): Art {
  const key = lights ? 'bd_n_mega_glow' : 'bd_n_mega';
  const h = 1100;
  const p = plainPen(key);
  if (!lights) beacons.length = 0;
  const fill = (pts: Pt[], c = BODY) => {
    if (!lights) p.shape(pts, { fill: c, stroke: null, raw: true, wobble: 0 });
  };
  const box = (x: number, y: number, w: number, hh: number, c = BODY, r = 0) => {
    if (!lights) p.rect(x, y, w, hh, { fill: c, stroke: null, r });
  };
  const glowLine = (pts: Pt[], c: string, w = 3) => p.line(pts, { width: lights ? w + 4 : w, color: c, raw: true, opacity: lights ? 0.9 : 0.85, wobble: 0 });
  const dot = (x: number, y: number, r: number, c: string) => p.ellipse(x, y, lights ? r + 2 : r, lights ? r + 2 : r, { fill: c, stroke: null, opacity: lights ? 0.8 : 1 });
  const windows = (x: number, y0: number, w: number, y1: number, seed: number, chance = 0.14) => {
    for (let y = y0; y < y1; y += 24) {
      for (let wx = x + 10; wx < x + w - 12; wx += 15) {
        if (rnd(seed, wx * 7 + y) < chance) {
          if (lights) p.rect(wx - 2, y - 2, 11, 14, { fill: WIN[Math.floor(rnd(seed + 1, wx + y) * WIN.length)], stroke: null, r: 1, opacity: 0.45 });
          else p.rect(wx, y, 7, 10, { fill: WIN[Math.floor(rnd(seed + 1, wx + y) * WIN.length)], stroke: null, r: 1, opacity: 0.8 });
        }
      }
    }
  };
  const beacon = (x: number, y: number) => {
    if (!lights) beacons.push([x, y]);
  };

  const kinds = ['needle', 'twins', 'arcology', 'rocket', 'dome', 'pods'] as const;
  let x = 60;
  for (let i = 0; x < TILE - 260; i++) {
    const kind = kinds[i % kinds.length];
    const c = NEON[i % NEON.length];
    const th = 560 + rnd(401, i) * 420;
    if (kind === 'needle') {
      const w = 46;
      const top = h - th;
      box(x, top, w, th);
      windows(x - 4, top + 160, w + 8, h - 40, 411 + i, 0.18);
      // The saucer deck: a wide disc with a dome on top, its rim ringed with lights.
      const sy = top + 40;
      if (!lights) {
        p.ellipse(x + w / 2, sy, w * 2.4, 22, { fill: BODY_DARK, stroke: null });
        p.ellipse(x + w / 2, sy - 18, w * 1.2, 26, { fill: BODY, stroke: null });
      }
      for (let k = -5; k <= 5; k++) dot(x + w / 2 + k * w * 0.42, sy + 4, 3, k % 2 ? c : '#FFC86B');
      glowLine([[x + w / 2 - w * 2.3, sy + 6], [x + w / 2 + w * 2.3, sy + 6]], c, 2);
      glowLine([[x + w / 2, sy - 40], [x + w / 2, sy - 220]], c, 3);
      beacon(x + w / 2, sy - 224);
      x += w * 5 + 120 + rnd(403, i) * 160;
    } else if (kind === 'twins') {
      const w = 80;
      const gap = 70;
      const t1 = h - th;
      const t2 = h - th * 0.84;
      box(x, t1, w, th);
      box(x + w + gap, t2, w, th * 0.84);
      fill([[x, t1], [x + w / 2, t1 - 60], [x + w, t1]]);
      fill([[x + w + gap, t2], [x + w * 1.5 + gap, t2 - 50], [x + w * 2 + gap, t2]]);
      windows(x, t1 + 40, w, h - 40, 421 + i);
      windows(x + w + gap, t2 + 40, w, h - 40, 423 + i);
      // Sky-bridges, glass tubes with lights along them.
      for (const by of [t2 + 70, t2 + 240, t2 + 420]) {
        box(x + w - 4, by, gap + 8, 22, BODY_DARK, 10);
        for (let bx = x + w + 6; bx < x + w + gap - 4; bx += 12) dot(bx, by + 11, 2.4, '#FFC86B');
      }
      glowLine([[x + 4, h], [x + 4, t1 + 10]], c);
      glowLine([[x + w * 2 + gap - 4, h], [x + w * 2 + gap - 4, t2 + 10]], c);
      beacon(x + w / 2, t1 - 64);
      beacon(x + w * 1.5 + gap, t2 - 54);
      x += w * 2 + gap + 140 + rnd(405, i) * 160;
    } else if (kind === 'arcology') {
      const W = 280;
      const tiers = 6;
      const tierH = (th * 0.75) / tiers;
      for (let t = 0; t < tiers; t++) {
        const tw = W * (1 - t / (tiers + 0.6));
        const tx = x + (W - tw) / 2;
        const ty = h - (t + 1) * tierH;
        box(tx, ty, tw, tierH + 2);
        windows(tx, ty + 10, tw, ty + tierH - 6, 431 + i * 9 + t, 0.22);
        glowLine([[tx, ty + 1], [tx + tw, ty + 1]], t % 2 ? c : '#FFC86B', 2);
      }
      const apex = h - tiers * tierH;
      glowLine([[x + W / 2, apex], [x + W / 2, apex - 140]], c, 3);
      beacon(x + W / 2, apex - 144);
      x += W + 120 + rnd(407, i) * 160;
    } else if (kind === 'rocket') {
      const w = 90;
      const top = h - th;
      fill([[x, h], [x + 6, top + 220], [x + w / 2, top], [x + w - 6, top + 220], [x + w, h]]);
      fill([[x - 40, h], [x, h - 200], [x + 10, h]], BODY_DARK);
      fill([[x + w + 40, h], [x + w, h - 200], [x + w - 10, h]], BODY_DARK);
      windows(x + 10, top + 260, w - 20, h - 40, 441 + i, 0.16);
      glowLine([[x + w / 2, h - 20], [x + w / 2, top + 30]], c, 3);
      for (let k = 1; k < 5; k++) glowLine([[x + 14, top + 200 + k * 120], [x + w - 14, top + 200 + k * 120]], '#FFC86B', 2);
      beacon(x + w / 2, top - 4);
      x += w + 180 + rnd(409, i) * 160;
    } else if (kind === 'dome') {
      const W = 260;
      const podium = 260;
      const R = 120;
      box(x, h - podium, W, podium);
      windows(x, h - podium + 20, W, h - 30, 451 + i, 0.2);
      const cx = x + W / 2;
      const cy = h - podium;
      const domePts: Pt[] = [];
      for (let k = 0; k <= 20; k++) {
        const a = Math.PI + (k / 20) * Math.PI;
        domePts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
      }
      fill(domePts, BODY_DARK);
      for (let k = 1; k < 6; k++) {
        const a = Math.PI + (k / 6) * Math.PI;
        glowLine([[cx, cy - R], [cx + Math.cos(a) * R, cy + Math.sin(a) * R]], c, 1.6);
      }
      glowLine([[cx - R, cy], [cx + R, cy]], '#FFC86B', 2.4);
      glowLine([[cx, cy - R], [cx, cy - R - 120]], c, 3);
      beacon(cx, cy - R - 124);
      x += W + 140 + rnd(411, i) * 160;
    } else {
      // A core shaft with pods stepping out either side.
      const w = 50;
      const top = h - th;
      box(x, top, w, th);
      glowLine([[x + w / 2, top], [x + w / 2, top - 120]], c, 3);
      beacon(x + w / 2, top - 124);
      for (let k = 0, y = top + 30; y < h - 120; k++, y += 70) {
        const side = k % 2 ? 1 : -1;
        const px = side > 0 ? x + w - 6 : x - 70 + 6;
        box(px, y, 70, 46, BODY, 10);
        if (lights) p.rect(px + 18, y + 12, 34, 20, { fill: k % 3 ? '#FFC86B' : c, stroke: null, r: 6, opacity: 0.5 });
        else p.rect(px + 20, y + 14, 30, 16, { fill: k % 3 ? '#FFC86B' : c, stroke: null, r: 6 });
      }
      x += w + 230 + rnd(413, i) * 160;
    }
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: lights ? 9 : 0.8 };
}

/** The synthwave sun: a big coral-to-gold disc cut by bands that widen toward its foot, breaking into halftone at its rim. */
export function synthSunArt(): Art {
  const s = 560;
  const c = s / 2;
  const r = c - 10;
  let bands = '';
  for (let k = 0; k < 7; k++) {
    const y = c + 30 + k * 32 + k * k * 1.5;
    const hh = 3 + k * 2.4;
    bands += `<rect x="0" y="${y.toFixed(1)}" width="${s}" height="${hh.toFixed(1)}" fill="black"/>`;
  }
  let dots = '';
  const step = 14;
  for (let y = 0; y < c + 20; y += step) {
    for (let x = (y / step) % 2 ? step / 2 : 0; x < s; x += step) {
      const d = Math.hypot(x - c, y - c) / r;
      if (d < 0.88 || d > 1.06) continue;
      const k = 1 - (d - 0.88) / 0.18;
      dots += `<circle cx="${x}" cy="${y}" r="${(step * 0.48 * Math.sqrt(Math.max(0, k))).toFixed(2)}" fill="#FFB86A"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><defs><linearGradient id="ss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD27A"/><stop offset="0.5" stop-color="#FF8A6A"/><stop offset="1" stop-color="#E3566A"/></linearGradient><mask id="sm"><rect width="${s}" height="${s}" fill="white"/>${bands}</mask></defs><g mask="url(#sm)"><circle cx="${c}" cy="${c}" r="${r * 0.9}" fill="url(#ss)"/>${dots}</g></svg>`;
  return { key: 'bd_n_sun', svg, w: s, h: s };
}

/** An airship, drifting over the city: a long hull, fins, a gondola, and an ad screen on its flank. */
export function blimpArt(): Art {
  const key = 'bd_n_blimp';
  const w = 520;
  const h = 200;
  const p = plainPen(key);
  p.ellipse(250, 90, 220, 66, { fill: '#3A3A72', stroke: null });
  p.ellipse(240, 74, 190, 34, { fill: '#4A4A86', stroke: null, opacity: 0.8 });
  for (const [a, b] of [[[430, 90], [500, 40]], [[430, 90], [500, 140]]] as const) p.shape([[a[0], a[1] - 14], [b[0], b[1]], [b[0] + 10, b[1]], [a[0] + 20, a[1]]], { fill: '#2C2A5E', stroke: null, raw: true });
  p.rect(200, 150, 90, 26, { fill: '#2C2A5E', stroke: null, r: 10 });
  for (let k = 0; k < 4; k++) p.rect(210 + k * 20, 158, 12, 8, { fill: '#FFC86B', stroke: null, r: 2 });
  // The ad screen, framed; its words are lit in the game.
  p.rect(110, 56, 260, 68, { fill: '#0B0E24', stroke: null, r: 10 });
  p.rect(116, 62, 248, 56, { stroke: '#5ED6C2', width: 3, r: 8 });
  return { key, svg: p.svg(w, h), w, h };
}

/** A hover-car: a sleek pod with a canopy, a lamp at its nose and a glow under it. */
export function hoverCarArt(): Art {
  const key = 'bd_n_car';
  const p = plainPen(key);
  p.shape([[4, 22], [16, 10], [54, 6], [80, 14], [86, 22], [70, 28], [14, 28]], { fill: '#1E2242', stroke: null, raw: true });
  p.shape([[26, 12], [36, 2], [56, 2], [64, 12]], { fill: '#5ED6C2', stroke: null, raw: true, opacity: 0.85 });
  p.rect(10, 26, 66, 3, { fill: '#FF8AA0', stroke: null, r: 1 });
  return { key, svg: p.svg(90, 32), w: 90, h: 32 };
}
