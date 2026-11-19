import { pen, type Art } from './art';
import type { Pt } from './ink';

/**
 * Trees, drawn the way the references paint them rather than as stacks of circles:
 * a crown is several scalloped clumps arranged unevenly; each clump has three values (a lit rim on
 * the sun side, a mid body, and a shaded core away from the sun); branches fork up through the gaps;
 * a rim light catches the sunny edge; loose leaf dabs break the outline.
 */

export interface Palette {
  shadow: string;
  mid: string;
  light: string;
  rim: string;
}

export const P: Record<string, Palette> = {
  // Old Street's trees, in the poster's inks: bottle-green shade, olive body, the low sun's gold on the rim.
  oak: { shadow: '#1A2E24', mid: '#2A4636', light: '#7E8A44', rim: '#FFB23F' },
  oakDeep: { shadow: '#140F18', mid: '#24402E', light: '#5E7038', rim: '#FF6A30' },
  red: { shadow: '#7A2A2E', mid: '#D8563A', light: '#F29A4A', rim: '#FFD27A' },
  gold: { shadow: '#A86A24', mid: '#F2B23A', light: '#FFE07A', rim: '#FFF2B0' },
  rust: { shadow: '#6A3A2A', mid: '#C9702E', light: '#EE9A4A', rim: '#FFD8A0' },
  pine: { shadow: '#140F18', mid: '#1A2E24', light: '#2A4636', rim: '#FF6A30' },
  snow: { shadow: '#120E22', mid: '#1A2E24', light: '#2A4636', rim: '#F3E3CC' },
  sea: { shadow: '#1F4A3E', mid: '#3E7A5E', light: '#6AA878', rim: '#E8F4C8' },
};
const BARK = '#3A1A26';
const BARK_LIGHT = '#7A4A4A';

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A clump outline: an ellipse whose edge is broken into leafy bumps of uneven size. */
function scallop(cx: number, cy: number, rx: number, ry: number, bumps: number, r: () => number): Pt[] {
  const phase = r() * Math.PI;
  const amps = Array.from({ length: bumps }, () => 0.7 + r() * 0.6);
  const pts: Pt[] = [];
  const n = 72;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const k = Math.floor((t / (Math.PI * 2)) * bumps);
    const wave = Math.pow(Math.abs(Math.sin((bumps * t) / 2 + phase)), 0.6);
    const s = 0.84 + 0.16 * wave * amps[k];
    pts.push([cx + Math.cos(t) * rx * s, cy + Math.sin(t) * ry * s]);
  }
  return pts;
}

const move = (pts: Pt[], dx: number, dy: number, k = 1): Pt[] => {
  const cx = pts.reduce((n, p) => n + p[0], 0) / pts.length;
  const cy = pts.reduce((n, p) => n + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [cx + (x - cx) * k + dx, cy + (y - cy) * k + dy] as Pt);
};

type Pen = ReturnType<typeof pen>;

/** One clump in three values, with a rim of light on the sun side (the sun is up and to the left). */
export function clump(p: Pen, cx: number, cy: number, rx: number, ry: number, pal: Palette, r: () => number, dark = 0) {
  const pts = scallop(cx, cy, rx, ry, 8 + Math.floor(r() * 5), r);
  const light = dark > 0.5 ? pal.mid : pal.light;
  p.shape(pts, {
    fill: light,
    raw: true,
    width: 3.2,
    wobble: 0.4,
    shade: [
      { pts: move(pts, rx * 0.14, ry * 0.2), color: pal.mid },
      { pts: move(pts, rx * 0.42, ry * 0.6, 0.8), color: pal.shadow },
    ],
  });
  // Rim light along the upper-left arc.
  const arc = pts.filter(([x, y]) => x < cx - rx * 0.1 && y < cy - ry * 0.05);
  if (arc.length > 3) p.line(arc, { width: 2.6, color: pal.rim, raw: true, opacity: 0.75, wobble: 0.2 });
  // A few leaf dabs breaking the edge.
  for (let i = 0; i < 4; i++) {
    const t = r() * Math.PI * 2;
    const x = cx + Math.cos(t) * rx * 0.98;
    const y = cy + Math.sin(t) * ry * 0.98;
    p.shape(scallop(x, y, 7 + r() * 5, 6 + r() * 4, 5, r), { fill: Math.sin(t) < 0 ? pal.light : pal.mid, raw: true, width: 2, wobble: 0.3 });
  }
}

// ================================================================ crowns, printed

/** A lobe of a crown: a circle (or, with an aspect, an ellipse squashed in y) at x, y of radius r. */
type Lobe = [number, number, number];

/**
 * The outline of a crown: the union of its lobes, traced from a point inside them. For each direction from
 * the middle, the farthest edge of any lobe; so overlapping lobes become one leafy silhouette, as a
 * printmaker would cut it, instead of a pile of separate balls.
 */
