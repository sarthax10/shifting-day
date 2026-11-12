import Phaser from 'phaser';
import { DASH, SPEEDO as DIAL } from './art';
import { Drivetrain, REDLINE, gearName } from './drivetrain';
import { C } from './ink';

const TEXT = '"Karla", sans-serif';
const TITLE = '"Fraunces", serif';
const hex = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;

/** Where the dashboard sits on screen, and where its two gauges sit inside it. */
const X0 = 20;
const Y0 = 758;
const SPD = { x: X0 + DASH.speedo.x, y: Y0 + DASH.speedo.y };
const GEAR = { x: X0 + DASH.gear.x, y: Y0 + DASH.gear.y };
/** The handbrake: its warning lamp, and the slot its handle slides in. */
const LAMP = { x: X0 + DASH.lamp.x, y: Y0 + DASH.lamp.y };
const SLOT = { x: X0 + DASH.slot.x, on: Y0 + DASH.slot.top - 4, off: Y0 + DASH.slot.bottom - 50 };
/**
 * The dashboard is laid out at full size, then shrunk into the bottom-left corner as one piece,
 * so it stays out of the way of the truck.
 */
export const DASH_SCALE = 0.68;
const CORNER = { x: 14, y: 1068 };
/** Where the dashboard's right edge ends up on screen, for things placed beside it. */
export const DASH_RIGHT = CORNER.x + (DASH.w - 8) * DASH_SCALE;
/** Game speed (pixels a frame) to the number shown on the speedometer. */
export const KMH = 5.6;

/**
 * The dashboard: a vintage speedometer (needle, odometer, fuel) and a matching small gauge with the gear in it.
 * The gear number turns red when the engine is near the redline, as a nudge to change up.
 */
export class Dash {
  private all: Phaser.GameObjects.GameObject[] = [];
  private box!: Phaser.GameObjects.Container;
  private needle!: Phaser.GameObjects.Graphics;
  private odo: Phaser.GameObjects.Text[] = [];
  private gearText!: Phaser.GameObjects.Text;
  private lamp!: Phaser.GameObjects.Arc;
  private lampGlow!: Phaser.GameObjects.Image;
  private lampText!: Phaser.GameObjects.Text;
  private stallText!: Phaser.GameObjects.Text;
  private handle!: Phaser.GameObjects.Image;
  private braked = true;
  private shown = '1';
  /** The needle eases towards the speed rather than jumping, as a real one does. */
  private shownSpeed = 0;

  constructor(
    private scene: Phaser.Scene,
    private drive: () => Drivetrain,
  ) {}

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
    (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(100);
    this.all.push(o);
    return o;
  }

  private angle(v: number) {
    return DIAL.from + (Math.min(DIAL.max, Math.max(0, v)) / DIAL.max) * DIAL.sweep;
  }

  create() {
    const s = this.scene;
    this.keep(s.add.image(X0, Y0, 'dash').setOrigin(0));
    this.keep(s.add.image(SPD.x, SPD.y, 'speedo'));

    // Numbers round the dial; the red zone's in red.
    for (let v = 0; v <= DIAL.max; v += 10) {
      const a = this.angle(v);
      const r = DIAL.r - 48;
      this.keep(s.add.text(SPD.x + Math.cos(a) * r, SPD.y + Math.sin(a) * r, String(v), { fontFamily: TITLE, fontSize: '22px', color: v >= 60 ? C.terracottaDark : C.ink }).setOrigin(0.5));
    }
    this.keep(s.add.text(SPD.x, SPD.y + 22, 'km/h', { fontFamily: TEXT, fontSize: '16px', color: C.walnut }).setOrigin(0.5));
    // Fuel letters at each end of the little fuel scale.
    for (const [k, letter] of [[0, 'E'], [10, 'F']] as const) {
      const a = Math.PI * 0.62 - (k / 10) * Math.PI * 0.24;
      this.keep(s.add.text(SPD.x + Math.cos(a) * (DIAL.r - 30), SPD.y + Math.sin(a) * (DIAL.r - 30), letter, { fontFamily: TITLE, fontSize: '15px', color: C.walnut }).setOrigin(0.5));
    }
    // The odometer's five drums: whole kilometres, and tenths in red at the end.
    for (let i = 0; i < 5; i++) {
      this.odo.push(this.keep(s.add.text(SPD.x - 33 + 6.6 + i * 13.2, SPD.y + 41, '0', { fontFamily: TEXT, fontSize: '18px', color: i === 4 ? '#F2B9A4' : C.cream }).setOrigin(0.5)));
    }
    this.needle = this.keep(s.add.graphics());
    this.keep(s.add.image(SPD.x, SPD.y, 'speedo_glass'));

    // The gear gauge.
    this.keep(s.add.image(GEAR.x, GEAR.y, 'gear_badge'));
    this.gearText = this.keep(s.add.text(GEAR.x, GEAR.y + 2, '1', { fontFamily: TITLE, fontSize: '70px', color: C.ink }).setOrigin(0.5));
    this.keep(s.add.text(GEAR.x, GEAR.y + 84, 'GEAR', { fontFamily: TITLE, fontSize: '20px', color: C.cream }).setOrigin(0.5));
    this.keep(s.add.text(GEAR.x, GEAR.y + 106, 'SHIFT ▲   CTRL ▼', { fontFamily: TEXT, fontSize: '17px', color: '#CDEFF0' }).setOrigin(0.5));
    this.stallText = this.keep(s.add.text(GEAR.x, GEAR.y - 62, 'STALLED', { fontFamily: TITLE, fontSize: '20px', color: C.cream, backgroundColor: C.terracottaDark, padding: { x: 8, y: 2 } }).setOrigin(0.5));

    // The handbrake lamp: a round red warning light with a (P) on it, lit while the handbrake is on.
    // The lamp sits in the dashboard's chrome ring; the handle slides up its slot when pulled on.
    this.lampGlow = this.keep(s.add.image(LAMP.x, LAMP.y, 'halo').setDisplaySize(190, 190).setTint(0xff5a3c));
    this.lamp = this.keep(s.add.circle(LAMP.x, LAMP.y, 31, hex(C.terracotta)));
    this.keep(s.add.ellipse(LAMP.x - 10, LAMP.y - 12, 22, 12, 0xffffff, 0.35));
    this.lampText = this.keep(s.add.text(LAMP.x, LAMP.y + 1, '(P)', { fontFamily: TITLE, fontSize: '28px', color: C.cream }).setOrigin(0.5));
    this.handle = this.keep(s.add.image(SLOT.x, SLOT.on, 'hb_handle').setOrigin(0.5, 0.2));
    this.keep(s.add.text(SLOT.x - 46, Y0 + (DASH.slot.top + DASH.slot.bottom) / 2, 'HANDBRAKE · P', { fontFamily: TITLE, fontSize: '16px', color: C.cream }).setOrigin(0.5).setRotation(-Math.PI / 2));
    // Everything goes into one container, scaled about the panel's bottom-left corner.
    const bottom = Y0 + DASH.h - 12;
    this.box = s.add.container(CORNER.x - X0 * DASH_SCALE, CORNER.y - bottom * DASH_SCALE, this.all).setScale(DASH_SCALE).setScrollFactor(0).setDepth(100);
    this.show(false);
  }

