// Only the weights used are loaded, so every title is Fraunces Black and all other text Karla Bold.
import '@fontsource/fraunces/900.css';
import '@fontsource/karla/700.css';
import Phaser from 'phaser';
import * as art from './art';
import { C, type Pt } from './ink';
import { PlayScene, CHUNK, CHUNK_TOP } from './game';
import { makeCursors } from './cursors';
import { TitleScene, titleArts } from './title';
import { backdropArts } from './backdrop';
import { audio } from './audio';

// Browsers keep sound off until the player does something; the first click or key turns it on.
// M mutes and unmutes everywhere.
for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, () => audio.unlock());
window.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') audio.toggleMute();
});
import { H, W, WORLD_END, WORLD_START, groundY } from './terrain';

function groundChunks(): art.Art[] {
  const out: art.Art[] = [];
  for (let x0 = WORLD_START, i = 0; x0 < WORLD_END; x0 += CHUNK, i++) {
    const pts: Pt[] = [];
    for (let x = 0; x <= CHUNK; x += 30) pts.push([x, groundY(x0 + x) - CHUNK_TOP]);
    out.push(art.groundArt(`ground_${i}`, pts, H - CHUNK_TOP + 40, x0));
  }
  return out;
}

/** Soft pictures that ink cannot draw: the sky, shadows, darker corners and paper grain. */
function softTextures(textures: Phaser.Textures.TextureManager) {
  const sky = textures.createCanvas('sky', 8, 540)!;
  const fade = sky.context.createLinearGradient(0, 0, 0, 540);
  fade.addColorStop(0, '#4E4B9C');
  fade.addColorStop(0.42, '#C97FB0');
  fade.addColorStop(0.72, '#FF9E7A');
  fade.addColorStop(1, '#FFD49A');
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
    ...art.boiled(art.wheelArt),
    ...art.boiled(() => art.houseArt('house_old', { wall: C.teal, wallShade: '#2C7F8C', roof: C.terracotta, roofShade: C.terracottaDark, turretRoof: C.plum, door: C.walnut, trim: C.cream }, 'old')),
    ...art.boiled(() => art.houseArt('house_new', { wall: '#B59BD6', wallShade: '#8E74B8', roof: C.mustard, roofShade: C.dry, turretRoof: C.terracotta, door: C.teal, trim: C.cream }, 'new')),
    ...Array.from({ length: art.TREE_KINDS }, (_, n) => n).flatMap((n) => art.boiled(() => art.treeArt(n))),
    // Far scenery is softened a little, so the truck and its cargo are the sharp things on screen.
    ...three.map((n) => art.blurred(art.hillArt(n), 1.6)),
    ...three.map((n) => art.blurred(art.farHillArt(n), 2.6)),
    ...three.map(art.cloudArt),
    ...three.map((n) => art.blurred(art.townArt(n), 1.4)),
    ...three.map(art.pebbleArt),
    ...[0, 1].flatMap((n) => [art.bushArt(n), art.tuftArt(n), art.flowerArt(n)]),
    art.sunArt(),
    ...art.EYE_MOODS.flatMap((m) => art.boiled(() => art.eyeArt(m))),
    ...art.boiled(art.freshenerArt),
    ...art.boiled(art.aerialArt),
    art.bumpSignArt(),
    art.hillSignArt(),
    art.milestoneArt(),
    art.homeSignArt(),
    art.plankSignArt(),
    art.tollBoothArt(),
    art.tollArmArt(),
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
    art.fieldArt(),
    art.blurred(art.fenceArt(), 1.2),
    art.blurred(art.poleArt(), 1.0),
    art.lampPostArt(),
    art.puffArt(),
    art.buttonArt('btn', 300, C.mustard),
    art.buttonArt('btn_rope', 260, C.oat),
    art.panelArt('panel', 1000, 690),
    art.coinArt(),
    art.heartArt('heart', C.terracotta),
    art.heartArt('heart_empty', C.creamShade),
    ...groundChunks(),
    ...titleArts(),
    ...backdropArts(),
  ];
  softTextures(game.textures);
  await Promise.all([
    makeCursors(),
    ...arts.map((a) => art.loadArt(game.textures, a)),
    document.fonts.load('700 40px "Karla"'),
    document.fonts.load('900 40px "Fraunces"'),
  ]);
  game.scene.add('play', PlayScene, false);
  game.scene.add('title', TitleScene, true);
});

// Handy while building the game.
(window as unknown as { game: Phaser.Game }).game = game;
