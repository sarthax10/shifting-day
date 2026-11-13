import Phaser from 'phaser';
import { pen, type Art } from './art';
import { C, mix, type Pt } from './ink';
import { TILE, birdArts, buildBackdrop, cloudBankArt, haze, peaks, plainPen, rnd, wave } from './backdrop';
import type { BiomeKey } from './legs';
import { FallsWater, fallWaterArt, fallsFrontArt, fallsSetArt, gorgeArt, placeFalls, type FallSpec } from './falls';
import { SWITCH, TUNNEL } from './tunnel';
import { BILLBOARDS, LAKE_CABINS, MEGA_BEACONS, RAIL_DECK, cityArt, frostForestArt, frostLakeArt, frostPeaksArt, megaArt, railArt, snowNearArt, trainArt, wetStreetArt } from './night';

/**
 * The look of each leg's world. Every biome follows the same rules (see docs/JOURNEY.md):
 * five or more layers, each further one closer to the sky's colour; one hero light; something
 * moving at every depth; its own foreground and roadside; and the road itself in its colours.
 */

export interface Built {
  /** Called every frame with the camera's scroll, for weather and anything animated by hand. */
  update(time: number, delta: number, scrollX: number): void;
}

export interface Biome {
  key: BiomeKey;
  /** Sky gradient stops, top to bottom. */
  sky: [number, string][];
  /** Colours in the ground art to swap for this biome's (soil, road surface, ruts and gravel). */
  ground: Record<string, string>;
  /** Colours in the foreground grass strip to swap. */
  grass: Record<string, string>;
  /** How well the brakes grip: 1 is dry tarmac, ice is much less. */
  grip: number;
  /** Street lamps lit along the road. */
  lamps: boolean;
  /** Pictures this biome needs, loaded before its leg starts. */
  arts(): Art[];
  /** Lays the sky, the scenery behind the road, the weather and the roadside. */
  build(scene: Phaser.Scene, o: { reach: number; horizon: number; groundY: (x: number) => number; finish: number; busy?: number[]; range?: [number, number] }): Built;
}

// ---------------------------------------------------------------- Shared helpers

/** The stretch of road a biome's roadside props cover (all of it, unless the leg is blending two biomes). */
const from = (o: { range?: [number, number] }) => o.range?.[0] ?? -Infinity;
const to = (o: { range?: [number, number] }) => o.range?.[1] ?? Infinity;

/** Where a leg's world changes from the last biome into its own: a smooth ramp over this stretch of road. */
export const BLEND = { from: TUNNEL.from, to: TUNNEL.to };
/** Which biome is showing at x: the last one before the switch inside the tunnel, this one after. */
export const blendAt = (x: number) => (x < SWITCH ? 0 : 1);
export const smoothBlendAt = (x: number) => {
  const t = Math.min(1, Math.max(0, (x - BLEND.from) / (BLEND.to - BLEND.from)));
  return t * t * (3 - 2 * t);
};

/** A layer that tiles every TILE pixels, laid across the whole road at a scroll factor. */
function tiles(scene: Phaser.Scene, key: string, bottom: number, sf: number, depth: number, reach: number, offset = 0) {
  const n = Math.ceil((1920 + reach * sf) / TILE) + 1;
  const out: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < n; i++) out.push(scene.add.image(i * TILE + offset, bottom, key).setOrigin(0, 1).setScrollFactor(sf, 1).setDepth(depth));
  return out;
}

/** The sky as a gradient texture, made once per biome. */
function skyTexture(scene: Phaser.Scene, key: string, stops: [number, string][]) {
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, 8, 540)!;
  const g = t.context.createLinearGradient(0, 0, 0, 540);
  for (const [at, c] of stops) g.addColorStop(at, c);
  t.context.fillStyle = g;
  t.context.fillRect(0, 0, 8, 540);
  t.refresh();
  return key;
}

/** A drifting band of fog: a long soft strip that tiles sideways and slides slowly. */
function fogTexture(scene: Phaser.Scene, key: string, colour: string) {
  if (scene.textures.exists(key)) return key;
  const w = 1024;
  const h = 220;
  const t = scene.textures.createCanvas(key, w, h)!;
  const ctx = t.context;
  for (let i = 0; i < 60; i++) {
    const x = (i / 60) * w + Math.sin(i * 7.3) * 30;
    const y = h / 2 + Math.sin(i * 2.1) * 30;
    const r = 60 + Math.abs(Math.sin(i * 3.7)) * 70;
    for (const dx of [-w, 0, w]) {
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      g.addColorStop(0, colour + '55');
      g.addColorStop(1, colour + '00');
      ctx.fillStyle = g;
      ctx.fillRect(x + dx - r, y - r, r * 2, r * 2);
    }
  }
  t.refresh();
  return key;
}

function fogBand(scene: Phaser.Scene, key: string, y: number, sf: number, depth: number, alpha: number, scaleY = 1) {
  return scene.add.tileSprite(0, y, 1920 / Math.max(0.2, 1), 220, key).setOrigin(0, 0.5).setScrollFactor(0).setDepth(depth).setAlpha(alpha).setScale(1, scaleY).setData('sf', sf);
}

/** Particles falling across the screen: snow, rain or leaves, in screen space with their own drift. */
interface Fall {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  spin: number;
  sway: number;
  t: number;
}
function fallers(scene: Phaser.Scene, key: string, n: number, depth: number, make: (f: Fall, i: number) => void) {
  const out: Fall[] = [];
  for (let i = 0; i < n; i++) {
    const f: Fall = { img: scene.add.image(Math.random() * 1920, Math.random() * 1080, key).setScrollFactor(0).setDepth(depth), vx: 0, vy: 1, spin: 0, sway: 0, t: Math.random() * 10 };
    make(f, i);
    out.push(f);
  }
  return out;
}
function stepFallers(list: Fall[], dt: number, panX: number) {
  for (const f of list) {
    f.t += dt;
    f.img.x += (f.vx + Math.sin(f.t * 1.3) * f.sway) * dt * 60 - panX;
    f.img.y += f.vy * dt * 60;
    f.img.rotation += f.spin * dt;
    if (f.img.y > 1100) {
      f.img.y = -20;
      f.img.x = Math.random() * 2100 - 90;
    }
    if (f.img.x < -100) f.img.x += 2100;
    if (f.img.x > 2000) f.img.x -= 2100;
  }
}

/** Soft light shafts slanting down through the trees, breathing slowly. */
function lightShafts(scene: Phaser.Scene, n: number, colour: number, depth: number) {
  if (!scene.textures.exists('shaft')) {
    const t = scene.textures.createCanvas('shaft', 128, 512)!;
    const g = t.context.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    t.context.fillStyle = g;
    t.context.fillRect(0, 0, 128, 512);
    const v = t.context.createLinearGradient(0, 0, 0, 512);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.2, 'rgba(0,0,0,1)');
    v.addColorStop(1, 'rgba(0,0,0,0)');
    t.context.globalCompositeOperation = 'destination-in';
    t.context.fillStyle = v;
    t.context.fillRect(0, 0, 128, 512);
    t.refresh();
  }
  const out: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      scene.add
        .image(200 + i * 420, 360, 'shaft')
        .setScrollFactor(0.15, 0)
        .setDepth(depth)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(colour)
        .setAlpha(0.35)
        .setScale(1.4 + (i % 3) * 0.5, 2.2)
        .setRotation(-0.38),
    );
  }
  return out;
}

/** A small inked roadside picture. */
function inked(key: string, w: number, h: number, draw: (p: ReturnType<typeof pen>) => void): Art {
  const p = pen(key);
  draw(p);
  return { key, svg: p.svg(w, h), w, h };
}

// ======================================================================== AUTUMN: Maple Valley

/** Far blue hills behind the valley, soft with morning haze. */
function autumnFarArt(): Art {
  const key = 'bd_a_far';
  const h = 560;
  const p = plainPen(key);
  const ridge = peaks(31, [120, 50, 30, 16]);
  const top: Pt[] = [];
  for (let x = 0; x <= TILE; x += 12) top.push([x, h - 200 - ridge(x)]);
  p.shape([...top, [TILE, h], [0, h]], { fill: '#A9B7CF', stroke: null, raw: true, wobble: 0.2 });
  for (let x = 24; x < TILE - 24; x += 12) {
    const a = ridge(x - 12);
    const b = ridge(x + 12);
    if (b < a - 3) p.shape([[x, h - 200 - ridge(x)], [x + 12, h - 200 - b], [x + 30, h - 60], [x + 6, h - 60]], { fill: '#97A6C2', stroke: null, raw: true, wobble: 0.2, opacity: 0.7 });
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 1.4 };
}

/**
 * A forest seen from afar, drawn the way painters and stylised games do it: not tree by tree but as one
 * mass with a scalloped top where the crowns meet the sky. Each crown is a bump in the silhouette, with a
 * lit cap on its sunny side (the light is from the upper left) and shadow pooled in the dips between
 * crowns, where one meets the next. Crowns change colour patch by patch, as autumn woods do. The bumps
 * are laid across exactly one tile and drawn again either side of it, so copies join without a seam.
 * `haze` mixes every colour towards the sky: far forests are paler and closer to the sky's colour.
 */
