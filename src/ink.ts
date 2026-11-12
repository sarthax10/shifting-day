import { getStroke } from 'perfect-freehand';

/**
 * Shared palette: golden hour. Deep indigo ink instead of brown, coral and gold for warmth,
 * teal-green for leaves, lavender and plum for things far away. The names are kept from the first
 * palette so every drawing picks the new colours up.
 */
export const C = {
  ink: '#2A2140',
  walnut: '#5B3A4E',
  woodDark: '#A0603E',
  wood: '#E6AA6C',
  woodLine: '#C98552',
  wall: '#C98A62',
  paper: '#FFF3DE',
  oat: '#F7DDB4',
  cream: '#FFF2DA',
  creamShade: '#F2CFA8',
  sage: '#5DAA7A',
  sageLight: '#9CD49A',
  sageDark: '#2F7F6A',
  moss: '#1F5C57',
  terracotta: '#EE6A4D',
  terracottaDark: '#B8403F',
  mustard: '#FFB23F',
  sticky: '#FFD67A',
  teal: '#3FA7B5',
  dusk: '#3E3F78',
  dry: '#D88A2E',
  /** New colours for the new palette. */
  plum: '#7A4B7E',
  lavender: '#B9A3D6',
  pink: '#F49AA0',
  sky: '#6CB8D8',
} as const;

export type Pt = [number, number];

