import Phaser from 'phaser';
import { HOUSE, TRUCK, type Art, DRIVER } from './art';
import { DRIVER_AT } from './game';
import { CURSOR } from './cursors';
import { C, Pen, type Pt } from './ink';
import { buildBackdrop } from './backdrop';
import { GROUND, H, W } from './terrain';
import { CHUNK_TOP, prepareLeg } from './prepare';
import { LEGS, clearTrip, loadTrip, type Trip } from './legs';
import { ambience, audio, music, play } from './audio';

const TITLE = '"Fraunces", serif';
const TEXT = '"Karla", sans-serif';
/** The road the truck drives along on the title screen. */
const ROAD = 944;

/** A ridge of land across the whole screen, inked along its top, filled down to the bottom. */
function ridgeArt(key: string, top: Pt[], fill: string, line: string, shade?: string): Art {
  const p = new Pen(key, 0, 0);
  const pts: Pt[] = [...top, [W + 40, H + 40], [-40, H + 40]];
  p.shape(pts, { fill, stroke: line, width: 6, raw: true, wobble: 1.4, shade: shade ? [{ pts: [[-40, H * 0.85], [W + 40, H * 0.8], [W + 40, H + 40], [-40, H + 40]], color: shade }] : undefined });
  return { key, svg: p.svg(W, H), w: W, h: H };
}

/** A smooth line of hills, from a few heights across the screen. */
function hills(y: number, heights: number[]): Pt[] {
  const out: Pt[] = [];
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const k = t * (heights.length - 1);
    const a = Math.floor(k);
    const b = Math.min(heights.length - 1, a + 1);
    const f = k - a;
    const s = f * f * (3 - 2 * f);
    out.push([-40 + t * (W + 80), y - (heights[a] * (1 - s) + heights[b] * s)]);
  }
  return out;
}

/** The pictures only the title screen uses. */
export function titleArts(): Art[] {
  return [
    ridgeArt('t_hill', hills(860, [40, 70, 50, 120, 230, 260, 180]), '#4E9A72', '#2F7A5E', '#3E8466'),
  ];
}

/**
 * The home screen: a sunset over layered hills, the new house waiting on a hill, and the truck,
 * piled high, rolling along the road towards it. The title bounces; Play (or Enter) starts the game.
 */
export class TitleScene extends Phaser.Scene {
  private truck!: Phaser.GameObjects.Container;
  private wheels: Phaser.GameObjects.Image[] = [];
  private letters: Phaser.GameObjects.Text[] = [];
  private rays!: Phaser.GameObjects.Graphics;
  private scenery: { sails: Phaser.GameObjects.Image[]; clouds: { img: Phaser.GameObjects.Image; speed: number }[] } = { sails: [], clouds: [] };
  /** The top of the load, swaying on the bumps: each with its own rhythm. */
  private wobblers: { img: Phaser.GameObjects.Image; t: number; amp: number }[] = [];
  private cat!: Phaser.GameObjects.Image;
  private flies: { img: Phaser.GameObjects.Image; x: number; y: number; t: number }[] = [];
  private leaving = false;

  constructor() {
    super('title');
  }

