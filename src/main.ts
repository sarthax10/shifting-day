// The poster's two faces, only the weights used: Anton for display, Space Mono for everything else.
import '@fontsource/anton/400.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import Phaser from 'phaser';
import * as art from './art/art';
import { tollArts } from './art/tolls';
import { C } from './art/ink';
import { PlayScene } from './scenes/play';
import { prepareLeg } from './world/prepare';
import { LEGS } from './world/legs';
import { makeCursors } from './art/cursors';
import { TitleScene, titleArts } from './scenes/title';
// Old Street, redrawn by hand in the poster identity.
import * as os from './art/oldstreet';
import { audio } from './systems/audio';

// Browsers keep sound off until the player does something; the first click or key turns it on.
// M mutes and unmutes everywhere.
for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, () => audio.unlock());
window.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') audio.toggleMute();
});
import { H, W } from './world/terrain';
import { runQA } from './dev/qa';

/** Soft pictures that ink cannot draw: the sky, shadows, darker corners and paper grain. */
function softTextures(textures: Phaser.Textures.TextureManager) {
  const sky = textures.createCanvas('sky', 8, 540)!;
  const fade = sky.context.createLinearGradient(0, 0, 0, 540);
  fade.addColorStop(0, '#2A1030');
  fade.addColorStop(0.38, '#6A1E3C');
  fade.addColorStop(0.62, '#C8343A');
  fade.addColorStop(0.8, '#FF7A3A');
  fade.addColorStop(1, '#FFC46E');
  sky.context.fillStyle = fade;
  sky.context.fillRect(0, 0, 8, 540);
  sky.refresh();

  const tsky = textures.createCanvas('title_sky', 8, 540)!;
  const tfade = tsky.context.createLinearGradient(0, 0, 0, 540);
  tfade.addColorStop(0, '#3B356F');
  tfade.addColorStop(0.35, '#8B5EA0');
  tfade.addColorStop(0.62, '#E8809A');
  tfade.addColorStop(0.85, '#FFA36E');
  tfade.addColorStop(1, '#FFD08A');
  tsky.context.fillStyle = tfade;
  tsky.context.fillRect(0, 0, 8, 540);
  tsky.refresh();

  const shadow = textures.createCanvas('shadow', 256, 64)!;
  const sc = shadow.context;
  sc.translate(128, 32);
  sc.scale(1, 0.25);
  const pool = sc.createRadialGradient(0, 0, 0, 0, 0, 128);
  pool.addColorStop(0, 'rgba(42, 33, 64, 0.45)');
  pool.addColorStop(0.6, 'rgba(42, 33, 64, 0.24)');
  pool.addColorStop(1, 'rgba(42, 33, 64, 0)');
  sc.fillStyle = pool;
  sc.beginPath();
  sc.arc(0, 0, 128, 0, Math.PI * 2);
  sc.fill();
  shadow.refresh();

  // A soft round glow: opaque in the middle, fading out to nothing. Tinted and laid under bright things.
  const halo = textures.createCanvas('halo', 256, 256)!;
  const hc = halo.context;
  const glowFade = hc.createRadialGradient(128, 128, 0, 128, 128, 128);
  glowFade.addColorStop(0, 'rgba(255, 255, 255, 1)');
  glowFade.addColorStop(0.3, 'rgba(255, 255, 255, 0.55)');
  glowFade.addColorStop(0.65, 'rgba(255, 255, 255, 0.15)');
  glowFade.addColorStop(1, 'rgba(255, 255, 255, 0)');
  hc.fillStyle = glowFade;
  hc.fillRect(0, 0, 256, 256);
  halo.refresh();

  const vignette = textures.createCanvas('vignette', 480, 270)!;
  const vc = vignette.context;
  vc.translate(240, 135);
  vc.scale(1, 270 / 480);
  const corners = vc.createRadialGradient(0, 0, 150, 0, 0, 345);
  corners.addColorStop(0, 'rgba(62, 40, 96, 0)');
  corners.addColorStop(1, 'rgba(62, 40, 96, 0.28)');
  vc.fillStyle = corners;
  vc.fillRect(-240, -240, 480, 480);
  vignette.refresh();

  const grain = textures.createCanvas('grain', 960, 540)!;
  const dots = grain.context.createImageData(960, 540);
  for (let i = 0; i < dots.data.length; i += 4) {
    const light = Math.random() < 0.5;
    dots.data[i] = light ? 255 : 51;
    dots.data[i + 1] = light ? 247 : 38;
    dots.data[i + 2] = light ? 230 : 30;
    dots.data[i + 3] = Math.random() * 12;
  }
  grain.context.putImageData(dots, 0, 0);
  grain.refresh();

  // A small white chip, tinted in the game: confetti, splinters and gravel.
  const bit = textures.createCanvas('bit', 16, 10)!;
  bit.context.fillStyle = '#ffffff';
  bit.context.beginPath();
  bit.context.roundRect(0, 0, 16, 10, 3);
  bit.context.fill();
  bit.refresh();

  // A four-pointed twinkle, for impacts.
  const star = textures.createCanvas('twinkle', 64, 64)!;
  const tw = star.context;
  tw.fillStyle = '#ffffff';
  tw.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 7 : 30;
    tw.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  tw.closePath();
  tw.fill();
  star.refresh();
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#2A2140',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: true },
  physics: {
    default: 'matter',
    matter: { gravity: { x: 0, y: 1 }, positionIterations: 10, velocityIterations: 8, constraintIterations: 6, debug: location.search.includes('debug') },
  },
});

