import Phaser from 'phaser';
import { pen, type Art } from './art';
import type { Pt } from './ink';
import { P, clump, rng } from './trees';

/**
 * The hero waterfall of Maple Valley.
 *
 * The rock is one picture: rounded, stacked boulders either side of a dark wet notch, a ledge across the
 * middle, and a plunge pool, with maples leaning over the top.
 *
 * The water is drawn live on a canvas each frame, following how stylised waterfalls are painted:
 * - it rolls over a curved, bright lip, teal where it is still clear and thick;
 * - the sheet widens as it falls, and its edges fray into strands and drops;
 * - streaks accelerate downwards and stretch as they go, like falling water;
 * - it turns white as it fills with air, and disappears into a billowing cloud of foam at the bottom;
 * - rings and flecks of foam spread over the pool, getting smaller the further they travel.
 */

export const GORGE = { w: 780, h: 660 };
const POOL = { x: 390, y: 600, rx: 220, ry: 42 };
/** The live water canvas covers this part of the gorge picture. */
const CANVAS = { x: 150, y: 100, w: 480, h: 560 };

/** A fall of water, in gorge coordinates: the lip's left and right, and the foot's left and right. */
interface Stream {
  top: number;
  bottom: number;
  l0: number;
  r0: number;
  l1: number;
  r1: number;
  /** Turns per second of the streaks: how fast it falls. */
  speed: number;
  seed: number;
  /** A curled lip at the top (water rolling over an edge) rather than water pouring off a ledge. */
  lip: boolean;
}

/** Everything the live water needs to know about one waterfall. */
export interface FallSpec {
  /** The part of the picture the water canvas covers. */
  canvas: { x: number; y: number; w: number; h: number };
  streams: Stream[];
  pool: { x: number; y: number; rx: number; ry: number };
  /** Where rings spread from, across the pool. */
  rings: number[];
  /** How big the foam and spray are: 1 for the hero falls, less for far-off ones. */
  scale: number;
}

const STREAMS: Stream[] = [
  { top: 156, bottom: 322, l0: 340, r0: 444, l1: 306, r1: 482, speed: 0.75, seed: 1, lip: true },
  { top: 330, bottom: 594, l0: 300, r0: 372, l1: 272, r1: 396, speed: 0.6, seed: 2, lip: false },
  { top: 326, bottom: 594, l0: 398, r0: 478, l1: 386, r1: 512, speed: 0.62, seed: 3, lip: false },
];

const HERO: FallSpec = { canvas: CANVAS, streams: STREAMS, pool: POOL, rings: [334, 450], scale: 1 };

/** A rounded boulder: a few control points smoothed into a lumpy outline, lit on top-left and in shade bottom-right. */
function boulder(p: ReturnType<typeof pen>, r: () => number, cx: number, cy: number, w: number, h: number, lit: string, shade: string) {
  const pts: Pt[] = [];
  const n = 9 + Math.floor(r() * 3);
  const tilt = (r() - 0.5) * 0.4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + tilt;
    // Facets: every other point pulled in, so the outline breaks into planes like real rock.
    const k = (i % 2 ? 0.86 : 1) * (0.88 + r() * 0.2);
    pts.push([cx + Math.cos(a) * (w / 2) * k, cy + Math.sin(a) * (h / 2) * k * (Math.sin(a) < 0 ? 0.9 : 1)]);
  }
  p.shape(pts, {
    fill: lit,
    raw: true,
    width: 3.5,
    wobble: 0.8,
    shade: [{ pts: [[cx - w * 0.1, cy - h], [cx + w, cy - h], [cx + w, cy + h], [cx - w, cy + h], [cx - w, cy + h * 0.2]], color: shade }],
  });
  // A lit edge along the top-left.
  p.line(
    [
      [cx - w * 0.38, cy - h * 0.18],
      [cx - w * 0.15, cy - h * 0.38],
      [cx + w * 0.12, cy - h * 0.4],
    ],
    { width: 3, color: '#E8D2C0', opacity: 0.6 },
  );
  // A crack across the face.
  const cy0 = cy - h * (0.1 - r() * 0.3);
  p.line(
    [
      [cx - w * 0.1, cy0],
      [cx + w * 0.05, cy0 + h * 0.12],
      [cx + w * 0.02, cy0 + h * 0.3],
    ],
    { width: 2.4, color: '#3E3040', opacity: 0.7 },
  );
  return pts;
}

