import Phaser from 'phaser';
import type { Art } from './art';
import { C, Pen, mix } from './ink';

/**
 * The scenery behind the road, built the way side-scrolling games layer theirs: far layers have no
 * outlines and fade into haze; nearer layers are busier and darker. Each layer tiles seamlessly
 * (its shapes repeat exactly every TILE pixels), so it can scroll forever.
 */
export const TILE = 2400;

/** A smooth height along a layer that repeats exactly every TILE pixels. */
export function wave(seed: number, amps: number[]) {
  const phases = amps.map((_, i) => ((seed * 9301 + i * 49297) % 233280) / 233280 * Math.PI * 2);
  return (x: number) => amps.reduce((h, a, i) => h + a * Math.sin(((i + 1) * Math.PI * 2 * x) / TILE + phases[i]), 0);
}

/** A sharp-peaked ridge (for mountains): the absolute value of waves makes points rather than domes. */
export function peaks(seed: number, amps: number[]) {
  const smooth = wave(seed, amps);
  const jag = wave(seed + 7, [0, 0, 0, 0, 0, 0, 14, 0, 9, 0, 0, 6]);
  return (x: number) => Math.abs(smooth(x)) + jag(x);
}

/** A random-looking but repeatable number in 0..1 for an index. */
export function rnd(seed: number, i: number) {
  const v = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export function plainPen(key: string) {
  return new Pen(key, 0, 0);
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

export interface Layers {
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
export function haze(scene: Phaser.Scene, y: number, height: number, colour: number, alpha: number, depth: number, sf: number) {
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
  haze(scene, o.horizon - 520, 360, 0xff7a3a, 0.35, -39, sf(0.1));
  for (let i = 0; i < count(0.2); i++) scene.add.image(i * TILE - 300, o.horizon - 120, 'bd_forest').setOrigin(0, 1).setScrollFactor(sf(0.2), 1).setDepth(-36);
  haze(scene, o.horizon - 340, 260, 0xffa04a, 0.28, -35, sf(0.2));
  for (let i = 0; i < count(0.34); i++) {
    const x0 = i * TILE - 600;
    scene.add.image(x0, o.horizon, 'bd_farms').setOrigin(0, 1).setScrollFactor(sf(0.34), 1).setDepth(-32);
    // Windmills turning on the hills.
    for (const [dx, dy] of [[520, -250], [1580, -232]]) {
      scene.add.image(x0 + dx, o.horizon + dy, 'bd_mill').setOrigin(0.5, 1).setScrollFactor(sf(0.34), 1).setDepth(-31).setScale(0.8);
      sails.push(scene.add.image(x0 + dx, o.horizon + dy - 104, 'bd_sails').setScrollFactor(sf(0.34), 1).setDepth(-30).setScale(0.8));
    }
  }
  haze(scene, o.horizon - 280, 220, 0xffc46e, 0.16, -29, sf(0.34));
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
      tint: 0xffc46e,
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
