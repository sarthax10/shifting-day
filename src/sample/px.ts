/**
 * A tiny pixel canvas for drawing art in code: every shape lands on whole pixels, gradients are
 * ordered-dithered rather than smooth, and the result becomes a Phaser texture. This is what gives
 * the low-resolution look its crispness: nothing is anti-aliased, nothing is blurred.
 */
export type RGB = [number, number, number];

export const hex = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** The 4×4 Bayer matrix, as thresholds from 0 to 1. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

/** A seeded random number generator, so every run draws the same world. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1D value noise with octaves, for ridgelines and treelines. */
export function noise1(seed: number) {
  const r = seeded(seed);
  const table = Array.from({ length: 512 }, () => r());
  const at = (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const s = f * f * (3 - 2 * f);
    return table[i & 511] * (1 - s) + table[(i + 1) & 511] * s;
  };
  return (x: number, octaves = 4) => {
    let v = 0;
    let amp = 0.5;
    let freq = 1;
    for (let o = 0; o < octaves; o++) {
      v += at(x * freq) * amp;
      amp *= 0.5;
      freq *= 2;
    }
    return v;
  };
}

export class PX {
  readonly data: Uint8ClampedArray;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  set(x: number, y: number, c: RGB, a = 255) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = a;
  }

  get(x: number, y: number): [number, number, number, number] {
    const i = ((y | 0) * this.w + (x | 0)) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  /** Paints a colour over what is there, at some strength, keeping the pixel's own alpha (or making it solid). */
  tint(x: number, y: number, c: RGB, t: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a] = this.get(x, y);
    if (!a) return;
    this.set(x, y, mixRGB([r, g, b], c, t), a);
  }

  rect(x: number, y: number, w: number, h: number, c: RGB, a = 255) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
  }

  /** A vertical gradient through colour stops [t, colour], dithered between neighbouring stops. */
  vgrad(x: number, y: number, w: number, h: number, stops: [number, RGB][], a = 255) {
    for (let j = 0; j < h; j++) {
      const t = j / Math.max(1, h - 1);
      let k = 0;
      while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      const [t0, c0] = stops[k];
      const [t1, c1] = stops[k + 1];
      const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0 || 1)));
      // Quantise the blend into a few steps, then dither between the two nearest steps.
      const steps = 4;
      const q = f * steps;
      const lo = Math.floor(q);
      for (let i = 0; i < w; i++) {
        const s = q - lo > bayer(x + i, y + j) ? lo + 1 : lo;
        this.set(x + i, y + j, mixRGB(c0, c1, Math.min(1, s / steps)), a);
      }
    }
  }

  /** Filled columns from a top height down to `bottom`, from a function of x: ridgelines, treelines, hills. */
  columns(x0: number, x1: number, top: (x: number) => number, bottom: number, colour: (x: number, y: number, depth: number) => RGB | null) {
    for (let x = x0; x < x1; x++) {
      const t = Math.round(top(x));
      for (let y = Math.max(0, t); y < bottom; y++) {
        const c = colour(x, y, y - t);
        if (c) this.set(x, y, c);
      }
    }
  }

  /** A filled ellipse on whole pixels. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 255) {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.set(cx + x, cy + y, c, a);
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB, a = 255) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c, a);
  }

  /** Makes the canvas into a texture the game can use. */
  texture(textures: Phaser.Textures.TextureManager, key: string) {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(new ImageData(this.data as unknown as Uint8ClampedArray<ArrayBuffer>, this.w, this.h), 0, 0);
    if (textures.exists(key)) textures.remove(key);
    textures.addCanvas(key, canvas);
  }
}

/**
 * A light's falloff as a white texture, in a few hard bands with dithered edges between them,
 * so glows stay true to the pixel grid instead of turning into smooth airbrush.
 */
export function glowPX(w: number, h: number, shape: (u: number, v: number) => number, bands = 6) {
  const p = new PX(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(1, shape((x + 0.5) / w, (y + 0.5) / h)));
      const q = v * bands;
      const lo = Math.floor(q);
      const s = q - lo > bayer(x, y) ? lo + 1 : lo;
      const level = Math.min(bands, s) / bands;
      if (level > 0) p.set(x, y, [255, 255, 255], Math.round(level * 255));
    }
  }
  return p;
}