function union(lobes: Lobe[], cx: number, cy: number, aspect = 1, n = 220): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let best = 0;
    for (const [lx, ly, lr] of lobes) {
      // Work in a space squashed by the aspect, where the lobes are circles.
      const ox = cx - lx;
      const oy = (cy - ly) / aspect;
      const ddy = dy / aspect;
      const len = Math.hypot(dx, ddy);
      const ux = dx / len;
      const uy = ddy / len;
      const b = ox * ux + oy * uy;
      const c = ox * ox + oy * oy - lr * lr;
      const disc = b * b - c;
      if (disc < 0) continue;
      const t = (-b + Math.sqrt(disc)) / len;
      if (t > best) best = t;
    }
    out.push([cx + dx * best, cy + dy * best]);
  }
  return out;
}

/** Leafy edging: small lobes set round the rim of each big one, so the silhouette breaks into leaf clusters. */
function leafy(lobes: Lobe[], r: () => number, k = 0.34, every = 0.5): Lobe[] {
  const out: Lobe[] = [...lobes];
  for (const [x, y, rad] of lobes) {
    const n = Math.max(5, Math.round((Math.PI * 2 * rad) / (rad * every * 2)));
    const ph = r() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = ph + (i / n) * Math.PI * 2;
      const rr = rad * k * (0.75 + r() * 0.5);
      out.push([x + Math.cos(a) * (rad - rr * 0.25), y + Math.sin(a) * (rad - rr * 0.25), rr]);
    }
  }
  return out;
}

const shift = (lobes: Lobe[], dx: number, dy: number, s: number): Lobe[] => lobes.map(([x, y, r]) => [x + dx * r, y + dy * r, r * s]);

interface CrownOpts {
  lobes: Lobe[];
  cx: number;
  cy: number;
  pal: Palette;
  r: () => number;
  aspect?: number;
  /** Where branches show through gaps in the leaves: [x, y, size]. */
  holes?: [number, number, number][];
  /** Where the trunk enters the crown, and the boughs reaching up into its hollow. */
  trunkX?: number;
  boughs?: Pt[];
  hollow?: boolean;
  /** The marks that suggest leaves: ticks, or small maple stars. */
  marks?: 'ticks' | 'stars' | 'strokes';
  width?: number;
}

/**
 * A crown in three values, as on a print: the whole mass in the middle tone, the side away from the sun
 * screened with halftone dots of the shadow colour, a lit region toward the sun (up and to the left) in the
 * light tone, gaps where branches show through, leaf marks, and a rim of the sun's colour along the lit edge.
 */
function crown(p: Pen, o: CrownOpts) {
  const { cx, cy, pal, r } = o;
  const aspect = o.aspect ?? 1;
  const edge = leafy(o.lobes, r);
  const outline = union(edge, cx, cy, aspect);
  const shadow = union(shift(edge, 0.3, 0.36, 0.98), cx + 20, cy + 24, aspect);
  p.shape(outline, { fill: pal.mid, raw: true, width: o.width ?? 4.5, wobble: 0.35, shade: [{ pts: shadow, color: pal.shadow }] });
  // The lit side: the same crown, pulled toward the sun and shrunk, so it sits inside the mass.
  const lit = union(leafy(shift(o.lobes, -0.16, -0.2, 0.8), r, 0.3), cx - 14, cy - 18, aspect, 180);
  p.shape(lit, { fill: pal.light, raw: true, stroke: null, wobble: 0.35 });
  const big = o.lobes.reduce((m, l) => (l[2] > m[2] ? l : m), o.lobes[0]);
  const capLobes = o.lobes.filter(([, ly, lr]) => ly - lr < big[1] - big[2] * 0.4);
  const top = union(shift(capLobes, -0.3, -0.34, 0.5), cx - 24, cy - 34, aspect, 120);
  p.shape(top, { fill: mixC(pal.light, pal.rim, 0.3), raw: true, stroke: null, wobble: 0.35 });
  // The hollow under the crown, in shadow, where the boughs go up into the leaves.
  const ys = outline.map(([, y]) => y);
  const bottom = Math.max(...ys);
  const R = big[2];
  if (o.hollow !== false) {
    p.ellipse(o.trunkX ?? cx, bottom - R * 0.32 * aspect, R * 0.62, R * 0.26 * aspect, { fill: pal.shadow, stroke: null, wobble: 0.6 });
    for (const [tx, ty] of o.boughs ?? []) p.line([[o.trunkX ?? cx, bottom + 6], [(tx + (o.trunkX ?? cx)) / 2, (ty + bottom) / 2], [tx, ty]], { width: 6, color: BARK });
  }
  // Gaps in the leaves with a branch crossing each.
  for (const [hx, hy, s] of [] as [number, number, number][]) {
    const hole: Pt[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const k = i % 2 ? 0.7 : 1;
      hole.push([hx + Math.cos(a) * s * k * 1.3, hy + Math.sin(a) * s * k]);
    }
    p.shape(hole, { fill: pal.shadow, raw: true, width: 2.4, wobble: 0.4 });
    p.line([[hx - s * 1.2, hy + s * 0.5], [hx, hy - s * 0.1], [hx + s * 1.1, hy - s * 0.6]], { width: Math.max(3, s * 0.35), color: BARK });
  }
  // Leaf marks: in the lit side, in the rim colour; in the middle tone, a shade darker.
  const marks = o.marks ?? 'ticks';
  const inside = (pts: Pt[], x: number, y: number) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const xs = outline.map(([x]) => x);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let i = 0; i < 70; i++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    if (!inside(outline, x, y)) continue;
    const onLit = inside(lit, x, y);
    if (!onLit && inside(shadow, x, y) && r() < 0.7) continue;
    const c = onLit ? pal.rim : pal.shadow;
    if (marks === 'stars') {
      const s = 4 + r() * 3;
      p.shape([[x, y - s], [x + s * 0.35, y - s * 0.3], [x + s, y - s * 0.4], [x + s * 0.45, y + s * 0.15], [x + s * 0.6, y + s * 0.8], [x, y + s * 0.4], [x - s * 0.6, y + s * 0.8], [x - s * 0.45, y + s * 0.15], [x - s, y - s * 0.4], [x - s * 0.35, y - s * 0.3]], { fill: c, raw: true, stroke: null, wobble: 0.2, opacity: 0.9 });
    } else if (marks === 'strokes') {
      p.line([[x, y], [x + (r() - 0.5) * 3, y + 10 + r() * 8]], { width: 2.4, color: c, raw: true, opacity: 0.8, wobble: 0.2 });
    } else {
      p.line([[x - 5, y - 3], [x, y + 2], [x + 5, y - 4]], { width: 2.2, color: c, raw: true, opacity: 0.8, wobble: 0.2 });
    }
  }
  // The sun's rim along the upper-left of the outline, just inside the ink.
  const rim = outline.filter(([x, y]) => {
    const a = Math.atan2(y - cy, x - cx);
    return a > -Math.PI * 0.95 && a < -Math.PI * 0.42;
  });
  if (rim.length > 3) p.line(rim.map(([x, y]): Pt => [x + (cx - x) * 0.04, y + (cy - y) * 0.04]), { width: 3.2, color: pal.rim, raw: true, opacity: 0.9, wobble: 0.2 });
  return outline;
}

