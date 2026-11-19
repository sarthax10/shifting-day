import Phaser from 'phaser';
import { Drivetrain, REDLINE, gearName } from '../systems/drivetrain';

/**
 * The dashboard, printed in the title's inks like everything else on the interface: an ink plate with
 * an ember rule along its top and halftone dots fading in at one end, a dial with bone ticks and a red
 * zone, an ember needle, a fuel arc, the gear as a big Anton numeral on a bone key-cap with a row of
 * square shift lights over it, and the handbrake as a lamp and a lever in a slot. Same job as ever:
 * speed, distance, fuel, gear, revs and the handbrake at a glance, in the bottom-left corner.
 */
const DISPLAY = '"Anton", "Impact", sans-serif';
const MONO = '"Space Mono", monospace';
const INK = 0x0a0712;
const OX = 0x3a0f22;
const RED = 0xe3263a;
const EMBER = 0xff6a30;
const BONE = 0xf3e3cc;
const BONE_CSS = '#F3E3CC';
const INK_CSS = '#0A0712';
const EMBER_CSS = '#FF6A30';
const RED_CSS = '#E3263A';

/** The plate's size and where it sits: bottom-left, out of the truck's way. */
const PW = 570;
const PH = 250;
const CORNER = { x: 14, y: 1066 };
/** Where the dashboard's right edge is on screen, for things placed beside it. */
export const DASH_RIGHT = CORNER.x + PW;
/** Game speed (pixels a frame) to the number shown on the speedometer. */
export const KMH = 5.6;

/** The dial: its centre in the plate, radius, and sweep. */
const SPD = { x: 132, y: 134, r: 104 };
const MAX = 80;
const FROM = Math.PI * 0.75;
const SWEEP = Math.PI * 1.5;
const GEAR = { x: 336, y: 128 };
const HB = { x: 486, lamp: 64, top: 118, bottom: 222 };

export class Dash {
  private box!: Phaser.GameObjects.Container;
  private needle!: Phaser.GameObjects.Graphics;
  private odo!: Phaser.GameObjects.Text;
  private gearText!: Phaser.GameObjects.Text;
  private gearKey!: Phaser.GameObjects.Rectangle;
  private leds: Phaser.GameObjects.Rectangle[] = [];
  private cue!: Phaser.GameObjects.Text;
  private stall!: Phaser.GameObjects.Text;
  private lamp!: Phaser.GameObjects.Arc;
  private lampGlow!: Phaser.GameObjects.Image;
  private lampText!: Phaser.GameObjects.Text;
  private handle!: Phaser.GameObjects.Rectangle;
  private braked = true;
  private shown = '1';
  /** The needle eases towards the speed rather than jumping, as a real one does. */
  private shownSpeed = 0;

  constructor(
    private scene: Phaser.Scene,
    private drive: () => Drivetrain,
  ) {}

  private angle(v: number) {
    return FROM + (Math.min(MAX, Math.max(0, v)) / MAX) * SWEEP;
  }