function canopyBand(p: ReturnType<typeof plainPen>, opts: { at: (x: number) => number; bottom: number; size: number; hues: string[]; base?: string; seed: number; haze: [string, number]; skip?: (x: number) => boolean; rows?: number }) {
  const { at, bottom, size, hues, seed } = opts;
  const [sky, k] = opts.haze;
  const tone = (c: string, toward: string, by: number) => mix(mix(c, toward, by), sky, k);
  for (let row = 0; row < (opts.rows ?? 2); row++) {
    // The bumps: widths chosen at random, then scaled so they exactly fill the tile.
    const widths: number[] = [];
    for (let i = 0, x = 0; x < TILE; i++) {
      const w = size * (0.7 + rnd(seed + row * 17, i) * 0.7);
      widths.push(w);
      x += w;
    }
    const scale = TILE / widths.reduce((a, b) => a + b, 0);
    const drop = row * size * 0.55;
    const crowns: { cx: number; w: number; bh: number; hue: string; base: number }[] = [];
    let x = (row * size) / 2;
    widths.forEach((w0, i) => {
      const w = w0 * scale;
      const cx = x + w / 2;
      x += w;
      crowns.push({ cx, w, bh: w * (0.3 + rnd(seed + 9 + row, i) * 0.16), hue: hues[Math.floor(rnd(seed + 5 + row, i) * hues.length)], base: at(cx) + drop });
    });
    const shown = crowns.filter((c) => !opts.skip?.(c.cx));
    for (const shift of [-TILE, 0, TILE]) {
      // The mass: one shape whose top is the row of crowns, side by side, so the woods read as a whole.
      // Gaps (where `skip` says) break it into separate runs.
      let run: Pt[] = [];
      const flush = () => {
        if (run.length > 2) p.shape([...run, [run[run.length - 1][0], bottom], [run[0][0], bottom]], { fill: tone(opts.base ?? hues[0], '#3A2030', 0.25 + row * 0.08), stroke: null, raw: true, wobble: 0.4 });
        run = [];
      };
      for (const c of crowns) {
        if (opts.skip?.(c.cx)) {
          flush();
          continue;
        }
        for (let a = 0; a <= 6; a++) {
          const t = Math.PI + (a / 6) * Math.PI;
          run.push([c.cx + shift + (Math.cos(t) * c.w) / 2, c.base + Math.sin(t) * c.bh]);
        }
      }
      flush();
      // Each crown's own colour on its upper part, a lit cap towards the sun, and shadow where it meets the next.
      for (const c of shown) {
        const bx = c.cx + shift;
        if (bx < -c.w || bx > TILE + c.w) continue;
        const pts: Pt[] = [];
        for (let a = 0; a <= 8; a++) {
          const t = Math.PI + (a / 8) * Math.PI;
          pts.push([bx + (Math.cos(t) * c.w) / 2, c.base + Math.sin(t) * c.bh]);
        }
        pts.push([bx + c.w * 0.4, c.base + c.bh * 0.35], [bx - c.w * 0.4, c.base + c.bh * 0.35]);
        p.shape(pts, { fill: tone(c.hue, '#000000', row * 0.06), stroke: null, raw: true, wobble: 0.5 });
        p.ellipse(bx - c.w * 0.12, c.base - c.bh * 0.55, c.w * 0.26, c.bh * 0.32, { fill: tone(c.hue, '#FFF2C8', 0.34), stroke: null, wobble: 0.6 });
        p.ellipse(bx + c.w * 0.48, c.base + c.bh * 0.15, c.w * 0.16, c.bh * 0.42, { fill: tone(c.hue, '#3A2030', 0.45), stroke: null, wobble: 0.6, opacity: 0.85 });
      }
    }
  }
}

/** Rounded hills covered in autumn woods, paled and cooled by the distance. */
function autumnRidgeArt(): Art {
  const key = 'bd_a_ridge';
  const h = 520;
  const p = plainPen(key);
  const hill = wave(37, [80, 34, 18]);
  const at = (x: number) => h - 250 - hill(x);
  const top: Pt[] = [];
  for (let x = 0; x <= TILE; x += 16) top.push([x, at(x)]);
  p.shape([...top, [TILE, h], [0, h]], { fill: mix('#B9806A', '#C9D6E6', 0.35), stroke: null, raw: true, wobble: 0.2 });
  canopyBand(p, { at, bottom: h, size: 54, hues: ['#E2925E', '#D47452', '#EAB866', '#C9604E', '#D99A5A', '#8E9A5A'], base: '#C9785A', seed: 61, haze: ['#C9D6E6', 0.38], rows: 3 });
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 0.6 };
}

/**
 * The valley itself: mossy cliffs either side of a gorge, a waterfall pouring into a pool, a stone
 * arch bridge across the river, and maples blazing orange, red and gold along the banks.
 * The waterfall's moving water is a separate strip, laid over the gap left for it.
 */
export const FALLS = { x: 1180, top: 120, bottom: 360, w: 90 };
function autumnValleyArt(): Art {
  const key = 'bd_a_valley';
  const h = 520;
  const p = plainPen(key);
  const hill = wave(41, [60, 30, 14]);
  const at = (x: number) => h - 260 - hill(x) - (Math.abs(x - FALLS.x) < 260 ? 90 * Math.cos(((x - FALLS.x) / 260) * (Math.PI / 2)) : 0);
  const top: Pt[] = [];
  for (let x = 0; x <= TILE; x += 12) top.push([x, at(x)]);
  p.shape([...top, [TILE, h], [0, h]], { fill: '#8E7C72', stroke: null, raw: true, wobble: 0.3 });
  // Cliff strata and moss.
  for (let k = 1; k < 6; k++) p.line(top.map(([x, y]) => [x, y + 28 * k + Math.sin(x / 70 + k) * 5] as Pt), { width: 2.5, color: '#7A6A62', raw: true, opacity: 0.5, wobble: 0 });
  for (let x = 10; x < TILE; x += 22) p.ellipse(x, at(x) + 4, 16, 6, { fill: '#7E9A5E', stroke: null, wobble: 0.5, opacity: 0.9 });
  // The river along the bottom: it winds, widens and narrows, with a sandy shore on the near side, a deep
  // channel down the middle, and the blazing trees on its far bank reflected in it. (Every wave has a whole
  // number of turns across the tile, so copies meet seamlessly.)
  const turn = (x: number, k: number, ph = 0) => Math.sin((x / TILE) * Math.PI * 2 * k + ph);
  const far = (x: number) => h - 74 + turn(x, 5) * 7 + turn(x, 13, 1) * 3;
  const near = (x: number) => h - 26 + turn(x, 4, 2) * 6 + turn(x, 11) * 2;
  const xs: number[] = [];
  for (let x = 0; x <= TILE; x += 12) xs.push(x);
  p.shape([...xs.map((x): Pt => [x, near(x) - 4]), [TILE, h], [0, h]], { fill: '#D8C4A2', stroke: null, raw: true, wobble: 0.2 });
  p.shape([...xs.map((x): Pt => [x, far(x)]), ...xs.slice().reverse().map((x): Pt => [x, near(x)])], { fill: '#86BCCC', stroke: null, raw: true, wobble: 0.2 });
  p.shape([...xs.map((x): Pt => [x, (far(x) * 2 + near(x)) / 3]), ...xs.slice().reverse().map((x): Pt => [x, (far(x) + near(x) * 2) / 3])], { fill: '#6CA4BA', stroke: null, raw: true, wobble: 0.2, opacity: 0.8 });
  // Pebbles along the shore.
  for (let i = 0, x = 6; x < TILE; i++, x += 18 + rnd(91, i) * 40) p.ellipse(x, near(x) + 4, 5 + rnd(93, i) * 6, 3, { fill: rnd(95, i) < 0.5 ? '#B8A68A' : '#C9B9A0', stroke: null });
  // The pool the falls drop into: deep and dark under the falls, paler at its rim.
  p.ellipse(FALLS.x, h - 60, 140, 26, { fill: '#5E9AB0', stroke: null, wobble: 0.5 });
  p.ellipse(FALLS.x, h - 54, 110, 16, { fill: '#7FB6C8', stroke: null, wobble: 0.5 });
  // The notch the water has cut into the cliff: dark and wet behind the falls, with a lip at the top.
  p.shape(
    [
      [FALLS.x - 50, FALLS.top + 6],
      [FALLS.x + 50, FALLS.top + 4],
      [FALLS.x + 96, h - 70],
      [FALLS.x - 96, h - 66],
    ],
    { fill: '#4A3E46', stroke: null, raw: true, wobble: 0.6 },
  );
  for (let i = 0; i < 6; i++) p.line([[FALLS.x - 60 + i * 24, FALLS.top + 20], [FALLS.x - 64 + i * 25, h - 80]], { width: 2, color: '#62586A', raw: true, opacity: 0.6, wobble: 0.4 });
  p.shape(
    [
      [FALLS.x - 60, FALLS.top + 4],
      [FALLS.x, FALLS.top - 4],
      [FALLS.x + 60, FALLS.top + 2],
      [FALLS.x + 56, FALLS.top + 18],
      [FALLS.x, FALLS.top + 10],
      [FALLS.x - 56, FALLS.top + 20],
    ],
    { fill: '#5E4E52', stroke: null, wobble: 0.5 },
  );
  // Stone arch bridge.
  const bx = 1750;
  const by = at(bx) + 40;
  p.shape([[bx - 200, by], [bx + 200, by], [bx + 200, by + 26], [bx - 200, by + 26]], { fill: '#B8A898', stroke: null, raw: true });
  for (const ax of [bx - 110, bx + 110]) p.ellipse(ax, by + 90, 80, 70, { fill: '#8E7C72', stroke: null, wobble: 0.3 });
  for (let x = bx - 196; x < bx + 196; x += 22) p.rect(x, by - 12, 14, 12, { fill: '#C9B9A8', stroke: null, r: 2 });
  // Maples: clusters of round canopies on the banks and the cliff tops, in blazing colour.
  const blaze = ['#E8743E', '#F2A23A', '#D8463A', '#F2C45A', '#C9502E', '#EE8A44'];
  // Woods along the cliff tops: one canopy mass, nearer and so richer than the ridge behind, broken where
  // the falls come over.
  canopyBand(p, { at: (x) => at(x) + 10, bottom: h - 140, size: 46, hues: blaze, base: '#B8462E', seed: 71, haze: ['#F4DCC6', 0.12], skip: (x) => Math.abs(x - FALLS.x) < 90, rows: 2 });
  // Their colours, broken and wavering, reflected in the river.
  for (let i = 0, x = 20; x < TILE; i++, x += 60 + rnd(73, i) * 50) {
    if (Math.abs(x - FALLS.x) < 160) continue;
    for (let k = 0; k < 3; k++) p.line([[x - 14 + k * 14, far(x) + 4 + k * 3], [x - 14 + k * 14, far(x) + 18 + k * 4]], { width: 6, color: blaze[(i + k) % blaze.length], raw: true, opacity: 0.3, wobble: 0.6 });
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 0.3 };
}

/** The valley falls, for the live water: one sheet rolling over the notch's lip into the pool. */
const VALLEY_FALLS: FallSpec = {
  canvas: { x: FALLS.x - 120, y: FALLS.top - 16, w: 240, h: 520 - 40 - (FALLS.top - 16) },
  streams: [{ top: FALLS.top + 8, bottom: 520 - 62, l0: FALLS.x - 40, r0: FALLS.x + 40, l1: FALLS.x - 84, r1: FALLS.x + 84, speed: 0.8, seed: 7, lip: true }],
  pool: { x: FALLS.x, y: 520 - 58, rx: 120, ry: 18 },
  rings: [FALLS.x - 24, FALLS.x + 26],
  scale: 0.55,
};

