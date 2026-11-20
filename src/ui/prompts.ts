import Phaser from 'phaser';
import { isTouchDevice } from './touch';

/**
 * How the game teaches, now that there are no toast messages: a small prompt that stands in the world
 * next to whatever it is about - over the truck, at the toll gate's line, on the cliff top, over the
 * thing that just fell off - showing the input to press as a key-cap and a few words at most. It stays
 * until the player actually does the thing, then ticks itself off and goes. It never queues, never sits
 * on a timer, and never covers the middle of the screen; a newer prompt simply replaces an older one.
 *
 * The key-caps follow whatever the player last touched: keyboard and mouse, a gamepad, or a touchscreen.
 * The same table is what the Controls screen lays out, so the two can never disagree.
 */

export type Act = 'gas' | 'brake' | 'handbrake' | 'gearUp' | 'gearDown' | 'first' | 'reverse' | 'fire' | 'aim' | 'reel' | 'letGo' | 'drag' | 'turn' | 'rope' | 'pause';
export type Mode = 'keys' | 'pad' | 'touch';
export type Part = string | { key: Act };

export interface Control {
  act: Act;
  label: string;
  keys: string[];
  pad: string[];
  touch: string[];
}

/** Every control in the game, by section, in the order the Controls screen lists them. */
export const CONTROLS: { section: string; rows: Control[] }[] = [
  {
    section: 'PACKING',
    rows: [
      { act: 'drag', label: 'PICK UP AND LOAD', keys: ['DRAG'], pad: ['DRAG'], touch: ['DRAG'] },
      { act: 'turn', label: 'TURN WHAT YOU HOLD', keys: ['Q', 'E', 'SCROLL'], pad: ['Q', 'E'], touch: ['TURN'] },
      { act: 'rope', label: 'TIE IT DOWN', keys: ['R'], pad: ['R'], touch: ['ROPE'] },
    ],
  },
  {
    section: 'DRIVING',
    rows: [
      { act: 'gas', label: 'GAS', keys: ['D', 'RIGHT'], pad: ['RT'], touch: ['GAS'] },
      { act: 'brake', label: 'BRAKE', keys: ['A', 'LEFT'], pad: ['LT'], touch: ['BRAKE'] },
      { act: 'handbrake', label: 'HANDBRAKE', keys: ['P', 'SPACE'], pad: ['A'], touch: ['P BRAKE'] },
      { act: 'gearUp', label: 'GEAR UP', keys: ['SHIFT', 'E'], pad: ['RB'], touch: ['GEAR +'] },
      { act: 'gearDown', label: 'GEAR DOWN', keys: ['CTRL', 'Q'], pad: ['LB'], touch: ['GEAR −'] },
      { act: 'first', label: 'FIRST GEAR', keys: ['1'], pad: ['LB'], touch: ['GEAR −'] },
      { act: 'reverse', label: 'REVERSE', keys: ['R'], pad: ['LB'], touch: ['GEAR −'] },
    ],
  },
  {
    section: 'CROSSBOW',
    rows: [
      { act: 'aim', label: 'AIM', keys: ['MOUSE'], pad: ['R-STICK'], touch: ['DRAG'] },
      { act: 'fire', label: 'FIRE THE ANCHOR', keys: ['CLICK'], pad: ['X'], touch: ['LIFT'] },
      { act: 'reel', label: 'REEL IN', keys: ['W'], pad: ['B'], touch: ['REEL'] },
      { act: 'letGo', label: 'LET GO', keys: ['RIGHT-CLICK'], pad: ['—'], touch: ['—'] },
      { act: 'pause', label: 'PAUSE', keys: ['ESC'], pad: ['START'], touch: ['PAUSE'] },
    ],
  },
];

const BY_ACT = new Map(CONTROLS.flatMap((s) => s.rows).map((r) => [r.act, r]));

export function glyph(act: Act, mode: Mode): string {
  const c = BY_ACT.get(act);
  if (!c) return act.toUpperCase();
  return (mode === 'keys' ? c.keys : mode === 'pad' ? c.pad : c.touch)[0];
}

const DISPLAY = '"Anton", "Impact", sans-serif';
const MONO = '"Space Mono", monospace';
const INK = 0x0a0712;
const BONE = 0xf3e3cc;
const EMBER = 0xff6a30;

/** A key-cap: a bone key with a dark lip under it, its label in ink. */
export function keycap(scene: Phaser.Scene, x: number, y: number, label: string, size = 22) {
  const text = scene.add.text(0, -2, label, { fontFamily: MONO, fontStyle: 'bold', fontSize: `${size}px`, color: '#0A0712' }).setOrigin(0.5);
  const w = Math.max(size * 1.9, text.width + size * 0.9);
  const h = size * 1.9;
  const lip = scene.add.rectangle(0, 4, w, h, 0x8a7864).setStrokeStyle(3, INK);
  const face = scene.add.rectangle(0, 0, w, h, BONE).setStrokeStyle(3, INK);
  const c = scene.add.container(x, y, [lip, face, text]);
  c.setSize(w, h + 4);
  return c;
}

