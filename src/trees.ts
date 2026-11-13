import { roadsidePineArt } from './night';
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
  oak: { shadow: '#1F4A4A', mid: '#3E8A68', light: '#8CC870', rim: '#E8F0A0' },
  oakDeep: { shadow: '#1E4040', mid: '#357A5E', light: '#7AB862', rim: '#E0EC98' },
  red: { shadow: '#7A2A2E', mid: '#D8563A', light: '#F29A4A', rim: '#FFD27A' },
  gold: { shadow: '#A86A24', mid: '#F2B23A', light: '#FFE07A', rim: '#FFF2B0' },
  rust: { shadow: '#6A3A2A', mid: '#C9702E', light: '#EE9A4A', rim: '#FFD8A0' },
  pine: { shadow: '#163A3A', mid: '#2E6A56', light: '#4E9070', rim: '#C8E8A8' },
  snow: { shadow: '#14283C', mid: '#1E3448', light: '#2E4E66', rim: '#E8F0FF' },
  sea: { shadow: '#1F4A3E', mid: '#3E7A5E', light: '#6AA878', rim: '#E8F4C8' },
};
const BARK = '#4A3438';
const BARK_LIGHT = '#6A4E4E';

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

/** A trunk tapering up from a flared root, and branches forking from it toward the clumps. */
function trunk(p: Pen, x: number, base: number, top: number, w: number, branches: [number, number, number][], lean = 0) {
  p.shape(
    [
      [x - w * 1.4, base],
      [x - w * 0.6, base - 16],
      [x - w * 0.42 + lean, top],
      [x + w * 0.42 + lean, top],
      [x + w * 0.6, base - 16],
      [x + w * 1.4, base],
    ],
    { fill: BARK, width: 3.5, shade: [{ pts: [[x - w * 2, base + 4], [x - w * 0.1, base + 4], [x - w * 0.1 + lean, top - 4], [x - w * 2 + lean, top - 4]], color: BARK_LIGHT }] },
  );
  for (const [fy, tx, ty] of branches) {
    const fx = x + lean * ((base - fy) / (base - top));
    p.line([[fx, fy], [(fx + tx) / 2, (fy + ty) / 2 - 8], [tx, ty]], { width: Math.max(3, w * 0.45), color: BARK });
  }
}

function tree(key: string, w: number, h: number, draw: (p: Pen, r: () => number) => void, seed: number): Art {
  const p = pen(key);
  const r = rng(seed);
  // A soft contact shadow on the ground.
  p.ellipse(w / 2, h - 6, w * 0.32, 9, { fill: '#2A2140', stroke: null, opacity: 0.22, wobble: 0.3 });
  draw(p, r);
  return { key, svg: p.svg(w, h), w, h };
}

/** A broad oak: a heavy crown of five clumps, leaning, with branches showing through. */
function oak(key: string, pal: Palette, seed: number): Art {
  const w = 340;
  const h = 420;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      trunk(p, 170, h - 8, 200, 16, [[260, 96, 170], [250, 250, 160], [220, 170, 130]], 6);
      const cl: [number, number, number, number, number][] = [
        [110, 200, 70, 56, 0.8],
        [240, 196, 74, 58, 0.8],
        [170, 150, 96, 78, 0],
        [92, 132, 62, 54, 0],
        [236, 116, 66, 56, 0],
        [176, 80, 72, 58, 0],
      ];
      for (const [cx, cy, rx, ry, d] of cl) clump(p, cx + (r() - 0.5) * 10, cy, rx, ry, pal, r, d);
      p.line([[178, 230], [150, 196], [120, 190]], { width: 5, color: BARK });
    },
    seed,
  );
}

/** A poplar: tall and narrow, five to seven slim clumps stacked up a straight trunk. */
function poplar(key: string, pal: Palette, seed: number): Art {
  const w = 170;
  const h = 460;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      trunk(p, 85, h - 8, 120, 10, [], 0);
      for (let i = 0; i < 7; i++) {
        const y = 360 - i * 46;
        const rx = 46 - Math.abs(i - 2.5) * 5;
        clump(p, 85 + (r() - 0.5) * 12, y, rx, 40, pal, r, i < 2 ? 0.8 : 0);
      }
    },
    seed,
  );
}

/** A maple: a rounder, lighter crown than the oak, in autumn colours, with leaves fallen beneath. */
function maple(key: string, pal: Palette, seed: number): Art {
  const w = 320;
  const h = 400;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      for (let i = 0; i < 14; i++) p.ellipse(60 + r() * 200, h - 8 - r() * 6, 6, 3, { fill: i % 2 ? pal.light : pal.mid, stroke: null });
      trunk(p, 160, h - 8, 210, 13, [[260, 90, 190], [250, 240, 180], [230, 160, 120]], -4);
      const cl: [number, number, number, number, number][] = [
        [100, 210, 62, 50, 0.8],
        [222, 214, 64, 50, 0.8],
        [160, 168, 86, 70, 0],
        [86, 150, 58, 50, 0],
        [234, 140, 60, 52, 0],
        [158, 92, 70, 58, 0],
      ];
      for (const [cx, cy, rx, ry, d] of cl) clump(p, cx + (r() - 0.5) * 10, cy, rx, ry, pal, r, d);
    },
    seed,
  );
}