/** Mixes two hex colours. */
function mixC(a: string, b: string, k: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

/**
 * A trunk with weight: flared roots gripping the ground, a gentle S as it rises, bark lines down it in
 * shade, a lit edge on the sun side, and boughs forking up into the crown.
 */
function bole(p: Pen, x: number, base: number, top: number, w: number, boughs: [number, number, number][], lean = 0, bark = BARK) {
  const mid = (base + top) / 2;
  const body: Pt[] = [
    [x - w * 2.1, base + 2],
    [x - w * 1.1, base - 10],
    [x - w * 0.7, base - 34],
    [x - w * 0.56 + lean * 0.4, mid],
    [x - w * 0.46 + lean, top],
    [x + w * 0.46 + lean, top],
    [x + w * 0.6 + lean * 0.4, mid],
    [x + w * 0.74, base - 34],
    [x + w * 1.2, base - 10],
    [x + w * 2.2, base + 2],
  ];
  for (const [fy, tx, ty] of boughs) {
    const fx = x + lean * ((base - fy) / (base - top));
    p.line([[fx, fy], [(fx * 2 + tx) / 3, (fy * 2 + ty) / 3 - 10], [tx, ty]], { width: Math.max(4, w * 0.5), color: bark });
  }
  p.shape(body, { fill: bark, width: 4, shade: [{ pts: [[x + w * 0.05 + lean, top - 10], [x + w * 3, top - 10], [x + w * 3, base + 10], [x + w * 0.15, base + 10]], color: '#140A12' }] });
  p.line([[x - w * 0.38 + lean, top + 10], [x - w * 0.5 + lean * 0.4, mid], [x - w * 0.6, base - 30]], { width: 2.6, color: BARK_LIGHT, opacity: 0.9 });
  for (let k = 0; k < 4; k++) {
    const y = top + 30 + k * ((base - top - 60) / 4);
    p.line([[x + w * 0.1 + lean * 0.5, y], [x + w * 0.2 + lean * 0.5, y + 22]], { width: 1.8, color: '#140A12', raw: true, opacity: 0.7 });
  }
}

/** Grass tufts at the foot of a tree, in olive and gold. */
function tufts(p: Pen, x: number, base: number, spread: number, r: () => number) {
  for (let i = 0; i < 7; i++) {
    const tx = x + (r() - 0.5) * spread;
    for (const a of [-0.5, 0, 0.45]) p.line([[tx, base], [tx + Math.sin(a) * 14, base - 14 - r() * 10]], { width: 2.4, color: i % 3 ? '#7E8A44' : '#A3A653', raw: true });
  }
}

function tree(key: string, w: number, h: number, draw: (p: Pen, r: () => number) => void, seed: number): Art {
  const p = pen(key);
  const r = rng(seed);
  // A soft contact shadow on the ground.
  p.ellipse(w / 2, h - 6, w * 0.34, 10, { fill: '#0A0712', stroke: null, opacity: 0.22, wobble: 0.3 });
  draw(p, r);
  return { key, svg: p.svg(w, h), w, h };
}

/** A broad oak: a heavy, cloud-edged crown wider than it is tall, a stout trunk, boughs showing through. */
function oak(key: string, pal: Palette, seed: number): Art {
  const w = 340;
  const h = 420;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      bole(p, 170, h - 8, 210, 17, [[262, 92, 178], [248, 252, 170], [226, 168, 120], [236, 206, 128]], 6);
      crown(p, {
        lobes: [[170, 150, 84], [104, 184, 62], [240, 180, 64], [120, 116, 56], [226, 110, 58], [172, 82, 60], [70, 156, 40], [276, 150, 40]],
        cx: 170,
        cy: 150,
        pal,
        r,
        trunkX: 174,
        boughs: [[120, 206], [226, 202], [176, 196]],
      });
      tufts(p, 170, h - 8, 120, r);
    },
    seed,
  );
}