  create() {
    const s = this.scene;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (parts.push(o), o);

    // ---- The plate.
    add(s.add.rectangle(6, 8, PW, PH, 0x000000, 0.35).setOrigin(0));
    add(s.add.rectangle(0, 0, PW, PH, INK, 0.94).setOrigin(0).setStrokeStyle(2, BONE, 0.25));
    add(s.add.rectangle(0, 0, PW, 5, EMBER).setOrigin(0));
    const dots = add(s.add.graphics());
    for (let y = 14; y < PH - 6; y += 12) {
      for (let x = PW - 150 + ((y / 12) % 2 ? 6 : 0); x < PW - 6; x += 12) {
        const k = (x - (PW - 150)) / 150;
        if (k * k * 4 > 0.4) dots.fillStyle(RED, 0.25 + k * 0.3).fillCircle(x, y, k * k * 4);
      }
    }
    const marks = add(s.add.graphics().lineStyle(2, BONE, 0.45));
    for (const [x, y, sx, sy] of [[8, 14, 1, 1], [PW - 8, 14, -1, 1], [8, PH - 8, 1, -1], [PW - 8, PH - 8, -1, -1]] as const) {
      marks.lineBetween(x, y, x, y + sy * 14);
      marks.lineBetween(x, y, x + sx * 14, y);
    }

    // ---- The speedometer.
    const dial = add(s.add.graphics());
    dial.fillStyle(OX, 1).fillCircle(SPD.x, SPD.y, SPD.r);
    dial.lineStyle(4, BONE, 0.9).strokeCircle(SPD.x, SPD.y, SPD.r);
    dial.lineStyle(10, RED, 1).beginPath().arc(SPD.x, SPD.y, SPD.r - 12, this.angle(60), this.angle(MAX)).strokePath();
    for (let v = 0; v <= MAX; v += 5) {
      const a = this.angle(v);
      const major = v % 10 === 0;
      const r0 = SPD.r - (major ? 22 : 14);
      dial.lineStyle(major ? 4 : 2, v >= 60 ? RED : BONE, major ? 1 : 0.7);
      dial.lineBetween(SPD.x + Math.cos(a) * r0, SPD.y + Math.sin(a) * r0, SPD.x + Math.cos(a) * (SPD.r - 6), SPD.y + Math.sin(a) * (SPD.r - 6));
      if (major) add(s.add.text(SPD.x + Math.cos(a) * (SPD.r - 40), SPD.y + Math.sin(a) * (SPD.r - 40), String(v), { fontFamily: DISPLAY, fontSize: '22px', color: v >= 60 ? RED_CSS : BONE_CSS }).setOrigin(0.5));
    }
    add(s.add.text(SPD.x, SPD.y + 26, 'KM/H', { fontFamily: MONO, fontStyle: 'bold', fontSize: '13px', color: BONE_CSS, letterSpacing: 3 }).setOrigin(0.5).setAlpha(0.7));
    // The odometer: digits on a bone strip.
    add(s.add.rectangle(SPD.x, SPD.y + 52, 82, 22, BONE).setStrokeStyle(2, INK));
    this.odo = add(s.add.text(SPD.x, SPD.y + 52, '00000', { fontFamily: MONO, fontStyle: 'bold', fontSize: '16px', color: INK_CSS, letterSpacing: 2 }).setOrigin(0.5));
    // Fuel: a small arc at the foot of the dial, E to F.
    dial.lineStyle(6, INK, 1).beginPath().arc(SPD.x, SPD.y, SPD.r + 16, Math.PI * 0.62, Math.PI * 0.38, true).strokePath();
    add(s.add.text(SPD.x - 52, SPD.y + SPD.r + 2, 'E', { fontFamily: DISPLAY, fontSize: '16px', color: RED_CSS }).setOrigin(0.5));
    add(s.add.text(SPD.x + 52, SPD.y + SPD.r + 2, 'F', { fontFamily: DISPLAY, fontSize: '16px', color: BONE_CSS }).setOrigin(0.5));
    this.needle = add(s.add.graphics());

    // ---- The gear: a big numeral on a bone key-cap, shift lights over it, a cue under it.
    add(s.add.rectangle(GEAR.x + 5, GEAR.y + 7, 112, 112, 0x8a7864).setStrokeStyle(4, INK));
    this.gearKey = add(s.add.rectangle(GEAR.x, GEAR.y, 112, 112, BONE).setStrokeStyle(4, INK));
    this.gearText = add(s.add.text(GEAR.x, GEAR.y - 2, '1', { fontFamily: DISPLAY, fontSize: '86px', color: INK_CSS }).setOrigin(0.5));
    for (let i = 0; i < 9; i++) this.leds.push(add(s.add.rectangle(GEAR.x - 56 + i * 14 + 1, GEAR.y - 82, 11, 14, OX).setOrigin(0, 0.5).setStrokeStyle(1.5, INK)));
    add(s.add.text(GEAR.x, GEAR.y + 76, 'GEAR', { fontFamily: MONO, fontStyle: 'bold', fontSize: '15px', color: BONE_CSS, letterSpacing: 5 }).setOrigin(0.5).setAlpha(0.75));
    add(s.add.text(GEAR.x, GEAR.y + 98, 'SHIFT UP · CTRL DOWN', { fontFamily: MONO, fontStyle: 'bold', fontSize: '11px', color: BONE_CSS, letterSpacing: 1 }).setOrigin(0.5).setAlpha(0.5));
    this.cue = add(s.add.text(GEAR.x, -22, '', { fontFamily: DISPLAY, fontSize: '28px', color: INK_CSS, letterSpacing: 2, backgroundColor: EMBER_CSS, padding: { x: 12, y: 2 } }).setOrigin(0.5));
    this.stall = add(s.add.text(GEAR.x, GEAR.y - 2, 'STALLED', { fontFamily: DISPLAY, fontSize: '26px', color: BONE_CSS, letterSpacing: 2, backgroundColor: RED_CSS, padding: { x: 8, y: 2 } }).setOrigin(0.5).setAngle(-8));

    // ---- The handbrake: a P lamp, and the lever in its slot (up is on).
    this.lampGlow = add(s.add.image(HB.x, HB.lamp, 'halo').setDisplaySize(150, 150).setTint(RED).setBlendMode(Phaser.BlendModes.ADD));
    this.lamp = add(s.add.circle(HB.x, HB.lamp, 30, RED).setStrokeStyle(4, BONE));
    this.lampText = add(s.add.text(HB.x, HB.lamp, 'P', { fontFamily: DISPLAY, fontSize: '34px', color: BONE_CSS }).setOrigin(0.5));
    add(s.add.rectangle(HB.x, (HB.top + HB.bottom) / 2, 16, HB.bottom - HB.top, 0x000000).setStrokeStyle(2, BONE, 0.4));
    this.handle = add(s.add.rectangle(HB.x, HB.top + 10, 46, 22, EMBER).setStrokeStyle(3, INK));
    add(s.add.text(HB.x + 38, (HB.top + HB.bottom) / 2, 'HANDBRAKE', { fontFamily: MONO, fontStyle: 'bold', fontSize: '11px', color: BONE_CSS, letterSpacing: 3 }).setOrigin(0.5).setRotation(-Math.PI / 2).setAlpha(0.55));

    this.box = s.add.container(CORNER.x, CORNER.y - PH, parts).setScrollFactor(0).setDepth(100);
    this.show(false);
  }

