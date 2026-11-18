import Phaser from 'phaser';
import { TRUCK, DRIVER, type Art } from './art';
import { DRIVER_AT } from './game';
import { CURSOR } from './cursors';
import { H, W } from './terrain';
import { prepareLeg } from './prepare';
import { clearTrip, loadTrip, type Trip } from './legs';
import { ambience, audio, music, play } from './audio';
import { PosterList, openControls } from './poster';
import { BONE, INK, RAMP_DARK, freeScratch, buildLogo, catEye, halftoneBeam, halftoneSun, inked, mk, paperBackdrop, printRays, tape, type Logo } from './logo';

/**
 * The title screen, designed outward from the logo. The logo is a screen-printed punk gig poster -
 * hand-cut letters, bone and ember on black, a hard ink outline, grit and spatter - so everything
 * else is printed in the same three inks on the same sheet:
 *
 * - the ground is a black poster sheet with paper fibres and an ember halftone heat rising from the foot;
 * - behind the logo, dark printed sun rays turn slowly around a halftone sun;
 * - the truck is re-inked through the logo's palette with the same outline and an ember layer slipped
 *   off register, so it is printed on the poster too, not pasted in from another game; its headlight
 *   is a halftone beam, and ink speed lines and dust give it pace;
 * - the menu is set in the logo's own condensed face; the selected item sits on a strip of torn ember
 *   tape that slides between items;
 * - printer's crop and registration marks frame the sheet.
 *
 * It all lands in sequence - sheet, rays, sun, the logo slammed in, the truck rolling in, the menu -
 * and then idles with the rays turning, the cat blinking, the logo slipping out of register now and
 * then, and the truck running on the spot. Mouse, keys, gamepad and touch all drive the menu.
 */
const DISPLAY = '"Anton", "Impact", sans-serif';
const MONO = '"Space Mono", monospace';
const EMBER = 0xff6a30;
const RED = 0xe3263a;
const INK_N = 0x0a0712;
const BONE_N = 0xf3e3cc;
/** Where the truck's wheels meet the road. */
const ROAD = 990;
const LEFT = 118;
const TRUCK_K = 0.8;
const TRUCK_X = 1030;
const TRUCK_Y = ROAD - (TRUCK.wheels[0].y + TRUCK.wheelR) * TRUCK_K;
/** The wordmark's centre and size on screen, and the sun behind it. */
const LOGO_Y = 372;
const LOGO_K = 0.82;
const SUN_Y = 420;
/** The painted pieces take a moment to make, so they are made once per page load and kept. */
let logoMeta: Logo | null = null;

/** The title screen's pictures are painted on canvases when it opens; nothing to ink in advance. */
export function titleArts(): Art[] {
  return [];
}

interface MenuItem {
  label: () => string;
  act: () => void;
  text: Phaser.GameObjects.Text;
  num: Phaser.GameObjects.Text;
}

export class TitleScene extends Phaser.Scene {
  private truck!: Phaser.GameObjects.Container;
  private wheels: Phaser.GameObjects.Image[] = [];
  private cat!: Phaser.GameObjects.Image;
  private beam!: Phaser.GameObjects.Image;
  private fx!: Phaser.GameObjects.Graphics;
  private speed = 1;
  private streaks: { x: number; y: number; len: number; w: number }[] = [];
  private embers: { img: Phaser.GameObjects.Rectangle; vx: number; vy: number; t: number }[] = [];
  private logo?: Phaser.GameObjects.Container;
  private slices: { img: Phaser.GameObjects.Image; x: number }[] = [];
  private ghosts: Phaser.GameObjects.Image[] = [];
  private grain!: Phaser.GameObjects.Image;
  private layers: { obj: Phaser.GameObjects.Components.Transform; x: number; y: number; k: number }[] = [];
  private items: MenuItem[] = [];
  private sel = 0;
  private tapeImg!: Phaser.GameObjects.Image;
  private stickCool = 0;
  private dustClock = 0;
  private leaving = false;
  private ready = false;
  private list?: PosterList;

  constructor() {
    super('title');
  }