/** Moss draped over the top of a boulder: it follows the rock's top edge and hangs in ragged drips. */
function moss(p: ReturnType<typeof pen>, r: () => number, pts: Pt[], cy: number, h: number) {
  const top = pts.filter(([, y]) => y < cy - h * 0.18).sort((a, b) => a[0] - b[0]);
  if (top.length < 2) return;
  const under: Pt[] = [];
  for (let i = top.length - 1; i >= 0; i--) {
    const [x, y] = top[i];
    under.push([x - 3, y + 10 + r() * 10]);
    if (i > 0) under.push([(x + top[i - 1][0]) / 2, (y + top[i - 1][1]) / 2 + 20 + r() * 16]);
  }
  p.shape([...top.map(([x, y]): Pt => [x, y - 4]), ...under], { fill: '#7E9A5E', width: 2.6, wobble: 1 });
}

export function gorgeArt(): Art {
  const key = 'bd_a_gorge';
  const { w, h } = GORGE;
  const p = pen(key);
  const r = rng(77);
  // The wet notch behind the water: dark rock, with wet sheen running down it.
  p.shape(
    [
      [230, 176],
      [390, 168],
      [530, 176],
      [530, 620],
      [230, 620],
    ],
    { fill: '#3E3442', width: 3, wobble: 0.6 },
  );
  for (let i = 0; i < 14; i++) {
    const x = 240 + i * 21 + (r() - 0.5) * 8;
    p.line(
      [
        [x, 150 + r() * 40],
        [x + (r() - 0.5) * 10, 600],
      ],
      { width: 1.5 + r() * 2.5, color: r() < 0.5 ? '#5E5A70' : '#2E2634', raw: true, opacity: 0.7 },
    );
  }
  // The cliffs either side: boulders stacked into two towers, bigger at the bottom.
  const left: [number, number, number, number][] = [
    [100, 556, 250, 190],
    [60, 410, 150, 170],
    [196, 450, 170, 130],
    [130, 316, 230, 120],
    [60, 210, 140, 170],
    [196, 196, 150, 140],
    [262, 128, 110, 90],
  ];
  const right: [number, number, number, number][] = [
    [676, 560, 250, 180],
    [586, 452, 170, 140],
    [726, 400, 140, 170],
    [636, 306, 240, 130],
    [730, 206, 130, 160],
    [584, 190, 160, 140],
    [520, 126, 120, 90],
  ];
  const rocks = [...left.map((b) => [...b, 0] as const), ...right.map((b) => [...b, 1] as const)];
  // Upper rows first, so lower boulders overlap the ones above them.
  rocks.sort((a, b) => a[1] - b[1]);
  for (const [cx, cy, bw, bh, side] of rocks) {
    const pts = boulder(p, r, cx, cy, bw, bh, side ? '#A88E80' : '#B39886', side ? '#5E4650' : '#6A5058');
    if (r() < 0.7) moss(p, r, pts, cy, bh);
  }
  // The ledge across the middle that the first drop lands on: a rounded lip of rock, wet on top.
  p.shape(
    [
      [252, 322],
      [390, 310],
      [530, 320],
      [520, 352],
      [390, 346],
      [258, 354],
    ],
    { fill: '#6A5058', width: 3.5, wobble: 0.8 },
  );
  p.line(
    [
      [264, 324],
      [390, 314],
      [518, 322],
    ],
    { width: 3, color: '#9AB8C8', opacity: 0.7 },
  );
  // The plunge pool: deep teal in the middle, pale shallows at the rim, and a dark band where the cliff
  // shadows it.
  p.ellipse(POOL.x, POOL.y, POOL.rx, POOL.ry, {
    fill: '#7CD0D4',
    width: 3.5,
    shade: [
      {
        pts: [
          [POOL.x - 170, POOL.y - 26],
          [POOL.x + 170, POOL.y - 26],
          [POOL.x + 150, POOL.y + 22],
          [POOL.x - 150, POOL.y + 22],
        ],
        color: '#2E7A86',
      },
    ],
  });
  p.ellipse(POOL.x, POOL.y - 30, POOL.rx * 0.8, 10, { fill: '#1E5664', stroke: null, opacity: 0.6 });
  // Boulders at the foot, one half in the water, with wet dark bands where the water laps them.
  for (const [x, y, rx, ry] of [
    [180, 604, 64, 40],
    [618, 608, 72, 44],
    [500, 616, 34, 22],
    [80, 632, 74, 36],
    [720, 636, 70, 32],
  ] as const) {
    boulder(p, r, x, y, rx * 2, ry * 2, '#8A7A80', '#4E4450');
    p.line(
      [
        [x - rx * 0.9, y + ry * 0.45],
        [x, y + ry * 0.6],
        [x + rx * 0.9, y + ry * 0.45],
      ],
      { width: 3, color: '#E8F8FF', opacity: 0.7 },
    );
  }
  // Maples overhanging both lips of the gorge.
  for (const [cx, cy, pal] of [
    [100, 120, P.red],
    [200, 76, P.gold],
    [660, 104, P.rust],
    [740, 170, P.red],
    [560, 64, P.gold],
  ] as const) {
    clump(p, cx, cy, 70 + r() * 20, 54 + r() * 14, pal, r);
  }
  return { key, svg: p.svg(w, h), w, h };
}

