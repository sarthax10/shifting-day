import Phaser from 'phaser';
import type { Art } from './art';
import { C, Pen, mix, type Pt } from './ink';

/**
 * The scenery behind the road, built the way side-scrolling games layer theirs: far layers have no
 * outlines and fade into haze; nearer layers are busier and darker. Each layer tiles seamlessly
 * (its shapes repeat exactly every TILE pixels), so it can scroll forever.
 */
export const TILE = 2400;

/** A smooth height along a layer that repeats exactly every TILE pixels. */
function wave(seed: number, amps: number[]) {
  const phases = amps.map((_, i) => ((seed * 9301 + i * 49297) % 233280) / 233280 * Math.PI * 2);
  return (x: number) => amps.reduce((h, a, i) => h + a * Math.sin(((i + 1) * Math.PI * 2 * x) / TILE + phases[i]), 0);
}

/** A sharp-peaked ridge (for mountains): the absolute value of waves makes points rather than domes. */
function peaks(seed: number, amps: number[]) {
  const smooth = wave(seed, amps);
  const jag = wave(seed + 7, [0, 0, 0, 0, 0, 0, 14, 0, 9, 0, 0, 6]);
  return (x: number) => Math.abs(smooth(x)) + jag(x);
}

/** A random-looking but repeatable number in 0..1 for an index. */
function rnd(seed: number, i: number) {
  const v = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function plainPen(key: string) {
  return new Pen(key, 0, 0);
}

/** Distant mountains: lavender, sharp peaks with snow on the highest, faint rock strata, no outline. */
export function mountainsArt(): Art {
  const key = 'bd_mountains';
  const h = 620;
  const p = plainPen(key);
  const ridge = peaks(3, [150, 60, 40, 22]);
  const top: Pt[] = [];
  for (let x = 0; x <= TILE; x += 12) top.push([x, h - 160 - ridge(x)]);
  p.shape([...top, [TILE, h], [0, h]], { fill: '#9A86C6', stroke: null, raw: true, wobble: 0.3, shade: [{ pts: [[0, h - 120], [TILE, h - 120], [TILE, h], [0, h]], color: '#A796CF' }] });
  // Shadowed faces: the side of each peak away from the sun.
  for (let x = 24; x < TILE - 24; x += 12) {
    const a = ridge(x - 12);
    const b = ridge(x + 12);
    if (b < a - 3) p.shape([[x, h - 160 - ridge(x)], [x + 12, h - 160 - b], [x + 30, h - 40], [x + 6, h - 40]], { fill: '#8B76BC', stroke: null, raw: true, wobble: 0.2, opacity: 0.6 });
  }
  // Snow on the high peaks.
  let cap: Pt[] = [];
  const flush = () => {
    if (cap.length > 3) p.shape([...cap, ...cap.slice().reverse().map(([x, y]) => [x, y + 26 + Math.sin(x * 0.2) * 8] as Pt)], { fill: '#F3E9FA', stroke: null, raw: true, wobble: 0.6, opacity: 0.92 });
    cap = [];
  };
  for (const [x, y] of top) {
    if (y < h - 160 - 150) cap.push([x, y]);
    else flush();
  }
  flush();
  for (let k = 1; k < 5; k++) p.line(top.map(([x, y]) => [x, y + 40 * k + Math.sin(x / 90 + k) * 6] as Pt), { width: 2, color: '#B5A6DC', raw: true, opacity: 0.35, wobble: 0 });
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 1.2 };
}