/** Things that already happened are taught; some prompts are only worth showing once a session. */
const taught = new Set<string>();

interface Current {
  id: string;
  parts: Part[];
  at: () => { x: number; y: number };
  until: () => boolean;
  onDone?: () => void;
  box: Phaser.GameObjects.Container;
  born: number;
}

export class Prompter {
  mode: Mode = 'keys';
  private cur?: Current;

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    kb?.on('keydown', () => this.setMode('keys'));
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.setMode(p.wasTouch ? 'touch' : 'keys'));
    scene.input.gamepad?.on('down', () => this.setMode('pad'));
    if (isTouchDevice()) this.mode = 'touch';
  }

  private setMode(m: Mode) {
    if (m === this.mode) return;
    this.mode = m;
    if (this.cur) {
      const c = this.cur;
      c.box.destroy(true);
      c.box = this.render(c.parts);
    }
  }

  /**
   * Shows a prompt at a point in the world until a condition holds. With `once`, it is skipped if this
   * id has already been taught this session.
   */
  show(id: string, parts: Part[], at: () => { x: number; y: number }, until: () => boolean, opts: { once?: boolean; onDone?: () => void } = {}) {
    if (opts.once && taught.has(id)) return opts.onDone?.();
    if (this.cur?.id === id) return;
    if (until()) return;
    this.dismiss(false);
    const box = this.render(parts);
    box.setScale(0.6).setAlpha(0);
    this.scene.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.cur = { id, parts, at, until, onDone: opts.onDone, box, born: this.scene.time.now };
    if (opts.once) taught.add(id);
    this.place();
  }

  /** Whether a prompt with this id is up. */
  showing(id: string) {
    return this.cur?.id === id;
  }

  /** Takes the current prompt down: ticked off if it was done, or just withdrawn. */
  dismiss(done: boolean, id?: string) {
    const c = this.cur;
    if (!c || (id && c.id !== id)) return;
    this.cur = undefined;
    if (done) {
      const tick = this.scene.add.text(c.box.x, c.box.y, '✓', { fontFamily: DISPLAY, fontSize: '54px', color: '#FF6A30', stroke: '#0A0712', strokeThickness: 8 }).setOrigin(0.5).setDepth(141);
      this.scene.tweens.add({ targets: tick, y: tick.y - 50, alpha: 0, scale: 1.4, duration: 600, ease: 'Cubic.easeOut', onComplete: () => tick.destroy() });
    }
    this.scene.tweens.add({ targets: c.box, scale: 0.7, alpha: 0, duration: 160, onComplete: () => c.box.destroy(true) });
    if (done) c.onDone?.();
  }

  update() {
    const c = this.cur;
    if (!c) return;
    if (c.until()) return this.dismiss(true);
    this.place();
  }

  private place() {
    const c = this.cur;
    if (!c) return;
    const p = c.at();
    c.box.setPosition(p.x, p.y + Math.sin(this.scene.time.now / 260) * 4);
  }

  /** The prompt itself: a dark chip with an ember edge, key-caps and short words, a pointer below it. */
  private render(parts: Part[]) {
    const s = this.scene;
    const pieces: { obj: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject; w: number }[] = [];
    for (const part of parts) {
      if (typeof part === 'string') {
        const t = s.add.text(0, 0, part, { fontFamily: DISPLAY, fontSize: '30px', color: '#F3E3CC', letterSpacing: 1 }).setOrigin(0, 0.5);
        pieces.push({ obj: t, w: t.width });
      } else {
        const k = keycap(s, 0, 0, glyph(part.key, this.mode));
        pieces.push({ obj: k, w: k.width });
      }
    }
    const gap = 14;
    const pad = 22;
    const inner = pieces.reduce((n, p) => n + p.w, 0) + gap * (pieces.length - 1);
    const w = inner + pad * 2 + 8;
    const h = 66;
    const chip = s.add.rectangle(0, 0, w, h, INK, 0.9).setStrokeStyle(2, BONE, 0.3);
    const edge = s.add.rectangle(-w / 2 + 3, 0, 6, h, EMBER);
    const tip = s.add.triangle(0, h / 2 + 9, -12, 0, 12, 0, 0, 14, INK, 0.9);
    const box = s.add.container(0, 0, [chip, edge, tip]).setDepth(140);
    let x = -w / 2 + pad + 8;
    for (const p of pieces) {
      if (p.obj instanceof Phaser.GameObjects.Text) p.obj.setPosition(x, 0);
      else p.obj.setPosition(x + p.w / 2, 0);
      box.add(p.obj);
      x += p.w + gap;
    }
    return box;
  }

  destroy() {
    this.cur?.box.destroy(true);
    this.cur = undefined;
  }
}
