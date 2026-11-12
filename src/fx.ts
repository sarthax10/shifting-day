import Phaser from 'phaser';

const KEY = 'shifting-day-effects';

interface Light {
  halo: Phaser.GameObjects.Image;
  /** How strong the halo is when at rest, from 0 to 1. */
  base: number;
  /** Where in its slow pulse this light starts, so they do not all breathe together. */
  phase: number;
  /** How much of the base strength the pulse moves. */
  swing: number;
}

interface Pulse {
  halo: Phaser.GameObjects.Image;
  obj: Phaser.GameObjects.Image;
  start: number;
  ms: number;
  strength: number;
}

/**
 * The glow and the colour. Nothing here uses a render filter: a filter draws its target into a
 * separate texture and back every frame, which is slow on ordinary graphics hardware.
 * Instead every glow is a soft round picture laid behind or over the thing that shines,
 * and the warm colour is one tinted layer over the whole scene. The player can switch it all off.
 */
export class Fx {
  enabled: boolean;
  private tint?: Phaser.GameObjects.Rectangle;
  private lights = new Map<Phaser.GameObjects.Image, Light>();
  private pulses: Pulse[] = [];

  constructor(private scene: Phaser.Scene) {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      // A browser that will not store it just forgets the choice.
    }
    this.enabled = stored !== 'off';
  }

  /** The effects are cheap enough to run anywhere, so they are always available. */
  get available() {
    return true;
  }

  /** A warm wash over the whole picture: white multiplied by a pale cream takes a little blue out of everything. */
  setup(width: number, height: number) {
    if (width > 0) return;
    this.tint = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0xfff0d8)
      .setScrollFactor(0)
      .setDepth(94)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setVisible(this.enabled);
  }

  /** A light that glows all the time and breathes a little: the sun, a lamp, a headlight. */
  light(obj: Phaser.GameObjects.Image, colour: number, strength: number, radius: number, swing = 0.2) {
    const halo = this.scene.add
      .image(obj.x, obj.y, 'halo')
      .setTint(colour)
      .setDisplaySize(radius * 2, radius * 2)
      .setScrollFactor(obj.scrollFactorX, obj.scrollFactorY)
      .setDepth(obj.depth - 0.01)
      .setAlpha(strength)
      .setVisible(this.enabled);
    this.lights.set(obj, { halo, base: strength, phase: Math.random() * 6.28, swing });
  }

  /** Change how hard a light glows: the headlight is brighter once the truck is moving. */
  brighten(obj: Phaser.GameObjects.Image, strength: number) {
    const light = this.lights.get(obj);
    if (light) light.base = strength;
  }

  /** Call every frame, after the things the lights belong to have moved. */
  update(time: number) {
    for (const [obj, l] of this.lights) {
      const show = this.enabled && obj.visible;
      l.halo.setVisible(show);
      if (!show) continue;
      l.halo.setPosition(obj.x, obj.y).setAlpha(Math.min(1, l.base * (1 + Math.sin(time / 700 + l.phase) * l.swing)));
    }
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      const k = (time - p.start) / p.ms;
      if (k >= 1 || !p.obj.scene || !this.enabled) {
        p.halo.destroy();
        this.pulses.splice(i, 1);
        continue;
      }
      // Up quickly, then a long fade.
      const level = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
      p.halo
        .setPosition(p.obj.x, p.obj.y)
        .setAlpha(p.strength * level)
        .setScale((p.halo.getData('size') as number) * (0.85 + 0.25 * Math.min(1, k * 2)));
    }
  }

  /** A quick glow that swells and fades, for picking something up or tying it down. */
  pulse(obj: Phaser.GameObjects.Image, colour: number, strength = 0.9, ms = 600) {
    if (!this.enabled) return;
    const size = (Math.max(obj.displayWidth, obj.displayHeight) * 1.7) / 256;
    const halo = this.scene.add
      .image(obj.x, obj.y, 'halo')
      .setTint(colour)
      .setScrollFactor(obj.scrollFactorX, obj.scrollFactorY)
      .setDepth(obj.depth - 0.5)
      .setScale(size)
      .setAlpha(0)
      .setData('size', size);
    this.pulses.push({ halo, obj, start: this.scene.time.now, ms, strength });
  }

  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(KEY, this.enabled ? 'on' : 'off');
    } catch {
      // As above.
    }
    this.tint?.setVisible(this.enabled);
    for (const l of this.lights.values()) l.halo.setVisible(this.enabled);
    return this.enabled;
  }
}