/** A poplar: a tall flame of a crown on a straight trunk, its leaves drawn as upright strokes. */
function poplar(key: string, pal: Palette, seed: number): Art {
  const w = 170;
  const h = 460;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      bole(p, 85, h - 8, 300, 9, [[340, 70, 300], [330, 102, 280]], 0);
      const lobes: Lobe[] = [];
      for (let i = 0; i < 8; i++) lobes.push([85 + (r() - 0.5) * 8, 370 - i * 40, 44 - Math.abs(i - 2.6) * 5.2]);
      lobes.push([85, 52, 18]);
      crown(p, { lobes, cx: 85, cy: 220, pal, r, marks: 'strokes', aspect: 1, hollow: false });
      tufts(p, 85, h - 8, 70, r);
    },
    seed,
  );
}

/** A maple: a round, full crown in autumn colour with a little point at the top, maple-leaf marks, and leaves fallen beneath. */
function maple(key: string, pal: Palette, seed: number): Art {
  const w = 320;
  const h = 400;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      for (let i = 0; i < 22; i++) {
        const x = 50 + r() * 220;
        const y = h - 6 - r() * 8;
        p.shape([[x - 6, y], [x, y - 4], [x + 6, y], [x, y + 3]], { fill: [pal.light, pal.mid, pal.shadow][i % 3], raw: true, width: 1.5 });
      }
      bole(p, 160, h - 8, 220, 14, [[262, 92, 196], [250, 236, 186], [228, 158, 126], [240, 190, 140]], -4);
      crown(p, {
        lobes: [[160, 168, 82], [96, 192, 58], [226, 196, 60], [110, 124, 56], [214, 120, 58], [160, 84, 58], [160, 50, 26]],
        cx: 160,
        cy: 160,
        pal,
        r,
        marks: 'stars',
        trunkX: 158,
        boughs: [[112, 222], [210, 218], [160, 212]],
      });
    },
    seed,
  );
}

/** A birch pair: two slender white trunks with black marks, one leaning, under airy gold clusters. */
function birch(key: string): Art {
  const w = 220;
  const h = 440;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      const stem = (x0: number, x1: number, top: number, wd: number) => {
        p.shape([[x0 - wd, h - 8], [x1 - wd * 0.6, top], [x1 + wd * 0.6, top], [x0 + wd, h - 8]], { fill: '#F3E3CC', width: 3.5, shade: [{ pts: [[x0 + wd * 0.2, h], [x1 + wd * 0.3, top], [x1 + wd * 2, top], [x0 + wd * 2, h]], color: '#C8B4A8' }] });
        for (let y = top + 20; y < h - 24; y += 18 + r() * 16) {
          const t = (h - 8 - y) / (h - 8 - top);
          const cx = x0 + (x1 - x0) * t;
          p.line([[cx - wd * 0.7, y], [cx + wd * (0.1 + r() * 0.5), y + 2]], { width: 2.6, color: '#0A0712', raw: true });
        }
      };
      stem(118, 92, 90, 9);
      stem(124, 158, 150, 6);
      p.line([[100, 200], [62, 156]], { width: 3.5, color: '#0A0712' });
      p.line([[150, 210], [182, 168]], { width: 3, color: '#0A0712' });
      crown(p, { lobes: [[96, 118, 44], [66, 160, 30], [128, 86, 32]], cx: 96, cy: 120, pal: P.gold, r, width: 3.5, hollow: false });
      crown(p, { lobes: [[160, 164, 34], [184, 140, 24], [140, 186, 22]], cx: 160, cy: 164, pal: P.gold, r, width: 3.5, hollow: false });
      tufts(p, 120, h - 8, 60, r);
    },
    13,
  );
}

/**
 * A pine as one silhouette: a single outline that steps out at every tier - down a sloping edge to a
 * drooping tip, back in to a notch where the next tier hangs below - so no tier is drawn over another.
 * The sun side is lit and the far side screened in halftone, as one shape. The tiers show only as soft
 * shadow lines under each, with needles hanging from them, and the sun's rim runs along the outer edge.
 */