/**
 * The hillside the falls belong to, standing behind the gorge: a forested slope rising out of the valley
 * floor to a crest above the falls, with the river winding down it in a channel to the lip. The gorge is
 * then an outcrop in this hill, not a block on its own.
 */
export const SET = { w: 2000, h: 1000 };
/** An uneven crest: the main summit a little right of the falls, a lower shoulder either side. */
function setTop(x: number) {
  const { w, h } = SET;
  const bump = (at: number, height: number, spread: number) => height * Math.exp(-(((x - w / 2 - at) / spread) ** 2));
  return h - 150 - bump(60, 560, 640) - bump(-420, 140, 240) - bump(520, 90, 200) - 22 * Math.sin(x / 150);
}
/** The river, in the hillside picture's coordinates: it comes over the crest and winds down to the lip, widening. */
const RIVER = (() => {
  const lipY = SET.h - GORGE.h + 162;
  const start = setTop(SET.w / 2) + 6;
  const k = (y: number) => (y - start) / (lipY - start);
  return {
    start,
    lipY,
    x: (y: number) => SET.w / 2 + Math.sin((y - start) / 40) * 30 * (1 - k(y)),
    w: (y: number) => 14 + k(y) * 100,
  };
})();

export function fallsSetArt(): Art {
  const key = 'bd_a_falls_set';
  const { w, h } = SET;
  const p = pen(key);
  const r = rng(503);
  const gx = (w - GORGE.w) / 2;
  const gy = h - GORGE.h;
  const top = setTop;
  const { lipY, start } = RIVER;
  const riverX = RIVER.x;
  const riverW = RIVER.w;
  const xs: number[] = [];
  for (let x = 0; x <= w; x += 16) xs.push(x);
  p.shape([...xs.map((x): Pt => [x, top(x)]), [w, h], [0, h]], {
    fill: '#A88068',
    raw: true,
    width: 3,
    wobble: 0.4,
    shade: [{ pts: [[w / 2 + 80, 0], [w, 0], [w, h], [w / 2 + 160, h]], color: '#8A6654' }],
  });
  // Forest: rows of maple canopies down the slopes, muted near the crest where the haze is, leaving the
  // river's channel and the gorge clear.
  const pals = [P.red, P.gold, P.rust, P.gold, P.red, P.oakDeep];
  for (let row = 0; row < 11; row++) {
    for (let x = (row % 2) * 40; x < w; x += 70 + r() * 40) {
      const y = top(x) + 34 + row * 62;
      if (y > h - 20) continue;
      if (x > gx + 40 && x < gx + GORGE.w - 40 && y > gy + 70) continue;
      if (y < lipY + 30 && Math.abs(x - riverX(Math.max(start, y))) < riverW(Math.max(start, y)) / 2 + 46) continue;
      const s = 0.8 + row * 0.05 + r() * 0.3;
      clump(p, x, y, 46 * s, 38 * s, pals[Math.floor(r() * pals.length)], r, row < 3 ? 0.8 : 0);
    }
  }
  // The river's channel: dark wet banks, with stones poking out at its edges. The water itself is live.
  const ys: number[] = [];
  for (let y = start; y <= lipY; y += 10) ys.push(y);
  p.shape([...ys.map((y): Pt => [riverX(y) - riverW(y) / 2 - 10, y]), ...ys.slice().reverse().map((y): Pt => [riverX(y) + riverW(y) / 2 + 10, y])], { fill: '#4A3A44', raw: true, width: 3, wobble: 0.5 });
  for (let y = start + 30; y < lipY - 20; y += 34 + r() * 20) {
    const side = r() < 0.5 ? -1 : 1;
    const bx = riverX(y) + side * (riverW(y) / 2 - 2);
    p.ellipse(bx, y, 8 + r() * 6, 5 + r() * 3, { fill: '#8A7A80', width: 2.4 });
  }
  return { key, svg: p.svg(w, h), w, h };
}

/**
 * The river running down the hill to the falls, drawn live: deep teal water in its channel, flow lines
 * sliding downhill and speeding up as the slope steepens, white riffles crossing it where it tumbles,
 * and a bright rush of water at the very end where it reaches the lip.
 */
