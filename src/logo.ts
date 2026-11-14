/**
 * The title's wordmark and its lit truck, painted on canvases rather than typed.
 *
 * The wordmark follows what the reference logos (hand-cut band and game lettering, BLACK SUN, PSYCH
 * WARD, DEATH DEALERS, Beautiful Freak) have in common: it is a single stacked lockup, not a line of
 * type. Each letter is cut individually - leaning forward, a little rotated, nudged off the baseline,
 * so the word itself looks like it has shifted - then the edges are roughened like cut paper, chipped,
 * slashed through with speed cuts and spattered. "DAY" sits under "SHIFTING" larger and ember-hot,
 * knocked out of it with a dark gap where they overlap. Everything has a tight dark outline and a short
 * extruded shadow, so it reads over the sun as well as the night, and at phone size. One graphic is
 * worked into the lettering: the cat from the truck, peeking over the top of the word.
 */

const DISPLAY = '"Anton", "Impact", sans-serif';
const DARK = '#0A0712';

type Ctx = CanvasRenderingContext2D;

function mk(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return [c, c.getContext('2d', { willReadFrequently: true })!];
}

/** A seeded random number generator, so the lettering is the same every time the game opens. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Smooth value noise in 0..1. */
function noise(x: number, y: number, seed: number) {
  const h = (ix: number, iy: number) => {
    const v = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * sx;
  const b = h(ix, iy + 1) + (h(ix + 1, iy + 1) - h(ix, iy + 1)) * sx;
  return a + (b - a) * sy;
}

/** Push every edge of a white mask around with noise, then cut it crisp: a hand-cut, torn outline. */
function roughen(c: HTMLCanvasElement, amp: number, seed: number) {
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const { width: w, height: h } = c;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const s = src.data;
  const o = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (noise(x / 14, y / 14, seed) - 0.5) * amp + (noise(x / 3.2, y / 3.2, seed + 3) - 0.5) * amp * 0.55;
      const dy = (noise(x / 14 + 40, y / 14, seed + 1) - 0.5) * amp + (noise(x / 3.2 + 9, y / 3.2, seed + 5) - 0.5) * amp * 0.55;
      const sx = Math.min(w - 1, Math.max(0, Math.round(x + dx)));
      const sy = Math.min(h - 1, Math.max(0, Math.round(y + dy)));
      const a = s[(sy * w + sx) * 4 + 3];
      const i = (y * w + x) * 4;
      o[i] = o[i + 1] = o[i + 2] = 255;
      o[i + 3] = a > 120 ? 255 : 0;
    }
  }
  ctx.putImageData(out, 0, 0);
}