  create() {
    this.leaving = false;
    this.ready = false;
    this.wheels = [];
    this.speed = 1;
    this.streaks = [];
    this.embers = [];
    this.logo = undefined;
    this.slices = [];
    this.ghosts = [];
    this.layers = [];
    this.items = [];
    this.sel = 0;
    this.dustClock = 0;
    this.input.setDefaultCursor(CURSOR.point);
    music.play('title');
    ambience.birds(false);
    try {
      this.cameras.main.filters.internal.clear();
      this.cameras.main.filters.external.clear();
    } catch {
      // Filters are a nicety.
    }
    this.makeTextures();
    this.buildSheet();
    this.buildTruck();
    this.buildWordmark();
    this.buildMenu();
    this.buildFrame();
    freeScratch(this.textures);
    this.cameras.main.fadeIn(700, 0, 0, 0);
  }

  // ------------------------------------------------------------------ textures

  private addCanvas(key: string, canvas: HTMLCanvasElement) {
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, canvas);
  }

  private makeTextures() {
    if (logoMeta && this.textures.exists('t_logo')) return;
    logoMeta = buildLogo();
    this.addCanvas('t_logo', logoMeta.canvas);
    const eye = catEye();
    this.addCanvas('t_eye', eye);
    // The logo as the game shows it over Old Street: smaller, and with the cat's eyes painted in, since
    // there is no blinking overlay there to supply them.
    {
      const k = 0.4;
      const [c, ctx] = mk(logoMeta.canvas.width * k, logoMeta.canvas.height * k);
      ctx.drawImage(logoMeta.canvas, 0, 0, c.width, c.height);
      for (const e of logoMeta.eyes) {
        const g = ctx.createRadialGradient(e.x * k, e.y * k, 0, e.x * k, e.y * k, 34 * k * 1.6);
        g.addColorStop(0, 'rgba(255, 170, 60, 0.75)');
        g.addColorStop(1, 'rgba(255, 170, 60, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(e.x * k - 60, e.y * k - 60, 120, 120);
        ctx.drawImage(eye, e.x * k - (eye.width * k) / 2, e.y * k - (eye.height * k) / 2, eye.width * k, eye.height * k);
      }
      this.addCanvas('t_logo_small', c);
    }
    // The paper and the rays are soft, so they are painted small and drawn large: a fraction of the memory.
    if (!this.textures.exists('t_paper')) this.addCanvas('t_paper', paperBackdrop(W / 2, H / 2));
    this.addCanvas('t_rays', printRays(1000, 28, '#3A0F22'));
    this.addCanvas('t_hsun', halftoneSun(900));
    this.addCanvas('t_beam', halftoneBeam(760, 320));
    this.addCanvas('t_tape', tape(640, 84, '#FF6A30', 11));
  }

  // ------------------------------------------------------------------ sheet

  private parallax(obj: Phaser.GameObjects.Components.Transform, k: number) {
    this.layers.push({ obj, x: obj.x, y: obj.y, k });
  }

  /** The black sheet, the rays and the sun, and the road band at the foot. */
  private buildSheet() {
    this.add.image(0, 0, 't_paper').setOrigin(0).setDisplaySize(W, H).setDepth(-100);

    const rays = this.add.image(W / 2, SUN_Y, 't_rays').setDepth(-95).setAlpha(0).setScale(1.7);
    this.tweens.add({ targets: rays, alpha: 1, scale: 2.8, duration: 1400, ease: 'Expo.easeOut', delay: 150 });
    this.tweens.add({ targets: rays, angle: 360, duration: 160000, repeat: -1 });
    this.parallax(rays, 8);

    const sun = this.add.image(W / 2, SUN_Y + 120, 't_hsun').setDepth(-90).setScale(0.86).setAlpha(0);
    this.tweens.add({ targets: sun, y: SUN_Y, alpha: 1, duration: 1600, ease: 'Cubic.easeOut', delay: 250 });
    this.tweens.add({ targets: sun, scale: 0.88, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 1900 });
    this.parallax(sun, 12);

    // The road: a solid ink band with a bone kerb line; dashes and speed lines are drawn every frame.
    this.add.rectangle(0, ROAD, W, H - ROAD, INK_N).setOrigin(0).setDepth(-50);
    this.add.rectangle(0, ROAD, W, 4, BONE_N, 0.85).setOrigin(0).setDepth(-49);
    this.fx = this.add.graphics().setDepth(-45);

    // Ember specks drifting up off the sheet.
    for (let i = 0; i < 34; i++) {
      const s = 2 + Math.random() * 4;
      const img = this.add.rectangle(Math.random() * W, H - Math.random() * 600, s, s, Math.random() < 0.7 ? EMBER : BONE_N, 0.8).setDepth(40).setAngle(45);
      this.embers.push({ img, vx: -6 - Math.random() * 24, vy: -16 - Math.random() * 30, t: Math.random() * 10 });
    }
  }

  // ------------------------------------------------------------------ truck

  /** Paints pictures onto one canvas, each placed by its origin as the game would place it. */
  private compose(parts: [string, number, number, number, number, number?][], ox: number, oy: number, w: number, h: number) {
    const [c, ctx] = mk(w, h);
    for (const [key, x, y, fx, fy, s = 1] of parts) {
      const img = this.textures.get(key).getSourceImage() as HTMLCanvasElement;
      ctx.drawImage(img, ox + x - fx * img.width * s, oy + y - fy * img.height * s, img.width * s, img.height * s);
    }
    return { c, ctx };
  }

  /**
   * The truck, printed on the poster: re-inked through the logo's ramp, outlined in ink, with an
   * ember layer slipped off register. The cat is its own piece so it can ride the bumps; the wheels
   * turn; the headlight is a halftone beam.
   */
  private buildTruck() {
    const OX = 330;
    const OY = 400;
    const CW = 920;
    const CH = 580;
    if (!this.textures.exists('t_truck')) {
      const tox = TRUCK.ox / TRUCK.w;
      const toy = TRUCK.oy / TRUCK.h;
      const { c: body, ctx } = this.compose(
        [
          ['truck#0', 0, 0, tox, toy],
          ['driver_happy#0', DRIVER_AT.x, DRIVER_AT.y, DRIVER.head.x / DRIVER.w, DRIVER.head.y / DRIVER.h],
          ['clock#0', -150, 14, 0.5, 1, 0.95],
          ['armchair#0', -50, 14, 0.5, 1],
          ['box_l#0', 90, 14, 0.5, 1],
          ['plant#0', 100, -62, 0.5, 1],
          ['box_m#0', -52, -107, 0.5, 1],
          ['lamp#0', 160, 14, 0.5, 1, 0.9],
          ['truck_front#0', 0, 0, tox, toy],
        ],
        OX,
        OY,
        CW,
        CH,
      );
      ctx.font = '24px "Anton", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#231A2A';
      ctx.letterSpacing = '4px';
      const decal = Math.min(1, 176 / ctx.measureText('SHIFT HAPPENS').width);
      ctx.save();
      ctx.translate(OX, OY - 7);
      ctx.scale(decal, decal);
      ctx.fillText('SHIFT HAPPENS', 0, 0);
      ctx.restore();
      this.addCanvas('t_truck', inked(body, 10, [-8, 5], RAMP_DARK).canvas);
      const cat = this.textures.get('cat_calm#0').getSourceImage() as HTMLCanvasElement;
      this.addCanvas('t_cat', inked(this.compose([['cat_calm#0', 0, 0, 0, 0]], 0, 0, cat.width, cat.height).c, 8, [-6, 4], RAMP_DARK).canvas);
      for (const k of ['wheel', 'wheel_front']) {
        const src = this.textures.get(`${k}#0`).getSourceImage() as HTMLCanvasElement;
        this.addCanvas(`t_${k}`, inked(this.compose([[`${k}#0`, 0, 0, 0, 0]], 0, 0, src.width, src.height).c, 8, [0, 0], RAMP_DARK).canvas);
      }
    }
    const bodyTex = this.textures.get('t_truck').getSourceImage() as HTMLCanvasElement;
    const pad = (bodyTex.width - CW) / 2;
    const catTex = this.textures.get('t_cat').getSourceImage() as HTMLCanvasElement;
    const catSrc = this.textures.get('cat_calm#0').getSourceImage() as HTMLCanvasElement;
    const catPad = (catTex.width - catSrc.width) / 2;

    const parts: Phaser.GameObjects.GameObject[] = [];
    // The headlight first, so the truck sits over the start of its beam.
    this.beam = this.add.image(TRUCK.hood.x + TRUCK.hood.w - 20, -40, 't_beam').setOrigin(0, 0.5).setAlpha(0.55);
    parts.push(this.beam);
    parts.push(this.add.image(0, 0, 't_truck').setOrigin((OX + pad) / bodyTex.width, (OY + pad) / bodyTex.height));
    this.cat = this.add.image(-52, -161, 't_cat').setOrigin(0.5, (catPad + catSrc.height) / catTex.height);
    parts.push(this.cat);
    for (const w of TRUCK.wheels) {
      const wheel = this.add.image(w.x, w.y, w === TRUCK.wheels[1] ? 't_wheel_front' : 't_wheel');
      this.wheels.push(wheel);
      parts.push(wheel);
    }
    const lamp = this.add.circle(TRUCK.hood.x + TRUCK.hood.w - 8, -40, 12, BONE_N);
    const tail = this.add.rectangle(TRUCK.bed.x - 6, 0, 14, 22, RED);
    parts.push(lamp, tail);
    this.truck = this.add.container(-800, TRUCK_Y, parts).setScale(TRUCK_K).setDepth(-40);
    this.tweens.add({ targets: this.truck, x: TRUCK_X, duration: 1500, ease: 'Expo.easeOut', delay: 1300 });
    this.tweens.add({ targets: this.beam, alpha: { from: 0.45, to: 0.62 }, duration: 90, yoyo: true, repeat: -1, repeatDelay: 2300 });
  }

  // ------------------------------------------------------------------ wordmark

  /** The lockup, slammed in on the beat, then idling: blinking cat, sheen, and slips out of register. */
  private buildWordmark() {
    const meta = logoMeta!;
    const lw = meta.canvas.width;
    const lh = meta.canvas.height;
    const cy = LOGO_Y;

    const logo = this.add.container(W / 2, cy).setDepth(52).setScale(LOGO_K * 1.6).setAlpha(0);
    this.logo = logo;
    for (const tint of [0xff3355, 0x33e0ff]) {
      const g = this.add.image(0, 0, 't_logo').setTint(tint).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      this.ghosts.push(g);
      logo.add(g);
    }
    const n = 7;
    for (let i = 0; i < n; i++) {
      const img = this.add.image(0, 0, 't_logo');
      img.setCrop(0, Math.floor((lh / n) * i), lw, Math.ceil(lh / n) + 1);
      this.slices.push({ img, x: 0 });
      logo.add(img);
    }
    const sheen = this.add.image(0, 0, 't_logo').setTint(0xfff4dc).setTintMode(Phaser.TintModes.FILL).setAlpha(0.4).setBlendMode(Phaser.BlendModes.ADD).setCrop(0, 0, 0, 0);
    logo.add(sheen);
    const eyes = meta.eyes.map((e) => {
      const halo = this.add.image(e.x - lw / 2, e.y - lh / 2, 'halo').setDisplaySize(150, 110).setTint(0xffa030).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      const eye = this.add.image(e.x - lw / 2, e.y - lh / 2, 't_eye').setScale(1, 0.05);
      logo.add([halo, eye]);
      return { eye, halo };
    });

    // A flash of the sheet on impact.
    const flash = this.add.rectangle(0, 0, W, H, BONE_N, 0).setOrigin(0).setDepth(90);
    this.tweens.add({
      targets: logo,
      scale: LOGO_K,
      alpha: 1,
      duration: 360,
      delay: 700,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.cameras.main.shake(240, 0.007);
        play('clunk', 0.6, 0.7);
        flash.setAlpha(0.22);
        this.tweens.add({ targets: flash, alpha: 0, duration: 380 });
        this.splat(W / 2, cy + 40);
        this.time.delayedCall(450, () => {
          for (const { eye, halo } of eyes) {
            this.tweens.add({ targets: eye, scaleY: 1, duration: 160, ease: 'Back.easeOut' });
            this.tweens.add({ targets: halo, alpha: 0.7, duration: 300 });
          }
          const blink = () => {
            if (!this.scene.isActive()) return;
            this.tweens.add({ targets: eyes.map((e) => e.eye), scaleY: 0.08, duration: 70, yoyo: true, ease: 'Sine.easeInOut' });
            this.time.delayedCall(2600 + Math.random() * 3200, blink);
          };
          this.time.delayedCall(2400, blink);
        });
      },
    });
    const runSheen = () => {
      const s = { v: -160 };
      this.tweens.add({ targets: s, v: lw + 40, duration: 900, ease: 'Sine.easeInOut', onUpdate: () => sheen.setCrop(Math.max(0, s.v), 0, 120, lh), onComplete: () => this.time.delayedCall(5200, runSheen) });
    };
    this.time.delayedCall(2400, runSheen);

    // The strap line, printed in bone on an ink block between two ember rules.
    const subY = cy + (meta.day.y + meta.day.h / 2 + 74 - lh / 2) * LOGO_K;
    const sub = this.add
      .text(W / 2, subY, 'EVERYTHING YOU OWN  ·  ONE SMALL TRUCK', { fontFamily: MONO, fontStyle: 'bold', fontSize: '24px', color: BONE, letterSpacing: 8, backgroundColor: INK, padding: { x: 18, y: 8 } })
      .setOrigin(0.5)
      .setDepth(52)
      .setAlpha(0);
    const rl = this.add.rectangle(W / 2 - sub.width / 2 - 14, subY, 0, 3, EMBER).setOrigin(1, 0.5).setDepth(52);
    const rr = this.add.rectangle(W / 2 + sub.width / 2 + 14, subY, 0, 3, EMBER).setOrigin(0, 0.5).setDepth(52);
    this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 1500 });
    this.tweens.add({ targets: [rl, rr], width: 160, duration: 800, delay: 1600, ease: 'Expo.easeOut' });

    this.time.addEvent({ delay: 5600, loop: true, callback: () => this.glitch(1) });
  }

  /** Ink spatter and grit thrown off the logo when it lands. */
  private splat(x: number, y: number) {
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 260 + Math.random() * 520;
      const s = 3 + Math.random() * 9;
      const bit = this.add.rectangle(x, y, s, s, Math.random() < 0.55 ? EMBER : BONE_N).setDepth(53).setAngle(Math.random() * 90);
      this.tweens.add({ targets: bit, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.5, angle: bit.angle + 180, alpha: 0, scale: 0.3, duration: 500 + Math.random() * 500, ease: 'Cubic.easeOut', onComplete: () => bit.destroy() });
    }
  }

  private glitch(strength: number) {
    if (this.leaving || !this.logo) return;
    const jolt = () => {
      for (const s of this.slices) s.img.x = s.x + (Math.random() < 0.5 ? (Math.random() - 0.5) * 110 * strength : 0);
      this.ghosts[0].setPosition(-14 * strength, 0).setAlpha(0.5);
      this.ghosts[1].setPosition(14 * strength, 3).setAlpha(0.45);
    };
    jolt();
    this.time.delayedCall(60, jolt);
    this.time.delayedCall(140, () => {
      for (const s of this.slices) this.tweens.add({ targets: s.img, x: s.x, duration: 240, ease: 'Expo.easeOut' });
      this.tweens.add({ targets: this.ghosts, alpha: 0, duration: 200 });
    });
  }

  // ------------------------------------------------------------------ menu

  /**
   * A short list in the logo's own face. The selected item is printed in ink on a strip of torn ember
   * tape, which slides and stretches to whichever item you move to; the rest sit back in dim bone.
   */
  private buildMenu() {
    const saved = loadTrip();
    const defs: { label: () => string; act: () => void }[] = [];
    if (saved) defs.push({ label: () => `CONTINUE — LEG ${saved.leg}`, act: () => this.start(saved) });
    defs.push({ label: () => (saved ? 'NEW TRIP' : 'START THE DRIVE'), act: () => this.start(null) });
    defs.push({
      label: () => 'CONTROLS',
      act: () => {
        // The Controls sheet over the title; the menu under it sleeps until it closes.
        this.ready = false;
        play('click');
        const pad = (this.input.gamepad?.total ?? 0) > 0;
        const touch = this.sys.game.device.input.touch && !this.sys.game.device.os.desktop;
        openControls(this, 200, () => (this.ready = true), pad ? 'pad' : touch ? 'touch' : 'keys');
      },
    });
    defs.push({
      label: () => `SOUND: ${audio.muted ? 'OFF' : 'ON'}`,
      act: () => {
        audio.unlock();
        audio.toggleMute();
        this.refreshMenu();
      },
    });

    // The same animated list as the pause menu: the tape springs to whatever you point at, the item
    // nudges and grows, a pointer pulses beside it, and a click squashes and flashes before it acts.
    const step = 80;
    const y0 = ROAD - 70 - (defs.length - 1) * step;
    const list = new PosterList(this, LEFT + 56, y0, defs, { step, size: 56, depth: 60 });
    this.list = list;
    list.setEnabled(false);
    list.container.setAlpha(0);
    this.tweens.add({ targets: list.container, alpha: 1, x: { from: -40, to: 0 }, duration: 600, delay: 2100, ease: 'Expo.easeOut' });
    this.time.delayedCall(2100, () => (this.ready = true));
    this.events.once('shutdown', () => list.destroy());

    const touch = this.sys.game.device.input.touch;
    const hint = touch ? 'TAP TO CHOOSE' : 'UP / DOWN  CHOOSE   ·   ENTER / A  GO   ·   M  SOUND';
    const h = this.add.text(W - LEFT, ROAD + 46, hint, { fontFamily: MONO, fontStyle: 'bold', fontSize: '22px', color: BONE, letterSpacing: 4 }).setOrigin(1, 0.5).setDepth(60).setAlpha(0);
    this.tweens.add({ targets: h, alpha: 0.6, duration: 800, delay: 2600 });

    const kb = this.input.keyboard!;
    kb.on('keydown-SPACE', () => this.activate());
    kb.on('keydown-M', () => this.refreshMenu());
    const pad = (_p: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      if (button.index === 9) this.activate();
    };
    this.input.gamepad?.on('down', pad);
    this.events.once('shutdown', () => this.input.gamepad?.off('down', pad));
  }

  private refreshMenu() {
    this.list?.refresh();
  }

  private move(d: number) {
    if (!this.ready || this.leaving) return;
    this.list?.move(d);
  }

  private select(i: number, quiet = false) {
    this.list?.select(i, quiet);
  }

  private activate() {
    if (!this.ready || this.leaving) return;
    this.list?.activate();
  }

  // ------------------------------------------------------------------ frame

  /** Printer's marks: crop marks in each corner, a registration target and the ink bars, plus grain. */
  private buildFrame() {
    const g = this.add.graphics().setDepth(95).setAlpha(0);
    g.lineStyle(2, BONE_N, 0.55);
    const m = 34;
    const l = 46;
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]] as const) {
      g.lineBetween(x, y + sy * 14, x, y + sy * l);
      g.lineBetween(x + sx * 14, y, x + sx * l, y);
    }
    g.strokeCircle(W / 2, m + 6, 10);
    g.lineBetween(W / 2 - 18, m + 6, W / 2 + 18, m + 6);
    g.lineBetween(W / 2, m - 12, W / 2, m + 24);
    // Colour bars, as on a proof: the poster's inks.
    [INK_N, 0x3a0f22, RED, EMBER, BONE_N].forEach((c, i) => g.fillStyle(c, 1).fillRect(W - m - 30 - (4 - i) * 22, m + 14, 18, 18));
    this.tweens.add({ targets: g, alpha: 1, duration: 800, delay: 1800 });

    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W * 1.05, H * 1.05).setTint(0x000000).setDepth(99);
    this.grain = this.add.image(0, 0, 'grain').setOrigin(0).setDisplaySize(W + 60, H + 60).setAlpha(0.9).setDepth(100);
  }

  // ------------------------------------------------------------------ leaving

  /** Go: the beam flares, the truck floors it out of frame, and the screen cuts to black. */
  private start(trip: Trip | null) {
    if (this.leaving) return;
    this.leaving = true;
    if (!trip) clearTrip();
    const ready = trip ? prepareLeg(this.textures, trip.leg) : Promise.resolve();
    audio.unlock();
    play('click');
    play('honk');
    this.time.delayedCall(350, () => play('meow'));
    this.glitch(1.6);
    this.tweens.add({ targets: this.beam, alpha: 0.9, scaleX: 1.3, duration: 200 });
    this.tweens.add({ targets: this, speed: 5, duration: 1200, ease: 'Cubic.easeIn' });
    this.tweens.add({
      targets: this.truck,
      x: W + 900,
      duration: 1300,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () =>
          void ready.then(() => {
            // The title's large pieces are not needed in the game: let them go once the title has shut
            // down (they are painted again if it comes back). The small logo, the eye, the paper and
            // the tape stay.
            this.events.once('shutdown', () => {
              for (const k of ['t_rays', 't_hsun', 't_beam', 't_truck', 't_cat', 't_wheel', 't_wheel_front', 't_logo']) if (this.textures.exists(k)) this.textures.remove(k);
              logoMeta = null;
            });
            this.scene.start('play', trip ? { leg: trip.leg, trip } : { intro: true });
          }),
        );
      },
    });
  }

  // ------------------------------------------------------------------ every frame

  update(time: number, delta: number) {
    this.list?.setEnabled(this.ready && !this.leaving);
    const dt = delta / 1000;
    const p = this.input.activePointer;
    const tx = p.wasTouch ? 0 : Phaser.Math.Clamp((p.x - W / 2) / (W / 2), -1, 1);
    const ty = p.wasTouch ? 0 : Phaser.Math.Clamp((p.y - H / 2) / (H / 2), -1, 1);
    for (const l of this.layers) {
      l.obj.x = Phaser.Math.Linear(l.obj.x, l.x - tx * l.k, 0.05);
      l.obj.y = Phaser.Math.Linear(l.obj.y, l.y - ty * l.k * 0.5, 0.05);
    }

    // The truck runs on the spot: a rumble, a bump now and then, the cat a beat behind, wheels turning.
    const bump = Math.sin(time / 1300) > 0.97 ? -4 : 0;
    if (!this.leaving) this.truck.y = TRUCK_Y + Math.sin(time / 80) * 1.5 + bump;
    for (const w of this.wheels) w.rotation += delta * 0.012 * this.speed;
    this.cat.y = -161 + Math.sin(time / 80 - 1.2) * 2.2 + (Math.sin(time / 1300 - 0.15) > 0.97 ? -8 : 0);
    this.cat.rotation = Math.sin(time / 520) * 0.025;

    // Dust off the back wheel: little squares of the poster's inks, flung back and fading.
    this.dustClock += delta;
    if (this.dustClock > 45 && this.truck.x > 0) {
      this.dustClock = 0;
      const wx = this.truck.x + (TRUCK.wheels[0].x - 40) * TRUCK_K;
      const s = 4 + Math.random() * 8;
      const bit = this.add.rectangle(wx, ROAD - 6, s, s, [EMBER, 0x3a0f22, BONE_N][Math.floor(Math.random() * 3)]).setDepth(-41).setAngle(45);
      this.tweens.add({ targets: bit, x: wx - 160 - Math.random() * 260 * this.speed, y: ROAD - 20 - Math.random() * 90, alpha: 0, angle: 225, duration: 700 + Math.random() * 400, ease: 'Cubic.easeOut', onComplete: () => bit.destroy() });
    }

    // Ink speed lines low over the road, and the road's dashes.
    const v = 700 * this.speed;
    if (Math.random() < 0.3 * this.speed) this.streaks.push({ x: W + 300, y: ROAD - 30 - Math.random() * 260, len: 140 + Math.random() * 320, w: Math.random() < 0.3 ? 4 : 2 });
    this.streaks = this.streaks.filter((s) => (s.x -= v * 1.6 * dt) > -s.len);
    const g = this.fx.clear();
    // Speed lines stay right of the menu column, so they never run through its type.
    for (const s of this.streaks) {
      const x0 = Math.max(s.x, 780);
      if (s.x + s.len > x0) g.fillStyle(BONE_N, 0.22).fillRect(x0, s.y, s.x + s.len - x0, s.w);
    }
    g.fillStyle(BONE_N, 0.5);
    const dashOff = (time * 0.7 * this.speed) % 240;
    for (let x = -dashOff; x < W + 240; x += 240) g.fillRect(x, ROAD + 34, 120, 6);

    for (const e of this.embers) {
      e.t += dt;
      e.img.x += (e.vx + Math.sin(e.t * 1.3) * 20) * dt;
      e.img.y += e.vy * dt;
      e.img.setAlpha(0.3 + 0.5 * Math.abs(Math.sin(e.t * 2.2)));
      if (e.img.y < 300 || e.img.x < -20) e.img.setPosition(Math.random() * W * 1.1, H + 10);
    }

    // The gamepad's left stick moves the menu too.
    this.stickCool -= delta;
    const sy = this.input.gamepad?.pad1?.leftStick.y ?? 0;
    if (Math.abs(sy) > 0.6 && this.stickCool <= 0) {
      this.move(sy > 0 ? 1 : -1);
      this.stickCool = 260;
    } else if (Math.abs(sy) < 0.3) this.stickCool = 0;

    this.grain.setPosition(-Math.random() * 60, -Math.random() * 60);
  }
}
