import Phaser from 'phaser';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/silkscreen/400.css';
import { PX, glowPX, hex, mixRGB, noise1, seeded, bayer, type RGB } from './px';

/**
 * Art direction sample: "Pinecrest Fuel & Pie" at dusk, on the mountain road.
 *
 * The whole scene is drawn at 640×360 and scaled up with hard pixels. Lighting is layered on top
 * with additive glows (lamps, neon, headlights, the canopy's strip lights), and the wet road carries
 * a mirrored, rippled reflection plus vertical light streaks, the way real wet asphalt does.
 * Depth comes from aerial perspective: each layer further back is lighter, cooler and lower in contrast.
 */

const W = 640;
const H = 360;
const WORLD = 1500;
/** Where the road surface begins (its far edge), and where the truck's tyres sit. */
const ROAD = 298;
const LANE = 322;
const FONT = '"Pixelify Sans", monospace';
const SMALL = '"Silkscreen", monospace';

// ---- The dusk palette. Every colour in the scene comes from here.
const P = {
  skyTop: hex('#0d0b1f'),
  sky1: hex('#1d1840'),
  sky2: hex('#3b2763'),
  sky3: hex('#7a3a72'),
  sky4: hex('#c4566a'),
  sky5: hex('#f08a5d'),
  sky6: hex('#ffc47e'),
  cloud: hex('#4a2f63'),
  cloudLit: hex('#f2a08f'),
  cloudHot: hex('#ffd1a1'),
  mtnFar: hex('#5a4a86'),
  mtnFarShade: hex('#45386f'),
  snow: hex('#a99fd0'),
  snowLit: hex('#ffc2b0'),
  mtnMid: hex('#352c5e'),
  mtnMidLit: hex('#6a4f86'),
  forestFar: hex('#2a2350'),
  forestMid: hex('#1d1838'),
  forestNear: hex('#120f24'),
  rim: hex('#e07a7a'),
  fog: hex('#8a6a9e'),
  ground: hex('#0f0c1c'),
  asphalt: hex('#1a1630'),
  asphaltWet: hex('#2a2348'),
  paint: hex('#8f7f9a'),
  kerb: hex('#3a3358'),
  grass: hex('#16122a'),
  grassLit: hex('#2b2a4a'),
  steel: hex('#2b2742'),
  steelLit: hex('#5b5680'),
  canopy: hex('#e9e3d2'),
  canopyShade: hex('#a9a1b8'),
  red: hex('#d8433b'),
  redDark: hex('#8f2633'),
  wall: hex('#3a2f4f'),
  wallShade: hex('#2a2240'),
  window: hex('#ffcf7a'),
  windowDeep: hex('#e8964f'),
  sodium: hex('#ffb35c'),
  neonPink: hex('#ff5c8a'),
  neonCyan: hex('#5cf2ff'),
  fluoro: hex('#effff2'),
  teal: hex('#2f8f9d'),
  tealShade: hex('#1d5f6c'),
  tealLit: hex('#86dbe2'),
  cream: hex('#f0e2c4'),
  creamShade: hex('#b8a48c'),
  tyre: hex('#120f1c'),
  hub: hex('#c9c3d8'),
  ink: hex('#0a0814'),
  box: hex('#b07a4f'),
  boxShade: hex('#7d5238'),
  ginger: hex('#f09a35'),
};

/** How each kind of light falls off, across its own box (u, v from 0 to 1). */
const SHAPES = {
  glow: (u: number, v: number) => Math.pow(Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.5) * 2), 1.6),
  cone: (u: number, v: number) => (1 - (Math.abs(u - 0.5) * 2) / Math.max(0.12, v)) * (1 - v * 0.85) * 1.15,
  beam: (u: number, v: number) => (1 - (Math.abs(v - 0.5) * 2) / Math.max(0.1, u * 0.9)) * (1 - u) * 1.3,
  streak: (u: number, v: number) => (1 - Math.abs(u - 0.5) * 2) * (1 - v) * 1.2,
  pool: (u: number, v: number) => (1 - Math.hypot((u - 0.5) * 2, (v - 0.5) * 2)) * 1.1,
};

const hexNum = (c: RGB) => (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);

class Dusk extends Phaser.Scene {
  private truck!: Phaser.GameObjects.Container;
  private wheels: Phaser.GameObjects.Image[] = [];
  private beam!: Phaser.GameObjects.Image;
  private beamPool!: Phaser.GameObjects.Image;
  private tail!: Phaser.GameObjects.Image;
  private drops: { img: Phaser.GameObjects.Image; vy: number }[] = [];
  private flickers: { obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text; base: number; rate: number }[] = [];
  private moths: { img: Phaser.GameObjects.Image; cx: number; cy: number; t: number; r: number }[] = [];
  private flies: { img: Phaser.GameObjects.Image; x: number; y: number; t: number }[] = [];
  private fogs: { img: Phaser.GameObjects.TileSprite; speed: number }[] = [];
  private stars: Phaser.GameObjects.Image[] = [];
  private streaks: { img: Phaser.GameObjects.Image; base: number }[] = [];
  private truckX = -160;
  private stage: 'arrive' | 'parked' | 'leave' = 'arrive';
  private stageTime = 0;
  private banner!: Phaser.GameObjects.Container;
  private wheelTurn = 0;

  constructor() {
    super('dusk');
  }

  create() {
    this.makeTextures();
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD, H);
    cam.setRoundPixels(true);