/** A mask filled with a colour or gradient, as a new canvas. */
function paint(mask: HTMLCanvasElement, fill: string | CanvasGradient) {
  const [c, ctx] = mk(mask.width, mask.height);
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** A mask grown outward by r pixels, for outlines and knock-outs. */
function grow(mask: HTMLCanvasElement, r: number) {
  const [c, ctx] = mk(mask.width, mask.height);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.drawImage(mask, Math.cos(a) * r, Math.sin(a) * r);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.drawImage(mask, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
  }
  return c;
}

/** Grit and scratches, kept inside whatever is already painted. */
function grit(c: HTMLCanvasElement, rnd: () => number, dark: string, light: string) {
  const ctx = c.getContext('2d')!;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < (c.width * c.height) / 70; i++) {
    ctx.fillStyle = rnd() < 0.72 ? dark : light;
    const s = 1 + rnd() * 2.6;
    ctx.fillRect(rnd() * c.width, rnd() * c.height, s, s);
  }
  // A few worn patches, like ink that did not take.
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = dark;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    const x = rnd() * c.width;
    const y = rnd() * c.height;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const r = 4 + rnd() * 10;
      ctx.lineTo(x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export interface Logo {
  canvas: HTMLCanvasElement;
  /** Where the cat's eyes are on the canvas, for the blinking overlay. */
  eyes: { x: number; y: number }[];
  /** The middle of "DAY", for the hot glow behind it. */
  day: { x: number; y: number; w: number; h: number };
}

interface Glyph {
  ch: string;
  x: number;
  dy: number;
  rot: number;
  scale: number;
}

/** Lays out one word's letters: tight, forward-leaning, each nudged and turned a little. */
function layout(ctx: Ctx, text: string, size: number, tracking: number, rnd: () => number, steps: number[]) {
  ctx.font = `${size}px ${DISPLAY}`;
  let x = 0;
  const glyphs: Glyph[] = [];
  [...text].forEach((ch, i) => {
    const w = ctx.measureText(ch).width;
    glyphs.push({ ch, x: x + w / 2, dy: steps[i % steps.length], rot: (rnd() - 0.5) * 0.07, scale: 0.97 + rnd() * 0.07 });
    x += w + tracking;
  });
  return { glyphs, width: x - tracking };
}

function drawWord(ctx: Ctx, glyphs: Glyph[], ox: number, baseline: number, size: number, skew: number) {
  ctx.font = `${size}px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  for (const g of glyphs) {
    ctx.save();
    ctx.translate(ox + g.x, baseline + g.dy);
    ctx.rotate(g.rot);
    ctx.transform(1, 0, skew, 1, 0, 0);
    ctx.scale(g.scale, g.scale);
    ctx.fillText(g.ch, 0, 0);
    ctx.restore();
  }
}

export function buildLogo(): Logo {
  const rnd = seeded(20261);
  const W = 1500;
  const H = 940;
  const [probeC, probe] = mk(10, 10);
  void probeC;
  const SKEW = -0.17;

  // ---- Layout: SHIFTING on top, DAY larger under its right side, the two overlapping.
  const s1 = 236;
  const s2 = 318;
  const top = layout(probe, 'SHIFTING', s1, -4, rnd, [0, -12, 6, -6, 10, -10, 4, -2]);
  const bot = layout(probe, 'DAY', s2, -2, rnd, [4, -8, 2]);
  probe.font = `${s1}px ${DISPLAY}`;
  const cap1 = probe.measureText('H').actualBoundingBoxAscent;
  probe.font = `${s2}px ${DISPLAY}`;
  const cap2 = probe.measureText('H').actualBoundingBoxAscent;
  const x1 = (W - top.width) / 2 - 30;
  const base1 = 230 + cap1;
  const x2 = x1 + top.width - bot.width + 10;
  const base2 = base1 + cap2 - 34;

  const [m1, c1] = mk(W, H);
  drawWord(c1, top.glyphs, x1, base1, s1, SKEW);
  const [m2, c2] = mk(W, H);
  drawWord(c2, bot.glyphs, x2, base2, s2, SKEW);

  // Speed cuts: thin horizontal slashes through the letters, longer toward the back of the word.
  for (const [m, c, y0, y1] of [[m1, c1, base1 - cap1, base1], [m2, c2, base2 - cap2, base2]] as const) {
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 4; i++) {
      const y = y0 + 20 + rnd() * (y1 - y0 - 40);
      const len = 60 + rnd() * 200;
      const x = rnd() * W * 0.8 + 40;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + len, y - 1.5);
      c.lineTo(x + len - 8, y + 3 + rnd() * 3);
      c.lineTo(x + 6, y + 2);
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    void m;
  }
  roughen(m1, 6, 3);
  roughen(m2, 7, 8);

  const [out, o] = mk(W, H);

  // ---- The cat, peeking over the top of the word: ears and the top of its head, dark, rim-lit.
  const catX = x1 + top.width * 0.43;
  const catY = base1 - cap1 - 30;
  const [cm, cc] = mk(W, H);
  cc.fillStyle = '#fff';
  cc.beginPath();
  cc.ellipse(catX, catY + 40, 128, 108, 0, Math.PI, 0);
  cc.lineTo(catX + 128, catY + 80);
  cc.lineTo(catX - 128, catY + 80);
  cc.fill();
  for (const side of [-1, 1]) {
    cc.beginPath();
    cc.moveTo(catX + side * 120, catY + 10);
    cc.lineTo(catX + side * 112, catY - 118);
    cc.lineTo(catX + side * 34, catY - 52);
    cc.fill();
  }
  roughen(cm, 4, 21);
  const catOutline = paint(grow(cm, 8), DARK);
  o.drawImage(catOutline, 0, 0);
  // Fur, lit at the top edges by the sun behind it.
  const fur = paint(cm, '#1A1226');
  const furCtx = fur.getContext('2d')!;
  furCtx.globalCompositeOperation = 'source-atop';
  const [rimC, rimCtx] = mk(W, H);
  rimCtx.drawImage(cm, 0, 0);
  rimCtx.globalCompositeOperation = 'destination-out';
  rimCtx.drawImage(cm, 0, 7);
  furCtx.drawImage(paint(rimC, '#FF9A5A'), 0, 0);
  // Inner ears.
  furCtx.fillStyle = '#3A1A2E';
  for (const side of [-1, 1]) {
    furCtx.beginPath();
    furCtx.moveTo(catX + side * 104, catY - 4);
    furCtx.lineTo(catX + side * 100, catY - 86);
    furCtx.lineTo(catX + side * 52, catY - 46);
    furCtx.fill();
  }
  o.drawImage(fur, 0, 0);
  const eyes = [
    { x: catX - 48, y: catY - 6 },
    { x: catX + 48, y: catY - 6 },
  ];

  // ---- Depth: a short extrusion down and to the right, in near-black.
  const both = (() => {
    const [b, bc] = mk(W, H);
    bc.drawImage(m1, 0, 0);
    bc.drawImage(m2, 0, 0);
    return b;
  })();
  const outline = grow(both, 9);
  const darkOutline = paint(outline, DARK);
  for (let k = 14; k >= 1; k--) o.drawImage(darkOutline, k * 0.7, k);
  o.drawImage(darkOutline, 0, 0);

  // ---- SHIFTING: bone-white, warming at the foot, gritty.
  const g1 = o.createLinearGradient(0, base1 - cap1, 0, base1 + 10);
  g1.addColorStop(0, '#FFF9EE');
  g1.addColorStop(0.6, '#F3E3CC');
  g1.addColorStop(1, '#E9B88A');
  const p1 = paint(m1, g1);
  grit(p1, rnd, 'rgba(32, 14, 26, 0.32)', 'rgba(255, 255, 255, 0.5)');
  o.drawImage(p1, 0, 0);

  // ---- DAY: knocked out of SHIFTING with a dark gap, then filled ember-hot.
  o.drawImage(paint(grow(m2, 10), DARK), 0, 0);
  const g2 = o.createLinearGradient(0, base2 - cap2, 0, base2 + 10);
  g2.addColorStop(0, '#FFD36A');
  g2.addColorStop(0.45, '#FF7A35');
  g2.addColorStop(1, '#E3263A');
  const p2 = paint(m2, g2);
  grit(p2, rnd, 'rgba(60, 8, 20, 0.35)', 'rgba(255, 236, 190, 0.45)');
  o.drawImage(p2, 0, 0);

  // Drips off the bottom of DAY, and a spatter of ink around the lockup.
  o.fillStyle = '#E3263A';
  for (let i = 0; i < 6; i++) {
    const x = x2 + 40 + rnd() * (bot.width - 80);
    const len = 18 + rnd() * 50;
    const w = 6 + rnd() * 8;
    const y = base2 - 6;
    o.beginPath();
    o.moveTo(x - w / 2, y);
    o.lineTo(x + w / 2, y);
    o.lineTo(x + w * 0.35, y + len);
    o.arc(x, y + len, w * 0.4, 0, Math.PI);
    o.fill();
  }
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 380 + rnd() * 300;
    const x = W / 2 + Math.cos(a) * r * 1.05;
    const y = (base1 + base2) / 2 - 60 + Math.sin(a) * r * 0.42;
    o.fillStyle = i % 4 === 0 ? '#FF7A35' : '#F3E3CC';
    o.globalAlpha = 0.4 + rnd() * 0.5;
    o.beginPath();
    o.arc(x, y, 1 + rnd() * rnd() * 7, 0, Math.PI * 2);
    o.fill();
  }
  o.globalAlpha = 1;

  return { canvas: out, eyes, day: { x: x2 + bot.width / 2, y: base2 - cap2 / 2, w: bot.width, h: cap2 } };
}

/** One cat's eye: an amber almond with a slit pupil and a hot centre. */
export function catEye(): HTMLCanvasElement {
  const [c, ctx] = mk(84, 50);
  const g = ctx.createRadialGradient(42, 25, 2, 42, 25, 40);
  g.addColorStop(0, '#FFF4B0');
  g.addColorStop(0.5, '#FFC23A');
  g.addColorStop(1, '#E8641E');
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.moveTo(2, 25);
  ctx.quadraticCurveTo(42, -10, 82, 25);
  ctx.quadraticCurveTo(42, 60, 2, 25);
  ctx.fill();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(8, 25);
  ctx.quadraticCurveTo(42, -2, 76, 22);
  ctx.quadraticCurveTo(42, 52, 8, 25);
  ctx.fill();
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.ellipse(44, 24, 5, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(52, 17, 3, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** A spiked sunburst, hot at the centre and fading out along every ray. */
export function sunburst(size: number): HTMLCanvasElement {
  const [c, ctx] = mk(size, size);
  const r = size / 2;
  const rnd = seeded(77);
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255, 120, 60, 0.95)');
  g.addColorStop(0.25, 'rgba(255, 70, 50, 0.55)');
  g.addColorStop(1, 'rgba(200, 30, 60, 0)');
  ctx.fillStyle = g;
  const n = 34;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.05;
    const len = r * (0.55 + rnd() * 0.45);
    const w = 0.02 + rnd() * 0.035;
    ctx.beginPath();
    ctx.moveTo(r + Math.cos(a - w) * 40, r + Math.sin(a - w) * 40);
    ctx.lineTo(r + Math.cos(a) * len, r + Math.sin(a) * len);
    ctx.lineTo(r + Math.cos(a + w) * 40, r + Math.sin(a + w) * 40);
    ctx.fill();
  }
  return c;
}

/**
 * A picture lit like it is standing in front of a low sun: graded down into the dusk, darker toward
 * the ground, with a hot rim of light along every top and leading edge. Returns the lit picture and
 * a soft glow made from the rim alone, to lay over it additively.
 */
export function backlit(src: HTMLCanvasElement, rim = 5): { lit: HTMLCanvasElement; glow: HTMLCanvasElement } {
  const { width: w, height: h } = src;
  const [lit, l] = mk(w, h);
  l.drawImage(src, 0, 0);
  l.globalCompositeOperation = 'source-atop';
  l.fillStyle = 'rgba(52, 26, 78, 0.46)';
  l.fillRect(0, 0, w, h);
  const fall = l.createLinearGradient(0, 0, 0, h);
  fall.addColorStop(0, 'rgba(10, 6, 20, 0)');
  fall.addColorStop(0.55, 'rgba(10, 6, 20, 0.12)');
  fall.addColorStop(1, 'rgba(10, 6, 20, 0.55)');
  l.fillStyle = fall;
  l.fillRect(0, 0, w, h);
  const [edge, e] = mk(w, h);
  e.drawImage(src, 0, 0);
  e.globalCompositeOperation = 'destination-out';
  e.drawImage(src, -rim * 0.5, rim);
  e.globalCompositeOperation = 'source-in';
  const warm = e.createLinearGradient(0, 0, w, 0);
  warm.addColorStop(0, '#FFB46A');
  warm.addColorStop(1, '#FFE2A8');
  e.fillStyle = warm;
  e.fillRect(0, 0, w, h);
  l.globalCompositeOperation = 'source-atop';
  l.drawImage(edge, 0, 0);
  const [glow, gc] = mk(w, h);
  gc.filter = 'blur(7px)';
  gc.drawImage(edge, 0, 0);
  gc.filter = 'none';
  gc.drawImage(edge, 0, 0);
  return { lit, glow };
}

export { mk };

// ====================================================================== poster pieces
// Everything else on the title is printed in the logo's own inks: near-black, bone, and an ember ramp.

export const INK = '#0A0712';
export const BONE = '#F3E3CC';
/** The ramp the truck and cat are re-inked through, dark to light. */
export const RAMP = ['#0A0712', '#3A0F22', '#A3233A', '#FF6A30', '#FFC07A', '#F6EBDD'];
/** A darker ramp for things standing in front of the sun, so they cut out against it. */
export const RAMP_DARK = ['#0A0712', '#22081A', '#5E1530', '#B0243A', '#FF7A3A', '#F6EBDD'];

export { grow, paint };

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/**
 * Re-inks a picture through a colour ramp by its brightness, posterised into a few steps per band so
 * it reads as screen-printed rather than painted, then dots its shadow side with a halftone.
 */
export function gradientMap(src: HTMLCanvasElement, stops: string[] = RAMP): HTMLCanvasElement {
  const [c, ctx] = mk(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const ramp = stops.map(hex);
  const n = ramp.length - 1;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    let l = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
    l = Math.min(1, Math.max(0, (l - 0.06) / 0.86));
    const t = l * n;
    const k = Math.min(n - 1, Math.floor(t));
    const f = Math.round((t - k) * 2) / 2;
    for (let ch = 0; ch < 3; ch++) d[i + ch] = ramp[k][ch] + (ramp[k + 1][ch] - ramp[k][ch]) * f;
  }
  ctx.putImageData(img, 0, 0);
  // Halftone shadow: dots growing toward the bottom, kept inside the picture.
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(10, 7, 18, 0.32)';
  const step = 7;
  for (let y = 0; y < c.height; y += step) {
    const r = Math.max(0, (y / c.height - 0.45) * 2) * step * 0.5;
    if (r < 0.4) continue;
    for (let x = (y / step) % 2 ? step / 2 : 0; x < c.width; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

/** A picture with the logo's treatment: a tight ink outline and an ember print layer slipped off register. */
export function inked(src: HTMLCanvasElement, outline = 6, slip: [number, number] = [-6, 4], ramp: string[] = RAMP): { canvas: HTMLCanvasElement; pad: number } {
  const p = outline + Math.max(Math.abs(slip[0]), Math.abs(slip[1])) + 2;
  const [c, ctx] = mk(src.width + p * 2, src.height + p * 2);
  const [m, mc] = mk(c.width, c.height);
  mc.drawImage(src, p, p);
  const mask = paint(m, '#fff');
  const ring = grow(mask, outline);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(paint(ring, '#E3263A'), slip[0], slip[1]);
  ctx.globalAlpha = 1;
  ctx.drawImage(paint(ring, INK), 0, 0);
  ctx.drawImage(gradientMap(m, ramp), 0, 0);
  return { canvas: c, pad: p };
}

/** The black poster sheet: ink with a little warmth, paper fibres, and an ember halftone rising from the foot. */
export function paperBackdrop(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = mk(w, h);
  const rnd = seeded(5);
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#0B0811');
  base.addColorStop(0.6, '#140C18');
  base.addColorStop(1, '#2A0E1A');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // Halftone heat from the bottom: dots that shrink to nothing toward the middle of the sheet.
  const step = 16;
  for (let y = h; y > h * 0.35; y -= step) {
    const k = (y - h * 0.35) / (h * 0.65);
    const r = k * k * step * 0.48;
    ctx.fillStyle = `rgba(227, 38, 58, ${0.35 + k * 0.4})`;
    for (let x = ((h - y) / step) % 2 ? step / 2 : 0; x < w + step; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Paper fibres and specks.
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(243, 227, 204, 0.05)' : 'rgba(0, 0, 0, 0.25)';
    const x = rnd() * w;
    const y = rnd() * h;
    if (rnd() < 0.2) ctx.fillRect(x, y, 6 + rnd() * 30, 1);
    else ctx.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  return c;
}

/** Rays, printed: alternating wedges in a dark red, like an old rising-sun poster. */
export function printRays(size: number, n: number, color: string): HTMLCanvasElement {
  const [c, ctx] = mk(size, size);
  const r = size / 2;
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + (Math.PI / n) * 0.9;
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.arc(r, r, r, a0, a1);
    ctx.fill();
  }
  // Fade the rays out toward the edge.
  ctx.globalCompositeOperation = 'destination-in';
  const g = ctx.createRadialGradient(r, r, r * 0.2, r, r, r);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.6)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/** A halftone sun: a solid hot core that breaks up into ever-smaller dots toward its rim. */
export function halftoneSun(size: number): HTMLCanvasElement {
  const [c, ctx] = mk(size, size);
  const r = size / 2 - 4;
  const cx = size / 2;
  const fill = ctx.createLinearGradient(0, 0, 0, size);
  fill.addColorStop(0, '#FFC07A');
  fill.addColorStop(0.5, '#FF6A30');
  fill.addColorStop(1, '#C21F3A');
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cx, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  const step = 15;
  for (let y = 0; y < size; y += step) {
    for (let x = (y / step) % 2 ? step / 2 : 0; x < size; x += step) {
      const d = Math.hypot(x - cx, y - cx) / r;
      if (d < 0.6 || d > 1) continue;
      const k = 1 - (d - 0.6) / 0.4;
      ctx.beginPath();
      ctx.arc(x, y, step * 0.55 * Math.sqrt(k), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

/** A strip of torn tape, for the menu's selected item. */
export function tape(w: number, h: number, color: string, seed: number): HTMLCanvasElement {
  const [c, ctx] = mk(w, h);
  const rnd = seeded(seed);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(10, 4);
  for (let x = 10; x <= w - 10; x += 14) ctx.lineTo(x, 3 + rnd() * 5);
  for (let y = 4; y <= h - 4; y += 6) ctx.lineTo(w - 4 - rnd() * 12, y);
  for (let x = w - 10; x >= 10; x -= 14) ctx.lineTo(x, h - 3 - rnd() * 5);
  for (let y = h - 4; y >= 4; y -= 6) ctx.lineTo(4 + rnd() * 12, y);
  ctx.fill();
  grit(c, rnd, 'rgba(60, 8, 20, 0.35)', 'rgba(255, 220, 180, 0.25)');
  ctx.strokeStyle = 'rgba(60, 8, 20, 0.3)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const x = 40 + rnd() * (w - 80);
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x + 8 - rnd() * 16, h - 4);
    ctx.stroke();
  }
  return c;
}

/** A headlight beam in halftone: dots that shrink away from the lamp. */
export function halftoneBeam(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = mk(w, h);
  const step = 12;
  ctx.fillStyle = BONE;
  for (let x = 0; x < w; x += step) {
    const spread = 12 + (x / w) * (h / 2 - 12);
    const k = 1 - x / w;
    for (let y = h / 2 - spread; y <= h / 2 + spread; y += step) {
      const edge = 1 - Math.abs(y - h / 2) / spread;
      const r = step * 0.5 * Math.sqrt(k) * Math.min(1, edge * 2.2);
      if (r < 0.5) continue;
      ctx.beginPath();
      ctx.arc(x + (Math.round(y / step) % 2 ? step / 2 : 0), y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}
