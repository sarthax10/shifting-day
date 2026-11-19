import Phaser from 'phaser';
import { pen, type Art } from './art';
import { C } from './ink';

/**
 * The last stretch home. Over the final few kilometres of the coast road the bright morning turns to
 * golden hour: the sky warms to rose and gold, a great sun lowers itself into the sea, the clouds blush,
 * sky lanterns drift up over the water and petals blow across the road. The road itself becomes an
 * avenue: golden maples, lamp posts hung with banners and strings of lights, and two arches over the
 * road - NEARLY HOME, then WELCOME HOME. Once the house is in sight, fireworks go up over it.
 */

const INK = C.ink;
const BONE = '#F3E3CC';
const RED = '#E3263A';
const RED_DARK = '#9E1A2E';
const GOLD = '#FFB23F';
const GOLD_DARK = '#D98A2A';
const EMBER = '#FF6A30';
const OX = '#3A0F22';
const LIT = '#FFC86B';

/** A lamp post of the avenue: the post, its lantern, and a banner on a bracket. */
const POST = { w: 120, h: 560, ground: 470 };
/** A pillar of the welcome arches: legs run on below the ground line, the road hides them. */
const PILLAR = { w: 130, h: 900, ground: 760 };
const BANNER = { w: 820, h: 210 };

function postArt(): Art {
  const p = pen('finale_post');
  const { w, h, ground } = POST;
  const cx = 40;
  p.rect(cx - 9, 70, 18, h - 70, { fill: INK, width: 3.5, r: 3 });
  for (let y = 140; y < ground - 40; y += 70) p.rect(cx - 9, y, 18, 8, { fill: GOLD, stroke: null, r: 0 });
  p.rect(cx - 20, ground - 30, 40, 30 + (h - ground), { fill: INK, width: 3.5, r: 4 });
  p.rect(cx - 14, ground - 40, 28, 12, { fill: GOLD, width: 3, r: 2 });
  // The lantern: a gold cap and finial over warm glass.
  p.shape([[cx - 24, 46], [cx, 18], [cx + 24, 46]], { fill: GOLD, raw: true, width: 3.5 });
  p.line([[cx, 18], [cx, 4]], { width: 3, raw: true });
  p.dot(cx, 4, 4, GOLD);
  p.rect(cx - 17, 44, 34, 30, { fill: LIT, width: 3.5, r: 3 });
  p.line([[cx, 46], [cx, 72]], { width: 2, raw: true });
  p.rect(cx - 21, 72, 42, 8, { fill: INK, width: 3, r: 2 });
  // The banner, hung from a bracket: red, a gold star, a swallow-tail foot.
  p.line([[cx + 9, 120], [cx + 70, 120]], { width: 5, raw: true });
  p.dot(cx + 72, 120, 5, GOLD);
  p.shape([[cx + 16, 124], [cx + 66, 124], [cx + 66, 260], [cx + 41, 238], [cx + 16, 260]], { fill: RED, raw: true, width: 4, shade: [{ pts: [[cx + 48, 120], [cx + 70, 120], [cx + 70, 264], [cx + 50, 264]], color: RED_DARK }] });
  p.line([[cx + 22, 134], [cx + 60, 134]], { width: 3, color: GOLD, raw: true });
  const star: [number, number][] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
    const r = k % 2 ? 6 : 14;
    star.push([cx + 41 + Math.cos(a) * r, 184 + Math.sin(a) * r]);
  }
  p.shape(star, { fill: GOLD, raw: true, width: 2.5 });
  return { key: 'finale_post', svg: p.svg(w, h), w, h };
}