/** A birch: a thin white trunk with black marks, and an airy crown of small gold clusters. */
function birch(key: string): Art {
  const w = 220;
  const h = 440;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      p.shape([[100, h - 8], [104, 140], [96, 60], [108, 58], [116, 140], [120, h - 8]], { fill: '#F2EEE6', width: 3.5 });
      for (let y = 90; y < h - 20; y += 22 + r() * 14) p.line([[102 + r() * 4, y], [110 + r() * 6, y + 2]], { width: 2.2, color: '#2A2140', raw: true });
      p.line([[108, 200], [70, 150]], { width: 3, color: '#D8D2C8' });
      p.line([[110, 170], [156, 120]], { width: 3, color: '#D8D2C8' });
      for (let i = 0; i < 13; i++) {
        const x = 50 + r() * 120;
        const y = 50 + r() * 180;
        clump(p, x, y, 18 + r() * 10, 15 + r() * 8, P.gold, r);
      }
    },
    13,
  );
}

/** A pine with drooping tiers. With snow, white blobs lie on top of every tier. */
function pine(key: string, pal: Palette, snowy: boolean, seed: number): Art {
  const w = 260;
  const h = 460;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      p.rect(122, 330, 16, 120, { fill: BARK, width: 3.5, r: 3 });
      const tiers = 6;
      for (let t = 0; t < tiers; t++) {
        const k = t / (tiers - 1);
        const y = 60 + k * 300;
        const half = 26 + k * 92 + (r() - 0.5) * 10;
        const tipY = y + 40 + k * 20;
        // Each tier: a peak, then the lower edge sagging between the trunk and the tips.
        const pts: Pt[] = [[130, y - 36 + (t ? 0 : -24)]];
        pts.push([130 + half * 0.55, y + 4], [130 + half, tipY + (r() - 0.5) * 8]);
        for (let i = 1; i < 6; i++) {
          const u = i / 6;
          pts.push([130 + half * (1 - u * 2), tipY - Math.sin(u * Math.PI) * (16 + k * 10) + (i % 2 ? 6 : 0)]);
        }
        pts.push([130 - half, tipY + (r() - 0.5) * 8], [130 - half * 0.55, y + 4]);
        p.shape(pts, { fill: pal.light, raw: true, width: 3.2, shade: [{ pts: [[130, y - 60], [260, y - 60], [260, tipY + 20], [130, tipY + 20]], color: pal.mid }] });
        if (snowy) {
          // Snow lying on the tier, thick on the moonlit left, with a soft overhanging lip.
          const snow: Pt[] = [[130, y - 30 + (t ? 0 : -20)], [130 + half * 0.6, y + 14], [130 + half * 0.95, tipY - 4], [130 + half * 0.7, tipY - 14], [130 + half * 0.3, y + 22], [130 - half * 0.3, y + 22], [130 - half * 0.7, tipY - 14], [130 - half * 0.95, tipY - 4], [130 - half * 0.6, y + 14]];
          p.shape(snow, { fill: '#F4F8FF', raw: false, width: 2.4, shade: [{ pts: [[130, y - 60], [260, y - 60], [260, tipY + 20], [130, tipY + 20]], color: '#B8C8E8' }] });
        } else {
          const arc: Pt[] = [[130, y - 30], [130 - half * 0.55, y + 6], [130 - half, tipY]];
          p.line(arc, { width: 2.4, color: pal.rim, opacity: 0.6 });
        }
      }
    },
    seed,
  );
}

/** A windswept sea pine: a bent trunk and flat pads of foliage, dark underneath, lit on top. */
function seaPine(key: string): Art {
  const w = 360;
  const h = 360;
  return tree(
    key,
    w,
    h,
    (p, r) => {
      p.line([[190, h - 8], [182, 280], [150, 200], [118, 140]], { width: 18, color: BARK });
      p.line([[156, 214], [230, 170]], { width: 9, color: BARK });
      p.line([[128, 160], [80, 128]], { width: 8, color: BARK });
      const pads: [number, number, number, number][] = [
        [110, 110, 120, 34],
        [230, 150, 96, 28],
        [70, 130, 70, 24],
        [150, 86, 86, 26],
      ];
      for (const [cx, cy, rx, ry] of pads) {
        const pts = scallop(cx, cy, rx, ry, 10, r);
        p.shape(pts, { fill: P.sea.light, raw: true, width: 3.2, shade: [{ pts: move(pts, 0, ry * 0.55), color: P.sea.shadow }] });
        p.line(pts.filter(([, y]) => y < cy - ry * 0.4), { width: 2.4, color: P.sea.rim, raw: true, opacity: 0.7 });
      }
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
    roadsidePineArt(),
    seaPine('seapine'),
  ];
}
export const MEADOW_TREES = ['tree2_oak', 'tree2_poplar', 'tree2_oak2', 'tree2_pine'];