    // Sky, sun-glow and stars: fixed to the screen.
    this.add.image(0, 0, 'sky').setOrigin(0).setScrollFactor(0).setDepth(-100);
    const r = seeded(4);
    for (let i = 0; i < 70; i++) {
      const s = this.add.image(r() * W, r() * 150, 'star').setScrollFactor(0.02).setDepth(-98).setAlpha(0.3 + r() * 0.7);
      if (r() < 0.15) s.setScale(2);
      this.stars.push(s);
    }
    this.light(470, 200, 'glow', 640, 300, 0xff8a52, 0.55, -96).setScrollFactor(0.05);
    this.light(480, 228, 'glow', 300, 110, 0xffd08a, 0.7, -96).setScrollFactor(0.05);
    // The moon, rising over the far peaks, cold against the warm horizon.
    this.light(120, 70, 'glow', 90, 90, 0xb9c6ff, 0.35, -97).setScrollFactor(0.03);
    this.add.image(120, 70, 'moon').setScrollFactor(0.03).setDepth(-96);
    this.add.image(0, 0, 'clouds').setOrigin(0).setScrollFactor(0.08).setDepth(-94);

    // Mountains and forest, back to front, each with a band of mist at its foot.
    const layer = (key: string, f: number, depth: number) => this.add.image(0, 0, key).setOrigin(0).setScrollFactor(f, 1).setDepth(depth);
    layer('mtnFar', 0.12, -90);
    this.fog('fog', 0.16, -88, 214, 0.55, 3);
    layer('mtnMid', 0.25, -80);
    this.fog('fog', 0.3, -78, 238, 0.5, 5);
    layer('forestFar', 0.42, -70);
    this.fog('fog', 0.48, -68, 262, 0.45, 7);
    layer('forestMid', 0.62, -60);

    // Fireflies in the trees.
    for (let i = 0; i < 18; i++) {
      const x = r() * WORLD;
      const y = 240 + r() * 45;
      this.flies.push({ img: this.light(x, y, 'glow', 7, 7, 0xfff0a0, 1, -58).setScrollFactor(0.62, 1), x, y, t: r() * 10 });
    }

    // The fuel stop, the street lamps, the road with its reflections.
    this.add.image(0, 0, 'forestNear').setOrigin(0).setDepth(-50);
    this.station();
    this.lamps();
    this.add.image(0, ROAD, 'road').setOrigin(0).setDepth(-20);
    this.reflections();

    // The truck, arriving to park at the pump.
    this.makeTruck();

    // Drizzle, mist close to the camera, and dark grass and posts framing the bottom.
    for (let i = 0; i < 150; i++) {
      this.drops.push({ img: this.add.image(r() * W, r() * H, 'drop').setScrollFactor(0).setDepth(5).setAlpha(0.25 + r() * 0.35), vy: 3 + r() * 2.5 });
    }
    this.fog('fogNear', 1.1, 8, 300, 0.22, 14);
    this.add.image(0, H, 'foreground').setOrigin(0, 1).setScrollFactor(1.35, 1).setDepth(10);
    this.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(20);

