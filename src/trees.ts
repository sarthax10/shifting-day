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

/** A pine: jagged tiers, each lit on the sun side and screened on the other, a spire at the top. */
function pine(key: string, pal: Palette, snowy: boolean, seed: number): Art {
  const w = 260;
  const h = 460;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      bole(p, 130, h - 8, 340, 9, [], 0);
      const tiers = 6;
      for (let t = 0; t < tiers; t++) {
        const k = t / (tiers - 1);
        const y = 70 + k * 290;
        const half = 30 + k * 92 + (r() - 0.5) * 8;
        const tipY = y + 46 + k * 18;
        const peak: Pt = [130, y - 40 - (t ? 0 : 26)];
        // A saw-toothed lower edge: needles hanging in points.
        const lower: Pt[] = [];
        const teeth = 6 + t;
        for (let i = 0; i <= teeth; i++) {
          const u = i / teeth;
          const x = 130 + half - u * half * 2;
          lower.push([x, tipY - Math.sin(u * Math.PI) * (14 + k * 10) + (i % 2 ? 10 : 0)]);
        }
        const body: Pt[] = [peak, [130 + half * 0.5, y + 6], ...lower, [130 - half * 0.5, y + 6]];
        p.shape(body, { fill: pal.light, raw: true, width: 3.6, shade: [{ pts: [[132, y - 70], [w, y - 70], [w, tipY + 24], [132, tipY + 24]], color: pal.shadow }] });
        p.line([peak, [130 - half * 0.5, y + 6], [130 - half, tipY]], { width: 3, color: pal.rim, raw: true, opacity: 0.75 });
        if (snowy) {
          const snow: Pt[] = [[130, peak[1] + 4], [130 + half * 0.5, y + 8], [130 + half * 0.82, tipY - 16], [130 + half * 0.36, y + 14], [130, y + 4], [130 - half * 0.36, y + 14], [130 - half * 0.82, tipY - 16], [130 - half * 0.5, y + 8]];
          p.shape(snow, { fill: '#F3E3CC', width: 2.4, shade: [{ pts: [[130, y - 60], [w, y - 60], [w, tipY + 20], [130, tipY + 20]], color: '#9A84C0' }] });
        }
      }
      if (!snowy) tufts(p, 130, h - 8, 90, r);
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
    pine('snowpine', P.snow, true, 37),
    seaPine('seapine'),
  ];
}
export const MEADOW_TREES = ['tree2_oak', 'tree2_poplar', 'tree2_oak2', 'tree2_pine'];
