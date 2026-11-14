import Phaser from 'phaser';
import { CROSSBOW } from './art';
import { play } from './audio';

/**
 * The anchor crossbow, after the winch climbs of RV There Yet: aim with the mouse, click to fire. The bolt is
 * a real body that flies under gravity and bites into whatever ground it hits. Its cable runs back to the
 * drum in the truck's bed. The cable is a rope, not a rod: slack, it does nothing; taut, it holds the truck
 * and pulls it. Hold W and the drum reels the cable in, hauling the truck up to the anchor. Right-click lets
 * go. Some cliffs on the road cannot be driven up at all; this is how you climb them.
 */

export interface CrossbowHost {
  scene: Phaser.Scene;
  /** The truck's body and its wheels, which the cable pulls together. */
  bodies(): MatterJS.BodyType[];
  /** The turret, where the bow turns, in the world, and the truck's angle. */
  mount(): { x: number; y: number };
  /**
   * Where the cable pulls the truck from: low at the front, through a fairlead in the bull bar, the way a
   * winch pulls a truck up a slope (pulling from up on the roll bar would only drag it into the wall).
   */
  pullFrom(): { x: number; y: number };
  truckAngle(): number;
  phase(): string;
  say(text: string): void;
  reeling(): boolean;
  /** The height of the road's surface at x. */
  ground(x: number): number;
  /** The road's height, for the cliffs ahead. */
  cliffs: number[];
}

/** Speed of a fired bolt, pixels a frame. */
const SPEED = 30;
/** How long the cable is. */
const CABLE = 1500;
/** How fast the drum reels in, pixels a second, and the shortest the cable gets. */
const REEL = 260;
const SHORTEST = 140;
/** Gravity on the bolt, pixels a frame per frame (matches the physics world's). */
const G = 0.001 * 16.67 * 16.67;
/** The cable's colour at rest, and glowing hot white at full strain. */
const COLOR_SLACK = new Phaser.Display.Color(216, 216, 228);
const COLOR_TAUT = new Phaser.Display.Color(255, 142, 58);

export class Crossbow {
  private bow!: Phaser.GameObjects.Image;
  private boltImg!: Phaser.GameObjects.Image;
  private g!: Phaser.GameObjects.Graphics;
  private aim = -0.6;
  private state: 'ready' | 'flying' | 'stuck' | 'reload' = 'ready';
  private bolt?: MatterJS.BodyType;
  private anchor?: { x: number; y: number };
  private length = 0;
  private reloadLeft = 0;
  private taught = false;
  private reloadLabel!: Phaser.GameObjects.Text;
  /** How hard the cable is straining right now, smoothed, 0 to 1: drives the cable's glow and colour. */
  private tension = 0;

  constructor(private host: CrossbowHost) {}

  build() {
    const { scene } = this.host;
    this.g = scene.add.graphics().setDepth(11.7);
    this.bow = scene.add.image(0, 0, 'crossbow').setOrigin(CROSSBOW.pivot.x / CROSSBOW.w, CROSSBOW.pivot.y / CROSSBOW.h).setDepth(11.6);
    this.boltImg = scene.add.image(0, 0, 'anchor_bolt').setOrigin(0.92, 0.5).setDepth(11.65).setVisible(false);
    this.reloadLabel = scene.add.text(0, 0, 'RELOADING…', { fontFamily: '"Karla", sans-serif', fontSize: '18px', color: '#FFF2DA', stroke: '#2A2140', strokeThickness: 4 }).setOrigin(0.5).setDepth(11.8).setVisible(false);
    scene.matter.world.on('collisionstart', (e: { pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[] }) => {
      if (this.state !== 'flying' || !this.bolt) return;
      for (const pr of e.pairs) {
        const other = pr.bodyA === this.bolt ? pr.bodyB : pr.bodyB === this.bolt ? pr.bodyA : null;
        if (other && (other.label === 'road' || other.parent?.label === 'road')) return this.stick();
      }
    });
  }

  /** Where the bolt leaves the bow, in the world. */
  private tip() {
    const m = this.host.mount();
    const dx = CROSSBOW.tip.x - CROSSBOW.pivot.x;
    const dy = (CROSSBOW.tip.y - CROSSBOW.pivot.y) * (this.flipped() ? -1 : 1);
    return { x: m.x + dx * Math.cos(this.aim) - dy * Math.sin(this.aim), y: m.y + dx * Math.sin(this.aim) + dy * Math.cos(this.aim) };
  }

  private flipped() {
    return Math.abs(this.aim) > Math.PI / 2;
  }