  show(on: boolean) {
    for (const o of this.all) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(on);
    if (on && this.stallText) this.stallText.setVisible(this.drive().stalled);
  }

  /** `km` is how far the truck has come, for the odometer; `fuel` is 0 to 1. */
  update(speed: number, km: number, fuel: number, handbrake = false) {
    const d = this.drive();
    const kmh = Math.abs(speed) * KMH;
    this.shownSpeed += (kmh - this.shownSpeed) * 0.18;

    // The needle: a tapered pointer with a counterweight, its shadow on the face, and a chrome cap.
    const a = this.angle(this.shownSpeed);
    const pointer = (cx: number, cy: number) => {
      const along = (r: number, side: number, w: number) => new Phaser.Math.Vector2(cx + Math.cos(a) * r + Math.cos(a + Math.PI / 2) * w * side, cy + Math.sin(a) * r + Math.sin(a + Math.PI / 2) * w * side);
      return [along(-24, -1, 6), along(DIAL.r - 22, -1, 1.2), along(DIAL.r - 18, 0, 0), along(DIAL.r - 22, 1, 1.2), along(-24, 1, 6)];
    };
    const g = this.needle.clear();
    g.fillStyle(hex(C.ink), 0.22).fillPoints(pointer(SPD.x + 4, SPD.y + 5), true);
    const pts = pointer(SPD.x, SPD.y);
    g.fillStyle(hex(C.terracotta)).fillPoints(pts, true).lineStyle(3.5, hex(C.ink)).strokePoints(pts, true);
    g.fillStyle(hex('#E6E8DF')).fillCircle(SPD.x, SPD.y, 14).lineStyle(4, hex(C.ink)).strokeCircle(SPD.x, SPD.y, 14);
    g.fillStyle(hex(C.ink)).fillCircle(SPD.x, SPD.y, 4);

    // Fuel: a red marker on the little scale, from F down towards E as the trip goes on.
    const fa = Math.PI * 0.62 - Math.max(0, Math.min(1, fuel)) * Math.PI * 0.24;
    g.fillStyle(hex(C.terracotta)).fillCircle(SPD.x + Math.cos(fa) * (DIAL.r - 10), SPD.y + Math.sin(fa) * (DIAL.r - 10), 6).lineStyle(2.5, hex(C.ink)).strokeCircle(SPD.x + Math.cos(fa) * (DIAL.r - 10), SPD.y + Math.sin(fa) * (DIAL.r - 10), 6);

    // Odometer.
    const digits = String(Math.floor(km * 10) % 100000).padStart(5, '0');
    this.odo.forEach((t, i) => t.setText(digits[i]));

    // The gear: shown as the gear you are going into while the clutch is in.
    const label = gearName(d.target);
    if (label !== this.shown) {
      this.shown = label;
      this.scene.tweens.add({ targets: this.gearText, scale: { from: 1.3, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    }
    const high = typeof d.gear === 'number' && d.gear < 4 && d.rpm > REDLINE - 400;
    this.gearText.setText(label).setColor(high ? C.terracotta : d.shifting ? C.walnut : C.ink);
    this.stallText.setVisible(d.stalled);

    // The lamp glows while the handbrake is on, and flashes if you try to drive against it.
    const flash = handbrake && d.throttle > 0.5 ? (Math.floor(this.scene.time.now / 160) % 2 === 0 ? 1 : 0.35) : 1;
    this.lamp.setFillStyle(hex(handbrake ? C.terracotta : '#7A5E66'), handbrake ? flash : 1);
    this.lampGlow.setVisible(handbrake).setAlpha(0.55 * flash);
    this.lampText.setColor(handbrake ? C.cream : '#B9A9AE');
    if (handbrake !== this.braked) {
      this.braked = handbrake;
      this.scene.tweens.add({ targets: this.handle, y: handbrake ? SLOT.on : SLOT.off, duration: 180, ease: 'Back.easeOut' });
    }
  }
}