/** Glints of light drifting down the river: short white dashes inside the band the river always covers. */
function riverGlintArt(): Art {
  const key = 'bd_a_glint';
  const h = 40;
  const p = plainPen(key);
  for (let i = 0, x = 4; x < TILE - 40; i++, x += 30 + rnd(97, i) * 60) {
    const y = 4 + rnd(99, i) * 30;
    p.line([[x, y], [x + 10 + rnd(101, i) * 26, y]], { width: 2 + rnd(103, i) * 2, color: '#F4FCFF', raw: true, opacity: 0.85, wobble: 0 });
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h };
}


/** A roadside maple, inked like the rest of the near world. */
function mapleArt(n: number): Art {
  const colours = [
    ['#E8743E', '#C9502E', '#F2A23A'],
    ['#F2C45A', '#E8A23A', '#F7D97A'],
    ['#D8463A', '#B83A34', '#EE6A4D'],
  ][n];
  return inked(`maple_${n}`, 260, 360, (p) => {
    p.shape([[120, 360], [126, 220], [116, 180], [130, 176], [142, 220], [138, 360]], { fill: '#6A4A42', width: 4 });
    p.line([[130, 240], [90, 200]], { width: 6, color: '#6A4A42' });
    p.line([[132, 230], [176, 196]], { width: 6, color: '#6A4A42' });
    const blobs: [number, number, number][] = [[130, 120, 90], [70, 170, 64], [190, 168, 66], [100, 80, 60], [168, 86, 58], [130, 190, 60]];
    blobs.forEach(([x, y, r], i) => p.ellipse(x, y, r, r * 0.86, { fill: colours[i % 3], width: 4 }));
    for (let i = 0; i < 18; i++) p.dot(40 + rnd(81 + n, i) * 180, 40 + rnd(83 + n, i) * 170, 5, colours[2]);
  });
}

function birchArt(): Art {
  return inked('birch', 120, 380, (p) => {
    p.rect(50, 60, 18, 320, { fill: '#F2EEE6', width: 4, r: 6 });
    for (let y = 90; y < 370; y += 34) p.line([[52, y], [62, y + 4]], { width: 3, color: C.ink, raw: true });
    for (const [x, y, r] of [[60, 70, 40], [30, 110, 30], [92, 104, 32], [60, 40, 30]] as const) p.ellipse(x, y, r, r * 0.9, { fill: '#F2C45A', width: 3.5 });
  });
}

const AUTUMN: Biome = {
  key: 'autumn',
  sky: [
    [0, '#8FB6D8'],
    [0.42, '#C9D6E6'],
    [0.72, '#F4DCC6'],
    [1, '#FBE6D0'],
  ],
  ground: { '#C47F58': '#9A6A4E', '#9C5C48': '#7A5040', '#5E3A44': '#4A3238', '#EDB27D': '#C9A988', '#F8CC97': '#DCC2A2', '#9C5C48 ': '#8A6A50' },
  grass: { '#2F6B55': '#7A5A2E', '#3E8A68': '#B8862E', '#4F9C74': '#C9702E', '#62AE7E': '#D9A84A' },
  grip: 1,
  lamps: false,
  arts: () => [autumnFarArt(), autumnRidgeArt(), autumnValleyArt(), riverGlintArt(), fallsSetArt(), gorgeArt(), fallsFrontArt(), fallWaterArt()],
  build(scene, o) {
    scene.add.image(0, 0, skyTexture(scene, 'sky_autumn', this.sky)).setOrigin(0).setDisplaySize(1920, 1080).setScrollFactor(0).setDepth(-50);
    // A pale morning sun behind the haze.
    scene.add.image(560, 230, 'halo').setScrollFactor(0.03).setDepth(-46).setTint(0xfff1d6).setDisplaySize(620, 620).setAlpha(0.8);
    scene.add.circle(560, 230, 70, 0xfff6e2).setScrollFactor(0.03).setDepth(-45);
    const clouds: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 6; i++) clouds.push(scene.add.image(i * 720 - 300, 140 + ((i * 97) % 160), `bd_cloud_${i % 3}`).setScrollFactor(0.05, 1).setDepth(-44).setTint(0xfff2e6).setAlpha(0.8).setScale(0.9));
    tiles(scene, 'bd_a_far', o.horizon - 260, 0.08, -42, o.reach);
    const fog = fogTexture(scene, 'fog_warm', '#FFF4E6');
    const fogs = [fogBand(scene, fog, o.horizon - 330, 0.1, -41, 0.5, 1.4)];
    tiles(scene, 'bd_a_ridge', o.horizon - 150, 0.18, -38, o.reach);
    fogs.push(fogBand(scene, fog, o.horizon - 210, 0.2, -37, 0.42, 1.2));
    tiles(scene, 'bd_a_valley', o.horizon + 10, 0.36, -34, o.reach, -400);
    // The valley falls in each copy of the valley, all showing one live water picture, with spray at their feet.
    const valleyWater = new FallsWater(scene, 'falls_valley', VALLEY_FALLS);
    valleyWater.draw(0, 16);
    const n = Math.ceil((1920 + o.reach * 0.36) / TILE) + 1;
    const top = o.horizon + 10 - 520;
    for (let i = 0; i < n; i++) {
      const x0 = i * TILE - 400;
      scene.add.image(x0 + VALLEY_FALLS.canvas.x, top + VALLEY_FALLS.canvas.y, 'falls_valley').setOrigin(0, 0).setScrollFactor(0.36, 1).setDepth(-33.5);
      scene.add.particles(x0 + FALLS.x, top + 520 - 66, 'halo', { lifespan: 2000, x: { min: -50, max: 50 }, speedX: { min: -20, max: 20 }, speedY: { min: -30, max: -8 }, scale: { start: 0.15, end: 0.5 }, alpha: { start: 0.3, end: 0 }, tint: 0xffffff, frequency: 110 }).setScrollFactor(0.36, 1).setDepth(-33);
    }
    // Light glinting on the river as it flows, two sets drifting at different speeds.
    const glints = [0, 1].map((k) =>
      scene.add
        .tileSprite(-400, top + 520 - 58, 1920 + o.reach * 0.36 + TILE, 40, 'bd_a_glint')
        .setOrigin(0, 0)
        .setScrollFactor(0.36, 1)
        .setDepth(-33.6)
        .setAlpha(0.7)
        .setFlipX(k === 1),
    );
    fogs.push(fogBand(scene, fog, o.horizon - 60, 0.4, -31, 0.2, 0.9));
    // The hero waterfalls, nearer than the valley, each on a stretch of road of its own.
    const heroes = [5500, 9800].map((x) => placeFalls(scene, x, o.horizon + 60, 0.5, -29.5));
    const shafts = lightShafts(scene, 5, 0xfff0c8, -30);
    haze(scene, o.horizon - 300, 300, 0xfff0e0, 0.06, -29, 0.3);
    // Roadside: maples and birches.
    let seed = 1;
    for (let x = Math.max(1900, from(o)); x < Math.min(o.finish - 300, to(o)); x += 380 + rnd(5, seed) * 420, seed++) {
      const key = rnd(7, seed) < 0.22 ? 'birch' : `maple_${seed % 3}`;
      scene.add.image(x, o.groundY(x) + 8, key).setOrigin(0.5, 1).setDepth(-9).setScale(0.85 + rnd(9, seed) * 0.4).setFlipX(seed % 2 === 0);
    }
    // Leaves: many, in three colours, tumbling across the screen.
    const leaves = fallers(scene, 'bd_leaf', 40, 56, (f, i) => {
      f.vx = -0.6 - Math.random() * 1.2;
      f.vy = 0.8 + Math.random() * 1.2;
      f.spin = (Math.random() - 0.5) * 6;
      f.sway = 1.2 + Math.random();
      f.img.setTint([0xffffff, 0xffc04a, 0xe0503a][i % 3]).setScale(0.7 + Math.random() * 0.8);
    });
    let lastScroll = 0;
    return {
      update(time, delta, scrollX) {
        const dt = delta / 1000;
        valleyWater.draw(time, delta);
        glints.forEach((g, k) => {
          g.tilePositionX = -time * (k ? 0.012 : 0.02) + k * 700;
          g.setAlpha(0.45 + Math.sin(time / (700 + k * 300) + k) * 0.3);
        });
        for (const h of heroes) h.update(time, delta, scrollX);
        for (const c of clouds) c.x += dt * 4;
        for (const fb of fogs) fb.tilePositionX = scrollX * (fb.getData('sf') as number) + time * 0.006;
        shafts.forEach((s, i) => s.setAlpha(0.22 + Math.sin(time / 2400 + i * 1.7) * 0.12));
        stepFallers(leaves, dt, (scrollX - lastScroll) * 0.6);
        lastScroll = scrollX;
      },
    };
  },
};

// ======================================================================== SNOW: Frostpeak Pass

function snowPeaksArt(): Art {
  const key = 'bd_s_peaks';
  const h = 700;
  const p = plainPen(key);
  const ridge = peaks(53, [220, 90, 50, 26]);
  const top: Pt[] = [];
  for (let x = 0; x <= TILE; x += 10) top.push([x, h - 180 - ridge(x)]);
  p.shape([...top, [TILE, h], [0, h]], { fill: '#DCE6F4', stroke: null, raw: true, wobble: 0.2 });
  // Shadowed faces in cold blue, and rock streaks where the snow cannot hold.
  for (let x = 20; x < TILE - 20; x += 10) {
    const a = ridge(x - 10);
    const b = ridge(x + 10);
    if (b < a - 2) p.shape([[x, h - 180 - ridge(x)], [x + 10, h - 180 - b], [x + 40, h - 30], [x + 4, h - 30]], { fill: '#8FA6CC', stroke: null, raw: true, wobble: 0.2, opacity: 0.75 });
  }
  for (let i = 0; i < 60; i++) {
    const x = rnd(55, i) * TILE;
    const y = h - 180 - ridge(x) + 30 + rnd(57, i) * 120;
    p.line([[x, y], [x + 8, y + 40 + rnd(59, i) * 50]], { width: 3, color: '#5E7098', raw: true, opacity: 0.55, wobble: 0.4 });
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 1.1 };
}