  fire() {
    if (this.host.phase() !== 'drive') return;
    if (this.state === 'stuck') return this.release();
    if (this.state !== 'ready') return;
    const { scene } = this.host;
    const t = this.tip();
    this.bolt = scene.matter.add.circle(t.x, t.y, 8, { isSensor: true, label: 'bolt', frictionAir: 0, collisionFilter: { group: -8 } }) as unknown as MatterJS.BodyType;
    scene.matter.body.setVelocity(this.bolt as never, { x: Math.cos(this.aim) * SPEED, y: Math.sin(this.aim) * SPEED });
    this.state = 'flying';
    this.bow.setTexture('crossbow_empty');
    this.boltImg.setVisible(true);
    play('bang', 0.5, 1.6);
    scene.cameras.main.shake(90, 0.002);
    // A quick muzzle flash at the tip, so firing reads as a real release of tension, not just a click.
    const flash = scene.add.circle(t.x, t.y, 10, 0xfff6d0).setDepth(11.75).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: flash, scale: 2.6, alpha: 0, duration: 160, onComplete: () => flash.destroy() });
    scene.tweens.add({ targets: this.bow, scale: 0.94, duration: 60, yoyo: true });
  }

  /** The bolt bites into the ground: it becomes the anchor, and the cable goes taut where it is. */
  private stick() {
    if (!this.bolt) return;
    const { scene } = this.host;
    this.anchor = { x: this.bolt.position.x, y: this.bolt.position.y };
    scene.matter.world.remove(this.bolt as never);
    this.bolt = undefined;
    const f = this.host.pullFrom();
    this.length = Math.hypot(this.anchor.x - f.x, this.anchor.y - f.y);
    this.state = 'stuck';
    play('clunk', 1, 0.8);
    scene.cameras.main.shake(70, 0.0025);
    // Grit kicked up where the bolt bit in, so the catch reads as a solid hit, not just a stop.
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (Math.random() - 0.5) * 1.8;
      const puff = scene.add.image(this.anchor.x, this.anchor.y, 'puff').setDepth(11.4).setScale(0.3 + Math.random() * 0.2).setTint(0xb9b0a0).setAlpha(0.8);
      scene.tweens.add({ targets: puff, x: puff.x + Math.cos(a) * 60, y: puff.y + Math.sin(a) * 40 - 20, scale: puff.scaleX + 0.5, alpha: 0, duration: 420 + Math.random() * 200, onComplete: () => puff.destroy() });
    }
  }

  release() {
    const { scene } = this.host;
    if (this.bolt) scene.matter.world.remove(this.bolt as never);
    this.bolt = undefined;
    this.anchor = undefined;
    this.boltImg.setVisible(false);
    this.state = 'reload';
    this.reloadLeft = 0.7;
    this.tension = 0;
    play('ratchet', 0.6);
  }

  /** One frame: aim at the pointer, fly the bolt, and, when anchored, let the cable hold and pull the truck. */
  update(dt: number, pointer: { x: number; y: number }) {
    const { scene } = this.host;
    const m = this.host.mount();
    const driving = this.host.phase() === 'drive';
    // Aim: towards the pointer, anywhere in the upper half, and a little below level.
    let a = Math.atan2(pointer.y - m.y, pointer.x - m.x);
    if (a > 0.45 && a < Math.PI / 2) a = 0.45;
    else if (a >= Math.PI / 2 && a < Math.PI - 0.45) a = Math.PI - 0.45;
    if (driving && this.state !== 'stuck') this.aim = a;
    else if (!driving) this.aim = this.host.truckAngle() - 0.5;
    this.bow.setPosition(m.x, m.y).setRotation(this.aim).setFlipY(this.flipped());

    const g = this.g.clear();
    // Aiming: a dotted arc showing where the bolt would fly, until it would run out of cable.
    if (driving && this.state === 'ready') {
      const t = this.tip();
      let x = t.x;
      let y = t.y;
      let vx = Math.cos(this.aim) * SPEED;
      let vy = Math.sin(this.aim) * SPEED;
      for (let i = 0; i < 60; i++) {
        x += vx;
        y += vy;
        vy += G;
        if (Math.hypot(x - m.x, y - m.y) > CABLE) break;
        if (i % 2 === 0) g.fillStyle(0xfff6e4, 0.75 - i * 0.01).fillCircle(x, y, 4);
      }
    }
    // Reloading: a label so the pause reads as "winding up again", not "broken", and a little pop when ready.
    this.reloadLabel.setPosition(m.x, m.y - 90).setVisible(this.state === 'reload');
    if (this.state === 'reload') {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) {
        this.state = 'ready';
        this.bow.setTexture('crossbow');
        scene.tweens.add({ targets: this.bow, scale: 1.12, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
      }
    }
    // In flight: the bolt points along its path; the cable pays out, and if it runs out the bolt falls back.
    if (this.state === 'flying' && this.bolt) {
      const b = this.bolt;
      // Reaching the road's surface (cliff faces included), the bolt bites in. Checked against the surface
      // itself, so a fast bolt cannot slip between the road's pieces.
      const gy = this.host.ground(b.position.x);
      if (b.position.y >= gy - 2) {
        scene.matter.body.setPosition(b as never, { x: b.position.x, y: gy - 2 });
        this.stick();
        return;
      }
      this.boltImg.setPosition(b.position.x, b.position.y).setRotation(Math.atan2(b.velocity.y, b.velocity.x));
      if (Math.hypot(b.position.x - m.x, b.position.y - m.y) > CABLE || b.position.y > m.y + 1400) {
        this.host.say('Out of cable. Aim nearer.');
        this.release();
      }
      this.cable(g, m, b.position, true);
    }
    // Anchored: the cable is a rope. Slack, it hangs; taut, it holds the truck and, reeling in, pulls it up.
    if (this.state === 'stuck' && this.anchor) {
      const an = this.anchor;
      if (this.host.reeling()) this.length = Math.max(SHORTEST, this.length - REEL * dt);
      const f = this.host.pullFrom();
      const dx = an.x - f.x;
      const dy = an.y - f.y;
      const d = Math.hypot(dx, dy);
      const ux = dx / d;
      const uy = dy / d;
      let strain = 0;
      if (d > this.length) {
        // Taut: take away any speed away from the anchor, and pull back towards it. A firm floor on the
        // pull, not just a share of the stretch, so the last stretch of a climb - the bit right under the
        // lip, where there is the least slack left to pull against - does not go weak exactly when it is
        // needed most.
        const pull = Math.min(2.4, 0.45 + (d - this.length) * 0.07);
        strain = pull / 2.4;
        for (const body of this.host.bodies()) {
          const away = -(body.velocity.x * ux + body.velocity.y * uy);
          const fix = Math.max(0, away) + pull;
          scene.matter.body.setVelocity(body as never, { x: body.velocity.x + ux * fix, y: body.velocity.y + uy * fix });
        }
        if (this.host.reeling() && scene.time.now % 200 < 20) play('ratchet', 0.25, 1.4);
      }
      // Smoothed, so the cable's colour eases rather than flickering frame to frame.
      this.tension += (strain - this.tension) * Math.min(1, dt * 6);
      this.cable(g, m, an, d >= this.length - 2, this.tension);
      this.boltImg.setPosition(an.x, an.y);
      // Wound all the way in, or driven past the anchor: the bolt lets go and reels home.
      if ((this.length <= SHORTEST + 1 && d < SHORTEST + 60) || an.x < m.x - 500) this.release();
    }
    // The first cliff of a leg, explained once.
    if (driving && !this.taught && this.host.cliffs.some((c) => c > m.x && c - m.x < 1300)) {
      this.taught = true;
      this.host.say('A cliff! Too steep to drive. Aim at the top with the mouse, click to fire, then hold W to reel in.');
    }
  }

  /** The cable: straight when taut, sagging when slack. */
  /**
   * The cable: a real twisted-steel look (a dark sheath, a lit core, and a herringbone of twist marks
   * along it, not just a flat tinted line), sagging under its own weight when slack like an actual
   * rope would, dead straight and glowing hot under real load.
   */
  private cable(g: Phaser.GameObjects.Graphics, from: { x: number; y: number }, to: { x: number; y: number }, taut: boolean, tension = 0) {
    const span = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const sag = taut ? 0 : Math.min(130, Math.max(0, this.length - span) * 0.55);
    const n = 20;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      // A proper catenary-ish droop (heaviest in the middle), not a plain sine belly.
      const droop = sag * 4 * k * (1 - k);
      pts.push(new Phaser.Math.Vector2(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k + droop));
    }
    // A soft glow under real strain, so a taut, loaded cable reads as hot, not just a different colour.
    if (tension > 0.05) {
      g.lineStyle(14 + tension * 10, 0xffb060, tension * 0.35).strokePoints(pts);
    }
    g.lineStyle(8, 0x2a2140, 1).strokePoints(pts);
    const core = Phaser.Display.Color.Interpolate.ColorWithColor(COLOR_SLACK, COLOR_TAUT, 100, Math.round(tension * 100));
    g.lineStyle(4 + tension * 2, Phaser.Display.Color.GetColor(core.r, core.g, core.b), 1).strokePoints(pts);
    // The twist of a wound cable: short cross-ticks at a steady spacing along its length.
    const ux = (to.x - from.x) / span;
    const uy = (to.y - from.y) / span;
    const px = -uy;
    const py = ux;
    const twistEvery = 26;
    const count = Math.floor(span / twistEvery);
    for (let i = 1; i < count; i++) {
      const k = i / count;
      const idx = Math.min(n, Math.round(k * n));
      const p = pts[idx];
      const w = 3.4;
      g.lineStyle(2, 0x1a1428, 0.55).lineBetween(p.x - px * w, p.y - py * w, p.x + px * w, p.y + py * w);
    }
  }

  stop() {
    if (this.state === 'flying' || this.state === 'stuck') this.release();
  }
}