  show(on: boolean) {
    this.box?.setVisible(on);
    if (on) this.stall.setVisible(this.drive().stalled);
  }

  /** `km` is how far the truck has come, for the odometer; `fuel` is 0 to 1. */
  update(speed: number, km: number, fuel: number, handbrake = false) {
    const d = this.drive();
    const kmh = Math.abs(speed) * KMH;
    this.shownSpeed += (kmh - this.shownSpeed) * 0.18;

    // The needle: an ember blade with an ink edge, over a bone hub.
    const a = this.angle(this.shownSpeed);
    const along = (r: number, side: number, w: number) => new Phaser.Math.Vector2(SPD.x + Math.cos(a) * r + Math.cos(a + Math.PI / 2) * w * side, SPD.y + Math.sin(a) * r + Math.sin(a + Math.PI / 2) * w * side);
    const pts = [along(-22, -1, 7), along(SPD.r - 20, -1, 1.5), along(SPD.r - 14, 0, 0), along(SPD.r - 20, 1, 1.5), along(-22, 1, 7)];
    const g = this.needle.clear();
    g.fillStyle(EMBER).fillPoints(pts, true).lineStyle(3, INK).strokePoints(pts, true);
    g.fillStyle(BONE).fillCircle(SPD.x, SPD.y, 13).lineStyle(4, INK).strokeCircle(SPD.x, SPD.y, 13);
    g.fillStyle(INK).fillCircle(SPD.x, SPD.y, 4);
    // Fuel: the arc fills from E to F, ember while there is plenty, red when it is low.
    const f = Math.max(0, Math.min(1, fuel));
    if (f > 0.01) g.lineStyle(6, f < 0.25 ? RED : EMBER, 1).beginPath().arc(SPD.x, SPD.y, SPD.r + 16, Math.PI * 0.62, Math.PI * 0.62 - f * Math.PI * 0.24, true).strokePath();

    this.odo.setText(String(Math.floor(km * 10) % 100000).padStart(5, '0'));

    // The gear, shown as the gear you are going into while the clutch is in.
    const label = gearName(d.target);
    if (label !== this.shown) {
      this.shown = label;
      this.scene.tweens.add({ targets: this.gearText, scale: { from: 1.35, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    }
    const high = typeof d.gear === 'number' && d.gear < 4 && d.rpm > REDLINE - 400;
    this.gearText.setText(label).setColor(high ? RED_CSS : INK_CSS).setAlpha(d.shifting ? 0.5 : 1);
    this.gearKey.setFillStyle(high ? EMBER : BONE);
    this.stall.setVisible(d.stalled);

    // Shift lights: bone, then ember, then red, filling with the revs; all flashing at the limit.
    const k = Math.max(0, Math.min(1, d.rpm / REDLINE));
    const lit = Math.round(k * this.leds.length);
    const limit = k > 0.93 && Math.floor(this.scene.time.now / 120) % 2 === 0;
    this.leds.forEach((l, i) => {
      const on = d.stalled ? false : limit ? true : i < lit;
      const c = limit ? RED : i < 5 ? BONE : i < 7 ? EMBER : RED;
      l.setFillStyle(on ? c : OX);
    });
    const up = typeof d.gear === 'number' && d.gear < 4 && d.rpm > REDLINE - 400 && !d.stalled;
    const down = typeof d.gear === 'number' && d.gear > 1 && d.lugging > 0.3 && !d.stalled;
    this.cue.setText(up ? 'SHIFT UP' : down ? 'SHIFT DOWN' : '').setVisible(up || down);
    if (up || down) this.cue.setBackgroundColor(up ? EMBER_CSS : BONE_CSS);

    // The lamp glows while the handbrake is on, and flashes if you try to drive against it.
    const flash = handbrake && d.throttle > 0.5 ? (Math.floor(this.scene.time.now / 160) % 2 === 0 ? 1 : 0.35) : 1;
    this.lamp.setFillStyle(handbrake ? RED : OX, handbrake ? flash : 1);
    this.lampGlow.setVisible(handbrake).setAlpha(0.5 * flash);
    this.lampText.setAlpha(handbrake ? 1 : 0.4);
    if (handbrake !== this.braked) {
      this.braked = handbrake;
      this.scene.tweens.add({ targets: this.handle, y: handbrake ? HB.top + 10 : HB.bottom - 10, duration: 180, ease: 'Back.easeOut' });
    }
  }
}