function pillarArt(): Art {
  const p = pen('finale_pillar');
  const { w, h, ground } = PILLAR;
  const cx = w / 2;
  // Plinth, fluted shaft in bone, a gold capital, and an ember flame finial in a gold bowl.
  p.rect(cx - 44, ground - 70, 88, 70 + (h - ground), { fill: OX, width: 4.5, r: 2 });
  p.rect(cx - 50, ground - 80, 100, 16, { fill: GOLD, width: 3.5, r: 2 });
  p.rect(cx - 30, 150, 60, ground - 230, { fill: BONE, width: 4.5, r: 2, shade: [{ pts: [[cx + 8, 140], [cx + 34, 140], [cx + 34, ground], [cx + 10, ground]], color: '#D9C3A6' }] });
  for (const dx of [-16, 0, 16]) p.line([[cx + dx, 166], [cx + dx, ground - 96]], { width: 3, color: '#B89A7A', raw: true });
  p.rect(cx - 42, 128, 84, 26, { fill: GOLD, width: 4, r: 2 });
  p.rect(cx - 34, 112, 68, 18, { fill: GOLD_DARK, width: 3.5, r: 2 });
  p.shape([[cx - 30, 112], [cx - 22, 90], [cx + 22, 90], [cx + 30, 112]], { fill: GOLD, raw: true, width: 3.5 });
  p.shape([[cx, 18], [cx + 16, 52], [cx + 8, 88], [cx - 8, 88], [cx - 16, 52]], { fill: EMBER, width: 3 });
  p.shape([[cx, 44], [cx + 8, 64], [cx + 4, 86], [cx - 4, 86], [cx - 8, 64]], { fill: GOLD, width: 0, stroke: null });
  // A wreath on the shaft.
  p.ellipse(cx, 300, 26, 26, { stroke: '#2A4636', width: 9 });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    p.dot(cx + Math.cos(a) * 26, 300 + Math.sin(a) * 26, 4, k % 2 ? RED : GOLD);
  }
  p.shape([[cx - 6, 324], [cx + 6, 324], [cx + 14, 356], [cx, 344], [cx - 14, 356]], { fill: RED, raw: true, width: 2.5 });
  return { key: 'finale_pillar', svg: p.svg(w, h), w, h };
}

function bannerArt(): Art {
  const p = pen('finale_banner');
  const { w, h } = BANNER;
  // A sweeping red band with a bone border, a gold crest at the top, and bunting below.
  const top: [number, number][] = [];
  const bot: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const x = 10 + (i / 24) * (w - 20);
    const lift = Math.sin((i / 24) * Math.PI) * 34;
    top.push([x, 70 - lift]);
    bot.push([x, 150 - lift * 0.6]);
  }
  p.shape([...top, ...bot.reverse()], { fill: RED, raw: true, width: 6, shade: [{ pts: [[0, 130], [w, 130], [w, 160], [0, 160]], color: RED_DARK }] });
  p.line(top.map(([x, y]) => [x, y + 10] as [number, number]), { width: 3, color: BONE, raw: true });
  p.line(bot.map(([x, y]) => [x, y - 10] as [number, number]).reverse(), { width: 3, color: BONE, raw: true });
  for (let k = 0; k < 18; k++) {
    const x0 = 30 + k * 43;
    const t = (x0 + 20) / w;
    const y0 = 150 - Math.sin(t * Math.PI) * 20;
    p.shape([[x0, y0 + 2], [x0 + 38, y0 + 2], [x0 + 19, y0 + 36]], { fill: [GOLD, BONE, EMBER][k % 3], raw: true, width: 2.5 });
  }
  p.ellipse(w / 2, 30, 34, 26, { fill: GOLD, width: 4.5 });
  p.shape([[w / 2 - 22, 30], [w / 2 - 14, 12], [w / 2 - 6, 26], [w / 2, 6], [w / 2 + 6, 26], [w / 2 + 14, 12], [w / 2 + 22, 30], [w / 2 + 18, 40], [w / 2 - 18, 40]], { fill: RED, raw: true, width: 2.5 });
  return { key: 'finale_banner', svg: p.svg(w, h), w, h };
}

export function finaleArts(): Art[] {
  return [postArt(), pillarArt(), bannerArt()];
}