function pine(key: string, pal: Palette, _snowy: boolean, seed: number): Art {
  const w = 260;
  const h = 460;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      const cx = 130;
      bole(p, cx, h - 8, 360, 9, [], 0);
      const tiers = 6;
      const apex = 22;
      const rows: { tipY: number; half: number; notch: number }[] = [];
      for (let t = 0; t < tiers; t++) {
        const k = t / (tiers - 1);
        rows.push({ tipY: 104 + k * 286 + (r() - 0.5) * 6, half: 34 + k * 90 + (r() - 0.5) * 8, notch: 0 });
      }
      // Where each tier tucks in under the one above: a notch partway back toward the trunk.
      rows.forEach((row) => (row.notch = row.half * 0.46));
      const side = (s: 1 | -1): Pt[] => {
        const pts: Pt[] = [];
        rows.forEach((row, t) => {
          const from: Pt = t === 0 ? [cx, apex] : [cx + s * rows[t - 1].notch, rows[t - 1].tipY - 6];
          // The sloping edge, slightly concave, out to a drooping tip.
          pts.push([from[0] + (cx + s * row.half - from[0]) * 0.55, from[1] + (row.tipY - from[1]) * 0.5 - 4]);
          pts.push([cx + s * (row.half - 6), row.tipY - 8]);
          pts.push([cx + s * row.half, row.tipY + 4]);
          if (t < rows.length - 1) {
            // Back in along the tier's lower edge to the notch.
            pts.push([cx + s * (row.half * 0.78), row.tipY - 2]);
            pts.push([cx + s * row.notch, row.tipY - 6]);
          }
        });
        return pts;
      };
      const right = side(1);
      const left = side(-1);
      // The bottom: needles hanging from the lowest tier in a soft saw edge, right tip to left tip.
      const last = rows[rows.length - 1];
      const bottom: Pt[] = [];
      const teeth = 9;
      for (let i = 1; i < teeth; i++) {
        const u = i / teeth;
        bottom.push([cx + last.half - u * last.half * 2, last.tipY - Math.sin(u * Math.PI) * 18 + (i % 2 ? 8 : -2)]);
      }
      const outline: Pt[] = [[cx, apex], ...right, ...bottom, ...left.slice().reverse()];
      p.shape(outline, { fill: pal.light, raw: true, width: 4.2, wobble: 0.3, shade: [{ pts: [[cx + 2, 0], [w, 0], [w, h], [cx + 6, h]], color: pal.shadow }] });
      // The tiers: a soft shadow under each, on the lit side only, sagging from the trunk out toward the tip,
      // with a few needles hanging from it - enough to read the layers without outlining them again.
      for (let t = 0; t < rows.length - 1; t++) {
        const row = rows[t];
        const shadow: Pt[] = [];
        for (let i = 0; i <= 6; i++) {
          const u = i / 6;
          shadow.push([cx - 4 - u * row.half * 0.74, row.tipY - 4 - Math.sin(u * Math.PI * 0.9) * 8 + u * 6]);
        }
        const under = shadow.map(([x, y]): Pt => [x, y + 7]).reverse();
        p.shape([...shadow, ...under], { fill: pal.mid, raw: true, stroke: null, wobble: 0.3, opacity: 0.85 });
        for (let i = 1; i < 6; i += 2) {
          const [x, y] = shadow[i];
          p.line([[x, y + 6], [x - 2, y + 14]], { width: 2, color: pal.mid, raw: true, opacity: 0.85 });
        }
      }
      // The sun's rim: one stroke per tier, down its sloping outer edge on the left to the tip, and no further.
      rows.forEach((row, t) => {
        const from: Pt = t === 0 ? [cx, apex] : [cx - rows[t - 1].notch, rows[t - 1].tipY - 6];
        const midPt: Pt = [from[0] + (cx - row.half - from[0]) * 0.55, from[1] + (row.tipY - from[1]) * 0.5 - 4];
        const tip: Pt = [cx - (row.half - 6), row.tipY - 8];
        p.line([[from[0] - 1, from[1] + 8], [midPt[0] + 5, midPt[1] + 2], [tip[0] + 6, tip[1] - 1]], { width: 3, color: pal.rim, raw: true, opacity: 0.85 });
      });
      tufts(p, cx, h - 8, 90, r);
    },
    seed,
  );
}

/** A stone pine by the sea: a leaning trunk forking into limbs, under a broad, flat-topped umbrella of pads. */
function seaPine(key: string): Art {
  const w = 360;
  const h = 360;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      p.line([[196, h - 8], [190, 290], [168, 220], [140, 168]], { width: 20, color: BARK });
      p.line([[194, h - 8], [188, 290], [166, 222]], { width: 5, color: BARK_LIGHT, opacity: 0.8 });
      p.line([[168, 226], [232, 176]], { width: 11, color: BARK });
      p.line([[146, 178], [96, 138]], { width: 9, color: BARK });
      p.line([[232, 178], [266, 150]], { width: 7, color: BARK });
      crown(p, { lobes: [[110, 122, 46], [160, 104, 52], [214, 112, 46], [262, 134, 36], [64, 138, 30]], cx: 160, cy: 118, pal: P.sea, r, aspect: 0.42, marks: 'ticks', hollow: false });
      crown(p, { lobes: [[226, 160, 34], [262, 168, 26], [194, 168, 22]], cx: 228, cy: 162, pal: P.sea, r, aspect: 0.45, hollow: false });
      tufts(p, 196, h - 8, 80, r);
    },
    29,
  );
}

