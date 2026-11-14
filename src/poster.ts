import Phaser from 'phaser';
import { CURSOR } from './cursors';
import { H, W } from './terrain';
import { play } from './audio';
import { paperBackdrop, tape } from './logo';
import { CONTROLS, keycap, type Mode } from './prompts';

/**
 * The title screen's look, as a kit for every other screen that is a menu rather than the world:
 * the pause menu, the Controls sheet and the Lost & Found. Same black poster sheet, same crop marks,
 * same type (Anton for anything you read as a word, Space Mono for small labels and numbers), and the
 * same menu - a numbered list where the chosen item is printed in ink on a strip of torn ember tape.
 *
 * Nothing here animates with tweens, because the pause menu has to work while the game's tweens are
 * paused; things snap into place instead, which suits the printed look anyway.
 */
export const DISPLAY = '"Anton", "Impact", sans-serif';
export const MONO = '"Space Mono", monospace';
export const INK = 0x0a0712;
export const INK_CSS = '#0A0712';
export const BONE = 0xf3e3cc;
export const BONE_CSS = '#F3E3CC';
export const EMBER = 0xff6a30;
export const EMBER_CSS = '#FF6A30';
export const RED = 0xe3263a;

/** The textures the kit borrows from the title, made here if the title has not made them yet. */
export function ensurePosterTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists('t_tape')) scene.textures.addCanvas('t_tape', tape(640, 84, '#FF6A30', 11));
  if (!scene.textures.exists('t_paper')) scene.textures.addCanvas('t_paper', paperBackdrop(W / 2, H / 2));
}

/** Printer's crop marks in the four corners. */
export function cropMarks(scene: Phaser.Scene, alpha = 0.55) {
  const g = scene.add.graphics();
  g.lineStyle(2, BONE, alpha);
  const m = 34;
  const l = 46;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]] as const) {
    g.lineBetween(x, y + sy * 14, x, y + sy * l);
    g.lineBetween(x + sx * 14, y, x + sx * l, y);
  }
  return g;
}

/**
 * A full-screen poster sheet over whatever is behind it: the dark printed paper, crop marks, and a
 * heading with an ember rule under it. Clicks stop on it. Returns the container to add to.
 */
export function posterSheet(scene: Phaser.Scene, heading: string, depth: number, opts: { alpha?: number; kicker?: string } = {}) {
  ensurePosterTextures(scene);
  const c = scene.add.container(0, 0).setScrollFactor(0).setDepth(depth);
  const block = scene.add.rectangle(0, 0, W, H, INK, 0.6).setOrigin(0).setInteractive();
  block.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => e.stopPropagation());
  const paper = scene.add.image(0, 0, 't_paper').setOrigin(0).setDisplaySize(W, H).setAlpha(opts.alpha ?? 0.94);
  c.add([block, paper, cropMarks(scene)]);
  const head = scene.add.text(W / 2, 150, heading, { fontFamily: DISPLAY, fontSize: '112px', color: BONE_CSS, letterSpacing: 3, stroke: INK_CSS, strokeThickness: 10 }).setOrigin(0.5);
  head.setShadow(8, 10, '#E3263A', 0, true, false);
  const rule = scene.add.rectangle(W / 2, 228, Math.min(head.width, 520), 5, EMBER);
  c.add([head, rule]);
  if (opts.kicker) c.add(scene.add.text(W / 2, 262, opts.kicker, { fontFamily: MONO, fontStyle: 'bold', fontSize: '24px', color: BONE_CSS, letterSpacing: 6 }).setOrigin(0.5).setAlpha(0.75));
  return c;
}

export interface ListItem {
  label: () => string;
  act: () => void;
}

/**
 * The title's menu as a reusable list: numbered items in Anton, the chosen one printed in ink on torn
 * ember tape. Mouse, arrows / W S, Enter, and a gamepad's d-pad and A all drive it. Destroy it to
 * unhook its keys.
 */
export class PosterList {
  readonly container: Phaser.GameObjects.Container;
  private texts: Phaser.GameObjects.Text[] = [];
  private nums: Phaser.GameObjects.Text[] = [];
  private tapeImg: Phaser.GameObjects.Image;
  private sel = 0;
  private enabled = true;
  private off: (() => void)[] = [];