/** Slopes of dark pines, every one carrying a cap of snow. */
function snowPinesArt(key: string, h: number, base: string, seed: number, size: number): Art {
  const p = plainPen(key);
  const hill = wave(seed, [70, 30, 16]);
  const at = (x: number) => h - 240 - hill(x);
  const top: Pt[] = [];
  for (let x = 0; x <= TILE; x += 16) top.push([x, at(x)]);
  p.shape([...top, [TILE, h], [0, h]], { fill: '#E6EEF8', stroke: null, raw: true, wobble: 0.2 });
  for (let r = 0; r < 4; r++) {
    for (let i = 0, x = (r * 13) % 21; x < TILE; i++) {
      const y = at(x) + r * 34 + 8;
      const s = size * (0.7 + rnd(seed + r, i) * 0.6);
      const th = 58 * s;
      p.shape([[x, y - th], [x + 15 * s, y + 4], [x - 15 * s, y + 4]], { fill: base, stroke: null, raw: true, wobble: 0.4 });
      p.shape([[x, y - th], [x + 7 * s, y - th * 0.55], [x - 7 * s, y - th * 0.55]], { fill: '#F4F8FF', stroke: null, raw: true, wobble: 0.3 });
      p.line([[x - 12 * s, y - th * 0.25], [x + 12 * s, y - th * 0.25]], { width: 3 * s, color: '#F4F8FF', raw: true, wobble: 0.3 });
      x += 12 + rnd(seed + r + 3, i) * 14;
    }
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: key === 'bd_s_pines_far' ? 1.4 : 0.4 };
}

/** A frozen lake on the valley floor, with a cabin on its shore whose window glows. */
export const CABIN = { x: 900, y: 0 };
function snowLakeArt(): Art {
  const key = 'bd_s_lake';
  const h = 360;
  const p = plainPen(key);
  p.shape([[0, 120], [TILE, 110], [TILE, h], [0, h]], { fill: '#EEF4FC', stroke: null, raw: true, wobble: 0.4 });
  p.shape([[60, 190], [TILE - 60, 184], [TILE - 120, 300], [120, 306]], { fill: '#B8CDE8', stroke: null, raw: true, wobble: 0.8 });
  // Ice: long reflective streaks and a few cracks.
  for (let i = 0; i < 40; i++) {
    const x = 140 + rnd(91, i) * (TILE - 280);
    const y = 200 + rnd(93, i) * 90;
    p.line([[x, y], [x + 60 + rnd(95, i) * 120, y + 2]], { width: 2.5, color: '#E8F2FF', raw: true, opacity: 0.8, wobble: 0 });
  }
  for (let i = 0; i < 6; i++) {
    const x = 300 + i * 360;
    p.line([[x, 220], [x + 24, 236], [x + 12, 252], [x + 40, 270]], { width: 1.6, color: '#8EA8CC', raw: true, opacity: 0.8 });
  }
  // The cabin.
  const cx = CABIN.x;
  p.rect(cx - 60, 110, 120, 70, { fill: '#6A4A42', stroke: null, r: 2 });
  p.shape([[cx - 76, 114], [cx, 60], [cx + 76, 114]], { fill: '#F4F8FF', stroke: null, raw: true });
  p.rect(cx + 30, 70, 14, 30, { fill: '#5A4A4A', stroke: null, r: 1 });
  p.rect(cx - 30, 132, 26, 22, { fill: '#FFD27A', stroke: null, r: 2 });
  p.rect(cx + 10, 132, 26, 22, { fill: '#FFC05A', stroke: null, r: 2 });
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 0.4 };
}

/**
 * The aurora, drawn live: a ribbon whose lower hem folds back and forth across the sky. From every point
 * of the hem a ray rises, bright green at the hem, teal above, fading to violet and then nothing. Where the
 * ribbon folds we look along it edge-on, so the rays there are brighter and longer, as in photographs.
 * A second, fainter violet ribbon hangs higher and further back. The whole thing ripples and shimmers.
 */
class Aurora {
  readonly key: string;
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly strips: HTMLCanvasElement[];
  private readonly seeds: number[];
  private last = -1;
  constructor(scene: Phaser.Scene, key: string, private readonly w = 1024, private readonly h = 340) {
    this.key = key;
    this.tex = scene.textures.exists(key) ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture) : scene.textures.createCanvas(key, w, h)!;
    // One column of colour per ribbon, stretched to each ray's height when drawn.
    const strip = (stops: [number, string][]) => {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 256;
      const g = c.getContext('2d')!;
      const gr = g.createLinearGradient(0, 0, 0, 256);
      for (const [k, col] of stops) gr.addColorStop(k, col);
      g.fillStyle = gr;
      g.fillRect(0, 0, 1, 256);
      return c;
    };
    this.strips = [
      strip([[0, 'rgba(150,90,255,0)'], [0.3, 'rgba(140,100,255,0.35)'], [0.6, 'rgba(60,230,200,0.7)'], [0.86, 'rgba(110,255,160,1)'], [0.95, 'rgba(220,255,220,1)'], [1, 'rgba(255,120,200,0.5)']]),
      strip([[0, 'rgba(190,90,255,0)'], [0.5, 'rgba(170,90,255,0.45)'], [0.9, 'rgba(120,160,255,0.7)'], [1, 'rgba(255,140,220,0.3)']]),
    ];
    this.seeds = Array.from({ length: w }, () => Math.random());
  }
  /** Redraws the ribbons for this moment, about twenty times a second. */
  draw(time: number) {
    if (this.last >= 0 && time - this.last < 50) return;
    this.last = time;
    const t = time / 1000;
    const { w, h } = this;
    const ctx = this.tex.context;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const ribbon = (strip: HTMLCanvasElement, base: number, amp: number, len: number, bright: number, phase: number) => {
      let prev = 0;
      for (let x = 0; x < w; x += 1) {
        const u = x / w;
        // The hem: a long slow S-fold, a shorter fold that travels along it, and a little ripple.
        const y =
          base +
          Math.sin(u * Math.PI * 1.6 + t * 0.1 + phase) * amp +
          Math.sin(u * Math.PI * 4.5 - t * 0.3 + phase * 2) * amp * 0.55 +
          Math.sin(u * Math.PI * 19 + t * 1.1) * amp * 0.05;
        const slope = x === 0 ? 0 : Math.abs(y - prev);
        prev = y;
        // Rays are brighter where the ribbon is seen edge-on, and shimmer in soft bands that run along it.
        const fold = Math.min(1, 0.3 + slope * 1.2);
        const shimmer = 0.7 + 0.3 * Math.sin(u * 40 + t * 2.4 + phase) * Math.sin(u * 11 - t * 0.8);
        // The ribbon thins and breaks in places, so it is not one even band across the whole sky.
        const breaks = Math.max(0, Math.sin(u * Math.PI * 2.4 + t * 0.07 + phase * 3) * 0.6 + 0.55);
        const k = fold * shimmer * breaks * bright * (0.85 + this.seeds[x] * 0.3);
        // Fade the ribbon out at both ends, so the texture has no hard edge.
        const edge = Math.min(1, u * 6, (1 - u) * 6);
        const ray = len * (0.65 + 0.35 * Math.sin(u * 30 + this.seeds[(x + 37) % w]) * 0.5 + 0.35 * fold);
        ctx.globalAlpha = Math.max(0, Math.min(1, k * edge * 0.6));
        ctx.drawImage(strip, x - 1, y - ray, 3, ray + 8);
      }
    };
    ribbon(this.strips[1], h * 0.34, 40, 130, 0.5, 2.1);
    ribbon(this.strips[0], h * 0.55, 70, 190, 1, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.tex.refresh();
  }
}

function snowPineArt(): Art {
  return inked('snowpine', 200, 400, (p) => {
    p.rect(92, 330, 16, 70, { fill: '#5A4040', width: 4, r: 3 });
    for (let t = 0; t < 4; t++) {
      const y = 70 + t * 70;
      const w = 50 + t * 22;
      p.shape([[100, y - 40], [100 + w, y + 60], [100 - w, y + 60]], { fill: '#24405A', width: 4, raw: true });
      p.shape([[100, y - 40], [100 + w * 0.6, y + 22], [100 - w * 0.6, y + 22]], { fill: '#F4F8FF', width: 3, raw: true });
    }
  });
}

/** An orange snow pole: how drivers find the road edge when everything is white. */
function snowPoleArt(): Art {
  return inked('snowpole', 30, 200, (p) => {
    p.rect(10, 10, 10, 190, { fill: '#F2F2F2', width: 3, r: 3 });
    for (let y = 14; y < 120; y += 34) p.rect(10, y, 10, 16, { fill: '#EE6A3D', stroke: null, r: 0 });
  });
}