// ================================================================ the pass's trees

/** Frostpeak's inks for its trees: bottle-green needles, violet in their depths, bone snow shaded lavender. */
const FROST = { needle: '#2A4636', needleDark: '#1A2E24', deep: '#120E22', snow: '#F3E3CC', snowShade: '#9A84C0', rim: '#FFF6EA', bark: '#3A1A26', berry: '#E3263A', leaf: '#FF6A30' };

/** A snow pillow lying along the top of a bough: thick in the middle, thin at its ends, shaded underneath. */
function pillow(p: Pen, pts: Pt[], thick: number) {
  const top = pts.map(([x, y]): Pt => [x, y - thick]);
  const under = pts
    .slice()
    .reverse()
    .map(([x, y], i, a): Pt => [x, y + Math.sin((i / (a.length - 1)) * Math.PI) * thick * 0.35]);
  p.shape([...top, ...under], { fill: FROST.snow, width: 2.6, wobble: 0.4, shade: [{ pts: [...pts.map(([x, y]): Pt => [x, y - thick * 0.2]), ...under], color: FROST.snowShade }] });
}

/**
 * The pass's spruce, reshaped: not a stack of identical triangles but a crooked trunk carrying boughs one by
 * one, alternating, uneven in length, each sweeping down to a drooping tip with needles hanging under it in
 * points and a pillow of snow along its top. The leader leans, and one bough near the top is broken short.
 */
function snowSpruce(key: string, seed: number): Art {
  const w = 280;
  const h = 470;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      const cx = (y: number) => 140 + Math.sin(y / 70) * 5 + (y < 120 ? (120 - y) * 0.12 : 0);
      p.line([[cx(h - 8), h - 8], [cx(300), 300], [cx(160), 160], [cx(40), 40]], { width: 12, color: FROST.bark });
      const n = 13;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const y = 52 + k * 330;
        const side = i % 2 ? 1 : -1;
        const len = (22 + k * 112) * (0.8 + r() * 0.4) * (i === 3 ? 0.45 : 1);
        const x0 = cx(y);
        const droop = 18 + k * 34;
        const tip: Pt = [x0 + side * len, y + droop];
        // The bough: an arc out from the trunk, needles hanging from its underside in a saw edge.
        const top: Pt[] = [];
        for (let t = 0; t <= 6; t++) {
          const u = t / 6;
          top.push([x0 + side * len * u, y - 6 + Math.sin(u * Math.PI * 0.9) * -10 + u * u * droop]);
        }
        const under: Pt[] = [];
        const teeth = 4 + Math.round(k * 5);
        for (let t = teeth; t >= 0; t--) {
          const u = t / teeth;
          under.push([x0 + side * len * u, y + 10 + u * u * droop + (t % 2 ? 14 + k * 10 : 2)]);
        }
        const bough = [...top, ...under];
        p.shape(bough, { fill: side > 0 ? FROST.needleDark : FROST.needle, raw: true, width: 3.2, wobble: 0.3, shade: side > 0 ? [{ pts: bough, color: FROST.deep }] : [] });
        pillow(p, top.slice(0, 6).concat([tip]).map(([x, y]): Pt => [x, y + 2]), 9 + k * 6);
      }
      // The leaning leader at the top, with its own cap of snow.
      p.shape([[cx(40) - 10, 70], [cx(40) + 4, 4], [cx(40) + 14, 70]], { fill: FROST.needle, raw: true, width: 3 });
      p.shape([[cx(40) - 6, 30], [cx(40) + 4, 2], [cx(40) + 10, 30], [cx(40) + 2, 36]], { fill: FROST.snow, width: 2.2 });
      // A drift round its foot.
      p.shape([[40, h - 2], [70, h - 26], [140, h - 34], [210, h - 24], [244, h - 2]], { fill: FROST.snow, width: 3, shade: [{ pts: [[140, h - 40], [250, h - 40], [250, h], [140, h]], color: FROST.snowShade }] });
    },
    seed,
  );
}

/**
 * A snow ghost: a fir so buried in rime and snow it has become a hooded figure - a lumpy column of bone,
 * leaning a little, with only a few dark needles showing through where the snow has slipped.
 */