class LiveRiver {
  readonly tex: Phaser.Textures.CanvasTexture;
  /** The canvas covers this part of the hillside picture. */
  readonly box: { x: number; y: number; w: number; h: number };
  private last = -1;
  private readonly lines: { u: number; ph: number; len: number }[] = [];
  constructor(scene: Phaser.Scene, key: string) {
    this.box = { x: SET.w / 2 - 110, y: RIVER.start - 4, w: 220, h: RIVER.lipY - RIVER.start + 12 };
    this.tex = scene.textures.exists(key) ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture) : scene.textures.createCanvas(key, this.box.w, this.box.h)!;
    const r = rng(611);
    for (let i = 0; i < 26; i++) this.lines.push({ u: 0.12 + r() * 0.76, ph: r(), len: 0.04 + r() * 0.06 });
  }
  draw(time: number) {
    if (this.last >= 0 && time - this.last < 33) return;
    this.last = time;
    const t = time / 1000;
    const { x: bx, y: by, w, h } = this.box;
    const ctx = this.tex.context;
    ctx.clearRect(0, 0, w, h);
    const { start, lipY } = RIVER;
    const L = lipY - start;
    const at = (k: number, u: number): [number, number] => {
      const y = start + k * L;
      return [RIVER.x(y) + (u - 0.5) * RIVER.w(y) - bx, y - by];
    };
    // The water, with a shaded far side and a wobble on its edges as it flows.
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const [x, y] = at(i / 30, 0);
      const wob = Math.sin(i * 1.3 - t * 6) * 1.2;
      if (i) ctx.lineTo(x + wob, y);
      else ctx.moveTo(x, y);
    }
    for (let i = 30; i >= 0; i--) {
      const [x, y] = at(i / 30, 1);
      ctx.lineTo(x + Math.sin(i * 1.1 - t * 6 + 2) * 1.2, y);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#6ABCCC');
    g.addColorStop(1, '#46AABE');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(30,110,140,0.22)';
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const [x, y] = at(i / 30, 0.62);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    for (let i = 30; i >= 0; i--) {
      const [x, y] = at(i / 30, 1.05);
      ctx.lineTo(x, y);
    }
    ctx.fill();
    // Flow lines: sliding downhill, faster towards the lip, where the slope steepens.
    ctx.lineCap = 'round';
    for (const l of this.lines) {
      const a = (t * 0.22 + l.ph) % 1;
      const k0 = a ** 1.4;
      const k1 = Math.min(1, (a + l.len) ** 1.4);
      const [x0, y0] = at(k0, l.u);
      const [x1, y1] = at(k1, l.u);
      ctx.globalAlpha = 0.75 * Math.min(1, a * 5, (1 - a) * 5);
      ctx.strokeStyle = '#CDEFF6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    // Riffles: white arcs across the water where it tumbles over stones, travelling down and breaking up.
    for (let i = 0; i < 6; i++) {
      const a = (t * 0.16 + i / 6) % 1;
      const k = a ** 1.3;
      const [xl, yl] = at(k, 0.08);
      const [xm, ym] = at(k, 0.45);
      const [xr, yr] = at(k, 0.92);
      ctx.globalAlpha = 0.9 * Math.min(1, a * 6, (1 - a) * 4);
      ctx.strokeStyle = '#F6FDFF';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(xl, yl + 2);
      ctx.quadraticCurveTo(xm, ym - 6, xr, yr + 1);
      ctx.stroke();
    }
    // The rush at the end: the water quickens and whitens into the lip of the falls.
    ctx.globalAlpha = 1;
    const [ex0, ey] = at(0.9, 0);
    const [ex1] = at(0.9, 1);
    const rush = ctx.createLinearGradient(0, ey, 0, h);
    rush.addColorStop(0, 'rgba(255,255,255,0)');
    rush.addColorStop(1, 'rgba(230,250,255,0.75)');
    ctx.fillStyle = rush;
    ctx.fillRect(ex0 - 6, ey, ex1 - ex0 + 12, h - ey);
    ctx.restore();
    ctx.globalAlpha = 1;
    this.tex.refresh();
  }
}

/**
 * The near bank in front of the gorge: mounds of grass and mossy boulders that cover its bottom corners,
 * a maple either side, bushes, ferns and reeds at the water's edge, and riffles where the pool spills out.
 */