const SNOW: Biome = {
  key: 'snow',
  sky: [
    [0, '#060E26'],
    [0.4, '#12285A'],
    [0.7, '#2E4C88'],
    [0.88, '#6E7EB8'],
    [1, '#B8A8D0'],
  ],
  ground: { '#C47F58': '#E8EEF6', '#9C5C48': '#B8C6DC', '#5E3A44': '#6A7898', '#B06E50': '#D0DAEA', '#93594A': '#A8B6CE', '#774650': '#7E8CAA', '#EDB27D': '#C9D3E2', '#F8CC97': '#E2E8F2', '#E2A27A': '#FFFFFF' },
  grass: { '#2F6B55': '#DCE6F4', '#3E8A68': '#F4F8FF', '#4F9C74': '#C6D4EA', '#62AE7E': '#FFFFFF' },
  grip: 0.55,
  lamps: true,
  arts: () => [
    frostPeaksArt(true),
    frostPeaksArt(false),
    frostForestArt('bd_s_pines_far', 520, '#2A3E70', '#8EA6D8', 61, 0.8, '#AEBCE0'),
    frostForestArt('bd_s_pines', 560, '#14213E', '#7E96CC', 67, 1.25, '#D6E0F4'),
    frostLakeArt(),
    snowNearArt(),
    snowPoleArt(),
  ],
  build(scene, o) {
    scene.add.image(0, 0, skyTexture(scene, 'sky_snow', this.sky)).setOrigin(0).setDisplaySize(1920, 1080).setScrollFactor(0).setDepth(-50);
    // Stars, twinkling.
    const stars: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 120; i++) stars.push(scene.add.image(Math.random() * 1920, Math.random() * 420, 'halo').setScrollFactor(0).setDepth(-49).setDisplaySize(6, 6).setTint(0xeaf2ff).setAlpha(0.4 + Math.random() * 0.6));
    // The aurora: a live ribbon across the whole sky, and its reflection in the frozen lake.
    const aurora = new Aurora(scene, 'aurora_live');
    aurora.draw(0);
    scene.add.image(960, -40, aurora.key).setOrigin(0.5, 0).setScrollFactor(0.02, 0).setDepth(-47).setDisplaySize(2400, 760).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.95);
    const glow = scene.add.image(960, 420, 'halo').setScrollFactor(0.02, 0).setDepth(-48).setDisplaySize(2600, 700).setTint(0x40c090).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);
    scene.add.circle(1620, 170, 34, 0xf4f6ff).setScrollFactor(0.02, 0).setDepth(-46);
    scene.add.image(1620, 170, 'halo').setScrollFactor(0.02, 0).setDepth(-46).setDisplaySize(260, 260).setTint(0xb8c8ff).setAlpha(0.5);
    // Two ranges of peaks: the far one paler and hazier.
    tiles(scene, 'bd_s_peaks_far', o.horizon - 150, 0.05, -43, o.reach, -700);
    const fog = fogTexture(scene, 'fog_cold', '#A8B8E0');
    const fogs = [fogBand(scene, fog, o.horizon - 300, 0.07, -42.5, 0.35, 1.3)];
    tiles(scene, 'bd_s_peaks', o.horizon - 60, 0.09, -42, o.reach);
    fogs.push(fogBand(scene, fog, o.horizon - 200, 0.13, -39, 0.35, 1.1));
    tiles(scene, 'bd_s_pines_far', o.horizon - 120, 0.18, -38, o.reach);
    tiles(scene, 'bd_s_pines', o.horizon - 30, 0.24, -37, o.reach, -900);
    tiles(scene, 'bd_s_lake', o.horizon + 40, 0.32, -36, o.reach, -300);
    // The cabins' windows glow in each copy of the lake; the moon shines in the ice.
    const n = Math.ceil((1920 + o.reach * 0.32) / TILE) + 1;
    for (let i = 0; i < n; i++) for (const cx of LAKE_CABINS) scene.add.image(i * TILE - 300 + cx, o.horizon + 40 - 380 + 110, 'halo').setScrollFactor(0.32, 1).setDepth(-35).setDisplaySize(130, 90).setTint(0xffc060).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD);
    const moonGlint = scene.add.image(1620, o.horizon + 40 - 380 + 230, 'halo').setScrollFactor(0.02, 1).setDepth(-35.5).setDisplaySize(70, 150).setTint(0xdfe8ff).setAlpha(0.4).setBlendMode(Phaser.BlendModes.ADD);
    haze(scene, o.horizon - 260, 260, 0x8ea0d8, 0.12, -30, 0.3);
    // Roadside: snowy pines and orange snow poles marking the road edge.
    let seed = 3;
    for (let x = Math.max(1900, from(o)); x < Math.min(o.finish - 300, to(o)); x += 420 + rnd(11, seed) * 380, seed++) scene.add.image(x, o.groundY(x) + 8, 'snowpine').setOrigin(0.5, 1).setDepth(-9).setScale(0.8 + rnd(13, seed) * 0.5).setFlipX(seed % 2 === 0);
    for (let x = Math.max(1700, from(o)); x < Math.min(o.finish, to(o)); x += 600) scene.add.image(x, o.groundY(x) + 10, 'snowpole').setOrigin(0.5, 1).setDepth(-6);
    // Snow: big soft flakes close by, fine ones far off, drifting in the wind.
    const near = fallers(scene, 'halo', 90, 57, (f) => {
      f.vx = -0.8 - Math.random() * 0.6;
      f.vy = 1.4 + Math.random() * 1.2;
      f.sway = 0.8;
      f.img.setDisplaySize(14, 14).setTint(0xffffff).setAlpha(0.9);
    });
    const far = fallers(scene, 'halo', 160, -28, (f) => {
      f.vx = -0.4 - Math.random() * 0.3;
      f.vy = 0.5 + Math.random() * 0.6;
      f.sway = 0.4;
      f.img.setDisplaySize(6, 6).setTint(0xeef4ff).setAlpha(0.8);
    });
    let lastScroll = 0;
    return {
      update(time, delta, scrollX) {
        const dt = delta / 1000;
        aurora.draw(time);
        glow.setAlpha(0.15 + Math.sin(time / 2600) * 0.05);
        moonGlint.setAlpha(0.32 + Math.sin(time / 900) * 0.08);
        stars.forEach((s, i) => i % 6 === 0 && s.setAlpha(0.35 + Math.abs(Math.sin(time / 700 + i)) * 0.65));
        for (const fb of fogs) fb.tilePositionX = scrollX * (fb.getData('sf') as number) + time * 0.01;
        const pan = scrollX - lastScroll;
        stepFallers(near, dt, pan * 0.9);
        stepFallers(far, dt, pan * 0.25);
        lastScroll = scrollX;
      },
    };
  },
};

// ======================================================================== TOWN: Neon Town, rainy night

/** A distant skyline: blocks, a water tower and an antenna, scattered with lit windows. */
function skylineArt(key: string, h: number, base: string, seed: number, tall: number, windows: number): Art {
  const p = plainPen(key);
  let x = 0;
  let i = 0;
  while (x < TILE) {
    const w = 60 + rnd(seed, i) * 110;
    const bh = tall * (0.4 + rnd(seed + 1, i) * 0.6);
    const top = h - bh;
    p.rect(x, top, w, bh + 4, { fill: base, stroke: null, r: 0 });
    if (rnd(seed + 2, i) < 0.25) p.shape([[x + 4, top], [x + w / 2, top - 30], [x + w - 4, top]], { fill: base, stroke: null, raw: true });
    if (rnd(seed + 3, i) < 0.15) p.line([[x + w / 2, top], [x + w / 2, top - 60]], { width: 3, color: base, raw: true });
    for (let wy = top + 14; wy < h - 20; wy += 22) {
      for (let wx = x + 10; wx < x + w - 14; wx += 18) {
        const r = rnd(seed + 4, wx * 7 + wy);
        if (r < windows) p.rect(wx, wy, 9, 12, { fill: r < windows * 0.25 ? '#9FE8FF' : '#FFD27A', stroke: null, r: 1, opacity: 0.85 });
      }
    }
    x += w + 4 + rnd(seed + 5, i) * 20;
    i++;
  }
  // A water tower.
  p.rect(1200, h - tall * 0.9 - 70, 70, 50, { fill: base, stroke: null, r: 8 });
  for (const lx of [1206, 1260]) p.line([[lx, h - tall * 0.9 - 20], [lx, h - tall * 0.5]], { width: 4, color: base, raw: true });
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: key === 'bd_n_far' ? 1 : 0.2 };
}

/** A storefront for the main street, inked, with a sign board (the neon words are added in the game). */
export const SHOPS = [
  { name: 'DINER', colour: '#FF5C8A', wall: '#3A3A5E', awning: '#E84A6A' },
  { name: 'LAUNDRY', colour: '#5CF2FF', wall: '#2E4A5E', awning: '#3FA7B5' },
  { name: 'CINEMA', colour: '#FFC94A', wall: '#4A2E4E', awning: '#C8302C' },
  { name: 'PIZZA', colour: '#7CFF8A', wall: '#3E3A4E', awning: '#2F7F6A' },
  { name: 'HOTEL', colour: '#C79BFF', wall: '#2A2E50', awning: '#7A4B7E' },
];
function shopArt(n: number): Art {
  const s = SHOPS[n];
  const neon = s.colour;
  const glass = mix(neon, '#140E24', 0.55);
  return inked(`shop_${n}`, 420, 460, (p) => {
    // Dark wall panels, street-lit warm at the foot.
    p.rect(20, 80, 380, 380, { fill: '#221C36', width: 5, r: 4, shade: [{ pts: [[0, 330], [420, 330], [420, 470], [0, 470]], color: '#3A2638' }] });
    for (const x of [100, 200, 300]) p.line([[x, 84], [x, 206]], { width: 2, color: '#16122A', raw: true });
    // Upper windows with blinds, some lit.
    for (let k = 0; k < 3; k++) {
      const lit = (n + k) % 3 !== 0;
      const c = lit ? ['#FFD27A', '#9FE8FF', '#FF9AE8'][(n + k) % 3] : '#16122A';
      p.rect(46 + k * 120, 112, 84, 70, { fill: c, width: 4, r: 3 });
      if (lit) for (let y = 120; y < 176; y += 9) p.line([[50 + k * 120, y], [126 + k * 120, y]], { width: 2, color: mix(c, '#000000', 0.35), raw: true, opacity: 0.6 });
    }
    // An AC unit on the wall, and a pipe running down.
    p.rect(330, 186, 54, 30, { fill: '#5A5470', width: 3.5, r: 3 });
    p.ellipse(346, 201, 9, 9, { fill: '#2A2440', width: 2.5 });
    p.line([[30, 90], [30, 456]], { width: 5, color: '#3A3450', raw: true });
    // The sign board, outlined in a neon tube; the shop's name is lit on it in the game.
    p.rect(40, 214, 340, 56, { fill: '#0E0A1C', width: 4, r: 6 });
    p.rect(46, 220, 328, 44, { width: 3, stroke: neon, r: 5 });
    // A metal canopy, with a strip light along its underside.
    p.shape([[24, 282], [396, 282], [404, 304], [16, 304]], { fill: '#3A3450', raw: true, width: 4 });
    p.rect(30, 304, 360, 6, { fill: neon, r: 2, stroke: null });
    // The shop window, glowing in the shop's colour, with shelves and goods inside; a shutter half up.
    p.rect(44, 324, 230, 126, { fill: glass, width: 4, r: 4 });
    for (let y = 334; y < 352; y += 6) p.line([[46, y], [272, y]], { width: 3, color: '#5A5470', raw: true });
    for (const y of [384, 420]) {
      p.line([[52, y], [266, y]], { width: 3, color: mix(neon, '#000000', 0.4), raw: true });
      for (let x = 62; x < 260; x += 26) p.rect(x, y - 16, 16, 14, { fill: mix(neon, '#FFFFFF', 0.3), r: 3, width: 2 });
    }
    // The door, with a lit strip window.
    p.rect(296, 324, 76, 136, { fill: '#2A2440', width: 4, r: 4 });
    p.rect(310, 340, 48, 60, { fill: mix(neon, '#FFFFFF', 0.4), width: 3, r: 3 });
    p.dot(360, 410, 4, '#B9BCCB');
  });
}