    // The checkpoint card, shown once the truck is parked.
    this.makeBanner();
    this.add.text(8, 6, 'SHIFTING DAY  ·  ART DIRECTION SAMPLE  ·  DUSK FUEL STOP', { fontFamily: SMALL, fontSize: '8px', color: '#cfc4e6' }).setScrollFactor(0).setDepth(30).setAlpha(0.7).setResolution(1);
  }

  /** A band of mist that drifts sideways. */
  private fog(key: string, f: number, depth: number, y: number, alpha: number, speed: number) {
    const t = this.add.tileSprite(0, y, W * 3, 64, key).setOrigin(0, 0.5).setScrollFactor(f, 1).setDepth(depth).setAlpha(alpha);
    this.fogs.push({ img: t, speed });
  }

  // ---------------------------------------------------------------- Textures

  /** A white light shape at exactly the size it will be drawn, made the first time it is asked for. */
  private lightTex(kind: keyof typeof SHAPES, w: number, h: number) {
    w = Math.max(2, Math.round(w));
    h = Math.max(2, Math.round(h));
    const key = `${kind}_${w}x${h}`;
    if (!this.textures.exists(key)) glowPX(w, h, SHAPES[kind], kind === 'streak' ? 5 : 7).texture(this.textures, key);
    return key;
  }

  /** An additive light in the scene. */
  private light(x: number, y: number, kind: keyof typeof SHAPES, w: number, h: number, tint: number, alpha: number, depth: number) {
    return this.add.image(x, y, this.lightTex(kind, w, h)).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(alpha).setDepth(depth);
  }

  private makeTextures() {
    const T = this.textures;
    // Sky: indigo above, through violet and rose, to a hot horizon where the sun has just gone.
    const sky = new PX(W, H);
    sky.vgrad(0, 0, W, 280, [
      [0, P.skyTop],
      [0.18, P.sky1],
      [0.36, P.sky2],
      [0.52, P.sky3],
      [0.64, P.sky4],
      [0.76, P.sky5],
      [0.88, P.sky6],
      [1, P.sky6],
    ]);
    sky.rect(0, 280, W, 80, P.sky6);
    sky.texture(T, 'sky');

    const star = new PX(1, 1);
    star.set(0, 0, hex('#fff6e6'));
    star.texture(T, 'star');
    const dot = new PX(2, 2);
    dot.rect(0, 0, 2, 2, [255, 255, 255]);
    dot.texture(T, 'dot');
    const drop = new PX(1, 4);
    drop.vgrad(0, 0, 1, 4, [
      [0, hex('#6f6798')],
      [1, hex('#d8d0f0')],
    ]);
    drop.texture(T, 'drop');


    this.cloudTexture();
    this.mountains();
    this.forests();
    this.roadTexture();
    this.fogTextures();
    this.foreground();
    this.vignette();
  }

  /** Banks of cumulus: bodies in shadow, lit hot from underneath by the sun that has just set. */
  private cloudTexture() {
    const w = W + 120;
    const h = 230;
    const p = new PX(w, h);
    const mask = new Uint8Array(w * h);
    const r = seeded(21);
    for (let k = 0; k < 7; k++) {
      const cy = 60 + r() * 140;
      const cx = r() * w;
      const len = 140 + r() * 260;
      const tall = 16 + r() * 22 * (1 - cy / 300);
      for (let b = 0; b < 14; b++) {
        const u = b / 13;
        const bx = cx - len / 2 + u * len + (r() - 0.5) * 12;
        const br = tall * Math.sin(Math.PI * (0.15 + u * 0.7)) * (0.6 + r() * 0.6);
        const by = cy - br * 0.3;
        for (let y = Math.floor(by - br); y < cy + 2; y++) {
          for (let x = Math.floor(bx - br * 1.6); x < bx + br * 1.6; x++) {
            if (x < 0 || y < 0 || x >= w || y >= h) continue;
            if (((x - bx) / (br * 1.6)) ** 2 + ((y - by) / br) ** 2 <= 1 && y <= cy + 1) mask[y * w + x] = 1;
          }
        }
      }
    }
    // Colour each column of each cloud from its underside up: hot rim, lit belly, shadowed body.
    for (let x = 0; x < w; x++) {
      let run = 0;
      for (let y = h - 1; y >= 0; y--) {
        if (!mask[y * w + x]) {
          run = 0;
          continue;
        }
        run++;
        const heat = Math.min(1, (y / h) * 1.25);
        let c = P.cloud;
        if (run <= 1) c = heat > 0.6 ? P.cloudHot : P.cloudLit;
        else if (run <= 4) c = bayer(x, y) < 0.75 ? P.cloudLit : P.cloud;
        else if (run <= 8) c = bayer(x, y) < 0.3 * heat ? P.cloudLit : P.cloud;
        // The very top catches a little cool light from the sky above.
        if (y > 0 && !mask[(y - 1) * w + x]) c = mixRGB(c, P.sky2, 0.25);
        p.set(x, y, c);
      }
    }
    p.texture(this.textures, 'clouds');

    const moon = new PX(16, 16);
    moon.ellipse(8, 8, 7, 7, hex('#e9ecff'));
    moon.ellipse(10, 9, 5, 5, hex('#c7cdf0'));
    moon.ellipse(5, 6, 1, 1, hex('#b4bce6'));
    moon.ellipse(9, 11, 1, 1, hex('#aeb6e2'));
    moon.texture(this.textures, 'moon');
  }

  /**
   * Two ranges of mountains. The far range is tall and alpine: faceted faces, lit on the sides that
   * turn toward the afterglow on the right, snow on the peaks, a hot rim along the ridgeline, and mist
   * rising from the valley at its foot. The middle range is lower, darker and simpler.
   */
  private mountains() {
    const fw = Math.round(W + (WORLD - W) * 0.12) + 20;
    const fh = 290;
    const far = new PX(fw, fh);
    const n = noise1(3);
    const nf = noise1(8);
    const ridged = (x: number) => 1 - Math.abs(n(x, 4) * 2 - 1);
    const ridge = (x: number) => 230 - ridged(x * 0.0045) * 150 - n(x * 0.02, 3) * 18;
    const LIT = hex('#7563a6');
    const SHADE = hex('#4a3d7c');
    const SNOW = hex('#a59dd2');
    const SNOWLIT = hex('#ffd2c2');
    const RIM = hex('#ffae9a');
    far.columns(0, fw, ridge, fh, (x, y, d) => {
      // Facets: a diagonal noise field whose slope decides which way each face turns.
      const g = (xx: number) => nf(xx * 0.018 - y * 0.03 + nf(y * 0.05 + xx * 0.004) * 2, 3);
      const turn = g(x + 2) - g(x - 2) + (ridge(x - 2) - ridge(x + 2)) * -0.01;
      const lit = turn > 0.012 ? 1 : turn > 0.002 ? 0.5 : 0;
      const snowLine = 130 + n(x * 0.03) * 34;
      const isSnow = y < snowLine && d < 48;
      let c: RGB;
      if (isSnow) c = lit > 0.6 || (lit > 0.3 && bayer(x, y) < 0.5) ? SNOWLIT : SNOW;
      else c = lit > 0.6 || (lit > 0.3 && bayer(x, y) < 0.5) ? LIT : SHADE;
      if (d < 2 && lit > 0.3) c = RIM;
      // Aerial perspective: the lower slopes melt into the valley mist.
      const mist = Math.max(0, (y - 200) / 90);
      if (mist > bayer(x, y)) c = mixRGB(c, P.fog, 0.55);
      return c;
    });
    far.texture(this.textures, 'mtnFar');

    const mw = Math.round(W + (WORLD - W) * 0.25) + 20;
    const mid = new PX(mw, 300);
    const n2 = noise1(17);
    const ridge2 = (x: number) => 205 - (1 - Math.abs(n2(x * 0.007, 4) * 2 - 1)) * 70;
    mid.columns(0, mw, ridge2, 300, (x, y, d) => {
      const turn = ridge2(x - 2) - ridge2(x + 2);
      if (turn < -0.6 && d < 3) return P.mtnMidLit;
      if (turn < -0.6 && d < 14 && bayer(x, y) < 0.3) return P.mtnMidLit;
      const mist = Math.max(0, (y - 235) / 50);
      return mist > bayer(x, y) ? mixRGB(P.mtnMid, P.fog, 0.4) : P.mtnMid;
    });
    mid.texture(this.textures, 'mtnMid');
  }

  /**
   * Pines in three rows. Each tree is drawn on its own, in tiers of drooping branches, with heights
   * that vary a lot (young firs, old giants, the odd dead snag), so the line never reads as a comb.
   */
  private forests() {
    const rows: [string, number, number, number, RGB, number][] = [
      ['forestFar', 0.42, 252, 26, P.forestFar, 5],
      ['forestMid', 0.62, 270, 48, P.forestMid, 8],
      ['forestNear', 1, 300, 92, P.forestNear, 12],
    ];
    rows.forEach(([key, f, base, tall, colour, spacing], k) => {
      const w = Math.round(W + (WORLD - W) * f) + 40;
      const p = new PX(w, H);
      const r = seeded(30 + k);
      const fill = new Uint8Array(w * H);
      const put = (x: number, y: number) => {
        if (x >= 0 && x < w && y >= 0 && y < H) fill[y * w + x] = 1;
      };
      for (let x = -20; x < w + 20; ) {
        const cluster = r() < 0.25;
        x += spacing * (cluster ? 0.4 + r() * 0.4 : 0.7 + r() * 1.4);
        if (key === 'forestNear' && x > 700 && x < 1130) continue;
        const kind = r();
        const h = tall * (kind < 0.15 ? 0.35 + r() * 0.2 : kind > 0.9 ? 1.2 + r() * 0.3 : 0.6 + r() * 0.45);
        const top = base - h;
        const xi = Math.round(x);
        if (kind > 0.97) {
          // A dead snag: a bare trunk with a couple of broken arms.
          for (let y = Math.round(top); y < base; y++) put(xi, y);
          put(xi - 1, Math.round(top + h * 0.3));
          put(xi + 1, Math.round(top + h * 0.5));
          continue;
        }
        const tiers = 4 + Math.floor(h / 14);
        for (let t = 0; t < tiers; t++) {
          const ty = top + (t / tiers) * h * 0.9;
          const th = (h / tiers) * 1.5;
          const half = ((t + 1) / tiers) * h * 0.24 + 1;
          for (let yy = 0; yy < th; yy++) {
            const span = Math.round((yy / th) * half);
            const droop = yy > th - 2 ? 1 : 0;
            for (let dx = -span; dx <= span; dx++) put(xi + dx, Math.round(ty + yy + (Math.abs(dx) === span ? droop : 0)));
          }
        }
        for (let y = Math.round(base - h * 0.1); y < base; y++) put(xi, y);
      }
      const bottom = key === 'forestNear' ? ROAD : base + 34;
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < bottom; y++) {
          if (!fill[y * w + x] && y < base) continue;
          let c = colour;
          const edge = y > 0 && !fill[(y - 1) * w + x] && y < base;
          if (edge && k > 0) c = mixRGB(colour, P.rim, k === 2 ? 0.55 : 0.35);
          else if (edge) c = mixRGB(colour, P.fog, 0.3);
          if (y > base - 6) c = mixRGB(c, P.fog, Math.min(0.55, (y - base + 6) / 28) * (bayer(x, y) < 0.5 ? 1 : 0.55));
          p.set(x, y, c);
        }
      }
      if (key === 'forestNear') p.rect(0, ROAD - 6, w, 6, P.ground);
      p.texture(this.textures, key);
    });
  }

  /**
   * The road, wet: its colour picks up the sky in streaks, with gravel glints, faded lane paint,
   * a kerb, and a dark verge in front. Reflections of the lit things are added separately.
   */
  private roadTexture() {
    const p = new PX(WORLD, H - ROAD);
    const r = seeded(44);
    const n = noise1(55);
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < WORLD; x++) {
        let c: RGB;
        if (y < 3) c = P.kerb;
        else if (y < 40) {
          // Wet asphalt: the sky's colour comes through, strongest near the far edge, broken by ripples.
          const t = (y - 3) / 37;
          const sheen = (1 - t) * 0.55 * (n(x * 0.03 + y * 0.6) > 0.45 ? 1 : 0.4);
          c = mixRGB(P.asphalt, mixRGB(P.sky3, P.sky4, 0.4), sheen * (bayer(x, y) < 0.7 ? 1 : 0.6));
          if (r() < 0.004) c = P.paint;
        } else if (y < 42) c = P.kerb;
        else c = y < 46 ? P.grassLit : P.ground;
        p.set(x, y, c);
      }
    }
    // Faded centre-line dashes, catching the light.
    for (let x = 6; x < WORLD; x += 34) p.rect(x, 20, 16, 1, P.paint);
    p.texture(this.textures, 'road');
  }

  private fogTextures() {
    const make = (key: string, w: number, density: number, colour: RGB) => {
      const p = new PX(w, 64);
      const n = noise1(key.length * 13);
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < w; x++) {
          const v = (1 - Math.abs(y - 32) / 32) * n(x * 0.01 + y * 0.02, 3) * density;
          if (v > bayer(x, y)) p.set(x, y, colour, 255);
        }
      }
      p.texture(this.textures, key);
    };
    make('fog', 512, 1.3, P.fog);
    make('fogNear', 512, 1.0, hex('#b9a6c9'));
  }

  /** Tall dark grass, a fence post and a sign back, in silhouette, passing close to the camera. */
  private foreground() {
    const w = Math.round(W + (WORLD - W) * 1.35) + 40;
    const p = new PX(w, 60);
    const r = seeded(77);
    for (let x = 0; x < w; x++) {
      const h = 8 + r() * 18 + (Math.sin(x * 0.05) + 1) * 6;
      for (let y = Math.round(60 - h); y < 60; y++) p.set(x, y, y < 60 - h + 1 && r() < 0.5 ? P.grassLit : P.ink);
      if (r() < 0.02) for (let y = 30; y < 60; y++) p.set(x, y - (r() < 0.5 ? 0 : 6), P.ink);
    }
    for (const fx of [260, 900, 1500]) p.rect(fx, 6, 5, 54, P.ink);
    p.texture(this.textures, 'foreground');
  }

  private vignette() {
    const p = new PX(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x - W / 2) / (W * 0.62), (y - H * 0.45) / (H * 0.72));
        const v = Math.max(0, d - 0.55) * 1.6;
        if (v > bayer(x, y) * 0.9) p.set(x, y, P.ink, Math.min(200, Math.round(v * 255)));
      }
    }
    p.texture(this.textures, 'vignette');
  }

  // ---------------------------------------------------------------- The fuel stop

  /**
   * Pinecrest Fuel & Pie: a canopy with fluorescent strips over two pumps, a little diner with warm
   * windows and a neon PIE sign, and a tall price sign. Drawn in pixels; every light is added on top.
   */
  private station() {
    const x0 = 740;
    const p = new PX(420, ROAD);
    const ox = (x: number) => x - x0;

    // The diner, behind and to the right of the canopy.
    const dx = ox(960);
    p.rect(dx, 214, 130, ROAD - 214, P.wall);
    p.rect(dx + 92, 214, 38, ROAD - 214, P.wallShade);
    p.rect(dx - 4, 208, 138, 7, P.redDark);
    p.rect(dx - 4, 208, 138, 2, P.red);
    // Windows, lit warm, with people-shaped shadows and blinds.
    for (const wx of [8, 40, 72]) {
      p.vgrad(dx + wx, 236, 26, 30, [
        [0, P.window],
        [1, P.windowDeep],
      ]);
      for (let b = 238; b < 248; b += 3) p.rect(dx + wx, b, 26, 1, mixRGB(P.windowDeep, P.window, 0.4));
      p.rect(dx + wx, 235, 26, 1, P.ink);
      p.rect(dx + wx, 266, 26, 2, P.wallShade);
    }
    p.rect(dx + 52, 250, 4, 10, P.wallShade);
    p.ellipse(dx + 54, 248, 2, 2, P.wallShade);
    // Door.
    p.rect(dx + 104, 248, 16, ROAD - 248, P.windowDeep);
    p.rect(dx + 106, 250, 12, 20, P.window);
    // Roof clutter: a vent and an aerial.
    p.rect(dx + 20, 200, 10, 8, P.steel);
    p.line(dx + 110, 208, dx + 110, 186, P.steel);
    p.line(dx + 104, 192, dx + 116, 190, P.steel);

    // The tall price sign.
    const sx = ox(1110);
    p.rect(sx, 150, 4, ROAD - 150, P.steel);
    p.rect(sx - 26, 120, 56, 46, P.steel);
    p.rect(sx - 24, 122, 52, 42, P.canopy);
    p.rect(sx - 24, 122, 52, 12, P.red);
    for (let i = 0; i < 2; i++) {
      p.rect(sx - 20, 138 + i * 12, 44, 9, P.ink);
    }

    // The canopy: a deck on four pillars, red band, white fascia, and its underside.
    const cx = ox(760);
    const cw = 180;
    for (const px of [12, 80, 150]) {
      p.rect(cx + px, 226, 6, ROAD - 226, P.steel);
      p.rect(cx + px, 226, 2, ROAD - 226, P.steelLit);
    }
    p.rect(cx - 6, 206, cw + 12, 20, P.canopy);
    p.rect(cx - 6, 212, cw + 12, 6, P.red);
    p.rect(cx - 6, 224, cw + 12, 3, P.canopyShade);
    // The pumps, on an island.
    p.rect(cx + 20, ROAD - 6, 140, 6, P.kerb);
    for (const px of [40, 110]) {
      p.rect(cx + px, 262, 16, ROAD - 262 - 6, P.canopy);
      p.rect(cx + px, 262, 16, 5, P.red);
      p.rect(cx + px + 3, 270, 10, 7, P.ink);
      p.rect(cx + px + 4, 271, 8, 2, P.neonCyan);
      p.line(cx + px + 16, 274, cx + px + 20, 286, P.ink);
    }
    // Stacked crates and a bin, because nobody tidies a fuel stop.
    p.rect(dx - 24, ROAD - 16, 14, 16, P.box);
    p.rect(dx - 22, ROAD - 26, 10, 10, P.boxShade);
    p.rect(cx + 168, ROAD - 14, 8, 14, P.steelLit);
    p.texture(this.textures, 'station');
    this.add.image(x0, 0, 'station').setOrigin(0).setDepth(-30);

    // Its lights: the canopy strips, the pools they throw, the diner windows, the neon, the sign.
    const add = (x: number, y: number, key: 'glow' | 'cone' | 'pool', tint: number, w: number, h: number, a: number, depth = -29) => this.light(x, y, key, w, h, tint, a, depth);
    for (const lx of [790, 850, 910]) {
      add(lx, 227, 'glow', 0xeaffef, 40, 10, 0.9);
      add(lx, 226, 'cone', 0xd9ffe8, 90, ROAD - 226 + 10, 0.32).setOrigin(0.5, 0);
    }
    add(850, ROAD + 6, 'pool', 0xd9ffe8, 260, 26, 0.55, -19);
    add(1025, 252, 'glow', 0xffb35c, 170, 70, 0.4);
    add(1025, ROAD + 4, 'pool', 0xffb35c, 170, 18, 0.35, -19);
    add(1110 - 0, 143, 'glow', 0xfff3d6, 90, 70, 0.4);
    // A neon PIE sign in the diner window, buzzing.
    const neon = this.add.text(1000, 222, 'PIE', { fontFamily: FONT, fontSize: '14px', color: '#ff5c8a', fontStyle: 'bold' }).setOrigin(0.5).setDepth(-28).setResolution(1);
    const neonGlow = add(1000, 222, 'glow', 0xff5c8a, 60, 30, 0.6, -28);
    this.flickers.push({ obj: neon, base: 1, rate: 0.03 }, { obj: neonGlow, base: 0.6, rate: 0.03 });
    const open = this.add.text(1080, 256, 'OPEN', { fontFamily: SMALL, fontSize: '8px', color: '#5cf2ff' }).setOrigin(0.5).setDepth(-28).setResolution(1);
    this.flickers.push({ obj: open, base: 1, rate: 0.01 });
    add(1080, 256, 'glow', 0x5cf2ff, 40, 16, 0.5, -28);
    // Words on the signs.
    this.add.text(850, 215, 'PINECREST FUEL & PIE', { fontFamily: SMALL, fontSize: '8px', color: '#fff6e6' }).setOrigin(0.5).setDepth(-28).setResolution(1);
    this.add.text(1112, 128, 'FUEL', { fontFamily: FONT, fontSize: '10px', color: '#fff6e6', fontStyle: 'bold' }).setOrigin(0.5).setDepth(-28).setResolution(1);
    this.add.text(1112, 142, '3.49', { fontFamily: SMALL, fontSize: '8px', color: '#ffb35c' }).setOrigin(0.5).setDepth(-28).setResolution(1);
    this.add.text(1112, 154, 'PIE 2.00', { fontFamily: SMALL, fontSize: '8px', color: '#ff5c8a' }).setOrigin(0.5).setDepth(-28).setResolution(1);
  }

  /** Street lamps: sodium-orange cones of light, halos, moths, and their streaks on the wet road. */
  private lamps() {
    const r = seeded(91);
    for (const x of [180, 450, 640, 1260, 1440]) {
      const p = new PX(26, 120);
      p.rect(3, 6, 3, 114, P.steel);
      p.rect(3, 6, 18, 3, P.steel);
      p.rect(16, 8, 9, 4, P.steelLit);
      p.rect(17, 12, 7, 1, P.sodium);
      const key = `lamp${x}`;
      p.texture(this.textures, key);
      this.add.image(x, ROAD + 2, key).setOrigin(0.12, 1).setDepth(-31);
      const lx = x + 17;
      const ly = ROAD - 106;
      const add = (key2: 'glow' | 'cone', w: number, h: number, a: number, oy = 0.5) => this.light(lx, ly, key2, w, h, 0xffa34d, a, -29).setOrigin(0.5, oy);
      add('glow', 46, 46, 0.9);
      add('glow', 120, 120, 0.25);
      add('cone', 110, 110, 0.35, 0);
      this.light(lx, ROAD + 6, 'pool', 120, 18, 0xffa34d, 0.5, -19);
      this.streak(lx, 0xffa34d, 0.55, 1);
      for (let m = 0; m < 3; m++) this.moths.push({ img: this.add.image(lx, ly, 'star').setDepth(-28).setTint(0xfff3d6), cx: lx, cy: ly + 4, t: r() * 10, r: 5 + r() * 9 });
    }
  }

  /** A vertical streak of light on the wet road, under a light: shimmering, broken by ripples. */
  private streak(x: number, tint: number, alpha: number, width: number) {
    const img = this.light(x, ROAD + 4, 'streak', 6 * width, 40, tint, alpha, -19).setOrigin(0.5, 0);
    this.streaks.push({ img, base: alpha });
  }

  /** The station mirrored in the wet road: flipped, darkened toward the asphalt, rippled sideways. */
  private reflections() {
    const src = this.textures.get('station').getSourceImage() as HTMLCanvasElement;
    const ctx = src.getContext('2d')!;
    const img = ctx.getImageData(0, 0, src.width, src.height);
    const p = new PX(src.width, 40);
    for (let y = 0; y < 40; y++) {
      const sy = ROAD - 1 - y;
      const shift = Math.round(Math.sin(y * 0.9) * 1.5);
      const fade = 0.55 + (y / 40) * 0.4;
      for (let x = 0; x < src.width; x++) {
        const sx = Math.min(src.width - 1, Math.max(0, x + shift));
        const i = (sy * src.width + sx) * 4;
        if (img.data[i + 3] < 128) continue;
        if (bayer(x, y) < y / 60) continue;
        p.set(x, y, mixRGB([img.data[i], img.data[i + 1], img.data[i + 2]], P.asphalt, fade));
      }
    }
    p.texture(this.textures, 'stationReflect');
    this.add.image(740, ROAD + 3, 'stationReflect').setOrigin(0).setDepth(-19.5);
    for (const lx of [790, 850, 910]) this.streak(lx, 0xd9ffe8, 0.45, 1.4);
    this.streak(1000, 0xff5c8a, 0.5, 1.2);
    this.streak(1025, 0xffb35c, 0.35, 2.4);
    this.streak(1112, 0xfff3d6, 0.3, 1.6);
  }

  // ---------------------------------------------------------------- The truck

  /**
   * The pickup, in pixels, at the size the gameplay needs (about a quarter of the screen wide):
   * teal body with a cream roof, rounded fenders, a chrome strip, a stake bed with the load
   * (boxes, a mattress, a lamp, a plant, and Biscuit the cat, whose eyes catch the light),
   * the driver with an elbow out, and rim light along every top edge.
   */
  private makeTruck() {
    const p = new PX(152, 72);
    const BOX = P.box;
    const BOXS = P.boxShade;
    const WOOD = hex('#6b4a3a');
    const WOODL = hex('#8f6448');
    // ---- The load, drawn first so the bed side covers its foot.
    p.rect(10, 20, 26, 22, BOX);
    p.rect(10, 20, 26, 2, mixRGB(BOX, P.cream, 0.45));
    p.rect(30, 20, 6, 22, BOXS);
    p.rect(12, 30, 10, 1, BOXS);
    p.rect(40, 26, 22, 16, hex('#c9b8d8'));
    p.rect(40, 26, 22, 2, hex('#efe6f6'));
    for (let x = 42; x < 62; x += 5) p.rect(x, 30, 1, 12, hex('#a593ba'));
    p.rect(14, 6, 18, 14, BOX);
    p.rect(27, 6, 5, 14, BOXS);
    p.rect(14, 6, 18, 1, mixRGB(BOX, P.cream, 0.45));
    // Biscuit, loafed on the top box, eyes glowing.
    p.rect(16, 1, 12, 5, P.ginger);
    p.set(16, 0, P.ginger);
    p.set(27, 0, P.ginger);
    p.rect(17, 4, 10, 2, hex('#c8701e'));
    p.set(19, 2, hex('#d8ff7a'));
    p.set(24, 2, hex('#d8ff7a'));
    // A floor lamp and a potted plant.
    p.rect(64, 6, 12, 7, P.window);
    p.rect(64, 12, 12, 1, P.windowDeep);
    p.rect(69, 13, 2, 29, P.steelLit);
    p.rect(52, 14, 8, 12, hex('#3f8a5a'));
    p.rect(50, 10, 4, 6, hex('#5aa86e'));
    p.rect(57, 8, 4, 7, hex('#5aa86e'));
    p.rect(52, 24, 8, 4, P.red);
    // ---- Stake rails over the bed.
    for (const x of [6, 26, 46, 66, 82]) p.rect(x, 22, 3, 18, WOOD);
    p.rect(5, 24, 82, 2, WOODL);
    p.rect(5, 32, 82, 2, WOODL);
    // ---- Bed side and cab body.
    const body = (x: number, y: number, w: number, h: number) => {
      p.rect(x, y, w, h, P.teal);
      p.rect(x, y, w, 1, P.tealLit);
      p.rect(x, y + Math.round(h * 0.62), w, h - Math.round(h * 0.62), P.tealShade);
    };
    body(4, 40, 82, 18);
    p.rect(4, 47, 82, 1, P.hub);
    // Cab, with a cream roof.
    body(86, 22, 40, 36);
    p.rect(86, 16, 36, 6, P.cream);
    p.rect(88, 14, 30, 2, P.cream);
    p.rect(86, 16, 36, 1, hex('#fff8e6'));
    p.rect(86, 21, 36, 1, P.creamShade);
    p.rect(86, 47, 40, 1, P.hub);
    // Window: dark glass, the driver in a mustard cap with an elbow out, a streak of reflected light.
    p.rect(92, 25, 26, 14, hex('#22334d'));
    for (let y = 25; y < 39; y++) p.set(118 + Math.floor((y - 25) / 3), y, hex('#22334d'));
    p.rect(100, 28, 10, 10, P.cream);
    p.rect(99, 26, 12, 4, hex('#e8a83a'));
    p.rect(108, 28, 5, 2, hex('#e8a83a'));
    p.set(107, 32, P.ink);
    p.rect(110, 38, 10, 4, P.cream);
    p.line(94, 37, 101, 26, hex('#5e7aa0'));
    // Bonnet, sloping down to a chrome grille and a round headlight.
    body(126, 34, 20, 24);
    for (let x = 126; x < 146; x++) p.set(x, 33 + Math.floor((x - 126) / 7), P.tealLit);
    p.rect(144, 38, 5, 16, P.hub);
    for (let y = 40; y < 54; y += 3) p.rect(145, y, 3, 1, P.steel);
    p.ellipse(141, 43, 3, 3, hex('#fff6d6'));
    // Fenders over both wheels, wheel wells, running board, bumpers.
    for (const wx of [34, 120]) {
      p.ellipse(wx, 58, 16, 10, P.tealShade);
      p.ellipse(wx, 60, 13, 9, P.ink);
      for (let x = wx - 15; x <= wx + 15; x++) {
        const top = 58 - Math.round(Math.sqrt(Math.max(0, 1 - ((x - wx) / 16) ** 2)) * 10);
        p.set(x, top, P.tealLit);
      }
    }
    // Clear the lower half of each wheel well, so the wheel shows through.
    for (const wx of [34, 120]) for (let y = 60; y < 72; y++) for (let x = wx - 13; x <= wx + 13; x++) p.set(x, y, [0, 0, 0], 0);
    p.rect(52, 58, 52, 3, P.ink);
    p.rect(52, 58, 52, 1, P.steelLit);
    p.rect(142, 58, 10, 4, P.hub);
    p.rect(0, 56, 8, 4, P.hub);
    p.rect(3, 42, 3, 6, P.red);
    // Mud along the bottom of the bed.
    for (let x = 6; x < 84; x += 3) if (bayer(x, 57) < 0.5) p.set(x, 57, hex('#3a2a2a'));
    // Rim light: the top edge of every shape catches the canopy's cold white light.
    for (let x = 0; x < p.w; x++) {
      for (let y = 0; y < p.h; y++) {
        if (p.get(x, y)[3]) {
          p.tint(x, y, hex('#e8fff4'), 0.6);
          if (y + 1 < p.h) p.tint(x, y + 1, hex('#e8fff4'), 0.2);
          break;
        }
      }
    }
    p.texture(this.textures, 'truck');

    const wheel = (key: string, spoke: number) => {
      const w = new PX(26, 26);
      w.ellipse(13, 13, 12, 12, P.tyre);
      w.ellipse(13, 13, 8, 8, hex('#efe8dc'));
      w.ellipse(13, 13, 6, 6, P.red);
      w.ellipse(13, 13, 2, 2, P.hub);
      for (const a of [spoke, spoke + Math.PI * 0.5, spoke + Math.PI, spoke + Math.PI * 1.5]) w.set(13 + Math.round(Math.cos(a) * 4), 13 + Math.round(Math.sin(a) * 4), hex('#ffd2a0'));
      // Tread blocks round the tyre.
      for (let i = 0; i < 16; i++) {
        const a = spoke + (i / 16) * Math.PI * 2;
        w.set(13 + Math.round(Math.cos(a) * 11), 13 + Math.round(Math.sin(a) * 11), hex('#2a2538'));
      }
      w.texture(this.textures, key);
    };
    for (let i = 0; i < 4; i++) wheel(`wheel${i}`, (i / 4) * (Math.PI / 2));

    const bodyImg = this.add.image(0, 0, 'truck').setOrigin(0.5, 1);
    this.wheels = [34 - 76, 120 - 76].map((x) => this.add.image(x, 1, 'wheel0').setOrigin(0.5, 1));
    this.truck = this.add.container(this.truckX, LANE, [bodyImg, ...this.wheels]).setDepth(-10);
    this.beam = this.light(0, 0, 'beam', 240, 74, 0xfff1c9, 0.55, -9).setOrigin(0, 0.5);
    this.beamPool = this.light(0, LANE + 4, 'pool', 220, 16, 0xfff1c9, 0.45, -19);
    this.tail = this.light(0, 0, 'glow', 40, 26, 0xff3040, 0.6, -9);
  }

  private makeBanner() {
    const bg = this.add.rectangle(0, 0, 250, 46, 0x0d0b1f, 0.82).setStrokeStyle(2, 0xffb35c);
    const t1 = this.add.text(0, -10, 'CHECKPOINT  ·  GAME SAVED', { fontFamily: SMALL, fontSize: '8px', color: '#ffb35c' }).setOrigin(0.5).setResolution(1);
    const t2 = this.add.text(0, 7, 'Pinecrest Fuel & Pie', { fontFamily: FONT, fontSize: '16px', color: '#fff6e6' }).setOrigin(0.5).setResolution(1);
    this.banner = this.add.container(W / 2, -40, [bg, t1, t2]).setScrollFactor(0).setDepth(40);
  }

  // ---------------------------------------------------------------- Every frame

  update(time: number, delta: number) {
    const dt = delta / 1000;
    this.stageTime += dt;

    // The truck rolls in from the left, brakes, parks at the pump; later it pulls away again.
    let speed = 0;
    const stop = 820;
    if (this.stage === 'arrive') {
      const left = stop - this.truckX;
      speed = Math.max(0.25, Math.min(110, left * 0.9)) * dt;
      this.truckX += speed;
      if (left < 0.5) {
        this.truckX = stop;
        this.stage = 'parked';
        this.stageTime = 0;
        this.tweens.add({ targets: this.banner, y: 40, duration: 500, ease: 'Back.easeOut' });
      }
    } else if (this.stage === 'parked') {
      if (this.stageTime > 6) {
        this.stage = 'leave';
        this.stageTime = 0;
        this.tweens.add({ targets: this.banner, y: -40, duration: 300, ease: 'Quad.easeIn' });
      }
    } else {
      speed = Math.min(140, this.stageTime * 70) * dt;
      this.truckX += speed;
      if (this.truckX > WORLD + 160) {
        this.truckX = -200;
        this.stage = 'arrive';
        this.stageTime = 0;
      }
    }
    const idle = this.stage === 'parked' ? Math.round(Math.sin(time / 70)) * 0.5 : 0;
    this.truck.setPosition(Math.round(this.truckX), LANE + idle);
    this.wheelTurn += speed / 6;
    const frame = Math.floor(this.wheelTurn) % 4;
    for (const w of this.wheels) w.setTexture(`wheel${frame}`);
    const braking = this.stage === 'arrive' && stop - this.truckX < 80;
    this.beam.setPosition(this.truck.x + 70, LANE - 29);
    this.beamPool.setPosition(this.truck.x + 180, LANE + 4);
    this.tail.setPosition(this.truck.x - 73, LANE - 27).setAlpha(braking ? 1 : 0.45);

    // The camera follows the truck, but frames the fuel stop while it is parked.
    const cam = this.cameras.main;
    const want = this.stage === 'parked' ? 560 : this.truck.x - W * 0.4;
    cam.scrollX += (Phaser.Math.Clamp(want, 0, WORLD - W) - cam.scrollX) * 0.05;

    // Drizzle, slanting in the wind.
    for (const d of this.drops) {
      d.img.y += d.vy;
      d.img.x -= d.vy * 0.25;
      if (d.img.y > H) {
        d.img.y = -4;
        d.img.x = Math.random() * (W + 40);
      }
    }
    for (const f of this.fogs) f.img.tilePositionX += f.speed * dt;
    // Neon buzz, lamps that breathe, stars that twinkle, moths and fireflies.
    for (const f of this.flickers) {
      if (Math.random() < f.rate) f.obj.setAlpha(f.base * (0.2 + Math.random() * 0.4));
      else f.obj.setAlpha(Math.min(f.base, f.obj.alpha + 0.2));
    }
    for (const s of this.streaks) s.img.setAlpha(s.base * (0.75 + Math.sin(time / 180 + s.img.x) * 0.25));
    for (const [i, s] of this.stars.entries()) if (i % 7 === 0) s.setAlpha(0.4 + Math.abs(Math.sin(time / 600 + i)) * 0.6);
    for (const m of this.moths) {
      m.t += dt * 3;
      m.img.setPosition(Math.round(m.cx + Math.cos(m.t * 1.7) * m.r), Math.round(m.cy + Math.sin(m.t * 2.3) * m.r * 0.6));
    }
    for (const f of this.flies) {
      f.t += dt;
      f.img.setPosition(Math.round(f.x + Math.sin(f.t * 0.7) * 10), Math.round(f.y + Math.cos(f.t) * 4)).setAlpha(Math.max(0, Math.sin(f.t * 2.2)));
    }
  }
}

document.fonts.load('16px "Pixelify Sans"').then(() =>
  document.fonts.load('8px "Silkscreen"').then(
    () =>
      new Phaser.Game({
        type: Phaser.WEBGL,
        parent: 'game',
        width: W,
        height: H,
        pixelArt: true,
        roundPixels: true,
        backgroundColor: '#0b0914',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [Dusk],
      }),
  ),
);