export const FRONT = { w: 1600, h: 520 };
export function fallsFrontArt(): Art {
  const key = 'bd_a_falls_front';
  const { w, h } = FRONT;
  const p = pen(key);
  const r = rng(907);
  const mid = w / 2;
  // The gorge's foot is 20 above this picture's bottom.
  const foot = h - 20;
  const bank = (x: number) => foot - 4 - 92 * Math.exp(-(((Math.abs(x - mid) - 430) / 150) ** 2)) - (Math.abs(x - mid) > 430 ? 30 : 0) * Math.min(1, (Math.abs(x - mid) - 430) / 200);
  // Maples either side, rooted behind the mounds.
  for (const [tx, pal1, pal2] of [
    [mid - 640, P.red, P.gold],
    [mid + 650, P.rust, P.red],
  ] as const) {
    const base = bank(tx) + 10;
    p.shape(
      [
        [tx - 12, base],
        [tx - 6, base - 200],
        [tx + 8, base - 200],
        [tx + 14, base],
      ],
      { fill: '#5A3E3A', width: 3.5 },
    );
    clump(p, tx - 60, base - 250, 90, 70, pal1, r);
    clump(p, tx + 60, base - 240, 86, 66, pal2, r);
    clump(p, tx, base - 320, 100, 76, pal1, r);
  }
  // The mounds: autumn grass, darker at the foot.
  const xs: number[] = [];
  for (let x = 0; x <= w; x += 12) xs.push(x);
  p.shape([...xs.map((x): Pt => [x, bank(x)]), [w, h], [0, h]], {
    fill: '#C29A4E',
    raw: true,
    width: 3.5,
    wobble: 0.5,
    shade: [{ pts: [...xs.map((x): Pt => [x, bank(x) + 34]), [w, h], [0, h]], color: '#93703A' }],
  });
  // Mossy boulders sitting in the mounds, and bushes beside them.
  for (const [bx, by, bw, bh] of [
    [mid - 410, foot - 70, 170, 120],
    [mid - 520, foot - 40, 140, 90],
    [mid + 400, foot - 74, 180, 124],
    [mid + 520, foot - 36, 130, 84],
    [mid - 250, foot - 10, 90, 50],
    [mid + 250, foot - 6, 100, 54],
  ] as const) {
    const pts = boulder(p, r, bx, by, bw, bh, '#B39886', '#6A5058');
    moss(p, r, pts, by, bh);
  }
  for (const [bx, pal] of [
    [mid - 330, P.gold],
    [mid + 320, P.rust],
    [mid - 760, P.oakDeep],
    [mid + 760, P.gold],
  ] as const) {
    clump(p, bx, bank(bx) + 4, 60, 40, pal, r);
  }
  // Ferns and reeds at the water's edge.
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    const x = mid + side * (180 + r() * 150);
    const y = foot - 2 - r() * 10;
    const tall = 30 + r() * 40;
    p.line(
      [
        [x, y],
        [x + side * 6, y - tall * 0.6],
        [x + side * 14, y - tall],
      ],
      { width: 3, color: r() < 0.5 ? '#7E8A4A' : '#9A8A4A' },
    );
  }
  // Riffles where the pool spills over its pebbly front rim.
  for (let i = 0; i < 7; i++) {
    const x = mid - 120 + i * 40 + r() * 10;
    p.line(
      [
        [x, foot - 8],
        [x + 14, foot - 11],
        [x + 26, foot - 7],
      ],
      { width: 2.5, color: '#F4FCFF', opacity: 0.85 },
    );
  }
  return { key, svg: p.svg(w, h), w, h };
}

/** Kept for the arts list: the live water needs no picture of its own. */
export function fallWaterArt(): Art {
  const key = 'bd_fall_water';
  const p = pen(key);
  p.plain = true;
  p.rect(0, 0, 4, 4, { fill: '#FFFFFF', stroke: null, r: 0 });
  return { key, svg: p.svg(4, 4), w: 4, h: 4 };
}

/** A strand of falling water: where across the sheet it is, and the streaks travelling down it. */
interface Strand {
  u: number;
  width: number;
  color: string;
  alpha: number;
  phases: number[];
  lens: number[];
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
}