const TOWN: Biome = {
  key: 'town',
  sky: [
    [0, '#07051A'],
    [0.4, '#160C38'],
    [0.7, '#3A145A'],
    [0.88, '#8A2A78'],
    [1, '#E04A90'],
  ],
  ground: { '#C47F58': '#2A2838', '#9C5C48': '#222030', '#5E3A44': '#16141E', '#B06E50': '#2E2C3E', '#93594A': '#262434', '#774650': '#1E1C2A', '#EDB27D': '#3A3850', '#F8CC97': '#4C4A64', '#E2A27A': '#5A5874', '#FFE2BC': '#8A8AA8', '#D69A6A': '#4A4860', '#B97E5E': '#3A3850' },
  grass: { '#2F6B55': '#1A1A2E', '#3E8A68': '#262640', '#4F9C74': '#2E2E48', '#62AE7E': '#36365A' },
  grip: 0.8,
  lamps: true,
  arts: () => [megaArt(false), megaArt(true), cityArt('far', false), cityArt('far', true), cityArt('mid', false), cityArt('mid', true), railArt(), trainArt(), wetStreetArt(), ...SHOPS.map((_, i) => shopArt(i))],
  build(scene, o) {
    scene.add.image(0, 0, skyTexture(scene, 'sky_town', this.sky)).setOrigin(0).setDisplaySize(1920, 1080).setScrollFactor(0).setDepth(-50);
    // The city's light thrown up onto the low clouds, magenta at the horizon; lightning now and then.
    const glow = scene.add.image(960, 760, 'halo').setScrollFactor(0).setDepth(-48).setDisplaySize(2800, 760).setTint(0xff3fa0).setAlpha(0.4).setBlendMode(Phaser.BlendModes.ADD);
    const flash = scene.add.rectangle(0, 0, 1920, 1080, 0xdfe6ff, 0).setOrigin(0).setScrollFactor(0).setDepth(-47);
    const clouds: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 6; i++) clouds.push(scene.add.image(i * 720 - 300, 120 + ((i * 97) % 160), `bd_cloud_${i % 3}`).setScrollFactor(0.05, 1).setDepth(-46).setTint(0x5a2a7a).setAlpha(0.8).setScale(1.1));
    // Each lit layer twice: the buildings, then a blurred copy of only their lights, added on top to bloom.
    const layer = (key: string, bottom: number, sf: number, depth: number, offset = 0, bloom = 0.85) => {
      tiles(scene, key, bottom, sf, depth, o.reach, offset);
      for (const g of tiles(scene, `${key}_glow`, bottom, sf, depth + 0.05, o.reach, offset)) g.setBlendMode(Phaser.BlendModes.ADD).setAlpha(bloom);
    };
    // Megatowers on the horizon, with red beacons blinking on their spires.
    layer('bd_n_mega', o.horizon - 180, 0.05, -44, 0, 0.7);
    const beacons: Phaser.GameObjects.Image[] = [];
    const megaN = Math.ceil((1920 + o.reach * 0.05) / TILE) + 1;
    for (let i = 0; i < megaN; i++) for (const [bx, by] of MEGA_BEACONS) beacons.push(scene.add.image(i * TILE + bx, o.horizon - 180 - 1100 + by, 'halo').setScrollFactor(0.05, 1).setDepth(-43.8).setDisplaySize(30, 30).setTint(0xff3030).setBlendMode(Phaser.BlendModes.ADD));
    haze(scene, o.horizon - 520, 420, 0xff3fa0, 0.22, -43, 0.05);
    layer('bd_n_far', o.horizon - 110, 0.12, -42);
    haze(scene, o.horizon - 380, 300, 0x7a2a9a, 0.3, -41, 0.12);
    // Flying cars crossing between the towers, their lights trailing.
    const flyers = [0, 1, 2, 3].map((k) => {
      const body = scene.add.rectangle(0, 0, 34, 10, 0x1a1430).setScrollFactor(0).setDepth(-40.5);
      const lamp = scene.add.image(0, 0, 'halo').setScrollFactor(0).setDepth(-40.4).setDisplaySize(26, 16).setTint(k % 2 ? 0x3ff2ff : 0xffb43f).setBlendMode(Phaser.BlendModes.ADD);
      const trail = scene.add.image(0, 0, 'halo').setScrollFactor(0).setDepth(-40.45).setDisplaySize(160, 8).setTint(k % 2 ? 0x3ff2ff : 0xff3fd0).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
      return { body, lamp, trail, y: 160 + k * 90, speed: (0.05 + k * 0.02) * (k % 2 ? 1 : -1), off: k * 700 };
    });
    layer('bd_n_mid', o.horizon - 20, 0.25, -38, -500);
    // Holographic billboards on the big mid buildings: glowing panels whose slogans change with a glitch.
    const words = ['NOODLE BAR', 'MOVE FAST', 'SLEEP: OPTIONAL', 'ROPES 2 FOR 1', 'BOX CO.', 'NEON HOTEL', 'TRUCKS R US', 'PIE?'];
    const boards: { text: Phaser.GameObjects.Text; panel: Phaser.GameObjects.Rectangle; halo: Phaser.GameObjects.Image; n: number }[] = [];
    const midN = Math.ceil((1920 + o.reach * 0.25) / TILE) + 1;
    const midTop = o.horizon - 20 - 640;
    for (let i = 0; i < midN; i++) {
      BILLBOARDS.forEach((b, k) => {
        const x = i * TILE - 500 + b.x + b.w / 2;
        const y = midTop + b.y + b.h / 2;
        const c = [0xff3fd0, 0x3ff2ff, 0xffb43f][(i + k) % 3];
        const panel = scene.add.rectangle(x, y, b.w, b.h, c, 0.28).setScrollFactor(0.25, 1).setDepth(-37.85).setStrokeStyle(3, c, 0.9);
        const halo = scene.add.image(x, y, 'halo').setScrollFactor(0.25, 1).setDepth(-37.84).setDisplaySize(b.w * 1.6, b.h * 2.2).setTint(c).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
        const text = scene.add.text(x, y, words[(i * 3 + k) % words.length], { fontFamily: 'Karla', fontSize: '26px', fontStyle: 'bold', color: '#FFFFFF' }).setOrigin(0.5).setScrollFactor(0.25, 1).setDepth(-37.83).setShadow(0, 0, Phaser.Display.Color.IntegerToColor(c).rgba, 12, true, true);
        text.setScale(Math.min(1, (b.w * 0.86) / text.width));
        boards.push({ text, panel, halo, n: i * 3 + k });
      });
    }
    haze(scene, o.horizon - 300, 260, 0x3a1e6a, 0.3, -37, 0.25);
    // The elevated railway, and a train along it now and then.
    tiles(scene, 'bd_n_rail', o.horizon + 60, 0.42, -36, o.reach);
    const deckY = o.horizon + 60 - 520 + RAIL_DECK;
    const train = scene.add.image(0, deckY + 4, 'bd_n_train').setOrigin(0, 1).setScrollFactor(0.42, 1).setDepth(-35.9);
    const trainGlow = scene.add.image(0, deckY - 46, 'halo').setScrollFactor(0.42, 1).setDepth(-35.85).setDisplaySize(1600, 70).setTint(0x9fe8ff).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    // Main street: storefronts behind the road, each with a buzzing neon sign and its reflection.
    const signs: { glow: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text; buzz: number }[] = [];
    let i = 0;
    for (let x = Math.max(2200, from(o)); x < Math.min(o.finish - 600, to(o)); x += 900 + rnd(17, i) * 500, i++) {
      // Keep the shops clear of the gate signs and the locals' signs, so nothing hides their neon.
      if (o.busy?.some((bx) => Math.abs(bx - x) < 480)) continue;
      const n = i % SHOPS.length;
      const k = 0.85;
      const gy = o.groundY(x) + 6;
      scene.add.image(x, gy, `shop_${n}`).setOrigin(0.5, 1).setDepth(-9).setScale(k);
      const sy = gy - (460 - 242) * k;
      const text = scene.add.text(x, sy, SHOPS[n].name, { fontFamily: '"Fraunces", serif', fontSize: '40px', color: SHOPS[n].colour, stroke: '#ffffff', strokeThickness: 1 }).setOrigin(0.5).setDepth(-8.9).setShadow(0, 0, SHOPS[n].colour, 16, true, true);
      const g = scene.add.image(x, sy, 'halo').setDepth(-8.8).setDisplaySize(380, 140).setTint(Phaser.Display.Color.HexStringToColor(SHOPS[n].colour).color).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
      // The sign and the shop window, mirrored as long streaks on the wet road.
      scene.add.image(x, o.groundY(x) + 30, 'halo').setOrigin(0.5, 0).setDepth(0.6).setDisplaySize(70, 150).setTint(Phaser.Display.Color.HexStringToColor(SHOPS[n].colour).color).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
      scene.add.image(x - 50, o.groundY(x) + 30, 'halo').setOrigin(0.5, 0).setDepth(0.6).setDisplaySize(160, 110).setTint(0xffd27a).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);
      signs.push({ glow: g, text, buzz: Math.random() });
    }
    // Rain: long streaks near, fine ones far, slanting in the wind; and splashes on the road.
    if (!scene.textures.exists('raindrop')) {
      const t = scene.textures.createCanvas('raindrop', 3, 40)!;
      const g = t.context.createLinearGradient(0, 0, 0, 40);
      g.addColorStop(0, 'rgba(200,215,255,0)');
      g.addColorStop(1, 'rgba(220,230,255,0.9)');
      t.context.fillStyle = g;
      t.context.fillRect(0, 0, 3, 40);
      t.refresh();
    }
    const near = fallers(scene, 'raindrop', 140, 57, (f) => {
      f.vx = -3;
      f.vy = 26 + Math.random() * 8;
      f.img.setRotation(0.11).setAlpha(0.55).setScale(1, 1.4);
    });
    const far = fallers(scene, 'raindrop', 200, -30, (f) => {
      f.vx = -1.5;
      f.vy = 16 + Math.random() * 6;
      f.img.setRotation(0.09).setAlpha(0.3).setScale(0.6, 0.8);
    });
    const splashes: Phaser.GameObjects.Ellipse[] = [];
    let nextFlash = 6000 + Math.random() * 8000;
    let lastScroll = 0;
    return {
      update(time, delta, scrollX) {
        const dt = delta / 1000;
        const pan = scrollX - lastScroll;
        lastScroll = scrollX;
        stepFallers(near, dt, pan);
        stepFallers(far, dt, pan * 0.3);
        for (const c of clouds) c.x += dt * 6;
        glow.setAlpha(0.36 + Math.sin(time / 1700) * 0.05);
        beacons.forEach((b, i) => b.setAlpha((time / 900 + i * 0.37) % 1 < 0.25 ? 1 : 0.15));
        // Billboards: every few seconds a glitch, and a new slogan.
        for (const b of boards) {
          const cycle = (time / 3200 + b.n * 0.37) % 1;
          const glitch = cycle > 0.94;
          if (glitch && Math.random() < 0.3) b.text.setText(words[Math.floor(Math.random() * words.length)]);
          b.text.setAlpha(glitch ? Math.random() : 1).setX(b.panel.x + (glitch ? (Math.random() - 0.5) * 8 : 0));
          b.halo.setAlpha(glitch ? 0.12 : 0.32 + Math.sin(time / 400 + b.n) * 0.04);
        }
        // The train: crosses the view every twenty seconds or so, right to left.
        const tx = scrollX * 0.42 + 2200 - ((time * 0.45) % 9000);
        train.setX(tx);
        trainGlow.setX(tx + 750);
        // Flying cars, drifting across the sky.
        for (const f of flyers) {
          const span = 2600;
          const x = (((f.off + time * f.speed) % span) + span) % span - 340;
          const y = f.y + Math.sin(time / 1300 + f.off) * 10;
          f.body.setPosition(x, y);
          f.lamp.setPosition(x + (f.speed > 0 ? 16 : -16), y);
          f.trail.setPosition(x - (f.speed > 0 ? 90 : -90), y);
        }
        // Neon buzz: mostly on, now and then a flicker.
        for (const s of signs) {
          const off = Math.random() < 0.012;
          s.text.setAlpha(off ? 0.25 : 1);
          s.glow.setAlpha(off ? 0.1 : 0.45 + Math.sin(time / 300 + s.buzz * 9) * 0.06);
        }
        // Splashes: little rings popping on the road in front of the camera.
        if (Math.random() < 0.6) {
          const x = scrollX + Math.random() * 1920;
          const e = scene.add.ellipse(x, 900 + Math.random() * 30, 6, 2, 0xdfe6ff, 0.6).setDepth(1);
          splashes.push(e);
          scene.tweens.add({ targets: e, scaleX: 5, scaleY: 3, alpha: 0, duration: 420, onComplete: () => (e.destroy(), splashes.splice(splashes.indexOf(e), 1)) });
        }
        // Lightning: a double flash over the town.
        nextFlash -= delta;
        if (nextFlash < 0) {
          nextFlash = 9000 + Math.random() * 12000;
          scene.tweens.add({ targets: flash, fillAlpha: { from: 0.55, to: 0 }, duration: 160, yoyo: false, repeat: 1, repeatDelay: 90 });
        }
      },
    };
  },
};