/** A vertical gradient as a texture, made once. */
function gradient(scene: Phaser.Scene, key: string, stops: [number, string][]) {
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, 8, 540)!;
  const g = t.context.createLinearGradient(0, 0, 0, 540);
  for (const [at, c] of stops) g.addColorStop(at, c);
  t.context.fillStyle = g;
  t.context.fillRect(0, 0, 8, 540);
  t.refresh();
  return key;
}

const smooth = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

export interface FinaleOpts {
  finish: number;
  groundY: (x: number) => number;
  /** The far scenery's layer: the sunset sky and sun go in it, among the coast's own sky and sea. */
  far: Phaser.GameObjects.Layer;
  /** Words on the arches are in the poster's display face. */
  font: string;
}

/** Builds the final stretch, and returns what to run every frame with the camera's middle. */
export function buildFinale(scene: Phaser.Scene, o: FinaleOpts) {
  const { finish, groundY, far } = o;
  const from = finish - 9000;
  const full = finish - 4800;
  const W = 1920;
  const H = 1080;

  // ---- The sky: a sunset over the morning, its sun setting into the sea, the morning sun fading out.
  const morning = far.list.filter((g) => {
    const d = (g as unknown as { depth: number }).depth;
    return d <= -44.9 && d >= -46.1;
  }) as unknown as Phaser.GameObjects.Image[];
  const clouds = far.list.filter((g) => (g as unknown as { depth: number }).depth === -44) as unknown as Phaser.GameObjects.Image[];
  const sky = scene.add.image(0, 0, gradient(scene, 'finale_sky', [[0, '#3A0F2E'], [0.3, '#8E2A4E'], [0.58, '#E3566A'], [0.8, '#FF8A4A'], [1, '#FFD27A']])).setOrigin(0).setDisplaySize(W, H).setScrollFactor(0).setDepth(-49.5).setAlpha(0);
  const sunHalo = scene.add.image(960, 470, 'halo').setScrollFactor(0.02, 0).setDepth(-45.6).setTint(0xff9a50).setDisplaySize(1300, 900).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  const sun = scene.add.circle(960, 470, 150, 0xffb850).setScrollFactor(0.02, 0).setDepth(-45.5).setAlpha(0);
  const sunCore = scene.add.circle(960, 470, 118, 0xffe08a).setScrollFactor(0.02, 0).setDepth(-45.4).setAlpha(0);
  // Rays wheeling slowly round the sun, the poster's flourish.
  const rays = scene.add.graphics().setScrollFactor(0.02, 0).setDepth(-45.7).setPosition(960, 470).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  for (let k = 0; k < 18; k++) {
    const a0 = (k / 18) * Math.PI * 2;
    const a1 = a0 + Math.PI / 30;
    rays.fillStyle(0xffc070, 0.22).fillTriangle(0, 0, Math.cos(a0) * 1400, Math.sin(a0) * 1400, Math.cos(a1) * 1400, Math.sin(a1) * 1400);
  }
  // The sun's road across the water.
  const glitter = scene.add.image(960, 640, 'halo').setScrollFactor(0.02, 0).setDepth(-41).setTint(0xffb060).setDisplaySize(380, 260).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  const lanterns = scene.add.particles(0, 0, 'halo', {
    x: { min: 0, max: W },
    y: 760,
    lifespan: 16000,
    speedY: { min: -46, max: -26 },
    speedX: { min: -8, max: 8 },
    scale: { start: 0.16, end: 0.08 },
    alpha: { start: 0.95, end: 0 },
    tint: [0xffa040, 0xffc060, 0xff7a40],
    frequency: 700,
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
  }).setScrollFactor(0).setDepth(-40.5);
  far.add([sky, rays, sunHalo, sun, sunCore, glitter, lanterns]);

  // ---- The avenue: golden maples, lamp posts with banners, and strings of lights between the posts.
  const posts: number[] = [];
  for (let x = from + 2600; x < finish - 260; x += 380) posts.push(x);
  const lights = scene.add.graphics().setDepth(-7.4);
  const bulbs: Phaser.GameObjects.Image[] = [];
  const bulbColours = [0xffd27a, 0xff6a30, 0xf3e3cc, 0xe3263a];
  posts.forEach((x, i) => {
    if (i % 2 === 0) scene.add.image(x + 190, groundY(x + 190) + 12, 'maple_1').setOrigin(0.5, 1).setDepth(-9.2).setScale(0.8 + (i % 3) * 0.08).setFlipX(i % 4 === 0);
    scene.add.image(x, groundY(x) + 10, 'finale_post').setOrigin(40 / POST.w, POST.ground / POST.h).setDepth(-7.5);
    const lamp = scene.add.image(x, groundY(x) + 10 - POST.ground + 60, 'halo').setDisplaySize(110, 110).setTint(0xffc060).setBlendMode(Phaser.BlendModes.ADD).setDepth(-7.3).setAlpha(0);
    bulbs.push(lamp);
    const next = posts[i + 1];
    if (next === undefined) return;
    const ax = x;
    const ay = groundY(x) + 10 - POST.ground + 82;
    const bx = next;
    const by = groundY(next) + 10 - POST.ground + 82;
    const pts: [number, number][] = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      pts.push([ax + (bx - ax) * t, ay + (by - ay) * t + Math.sin(t * Math.PI) * 46]);
    }
    lights.lineStyle(3, 0x0a0712, 1).beginPath().moveTo(pts[0][0], pts[0][1]);
    for (const [px, py] of pts) lights.lineTo(px, py);
    lights.strokePath();
    for (let k = 2; k < 16; k += 2) {
      const [px, py] = pts[k];
      const c = bulbColours[(k / 2 + i) % bulbColours.length];
      lights.fillStyle(c, 1).fillCircle(px, py + 5, 6);
      bulbs.push(scene.add.image(px, py + 5, 'halo').setDisplaySize(40, 40).setTint(c).setBlendMode(Phaser.BlendModes.ADD).setDepth(-7.3).setAlpha(0));
    }
  });
  // Flower beds along the verge.
  const beds = scene.add.graphics().setDepth(-7.6);
  for (let x = from + 2400; x < finish - 200; x += 26) {
    const y = groundY(x) + 6;
    const c = [0xe3263a, 0xffb23f, 0xf3e3cc, 0xff6a30][Math.floor(x / 26) % 4];
    beds.fillStyle(0x2a4636, 1).fillRect(x - 1, y - 18, 3, 16);
    beds.fillStyle(c, 1).fillCircle(x, y - 20, 6);
  }

  // ---- The welcome arches: a pillar on each side of the road on its own ground, the band level above.
  const arch = (cx: number, words: string) => {
    const legs = [cx - 360, cx + 360];
    for (const lx of legs) scene.add.image(lx, groundY(lx) + 10, 'finale_pillar').setOrigin(0.5, PILLAR.ground / PILLAR.h).setDepth(-6.6);
    const top = Math.min(...legs.map((lx) => groundY(lx))) + 10 - PILLAR.ground + 96;
    scene.add.image(cx, top, 'finale_banner').setOrigin(0.5, 0).setDepth(-6.5);
    scene.add.text(cx, top + 96, words, { fontFamily: o.font, fontSize: '54px', color: BONE, stroke: INK, strokeThickness: 8, letterSpacing: 4 }).setOrigin(0.5).setDepth(-6.4).setShadow(4, 5, OX, 0, true, false);
    for (const lx of legs) {
      const flame = scene.add.image(lx, groundY(lx) + 10 - PILLAR.ground + 55, 'halo').setDisplaySize(130, 130).setTint(0xff8a3a).setBlendMode(Phaser.BlendModes.ADD).setDepth(-6.3).setAlpha(0);
      bulbs.push(flame);
    }
  };
  arch(finish - 4900, 'NEARLY HOME');
  arch(finish - 2600, 'WELCOME HOME');

  // ---- In the air: petals blowing across, a warm light over everything, and fireworks over the house.
  const petals = scene.add.particles(0, 0, 'bit', {
    x: { min: 0, max: W + 300 },
    y: -20,
    lifespan: 12000,
    speedY: { min: 40, max: 90 },
    speedX: { min: -90, max: -30 },
    rotate: { min: 0, max: 360 },
    scaleX: { min: 0.8, max: 1.4 },
    scaleY: { min: 0.5, max: 0.9 },
    tint: [0xf49aa0, 0xf3e3cc, 0xffb23f, 0xff8a9a],
    frequency: 140,
    emitting: false,
  }).setScrollFactor(0).setDepth(58);
  const warm = scene.add.image(0, 0, gradient(scene, 'finale_warm', [[0, 'rgba(255,110,130,0.55)'], [0.45, 'rgba(255,160,90,0.12)'], [1, 'rgba(255,190,90,0.45)']])).setOrigin(0).setDisplaySize(W, H).setScrollFactor(0).setDepth(59).setAlpha(0).setBlendMode(Phaser.BlendModes.SCREEN);
  const burst = (tint: number[]) =>
    scene.add.particles(0, 0, 'halo', { speed: { min: 140, max: 420 }, angle: { min: 0, max: 360 }, lifespan: { min: 900, max: 1400 }, gravityY: 150, scale: { start: 0.24, end: 0.02 }, alpha: { start: 1, end: 0 }, tint, blendMode: Phaser.BlendModes.ADD, emitting: false }).setScrollFactor(0).setDepth(-43.5);
  const shells = [burst([0xffd27a, 0xffb23f]), burst([0xe3263a, 0xff6a30]), burst([0xf3e3cc, 0xffe6f0]), burst([0xff8ab0, 0xffd27a])];
  const flash = scene.add.image(0, 0, 'halo').setScrollFactor(0).setDepth(-43.4).setDisplaySize(420, 420).setTint(0xfff0c0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  // In the sky, in front of the clouds and behind the far headlands.
  far.add([...shells, flash]);
  let nextShell = 0;

  return (time: number, camMid: number, celebrating: boolean) => {
    const t = smooth((camMid - from) / (full - from));
    sky.setAlpha(t);
    for (const g of [sun, sunCore]) g.setAlpha(t);
    sunHalo.setAlpha(t * 0.8);
    glitter.setAlpha(t * 0.7);
    rays.setAlpha(t * 0.9).setRotation(time * 0.00004);
    // The sun lowers itself toward the sea as you come in.
    const sy = 400 + smooth((camMid - full) / (finish - full)) * 140;
    for (const g of [sunHalo, sun, sunCore, rays]) g.y = sy;
    for (const m of morning) m.setAlpha(1 - t);
    for (const c of clouds) c.setTint(Phaser.Display.Color.GetColor(255, Math.round(255 - t * 80), Math.round(255 - t * 100)));
    warm.setAlpha(t * 0.6);
    lanterns.emitting = t > 0.35;
    petals.emitting = t > 0.2;
    bulbs.forEach((b, i) => b.setAlpha(t * (0.55 + 0.45 * Math.abs(Math.sin(time / 420 + i * 1.7)))));
    if ((camMid > finish - 3600 || celebrating) && time > nextShell) {
      nextShell = time + 650 + Math.random() * 900;
      const s = shells[Math.floor(Math.random() * shells.length)];
      const fx = 400 + Math.random() * 1120;
      const fy = 120 + Math.random() * 260;
      s.explode(90, fx, fy);
      flash.setPosition(fx, fy).setAlpha(0.9);
      scene.tweens.add({ targets: flash, alpha: 0, duration: 500 });
    }
  };
}
