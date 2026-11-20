import Phaser from 'phaser';
import { pen, type Art } from '../art/art';
import { C, mix, type Pt } from '../art/ink';
import { TILE, buildBackdrop, haze, plainPen, rnd } from '../art/backdrop';
import type { BiomeKey } from './legs';
import { FallsWater, Loop, fallWaterArt, fallsFrontArt, fallsSetArt, gorgeArt, placeFalls, type FallSpec } from '../art/falls';
import { SWITCH, TUNNEL } from './tunnel';
import { FROST_TREES } from '../art/trees';
import { HOUSE, STREET_TOP, houseArt, streetArt } from '../art/townhouses';
import { blimpArt, hoverCarArt, synthSunArt } from '../art/futurecity';
import { FALLS, MV, MV_SKY, valleyArt, valleyFarArt, valleyGlintArt, valleyRidgeArt, valleySunArt } from '../art/maplevalley';
import { birdArts, cloudBankArt as printCloudArt } from '../art/oldstreet';
import { COVE, LIGHT, bayArt, coastSunArt, coveArt, dolphinArt, headlandsArt, palmArt, promLampArt, sailArt, seaArt, surfArt, wavesArt } from '../art/coast';
import { BILLBOARDS, LAKE_CABINS, MEGA_BEACONS, RAIL_DECK, cityArt, frostForestArt, frostLakeArt, frostMoonArt, frostPeaksArt, megaArt, railArt, snowNearArt, trainArt, wetStreetArt, holoFishArt } from '../art/night';
import { Culler, strips } from './cull';
import { LOW_POWER, every } from '../systems/quality';

/**
 * The look of each leg's world. Every biome follows the same rules (see docs/JOURNEY.md):
 * five or more layers, each further one closer to the sky's colour; one hero light; something
 * moving at every depth; its own foreground and roadside; and the road itself in its colours.
 */

export interface Built {
  /** Called every frame with the camera's scroll, for weather and anything animated by hand. */
  update(time: number, delta: number, scrollX: number): void;
}

/** Draws one picture, or a small set of them, when it is run. */
export type ArtJob = () => Art | Art[];

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
  /** Pictures this biome needs, as jobs that each draw one picture (or a few), run a slice at a time. */
  arts(): ArtJob[];
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

/** The valley falls, for the live water: one sheet rolling over the notch's lip into the pool. */
const VALLEY_FALLS: FallSpec = {
  canvas: { x: FALLS.x - 120, y: FALLS.top - 16, w: 240, h: 520 - 40 - (FALLS.top - 16) },
  streams: [{ top: FALLS.top + 8, bottom: 520 - 62, l0: FALLS.x - 40, r0: FALLS.x + 40, l1: FALLS.x - 84, r1: FALLS.x + 84, speed: 0.8, seed: 7, lip: true }],
  pool: { x: FALLS.x, y: 520 - 58, rx: 120, ry: 18 },
  rings: [FALLS.x - 24, FALLS.x + 26],
  scale: 0.55,
};


/** A maple leaf for the wind to carry: white under an ink line, so each one can be tinted its own colour. */
function mapleLeafArt(): Art {
  const p = plainPen('bd_a_leaf');
  const c: Pt = [16, 15];
  const shape: Pt[] = [[0, -12], [3, -6], [7, -9], [6, -3], [12, -4], [8, 1], [10, 5], [2, 4], [1, 11], [-1, 11], [-2, 4], [-10, 5], [-8, 1], [-12, -4], [-6, -3], [-7, -9], [-3, -6]];
  p.shape(shape.map(([x, y]) => [c[0] + x, c[1] + y] as Pt), { fill: '#FFFFFF', stroke: C.ink, width: 1.8, raw: true, wobble: 0.3 });
  p.line([[c[0], c[1] - 8], [c[0], c[1] + 10]], { width: 1.2, color: C.ink, raw: true, opacity: 0.7 });
  return { key: 'bd_a_leaf', svg: p.svg(32, 30), w: 32, h: 30 };
}