// ======================================================================== COAST: Coast Road, bright morning

/** The sea: turquoise near the shore, deep blue at the horizon, with wave lines and far islands. */
function seaArt(): Art {
  const key = 'bd_c_sea';
  const h = 340;
  const p = plainPen(key);
  const bands = ['#3E7EC0', '#4A92CC', '#56A6D6', '#66BCDC', '#7ED0E0'];
  bands.forEach((c, i) => p.rect(0, i * (h / bands.length), TILE, h / bands.length + 2, { fill: c, stroke: null, r: 0 }));
  // Islands on the horizon.
  for (const [x, w, t] of [[300, 260, 40], [1100, 180, 28], [1800, 340, 52]] as const) p.shape([[x - w / 2, 4], [x - w / 4, -t], [x + w / 6, -t * 0.7], [x + w / 2, 4]], { fill: '#7E98C8', stroke: null, raw: true, wobble: 0.5 });
  for (let i = 0; i < 160; i++) {
    const y = 10 + rnd(121, i) * (h - 20);
    const x = rnd(123, i) * TILE;
    const len = 20 + (y / h) * 60;
    p.line([[x, y], [x + len, y]], { width: 1.5 + (y / h) * 2.5, color: '#E6F6FA', raw: true, opacity: 0.55, wobble: 0 });
  }
  return { key, svg: p.svg(TILE, h + 60), w: TILE, h: h + 60 };
}

/** White cliffs with green tops falling to the sea, rocks and surf at their feet. */
/** Where the lighthouse stands in each stretch of cliffs, and where its lamp is. */
export const LIGHT = { x: 1560 };
function cliffsArt(): Art {
  const key = 'bd_c_cliffs';
  const h = 520;
  const p = plainPen(key);
  const hill = wave(131, [60, 40, 20]);
  const at = (x: number) => h - 300 - hill(x);
  const top: Pt[] = [];
  for (let x = 0; x <= TILE; x += 14) top.push([x, at(x)]);
  p.shape([...top, [TILE, h], [0, h]], { fill: '#F2E6CE', stroke: null, raw: true, wobble: 0.3 });
  for (let x = 30; x < TILE; x += 60) p.shape([[x, at(x) + 20], [x + 30, at(x) + 30], [x + 26, h - 40], [x + 6, h - 40]], { fill: '#D8C8AC', stroke: null, raw: true, wobble: 0.5, opacity: 0.8 });
  p.shape([...top.map(([x, y]) => [x, y - 4] as Pt), ...top.slice().reverse().map(([x, y]) => [x, y + 22] as Pt)], { fill: '#7FC07A', stroke: null, raw: true, wobble: 0.4 });
  // A lighthouse on the highest headland.
  const lx = LIGHT.x;
  const ly = at(lx) + 6;
  p.shape([[lx - 34, ly], [lx - 22, ly - 210], [lx + 22, ly - 210], [lx + 34, ly]], { fill: '#F6F2EA', stroke: null, raw: true });
  for (const k of [0.15, 0.45, 0.75]) {
    const y0 = ly - 210 * (1 - k);
    p.shape([[lx - 34 + 12 * (1 - k), y0], [lx + 34 - 12 * (1 - k), y0], [lx + 32 - 12 * (1 - k), y0 - 34], [lx - 32 + 12 * (1 - k), y0 - 34]], { fill: '#D8463A', stroke: null, raw: true });
  }
  p.rect(lx - 26, ly - 246, 52, 36, { fill: '#FFE9A8', stroke: null, r: 3 });
  p.shape([[lx - 34, ly - 244], [lx, ly - 284], [lx + 34, ly - 244]], { fill: '#D8463A', stroke: null, raw: true });
  p.rect(lx - 40, ly - 214, 80, 8, { fill: '#3A3A4E', stroke: null, r: 2 });
  p.rect(lx + 30, ly - 60, 70, 60, { fill: '#F6F2EA', stroke: null, r: 2 });
  p.shape([[lx + 24, ly - 58], [lx + 65, ly - 90], [lx + 106, ly - 58]], { fill: '#D8463A', stroke: null, raw: true });
  // Surf and rocks at the foot.
  p.rect(0, h - 44, TILE, 44, { fill: '#5AAAD0', stroke: null, r: 0 });
  for (let x = 0; x < TILE; x += 70) p.ellipse(x + rnd(141, x) * 40, h - 44, 30 + rnd(143, x) * 30, 14, { fill: '#FFFFFF', stroke: null, wobble: 0.8, opacity: 0.9 });
  for (let x = 40; x < TILE; x += 190) p.ellipse(x, h - 36, 26, 16, { fill: '#8A7E8E', stroke: null, wobble: 0.6 });
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 0.5 };
}

function lighthouseArt(): Art {
  return inked('lighthouse', 180, 520, (p) => {
    p.shape([[56, 500], [70, 120], [110, 120], [124, 500]], { fill: '#F4F0E8', width: 5, raw: true });
    for (const y of [180, 300, 420]) p.shape([[64 - (y - 120) * 0.035, y], [116 + (y - 120) * 0.035, y], [118 + (y + 50 - 120) * 0.035, y + 50], [62 - (y + 50 - 120) * 0.035, y + 50]], { fill: '#D8463A', width: 3, raw: true });
    p.rect(60, 88, 60, 34, { fill: '#FFE9A8', width: 4, r: 3 });
    p.shape([[52, 90], [90, 50], [128, 90]], { fill: '#D8463A', width: 4, raw: true });
    p.rect(48, 118, 84, 10, { fill: '#3A3A4E', width: 3, r: 2 });
  });
}

function beachHutArt(n: number): Art {
  const colour = ['#EE6A4D', '#3FA7B5', '#FFB23F', '#7FC07A'][n];
  return inked(`hut_${n}`, 140, 180, (p) => {
    p.rect(20, 60, 100, 118, { fill: '#F4F0E8', width: 4, r: 2 });
    for (let x = 26; x < 116; x += 18) p.rect(x, 64, 9, 112, { fill: colour, stroke: null, r: 0 });
    p.shape([[10, 64], [70, 16], [130, 64]], { fill: colour, width: 4, raw: true });
    p.rect(52, 110, 36, 68, { fill: '#5A4A4E', width: 3, r: 2 });
  });
}

function windswept(): Art {
  return inked('seapine', 300, 340, (p) => {
    p.line([[150, 340], [146, 250], [120, 180], [96, 120]], { width: 16, color: '#6A4A42' });
    for (const [x, y, w] of [[90, 100, 120], [150, 130, 90], [70, 150, 80]] as const) p.ellipse(x + 20, y, w, 30, { fill: '#3E7A5E', width: 4 });
  });
}