/** Rolling hills covered in forest: rows of pines and round trees, darker towards the bottom. */
export function forestArt(): Art {
  const key = 'bd_forest';
  const h = 520;
  const p = plainPen(key);
  const hill = wave(11, [70, 30, 18]);
  const at = (x: number) => h - 230 - hill(x);
  const top: Pt[] = [];
  for (let x = 0; x <= TILE; x += 16) top.push([x, at(x)]);
  p.shape([...top, [TILE, h], [0, h]], { fill: '#6E6AA6', stroke: null, raw: true, wobble: 0.3 });
  // Trees along the crest and down the slope, in three rows, the back row lightest.
  const rows: [number, string][] = [[0, '#7C77B2'], [34, '#635E9C'], [74, '#56518E']];
  rows.forEach(([down, colour], r) => {
    for (let i = 0, x = (r * 17) % 23; x < TILE; i++) {
      const y = at(x) + down;
      const s = 0.75 + rnd(r + 5, i) * 0.6;
      if (rnd(r + 9, i) < 0.6) {
        const th = 46 * s;
        p.shape([[x, y - th], [x + 13 * s, y + 6], [x - 13 * s, y + 6]], { fill: colour, stroke: null, raw: true, wobble: 0.4 });
      } else {
        p.ellipse(x, y - 14 * s, 17 * s, 19 * s, { fill: colour, stroke: null, wobble: 0.5 });
      }
      x += 11 + rnd(r + 3, i) * 14;
    }
  });
  p.shape([[0, h - 120], [TILE, h - 120], [TILE, h], [0, h]], { fill: '#56518E', stroke: null, raw: true, wobble: 0 });
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 0.7 };
}

/** Farmland: green hills striped with fields, hedgerows between them, little barns and haystacks. */
export function farmsArt(): Art {
  const key = 'bd_farms';
  const h = 460;
  const p = plainPen(key);
  const hill = wave(23, [56, 26, 14]);
  const at = (x: number) => h - 250 - hill(x);
  const top: Pt[] = [];
  for (let x = 0; x <= TILE; x += 16) top.push([x, at(x)]);
  p.shape([...top, [TILE, h], [0, h]], { fill: '#6FA97C', stroke: null, raw: true, wobble: 0.3 });
  // Bands of fields following the hill's shape, each a slightly different crop.
  const crops = ['#86BC7E', '#A8C46A', '#D9B85E', '#79B07A', '#C9C26A', '#93C083'];
  for (let band = 0; band < 6; band++) {
    const y0 = 18 + band * 34;
    for (let seg = 0; seg < 10; seg++) {
      const x0 = seg * (TILE / 10);
      const x1 = x0 + TILE / 10;
      const pts: Pt[] = [];
      for (let x = x0; x <= x1; x += 24) pts.push([x, at(x) + y0]);
      for (let x = x1; x >= x0; x -= 24) pts.push([x, at(x) + y0 + 30]);
      p.shape(pts, { fill: crops[(band * 3 + seg * 7) % crops.length], stroke: null, raw: true, wobble: 0.2, opacity: 0.9 });
      // Crop rows across the field.
      for (let x = x0 + 8; x < x1; x += 14) p.line([[x, at(x) + y0 + 4], [x + 6, at(x) + y0 + 27]], { width: 1.6, color: '#00000020', raw: true, wobble: 0 });
    }
    // A hedgerow along the bottom of the band.
    for (let x = 6; x < TILE; x += 11) p.dot(x, at(x) + y0 + 31, 6 + rnd(band, x) * 3, rnd(band + 1, x) < 0.5 ? '#3E7A5E' : '#4D8A68');
  }
  // Barns, haystacks and clumps of trees dotted over the hills.
  for (let i = 0; i < 9; i++) {
    const x = 120 + i * 260 + rnd(41, i) * 80;
    const y = at(x) + 30 + rnd(43, i) * 60;
    const kind = Math.floor(rnd(47, i) * 3);
    if (kind === 0) {
      p.rect(x - 22, y - 26, 44, 28, { fill: '#C8584E', stroke: '#5B2E3E', width: 2.5, r: 2 });
      p.shape([[x - 26, y - 24], [x, y - 44], [x + 26, y - 24]], { fill: '#7A3446', stroke: '#5B2E3E', width: 2.5, raw: true });
      p.rect(x - 6, y - 14, 12, 16, { fill: '#5B2E3E', stroke: null, r: 1 });
    } else if (kind === 1) {
      for (let k = 0; k < 3; k++) p.ellipse(x + k * 22, y - 8, 11, 12, { fill: '#E3B95A', stroke: '#9C7A34', width: 2 });
    } else {
      for (let k = 0; k < 4; k++) p.dot(x + k * 14 - 20, y - 14 - (k % 2) * 8, 15, k % 2 ? '#3F7D5F' : '#4B8C69');
    }
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 0.4 };
}