const AUTUMN: Biome = {
  key: 'autumn',
  // A misty dawn, printed: violet overhead, warming through rose to peach and bone at the horizon.
  sky: MV_SKY,
  // The valley's road: a darker, cooler earth than Old Street's - rust over plum, with a fallen-leaf surface.
  ground: { '#C47F58': '#8E3A34', '#9C5C48': '#6A2432', '#5E3A44': '#2E0F22', '#B06E50': '#7E3436', '#93594A': '#5A1E30', '#774650': '#3E1228', '#EDB27D': '#C8703E', '#F8CC97': '#E8A04E', '#E2A27A': '#D9603A' },
  grass: { '#2F6B55': '#5A2A2A', '#3E8A68': '#A8602E', '#4F9C74': '#D9803A', '#62AE7E': '#E8A84A' },
  grip: 1,
  lamps: false,
  arts: () => [
    () => valleySunArt(),
    () => valleyFarArt(),
    () => valleyRidgeArt(),
    () => valleyArt(),
    () => valleyGlintArt(),
    () => mapleLeafArt(),
    () => [0, 1, 2].map((n) => recolor(printCloudArt(n), `bd_cloud_dawn_${n}`, { '#FFF1DE': '#FBE2BC', '#FFC29E': '#E8967E' })),
    () => fallsSetArt(),
    () => gorgeArt(),
    () => fallsFrontArt(),
    () => fallWaterArt(),
  ],
  build(scene, o) {
    scene.add.image(0, 0, skyTexture(scene, 'sky_autumn', this.sky)).setOrigin(0).setDisplaySize(1920, 1080).setScrollFactor(0).setDepth(-50);
    // The dawn sun, low over the mountains, printed: a warm core breaking into halftone at its rim.
    scene.add.image(560, 270, 'halo').setScrollFactor(0.03).setDepth(-46).setTint(0xffc89a).setDisplaySize(900, 900).setAlpha(0.6);
    scene.add.image(560, 270, 'bd_a_sun').setScrollFactor(0.03).setDepth(-45).setScale(0.72);
    const clouds: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 6; i++) clouds.push(scene.add.image(i * 720 - 300, 120 + ((i * 97) % 170), `bd_cloud_dawn_${i % 3}`).setScrollFactor(0.05, 1).setDepth(-44).setAlpha(0.92).setScale(0.8 + (i % 3) * 0.12));
    tiles(scene, 'bd_a_far', o.horizon - 260, 0.08, -42, o.reach);
    const fog = fogTexture(scene, 'fog_dawn', MV.mist);
    const fogs = [fogBand(scene, fog, o.horizon - 330, 0.1, -41, 0.3, 1.4)];
    tiles(scene, 'bd_a_ridge', o.horizon - 150, 0.18, -38, o.reach);
    fogs.push(fogBand(scene, fog, o.horizon - 210, 0.2, -37, 0.26, 1.2));
    tiles(scene, 'bd_a_valley', o.horizon + 10, 0.36, -34, o.reach, -400);
    // The valley falls in each copy of the valley, all showing one live water picture, with spray at their feet.
    const valleyWater = new FallsWater(scene, LOW_POWER ? 'falls_valley_scratch' : 'falls_valley', VALLEY_FALLS);
    // On a low-power device, recorded once as a loop rather than redrawn and uploaded (art/falls.ts Loop).
    const valleyLoop = LOW_POWER ? new Loop(scene, 'falls_valley_loop', valleyWater.tex.canvas, (t, dt) => valleyWater.paint(t, dt)) : null;
    if (!valleyLoop) valleyWater.draw(0, 16);
    const valleyImgs: Phaser.GameObjects.Image[] = [];
    const n = Math.ceil((1920 + o.reach * 0.36) / TILE) + 1;
    const top = o.horizon + 10 - 520;
    const valleys = new Culler();
    for (let i = 0; i < n; i++) {
      const x0 = i * TILE - 400;
      const img = scene.add.image(x0 + VALLEY_FALLS.canvas.x, top + VALLEY_FALLS.canvas.y, valleyLoop?.key ?? 'falls_valley', valleyLoop ? '0' : undefined).setOrigin(0, 0).setScrollFactor(0.36, 1).setDepth(-33.5);
      valleyImgs.push(img);
      const spray = scene.add.particles(x0 + FALLS.x, top + 520 - 66, 'halo', { lifespan: 2000, x: { min: -50, max: 50 }, speedX: { min: -20, max: 20 }, speedY: { min: -30, max: -8 }, scale: { start: 0.15, end: 0.5 }, alpha: { start: 0.3, end: 0 }, tint: 0xffffff, frequency: 110 }).setScrollFactor(0.36, 1).setDepth(-33);
      valleys.add([img, spray], x0 + VALLEY_FALLS.canvas.x, x0 + VALLEY_FALLS.canvas.x + VALLEY_FALLS.canvas.w, 0.36);
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
    fogs.push(fogBand(scene, fog, o.horizon - 60, 0.4, -31, 0.14, 0.9));
    // The hero waterfalls, nearer than the valley, each on a stretch of road of its own.
    const heroes = [5500, 9800].map((x) => placeFalls(scene, x, o.horizon + 60, 0.5, -29.5));
    const shafts = lightShafts(scene, 5, 0xffc89a, -30);
    haze(scene, o.horizon - 300, 300, 0xf6d9c0, 0.04, -29, 0.3);
    // Roadside: maples and birches.
    let seed = 1;
    for (let x = Math.max(1900, from(o)); x < Math.min(o.finish - 300, to(o)); x += 380 + rnd(5, seed) * 420, seed++) {
      const key = rnd(7, seed) < 0.22 ? 'birch' : `maple_${seed % 3}`;
      scene.add.image(x, o.groundY(x) + 8, key).setOrigin(0.5, 1).setDepth(-9).setScale(0.85 + rnd(9, seed) * 0.4).setFlipX(seed % 2 === 0);
    }
    // Leaves: many, in three colours, tumbling across the screen.
    const leaves = fallers(scene, 'bd_a_leaf', 40, 56, (f, i) => {
      f.vx = -0.6 - Math.random() * 1.2;
      f.vy = 0.8 + Math.random() * 1.2;
      f.spin = (Math.random() - 0.5) * 6;
      f.sway = 1.2 + Math.random();
      f.img.setTint([0xe3263a, 0xff6a30, 0xffb23f, 0xc0602e][i % 4]).setScale(0.7 + Math.random() * 0.8);
    });
    let lastScroll = 0;
    let valleyAt = 0;
    return {
      update(time, delta, scrollX) {
        const dt = delta / 1000;
        valleys.update(scrollX);
        // The distant falls are small on screen: their water moves at half the rate of the near ones.
        if (valleyLoop) {
          const f = valleyLoop.at(time);
          for (const img of valleyImgs) if (img.frame.name !== f) img.setFrame(f);
        } else if (time - valleyAt > 66) {
          valleyAt = time;
          valleyWater.draw(time, delta);
        }
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

/** A frozen lake on the valley floor, with a cabin on its shore whose window glows. */
export const CABIN = { x: 900, y: 0 };

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
  constructor(scene: Phaser.Scene, key: string, private readonly w = 512, private readonly h = 170) {
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
      // The aurora in the poster's inks: a red one, as the high passes sometimes see, burning to ember and
      // gold at its hem.
      strip([[0, 'rgba(120,40,120,0)'], [0.3, 'rgba(160,50,110,0.35)'], [0.6, 'rgba(227,38,58,0.6)'], [0.86, 'rgba(255,106,48,0.95)'], [0.95, 'rgba(255,178,63,1)'], [1, 'rgba(243,227,204,0.5)']]),
      strip([[0, 'rgba(120,40,140,0)'], [0.5, 'rgba(150,60,140,0.45)'], [0.9, 'rgba(227,80,110,0.7)'], [1, 'rgba(255,178,63,0.3)']]),
    ];
    this.seeds = Array.from({ length: w }, () => Math.random());
  }
  /** Redraws the ribbons for this moment, about fifteen times a second (eight on a phone). */
  draw(time: number) {
    if (this.last >= 0 && time - this.last < every(66, 125)) return;
    this.last = time;
    const t = time / 1000;
    const { w, h } = this;
    const ctx = this.tex.context;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    // Shapes are laid out for a 1024 × 340 canvas; this one is drawn at half that and shown just as large.
    const s = h / 340;
    const ribbon = (strip: HTMLCanvasElement, base: number, amp: number, len: number, bright: number, phase: number) => {
      amp *= s;
      len *= s;
      let prev = 0;
      // A phone paints every other ray, each twice as wide: half the work, and the aurora is soft anyway.
      const stride = LOW_POWER ? 2 : 1;
      for (let x = 0; x < w; x += stride) {
        const u = x / w;
        // The hem: a long slow S-fold, a shorter fold that travels along it, and a little ripple.
        const y =
          base +
          Math.sin(u * Math.PI * 1.6 + t * 0.1 + phase) * amp +
          Math.sin(u * Math.PI * 4.5 - t * 0.3 + phase * 2) * amp * 0.55 +
          Math.sin(u * Math.PI * 19 + t * 1.1) * amp * 0.05;
        const slope = x === 0 ? 0 : Math.abs(y - prev) / stride;
        prev = y;
        // Rays are brighter where the ribbon is seen edge-on, and shimmer in soft bands that run along it.
        const fold = Math.min(1, 0.3 + (slope / s) * 0.6);
        const shimmer = 0.7 + 0.3 * Math.sin(u * 40 + t * 2.4 + phase) * Math.sin(u * 11 - t * 0.8);
        // The ribbon thins and breaks in places, so it is not one even band across the whole sky.
        const breaks = Math.max(0, Math.sin(u * Math.PI * 2.4 + t * 0.07 + phase * 3) * 0.6 + 0.55);
        const k = fold * shimmer * breaks * bright * (0.85 + this.seeds[x] * 0.3);
        // Fade the ribbon out at both ends, so the texture has no hard edge.
        const edge = Math.min(1, u * 6, (1 - u) * 6);
        const ray = len * (0.65 + 0.35 * Math.sin(u * 30 + this.seeds[(x + 37) % w]) * 0.5 + 0.35 * fold);
        ctx.globalAlpha = Math.max(0, Math.min(1, k * edge * 0.6));
        ctx.drawImage(strip, x - 1, y - ray, 2 + stride, ray + 8 * s);
      }
    };
    ribbon(this.strips[1], h * 0.34, 40, 130, 0.5, 2.1);
    ribbon(this.strips[0], h * 0.55, 70, 190, 1, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.tex.refresh();
  }
}

/** An orange snow pole: how drivers find the road edge when everything is white. */
function snowPoleArt(): Art {
  return inked('snowpole', 30, 200, (p) => {
    p.rect(10, 10, 10, 190, { fill: '#F3E3CC', width: 3, r: 3 });
    for (let y = 14; y < 120; y += 34) p.rect(10, y, 10, 16, { fill: '#E3263A', stroke: null, r: 0 });
  });
}

const SNOW: Biome = {
  key: 'snow',
  // The violet hour on the pass, printed: ink-violet overhead, the last of the dusk a rose glow low down.
  sky: [
    [0, '#0E0A1E'],
    [0.35, '#1E1438'],
    [0.62, '#38245A'],
    [0.84, '#6A3A72'],
    [1, '#B0607A'],
  ],
  // A snow road in bone and lavender, its ruts and strata violet.
  ground: { '#C47F58': '#EDE2E6', '#9C5C48': '#B8A6CC', '#5E3A44': '#4A3470', '#B06E50': '#D6CADA', '#93594A': '#A08EBC', '#774650': '#6A5290', '#EDB27D': '#D0C2D8', '#F8CC97': '#F3E3CC', '#E2A27A': '#FFF6EA' },
  grass: { '#2F6B55': '#D6CADA', '#3E8A68': '#F3E3CC', '#4F9C74': '#C2B2D2', '#62AE7E': '#FFF6EA' },
  grip: 0.55,
  lamps: true,
  arts: () => [
    () => frostPeaksArt(true),
    () => frostPeaksArt(false),
    () => frostForestArt('bd_s_pines_far', 520, '#3A2A5E', '#C8B0D8', 61, 0.8, '#B8A4CC'),
    () => frostForestArt('bd_s_pines', 560, '#1A2E24', '#E8D2DC', 67, 1.25, '#DCCEDC'),
    () => frostMoonArt(),
    () => frostLakeArt(),
    () => snowNearArt(),
    () => snowPoleArt(),
  ],
  build(scene, o) {
    scene.add.image(0, 0, skyTexture(scene, 'sky_snow', this.sky)).setOrigin(0).setDisplaySize(1920, 1080).setScrollFactor(0).setDepth(-50);
    // Stars, twinkling.
    const stars: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 120; i++) stars.push(scene.add.image(Math.random() * 1920, Math.random() * 420, 'halo').setScrollFactor(0).setDepth(-49).setDisplaySize(6, 6).setTint(i % 9 ? 0xf3e3cc : 0xffb23f).setAlpha(0.4 + Math.random() * 0.6));
    // The aurora: a live ribbon across the whole sky, and its reflection in the frozen lake.
    const aurora = new Aurora(scene, 'aurora_live');
    aurora.draw(0);
    scene.add.image(960, -40, aurora.key).setOrigin(0.5, 0).setScrollFactor(0.02, 0).setDepth(-47).setDisplaySize(2400, 760).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.95);
    const glow = scene.add.image(960, 420, 'halo').setScrollFactor(0.02, 0).setDepth(-48).setDisplaySize(2600, 700).setTint(0xe3566a).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);
    scene.add.image(1620, 170, 'halo').setScrollFactor(0.02, 0).setDepth(-46).setDisplaySize(380, 380).setTint(0xf3c8c8).setAlpha(0.45);
    scene.add.image(1620, 170, 'bd_s_moon').setScrollFactor(0.02, 0).setDepth(-46).setScale(0.62);
    // Two ranges of peaks: the far one paler and hazier.
    tiles(scene, 'bd_s_peaks_far', o.horizon - 150, 0.05, -43, o.reach, -700);
    const fog = fogTexture(scene, 'fog_violet', '#9A86C0');
    const fogs = [fogBand(scene, fog, o.horizon - 300, 0.07, -42.5, 0.35, 1.3)];
    tiles(scene, 'bd_s_peaks', o.horizon - 60, 0.09, -42, o.reach);
    fogs.push(fogBand(scene, fog, o.horizon - 200, 0.13, -39, 0.35, 1.1));
    tiles(scene, 'bd_s_pines_far', o.horizon - 120, 0.18, -38, o.reach);
    tiles(scene, 'bd_s_pines', o.horizon - 30, 0.24, -37, o.reach, -900);
    tiles(scene, 'bd_s_lake', o.horizon + 40, 0.32, -36, o.reach, -300);
    // The cabins' windows glow in each copy of the lake; the moon shines in the ice.
    const n = Math.ceil((1920 + o.reach * 0.32) / TILE) + 1;
    for (let i = 0; i < n; i++) for (const cx of LAKE_CABINS) scene.add.image(i * TILE - 300 + cx, o.horizon + 40 - 380 + 110, 'halo').setScrollFactor(0.32, 1).setDepth(-35).setDisplaySize(130, 90).setTint(0xffc060).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD);
    const moonGlint = scene.add.image(1620, o.horizon + 40 - 380 + 230, 'halo').setScrollFactor(0.02, 1).setDepth(-35.5).setDisplaySize(70, 150).setTint(0xf3e3cc).setAlpha(0.4).setBlendMode(Phaser.BlendModes.ADD);
    haze(scene, o.horizon - 260, 260, 0x8e78b8, 0.1, -30, 0.3);
    // Roadside: snowy pines and orange snow poles marking the road edge.
    let seed = 3;
    for (let x = Math.max(1900, from(o)); x < Math.min(o.finish - 300, to(o)); x += 300 + rnd(11, seed) * 340, seed++) scene.add.image(x, o.groundY(x) + 8, FROST_TREES[Math.floor(rnd(17, seed) * FROST_TREES.length)]).setOrigin(0.5, 1).setDepth(-9).setScale(0.8 + rnd(13, seed) * 0.45).setFlipX(seed % 2 === 0);
    for (let x = Math.max(1700, from(o)); x < Math.min(o.finish, to(o)); x += 600) scene.add.image(x, o.groundY(x) + 10, 'snowpole').setOrigin(0.5, 1).setDepth(-6);
    // Snow: big soft flakes close by, fine ones far off, drifting in the wind.
    const near = fallers(scene, 'halo', 90, 57, (f) => {
      f.vx = -0.8 - Math.random() * 0.6;
      f.vy = 1.4 + Math.random() * 1.2;
      f.sway = 0.8;
      f.img.setDisplaySize(14, 14).setTint(0xfff6ea).setAlpha(0.9);
    });
    const far = fallers(scene, 'halo', 160, -28, (f) => {
      f.vx = -0.4 - Math.random() * 0.3;
      f.vy = 0.5 + Math.random() * 0.6;
      f.sway = 0.4;
      f.img.setDisplaySize(6, 6).setTint(0xf3e3cc).setAlpha(0.8);
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

/** A storefront for the main street, inked, with a sign board (the neon words are added in the game). */
export const SHOPS = [
  { name: 'DINER', colour: '#FF6A6A', wall: '#3A4A7A', awning: '#E3566A' },
  { name: 'LAUNDRY', colour: '#5ED6C2', wall: '#2E5A6A', awning: '#2E6E6A' },
  { name: 'CINEMA', colour: '#FFB23F', wall: '#4A4682', awning: '#E3263A' },
  { name: 'PIZZA', colour: '#FF8A4A', wall: '#3E4A7C', awning: '#C8502E' },
  { name: 'HOTEL', colour: '#FF8AA0', wall: '#3A4478', awning: '#5A3A6E' },
];

const TOWN: Biome = {
  key: 'town',
  // A rainy night in the city, the way illustrators love to print it: deep indigo overhead, violet low
  // down, and the city's own light glowing coral and peach along the horizon - cool above, warm below.
  sky: [
    [0, '#0B0E24'],
    [0.38, '#1A1E46'],
    [0.66, '#352C64'],
    [0.86, '#8A4A7A'],
    [1, '#F08A7A'],
  ],
  ground: { '#C47F58': '#1E2236', '#9C5C48': '#181C2E', '#5E3A44': '#0E1020', '#B06E50': '#22283E', '#93594A': '#1C2034', '#774650': '#141828', '#EDB27D': '#2E3450', '#F8CC97': '#3E4664', '#E2A27A': '#4E567A', '#FFE2BC': '#8A90B0', '#D69A6A': '#363E5A', '#B97E5E': '#2E3450' },
  grass: { '#2F6B55': '#121628', '#3E8A68': '#1C2236', '#4F9C74': '#262C44', '#62AE7E': '#323A56' },
  grip: 0.8,
  lamps: true,
  // Every picture of the town printed in one night palette: indigo and teal-navy buildings, warm amber
  // windows, and a few neon accents in coral, mint and gold.
  arts: () => [
    () => [megaArt(false), megaArt(true)].map((a) => posterize(a, ['#8A78B8', 0.5])),
    () => [cityArt('far', false), cityArt('far', true)].map((a) => posterize(a, ['#5E5498', 0.32])),
    () => [cityArt('mid', false), cityArt('mid', true)].map((a) => posterize(a, ['#3A3A70', 0.12])),
    () => [railArt(), trainArt(), wetStreetArt(), holoFishArt()].map((a) => posterize(a)),
    // The street's own buildings, drawn in the night palette already, and the plaza behind the road.
    () => SHOPS.map((s, i) => houseArt(i, { wall: s.wall, neon: s.colour, awning: s.awning })),
    () => streetArt(),
    () => synthSunArt(),
    () => blimpArt(),
    () => hoverCarArt(),
  ],
  build(scene, o) {
    scene.add.image(0, 0, skyTexture(scene, 'sky_town', this.sky)).setOrigin(0).setDisplaySize(1920, 1080).setScrollFactor(0).setDepth(-50);
    // The city's light thrown up onto the low clouds, coral at the horizon; lightning now and then.
    const glow = scene.add.image(960, 760, 'halo').setScrollFactor(0).setDepth(-48).setDisplaySize(2800, 760).setTint(0xff8a6a).setAlpha(0.32).setBlendMode(Phaser.BlendModes.ADD);
    const flash = scene.add.rectangle(0, 0, 1920, 1080, 0xe8e6ff, 0).setOrigin(0).setScrollFactor(0).setDepth(-47);
    const clouds: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 6; i++) clouds.push(scene.add.image(i * 720 - 300, 120 + ((i * 97) % 160), `bd_cloud_${i % 3}`).setScrollFactor(0.05, 1).setDepth(-46).setTint(0x3a3470).setAlpha(0.75).setScale(1.1));
    // Each lit layer twice: the buildings, then a blurred copy of only their lights, added on top to bloom.
    const layer = (key: string, bottom: number, sf: number, depth: number, offset = 0, bloom = 0.85) => {
      tiles(scene, key, bottom, sf, depth, o.reach, offset);
      for (const g of tiles(scene, `${key}_glow`, bottom, sf, depth + 0.05, o.reach, offset)) g.setBlendMode(Phaser.BlendModes.ADD).setAlpha(bloom);
    };
    // A synthwave sun, striped, sitting low behind the skyline - the city prints' favourite sky.
    scene.add.image(960, o.horizon - 430, 'halo').setScrollFactor(0.02, 1).setDepth(-47.6).setTint(0xff8a6a).setDisplaySize(1100, 700).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);
    scene.add.image(960, o.horizon - 470, 'bd_n_sun').setScrollFactor(0.02, 1).setDepth(-47.5).setScale(1.15).setAlpha(0.92);
    // Searchlights sweeping up from among the towers.
    if (!scene.textures.exists('beam')) {
      const t = scene.textures.createCanvas('beam', 120, 900)!;
      const g = t.context.createLinearGradient(0, 900, 0, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      t.context.fillStyle = g;
      t.context.beginPath();
      t.context.moveTo(54, 900);
      t.context.lineTo(66, 900);
      t.context.lineTo(120, 0);
      t.context.lineTo(0, 0);
      t.context.closePath();
      t.context.fill();
      t.refresh();
    }
    const beams = [300, 1250, 2150].map((bx, k) => scene.add.image(bx, o.horizon - 120, 'beam').setOrigin(0.5, 1).setScrollFactor(0.05, 1).setDepth(-44.6).setTint([0x5ed6c2, 0xffd27a, 0xff8aa0][k]).setAlpha(0.32).setBlendMode(Phaser.BlendModes.ADD));
    // Megatowers on the horizon, with red beacons blinking on their spires.
    layer('bd_n_mega', o.horizon - 180, 0.05, -44, 0, 0.7);
    const beacons: Phaser.GameObjects.Image[] = [];
    const megaN = Math.ceil((1920 + o.reach * 0.05) / TILE) + 1;
    for (let i = 0; i < megaN; i++) for (const [bx, by] of MEGA_BEACONS) beacons.push(scene.add.image(i * TILE + bx, o.horizon - 180 - 1100 + by, 'halo').setScrollFactor(0.05, 1).setDepth(-43.8).setDisplaySize(30, 30).setTint(0xff5a5a).setBlendMode(Phaser.BlendModes.ADD));
    haze(scene, o.horizon - 520, 420, 0xb0607a, 0.18, -43, 0.05);
    layer('bd_n_far', o.horizon - 110, 0.12, -42);
    haze(scene, o.horizon - 380, 300, 0x3a3a7a, 0.3, -41, 0.12);
    // A giant hologram fish, swimming slowly across the sky between the towers, flickering now and then.
    const fish = scene.add.image(0, o.horizon - 560, 'holo_fish').setScrollFactor(0.07, 1).setDepth(-43.4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setScale(1.3);
    // Steam rising from the street's grates.
    for (let x = Math.max(2400, from(o)); x < Math.min(o.finish - 600, to(o)); x += 1300) {
      scene.add.particles(x, o.groundY(x) + 4, 'halo', { lifespan: 2600, speedX: { min: -14, max: 14 }, speedY: { min: -60, max: -30 }, scale: { start: 0.25, end: 1.1 }, alpha: { start: 0.22, end: 0 }, tint: 0xc8c8e8, frequency: 220 }).setDepth(-5.2);
    }
    // Flying cars crossing between the towers, their lights trailing.
    const flyers = [0, 1, 2, 3].map((k) => {
      const body = scene.add.image(0, 0, 'bd_n_car').setScrollFactor(0).setDepth(-40.5).setScale(0.55).setFlipX(k % 2 === 0);
      const lamp = scene.add.image(0, 0, 'halo').setScrollFactor(0).setDepth(-40.4).setDisplaySize(26, 16).setTint(k % 2 ? 0xf3e3cc : 0xffb23f).setBlendMode(Phaser.BlendModes.ADD);
      const trail = scene.add.image(0, 0, 'halo').setScrollFactor(0).setDepth(-40.45).setDisplaySize(160, 8).setTint(k % 2 ? 0x5ed6c2 : 0xff6a6a).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
      return { body, lamp, trail, y: 160 + k * 90, speed: (0.05 + k * 0.02) * (k % 2 ? 1 : -1), off: k * 700 };
    });
    // An airship drifting over the city, an ad scrolling on its flank and a light blinking under it.
    const blimp = scene.add.image(0, o.horizon - 640, 'bd_n_blimp').setScrollFactor(0.08, 1).setDepth(-40.8).setScale(0.9);
    const ads = ['MOVING DAY?', 'NOODLES 24/7', 'SKY TAXI', 'BOX CO.', 'NEON HOTEL'];
    const ad = scene.add.text(0, 0, ads[0], { fontFamily: '"Anton", "Impact", sans-serif', fontSize: '30px', color: '#5ED6C2', letterSpacing: 2 }).setOrigin(0.5).setScrollFactor(0.08, 1).setDepth(-40.7).setShadow(0, 0, '#5ED6C2', 10, true, true);
    const blimpLight = scene.add.image(0, 0, 'halo').setScrollFactor(0.08, 1).setDepth(-40.7).setDisplaySize(40, 40).setTint(0xff5a5a).setBlendMode(Phaser.BlendModes.ADD);
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
        const c = [0xff6a6a, 0x5ed6c2, 0xffb23f][(i + k) % 3];
        const panel = scene.add.rectangle(x, y, b.w, b.h, c, 0.28).setScrollFactor(0.25, 1).setDepth(-37.85).setStrokeStyle(3, c, 0.9);
        const halo = scene.add.image(x, y, 'halo').setScrollFactor(0.25, 1).setDepth(-37.84).setDisplaySize(b.w * 1.6, b.h * 2.2).setTint(c).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
        const text = scene.add.text(x, y, words[(i * 3 + k) % words.length], { fontFamily: '"Anton", "Impact", sans-serif', fontSize: '30px', color: '#F3E3CC', letterSpacing: 2 }).setOrigin(0.5).setScrollFactor(0.25, 1).setDepth(-37.83).setShadow(0, 0, Phaser.Display.Color.IntegerToColor(c).rgba, 12, true, true);
        text.setScale(Math.min(1, (b.w * 0.86) / text.width));
        boards.push({ text, panel, halo, n: i * 3 + k });
      });
    }
    haze(scene, o.horizon - 300, 260, 0x1e2448, 0.3, -37, 0.25);
    // Street level: a plaza between the road and the city, so the buildings and the railway's pillars stand on
    // something instead of floating over a gap of sky.
    tiles(scene, 'bd_n_street', o.horizon - 70 + (500 - STREET_TOP), 0.33, -36.5, o.reach);
    // The elevated railway, and a train along it now and then.
    tiles(scene, 'bd_n_rail', o.horizon + 60, 0.42, -36, o.reach);
    const deckY = o.horizon + 60 - 520 + RAIL_DECK;
    const train = scene.add.image(0, deckY + 4, 'bd_n_train').setOrigin(0, 1).setScrollFactor(0.42, 1).setDepth(-35.9);
    const trainGlow = scene.add.image(0, deckY - 46, 'halo').setScrollFactor(0.42, 1).setDepth(-35.85).setDisplaySize(1600, 70).setTint(0xffd27a).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    // Main street: storefronts behind the road, each with a buzzing neon sign and its reflection.
    const signs: { glow: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text; buzz: number }[] = [];
    let i = 0;
    for (let x = Math.max(2200, from(o)); x < Math.min(o.finish - 600, to(o)); x += 900 + rnd(17, i) * 500, i++) {
      // Keep the shops clear of the gate signs and the locals' signs, so nothing hides their neon.
      if (o.busy?.some((bx) => Math.abs(bx - x) < 480)) continue;
      const n = i % SHOPS.length;
      const k = 0.85;
      const gy = Math.min(o.groundY(x - 170), o.groundY(x), o.groundY(x + 170)) + 8;
      scene.add.image(x, gy, `shop_${n}`).setOrigin(0.5, HOUSE.ground / HOUSE.h).setDepth(-9).setScale(k);
      const sy = gy - (460 - 242) * k;
      const text = scene.add.text(x, sy, SHOPS[n].name, { fontFamily: '"Anton", "Impact", sans-serif', fontSize: '44px', color: SHOPS[n].colour, stroke: '#0A0712', strokeThickness: 2, letterSpacing: 3 }).setOrigin(0.5).setDepth(-8.9).setShadow(0, 0, SHOPS[n].colour, 16, true, true);
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
      g.addColorStop(0, 'rgba(210,215,255,0)');
      g.addColorStop(1, 'rgba(225,228,255,0.85)');
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
        beams.forEach((bm, k) => bm.setRotation(Math.sin(time / (2600 + k * 700) + k * 2) * 0.45).setAlpha(0.24 + Math.sin(time / 900 + k) * 0.06));
        // The airship, crossing slowly; its ad changes every few seconds.
        const bx = scrollX * 0.08 + 2400 - ((time * 0.018) % 3200);
        const by = o.horizon - 640 + Math.sin(time / 2200) * 10;
        blimp.setPosition(bx, by);
        ad.setPosition(bx - 10, by - 10);
        blimpLight.setPosition(bx - 10, by + 80).setAlpha(Math.floor(time / 600) % 2 ? 0.9 : 0.1);
        const adNow = ads[Math.floor(time / 4000) % ads.length];
        if (ad.text !== adNow) ad.setText(adNow);
        // The fish: across the sky and round again, its body rippling, now and then glitching.
        fish.x = scrollX * 0.07 + 2200 - ((time * 0.03) % 3000);
        fish.y = o.horizon - 560 + Math.sin(time / 1800) * 24;
        fish.setScale(1.3, 1.3 + Math.sin(time / 400) * 0.05).setAlpha(Math.random() < 0.02 ? 0.15 : 0.5 + Math.sin(time / 700) * 0.08);
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
          const e = scene.add.ellipse(x, 900 + Math.random() * 30, 6, 2, 0xdfe2ff, 0.6).setDepth(1);
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

function beachHutArt(n: number): Art {
  const colour = ['#EE6A4D', '#3FA7B5', '#FFB23F', '#7FC07A'][n];
  return inked(`hut_${n}`, 140, 180, (p) => {
    p.rect(20, 60, 100, 118, { fill: '#F4F0E8', width: 4, r: 2 });
    for (let x = 26; x < 116; x += 18) p.rect(x, 64, 9, 112, { fill: colour, stroke: null, r: 0 });
    p.shape([[10, 64], [70, 16], [130, 64]], { fill: colour, width: 4, raw: true });
    p.rect(52, 110, 36, 68, { fill: '#5A4A4E', width: 3, r: 2 });
  });
}

const COAST: Biome = {
  key: 'coast',
  // A bright seaside morning, printed: clear teal overhead, warming to cream at the horizon.
  sky: [
    [0, '#2E7A9A'],
    [0.45, '#6EB4C0'],
    [0.8, '#BFE0D0'],
    [1, '#F6E2BC'],
  ],
  // The marine drive: a warm grey road over sand-coloured ground.
  ground: { '#C47F58': '#D9B48A', '#9C5C48': '#B8906A', '#5E3A44': '#6A4A3E', '#B06E50': '#C8A47A', '#93594A': '#A8805E', '#774650': '#7E5A48', '#EDB27D': '#E8CFA6', '#F8CC97': '#F6E2BC' },
  // Dune grass at the road's edge, olive into sand.
  grass: { '#2F6B55': '#7E8A44', '#3E8A68': '#A3A653', '#4F9C74': '#D9C08A', '#62AE7E': '#F2C98A' },
  grip: 1,
  lamps: false,
  arts: () => [
    () => [0, 1, 2].map((n) => recolor(printCloudArt(n), `bd_cloud_white_${n}`, { '#FFF1DE': '#FFFAF0', '#FFC29E': '#E2F0EA', '#FF6A30': '#A8D4CC' })),
    () => birdArts().map((a) => recolor(a, a.key.replace('bd_bird', 'bd_gull'), { '#3B2F55': '#F4F6FA', '#0A0712': '#F4F6FA' })),
    () => coastSunArt(),
    () => seaArt(),
    () => headlandsArt(),
    () => bayArt(),
    () => wavesArt(),
    () => coveArt(),
    () => surfArt(),
    () => palmArt(),
    () => promLampArt(),
    () => dolphinArt(),
    () => sailArt(),
    () => beachHutArt(0),
    () => beachHutArt(1),
    () => beachHutArt(2),
    () => beachHutArt(3),
  ],
  build(scene, o) {
    scene.add.image(0, 0, skyTexture(scene, 'sky_coast', this.sky)).setOrigin(0).setDisplaySize(1920, 1080).setScrollFactor(0).setDepth(-50);
    // The sun, printed, high over the bay, and its glitter path on the water.
    scene.add.image(1500, 230, 'halo').setScrollFactor(0.03).setDepth(-46).setTint(0xfff0c8).setDisplaySize(760, 760).setAlpha(0.7);
    scene.add.image(1500, 230, 'bd_c_sun').setScrollFactor(0.03).setDepth(-45).setScale(0.7);
    const clouds: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 7; i++) clouds.push(scene.add.image(i * 640 - 300, 110 + ((i * 89) % 170), `bd_cloud_white_${i % 3}`).setScrollFactor(0.05, 1).setDepth(-44).setScale(0.8 + (i % 3) * 0.15));
    const seaTop = o.horizon - 380;
    tiles(scene, 'bd_c_sea', seaTop + 400, 0.06, -42.5, o.reach);
    tiles(scene, 'bd_c_far', seaTop + 14, 0.09, -42, o.reach, -500);
    const glitter: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 60; i++) glitter.push(scene.add.image(1500 + (Math.random() - 0.5) * (50 + i * 7), seaTop + 10 + i * 6.5, 'halo').setScrollFactor(0.03, 1).setDepth(-41).setDisplaySize(26 + Math.random() * 40, 4).setTint(0xfff4d8).setBlendMode(Phaser.BlendModes.ADD));
    // Sailboats out on the open sea.
    const boats = [0, 1, 2, 3].map((i) => scene.add.image(300 + i * 560, seaTop + 60 + (i % 2) * 50, 'bd_c_sail').setScrollFactor(0.07, 1).setDepth(-41).setScale(0.45 + (i % 2) * 0.2).setFlipX(i % 2 === 1));
    // The bay, with its pier and lighthouse; crests drifting over the water so it moves.
    const bayBottom = o.horizon + 10;
    tiles(scene, 'bd_c_cliffs', bayBottom, 0.22, -38, o.reach, -700);
    const waves = scene.add.tileSprite(-700, bayBottom - 200, 1920 + o.reach * 0.22 + TILE, 200, 'bd_c_waves').setOrigin(0, 0).setScrollFactor(0.22, 1).setDepth(-37.95).setAlpha(0.5);
    const lamps: Phaser.GameObjects.Image[] = [];
    const cn = Math.ceil((1920 + o.reach * 0.22) / TILE) + 1;
    for (let i = 0; i < cn; i++) lamps.push(scene.add.image(i * TILE - 700 + LIGHT.x, bayBottom - 600 + LIGHT.lampY, 'halo').setScrollFactor(0.22, 1).setDepth(-37.5).setDisplaySize(120, 120).setTint(0xfff0a0).setBlendMode(Phaser.BlendModes.ADD));
    // Dolphins leaping in the bay now and then, with a splash.
    const dolphin = scene.add.image(0, 0, 'bd_c_dolphin').setScrollFactor(0.22, 1).setDepth(-37.6).setVisible(false).setScale(0.8);
    let nextLeap = 2500;
    let leap = -1;
    let leapX = 0;
    const leapY = bayBottom - 150;
    haze(scene, o.horizon - 330, 300, 0xeaf6f0, 0.14, -35, 0.22);
    // The beach, nearer, and its surf washing up and down the sand.
    const coveBottom = o.horizon + 70;
    tiles(scene, 'bd_c_cove', coveBottom, 0.36, -34, o.reach, -300);
    const surf = scene.add.tileSprite(-300, coveBottom - COVE.h + COVE.edge - 20, 1920 + o.reach * 0.36 + TILE, 40, 'bd_c_surf').setOrigin(0, 0).setScrollFactor(0.36, 1).setDepth(-33.9);
    const surfY = surf.y;
    // The promenade: a white balustrade along the road, seafront lamps and palms, a beach hut now and then.
    const x0 = Math.max(1800, from(o));
    const x1 = Math.min(o.finish - 300, to(o));
    // Drawn a strip at a time, so only the stretch on screen is drawn each frame.
    const culler = new Culler();
    strips(scene, culler, x0, x1, -8.8, (rail, a, b) => {
      const first = x0 + Math.ceil((a - x0) / 22) * 22;
      for (let x = first; x < b; x += 22) {
        const y = o.groundY(x) + 4;
        rail.fillStyle(0xf3e3cc, 1).fillRect(x - 4, y - 40, 8, 40);
        rail.fillStyle(0xd9c3a6, 1).fillRect(x + 1, y - 40, 3, 40);
      }
      for (const [width, colour, alpha, lift] of [[10, 0xf3e3cc, 1, 44], [2.5, 0x0a0712, 0.8, 49]] as const) {
        rail.lineStyle(width, colour, alpha).beginPath();
        // One post past the strip's end, so the rails of neighbouring strips meet.
        for (let x = first, i = 0; x <= Math.min(x1, b + 22); x += 22, i++) {
          const y = o.groundY(x) + 4 - lift;
          if (i === 0) rail.moveTo(x, y);
          else rail.lineTo(x, y);
        }
        rail.strokePath();
      }
    });
    let seed = 7;
    for (let x = x0 + 120; x < x1; x += 300 + rnd(19, seed) * 200, seed++) {
      const r = rnd(21, seed);
      const key = r < 0.45 ? 'palm' : r < 0.8 ? 'bd_c_lamp' : `hut_${seed % 4}`;
      scene.add.image(x, o.groundY(x) + 8, key).setOrigin(0.5, 1).setDepth(-9).setScale(key === 'palm' ? 0.9 + rnd(23, seed) * 0.2 : key === 'bd_c_lamp' ? 0.95 : 0.85).setFlipX(key === 'palm' && seed % 2 === 0);
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
        culler.update(scrollX);
        for (const c of clouds) c.x += dt * 5;
        glitter.forEach((g, i) => g.setAlpha(Math.max(0, Math.sin(time / 260 + i * 1.7)) * 0.9));
        boats.forEach((b, i) => {
          b.x += dt * (4 + i) * (i % 2 ? -1 : 1);
          b.y += Math.sin(time / 700 + i) * 0.05;
          b.rotation = Math.sin(time / 900 + i) * 0.05;
        });
        waves.tilePositionX = time * 0.01;
        waves.setAlpha(0.42 + Math.sin(time / 1500) * 0.1);
        for (const l of lamps) l.setAlpha(Math.sin(time / 600) > 0.3 ? 0.9 : 0.15);
        // A dolphin's leap: up out of the water in an arc and back down, every so often.
        nextLeap -= delta;
        if (leap < 0 && nextLeap < 0) {
          leap = 0;
          leapX = scrollX * 0.22 + 300 + Math.random() * 1300;
          dolphin.setVisible(true);
        }
        if (leap >= 0) {
          leap += dt / 1.3;
          const u = Math.min(1, leap);
          dolphin.setPosition(leapX + u * 220, leapY - Math.sin(u * Math.PI) * 110).setRotation(-0.9 + u * 1.8);
          if (leap >= 1) {
            leap = -1;
            nextLeap = 3500 + Math.random() * 5000;
            dolphin.setVisible(false);
          }
        }
        // The surf washes up the sand and draws back, every few seconds.
        const wash = Math.sin(time / 1300);
        surf.setY(surfY + wash * 7).setAlpha(0.7 + wash * 0.25);
        surf.tilePositionX = time * 0.004;
        for (const g of gulls) {
          g.t += dt;
          g.img.x += g.vx * 60 * dt - pan * 0.4;
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
  // Old Street's road in the poster's inks: ember-brown earth, red-brown strata, oxblood deep down,
  // and a gold-sand dirt surface.
  ground: { '#C47F58': '#A8452E', '#9C5C48': '#7A2A2E', '#5E3A44': '#3A0F22', '#B06E50': '#94402E', '#93594A': '#6E2630', '#774650': '#4A1428', '#EDB27D': '#E0904A', '#F8CC97': '#F2C98A', '#E2A27A': '#FF8A4A' },
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

/**
 * Prints a picture of the town in one night palette, mapping every colour in it by its family, for the
 * cool-against-warm look of the city prints people pin: dark and muted tones (walls, roofs, shadows) become
 * indigo, or teal-navy where they were teal, at the same lightness; lit windows and pale blue lights turn
 * warm amber; neon becomes a few clear accents - cyan to mint, violet and magenta to coral and rose, green
 * to gold - and near-whites a warm white.
 */
export function posterize(art: Art, haze?: [string, number]): Art {
  const toHsl = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    const d = mx - mn;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s, l];
  };
  const toHex = (h: number, s: number, l: number) => {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const map = (hex: string) => {
    const [h, s, l] = toHsl(hex);
    if (l > 0.86 && s < 0.6) return toHex(38, 0.7, Math.min(0.93, l * 0.98));
    const warm = h < 50 || h > 345;
    if (l < 0.5 || s < 0.35) {
      // Structure: indigo night, or teal-navy where it was teal, keeping how light or dark it was.
      if (warm && s > 0.3 && l > 0.3) return toHex(h, Math.min(0.7, s), l);
      const c = toHex(h >= 150 && h < 215 ? 202 : 232, Math.min(0.42, s * 0.55 + 0.12), l * 0.95);
      // Distance: far layers sink into the violet haze, so the skyline reads in planes.
      return haze ? mix(c, haze[0], haze[1]).toUpperCase() : c;
    }
    // Lights.
    if (warm) return hex;
    if (h >= 150 && h < 200) return toHex(168, 0.6, Math.min(0.7, Math.max(0.58, l)));
    if (h >= 200 && h < 260) return toHex(40, 1, Math.max(0.68, l * 0.95));
    if (h >= 260 && h <= 345) return toHex(h < 300 ? 350 : 0, 0.95, Math.min(0.72, Math.max(0.62, l)));
    return toHex(40, 1, Math.max(0.6, l));
  };
  return { ...art, svg: art.svg.replace(/#[0-9A-Fa-f]{6}\b/g, (m) => map(m)) };
}

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