function snowGhost(key: string, seed: number): Art {
  const w = 240;
  const h = 430;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      const left: Pt[] = [];
      const right: Pt[] = [];
      for (let i = 0; i <= 12; i++) {
        const k = i / 12;
        const y = 30 + k * (h - 50);
        const half = 18 + Math.pow(k, 0.8) * 86 + Math.sin(k * 19 + 1) * 9;
        const lean = (1 - k) * 18;
        left.push([120 + lean - half - (i % 3 === 1 ? 10 : 0), y]);
        right.push([120 + lean + half + (i % 3 === 2 ? 12 : 0), y]);
      }
      const body: Pt[] = [[138, 6], ...right, [120 + 96, h - 6], [120 - 100, h - 6], ...left.reverse()];
      p.shape(body, { fill: FROST.snow, width: 4.5, wobble: 0.5, shade: [{ pts: [[132, 0], [w, 0], [w, h], [118, h]], color: FROST.snowShade }] });
      // Dark needles showing where the snow has slipped: little saw-edged patches.
      for (let i = 0; i < 9; i++) {
        const y = 80 + r() * (h - 150);
        const k = (y - 30) / (h - 50);
        const half = 18 + Math.pow(k, 0.8) * 86;
        const x = 120 + (1 - k) * 18 + (r() - 0.5) * half * 1.3;
        const s = 10 + r() * 12;
        p.shape([[x - s, y], [x - s * 0.4, y - s * 0.5], [x + s * 0.3, y - s * 0.2], [x + s, y + s * 0.1], [x + s * 0.5, y + s * 0.5], [x, y + s * 0.2], [x - s * 0.5, y + s * 0.6]], { fill: x > 125 ? FROST.needleDark : FROST.needle, raw: true, width: 2.4 });
      }
      // Bulges of rime along its sides, catching the moon.
      for (let i = 0; i < 6; i++) {
        const y = 80 + i * 56;
        const k = (y - 30) / (h - 50);
        const lx = 120 + (1 - k) * 18 - (18 + Math.pow(k, 0.8) * 86) + 14;
        p.line([[lx, y], [lx + 22, y - 10], [lx + 46, y - 6]], { width: 3, color: FROST.rim, opacity: 0.8 });
      }
    },
    seed,
  );
}

/**
 * A subalpine fir: a tall, very narrow spire with short stiff branches all the way up, snow tufted on their
 * tips, and a sharp top. It stands in the gaps between the broader trees.
 */
function snowSpire(key: string, seed: number): Art {
  const w = 150;
  const h = 500;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      const outline: Pt[] = [[75, 6]];
      const rows = 16;
      for (let i = 1; i <= rows; i++) {
        const k = i / rows;
        const y = 6 + k * (h - 70);
        const half = 8 + k * 46 + (r() - 0.5) * 6;
        outline.push([75 + half, y], [75 + half * 0.6, y + 6]);
      }
      const leftSide = outline.slice(1).map(([x, y]): Pt => [150 - x, y]).reverse();
      const body: Pt[] = [...outline, [75 + 10, h - 50], [75 - 10, h - 50], ...leftSide];
      p.rect(69, h - 70, 12, 62, { fill: FROST.bark, width: 3, r: 2 });
      p.shape(body, { fill: FROST.needle, raw: true, width: 3.4, shade: [{ pts: [[76, 0], [w, 0], [w, h], [76, h]], color: FROST.deep }] });
      for (let i = 1; i <= rows; i += 1) {
        const k = i / rows;
        const y = 6 + k * (h - 70);
        const half = 8 + k * 46;
        for (const s of [-1, 1]) {
          const x = 75 + s * half * 0.9;
          p.ellipse(x, y - 3, 6 + k * 6, 4 + k * 2, { fill: FROST.snow, width: 2, shade: s > 0 ? [{ pts: [[x - 20, y - 10], [x + 20, y - 10], [x + 20, y + 10], [x - 20, y + 10]], color: FROST.snowShade }] : [] });
        }
      }
      p.shape([[70, 22], [75, 2], [80, 22]], { fill: FROST.snow, raw: true, width: 2 });
      p.shape([[40, h - 4], [60, h - 22], [92, h - 24], [112, h - 4]], { fill: FROST.snow, width: 2.6 });
    },
    seed,
  );
}

/** Branches, forking as they go, for the bare trees; returns the segments so snow can be laid along them. */
function boughs(p: Pen, x: number, y: number, a: number, len: number, wd: number, depth: number, r: () => number, color: string, out: [Pt, Pt, number][]) {
  const x1 = x + Math.cos(a) * len;
  const y1 = y + Math.sin(a) * len;
  const mid: Pt = [(x + x1) / 2 + (r() - 0.5) * len * 0.15, (y + y1) / 2 + (r() - 0.5) * len * 0.15];
  p.line([[x, y], mid, [x1, y1]], { width: wd, color });
  out.push([[x, y], [x1, y1], wd]);
  if (depth <= 0) return;
  const forks = depth > 2 ? 2 : 2 + (r() < 0.5 ? 1 : 0);
  for (let i = 0; i < forks; i++) {
    const spread = 0.35 + r() * 0.35;
    const na = a + (i - (forks - 1) / 2) * spread * 1.4 + (r() - 0.5) * 0.2;
    boughs(p, x1, y1, na, len * (0.62 + r() * 0.16), Math.max(1.4, wd * 0.62), depth - 1, r, color, out);
  }
}

