import Phaser from 'phaser';
import type { Leg } from './legs';
import { REDLINE, type Drivetrain } from './drivetrain';
import { TUNNEL } from './tunnel';
import { play } from './audio';

/**
 * The things that make each leg a little adventure, kept simple:
 *
 * - Fuel. The tank drains with the throttle, faster at high revs, so smooth gear changes pay. Red cans by
 *   the road top it up, and every stop fills it. Running dry is not the end: the engine coughs along at a
 *   third of its power until the next can (the way Hill Climb Racing makes fuel the run's quiet clock, but
 *   gentler).
 * - Bubble wrap. Somebody else is moving today too, somewhere up the road, and rolls of bubble wrap keep
 *   blowing off their van. They lie where the road is tricky: past a crest, at the bottom of a dip, beyond a
 *   run of bumps. Drive over one and it pops. The stops use it to pack lost things back up for you and to
 *   wrap broken ones.
 */

export interface ExtrasHost {
  scene: Phaser.Scene;
  leg: Leg;
  groundY(x: number): number;
  chassis(): MatterJS.BodyType;
  /** The front bumper, where the winch is, in the world. */
  nose(): { x: number; y: number };
  say(text: string): void;
  float(x: number, y: number, text: string, colour: string): void;
  phase(): string;
}

interface Pickup {
  img: Phaser.GameObjects.Image;
  kind: 'wrap' | 'fuel';
  x: number;
  y: number;
  taken: boolean;
}

export class Extras {
  fuel = 1;
  coins = 0;
  private pickups: Pickup[] = [];
  private dryNagged = false;
  private lowNagged = false;

  constructor(private host: ExtrasHost) {}

  build(coins: number) {
    const { scene, leg, groundY } = this.host;
    this.coins = coins;
    const clear = (x: number) =>
      x > 1800 &&
      x < leg.finish - 600 &&
      !(leg.n > 1 && x > TUNNEL.from - 500 && x < TUNNEL.to + 500) &&
      leg.gates.every((g) => Math.abs(g - x) > 500);
    // Bubble wrap, where it would have blown off a van: just past each hill's crest, at the bottom of each dip,
    // and beyond each run of bumps. One roll a place, lying on the road.
    let lastBump = -Infinity;
    for (const [fx, h, w] of leg.features) {
      let x = fx;
      if (h >= 60) x = fx + w * 0.8;
      else if (h > 0) {
        if (fx - lastBump < 600) {
          lastBump = fx;
          continue;
        }
        lastBump = fx;
        x = fx + 260;
      }
      if (clear(x)) this.add('wrap', x, groundY(x) - 34);
    }
    // Fuel cans, every so often, set down by the road.
    for (let x = 4200; x < leg.finish - 1500; x += 3600) {
      let cx = x;
      for (let tries = 0; tries < 8 && !clear(cx); tries++) cx += 400;
      if (clear(cx)) this.add('fuel', cx, groundY(cx) - 36);
    }
  }

  private add(kind: 'wrap' | 'fuel', x: number, y: number) {
    const img = this.host.scene.add.image(x, y, kind === 'wrap' ? 'bubble_wrap' : 'fuel_can').setDepth(9).setScale(kind === 'wrap' ? 0.8 : 0.8);
    this.pickups.push({ img, kind, x, y, taken: false });
  }

  /** One frame. Returns the engine power fraction (low when the tank is dry). */
  update(dt: number, drive: Drivetrain, driving: boolean): number {
    const { scene } = this.host;
    const c = this.host.chassis();
    // Fuel: drains with the throttle and the revs; a little at idle.
    if (driving && !drive.stalled) {
      const burn = 0.003 + 0.03 * drive.throttle * (0.45 + drive.rpm / REDLINE);
      this.fuel = Math.max(0, this.fuel - burn * dt);
    }
    if (driving && this.fuel < 0.2 && this.fuel > 0 && !this.lowNagged) {
      this.lowNagged = true;
      this.host.say('Fuel is low. Look out for a red can, and go easy on the revs.');
    }
    if (driving && this.fuel <= 0 && !this.dryNagged) {
      this.dryNagged = true;
      this.host.say('Out of fuel! The engine is coughing along. Find a can.');
    }
    // Pickups, collected by driving through them.
    const t = scene.time.now;
    for (const p of this.pickups) {
      if (p.taken) continue;
      // The roll rocks in the wind; the can sits still.
      if (p.kind === 'wrap') p.img.setRotation(Math.sin(t / 500 + p.x) * 0.12);
      if (!driving) continue;
      if (Math.abs(p.x - c.position.x) < 230 && Math.abs(p.y - (c.position.y - 60)) < 230) {
        p.taken = true;
        if (p.kind === 'wrap') {
          this.coins++;
          // Pop! A little burst of bubbles.
          play('pop', 0.9, 1.1 + Math.random() * 0.3);
          this.host.scene.time.delayedCall(70, () => play('pop', 0.6, 1.5));
          for (let b = 0; b < 8; b++) {
            const bub = scene.add.circle(p.x, p.y, 5 + Math.random() * 6).setStrokeStyle(2, 0xcfefff).setDepth(30);
            scene.tweens.add({ targets: bub, x: p.x + (Math.random() - 0.5) * 160, y: p.y - 40 - Math.random() * 120, scale: 0.3, alpha: 0, duration: 520, onComplete: () => bub.destroy() });
          }
          this.host.float(p.x, p.y - 60, this.coins === 1 ? 'Bubble wrap!' : 'Pop!', '#CFEFFF');
          if (this.coins === 1) this.host.say('Bubble wrap! Another mover up ahead keeps losing it. The stops will use it to pack your lost things back up.');
        } else {
          this.fuel = Math.min(1, this.fuel + 0.4);
          this.dryNagged = false;
          this.lowNagged = false;
          play('clunk');
          this.host.float(p.x, p.y - 40, 'Fuel +40%', '#FFB23F');
        }
        scene.tweens.add({ targets: p.img, y: p.img.y - 80, alpha: 0, scale: 1.1, duration: 360, onComplete: () => p.img.destroy() });
      }
    }
    return this.fuel > 0 ? 1 : 0.38;
  }

  stop() {}
}