  create() {
    music.play('title');
    ambience.birds(true);
    // A sound toggle in the corner; M works everywhere.
    const soundLabel = this.add.text(30, 30, '', { fontFamily: '"Karla", sans-serif', fontSize: '28px', color: C.cream, stroke: C.ink, strokeThickness: 6 }).setDepth(40).setInteractive({ cursor: CURSOR.open });
    const show = () => soundLabel.setText(`Sound: ${audio.muted ? 'off' : 'on'}  (M)`);
    soundLabel.on('pointerdown', () => {
      audio.unlock();
      audio.toggleMute();
      show();
    });
    this.input.keyboard!.on('keydown-M', show);
    show();
    this.leaving = false;
    this.letters = [];
    this.wheels = [];
    this.flies = [];
    this.input.setDefaultCursor(CURSOR.point);

    // Sky and sun, at the very back.
    this.add.image(0, 0, 'title_sky').setOrigin(0).setDisplaySize(W, H).setDepth(-60);
    this.rays = this.add.graphics().setDepth(-55);
    this.add.image(1330, 470, 'halo').setDisplaySize(900, 900).setTint(0xffb867).setAlpha(0.75).setDepth(-54);
    this.add.image(1330, 470, 'halo').setDisplaySize(420, 420).setTint(0xfff0b0).setAlpha(0.9).setDepth(-53);
    this.add.circle(1330, 470, 120, 0xffd27a).setStrokeStyle(6, 0xff9e5e).setDepth(-52);

    // Mountains, forest and farmland in layers of haze, with clouds, birds, windmills, pollen and leaves.
    this.scenery = buildBackdrop(this, { reach: 0, horizon: 870, width: W, height: H, parallax: false });

    // The hill with the new house on it, trees, the road, and tall grass in front.
    this.add.image(1360, 652, 'house_new#0').setOrigin(0.5, HOUSE.ground / HOUSE.h).setScale(0.36).setDepth(-21);
    this.add.image(0, 0, 't_hill').setOrigin(0).setDepth(-20);
    for (const [x, kind, s] of [[180, 1, 1.25], [330, 0, 1.05], [1700, 2, 1.2], [1830, 3, 1.0]] as const) {
      this.add.image(x, 900, `tree_${kind}#0`).setOrigin(0.5, 392 / 406).setScale(s).setDepth(-15);
    }
    // The same textured road as the game: two flat stretches from the start of the drive.
    for (const [i, x] of [[0, 0], [1, 1500]] as const) this.add.image(x, ROAD - 6 - (GROUND - CHUNK_TOP), `ground_${i}`).setOrigin(0).setDepth(-10);
    for (let x = -100; x < W; x += 1200) this.add.image(x, H + 110, 'bd_grass').setOrigin(0, 1).setDepth(20);

    // Fireflies over the hill.
    for (let i = 0; i < 14; i++) {
      const x = 900 + Math.random() * 950;
      const y = 640 + Math.random() * 220;
      this.flies.push({ img: this.add.image(x, y, 'halo').setDisplaySize(26, 26).setTint(0xffe58a).setDepth(-14), x, y, t: Math.random() * 10 });
    }

    this.buildTruck();

    // Title, letter by letter, so each can bounce.
    const word = 'Shifting Day';
    const size = 150;
    let x = 160;
    const y = 190;
    for (const ch of word) {
      if (ch === ' ') {
        x += size * 0.32;
        continue;
      }
      const shadow = this.add.text(x + 7, y + 10, ch, { fontFamily: TITLE, fontSize: `${size}px`, color: '#3B2F55' }).setOrigin(0, 0.5).setDepth(30).setAlpha(0.6);
      const t = this.add.text(x, y, ch, { fontFamily: TITLE, fontSize: `${size}px`, color: C.cream, stroke: C.ink, strokeThickness: 12 }).setOrigin(0, 0.5).setDepth(31);
      t.setData('shadow', shadow);
      this.letters.push(t);
      x += t.width - 10;
    }
    this.add
      .text(170, 300, 'Everything you own. One small truck. What could possibly go wrong?', { fontFamily: TEXT, fontSize: '36px', color: C.cream, stroke: C.ink, strokeThickness: 6 })
      .setOrigin(0, 0.5)
      .setDepth(31);

    // Play button.
    const bg = this.add.image(0, 0, 'btn').setScale(1.15);
    const label = this.add.text(0, -6, 'Play', { fontFamily: TITLE, fontSize: '60px', color: C.ink }).setOrigin(0.5);
    const play = this.add.container(370, 450, [bg, label]).setDepth(31);
    bg.setInteractive({ cursor: CURSOR.open });
    bg.on('pointerover', () => play.setScale(1.06));
    bg.on('pointerout', () => play.setScale(1));
    bg.on('pointerdown', () => this.start(null));
    this.tweens.add({ targets: play, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const saved = loadTrip();
    if (saved) {
      label.setText('New trip');
      const cbg = this.add.image(0, 0, 'btn').setScale(1.15, 1);
      const clabel = this.add.text(0, -6, `Continue · Leg ${saved.leg}`, { fontFamily: TITLE, fontSize: '40px', color: C.ink }).setOrigin(0.5);
      const cont = this.add.container(370, 590, [cbg, clabel]).setDepth(31);
      cbg.setInteractive({ cursor: CURSOR.open });
      cbg.on('pointerover', () => cont.setScale(1.06));
      cbg.on('pointerout', () => cont.setScale(1));
      cbg.on('pointerdown', () => this.start(saved));
      this.add.text(370, 668, `${LEGS[saved.leg - 1].title}  ·  Enter to continue`, { fontFamily: TEXT, fontSize: '26px', color: C.cream, stroke: C.ink, strokeThickness: 5 }).setOrigin(0.5).setDepth(31);
    } else {
      this.add.text(370, 540, 'or press Enter', { fontFamily: TEXT, fontSize: '30px', color: C.cream, stroke: C.ink, strokeThickness: 5 }).setOrigin(0.5).setDepth(31);
    }
    this.add.text(W - 30, H - 22, 'Made for GitHub Game Off 2026  ·  theme: SHIFT', { fontFamily: TEXT, fontSize: '26px', color: C.cream, stroke: C.ink, strokeThickness: 5 }).setOrigin(1, 1).setDepth(31);

    this.input.keyboard!.on('keydown-ENTER', () => this.start(saved));
    this.input.keyboard!.on('keydown-SPACE', () => this.start(saved));
  }

  /** The truck, piled high, with the cat on top: the same pictures as in the game. */
  private buildTruck() {
    const parts: Phaser.GameObjects.GameObject[] = [];
    const bedY = 0;
    const add = (key: string, x: number, bottom: number, originY = 1) => {
      const img = this.add.image(x, bottom, key).setOrigin(0.5, originY);
      parts.push(img);
      return img;
    };
    parts.push(this.add.image(0, 0, 'truck#0').setOrigin(TRUCK.ox / TRUCK.w, TRUCK.oy / TRUCK.h));
    // The driver in the cab, grinning: off on the big move.
    parts.push(this.add.image(DRIVER_AT.x, DRIVER_AT.y, 'driver_happy#0').setOrigin(DRIVER.head.x / DRIVER.w, DRIVER.head.y / DRIVER.h));
    // The load, stacked as a player might: tall things at the back, the cat riding on top.
    const clock = add('clock#0', -150, bedY + 14);
    add('armchair#0', -50, bedY + 14);
    add('box_l#0', 90, bedY + 14);
    const plant = add('plant#0', 100, bedY + 14 - 90 + 14);
    const box = add('box_m#0', -52, bedY + 14 - 135 + 14);
    this.cat = add('cat_calm#0', -52, bedY + 14 - 135 - 68 + 28);
    const lamp = add('lamp#0', 160, bedY + 14).setScale(0.9);
    this.wobblers = [
      { img: plant, t: 0.3, amp: 0.05 },
      { img: box, t: 1.1, amp: 0.025 },
      { img: this.cat, t: 1.1, amp: 0.025 },
      { img: lamp, t: 2.0, amp: 0.07 },
    ];
    clock.setScale(0.95);
    parts.push(this.add.image(0, 0, 'truck_front#0').setOrigin(TRUCK.ox / TRUCK.w, TRUCK.oy / TRUCK.h));
    const decal = this.add.text(0, -7, 'SHIFT HAPPENS', { fontFamily: TITLE, fontSize: '22px', color: C.terracotta }).setOrigin(0.5);
    parts.push(decal.setScale(Math.min(1, 176 / decal.width)));
    for (const w of TRUCK.wheels) {
      const wheel = this.add.image(w.x, w.y, 'wheel#0');
      this.wheels.push(wheel);
      parts.push(wheel);
    }
    parts.push(this.add.image(TRUCK.wheels[1].x + 105, -28, 'eye_happy#0'));
    this.truck = this.add.container(720, ROAD - 130, parts).setScale(1.05);
  }

  /** Play: the truck pulls away and drives off to the right, then the game opens with it backing up to the old house. */
  private start(trip: Trip | null) {
    if (this.leaving) return;
    this.leaving = true;
    if (!trip) clearTrip();
    const ready = trip ? prepareLeg(this.textures, trip.leg) : Promise.resolve();
    audio.unlock();
    play('click');
    play('honk');
    // The cat has views about this.
    this.time.delayedCall(350, () => play('meow'));
    // The cat has not agreed to any of this.
    this.cat.setTexture('cat_panic#0');
    this.tweens.add({
      targets: this.truck,
      x: W + 800,
      duration: 1500,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.cameras.main.fadeOut(260, 42, 33, 64);
        this.cameras.main.once('camerafadeoutcomplete', () => void ready.then(() => this.scene.start('play', trip ? { leg: trip.leg, trip } : { intro: true })));
      },
    });
  }

  update(time: number, delta: number) {
    // The title's letters bob in a wave.
    this.letters.forEach((t, i) => {
      const dy = Math.sin(time / 420 + i * 0.55) * 8;
      t.setY(190 + dy).setRotation(Math.sin(time / 600 + i) * 0.03);
      (t.getData('shadow') as Phaser.GameObjects.Text).setY(202 + dy);
    });
    // The truck rumbles along on the spot, its wheels turning; dust puffs out behind.
    this.truck.y = ROAD - 130 + Math.sin(time / 90) * 1.6 + (Math.sin(time / 1400) > 0.97 ? -4 : 0);
    for (const w of this.wheels) w.rotation += delta * (this.leaving ? 0.02 : 0.006);
    // The load sways; the box and the cat on it move together, and the cat leans back as the truck pulls away.
    for (const w of this.wobblers) {
      const sway = Math.sin(time / 260 + w.t * 3) * w.amp + (Math.sin(time / 1400) > 0.97 ? w.amp * 1.5 : 0);
      w.img.setRotation(sway - (this.leaving ? 0.25 : 0));
    }
    this.cat.x = -52 + Math.sin(time / 260 + 3.3) * 4;
    if (Math.floor(time / 180) !== Math.floor((time - delta) / 180)) {
      const puff = this.add.image(this.truck.x - 230, ROAD - 10, 'puff').setScale(0.4).setAlpha(0.7).setTint(0xf2cfa8);
      this.tweens.add({ targets: puff, x: puff.x - 160, y: puff.y - 40, scale: 1.2, alpha: 0, duration: 1100, onComplete: () => puff.destroy() });
    }
    // Clouds drift and windmills turn; fireflies wander and twinkle.
    for (const c of this.scenery.clouds) {
      c.img.x += delta * c.speed * 3;
      if (c.img.x > W + 400) c.img.x = -500;
    }
    for (const s of this.scenery.sails) s.rotation += delta * 0.0012;
    for (const f of this.flies) {
      f.t += delta / 1000;
      f.img.setPosition(f.x + Math.sin(f.t * 0.9) * 30, f.y + Math.cos(f.t * 1.3) * 18).setAlpha(0.4 + 0.5 * Math.abs(Math.sin(f.t * 2)));
    }
    // Soft rays from the sun, turning slowly.
    const g = this.rays.clear();
    for (let i = 0; i < 14; i++) {
      const a = time / 9000 + (i / 14) * Math.PI * 2;
      g.fillStyle(0xfff0c0, 0.07).slice(1330, 470, 1300, a, a + 0.09).fillPath();
    }
  }
}