/** A soft bank of cloud: many overlapping puffs, lit on top, lavender underneath, no outline. */
export function cloudBankArt(n: number): Art {
  const key = `bd_cloud_${n}`;
  const w = 760;
  const h = 300;
  const p = plainPen(key);
  const puffs = 14;
  // A lilac shadowed underside: lower, smaller puffs peeking out below the lit ones.
  for (let i = 0; i < puffs; i++) {
    const t = i / (puffs - 1);
    const x = 90 + t * (w - 180) + (rnd(n + 8, i) - 0.5) * 70;
    const lift = Math.sin(t * Math.PI) * (110 + n * 20);
    const r = 32 + rnd(n + 9, i) * 34 + Math.sin(t * Math.PI) * 18;
    p.ellipse(x + 8, h - 50 - lift * 0.45, r, r * 0.7, { fill: '#C9A3CF', stroke: null, wobble: 0.8, opacity: 0.9 });
  }
  for (let i = 0; i < puffs; i++) {
    const t = i / (puffs - 1);
    const x = 80 + t * (w - 160) + (rnd(n, i) - 0.5) * 60;
    const lift = Math.sin(t * Math.PI) * (110 + n * 20);
    const r = 46 + rnd(n + 2, i) * 46 + Math.sin(t * Math.PI) * 30;
    p.ellipse(x, h - 70 - lift * 0.6, r, r * 0.82, { fill: '#F7C6CC', stroke: null, wobble: 0.8 });
  }
  for (let i = 0; i < puffs; i++) {
    const t = i / (puffs - 1);
    const x = 80 + t * (w - 160) + (rnd(n + 4, i) - 0.5) * 50;
    const lift = Math.sin(t * Math.PI) * (110 + n * 20);
    const r = 34 + rnd(n + 6, i) * 36 + Math.sin(t * Math.PI) * 22;
    p.ellipse(x - 10, h - 92 - lift * 0.6, r, r * 0.8, { fill: '#FFE7DF', stroke: null, wobble: 0.8, opacity: 0.9 });
  }
  return { key, svg: p.svg(w, h), w, h, blur: 1.6 };
}

/** The strip of tall grass, ferns and wildflowers that passes in front of everything at the bottom. */
export function grassStripArt(): Art {
  const key = 'bd_grass';
  const w = 1200;
  const h = 190;
  const p = plainPen(key);
  p.rect(-10, h - 40, w + 20, 60, { fill: '#2F6B55', stroke: null, r: 0 });
  const greens = ['#3E8A68', '#4F9C74', '#2F6B55', '#62AE7E'];
  for (let i = 0; i < 260; i++) {
    const x = (i / 260) * w + rnd(3, i) * 6;
    const tall = 50 + rnd(5, i) * 110;
    const lean = (rnd(7, i) - 0.5) * 40;
    p.line([[x, h], [x + lean * 0.4, h - tall * 0.6], [x + lean, h - tall]], { width: 3 + rnd(9, i) * 3, color: greens[i % 4] });
  }
  for (let i = 0; i < 16; i++) {
    const x = 30 + i * 75 + rnd(11, i) * 30;
    const y = h - 70 - rnd(13, i) * 70;
    p.line([[x, h], [x + 4, y]], { width: 2.5, color: '#2F6B55' });
    const colour = [C.terracotta, C.mustard, C.pink, C.cream][i % 4];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      p.ellipse(x + 4 + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 6, { fill: colour, stroke: mix(colour, C.ink, 0.6), width: 1.6 });
    }
    p.dot(x + 4, y, 4, C.mustard);
  }
  return { key, svg: p.svg(w, h), w, h };
}

