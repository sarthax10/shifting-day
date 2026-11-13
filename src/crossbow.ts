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

  constructor(private host: CrossbowHost) {}

  build() {
    const { scene } = this.host;
    this.g = scene.add.graphics().setDepth(11.7);
    this.bow = scene.add.image(0, 0, 'crossbow').setOrigin(CROSSBOW.pivot.x / CROSSBOW.w, CROSSBOW.pivot.y / CROSSBOW.h).setDepth(11.6);
    this.boltImg = scene.add.image(0, 0, 'anchor_bolt').setOrigin(0.92, 0.5).setDepth(11.65).setVisible(false);
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
  }

  release() {
    const { scene } = this.host;
    if (this.bolt) scene.matter.world.remove(this.bolt as never);
    this.bolt = undefined;
    this.anchor = undefined;
    this.boltImg.setVisible(false);
    this.state = 'reload';
    this.reloadLeft = 0.7;
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
    // Reloading.
    if (this.state === 'reload') {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) {
        this.state = 'ready';
        this.bow.setTexture('crossbow');
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
      if (d > this.length) {
        // Taut: take away any speed away from the anchor, and pull back towards it by how much it is stretched.
        const pull = Math.min(1.6, (d - this.length) * 0.06);
        for (const body of this.host.bodies()) {
          const away = -(body.velocity.x * ux + body.velocity.y * uy);
          const fix = Math.max(0, away) + pull;
          scene.matter.body.setVelocity(body as never, { x: body.velocity.x + ux * fix, y: body.velocity.y + uy * fix });
        }
        if (this.host.reeling() && scene.time.now % 200 < 20) play('ratchet', 0.25, 1.4);
      }
      this.cable(g, m, an, d >= this.length - 2);
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
  private cable(g: Phaser.GameObjects.Graphics, from: { x: number; y: number }, to: { x: number; y: number }, taut: boolean) {
    const sag = taut ? 0 : Math.min(120, Math.max(0, this.length - Math.hypot(to.x - from.x, to.y - from.y)) * 0.5);
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const k = i / 16;
      pts.push(new Phaser.Math.Vector2(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * sag));
    }
    g.lineStyle(6, 0x2a2140, 1).strokePoints(pts);
    g.lineStyle(3, 0xd8d8e4, 1).strokePoints(pts);
  }

  stop() {
    if (this.state === 'flying' || this.state === 'stuck') this.release();
  }
}