const COAST: Biome = {
  key: 'coast',
  sky: [
    [0, '#4A9AD8'],
    [0.45, '#8CC8EC'],
    [0.8, '#D6EEF6'],
    [1, '#F6EEDC'],
  ],
  ground: { '#C47F58': '#E2C49A', '#9C5C48': '#C8A47A', '#5E3A44': '#8A6A5A', '#B06E50': '#D6B48A', '#93594A': '#BE9C76', '#774650': '#9A7A62', '#EDB27D': '#EED8B4', '#F8CC97': '#FFF0D6' },
  grass: { '#2F6B55': '#6E9A5A', '#3E8A68': '#9AB870', '#4F9C74': '#B8C98A', '#62AE7E': '#D6D69A' },
  grip: 1,
  lamps: false,
  arts: () => [
    ...[0, 1, 2].map((n) => recolor(cloudBankArt(n), `bd_cloud_white_${n}`, { '#C9A3CF': '#D8E6F4', '#F7C6CC': '#F4F8FC', '#FFE7DF': '#FFFFFF' })),
    ...birdArts().map((a) => recolor(a, a.key.replace('bd_bird', 'bd_gull'), { '#3B2F55': '#F4F6FA' })),
    seaArt(),
    cliffsArt(),
    lighthouseArt(), beachHutArt(0), beachHutArt(1), beachHutArt(2), beachHutArt(3)],
  build(scene, o) {
    scene.add.image(0, 0, skyTexture(scene, 'sky_coast', this.sky)).setOrigin(0).setDisplaySize(1920, 1080).setScrollFactor(0).setDepth(-50);
    // A bright morning sun, and its glitter path on the sea.
    scene.add.image(1500, 210, 'halo').setScrollFactor(0.03).setDepth(-46).setTint(0xfff6d8).setDisplaySize(700, 700).setAlpha(0.85);
    scene.add.circle(1500, 210, 64, 0xfffbe8).setScrollFactor(0.03).setDepth(-45);
    const clouds: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 7; i++) clouds.push(scene.add.image(i * 640 - 300, 110 + ((i * 89) % 180), `bd_cloud_white_${i % 3}`).setScrollFactor(0.05, 1).setDepth(-44).setScale(0.9 + (i % 3) * 0.2));
    const seaTop = o.horizon - 380;
    tiles(scene, 'bd_c_sea', seaTop + 400, 0.06, -42, o.reach);
    const glitter: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 46; i++) glitter.push(scene.add.image(1500 + (Math.random() - 0.5) * (60 + i * 6), seaTop + 8 + i * 7, 'halo').setScrollFactor(0.03, 1).setDepth(-41).setDisplaySize(30 + Math.random() * 40, 5).setTint(0xfff6d8).setBlendMode(Phaser.BlendModes.ADD));
    // Sailboats on the sea, drifting.
    const boats: Phaser.GameObjects.Container[] = [];
    for (let i = 0; i < 4; i++) {
      const sail = scene.add.triangle(0, 0, 0, 30, 14, 0, 16, 30, 0xffffff).setOrigin(0.5, 1);
      const hull = scene.add.rectangle(4, 2, 30, 6, 0x3a3a4e).setOrigin(0.5, 0);
      boats.push(scene.add.container(300 + i * 520, seaTop + 40 + (i % 2) * 40, [sail, hull]).setScrollFactor(0.07, 1).setDepth(-41).setScale(1 + (i % 2) * 0.4));
    }
    tiles(scene, 'bd_c_cliffs', o.horizon - 30, 0.22, -38, o.reach, -700);
    // The lighthouse lamps, blinking, one in each stretch of cliffs.
    const cliffHill = wave(131, [60, 40, 20]);
    const lamps: Phaser.GameObjects.Image[] = [];
    const cn = Math.ceil((1920 + o.reach * 0.22) / TILE) + 1;
    for (let i = 0; i < cn; i++) {
      const x = i * TILE - 700 + LIGHT.x;
      const y = o.horizon - 30 - 520 + (520 - 300 - cliffHill(LIGHT.x)) + 6 - 228;
      lamps.push(scene.add.image(x, y, 'halo').setScrollFactor(0.22, 1).setDepth(-36.9).setDisplaySize(110, 110).setTint(0xfff0a0).setBlendMode(Phaser.BlendModes.ADD));
    }
    haze(scene, o.horizon - 330, 300, 0xeaf6ff, 0.3, -35, 0.22);
    // Roadside: beach huts in a row, windswept pines.
    let seed = 7;
    for (let x = Math.max(2000, from(o)); x < Math.min(o.finish - 400, to(o)); x += 520 + rnd(19, seed) * 520, seed++) {
      const key = rnd(21, seed) < 0.5 ? `hut_${seed % 4}` : 'seapine';
      scene.add.image(x, o.groundY(x) + 8, key).setOrigin(0.5, 1).setDepth(-9).setScale(key === 'seapine' ? 0.95 : 0.9).setFlipX(key === 'seapine' && seed % 2 === 0);
    }
    // Gulls gliding, flapping now and then.
    const gulls: { img: Phaser.GameObjects.Image; vx: number; t: number; y0: number }[] = [];
    for (let i = 0; i < 6; i++) gulls.push({ img: scene.add.image(Math.random() * 1920, 140 + Math.random() * 260, 'bd_gull_up').setScrollFactor(0).setDepth(-34).setScale(1.2 + Math.random() * 0.6), vx: 0.5 + Math.random() * 0.7, t: Math.random() * 10, y0: 140 + Math.random() * 260 });
    let lastScroll = 0;
    return {
      update(time, delta, scrollX) {
        const dt = delta / 1000;
        const pan = scrollX - lastScroll;
        lastScroll = scrollX;
        for (const c of clouds) c.x += dt * 5;
        glitter.forEach((g, i) => g.setAlpha(Math.max(0, Math.sin(time / 260 + i * 1.7)) * 0.9));
        boats.forEach((b, i) => {
          b.x += dt * (4 + i);
          b.y += Math.sin(time / 700 + i) * 0.05;
          b.rotation = Math.sin(time / 900 + i) * 0.05;
        });
        for (const l of lamps) l.setAlpha(Math.sin(time / 600) > 0.3 ? 0.9 : 0.15);
        for (const g of gulls) {
          g.t += dt;
          g.img.x += (g.vx * 60 * dt) - pan * 0.4;
          g.img.y = g.y0 + Math.sin(g.t * 0.8) * 20;
          if (Math.floor(g.t * 4) % 9 < 2) g.img.setTexture(Math.floor(g.t * 8) % 2 ? 'bd_gull_up' : 'bd_gull_down');
          else g.img.setTexture('bd_gull_up');
          if (g.img.x > 2000) g.img.x = -80;
          if (g.img.x < -100) g.img.x = 1980;
        }
      },
    };
  },
};

// ======================================================================== MEADOW: the original farmland

const MEADOW: Biome = {
  key: 'meadow',
  sky: [],
  ground: {},
  grass: {},
  grip: 1,
  lamps: true,
  arts: () => [],
  build(scene, o) {
    scene.add.image(0, 0, 'sky').setOrigin(0).setDisplaySize(1920, 1080).setScrollFactor(0).setDepth(-50);
    const b = buildBackdrop(scene, { reach: o.reach, horizon: o.horizon, width: 1920, height: 1080, parallax: true });
    return {
      update(_t, delta) {
        for (const s of b.sails) s.rotation += delta * 0.0009;
        for (const c of b.clouds) c.img.x += delta * c.speed;
      },
    };
  },
};

export const BIOMES: Record<BiomeKey, Biome> = { meadow: MEADOW, autumn: AUTUMN, snow: SNOW, town: TOWN, coast: COAST };

/** An art with some of its colours swapped: how the ground and grass take on a biome's colours. */
export function recolor(art: Art, key: string, map: Record<string, string>): Art {
  let svg = art.svg;
  const swap = (from: string, to: string) => {
    for (const f of [from, from.toLowerCase(), from.toUpperCase()]) svg = svg.split(f).join(to);
  };
  for (const [raw, to] of Object.entries(map)) {
    const from = raw.trim();
    // The pen paints each fill as a gradient from a lighter tint, through the colour, to a darker one,
    // so those tints are swapped too, or the old colour would show at the top and bottom of every shape.
    swap(mix(from, '#FFF4D6', 0.16), mix(to, '#FFF4D6', 0.16));
    swap(mix(from, C.ink, 0.16), mix(to, C.ink, 0.16));
    swap(mix(from, C.ink, 0.74), mix(to, C.ink, 0.74));
    swap(from, to);
  }
  return { ...art, key, svg };
}

// ======================================================================== The roadside stops (checkpoints)

/** The stop's size, and where its name board sits (the name is written on in the game). */
export const STOP = { w: 820, h: 460, sign: { x: 610, y: 62 }, pumpLight: { x: 610, y: 300 } };
const STOP_PALETTES = [
  { roof: '#D8463A', trim: '#F2E8DA', wall: '#F2DCC0', accent: '#2F7F6A' },
  { roof: '#C9702E', trim: '#F4E6CE', wall: '#E8D2B0', accent: '#7A3A2E' },
  { roof: '#3E6EA6', trim: '#EEF2F8', wall: '#C9A47A', accent: '#D8463A' },
  { roof: '#7A4B7E', trim: '#F49AA0', wall: '#3A3458', accent: '#5CF2FF' },
];

/** A fuel stop: a canopy over two pumps on the right, a little shop with lit windows on the left. */
export function stopArts(): Art[] {
  return STOP_PALETTES.map((c, n) =>
    inked(`stop_${n}`, STOP.w, STOP.h, (p) => {
      // The shop.
      p.rect(30, 170, 360, 290, { fill: c.wall, width: 5, r: 4 });
      p.shape([[14, 176], [210, 96], [406, 176]], { fill: c.roof, width: 5, raw: true });
      p.rect(60, 250, 120, 110, { fill: '#FFD98A', width: 4, r: 4 });
      p.rect(230, 250, 120, 110, { fill: '#FFD98A', width: 4, r: 4 });
      for (const wx of [60, 230]) {
        p.line([[wx + 60, 250], [wx + 60, 360]], { width: 3, raw: true });
        p.rect(wx - 6, 356, 132, 12, { fill: c.trim, width: 3, r: 2 });
      }
      p.rect(170, 380, 70, 80, { fill: c.accent, width: 4, r: 3 });
      p.dot(226, 422, 5, '#FFD27A');
      // The canopy: a deck on two posts, a coloured band, lights underneath.
      p.rect(470, 180, 22, 280, { fill: '#B9BCCB', width: 4, r: 3 });
      p.rect(740, 180, 22, 280, { fill: '#B9BCCB', width: 4, r: 3 });
      p.rect(430, 150, 370, 42, { fill: c.trim, width: 5, r: 4 });
      p.rect(430, 176, 370, 14, { fill: c.roof, stroke: null, r: 0 });
      for (const lx of [500, 610, 720]) p.rect(lx - 26, 192, 52, 8, { fill: '#FFF6D8', width: 2.5, r: 3 });
      // Two pumps on an island.
      p.rect(500, 448, 220, 12, { fill: '#9A96A8', width: 3, r: 3 });
      for (const px of [540, 650]) {
        p.rect(px, 340, 50, 108, { fill: c.trim, width: 4, r: 6 });
        p.rect(px, 340, 50, 22, { fill: c.roof, stroke: null, r: 4 });
        p.rect(px + 8, 372, 34, 22, { fill: '#2A2140', width: 2.5, r: 3 });
        p.line([[px + 50, 380], [px + 66, 420], [px + 58, 440]], { width: 4 });
      }
      // The name board on a pole over the canopy.
      p.rect(STOP.sign.x - 4, 60, 8, 92, { fill: '#B9BCCB', width: 3, r: 2 });
      p.rect(STOP.sign.x - 170, 26, 340, 72, { fill: c.trim, width: 5, r: 8 });
      p.rect(STOP.sign.x - 160, 34, 320, 56, { fill: c.roof, stroke: null, r: 6 });
    }),
  );
}