/** A windmill for the farmland: the tower, and its sails as a separate picture so they can turn. */
export function windmillArts(): Art[] {
  const tower = plainPen('bd_mill');
  tower.shape([[30, 160], [40, 40], [70, 40], [80, 160]], { fill: '#EADCC8', stroke: '#6E5A6E', width: 3, raw: true, shade: [{ pts: [[56, 30], [90, 30], [90, 170], [60, 170]], color: '#CDBFB0' }] });
  tower.shape([[32, 44], [55, 18], [78, 44]], { fill: '#8E4A5E', stroke: '#6E5A6E', width: 3, raw: true });
  tower.rect(48, 120, 14, 40, { fill: '#6E4A68', stroke: null, r: 2 });
  const sails = plainPen('bd_sails');
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const pt = (u: number, v: number): Pt => [60 + cos * u - sin * v, 60 + sin * u + cos * v];
    sails.shape([pt(8, -3), pt(56, -3), pt(56, 12), pt(14, 12)], { fill: '#F5EDE0', stroke: '#6E5A6E', width: 2.5, raw: true });
    sails.line([pt(4, 0), pt(58, 0)], { width: 3, color: '#6E5A6E', raw: true });
  }
  sails.dot(60, 60, 5, '#6E5A6E');
  return [
    { key: 'bd_mill', svg: tower.svg(110, 170), w: 110, h: 170 },
    { key: 'bd_sails', svg: sails.svg(120, 120), w: 120, h: 120 },
  ];
}

/** Two frames of a small bird, wings up and wings down, for flocks that flap across the sky. */
export function birdArts(): Art[] {
  const up = plainPen('bd_bird_up');
  up.shape([[4, 18], [14, 4], [20, 14], [26, 4], [36, 18], [20, 16]], { fill: '#3B2F55', stroke: null, raw: true, wobble: 0.3 });
  const down = plainPen('bd_bird_down');
  down.shape([[4, 8], [14, 20], [20, 12], [26, 20], [36, 8], [20, 14]], { fill: '#3B2F55', stroke: null, raw: true, wobble: 0.3 });
  return [
    { key: 'bd_bird_up', svg: up.svg(40, 26), w: 40, h: 26 },
    { key: 'bd_bird_down', svg: down.svg(40, 26), w: 40, h: 26 },
  ];
}

/** A falling leaf. */
export function leafArt(): Art {
  const p = plainPen('bd_leaf');
  p.shape([[4, 12], [12, 3], [22, 8], [14, 18]], { fill: '#E58A4E', stroke: '#9C4E3A', width: 2 });
  p.line([[5, 12], [20, 8]], { width: 1.4, color: '#9C4E3A', raw: true });
  return { key: 'bd_leaf', svg: p.svg(26, 22), w: 26, h: 22 };
}

export function backdropArts(): Art[] {
  return [mountainsArt(), forestArt(), farmsArt(), cloudBankArt(0), cloudBankArt(1), cloudBankArt(2), grassStripArt(), ...windmillArts(), ...birdArts(), leafArt()];
}

interface Layers {
  /** How far across the scenery has to reach, in world pixels. */
  reach: number;
  /** Where the bottom of the farmland sits (just behind the road). */
  horizon: number;
  width: number;
  height: number;
  /** World layers get scroll factors; the title's are static and drift instead. */
  parallax: boolean;
}

/** A soft haze band laid between layers: the further back, the more the colours fade towards the sky. */
function haze(scene: Phaser.Scene, y: number, height: number, colour: number, alpha: number, depth: number, sf: number) {
  const g = scene.add.graphics().setDepth(depth).setScrollFactor(sf, 1);
  g.fillGradientStyle(colour, colour, colour, colour, 0, 0, alpha, alpha);
  g.fillRect(-200, y, 40000, height);
  return g;
}

/**
 * Lays the scenery into a scene. Returns the moving parts (windmill sails, clouds) for the scene's
 * update to animate, and starts the ambient effects: pollen, falling leaves and birds.
 */