/** The live water: all four streams, their foam, spray and the pool's rings, redrawn on one canvas. */
export class FallsWater {
  readonly tex: Phaser.Textures.CanvasTexture;
  private readonly strands: Strand[][];
  private readonly spray: Bit[] = [];
  private readonly flecks: Bit[] = [];
  private last = -1;
  constructor(scene: Phaser.Scene, key: string, private readonly spec: FallSpec = HERO) {
    this.tex = scene.textures.exists(key) ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture) : scene.textures.createCanvas(key, this.spec.canvas.w, this.spec.canvas.h)!;
    const r = rng(311);
    this.strands = this.spec.streams.map((s) => {
      const n = Math.max(6, Math.round((s.r1 - s.l1) / (4.5 * Math.max(0.6, this.spec.scale))));
      const out: Strand[] = [];
      // Across the sheet, plus a few outside it: the frayed edges.
      for (let i = 0; i < n + 4; i++) {
        const u = (i - 2 + r()) / n;
        const edge = u < 0.08 || u > 0.92;
        const k = r();
        const segs = 3 + Math.floor(r() * 3);
        out.push({
          u,
          width: edge ? 1.2 + r() * 1.8 : 1.6 + r() * 3.4,
          // A few dark strands are gaps in the sheet, where the rock shows through.
          color: k < 0.1 && !edge ? '#3F8EA4' : k < 0.25 ? '#7EC4D6' : k < 0.55 ? '#D8F4FA' : '#FFFFFF',
          alpha: edge ? 0.6 : k < 0.1 ? 0.45 : 0.85,
          phases: Array.from({ length: segs }, () => r()),
          lens: Array.from({ length: segs }, () => 0.08 + r() * 0.22),
        });
      }
      return out;
    });
  }

  /** The sheet's edges at a fraction t of the way down, with a ripple travelling down them. */
  private edges(s: Stream, t: number, time: number): [number, number] {
    // The sheet bellies out just under the lip, then spreads steadily.
    const spread = Math.pow(t, 0.6);
    const wob = (seed: number) =>
      (Math.sin(t * 19 - time * 7 + seed) * 3 + Math.sin(t * 43 - time * 13 + seed * 3) * 1.6) * (0.25 + t) + Math.sin(t * 6 - time * 2.2 + seed * 2) * 5 * t;
    const l = s.l0 + (s.l1 - s.l0) * spread + wob(s.seed);
    const rr = s.r0 + (s.r1 - s.r0) * spread - wob(s.seed + 5);
    return [l - this.spec.canvas.x, rr - this.spec.canvas.x];
  }

  draw(time: number, delta: number) {
    if (this.last >= 0 && time - this.last < 33) return;
    const dt = this.last < 0 ? 0.033 : Math.min(0.1, (time - this.last) / 1000);
    this.last = time;
    const tsec = time / 1000;
    const ctx = this.tex.context;
    ctx.clearRect(0, 0, this.spec.canvas.w, this.spec.canvas.h);
    ctx.lineCap = 'round';
    this.spec.streams.forEach((s, si) => this.stream(ctx, s, this.strands[si], tsec, dt));
    this.pool(ctx, tsec, dt);
    this.tex.refresh();
    void delta;
  }

  private stream(ctx: CanvasRenderingContext2D, s: Stream, strands: Strand[], t: number, dt: number) {
    const y0 = s.top - this.spec.canvas.y;
    const y1 = s.bottom - this.spec.canvas.y;
    const H = y1 - y0;
    // The body of the sheet: clear teal at the lip, paling to white as it fills with air.
    ctx.beginPath();
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const [l] = this.edges(s, k, t);
      if (i === 0) ctx.moveTo(l, y0 + k * H);
      else ctx.lineTo(l, y0 + k * H);
    }
    for (let i = steps; i >= 0; i--) {
      const k = i / steps;
      const [, rr] = this.edges(s, k, t);
      ctx.lineTo(rr, y0 + k * H);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, s.lip ? 'rgba(70,170,190,0.95)' : 'rgba(150,215,228,0.85)');
    g.addColorStop(0.18, 'rgba(150,215,228,0.8)');
    g.addColorStop(0.5, 'rgba(214,242,248,0.78)');
    g.addColorStop(1, 'rgba(255,255,255,0.95)');
    ctx.fillStyle = g;
    ctx.fill();
    // Streaks: each accelerates as it falls (its position goes as the square of time) and stretches.
    for (const st of strands) {
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.width;
      st.phases.forEach((ph, i) => {
        const a = (t * s.speed + ph) % 1;
        const b = Math.min(1, a + st.lens[i] * (0.5 + a));
        const ya = a * a;
        const yb = b * b;
        const outside = st.u < 0 || st.u > 1;
        ctx.globalAlpha = st.alpha * (outside ? 0.55 * (1 - ya) : 1) * Math.min(1, a * 6);
        const [la, ra] = this.edges(s, ya, t);
        const [lb, rb] = this.edges(s, yb, t);
        ctx.beginPath();
        if (outside) {
          // Frayed edges break into drops rather than streaks.
          for (let d = 0; d < 3; d++) {
            const yy = ya + (yb - ya) * (d / 3);
            const [l, rr] = this.edges(s, yy, t);
            const x = l + (rr - l) * st.u;
            ctx.moveTo(x, y0 + yy * H);
            ctx.lineTo(x, y0 + yy * H + 3);
          }
        } else {
          ctx.moveTo(la + (ra - la) * st.u, y0 + ya * H);
          ctx.lineTo(lb + (rb - lb) * st.u, y0 + yb * H);
        }
        ctx.stroke();
      });
    }
    ctx.globalAlpha = 1;
    // The lip: water curling over the edge, a bright roll with a shadowed belly just under it.
    if (s.lip) {
      const [l, rr] = this.edges(s, 0, t);
      const mid = (l + rr) / 2;
      ctx.lineWidth = 9;
      ctx.strokeStyle = 'rgba(40,120,140,0.55)';
      ctx.beginPath();
      ctx.moveTo(l + 2, y0 + 14);
      ctx.quadraticCurveTo(mid, y0 + 6, rr - 2, y0 + 14);
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(l - 3, y0 + 4);
      ctx.quadraticCurveTo(mid, y0 - 10, rr + 3, y0 + 4);
      ctx.stroke();
      // Glints running along the roll.
      for (let i = 0; i < 4; i++) {
        const k = ((t * 0.3 + i / 4) % 1) * 0.9 + 0.05;
        const x = l + (rr - l) * k;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.ellipse(x, y0 - 2 - Math.sin(k * Math.PI) * 6, 6, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (s.r0 - s.l0 > 30) {
      // Water pouring off a ledge: a soft white start. (Thin trickles just start from their crack.)
      const [l, rr] = this.edges(s, 0, t);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse((l + rr) / 2, y0 + 2, (rr - l) / 2 + 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Spray hiding the bottom third: the sheet whitens into mist.
    const [lb, rb] = this.edges(s, 1, t);
    const mw = (rb - lb) * 0.9 + 30;
    const mg = ctx.createLinearGradient(0, y1 - H * 0.35, 0, y1);
    mg.addColorStop(0, 'rgba(255,255,255,0)');
    mg.addColorStop(1, 'rgba(255,255,255,0.75)');
    ctx.fillStyle = mg;
    ctx.fillRect((lb + rb) / 2 - mw / 2, y1 - H * 0.35, mw, H * 0.35);
    // The billowing foam at the impact: puffs that swell and settle, shaded underneath.
    const thin = s.r1 - s.l1 < 40;
    // Smaller, busier foam on the ledge, so it reads as spray rather than a cloud.
    const puffs = thin ? 3 : s.lip ? 11 : 8;
    const big = s.lip ? 0.6 : 1;
    for (let i = 0; i < puffs; i++) {
      const k = (i + 0.5) / puffs;
      const x = lb - 10 + (rb - lb + 20) * k;
      const swell = Math.sin(t * 2.4 + i * 1.7 + s.seed) * 0.5 + 0.5;
      const rad = ((thin ? 8 : 14) + swell * (thin ? 5 : 9) + Math.sin(k * Math.PI) * (thin ? 4 : 10)) * big * this.spec.scale;
      const y = y1 - rad * 0.4 - swell * 4;
      ctx.fillStyle = 'rgba(190,226,236,0.95)';
      ctx.beginPath();
      ctx.arc(x + 2, y + 3, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.98)';
      ctx.beginPath();
      ctx.arc(x - 1, y, rad * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    // Spray thrown up and out from the impact.
    if (!thin && Math.random() < dt * 40) {
      for (let i = 0; i < 2; i++) {
        this.spray.push({ x: lb + Math.random() * (rb - lb), y: y1 - 10, vx: (Math.random() - 0.5) * 120 * this.spec.scale, vy: (-60 - Math.random() * 90) * this.spec.scale, life: 0, max: 0.6 + Math.random() * 0.6, r: (1.5 + Math.random() * 2.5) * this.spec.scale });
      }
    }
  }

  private pool(ctx: CanvasRenderingContext2D, t: number, dt: number) {
    const px = this.spec.pool.x - this.spec.canvas.x;
    const py = this.spec.pool.y - this.spec.canvas.y;
    // Rings spreading from under the falls, flattened by perspective.
    const sc = this.spec.scale;
    for (const [i0, cx] of this.spec.rings.entries()) {
      const off = i0 / this.spec.rings.length;
      for (let i = 0; i < 3; i++) {
        const k = (t / 1.6 + i / 3 + off) % 1;
        ctx.strokeStyle = `rgba(232,248,255,${0.7 * (1 - k)})`;
        ctx.lineWidth = 2.5 * (1 - k) + 0.5;
        ctx.beginPath();
        ctx.ellipse(cx - this.spec.canvas.x, py - 4, (30 + k * 140) * sc, (6 + k * 22) * sc, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Foam flecks drifting out over the pool, shrinking as they go.
    if (Math.random() < dt * 30) {
      const a = Math.random() * Math.PI;
      this.flecks.push({ x: this.spec.pool.x + (Math.random() - 0.5) * this.spec.pool.rx - this.spec.canvas.x, y: py - 6, vx: Math.cos(a) * (20 + Math.random() * 40) * sc, vy: Math.sin(a) * 6 * sc, life: 0, max: 2 + Math.random() * 2, r: (2 + Math.random() * 4) * sc });
    }
    ctx.fillStyle = '#FFFFFF';
    for (let i = this.flecks.length - 1; i >= 0; i--) {
      const f = this.flecks[i];
      f.life += dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const k = f.life / f.max;
      const inPool = ((f.x - px) / this.spec.pool.rx) ** 2 + ((f.y - py) / this.spec.pool.ry) ** 2 < 0.9;
      if (k >= 1 || !inPool) {
        this.flecks.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 0.85 * (1 - k);
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, f.r * (1 - k * 0.7), f.r * 0.45 * (1 - k * 0.7), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Spray drops arcing up and falling back.
    for (let i = this.spray.length - 1; i >= 0; i--) {
      const b = this.spray[i];
      b.life += dt;
      b.vy += 260 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life >= b.max) {
        this.spray.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 0.9 * (1 - b.life / b.max);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * Places a waterfall: the gorge standing at world x (its middle) with its foot at `bottom`, on a layer
 * with scroll factor `sf`. Returns the frame update.
 */
export function placeFalls(scene: Phaser.Scene, x: number, bottom: number, sf: number, depth: number) {
  const left = x - GORGE.w / 2;
  const top = bottom - GORGE.h;
  const at = (gx: number, gy: number): [number, number] => [left + gx, top + gy];
  const objs: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T) => (objs.push(o), (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(sf, 1), o);
  // The hillside behind, the gorge set into it, and later the near bank in front.
  keep(scene.add.image(x, bottom, 'bd_a_falls_set').setOrigin(0.5, 1).setDepth(depth - 0.05));
  const river = new LiveRiver(scene, `falls_river_${Math.round(x)}`);
  river.draw(0);
  keep(scene.add.image(x - SET.w / 2 + river.box.x, bottom - SET.h + river.box.y, river.tex.key).setOrigin(0, 0).setDepth(depth - 0.04));
  keep(scene.add.image(x, bottom, 'bd_a_gorge').setOrigin(0.5, 1).setDepth(depth));
  const water = new FallsWater(scene, `falls_live_${Math.round(x)}`);
  water.draw(0, 16);
  const [cx, cy] = at(CANVAS.x, CANVAS.y);
  keep(scene.add.image(cx, cy, water.tex.key).setOrigin(0, 0).setDepth(depth + 0.1));
  // A soft cloud of mist over the pool, and wisps rising off it.
  const [mx, my] = at(POOL.x, POOL.y - 40);
  const mist = keep(scene.add.image(mx, my, 'halo').setDepth(depth + 0.3).setDisplaySize(560, 200).setTint(0xf4fbff).setAlpha(0.3));
  keep(
    scene.add
      .particles(mx, my + 10, 'halo', {
        lifespan: 3000,
        x: { min: -140, max: 140 },
        speedX: { min: -20, max: 20 },
        speedY: { min: -30, max: -8 },
        scale: { start: 0.3, end: 1.2 },
        alpha: { start: 0.28, end: 0 },
        tint: 0xffffff,
        frequency: 60,
      })
      .setDepth(depth + 0.3),
  );
  keep(scene.add.image(x, bottom + 20, 'bd_a_falls_front').setOrigin(0.5, 1).setDepth(depth + 0.35));
  // A faint rainbow in the spray, catching the low sun.
  const bow = keep(scene.add.graphics().setDepth(depth + 0.25).setAlpha(0.16));
  [0xff6a6a, 0xffd06a, 0x8aff8a, 0x6ab0ff].forEach((c, i) => bow.lineStyle(6, c, 1).beginPath().arc(mx + 60, my + 120, 170 - i * 7, Math.PI * 1.15, Math.PI * 1.75).strokePath());
  return {
    objs,
    update(time: number, delta: number, scrollX?: number) {
      // Only redraw the water while it is on screen.
      if (scrollX !== undefined) {
        const sx = x - scrollX * sf;
        if (sx < -GORGE.w || sx > 1920 + GORGE.w) return;
      }
      water.draw(time, delta);
      river.draw(time);
      mist.setAlpha(0.26 + Math.sin(time / 1500) * 0.08);
      bow.setAlpha(0.12 + Math.sin(time / 2700) * 0.05);
    },
  };
}