/**
 * A bare birch in winter: a pale trunk barred with black, its fine branches fanning up, and a line of snow
 * along the top of every bough thick enough to hold it.
 */
function snowBirch(key: string, seed: number): Art {
  const w = 240;
  const h = 450;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      const segs: [Pt, Pt, number][] = [];
      boughs(p, 116, 230, -Math.PI / 2 - 0.55, 54, 6, 3, r, '#2A1A26', segs);
      boughs(p, 120, 190, -Math.PI / 2 + 0.5, 56, 6, 3, r, '#2A1A26', segs);
      boughs(p, 118, 140, -Math.PI / 2 - 0.08, 46, 5, 3, r, '#2A1A26', segs);
      p.shape([[106, h - 8], [112, 110], [118, 70], [126, 110], [132, h - 8]], { fill: '#F3E3CC', width: 3.6, shade: [{ pts: [[121, 60], [140, 60], [140, h], [121, h]], color: '#C8B4A8' }] });
      for (let y = 100; y < h - 24; y += 16 + r() * 18) p.line([[109 + r() * 3, y], [119 + r() * 8, y + 2]], { width: 2.6, color: '#0A0712', raw: true });
      for (const [a, b, wd] of segs) {
        if (wd < 2.4) continue;
        const ax = a[0];
        const bx = b[0];
        if (Math.abs(bx - ax) < 6) continue;
        p.line([[a[0], a[1] - wd * 0.7], [b[0], b[1] - wd * 0.7]], { width: Math.max(2.4, wd * 0.9), color: FROST.snow, raw: true });
      }
      p.shape([[70, h - 2], [96, h - 18], [146, h - 20], [172, h - 2]], { fill: FROST.snow, width: 2.6 });
    },
    seed,
  );
}

/**
 * A rowan in snow: a round, bare crown of dark twigs, hung with clusters of red berries each wearing a cap
 * of snow, and a last few ember leaves the winter has not taken.
 */
function snowRowan(key: string, seed: number): Art {
  const w = 280;
  const h = 390;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      const segs: [Pt, Pt, number][] = [];
      p.shape([[124, h - 8], [130, 240], [126, 210], [154, 210], [150, 240], [158, h - 8]], { fill: FROST.bark, width: 3.6, shade: [{ pts: [[142, 200], [170, 200], [170, h], [144, h]], color: '#140A12' }] });
      for (const a of [-2.25, -1.88, -1.57, -1.26, -0.9]) boughs(p, 140, 222, a, 46 + r() * 8, 7, 3, r, FROST.bark, segs);
      // Snow along the stouter boughs.
      for (const [a, b, wd] of segs) if (wd > 3 && Math.abs(b[0] - a[0]) > 8) p.line([[a[0], a[1] - wd * 0.7], [b[0], b[1] - wd * 0.7]], { width: wd, color: FROST.snow, raw: true });
      // Berry clusters at the twig ends, capped with snow; the last few leaves.
      const ends = segs.filter(([, , wd]) => wd < 2.5);
      ends.forEach(([, b], i) => {
        if (i % 2) return;
        const [x, y] = b;
        for (let k = 0; k < 5; k++) p.ellipse(x + (k % 3) * 6 - 6, y + 4 + Math.floor(k / 3) * 6, 4.2, 4.2, { fill: FROST.berry, width: 1.8 });
        p.ellipse(x, y - 1, 9, 3.5, { fill: FROST.snow, stroke: null });
      });
      ends.forEach(([, b], i) => {
        if (i % 5 !== 1) return;
        const [x, y] = b;
        p.shape([[x, y], [x + 7, y + 3], [x + 2, y + 11], [x - 4, y + 5]], { fill: FROST.leaf, raw: true, width: 1.8 });
      });
      p.shape([[70, h - 2], [100, h - 20], [180, h - 22], [212, h - 2]], { fill: FROST.snow, width: 2.6, shade: [{ pts: [[150, h - 30], [220, h - 30], [220, h], [150, h]], color: FROST.snowShade }] });
    },
    seed,
  );
}

/** The trees of the pass, by key, for its roadside. */
export const FROST_TREES = ['snowpine', 'snowpine', 'snowghost', 'snowspire', 'snowbirch', 'snowrowan', 'snowspire'];

/** Every new tree, under the keys the game and the biomes use. */
export function treeArts(): Art[] {
  return [
    oak('tree2_oak', P.oak, 3),
    oak('tree2_oak2', P.oakDeep, 7),
    poplar('tree2_poplar', P.oak, 11),
    pine('tree2_pine', P.pine, false, 17),
    maple('maple_0', P.red, 19),
    maple('maple_1', P.gold, 23),
    maple('maple_2', P.rust, 31),
    birch('birch'),
    snowSpruce('snowpine', 37),
    snowGhost('snowghost', 41),
    snowSpire('snowspire', 43),
    snowBirch('snowbirch', 47),
    snowRowan('snowrowan', 53),
    seaPine('seapine'),
  ];
}
export const MEADOW_TREES = ['tree2_oak', 'tree2_poplar', 'tree2_oak2', 'tree2_pine'];