export function buildBackdrop(scene: Phaser.Scene, o: Layers) {
  const sf = (v: number) => (o.parallax ? v : 0);
  const count = (f: number) => Math.ceil((o.width + o.reach * f) / TILE) + 1;
  const sails: Phaser.GameObjects.Image[] = [];
  const clouds: { img: Phaser.GameObjects.Image; speed: number }[] = [];

  for (let i = 0; i < 7; i++) {
    const img = scene.add.image(i * 700 - 200, 120 + ((i * 131) % 220), `bd_cloud_${i % 3}`).setScrollFactor(sf(0.06), 1).setDepth(-44).setScale(0.8 + (i % 3) * 0.25).setAlpha(0.95);
    clouds.push({ img, speed: 0.004 + (i % 3) * 0.003 });
  }
  for (let i = 0; i < count(0.1); i++) scene.add.image(i * TILE, o.horizon - 230, 'bd_mountains').setOrigin(0, 1).setScrollFactor(sf(0.1), 1).setDepth(-40);
  haze(scene, o.horizon - 520, 360, 0xf2a6b5, 0.5, -39, sf(0.1));
  for (let i = 0; i < count(0.2); i++) scene.add.image(i * TILE - 300, o.horizon - 120, 'bd_forest').setOrigin(0, 1).setScrollFactor(sf(0.2), 1).setDepth(-36);
  haze(scene, o.horizon - 340, 260, 0xf6b7a8, 0.35, -35, sf(0.2));
  for (let i = 0; i < count(0.34); i++) {
    const x0 = i * TILE - 600;
    scene.add.image(x0, o.horizon, 'bd_farms').setOrigin(0, 1).setScrollFactor(sf(0.34), 1).setDepth(-32);
    // Windmills turning on the hills.
    for (const [dx, dy] of [[520, -250], [1580, -232]]) {
      scene.add.image(x0 + dx, o.horizon + dy, 'bd_mill').setOrigin(0.5, 1).setScrollFactor(sf(0.34), 1).setDepth(-31).setScale(0.8);
      sails.push(scene.add.image(x0 + dx, o.horizon + dy - 104, 'bd_sails').setScrollFactor(sf(0.34), 1).setDepth(-30).setScale(0.8));
    }
  }
  haze(scene, o.horizon - 280, 220, 0xffd2a8, 0.18, -29, sf(0.34));
  ambient(scene, o.height);
  return { sails, clouds };
}

/** Pollen drifting in the warm light, leaves falling now and then, and flocks of birds flapping across. */
function ambient(scene: Phaser.Scene, height: number) {
  scene.add
    .particles(0, 0, 'halo', {
      x: { min: 0, max: 1920 },
      y: { min: 120, max: height - 200 },
      lifespan: 7000,
      speedX: { min: -14, max: 22 },
      speedY: { min: -10, max: 8 },
      scale: { start: 0.035, end: 0.015 },
      alpha: { start: 0.9, end: 0 },
      tint: 0xfff0b8,
      frequency: 140,
      blendMode: Phaser.BlendModes.ADD,
    })
    .setScrollFactor(0)
    .setDepth(55);

  scene.time.addEvent({
    delay: 1300,
    loop: true,
    callback: () => {
      const leaf = scene.add.image(Math.random() * 1920, -20, 'bd_leaf').setScrollFactor(0).setDepth(56).setScale(0.8 + Math.random() * 0.6);
      scene.tweens.add({ targets: leaf, y: height + 40, x: leaf.x - 200 - Math.random() * 300, angle: 360 * (Math.random() < 0.5 ? -1 : 1) * 2, duration: 7000 + Math.random() * 3000, onComplete: () => leaf.destroy() });
    },
  });

  const flock = () => {
    const n = 4 + Math.floor(Math.random() * 4);
    const y0 = 160 + Math.random() * 220;
    const fromLeft = Math.random() < 0.5;
    for (let i = 0; i < n; i++) {
      const bird = scene.add.image(fromLeft ? -60 - i * 40 : 1980 + i * 40, y0 + (i % 2) * 24 + i * 6, 'bd_bird_up').setScrollFactor(0).setDepth(-38).setScale(0.6 + Math.random() * 0.3).setFlipX(!fromLeft);
      const flap = scene.time.addEvent({ delay: 140 + i * 9, loop: true, callback: () => bird.setTexture(bird.texture.key === 'bd_bird_up' ? 'bd_bird_down' : 'bd_bird_up') });
      scene.tweens.add({ targets: bird, x: fromLeft ? 2000 : -100, y: bird.y - 60 + Math.random() * 80, duration: 14000 + Math.random() * 3000, onComplete: () => (flap.remove(), bird.destroy()) });
    }
  };
  flock();
  scene.time.addEvent({ delay: 9000, loop: true, callback: flock });
}