  constructor(
    private scene: Phaser.Scene,
    private x: number,
    y: number,
    private items: ListItem[],
    opts: { step?: number; size?: number; depth?: number } = {},
  ) {
    ensurePosterTextures(scene);
    const step = opts.step ?? 82;
    const size = opts.size ?? 58;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(opts.depth ?? 0);
    this.tapeImg = scene.add.image(x - 10, y, 't_tape').setOrigin(0, 0.5).setAngle(-1.5);
    this.container.add(this.tapeImg);
    items.forEach((it, i) => {
      const iy = y + i * step;
      const num = scene.add.text(x - 56, iy, `0${i + 1}`, { fontFamily: MONO, fontStyle: 'bold', fontSize: '22px', color: EMBER_CSS }).setOrigin(0, 0.5);
      const text = scene.add.text(x + 16, iy, it.label(), { fontFamily: DISPLAY, fontSize: `${size}px`, color: BONE_CSS, letterSpacing: 2 }).setOrigin(0, 0.5);
      const hit = scene.add.rectangle(x - 70, iy, 760, step, 0xffffff, 0.001).setOrigin(0, 0.5).setInteractive({ cursor: CURSOR.open });
      hit.on('pointerover', () => this.select(i));
      hit.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.select(i, true);
        this.activate();
      });
      this.texts.push(text);
      this.nums.push(num);
      this.container.add([hit, num, text]);
    });
    const kb = scene.input.keyboard;
    const on = (ev: string, fn: () => void) => {
      kb?.on(ev, fn);
      this.off.push(() => kb?.off(ev, fn));
    };
    on('keydown-UP', () => this.move(-1));
    on('keydown-W', () => this.move(-1));
    on('keydown-DOWN', () => this.move(1));
    on('keydown-S', () => this.move(1));
    on('keydown-ENTER', () => this.activate());
    const pad = (_p: Phaser.Input.Gamepad.Gamepad, b: Phaser.Input.Gamepad.Button) => {
      if (b.index === 12) this.move(-1);
      else if (b.index === 13) this.move(1);
      else if (b.index === 0) this.activate();
    };
    scene.input.gamepad?.on('down', pad);
    this.off.push(() => scene.input.gamepad?.off('down', pad));
    this.select(0, true);
  }

  setEnabled(v: boolean) {
    this.enabled = v;
  }

  refresh() {
    this.items.forEach((it, i) => this.texts[i].setText(it.label()));
    this.select(this.sel, true);
  }

  private move(d: number) {
    if (!this.enabled) return;
    this.select((this.sel + d + this.items.length) % this.items.length);
  }

  select(i: number, quiet = false) {
    if (!this.enabled && !quiet) return;
    if (i === this.sel && !quiet) return;
    if (!quiet) play('click', 0.3, 1.5);
    this.sel = i;
    this.texts.forEach((t, k) => {
      const on = k === i;
      t.setColor(on ? INK_CSS : BONE_CSS).setAlpha(on ? 1 : 0.5).setX(this.x + (on ? 32 : 16));
      this.nums[k].setAlpha(on ? 1 : 0.4);
    });
    const t = this.texts[i];
    this.tapeImg.setY(t.y + 2).setScale((t.width + 56) / 640, 1);
  }

  activate() {
    if (!this.enabled) return;
    this.items[this.sel].act();
  }

  destroy() {
    for (const f of this.off) f();
    this.off = [];
    this.container.destroy(true);
  }
}

/**
 * The Controls sheet: every control in three columns - packing, driving, the crossbow - with its
 * key-caps for whichever input you choose along the top: keyboard and mouse, gamepad, or touch.
 * Escape, the Back item, or the gamepad's B closes it. Returns a function that closes it.
 */
export function openControls(scene: Phaser.Scene, depth: number, onClose: () => void, start: Mode = 'keys'): () => void {
  const sheet = posterSheet(scene, 'CONTROLS', depth);
  let mode: Mode = start;
  const body = scene.add.container(0, 0);
  sheet.add(body);
  const modes: [Mode, string][] = [['keys', 'KEYBOARD + MOUSE'], ['pad', 'GAMEPAD'], ['touch', 'TOUCH']];
  const tabs = modes.map(([m, label], i) => {
    const x = W / 2 + (i - 1) * 380;
    const t = scene.add.text(x, 300, label, { fontFamily: MONO, fontStyle: 'bold', fontSize: '24px', color: BONE_CSS, letterSpacing: 5, padding: { x: 18, y: 8 } }).setOrigin(0.5).setInteractive({ cursor: CURSOR.open });
    t.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      mode = m;
      draw();
    });
    sheet.add(t);
    return { t, m };
  });
  const draw = () => {
    body.removeAll(true);
    for (const { t, m } of tabs) {
      const on = m === mode;
      t.setColor(on ? INK_CSS : BONE_CSS).setBackgroundColor(on ? EMBER_CSS : 'rgba(0,0,0,0)').setAlpha(on ? 1 : 0.6);
    }
    CONTROLS.forEach((sec, ci) => {
      const x0 = 150 + ci * 560;
      body.add(scene.add.text(x0, 386, sec.section, { fontFamily: DISPLAY, fontSize: '46px', color: EMBER_CSS, letterSpacing: 3 }).setOrigin(0, 0.5));
      body.add(scene.add.rectangle(x0, 420, 480, 3, BONE, 0.35).setOrigin(0, 0.5));
      sec.rows.forEach((r, ri) => {
        const y = 462 + ri * 64;
        body.add(scene.add.text(x0, y, r.label, { fontFamily: DISPLAY, fontSize: '30px', color: BONE_CSS, letterSpacing: 1 }).setOrigin(0, 0.5));
        const caps = mode === 'keys' ? r.keys : mode === 'pad' ? r.pad : r.touch;
        let x = x0 + 480;
        for (const cap of [...caps].reverse()) {
          const k = keycap(scene, 0, y, cap, 18);
          x -= k.width / 2;
          k.setX(x);
          x -= k.width / 2 + 10;
          body.add(k);
        }
      });
    });
  };
  draw();
  let closed = false;
  const list = new PosterList(scene, W / 2 - 90, H - 120, [{ label: () => 'BACK', act: () => close() }], { size: 54, depth: 0 });
  sheet.add(list.container);
  const kb = scene.input.keyboard;
  const left = () => {
    mode = modes[(modes.findIndex(([m]) => m === mode) + 2) % 3][0];
    draw();
  };
  const right = () => {
    mode = modes[(modes.findIndex(([m]) => m === mode) + 1) % 3][0];
    draw();
  };
  const back = (_p: Phaser.Input.Gamepad.Gamepad, b: Phaser.Input.Gamepad.Button) => {
    if (b.index === 1) close();
    else if (b.index === 14) left();
    else if (b.index === 15) right();
  };
  kb?.on('keydown-LEFT', left);
  kb?.on('keydown-RIGHT', right);
  scene.input.gamepad?.on('down', back);
  function close() {
    if (closed) return;
    closed = true;
    play('click');
    kb?.off('keydown-LEFT', left);
    kb?.off('keydown-RIGHT', right);
    scene.input.gamepad?.off('down', back);
    list.destroy();
    sheet.destroy(true);
    onClose();
  }
  return close;
}