game.events.once('ready', async () => {
  const three = [0, 1, 2];
  const arts: art.Art[] = [
    // Things near the camera have a boiling line. Scenery further back holds still.
    ...art.ITEMS.flatMap((spec) => (spec.pet ? art.MOODS.map((m) => () => art.itemArt(spec, m)) : spec.fragile ? [() => art.itemArt(spec), () => art.itemArt(spec, 'broken')] : [() => art.itemArt(spec)])).flatMap(art.boiled),
    ...art.boiled(() => art.truckArt()),
    ...art.boiled(() => art.truckArt(true)),
    ...art.boiled(() => art.wheelArt(false)),
    ...art.boiled(() => art.wheelArt(true)),
    // The houses are the biggest pictures in the game and barely move: one drawing each, no boil.
    { ...art.shackArt('house_old'), key: 'house_old#0' },
    { ...art.manorArt('house_new'), key: 'house_new#0' },
    ...Array.from({ length: art.TREE_KINDS }, (_, n) => n).flatMap((n) => art.boiled(() => art.treeArt(n))),
    // Far scenery is softened a little, so the truck and its cargo are the sharp things on screen.
    ...three.map((n) => art.blurred(art.hillArt(n), 1.6)),
    ...three.map((n) => art.blurred(art.farHillArt(n), 2.6)),
    ...three.map(art.cloudArt),
    ...three.map((n) => art.blurred(os.townArt(n), 1.4)),
    ...three.map(art.pebbleArt),
    ...[0, 1].flatMap((n) => [os.bushArt(n), os.tuftArt(n), os.flowerArt(n)]),
    os.sunArt(),
    ...art.EYE_MOODS.flatMap((m) => art.boiled(() => art.eyeArt(m))),
    ...art.DRIVER_MOODS.flatMap((m) => art.boiled(() => art.driverArt(m))),
    ...art.boiled(art.freshenerArt),
    ...art.boiled(art.aerialArt),
    os.bumpSignArt(),
    os.hillSignArt(),
    os.milestoneArt(),
    os.homeSignArt(),
    os.plankSignArt(),
    art.officialSignArt(),
    ...tollArts(),
    art.tollArmArt(),
    art.railSignalArt(),
    art.fuelCanArt(),
    art.bubbleWrapArt(),
    art.crossbowArt(true),
    art.crossbowArt(false),
    art.boltArt(),
    art.winchPostArt(),
    art.dashArt(),
    art.hbHandleArt(),
    art.receiptArt(),
    art.ribbonArt(),
    art.stampArt(),
    art.speedoArt(),
    art.speedoGlassArt(),
    art.gearBadgeArt(),
    art.gateArt(),
    art.knobArt(),
    art.panelArt('card', 560, 100),
    art.panelArt('pill', 1160, 60),
    art.sparkArt(),
    os.fieldArt(),
    art.blurred(os.fenceArt(), 1.2),
    art.blurred(os.poleArt(), 1.0),
    os.lampPostArt(),
    art.puffArt(),
    art.buttonArt('btn', 300, C.mustard),
    art.buttonArt('btn_rope', 260, C.oat),
    art.panelArt('panel', 1000, 690),
    art.coinArt(),
    art.heartArt('heart', C.terracotta),
    art.heartArt('heart_empty', C.creamShade),
    ...titleArts(),
    ...os.backdropArts(),
  ];
  softTextures(game.textures);
  // The pictures are drawn a few at a time rather than all at once: a phone decoding hundreds of SVGs
  // together can run out of memory and have its tab closed. The loading bar shows how far it has got.
  const bar = document.querySelector<HTMLElement>('#boot .bar span');
  let done = 0;
  const total = arts.length;
  const drawAll = async () => {
    let next = 0;
    const worker = async () => {
      while (next < arts.length) {
        const a = arts[next++];
        await art.loadArt(game.textures, a);
        done++;
        if (bar && done % 4 === 0) bar.style.width = `${Math.round((done / total) * 92)}%`;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  };
  await Promise.all([
    makeCursors(),
    drawAll(),
    prepareLeg(game.textures, 1),
    document.fonts.load('400 40px "Anton"'),
    document.fonts.load('400 40px "Space Mono"'),
    document.fonts.load('700 40px "Space Mono"'),
  ]);
  if (bar) bar.style.width = '100%';
  const boot = document.getElementById('boot');
  if (boot) {
    boot.style.opacity = '0';
    setTimeout(() => boot.remove(), 450);
  }
  game.scene.add('play', PlayScene, false);
  game.scene.add('title', TitleScene, true);
});

// A phone held upright shows the 'turn your phone' card (index.html) over a game too small to play:
// let the game sleep meanwhile, rather than keep drawing and holding memory through the rotation.
const upright = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
const rest = () => (upright.matches ? game.loop.sleep() : game.loop.wake());
upright.addEventListener('change', rest);
game.events.once('ready', rest);

// If anything goes wrong while starting, say so on the loading sheet instead of leaving a black screen.
const failed = (msg: string) => {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('err');
  const p = boot.querySelector('p');
  if (p) p.textContent = `SOMETHING WENT WRONG: ${msg}`.slice(0, 220);
};
window.addEventListener('error', (e) => failed(e.message || 'unknown error'));
window.addEventListener('unhandledrejection', (e) => failed(String((e.reason as Error)?.message ?? e.reason)));

// Handy while building the game.
(window as unknown as { game: Phaser.Game }).game = game;

// While building: window.__view(leg, scrollX | 'end') jumps straight to a place on a leg, to look at it.
if (import.meta.env.DEV) {
  (window as unknown as { __view: (n: number, sx: number | 'end') => Promise<number> }).__view = async (n, sx) => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await prepareLeg(game.textures, n);
    let s = game.scene.getScene('play') as unknown as { sys: Phaser.Scenes.Systems; leg?: { n: number }; scene: Phaser.Scenes.ScenePlugin; cameras: Phaser.Cameras.Scene2D.CameraManager };
    if (!s.sys.isActive() || s.leg?.n !== n) {
      const trip = { leg: n, cargo: [{ key: 'box_l', broken: false, dx: -80, dy: -60, angle: 0, tied: true }], lost: [], broken: [], parking: [], time: 0 };
      const data = n === 1 ? { intro: false } : { leg: n, trip };
      if (s.sys.isActive()) s.scene.restart(data);
      else game.scene.getScene('title').scene.start('play', data);
      await wait(6500);
      s = game.scene.getScene('play') as unknown as typeof s;
    }
    s.cameras.main.scrollX = sx === 'end' ? LEGS[n - 1].finish + 490 - 960 : sx;
    await wait(1200);
    return n;
  };

  // While building: window.__qa() plays the whole game, start to finish, and reports what it found.
  (window as unknown as { __qa: () => ReturnType<typeof runQA> }).__qa = () => runQA(game);
}