export interface ShapeOpts {
  fill?: string;
  stroke?: string | null;
  width?: number;
  /** Corners stay sharp-ish instead of being rounded through a spline. */
  raw?: boolean;
  /** Extra shapes painted inside this one, clipped to its outline. */
  shade?: { pts: Pt[]; color: string }[];
  /** How far this drawing's permanent imperfection strays from the control points. */
  wobble?: number;
  opacity?: number;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function catmull(pts: Pt[], closed: boolean, segs = 10): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let j = 0; j < segs; j++) {
      const t = j / segs;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (p2[0] - p0[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

function resample(pts: Pt[], closed: boolean, step: number): Pt[] {
  const src = closed ? [...pts, pts[0]] : pts;
  const out: Pt[] = [src[0]];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const [ax, ay] = src[i - 1];
    const [bx, by] = src[i];
    const len = Math.hypot(bx - ax, by - ay);
    let d = step - carry;
    while (d <= len) {
      const t = d / len;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      d += step;
    }
    carry = (carry + len) % step;
  }
  if (!closed) out.push(src[src.length - 1]);
  return out;
}

function perimeter(pts: Pt[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return total;
}

/** Smooth noise along a path. Whole cycles only, so closed outlines have no seam. */
function pathNoise(seed: number, perim: number, wavelength: number) {
  const r = rng(seed);
  const k1 = Math.max(1, Math.round(perim / wavelength));
  const k2 = Math.max(2, Math.round(perim / (wavelength * 0.45)));
  const p1 = r() * Math.PI * 2;
  const p2 = r() * Math.PI * 2;
  return (u: number) => 0.7 * Math.sin(2 * Math.PI * k1 * u + p1) + 0.3 * Math.sin(2 * Math.PI * k2 * u + p2);
}

function toPath(pts: number[][], closed: boolean): string {
  if (pts.length < 2) return '';
  const f = (n: number) => n.toFixed(1);
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const first = closed ? mid(pts[pts.length - 1], pts[0]) : pts[0];
  let d = `M${f(first[0])} ${f(first[1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const m = mid(pts[i], pts[i + 1]);
    d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f(m[0])} ${f(m[1])}`;
  }
  const end = pts[pts.length - 1];
  if (closed) {
    const m = mid(end, pts[0]);
    d += `Q${f(end[0])} ${f(end[1])} ${f(m[0])} ${f(m[1])}Z`;
  } else {
    d += `L${f(end[0])} ${f(end[1])}`;
  }
  return d;
}

export function rectPts(x: number, y: number, w: number, h: number, r = 8): Pt[] {
  const out: Pt[] = [];
  const corner = (cx: number, cy: number, from: number) => {
    for (let i = 0; i <= 4; i++) {
      const a = from + (i / 4) * (Math.PI / 2);
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return out;
}

export function ellipsePts(cx: number, cy: number, rx: number, ry: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

/**
 * Draws wobbly ink shapes into one SVG.
 * The asset name fixes each shape's permanent hand-drawn imperfection. The variant
 * adds a smaller wobble on top, and cycling variants produces the line boil.
 */
/** Mixes two #rrggbb colours: t = 0 is a, t = 1 is b. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (v: number, s: number) => (v >> s) & 255;
  const out = [16, 8, 0].map((s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}

const SOLID = /^#[0-9a-fA-F]{6}$/;

/**
 * Draws wobbly ink shapes into one SVG, rendered like a finished illustration rather than flat cut-outs:
 * - coloured line art: each outline is a deep shade of the colour it surrounds, not plain black;
 * - every fill is a gentle gradient, lighter at the top where the sun falls and darker below;
 * - a fine grain over the whole drawing, inside its shapes only, so surfaces read as materials.
 */
export class Pen {
  private parts: string[] = [];
  private count = 0;
  private clips = 0;
  private gradients = new Map<string, string>();
  /** Even line weight, for machined things like the chair's frame. */
  steady = false;
  /** Interface pieces are drawn flat: no gradients, no grain, plain ink lines. */
  plain = false;

  /** A vertical gradient for a colour, made once per drawing. */
  private paint(fill: string): string {
    if (this.plain || !SOLID.test(fill)) return fill;
    let id = this.gradients.get(fill);
    if (!id) {
      id = `g${this.gradients.size}`;
      this.gradients.set(fill, id);
    }
    return `url(#${id})`;
  }

  constructor(private asset: string, private variant: number, private boil: number) {}

  private wobbly(input: Pt[], closed: boolean, ampBase: number): Pt[] {
    this.count++;
    const baseSeed = hash(`${this.asset}#${this.count}`);
    const varSeed = hash(`${this.asset}#${this.count}@${this.variant}`);
    const pts = resample(input, closed, 5);
    const perim = perimeter(closed ? [...pts, pts[0]] : pts) || 1;
    const bx = pathNoise(baseSeed, perim, 170);
    const by = pathNoise(baseSeed + 1, perim, 170);
    const vx = pathNoise(varSeed, perim, 60);
    const vy = pathNoise(varSeed + 1, perim, 60);
    return pts.map(([x, y], i) => {
      const u = i / pts.length;
      return [x + bx(u) * ampBase + vx(u) * this.boil, y + by(u) * ampBase + vy(u) * this.boil] as Pt;
    });
  }

  private outline(pts: Pt[], closed: boolean, width: number, color: string, opacity = 1) {
    const seed = hash(`${this.asset}#${this.count}p`);
    const noise = pathNoise(seed, perimeter(pts) || 1, 150);
    const src = closed ? [...pts, ...pts.slice(0, 4)] : pts;
    const withPressure = src.map(([x, y], i) => [x, y, this.steady ? 0.62 : 0.58 + 0.27 * noise(i / pts.length)]);
    const stroke = getStroke(withPressure, {
      size: width * 1.06,
      thinning: this.steady ? 0.05 : 0.66,
      smoothing: 0.6,
      streamline: 0.15,
      simulatePressure: false,
      last: true,
    });
    const op = opacity < 1 ? ` opacity="${opacity}"` : '';
    this.parts.push(`<path d="${toPath(stroke, true)}" fill="${color}"${op}/>`);
  }

  shape(control: Pt[], o: ShapeOpts = {}) {
    const dense = o.raw ? control : catmull(control, true);
    const pts = this.wobbly(dense, true, o.wobble ?? 1.6);
    const d = toPath(pts, true);
    const op = o.opacity !== undefined ? ` opacity="${o.opacity}"` : '';
    if (o.fill) this.parts.push(`<path d="${d}" fill="${this.paint(o.fill)}"${op}/>`);
    if (o.shade?.length) {
      const id = `c${this.clips++}`;
      this.parts.push(`<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">`);
      for (const s of o.shade) this.parts.push(`<path d="${toPath(catmull(s.pts, true), true)}" fill="${s.color}"/>`);
      this.parts.push('</g>');
    }
    const line = o.stroke ?? (!this.plain && o.fill && SOLID.test(o.fill) ? mix(o.fill, C.ink, 0.74) : C.ink);
    if (o.stroke !== null) this.outline(pts, true, o.width ?? 7, line);
  }

  /** Pins the next shape's hand-drawn wobble, so it stays the same when draw order changes. */
  seek(n: number) {
    this.count = n;
  }

  rect(x: number, y: number, w: number, h: number, o: ShapeOpts & { r?: number } = {}) {
    this.shape(rectPts(x, y, w, h, o.r ?? 8), { ...o, raw: true });
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, o: ShapeOpts = {}) {
    this.shape(ellipsePts(cx, cy, rx, ry), { ...o, raw: true });
  }

  line(control: Pt[], o: { width?: number; color?: string; raw?: boolean; opacity?: number; wobble?: number } = {}) {
    const dense = o.raw ? control : catmull(control, false);
    const pts = this.wobbly(dense, false, o.wobble ?? 1);
    this.outline(pts, false, o.width ?? 5, o.color ?? C.ink, o.opacity ?? 1);
  }

  dot(cx: number, cy: number, r: number, color: string = C.ink) {
    this.shape(ellipsePts(cx, cy, r, r * 1.05), { fill: color, stroke: null, raw: true, wobble: 0.5 });
  }

  raw(svg: string) {
    this.parts.push(svg);
  }

  svg(w: number, h: number): string {
    const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    if (this.plain) return `${head}${this.parts.join('')}</svg>`;
    const grads = [...this.gradients]
      .map(([colour, id]) => `<linearGradient id="${id}" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stop-color="${mix(colour, '#FFF4D6', 0.16)}"/><stop offset="0.55" stop-color="${colour}"/><stop offset="1" stop-color="${mix(colour, C.ink, 0.16)}"/></linearGradient>`)
      .join('');
    // Fine grain, kept inside the drawing's own shapes, multiplied gently over the colours.
    const seed = hash(this.asset) % 97;
    const grain = `<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed}" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="g"/><feComponentTransfer in="g" result="soft"><feFuncR type="linear" slope="0.3" intercept="0.78"/><feFuncG type="linear" slope="0.3" intercept="0.78"/><feFuncB type="linear" slope="0.3" intercept="0.8"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer><feBlend in="SourceGraphic" in2="soft" mode="multiply" result="m"/><feComposite in="m" in2="SourceGraphic" operator="in"/></filter>`;
    return `${head}<defs>${grads}${grain}</defs><g filter="url(#grain)">${this.parts.join('')}</g></svg>`;
  }
}
