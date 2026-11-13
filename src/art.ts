import { C, Pen, mix, type Pt } from './ink';
import { FEATURES, type Feature } from './terrain';

/** Room around every drawing for the ink line, which strays outside the shape. */
export const PAD = 14;

export interface Art {
  key: string;
  svg: string;
  w: number;
  h: number;
  /** Softens the picture by this many pixels when it is loaded, for things far from the camera. */
  blur?: number;
}

/** The same picture, softened. Far scenery is blurred once here, so it costs nothing while playing. */
export function blurred(art: Art, px: number): Art {
  return { ...art, blur: px };
}

/** A small, bright shape. It sits over the real drawing of something shiny and glows. */
export function sparkArt(): Art {
  const p = new Pen('spark', 0, 0);
  p.plain = true;
  p.ellipse(30, 22, 18, 12, { fill: '#FFF6D2', stroke: null, raw: true, wobble: 0.4 });
  return { key: 'spark', svg: p.svg(60, 44), w: 60, h: 44 };
}

export interface ItemSpec {
  key: string;
  name: string;
  w: number;
  h: number;
  round?: boolean;
  density: number;
  friction: number;
  bounce?: number;
  /** How much the family cares about it. */
  hearts: number;
  /** How hard a knock it survives. Things without this never break. */
  fragile?: number;
  /** Pets have a face that changes with how the trip is going. */
  pet?: boolean;
  draw: (p: Pen, x: number, y: number, w: number, h: number, mood?: Mood) => void;
}

export type Mood = 'calm' | 'worried' | 'panic' | 'happy' | 'grumpy' | 'sleepy' | 'dizzy';
export const MOODS: Mood[] = ['calm', 'worried', 'panic', 'happy', 'grumpy', 'sleepy', 'dizzy'];

/** A little spiral, for dizzy eyes. */
function spiral(p: Pen, x: number, y: number, r: number) {
  const pts: Pt[] = [];
  for (let a = 0; a < Math.PI * 4; a += 0.4) pts.push([x + Math.cos(a) * r * (a / (Math.PI * 4)), y + Math.sin(a) * r * (a / (Math.PI * 4))]);
  p.line(pts, { width: 2.6, raw: true });
}

/** Eyes, brows and mouth, centred between the eyes. */
function face(p: Pen, cx: number, cy: number, mood: Mood, s = 1) {
  const gap = 15 * s;
  for (const side of [-1, 1]) {
    const x = cx + gap * side;
    if (mood === 'sleepy') {
      p.line([[x - 7 * s, cy], [x, cy + 3 * s], [x + 7 * s, cy]], { width: 3.5 });
    } else if (mood === 'dizzy') {
      spiral(p, x, cy, 8 * s);
    } else if (mood === 'panic') {
      p.ellipse(x, cy, 9 * s, 10 * s, { fill: C.cream, width: 3.5 });
      p.dot(x, cy + 1, 3 * s);
    } else if (mood === 'happy') {
      p.line([[x - 7 * s, cy + 3 * s], [x, cy - 5 * s], [x + 7 * s, cy + 3 * s]], { width: 4 });
    } else if (mood === 'grumpy') {
      p.dot(x, cy + 2 * s, 3.6 * s);
      p.line([[x - 9 * s * side, cy - 13 * s], [x + 7 * s * side, cy - 6 * s]], { width: 4, raw: true });
    } else {
      p.dot(x, cy, 4 * s);
      if (mood === 'worried') p.line([[x + 8 * s * side, cy - 9 * s], [x - 6 * s * side, cy - 15 * s]], { width: 3.5, raw: true });
    }
  }
  const my = cy + 17 * s;
  if (mood === 'calm') p.line([[cx - 6 * s, my], [cx + 6 * s, my]], { width: 3.5, raw: true });
  else if (mood === 'worried') p.line([[cx - 9 * s, my + 1], [cx - 3 * s, my - 3], [cx + 3 * s, my + 2], [cx + 9 * s, my - 1]], { width: 3.5 });
  else if (mood === 'panic') p.ellipse(cx, my + 3 * s, 7 * s, 9 * s, { fill: C.terracottaDark, width: 3.5 });
  else if (mood === 'happy') p.shape([[cx - 11 * s, my - 4 * s], [cx + 11 * s, my - 4 * s], [cx, my + 10 * s]], { fill: C.terracotta, width: 3.5 });
  else p.line([[cx - 9 * s, my + 4 * s], [cx, my - 2 * s], [cx + 9 * s, my + 4 * s]], { width: 3.5 });
}

/** How many redraws a boiling picture has, and how far the line strays between them. */
export const BOIL_FRAMES = 3;
const BOIL = 1.05;
let redraw = 0;
let stray = 0;

/** Every drawing starts here, so boiled() can ask for the same picture with a slightly different line. */
export function pen(asset: string): Pen {
  return new Pen(asset, redraw, stray);
}

/** A few redraws of one picture. Shown in turn, the line seems alive, as if drawn by hand each frame. */
export function boiled(make: () => Art): Art[] {
  const out: Art[] = [];
  stray = BOIL;
  for (redraw = 0; redraw < BOIL_FRAMES; redraw++) {
    const art = make();
    out.push({ ...art, key: `${art.key}#${redraw}` });
  }
  redraw = 0;
  stray = 0;
  return out;
}

const GLASS = '#BFE6EE';
/** Far-away things are drawn with a paler line, so they sit back. */
const FAR_LINE = '#8D74A8';
const TYRE = '#2E2638';

/**
 * Everything is sized from real-world measurements against the truck: its bed is 2.5 metres long
 * and 380 pixels, so a metre is 150 pixels. Very small things are kept at least 40 pixels so they
 * can still be picked up.
 */
export const PX_PER_M = 150;
const m = (metres: number) => Math.max(40, Math.round(metres * PX_PER_M));

/** A thin bright line along an edge that faces the light (top left). */
function shine(p: Pen, pts: Pt[], width = 3) {
  p.line(pts, { width, color: '#FFFFFF', opacity: 0.55 });
}

/** A cardboard box: flaps, parcel tape, a hand hole and a scribbled label. */
function box(p: Pen, x: number, y: number, w: number, h: number) {
  p.rect(x, y, w, h, { fill: C.wood, r: 5, shade: [{ pts: [[x + w * 0.7, y], [x + w, y], [x + w, y + h], [x + w * 0.76, y + h]], color: C.woodLine }] });
  p.line([[x + 3, y + h * 0.18], [x + w - 3, y + h * 0.18]], { width: 2.5, opacity: 0.45, raw: true });
  p.rect(x + w * 0.42, y + 2, w * 0.16, h * 0.5, { fill: '#F3DDB4', stroke: null, r: 2, opacity: 0.9 });
  p.rect(x + w * 0.38, y + h * 0.36, w * 0.24, h * 0.1, { fill: C.walnut, r: 4, width: 2 });
  p.rect(x + w * 0.1, y + h * 0.6, w * 0.3, h * 0.22, { fill: C.cream, r: 3, width: 2.5 });
  p.line([[x + w * 0.14, y + h * 0.68], [x + w * 0.34, y + h * 0.68]], { width: 2, raw: true });
  p.line([[x + w * 0.14, y + h * 0.75], [x + w * 0.27, y + h * 0.75]], { width: 2, raw: true });
  shine(p, [[x + 6, y + 4], [x + w * 0.35, y + 4]]);
}

/**
 * What each thing is worth, in points. Pets and heirlooms are worth the most;
 * plain boxes the least. Fragile things are worth a lot, which is the risk.
 */
export const VALUE: Record<string, number> = {
  cat: 250, clock: 220, bird: 200, fish: 160, fridge: 150, guitar: 140, sofa: 120, record: 120, washer: 110,
  tv: 90, armchair: 90, bookshelf: 80, rug: 70, suitcase: 70, mattress: 60, plant: 60, toolbox: 60,
  jam: 50, lamp: 50, box_m: 40, box_l: 30, chair: 30, box_s: 20,
};

/** A gold coin with a star, for points. */
export function coinArt(): Art {
  const p = new Pen('coin', 0, 0);
  p.plain = true;
  p.ellipse(30, 30, 22, 22, { fill: C.mustard, width: 4.5 });
  p.ellipse(30, 30, 15, 15, { stroke: C.dry, width: 3 });
  const star: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 ? 4.5 : 10;
    star.push([30 + Math.cos(a) * r, 30 + Math.sin(a) * r]);
  }
  p.shape(star, { fill: C.cream, raw: true, stroke: null });
  return { key: 'coin', svg: p.svg(60, 60), w: 60, h: 60 };
}

export const ITEMS: ItemSpec[] = [
  { key: 'box_s', name: 'Small box', w: m(0.45), h: m(0.4), density: 0.0012, friction: 0.8, hearts: 1, draw: box },
  { key: 'box_m', name: 'Box of books', w: m(0.6), h: m(0.45), density: 0.0022, friction: 0.8, hearts: 1, draw: box },
  { key: 'box_l', name: 'Big box', w: m(0.85), h: m(0.6), density: 0.0012, friction: 0.8, hearts: 1, draw: box },
  {
    key: 'sofa', name: 'Sofa', w: m(2.0), h: m(0.8), density: 0.0011, friction: 0.9, hearts: 2,
    draw(p, x, y, w, h) {
      const fabric = C.plum;
      const light = '#9A6A9C';
      p.rect(x + 22, y, w - 44, h * 0.66, { fill: fabric, r: 20, shade: [{ pts: [[x, y + h * 0.4], [x + w, y + h * 0.36], [x + w, y + h], [x, y + h]], color: '#663E6B' }] });
      for (let i = 0; i < 3; i++) p.line([[x + 40 + i * (w - 80) / 2, y + 14], [x + 40 + i * (w - 80) / 2, y + h * 0.4]], { width: 2.5, opacity: 0.4, raw: true });
      const seat = (sx: number) => p.rect(sx, y + h * 0.44, (w - 72) / 2 - 2, h * 0.3, { fill: light, r: 12, width: 4.5 });
      seat(x + 36);
      seat(x + w / 2 + 2);
      p.rect(x, y + h * 0.3, 42, h * 0.58, { fill: fabric, r: 18, shade: [{ pts: [[x + 24, y], [x + 50, y], [x + 50, y + h], [x + 24, y + h]], color: '#663E6B' }] });
      p.rect(x + w - 42, y + h * 0.3, 42, h * 0.58, { fill: fabric, r: 18 });
      p.rect(x + 12, y + h * 0.76, w - 24, h * 0.16, { fill: C.walnut, r: 6, width: 4.5 });
      for (const lx of [x + 28, x + w - 28]) p.shape([[lx - 6, y + h * 0.9], [lx + 6, y + h * 0.9], [lx + 3, y + h], [lx - 3, y + h]], { fill: C.woodDark, raw: true, width: 3.5 });
      p.rect(x + w * 0.62, y + h * 0.18, w * 0.16, h * 0.3, { fill: C.mustard, r: 10, width: 4 });
      shine(p, [[x + 40, y + 8], [x + w * 0.45, y + 6]]);
    },
  },
  {
    key: 'armchair', name: 'Armchair', w: m(0.85), h: m(0.9), density: 0.0012, friction: 0.9, hearts: 2,
    draw(p, x, y, w, h) {
      p.shape([[x + 16, y + h * 0.62], [x + 14, y + 18], [x + w * 0.5, y + 2], [x + w - 14, y + 18], [x + w - 16, y + h * 0.62]], { fill: C.teal, width: 5.5, shade: [{ pts: [[x + w * 0.6, y], [x + w, y], [x + w, y + h], [x + w * 0.66, y + h]], color: '#2C7F8C' }] });
      for (const [bx, by] of [[0.32, 0.25], [0.68, 0.25], [0.5, 0.42]]) p.dot(x + w * bx, y + h * by, 3.5, '#1F6470');
      p.rect(x + 18, y + h * 0.55, w - 36, h * 0.22, { fill: '#7DCBD4', r: 10, width: 4.5 });
      p.rect(x, y + h * 0.42, 26, h * 0.42, { fill: C.teal, r: 12, width: 5 });
      p.rect(x + w - 26, y + h * 0.42, 26, h * 0.42, { fill: C.teal, r: 12, width: 5 });
      p.rect(x + 10, y + h * 0.8, w - 20, h * 0.1, { fill: '#2C7F8C', r: 4, width: 4 });
      for (const lx of [x + 18, x + w - 18]) p.line([[lx, y + h * 0.9], [lx + (lx < x + w / 2 ? -4 : 4), y + h]], { width: 6 });
      shine(p, [[x + w * 0.24, y + 16], [x + w * 0.48, y + 8]]);
    },
  },
  {
    key: 'fridge', name: 'Fridge', w: m(0.7), h: m(1.7), density: 0.0022, friction: 0.7, hearts: 2,
    draw(p, x, y, w, h) {
      p.rect(x, y, w, h, { fill: '#E9F3F1', r: 16, shade: [{ pts: [[x + w * 0.74, y], [x + w, y], [x + w, y + h], [x + w * 0.8, y + h]], color: '#BFD6D6' }] });
      p.line([[x + 3, y + h * 0.36], [x + w - 3, y + h * 0.36]], { width: 4 });
      p.rect(x + 12, y + h * 0.1, 8, h * 0.18, { fill: '#B9BCCB', r: 4, width: 3 });
      p.rect(x + 12, y + h * 0.42, 8, h * 0.22, { fill: '#B9BCCB', r: 4, width: 3 });
      p.rect(x + w * 0.46, y + h * 0.08, 26, 20, { fill: C.sticky, width: 2.5, r: 2 });
      p.dot(x + w * 0.46 + 13, y + h * 0.08 + 3, 3.5, C.terracotta);
      p.ellipse(x + w * 0.6, y + h * 0.5, 9, 9, { fill: C.mustard, width: 2.5 });
      p.rect(x + w * 0.32, y + h * 0.58, 24, 30, { fill: '#FFFFFF', width: 2.5, r: 2 });
      p.line([[x + w * 0.32 + 5, y + h * 0.58 + 10], [x + w * 0.32 + 19, y + h * 0.58 + 10]], { width: 1.8, raw: true });
      p.rect(x + 6, y + h - 10, w - 12, 8, { fill: '#B9BCCB', stroke: null, r: 2 });
      shine(p, [[x + 8, y + 10], [x + 8, y + h * 0.3]], 4);
    },
  },
  {
    key: 'washer', name: 'Washing machine', w: m(0.6), h: m(0.85), density: 0.003, friction: 0.7, hearts: 1,
    draw(p, x, y, w, h) {
      p.rect(x, y, w, h, { fill: '#F4F6F8', r: 10, shade: [{ pts: [[x + w * 0.74, y], [x + w, y], [x + w, y + h], [x + w * 0.82, y + h]], color: '#C7CCD8' }] });
      p.line([[x + 3, y + h * 0.2], [x + w - 3, y + h * 0.2]], { width: 3.5 });
      p.dot(x + 14, y + h * 0.1, 4.5, C.terracotta);
      p.ellipse(x + w * 0.62, y + h * 0.1, 8, 8, { fill: '#B9BCCB', width: 2.5 });
      p.ellipse(x + w / 2, y + h * 0.6, w * 0.32, w * 0.32, { fill: '#B9BCCB', width: 5 });
      p.ellipse(x + w / 2, y + h * 0.6, w * 0.23, w * 0.23, { fill: GLASS, width: 3, shade: [{ pts: [[x, y + h * 0.62], [x + w, y + h * 0.58], [x + w, y + h], [x, y + h]], color: C.sky }] });
      p.line([[x + w * 0.4, y + h * 0.52], [x + w * 0.5, y + h * 0.48]], { width: 3, color: '#FFFFFF', opacity: 0.8 });
    },
  },
  {
    key: 'tv', name: 'Old TV', w: m(0.62), h: m(0.55), density: 0.0016, friction: 0.7, hearts: 2, fragile: 12,
    draw(p, x, y, w, h) {
      p.line([[x + w * 0.42, y + 8], [x + w * 0.28, y - 2]], { width: 3, raw: true });
      p.line([[x + w * 0.58, y + 8], [x + w * 0.74, y - 4]], { width: 3, raw: true });
      p.rect(x, y + 6, w, h - 16, { fill: C.woodDark, r: 12, shade: [{ pts: [[x + w * 0.76, y], [x + w, y], [x + w, y + h], [x + w * 0.8, y + h]], color: C.walnut }] });
      p.rect(x + 8, y + 14, w * 0.66, h - 34, { fill: '#46507A', r: 14, width: 4.5, shade: [{ pts: [[x, y + 10], [x + w * 0.4, y + 10], [x, y + h * 0.5]], color: '#6E7BAE' }] });
      p.dot(x + w * 0.86, y + h * 0.3, 4.5, C.mustard);
      p.dot(x + w * 0.86, y + h * 0.5, 4.5, C.cream);
      for (const lx of [x + 12, x + w - 12]) p.line([[lx, y + h - 10], [lx + (lx < x + w / 2 ? -4 : 4), y + h]], { width: 5 });
    },
  },
  {
    key: 'bookshelf', name: 'Bookshelf', w: m(0.8), h: m(1.6), density: 0.0018, friction: 0.8, hearts: 2,
    draw(p, x, y, w, h) {
      p.rect(x, y, w, h, { fill: C.woodDark, r: 6, shade: [{ pts: [[x + w * 0.84, y], [x + w, y], [x + w, y + h], [x + w * 0.88, y + h]], color: C.walnut }] });
      const shelves = 4;
      const colours = [C.terracotta, C.teal, C.mustard, C.plum, C.sage, C.pink, C.dusk];
      for (let s = 0; s < shelves; s++) {
        const top = y + 10 + s * ((h - 20) / shelves);
        const bottom = top + (h - 20) / shelves - 8;
        p.rect(x + 8, top, w - 16, bottom - top, { fill: '#5B3A4E', stroke: null, r: 2 });
        let bx = x + 12;
        let i = s * 3;
        while (bx < x + w - 20) {
          const bw = 7 + ((i * 7) % 6);
          const bh = (bottom - top) * (0.7 + ((i * 13) % 25) / 100);
          p.rect(bx, bottom - bh, bw, bh, { fill: colours[i % colours.length], r: 1.5, width: 2 });
          bx += bw + 2;
          i++;
        }
        p.line([[x + 4, bottom + 2], [x + w - 4, bottom + 2]], { width: 5, raw: true });
      }
      shine(p, [[x + 4, y + 6], [x + 4, y + h * 0.4]]);
    },
  },
  {
    key: 'mattress', name: 'Mattress', w: m(1.9), h: m(0.25), density: 0.0006, friction: 0.9, bounce: 0.25, hearts: 1,
    draw(p, x, y, w, h) {
      p.rect(x, y, w, h, { fill: '#F7E7F0', r: 14, shade: [{ pts: [[x, y + h * 0.65], [x + w, y + h * 0.6], [x + w, y + h], [x, y + h]], color: '#E4C6D8' }] });
      for (let i = 1; i < 9; i++) p.dot(x + (w / 9) * i, y + h / 2, 2.5, C.lavender);
      p.line([[x + 6, y + h * 0.3], [x + w - 6, y + h * 0.3]], { width: 2, color: C.pink, raw: true });
    },
  },
  {
    key: 'rug', name: 'Rolled rug', w: m(1.9), h: m(0.3), density: 0.0009, friction: 0.9, hearts: 1,
    draw(p, x, y, w, h) {
      p.rect(x, y, w, h, { fill: C.terracotta, r: h / 2, shade: [{ pts: [[x, y + h * 0.6], [x + w, y + h * 0.6], [x + w, y + h], [x, y + h]], color: C.terracottaDark }] });
      for (let i = 1; i < 7; i++) p.line([[x + (w / 7) * i, y + 3], [x + (w / 7) * i + 6, y + h - 3]], { width: 3, color: C.mustard, raw: true });
      p.ellipse(x + w - h / 2, y + h / 2, h / 2 - 3, h / 2 - 3, { fill: C.mustard, width: 3 });
      p.ellipse(x + w - h / 2, y + h / 2, h / 4, h / 4, { stroke: C.terracottaDark, width: 2.5 });
      for (let i = 0; i < 4; i++) p.line([[x - 4, y + 6 + i * (h - 12) / 3], [x + 4, y + 6 + i * (h - 12) / 3]], { width: 2.5, raw: true });
    },
  },
  {
    key: 'plant', name: 'Monstera', w: m(0.6), h: m(1.0), density: 0.0009, friction: 0.8, hearts: 2, fragile: 13,
    draw(p, x, y, w, h) {
      const cx = x + w / 2;
      const leaf = (a: number, len: number, fill: string) => {
        const tx = cx + Math.cos(a) * len;
        const ty = y + h * 0.56 + Math.sin(a) * len;
        const nx = Math.cos(a + Math.PI / 2) * len * 0.32;
        const ny = Math.sin(a + Math.PI / 2) * len * 0.32;
        const mx = (cx + tx) / 2;
        const my = (y + h * 0.56 + ty) / 2;
        p.shape([[cx, y + h * 0.58], [mx + nx, my + ny], [tx, ty], [mx - nx, my - ny]], { fill, width: 4 });
        p.line([[cx, y + h * 0.58], [tx, ty]], { width: 2, color: C.moss, opacity: 0.7 });
        // The splits monstera leaves are known for.
        p.line([[mx + nx * 0.6, my + ny * 0.6], [mx + nx * 0.2, my + ny * 0.2]], { width: 3, color: '#FFF2DA', opacity: 0.8 });
      };
      leaf(-Math.PI * 0.84, h * 0.4, C.sageDark);
      leaf(-Math.PI * 0.18, h * 0.42, C.sageDark);
      leaf(-Math.PI * 0.64, h * 0.52, C.sage);
      leaf(-Math.PI * 0.38, h * 0.54, C.sage);
      leaf(-Math.PI * 0.5, h * 0.46, '#7FC48E');
      p.shape([[x + 8, y + h * 0.6], [x + w - 8, y + h * 0.6], [x + w - 18, y + h], [x + 18, y + h]], { fill: C.terracotta, raw: true, shade: [{ pts: [[x + w * 0.62, y + h * 0.5], [x + w, y + h * 0.5], [x + w, y + h], [x + w * 0.7, y + h]], color: C.terracottaDark }] });
      p.rect(x + 4, y + h * 0.56, w - 8, 14, { fill: C.terracotta, r: 5, width: 4.5 });
      p.line([[x + 22, y + h * 0.8], [x + w - 22, y + h * 0.8]], { width: 3, color: C.cream, raw: true });
    },
  },
  {
    key: 'fish', name: 'Goldie the fish', w: m(0.34), h: m(0.34), round: true, density: 0.0016, friction: 0.5, bounce: 0.15, hearts: 3, fragile: 10,
    draw(p, x, y, w) {
      const r = w / 2;
      const cx = x + r;
      const cy = y + r;
      p.ellipse(cx, cy, r, r, { fill: GLASS, width: 3.5, shade: [{ pts: [[x, cy - r * 0.15], [x + w, cy - r * 0.25], [x + w, y + w], [x, y + w]], color: C.sky }] });
      p.shape([[cx - r * 0.4, cy + r * 0.3], [cx + r * 0.1, cy + r * 0.05], [cx + r * 0.5, cy + r * 0.3], [cx + r * 0.1, cy + r * 0.6]], { fill: C.mustard, width: 2.5 });
      p.shape([[cx - r * 0.4, cy + r * 0.3], [cx - r * 0.75, cy + r * 0.05], [cx - r * 0.7, cy + r * 0.6]], { fill: C.terracotta, width: 2.5, raw: true });
      p.dot(cx + r * 0.25, cy + r * 0.25, 2);
      p.line([[cx - r * 0.55, cy - r * 0.5], [cx - r * 0.25, cy - r * 0.72]], { width: 3, color: '#FFFFFF' });
      p.rect(cx - r * 0.55, y - 1, r * 1.1, 6, { fill: GLASS, r: 3, width: 2.5 });
    },
  },
  {
    key: 'jam', name: 'Homemade jam', w: m(0.12), h: m(0.16) + 12, density: 0.0018, friction: 0.6, hearts: 3, fragile: 11,
    draw(p, x, y, w, h) {
      p.rect(x + 2, y + 12, w - 4, h - 12, { fill: GLASS, r: 9, width: 3.5, shade: [{ pts: [[x, y + h * 0.36], [x + w, y + h * 0.32], [x + w, y + h], [x, y + h]], color: '#C9405E' }] });
      p.rect(x + 6, y + h * 0.5, w - 12, h * 0.22, { fill: C.cream, r: 2, width: 2 });
      p.rect(x + 5, y, w - 10, 14, { fill: '#F0F0F0', r: 3, width: 3, shade: [{ pts: [[x, y], [x + w, y], [x + w, y + 7], [x, y + 7]], color: C.terracotta }] });
      shine(p, [[x + 8, y + 18], [x + 8, y + h * 0.42]], 2.5);
    },
  },
  {
    key: 'suitcase', name: 'Suitcase', w: m(0.7), h: m(0.45), density: 0.0024, friction: 0.6, hearts: 1,
    draw(p, x, y, w, h) {
      p.rect(x + w * 0.36, y - 2, w * 0.28, 12, { fill: C.walnut, r: 5, width: 3.5 });
      p.rect(x, y + 8, w, h - 8, { fill: C.dusk, r: 9, shade: [{ pts: [[x, y + h * 0.72], [x + w, y + h * 0.66], [x + w, y + h], [x, y + h]], color: '#2E2F5E' }] });
      for (const sx of [x + w * 0.26, x + w * 0.74]) p.rect(sx - 4, y + 9, 8, h - 10, { fill: C.woodDark, r: 2, width: 2.5 });
      p.rect(x + w * 0.4, y + h * 0.42, w * 0.2, h * 0.22, { fill: C.sticky, r: 2, width: 2.5 });
      p.ellipse(x + w * 0.12, y + h * 0.4, 7, 7, { fill: C.pink, width: 2.5 });
      p.ellipse(x + w * 0.9, y + h * 0.65, 6, 6, { fill: C.mustard, width: 2.5 });
      shine(p, [[x + 8, y + 13], [x + w * 0.2, y + 13]]);
    },
  },
  {
    key: 'toolbox', name: 'Toolbox', w: m(0.5), h: m(0.28), density: 0.004, friction: 0.8, hearts: 1,
    draw(p, x, y, w, h) {
      p.rect(x + w * 0.3, y, w * 0.4, 10, { stroke: C.ink, width: 4, r: 4 });
      p.rect(x, y + 8, w, h - 8, { fill: C.terracotta, r: 4, shade: [{ pts: [[x, y + h * 0.7], [x + w, y + h * 0.66], [x + w, y + h], [x, y + h]], color: C.terracottaDark }] });
      p.line([[x + 3, y + h * 0.42], [x + w - 3, y + h * 0.42]], { width: 2.5, raw: true });
      p.rect(x + w * 0.44, y + h * 0.36, w * 0.12, 6, { fill: '#B9BCCB', r: 2, width: 2 });
      p.line([[x + w * 0.66, y + 6], [x + w * 0.82, y - 8]], { width: 4, color: '#B9BCCB' });
    },
  },
  {
    key: 'record', name: 'Record player', w: m(0.48), h: m(0.3), density: 0.0014, friction: 0.7, hearts: 2, fragile: 11,
    draw(p, x, y, w, h) {
      p.rect(x, y + h * 0.3, w, h * 0.7, { fill: C.mustard, r: 6, shade: [{ pts: [[x, y + h * 0.8], [x + w, y + h * 0.75], [x + w, y + h], [x, y + h]], color: C.dry }] });
      p.ellipse(x + w * 0.42, y + h * 0.3, w * 0.34, h * 0.14, { fill: C.ink, width: 2.5 });
      p.ellipse(x + w * 0.42, y + h * 0.3, w * 0.1, h * 0.05, { fill: C.terracotta, stroke: null });
      p.line([[x + w * 0.86, y + h * 0.2], [x + w * 0.62, y + h * 0.3]], { width: 3, color: '#B9BCCB' });
      p.dot(x + w * 0.14, y + h * 0.72, 3.5, C.cream);
      p.dot(x + w * 0.28, y + h * 0.72, 3.5, C.cream);
    },
  },
  {
    key: 'guitar', name: 'Guitar', w: m(0.38), h: m(1.0), density: 0.0008, friction: 0.7, hearts: 3, fragile: 12,
    draw(p, x, y, w, h) {
      const cx = x + w / 2;
      p.rect(cx - 6, y + 8, 12, h * 0.48, { fill: C.walnut, r: 3, width: 3.5 });
      p.rect(cx - 9, y, 18, 18, { fill: C.walnut, r: 4, width: 3.5 });
      for (const py of [y + 4, y + 11]) for (const s of [-1, 1]) p.dot(cx + s * 11, py, 2.5, '#B9BCCB');
      const bodyPts: Pt[] = [[cx, y + h * 0.48], [cx + w * 0.38, y + h * 0.52], [cx + w * 0.3, y + h * 0.66], [cx + w * 0.5, y + h * 0.84], [cx, y + h], [cx - w * 0.5, y + h * 0.84], [cx - w * 0.3, y + h * 0.66], [cx - w * 0.38, y + h * 0.52]];
      p.shape(bodyPts, { fill: C.wood, width: 4.5, shade: [{ pts: [[cx + 4, y + h * 0.4], [x + w + 10, y + h * 0.4], [x + w + 10, y + h + 10], [cx + 8, y + h + 10]], color: C.woodLine }] });
      p.ellipse(cx, y + h * 0.72, w * 0.16, w * 0.16, { fill: C.ink, width: 2.5 });
      p.rect(cx - w * 0.18, y + h * 0.86, w * 0.36, 6, { fill: C.walnut, r: 2, width: 2 });
      for (const s of [-3, 0, 3]) p.line([[cx + s, y + 14], [cx + s, y + h * 0.88]], { width: 1, color: '#E8E8E8', raw: true });
    },
  },
  {
    key: 'clock', name: 'Grandfather clock', w: m(0.5), h: m(1.9), density: 0.0016, friction: 0.7, hearts: 3, fragile: 14,
    draw(p, x, y, w, h) {
      p.shape([[x, y + 30], [x + w * 0.2, y + 6], [x + w / 2, y], [x + w * 0.8, y + 6], [x + w, y + 30], [x + w, y + h], [x, y + h]], { fill: C.walnut, raw: true, width: 5, shade: [{ pts: [[x + w * 0.76, y], [x + w + 4, y], [x + w + 4, y + h], [x + w * 0.8, y + h]], color: '#41283A' }] });
      p.ellipse(x + w / 2, y + 48, w * 0.34, w * 0.34, { fill: C.cream, width: 4 });
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        p.dot(x + w / 2 + Math.cos(a) * w * 0.26, y + 48 + Math.sin(a) * w * 0.26, 1.6);
      }
      p.line([[x + w / 2, y + 48], [x + w / 2, y + 36]], { width: 2.5, raw: true });
      p.line([[x + w / 2, y + 48], [x + w / 2 + 9, y + 50]], { width: 2.5, raw: true });
      p.rect(x + w * 0.2, y + h * 0.3, w * 0.6, h * 0.48, { fill: '#3B2534', r: 6, width: 4 });
      p.line([[x + w / 2, y + h * 0.32], [x + w / 2 + 4, y + h * 0.66]], { width: 2.5, color: C.mustard, raw: true });
      p.ellipse(x + w / 2 + 4, y + h * 0.68, 10, 10, { fill: C.mustard, width: 3 });
      p.rect(x - 4, y + h - 16, w + 8, 16, { fill: C.walnut, r: 3, width: 4 });
      shine(p, [[x + 6, y + 34], [x + 6, y + h * 0.4]]);
    },
  },
  {
    key: 'chair', name: 'Kitchen chair', w: m(0.45), h: m(0.9), density: 0.0012, friction: 0.8, hearts: 1,
    draw(p, x, y, w, h) {
      p.rect(x + 4, y, 10, h * 0.55, { fill: C.sky, r: 3, width: 3.5 });
      for (const ry of [y + 10, y + h * 0.22, y + h * 0.34]) p.rect(x + 4, ry, w * 0.5, 8, { fill: C.sky, r: 3, width: 3 });
      p.rect(x, y + h * 0.5, w, 14, { fill: C.sky, r: 4, width: 4, shade: [{ pts: [[x, y + h * 0.5 + 8], [x + w, y + h * 0.5 + 8], [x + w, y + h], [x, y + h]], color: '#3E8FB0' }] });
      for (const lx of [x + 6, x + w - 8]) p.line([[lx, y + h * 0.5 + 12], [lx + (lx < x + w / 2 ? -2 : 2), y + h]], { width: 6, color: C.ink });
      p.line([[x + 8, y + h * 0.8], [x + w - 8, y + h * 0.8]], { width: 3.5, raw: true });
    },
  },
  {
    key: 'lamp', name: 'Floor lamp', w: m(0.45), h: m(1.6), density: 0.0008, friction: 0.7, hearts: 1, fragile: 13,
    draw(p, x, y, w, h) {
      const cx = x + w / 2;
      p.line([[cx, y + 64], [cx, y + h - 12]], { width: 7, raw: true });
      p.line([[cx - 2, y + 70], [cx - 2, y + h - 16]], { width: 2, color: '#B9BCCB', raw: true });
      p.rect(x + 6, y + h - 14, w - 12, 14, { fill: C.walnut, r: 6, width: 4.5 });
      p.shape([[x + 14, y], [x + w - 14, y], [x + w, y + 66], [x, y + 66]], { fill: C.sticky, raw: true, shade: [{ pts: [[cx + 6, y], [x + w, y], [x + w, y + 66], [cx + 14, y + 66]], color: C.mustard }] });
      p.line([[x + 4, y + 62], [x + w - 4, y + 62]], { width: 3, color: C.terracotta, raw: true });
    },
  },
  {
    key: 'cat', name: 'Biscuit the cat', w: m(0.56), h: m(0.56), density: 0.0008, friction: 0.8, hearts: 3, pet: true,
    /**
     * A big, deadpan ginger cat sitting like a sack of flour: a wide flat head with fur tufts at the cheeks,
     * huge half-lidded eyes giving you the side-eye, a tiny nose, and a tail flicking out behind.
     */
    draw(p, x, y, w, h, mood = 'calm') {
      const GINGER = '#F09A35';
      const DEEP = '#D27A22';
      const STRIPE = '#B8621A';
      const CREAMY = '#FFF0D8';
      const EYE = '#D8E35A';
      const cx = x + w * 0.5;
      const headY = y + h * 0.34;
      const panic = mood === 'panic';
      // A tufted outline: an ellipse with sharp licks of fur where the spikes say.
      const fluffy = (ox: number, oy: number, rx: number, ry: number, tuft: (a: number) => number): Pt[] => {
        const pts: Pt[] = [];
        for (let i = 0; i < 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          const k = 1 + tuft(a) * (i % 2 ? 0.16 : -0.02);
          pts.push([ox + Math.cos(a) * rx * k, oy + Math.sin(a) * ry * k]);
        }
        return pts;
      };
      const cheeks = (a: number) => Math.max(0, Math.abs(Math.cos(a)) - 0.55) * (Math.sin(a) > -0.2 ? 2.4 : 0.6);
      // Tail, flicking up behind the body.
      const tail: Pt[] = [[x + w * 0.78, y + h * 0.9], [x + w - 4, y + h * 0.8], [x + w - 2, y + h * 0.56], [x + w - 10, y + h * 0.46]];
      p.line(tail, { width: 15, color: mix(GINGER, C.ink, 0.74) });
      p.line(tail, { width: 10, color: GINGER });
      p.line([[x + w - 3, y + h * 0.62], [x + w - 13, y + h * 0.6]], { width: 3, color: STRIPE, raw: true });
      p.line([[x + w - 2, y + h * 0.72], [x + w - 12, y + h * 0.74]], { width: 3, color: STRIPE, raw: true });
      // Body: a sack, wider at the bottom, the fur bristling all over when it panics.
      const body: Pt[] = panic
        ? fluffy(cx, y + h * 0.72, w * 0.4, h * 0.3, () => 1.4)
        : [[x + 8, y + h - 3], [x + 6, y + h * 0.78], [x + w * 0.2, y + h * 0.5], [x + w * 0.8, y + h * 0.5], [x + w - 8, y + h * 0.78], [x + w - 10, y + h - 3]];
      p.shape(body, { fill: GINGER, width: 4, raw: panic, shade: [{ pts: [[x, y + h * 0.84], [x + w, y + h * 0.8], [x + w, y + h], [x, y + h]], color: DEEP }] });
      for (const sx of [0.14, 0.24, 0.76, 0.86]) p.line([[x + w * sx, y + h * 0.66], [x + w * (sx + (sx < 0.5 ? 0.05 : -0.05)), y + h * 0.78]], { width: 2.6, color: STRIPE, opacity: 0.85 });
      // Chest bib, with a lick of fur.
      p.shape([[cx - w * 0.15, y + h * 0.58], [cx, y + h * 0.95], [cx + w * 0.15, y + h * 0.58]], { fill: CREAMY, stroke: null });
      // Little white front paws, side by side, very proper.
      for (const px of [cx - 8, cx + 8]) {
        p.ellipse(px, y + h - 6, 7.5, 5.5, { fill: CREAMY, width: 2.8 });
        p.line([[px - 2, y + h - 9], [px - 2, y + h - 4]], { width: 1.4, raw: true, color: '#C9A88A' });
        p.line([[px + 2, y + h - 9], [px + 2, y + h - 4]], { width: 1.4, raw: true, color: '#C9A88A' });
      }
      // Ears: small, set wide on the big flat head; flat back when it is cross or scared.
      // Ears say it first: flat back when cross or scared, out sideways when worried or dizzy, droopy when
      // sleepy, and up tall when happy.
      const flat = mood === 'grumpy' || panic;
      const sideways = mood === 'worried' || mood === 'dizzy';
      for (const s of [-1, 1]) {
        const ex = cx + s * w * 0.25;
        const tip: Pt = flat ? [ex + s * 18, y + h * 0.16] : sideways ? [ex + s * 22, headY - h * 0.16] : mood === 'sleepy' ? [ex + s * 12, y + h * 0.08] : mood === 'happy' ? [ex + s * 2, y - 3] : [ex + s * 4, y + 1];
        p.shape([[ex - s * 11, headY - h * 0.2], tip, [ex + s * 12, headY - h * 0.08]], { fill: GINGER, raw: true, width: 3.6 });
        p.shape([[ex - s * 5, headY - h * 0.18], [tip[0] - s * 2, tip[1] + 6], [ex + s * 7, headY - h * 0.1]], { fill: '#F29AA2', raw: true, stroke: null });
      }
      // Head: wide and flat, with tufts at the cheeks.
      const hrx = w * 0.4;
      const hry = h * 0.26;
      p.shape(fluffy(cx, headY, hrx, hry, panic ? () => 1.6 : cheeks), { fill: GINGER, width: 4, raw: true, shade: [{ pts: [[cx - w, headY + hry * 0.4], [cx + w, headY + hry * 0.3], [cx + w, headY + h], [cx - w, headY + h]], color: '#E28A2C' }] });
      // Tabby M on the forehead.
      p.line([[cx - 9, headY - hry * 0.45], [cx - 5, headY - hry * 0.78], [cx, headY - hry * 0.5], [cx + 5, headY - hry * 0.78], [cx + 9, headY - hry * 0.45]], { width: 2.4, color: STRIPE, raw: true });
      for (const sd of [-1, 1]) p.line([[cx + sd * hrx * 0.98, headY + 2], [cx + sd * hrx * 0.72, headY + 1]], { width: 2.4, color: STRIPE, raw: true });
      // Muzzle.
      p.ellipse(cx, headY + hry * 0.5, w * 0.13, hry * 0.36, { fill: CREAMY, stroke: null });
      // Eyes: big, and for most of the day, deeply unimpressed.
      const eyeY = headY - hry * 0.06;
      const er = panic ? 10 : 8.5;
      for (const s of [-1, 1]) {
        const ex = cx + s * w * 0.16;
        if (mood === 'happy') {
          // Delighted: eyes shut in happy arcs.
          p.line([[ex - 7, eyeY + 3], [ex, eyeY - 4], [ex + 7, eyeY + 3]], { width: 3.4 });
          continue;
        }
        if (mood === 'sleepy') {
          // Dozing: lids down, with lashes.
          p.line([[ex - 7, eyeY], [ex, eyeY + 4], [ex + 7, eyeY]], { width: 3.2 });
          for (const lx of [-4, 0, 4]) p.line([[ex + lx, eyeY + 3], [ex + lx * 1.3, eyeY + 6]], { width: 1.6, raw: true });
          continue;
        }
        if (mood === 'dizzy') {
          p.ellipse(ex, eyeY, er, er, { fill: '#FFFFFF', width: 2.6 });
          spiral(p, ex, eyeY, er * 0.85);
          continue;
        }
        p.ellipse(ex, eyeY, er, er, { fill: panic ? '#FFFFFF' : EYE, width: 2.6 });
        if (panic) {
          p.dot(ex + s * 1, eyeY, 2.2);
          continue;
        }
        // Pupils looking sideways at you: the side-eye.
        const look = mood === 'worried' ? 0 : 3.6;
        p.ellipse(ex + look, eyeY + 1, mood === 'worried' ? 4.2 : 2.6, mood === 'worried' ? 5 : 5.8, { fill: C.ink, stroke: null });
        p.dot(ex + look - 1.4, eyeY - 2.4, 1.3, '#FFFFFF');
        // Heavy lids: half shut when bored, lower and slanted when cross, high when worried.
        const lid = mood === 'grumpy' ? 0.15 : mood === 'worried' ? -0.55 : -0.05;
        const tilt = mood === 'grumpy' ? s * 3 : mood === 'worried' ? -s * 3 : 0;
        const ly = eyeY + lid * er;
        p.shape([[ex - er - 2, ly + tilt], [ex - er - 2, eyeY - er - 3], [ex + er + 2, eyeY - er - 3], [ex + er + 2, ly - tilt]], { fill: GINGER, raw: true, stroke: null });
        p.line([[ex - er - 1, ly + tilt], [ex + er + 1, ly - tilt]], { width: 3, raw: true });
      }
      // A tiny nose, a flat little mouth, and long whiskers.
      const ny = headY + hry * 0.36;
      p.shape([[cx - 3, ny], [cx + 3, ny], [cx, ny + 3]], { fill: '#E8768A', raw: true, width: 1.6 });
      if (panic) {
        // A yowl, fangs and all.
        p.ellipse(cx, ny + 10, 6, 8, { fill: C.terracottaDark, width: 2.4 });
        for (const fx of [-3, 3]) p.shape([[cx + fx - 1.6, ny + 4], [cx + fx + 1.6, ny + 4], [cx + fx, ny + 8]], { fill: '#FFFFFF', raw: true, stroke: null });
      } else if (mood === 'happy') p.line([[cx - 6, ny + 5], [cx - 3, ny + 7], [cx, ny + 4], [cx + 3, ny + 7], [cx + 6, ny + 5]], { width: 2.2 });
      else if (mood === 'worried') p.line([[cx - 5, ny + 8], [cx - 2, ny + 6], [cx + 1, ny + 8], [cx + 4, ny + 6]], { width: 2 });
      else if (mood === 'grumpy') p.line([[cx - 5, ny + 8], [cx, ny + 5], [cx + 5, ny + 8]], { width: 2.4 });
      else if (mood === 'dizzy') {
        p.line([[cx - 4, ny + 6], [cx + 4, ny + 6]], { width: 2, raw: true });
        p.ellipse(cx + 2, ny + 9, 3, 4, { fill: '#F27A8A', width: 1.8 });
      } else p.line([[cx - 4, ny + 6], [cx + 4, ny + 6.5]], { width: 2, raw: true });
      // Extras that sell the mood: blush and a heart, a bead of sweat, an angry vein, a snot bubble and
      // a z, a ring of stars.
      if (mood === 'happy') {
        for (const s of [-1, 1]) p.ellipse(cx + s * w * 0.24, ny + 2, 5, 3, { fill: '#F48C9A', stroke: null, opacity: 0.8 });
        const hx = cx + w * 0.3;
        const hy = y + 6;
        p.shape([[hx, hy + 6], [hx - 6, hy], [hx - 5, hy - 4], [hx - 1, hy - 4], [hx, hy - 1], [hx + 1, hy - 4], [hx + 5, hy - 4], [hx + 6, hy]], { fill: '#F2607A', raw: true, width: 1.8 });
      } else if (mood === 'worried') {
        p.shape([[cx + w * 0.34, headY - hry * 0.7], [cx + w * 0.38, headY - hry * 0.3], [cx + w * 0.34, headY - hry * 0.15], [cx + w * 0.3, headY - hry * 0.3]], { fill: '#BFEAF6', width: 1.8 });
      } else if (mood === 'grumpy') {
        const vx = cx + w * 0.3;
        const vy = headY - hry * 0.8;
        for (const [ax, ay, bx, by] of [[-5, -2, -1, -1], [5, -2, 1, -1], [-5, 4, -1, 2], [5, 4, 1, 2]] as const) p.line([[vx + ax, vy + ay], [vx + bx, vy + by]], { width: 2.4, color: '#D8403A', raw: true });
      } else if (mood === 'sleepy') {
        p.ellipse(cx + 7, ny + 4, 4, 4, { fill: '#DFF4FF', width: 1.6, opacity: 0.9 });
      } else if (mood === 'dizzy') {
        for (const [sx, sy] of [[-0.3, -0.05], [0, -0.12], [0.3, -0.05]] as const) {
          const px = cx + w * sx;
          const py = y + h * sy + 4;
          p.shape([[px, py - 5], [px + 1.6, py - 1.6], [px + 5, py], [px + 1.6, py + 1.6], [px, py + 5], [px - 1.6, py + 1.6], [px - 5, py], [px - 1.6, py - 1.6]], { fill: C.mustard, raw: true, width: 1.6 });
        }
      }
      for (const s of [-1, 1]) {
        for (const dy of [-2.5, 1, 4.5]) p.line([[cx + s * w * 0.12, ny + 3 + dy], [cx + s * w * 0.5, ny + dy * 2.4 - 1]], { width: 1, color: '#FFF4E0', raw: true, opacity: 0.95 });
      }
    },
  },
  {
    key: 'bird', name: 'Sunny the canary', w: m(0.35), h: m(0.5), density: 0.0007, friction: 0.7, hearts: 3, pet: true,
    draw(p, x, y, w, h, mood = 'calm') {
      const cx = x + w / 2;
      p.ellipse(cx, y + 6, 6, 6, { stroke: C.ink, width: 3 });
      p.shape([[x + 4, y + h - 10], [x + 4, y + 30], [cx, y + 10], [x + w - 4, y + 30], [x + w - 4, y + h - 10]], { fill: '#FFF4E6', width: 4, opacity: 0.35 });
      p.ellipse(cx, y + h * 0.58, w * 0.28, h * 0.22, { fill: C.sticky, width: 3.5, shade: [{ pts: [[cx, y + h * 0.6], [x + w, y + h * 0.6], [x + w, y + h], [cx, y + h]], color: C.mustard }] });
      p.shape([[cx + w * 0.25, y + h * 0.58], [cx + w * 0.38, y + h * 0.62], [cx + w * 0.25, y + h * 0.66]], { fill: C.terracotta, raw: true, width: 2.5 });
      face(p, cx + 2, y + h * 0.54, mood, 0.38);
      for (let i = 0; i < 6; i++) p.line([[x + 6 + i * (w - 12) / 5, y + 24 + (i === 0 || i === 5 ? 10 : 0)], [x + 6 + i * (w - 12) / 5, y + h - 10]], { width: 2.2, raw: true });
      p.line([[x + 8, y + h * 0.78], [x + w - 8, y + h * 0.78]], { width: 3, color: C.walnut, raw: true });
      p.rect(x, y + h - 12, w, 12, { fill: C.teal, r: 3, width: 3.5 });
    },
  },
];



/** A thing's picture. Pets get one for each mood, and fragile things get a broken one. */
export function itemArt(spec: ItemSpec, variant?: Mood | 'broken'): Art {
  const p = pen(spec.key);
  const { w, h } = spec;
  spec.draw(p, PAD, PAD, w, h, variant === 'broken' ? undefined : variant);
  if (variant === 'broken') {
    const X = (n: number) => PAD + w * n;
    const Y = (n: number) => PAD + h * n;
    p.line([[X(0.22), Y(0.14)], [X(0.46), Y(0.36)], [X(0.32), Y(0.56)], [X(0.6), Y(0.82)]], { width: 4.5, raw: true });
    p.line([[X(0.46), Y(0.36)], [X(0.76), Y(0.3)]], { width: 4, raw: true });
    p.line([[X(0.32), Y(0.56)], [X(0.16), Y(0.7)]], { width: 4, raw: true });
  }
  const key = variant ? spec.key + '_' + variant : spec.key;
  return { key, svg: p.svg(w + PAD * 2, h + PAD * 2), w: w + PAD * 2, h: h + PAD * 2 };
}

/** Every picture a thing needs. */
export function itemArts(spec: ItemSpec): Art[] {
  if (spec.pet) return MOODS.map((m) => itemArt(spec, m));
  return spec.fragile ? [itemArt(spec), itemArt(spec, 'broken')] : [itemArt(spec)];
}

export function puffArt(): Art {
  const p = pen('puff');
  p.plain = true;
  p.shape([[12, 44], [16, 24], [34, 12], [52, 20], [62, 38], [50, 54], [28, 56]], { fill: C.cream, stroke: null });
  return { key: 'puff', svg: p.svg(74, 68), w: 74, h: 68 };
}

/**
 * The truck, in its own coordinates: (0, 0) is the middle of the top of the bed floor.
 * The physics shapes in game.ts use the same numbers.
 */
export const TRUCK = {
  bed: { x: -190, w: 380, t: 24 },
  tailgate: { x: -190, w: 18, h: 70 },
  cab: { x: 190, w: 150, top: -150 },
  hood: { x: 340, w: 70, top: -62 },
  frame: { x: -186, w: 590, y: 24, h: 26 },
  // Lifted: bigger wheels, set lower under the body.
  wheels: [{ x: -96, y: 96 }, { x: 296, y: 96 }],
  wheelR: 54,
  /** Where (0, 0) sits inside the picture. */
  ox: 190 + PAD + 4,
  oy: 150 + PAD + 4 + 56,
  /** The truck picture's size. */
  w: 720,
  h: 316,
};

const CHROME = '#EEF0F2';
const CHROME_SHADE = '#B9BCCB';
const WELL = '#1E1830';

/** An arch over a wheel: the top half of a circle, drawn from its right edge round to its left. */
function archPts(cx: number, cy: number, r: number, from = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = -(i / 8) * Math.PI;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r + from]);
  }
  return out;
}

/**
 * The truck, as a heavily modified, home-built rig: whoever owns it has been bolting things on for years, and
 * a lot of it came out of the house they are now moving out of. A teal wedge of a body, lifted on big tyres;
 * a hot-rod blower bursting up through the bonnet; an ironing board for a sun visor; a primer-grey door that
 * came off another truck; a riveted rust patch; duct tape over a crack; a side pipe; bungee cords; a spare
 * tyre strapped to the roll bar; and on the roll bar's turret the anchor crossbow, its cable running down to
 * a drum in the bed. Lines are deliberately a little crooked. The shapes the physics uses keep their places.
 */
export function truckArt(front = false): Art {
  const t = TRUCK;
  const p = pen(front ? 'truck_front' : 'truck');
  const X = (n: number) => n + t.ox;
  const Y = (n: number) => n + t.oy;
  const P = (pts: Pt[]) => pts.map(([x, y]) => [X(x), Y(y)] as Pt);
  const BODY = C.teal;
  const SHADE = '#22707F';
  const HILITE = '#8CD8E0';
  const STEEL = '#3A3644';
  const STEEL_LIT = '#5A5668';
  const ACCENT = C.mustard;
  const MUD = '#7A5444';
  const PRIMER = '#A8A4B4';
  const RUST = '#C2643A';
  const TAPE = '#C9CCD6';
  const done = (key: string): Art => ({ key, svg: p.svg(t.w, t.h), w: t.w, h: t.h });
  const rivets = (pts: Pt[]) => {
    for (const [x, y] of pts) p.dot(X(x), Y(y), 2.4, '#2A2733');
  };

  if (front) {
    // The bed's side: diamond plate, a teal rail, and bolted over the back of it, a fridge door from the old
    // kitchen, magnets and all. The company name is painted on a board, crooked, by hand.
    p.shape(P([[-196, -48], [192, -50], [192, 28], [-196, 28]]), { fill: STEEL, raw: true, width: 6, wobble: 1.2, shade: [{ pts: [[X(-200), Y(8)], [X(200), Y(4)], [X(200), Y(40)], [X(-200), Y(40)]], color: '#2A2733' }] });
    for (let x = -186; x < 182; x += 16) {
      for (let y = -38, row = 0; y < 20; y += 12, row++) {
        const dx = row % 2 ? 8 : 0;
        p.line([[X(x + dx), Y(y)], [X(x + 5 + dx), Y(y + 4)]], { width: 2, color: STEEL_LIT, raw: true, opacity: 0.5 });
      }
    }
    p.shape(P([[-200, -58], [196, -60], [196, -46], [-200, -44]]), { fill: BODY, raw: true, width: 5, wobble: 1.2 });
    // The fridge door.
    p.shape(P([[-188, -40], [-104, -42], [-102, 22], [-186, 24]]), { fill: '#F2EEE2', raw: true, width: 4.5, wobble: 1.4, shade: [{ pts: [[X(-130), Y(-50)], [X(-96), Y(-50)], [X(-96), Y(30)], [X(-130), Y(30)]], color: '#D8D2C2' }] });
    p.rect(X(-120), Y(-30), 7, 40, { fill: CHROME, r: 3, width: 3 });
    for (const [mx, my, mc] of [[-170, -28, '#E8743E'], [-150, -6, '#3FA7B5'], [-176, 8, '#FFB23F'], [-140, 12, '#D8403A']] as const) p.ellipse(X(mx), Y(my), 6, 6, { fill: mc, width: 2.5 });
    rivets([[-184, -36], [-106, -38], [-184, 20], [-106, 18]]);
    // The name board, painted by hand.
    p.shape(P([[-84, -28], [118, -32], [120, 10], [-82, 14]]), { fill: C.cream, raw: true, width: 4, wobble: 1.6 });
    p.shape(P([[-78, -23], [113, -27], [115, 5], [-76, 9]]), { stroke: C.terracotta, raw: true, width: 1.6, wobble: 1.6 });
    // Hazard stripes on the tailgate's edge, and a tail light.
    for (let k = 0; k < 4; k++) p.shape(P([[-204, -44 + k * 18], [-196, -44 + k * 18], [-196, -36 + k * 18], [-204, -28 + k * 18]]), { fill: k % 2 ? '#2A2733' : ACCENT, raw: true, stroke: null });
    p.rect(X(-212), Y(-14), 12, 18, { fill: '#D8403A', r: 3, width: 3 });
    for (let i = 0; i < 14; i++) {
      const x = -186 + ((i * 53) % 370);
      const y = 22 - ((i * 7) % 12);
      p.ellipse(X(x), Y(y), 3 + ((i * 5) % 7), 2 + ((i * 3) % 4), { fill: MUD, stroke: null, opacity: 0.6, wobble: 1.2 });
    }
    return done('truck_front');
  }

  const over = (cx: number, r: number, y: number): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i / 16) * Math.PI;
      out.push([cx + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    return out;
  };
  const [rw, fw] = t.wheels;

  // The frame, a skid plate, and the exhaust: a side pipe running along under the doors.
  p.rect(X(-190), Y(24), 600, 28, { fill: '#2A2733', r: 6, width: 5 });
  p.rect(X(-216), Y(34), 40, 12, { fill: CHROME, r: 5, width: 4.5 });

  // The roll bar out of the bed's front corner, the spare tyre strapped to it, and the cable drum in its foot.
  p.ellipse(X(124), Y(-108), 30, 30, { fill: TYRE, width: 4.5 });
  p.ellipse(X(124), Y(-108), 16, 16, { fill: '#D8403A', width: 3.5 });
  p.dot(X(124), Y(-108), 4, CHROME);
  p.line(P([[96, -96], [154, -120]]), { width: 4, color: ACCENT });
  p.shape(P([[150, 2], [150, -150], [160, -172], [200, -180], [214, -170], [180, -164], [168, -150], [168, 2]]), { fill: STEEL, raw: true, width: 5, wobble: 1, shade: [{ pts: [[X(158), Y(-200)], [X(240), Y(-200)], [X(240), Y(10)], [X(158), Y(10)]], color: '#2A2733' }] });
  p.rect(X(118), Y(-62), 64, 50, { fill: '#2A2733', r: 8, width: 5 });
  p.ellipse(X(150), Y(-37), 22, 22, { fill: STEEL_LIT, width: 4 });
  for (let k = 0; k < 4; k++) p.ellipse(X(150), Y(-37), 18 - k * 4, 18 - k * 4, { stroke: '#B9BCCB', width: 1.8 });
  p.dot(X(150), Y(-37), 4, ACCENT);
  p.line(P([[160, -50], [166, -100], [170, -150], [184, -172]]), { width: 2.6, color: '#B9BCCB', opacity: 0.95 });
  p.rect(X(176), Y(-196), 40, 18, { fill: STEEL, r: 5, width: 4.5 });
  p.ellipse(X(196), Y(-198), 22, 7, { fill: ACCENT, width: 3.5 });

  // Fender flares over the wheels, bolted on.
  for (const w of [rw, fw]) {
    p.shape(P([...over(w.x, 74, w.y), [w.x + 74, w.y], [w.x - 74, w.y]]), { fill: '#2A2733', raw: true, width: 5, wobble: 1.2 });
    p.shape(P([...over(w.x, 62, w.y), [w.x + 62, w.y + 2], [w.x - 62, w.y + 2]]), { fill: WELL, raw: true, stroke: null, wobble: 0.4 });
    for (let k = 1; k < 8; k++) {
      const a = Math.PI + (k / 8) * Math.PI;
      p.dot(X(w.x + Math.cos(a) * 68), Y(w.y + Math.sin(a) * 68), 2.4, STEEL_LIT);
    }
  }

  // The body: a teal wedge, a little lumpy where it has been knocked about.
  const body: Pt[] = [
    [186, 30], [184, -122], [192, -152], [272, -160], [298, -152], [350, -80], [426, -64], [460, -44], [466, -8], [448, 30],
  ];
  p.shape(P(body), { fill: BODY, raw: true, width: 6.5, wobble: 1.4, shade: [{ pts: [[X(180), Y(-30)], [X(480), Y(-34)], [X(480), Y(40)], [X(180), Y(40)]], color: SHADE }] });
  p.shape(P([[184, -122], [192, -152], [272, -160], [298, -152], [306, -138], [210, -138], [198, -120]]), { fill: '#2A2733', raw: true, width: 4, wobble: 1 });
  // The door, from another truck altogether: primer grey, with its own rivets.
  p.shape(P([[210, -78], [338, -80], [338, 2], [210, 4]]), { fill: PRIMER, raw: true, width: 4.5, wobble: 1.6, shade: [{ pts: [[X(206), Y(-20)], [X(340), Y(-22)], [X(340), Y(8)], [X(206), Y(8)]], color: '#8E8A9C' }] });
  rivets([[216, -72], [332, -74], [216, -4], [332, -4], [274, -76]]);
  p.rect(X(300), Y(-60), 22, 8, { fill: '#2A2733', r: 3, width: 3 });
  // The side window, angled at the front. The driver sits in it as a sprite of their own.
  const win: Pt[] = [[214, -134], [290, -134], [334, -86], [214, -82]];
  p.shape(P(win), { fill: GLASS, raw: true, width: 5, wobble: 1 });
  p.shape(P([[214, -112], [226, -112], [226, -82], [214, -82]]), { fill: '#3A2E44', raw: true, stroke: null, opacity: 0.6 });
  // A rust patch riveted over a hole on the cab's back corner, and duct tape over a crack in the bonnet.
  p.shape(P([[188, -70], [206, -74], [208, -30], [190, -26]]), { fill: RUST, raw: true, width: 3.5, wobble: 1.8 });
  rivets([[192, -66], [204, -68], [192, -32], [204, -34]]);
  for (const [a, b] of [[[384, -70], [414, -56]], [[384, -56], [414, -70]]] as const) p.line(P([a as unknown as Pt, b as unknown as Pt]), { width: 7, color: TAPE, raw: true, wobble: 0.4 });
  // The accent stripe (it stops at the borrowed door), and the crease along the nose.
  p.shape(P([[340, -46], [460, -30], [462, -22], [340, -38]]), { fill: ACCENT, raw: true, stroke: null });
  p.shape(P([[188, -44], [208, -44], [208, -36], [190, -36]]), { fill: ACCENT, raw: true, stroke: null });
  // The blower, bursting up through the bonnet: chrome, ribbed, with its scoop and a belt.
  p.shape(P([[352, -86], [402, -88], [404, -66], [350, -64]]), { fill: CHROME, raw: true, width: 4.5, wobble: 0.8, shade: [{ pts: [[X(378), Y(-100)], [X(410), Y(-100)], [X(410), Y(-60)], [X(380), Y(-60)]], color: CHROME_SHADE }] });
  for (let k = 0; k < 4; k++) p.line(P([[358 + k * 12, -84], [358 + k * 12, -68]]), { width: 2, color: CHROME_SHADE, raw: true });
  // A tall scoop on top, breaking the silhouette, with the butterfly flaps showing.
  p.shape(P([[356, -86], [360, -128], [404, -132], [402, -88]]), { fill: '#2A2733', raw: true, width: 4.5, wobble: 0.8 });
  p.rect(X(366), Y(-126), 30, 12, { fill: '#14121A', r: 2, stroke: null });
  for (const fx of [372, 384]) p.line(P([[fx, -124], [fx + 6, -116]]), { width: 2.4, color: CHROME, raw: true });
  p.line(P([[358, -104], [403, -108]]), { width: 3, color: ACCENT, raw: true });
  p.line(P([[400, -70], [416, -40]]), { width: 3, color: '#2A2733' });
  // The ironing board, bolted over the windscreen as a sun visor, its legs folded under it.
  p.shape(P([[262, -170], [340, -160], [372, -150], [380, -142], [370, -136], [338, -140], [264, -152]]), { fill: '#F4F0E6', raw: true, width: 4.5, wobble: 1 });
  for (const [fx, fy] of [[282, -160], [302, -158], [322, -154], [342, -150], [360, -145], [292, -154], [332, -146]] as const) p.ellipse(X(fx), Y(fy), 4, 3, { fill: '#F48C9A', stroke: null });
  p.line(P([[290, -152], [300, -142], [320, -146]]), { width: 2.5, color: '#9AA0B5' });
  // The snorkel up the windscreen pillar, and the light bar on the roof.
  p.line(P([[352, -58], [342, -96], [304, -146], [300, -166]]), { width: 13, raw: true });
  p.line(P([[352, -58], [342, -96], [304, -146], [300, -166]]), { width: 7, color: '#3A3644', raw: true });
  p.rect(X(290), Y(-180), 22, 14, { fill: '#2A2733', r: 4, width: 3.5 });
  p.rect(X(204), Y(-172), 64, 12, { fill: '#2A2733', r: 4, width: 4 });
  for (let k = 0; k < 4; k++) p.rect(X(209 + k * 14), Y(-169), 10, 6, { fill: '#FFF2B0', r: 2, stroke: null });
  // A wing mirror on a stalk, with a spotlight taped to it.
  p.line([[X(338), Y(-96)], [X(354), Y(-106)]], { width: 4, raw: true });
  p.shape(P([[350, -118], [366, -114], [362, -98], [348, -100]]), { fill: '#2A2733', raw: true, width: 3.5 });
  p.ellipse(X(362), Y(-124), 8, 8, { fill: ACCENT, width: 3 });
  p.ellipse(X(362), Y(-124), 4.5, 4.5, { fill: '#FFF6D8', stroke: null });
  p.line(P([[354, -118], [366, -116]]), { width: 4, color: TAPE, raw: true });
  // Rockers and the side pipe along them.
  p.shape(P([[186, 6], [452, 4], [446, 30], [186, 30]]), { fill: '#2A2733', raw: true, width: 4, wobble: 1 });
  p.rect(X(212), Y(30), 150, 12, { fill: CHROME, r: 6, width: 4 });
  for (let k = 0; k < 6; k++) p.dot(X(222 + k * 24), Y(36), 2.2, CHROME_SHADE);
  for (const [mx, my, mr] of [[232, 22, 7], [246, 14, 4], [390, 20, 6], [410, 12, 4]] as const) p.ellipse(X(mx), Y(my), mr, mr * 0.8, { fill: MUD, stroke: null, opacity: 0.7, wobble: 1.4 });

  // The nose: a mesh grille, and the headlight (the eye sits in it) in a narrow, angled housing.
  p.shape(P([[440, -48], [462, -40], [466, -8], [448, -4]]), { fill: '#1E1C26', raw: true, width: 4 });
  for (let k = 0; k < 4; k++) p.line(P([[446, -40 + k * 9], [462, -36 + k * 9]]), { width: 1.8, color: '#4A4658', raw: true });
  p.shape(P([[380, -42], [420, -50], [424, -10], [384, -14]]), { fill: '#2A2733', raw: true, width: 4.5, wobble: 1 });
  p.ellipse(X(401), Y(-28), 15, 17, { fill: CHROME, width: 4 });
  p.ellipse(X(401), Y(-28), 11, 13, { fill: WELL, stroke: null });
  p.shape(P([[376, -46], [426, -56], [428, -46], [380, -38]]), { fill: BODY, raw: true, width: 3.5 });
  // The bumper: a steel plate, a little bent, with the cable's fairlead, red shackles, and bungee cords.
  p.shape(P([[396, 8], [474, 0], [482, 30], [404, 38]]), { fill: STEEL, raw: true, width: 5, wobble: 1.6, shade: [{ pts: [[X(390), Y(24)], [X(490), Y(20)], [X(490), Y(40)], [X(390), Y(40)]], color: '#2A2733' }] });
  p.rect(X(426), Y(12), 26, 9, { fill: '#14121A', r: 4, stroke: null });
  for (const [sx, sy] of [[404, 18], [470, 12]] as const) {
    p.ellipse(X(sx), Y(sy), 6, 6, { fill: '#D8403A', width: 3 });
    p.ellipse(X(sx), Y(sy), 2.5, 2.5, { fill: '#2A2733', stroke: null });
  }
  p.line(P([[410, 26], [430, 38], [452, 30]]), { width: 3.5, color: '#E8743E' });
  p.line(P([[440, 4], [456, 20], [474, 16]]), { width: 3.5, color: '#3FA7B5' });
  p.shape(P([[196, -112], [204, -112], [194, -76], [190, -76]]), { fill: '#FFFFFF', raw: true, stroke: null, opacity: 0.16 });
  return done('truck');
}

/**
 * The crossbow on its turret: a heavy stock on a rail, recurve limbs at the front with a cable-steel string,
 * a sight, and the anchor bolt loaded: a steel shaft with a three-fluked grapple for a head. Drawn pointing
 * right; the game turns it to aim about its pivot (on the turret).
 */
export const CROSSBOW = { w: 230, h: 120, pivot: { x: 60, y: 64 }, tip: { x: 196, y: 46 } };
export function crossbowArt(loaded: boolean): Art {
  const key = loaded ? 'crossbow' : 'crossbow_empty';
  const p = pen(key);
  const { x: px, y: py } = CROSSBOW.pivot;
  p.ellipse(px, py, 16, 16, { fill: '#3A3644', width: 4.5 });
  p.dot(px, py, 4, C.mustard);
  p.shape([[px - 52, py - 6], [px - 40, py - 16], [px + 120, py - 14], [px + 124, py - 2], [px + 40, py + 6], [px + 10, py + 22], [px - 8, py + 22], [px - 18, py + 8], [px - 52, py + 8]], { fill: '#2A2733', raw: true, width: 4.5, shade: [{ pts: [[px - 60, py], [px + 130, py], [px + 130, py + 30], [px - 60, py + 30]], color: '#1E1C26' }] });
  p.line([[px - 44, py - 10], [px + 116, py - 9]], { width: 2.5, color: C.mustard, raw: true });
  p.rect(px + 10, py - 26, 26, 10, { fill: '#3A3644', r: 3, width: 3 });
  p.ellipse(px + 40, py - 21, 4, 4, { fill: '#D8403A', stroke: null });
  const lx = px + 112;
  p.shape([[lx - 6, py - 12], [lx + 4, py - 34], [lx - 2, py - 52], [lx + 8, py - 56], [lx + 14, py - 34], [lx + 6, py - 10]], { fill: '#3A3644', raw: true, width: 4 });
  p.shape([[lx - 6, py + 4], [lx + 4, py + 28], [lx - 2, py + 46], [lx + 8, py + 50], [lx + 14, py + 28], [lx + 6, py + 4]], { fill: '#3A3644', raw: true, width: 4 });
  p.ellipse(lx + 3, py - 54, 6, 5, { fill: C.mustard, width: 3 });
  p.ellipse(lx + 3, py + 48, 6, 5, { fill: C.mustard, width: 3 });
  const latch = loaded ? px + 30 : lx - 2;
  p.line([[lx + 1, py - 54], [latch, py - 6], [lx + 1, py + 47]], { width: 2.6, color: '#D8D8E4', raw: true });
  if (loaded) {
    p.line([[px + 22, py - 18], [px + 136, py - 18]], { width: 5, color: '#B9BCCB', raw: true });
    const hx = px + 136;
    p.shape([[hx, py - 24], [hx + 18, py - 18], [hx, py - 12]], { fill: C.terracotta, raw: true, width: 3 });
    p.line([[hx + 2, py - 20], [hx - 10, py - 32], [hx - 16, py - 28]], { width: 3.5, color: C.terracotta, raw: true });
    p.line([[hx + 2, py - 16], [hx - 10, py - 4], [hx - 16, py - 8]], { width: 3.5, color: C.terracotta, raw: true });
  }
  return { key, svg: p.svg(CROSSBOW.w, CROSSBOW.h), w: CROSSBOW.w, h: CROSSBOW.h };
}

/** The anchor bolt in flight and stuck in: a steel shaft and a grapple head. Points right; its tip is at the right. */
export function boltArt(): Art {
  const p = pen('anchor_bolt');
  p.line([[6, 14], [70, 14]], { width: 5, color: '#B9BCCB', raw: true });
  p.shape([[70, 8], [90, 14], [70, 20]], { fill: C.terracotta, raw: true, width: 3 });
  p.line([[72, 12], [60, 2], [54, 6]], { width: 3.5, color: C.terracotta, raw: true });
  p.line([[72, 16], [60, 26], [54, 22]], { width: 3.5, color: C.terracotta, raw: true });
  return { key: 'anchor_bolt', svg: p.svg(96, 28), w: 96, h: 28 };
}

/**
 * The wheels, mismatched, as on a truck built from whatever was going: at the back, big knobbies on dark
 * beadlock wheels with a mustard ring; at the front, an old red steel wheel with a chrome cap and a whitewall
 * that has seen better days. Same size, so the physics does not care.
 */
export function wheelArt(front = false): Art {
  const r = TRUCK.wheelR;
  const s = r * 2 + PAD * 2;
  const c = s / 2;
  const key = front ? 'wheel_front' : 'wheel';
  const p = pen(key);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + (front ? 0.1 : 0);
    const b = a + 0.22;
    p.shape([[c + Math.cos(a) * (r + 3), c + Math.sin(a) * (r + 3)], [c + Math.cos(b) * (r + 3), c + Math.sin(b) * (r + 3)], [c + Math.cos(b) * (r - 6), c + Math.sin(b) * (r - 6)], [c + Math.cos(a) * (r - 6), c + Math.sin(a) * (r - 6)]], { fill: '#2A2733', raw: true, width: 3 });
  }
  p.ellipse(c, c, r - 2, r - 2, { fill: TYRE, width: 4 });
  if (front) {
    // An old whitewall, scuffed, on a red steelie with a chrome cap.
    p.ellipse(c, c, r * 0.78, r * 0.78, { fill: '#E8E2D4', width: 3 });
    p.ellipse(c, c, r * 0.64, r * 0.64, { fill: TYRE, stroke: null });
    p.ellipse(c, c, r * 0.58, r * 0.58, { fill: '#D8403A', width: 4, shade: [{ pts: [[c - r, c + 4], [c + r, c - 2], [c + r, c + r], [c - r, c + r]], color: '#A82E2E' }] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      p.ellipse(c + Math.cos(a) * r * 0.4, c + Math.sin(a) * r * 0.4, r * 0.07, r * 0.07, { fill: '#7A2A2E', stroke: null });
    }
    p.ellipse(c, c, r * 0.24, r * 0.24, { fill: CHROME, width: 3.5, shade: [{ pts: [[c - r, c + 2], [c + r, c - 2], [c + r, c + r], [c - r, c + r]], color: CHROME_SHADE }] });
    p.line([[c - r * 0.7, c - r * 0.3], [c - r * 0.6, c - r * 0.5]], { width: 3, color: '#8A8478', raw: true });
    return { key, svg: p.svg(s, s), w: s, h: s };
  }
  p.ellipse(c, c, r * 0.8, r * 0.8, { fill: '#3A3644', stroke: null });
  p.ellipse(c, c, r * 0.62, r * 0.62, { fill: '#2A2733', width: 4 });
  p.ellipse(c, c, r * 0.6, r * 0.6, { stroke: C.mustard, width: 5 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    p.dot(c + Math.cos(a) * r * 0.6, c + Math.sin(a) * r * 0.6, 1.8, '#2A2733');
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    p.ellipse(c + Math.cos(a) * r * 0.36, c + Math.sin(a) * r * 0.36, r * 0.08, r * 0.08, { fill: '#14121A', stroke: null });
  }
  p.ellipse(c, c, r * 0.18, r * 0.18, { fill: C.mustard, width: 3.5 });
  p.ellipse(c - r * 0.05, c - r * 0.06, r * 0.06, r * 0.04, { fill: '#FFFFFF', stroke: null, opacity: 0.8 });
  return { key, svg: p.svg(s, s), w: s, h: s };
}


/** The house picture's size, and where its chimney top and banner are, for the game to use. */
export const HOUSE = { w: 660, h: 880, ground: 866, chimney: { x: 52, y: 118 }, banner: { x: 282, y: 398 }, oldBanner: { x: 282, y: 398 } };

export interface HouseLook {
  /** The wooden upper storey and the tower's top. */
  wall: string;
  wallShade: string;
  roof: string;
  roofShade: string;
  turretRoof: string;
  door: string;
  trim: string;
}

/**
 * A tall storybook house, after cosy 2D game houses on Pinterest. Everything stands on the ground:
 * a stone ground floor, a wooden storey above with flower boxes, a steep tiled roof with a dormer,
 * a round tower that rises from the ground beside it to a pointed roof, a stone chimney up the side,
 * and a little porch over the door. 'old' (the house being left) has ivy and an old aerial;
 * 'new' (the house being moved to) has bunting, a weathervane and a mailbox. Both have a banner
 * under the eaves, high enough to be seen over the pile in front; the game writes on it.
 */
export function houseArt(key: string, look: HouseLook, kind: 'old' | 'new'): Art {
  const p = pen(key);
  const G = HOUSE.ground;
  const GLOW = '#FFC86B';
  const GLOW_DEEP = '#FF9E4A';
  const STONE = '#B6A2BE';
  const STONE_DARK = '#8E7BA0';

  /** Stones, in loose rows, over a stone wall. */
  const stones = (x0: number, y0: number, x1: number, y1: number) => {
    for (let row = 0; y0 + 16 + row * 40 < y1 - 10; row++) {
      for (let sx = x0 + 10 + (row % 2) * 26; sx + 40 < x1; sx += 58) {
        const sy = y0 + 14 + row * 40;
        p.rect(sx, sy, 44, 26, { stroke: STONE_DARK, width: 3, r: 9, opacity: 0.85 });
        p.line([[sx + 8, sy + 5], [sx + 34, sy + 4]], { width: 2.2, color: '#E4D8EC', raw: true, opacity: 0.8 });
        p.line([[sx + 10, sy + 22], [sx + 38, sy + 21]], { width: 2.4, color: STONE_DARK, raw: true, opacity: 0.5 });
        if ((sx * 7 + row * 13) % 5 === 0) p.line([[sx + 20, sy + 4], [sx + 24, sy + 12], [sx + 20, sy + 18]], { width: 1.6, color: STONE_DARK, raw: true });
      }
    }
  };
  /** A lit window with a frame, cross bars, a curtain and a sill. Arched windows have a round top. */
  const windowAt = (x: number, y: number, w: number, h: number, arch = false) => {
    const outline = (inset: number): Pt[] => {
      if (!arch) return [[x + inset, y + inset], [x + w - inset, y + inset], [x + w - inset, y + h - inset], [x + inset, y + h - inset]];
      const r = w / 2 - inset;
      const cx = x + w / 2;
      const cy = y + w / 2;
      const pts: Pt[] = [[x + w - inset, y + h - inset], [x + inset, y + h - inset]];
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI + (i / 10) * Math.PI;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      return pts;
    };
    p.shape(outline(0), { fill: look.trim, raw: true, width: 5 });
    p.shape(outline(7), { fill: GLOW, raw: true, width: 3.5, shade: [{ pts: [[x, y + h * 0.56], [x + w, y + h * 0.5], [x + w, y + h], [x, y + h]], color: GLOW_DEEP }] });
    p.line([[x + w / 2, y + 8], [x + w / 2, y + h - 8]], { width: 3.5, raw: true });
    p.line([[x + 8, y + h * 0.58], [x + w - 8, y + h * 0.58]], { width: 3.5, raw: true });
    const top = y + (arch ? w * 0.42 : 8);
    p.shape([[x + 8, top], [x + 8 + (w - 16) * 0.32, top], [x + 8 + (w - 16) * 0.18, y + h * 0.66], [x + 8 + (w - 16) * 0.26, y + h - 8], [x + 8, y + h - 8]], { fill: kind === 'old' ? '#E58FA4' : C.cream, raw: true, width: 3 });
    p.rect(x - 6, y + h - 4, w + 12, 10, { fill: look.trim, r: 3, width: 4 });
  };
  const flowerBox = (x: number, y: number, w: number) => {
    p.rect(x, y, w, 18, { fill: C.woodDark, r: 4, width: 4 });
    const colours = [C.terracotta, C.mustard, C.pink, C.cream];
    for (let i = 0; i * 17 < w - 8; i++) {
      p.dot(x + 9 + i * 17, y - 2, 9, i % 2 ? C.sageDark : C.sage);
      p.dot(x + 10 + i * 17, y - 8, 6, colours[i % colours.length]);
    }
  };
  const lantern = (x: number, y: number) => {
    p.line([[x, y - 22], [x, y - 10]], { width: 3, raw: true });
    p.shape([[x - 9, y - 10], [x + 9, y - 10], [x + 11, y + 12], [x - 11, y + 12]], { fill: GLOW, raw: true, width: 4 });
    p.shape([[x - 11, y - 10], [x, y - 20], [x + 11, y - 10]], { fill: C.ink, raw: true, stroke: null });
    p.rect(x - 12, y + 10, 24, 6, { fill: C.ink, r: 2, stroke: null });
  };

  // ---- The chimney, in stone, up the left side from the ground to above the roof.
  p.rect(24, 130, 60, G - 130, { fill: STONE, r: 6, width: 6, shade: [{ pts: [[58, 120], [90, 120], [90, G], [62, G]], color: STONE_DARK }] });
  stones(24, 140, 84, G);
  p.rect(16, 112, 76, 22, { fill: STONE_DARK, r: 5, width: 5 });

  // ---- Ground floor: stone.
  p.rect(84, 590, 400, G - 590, { fill: STONE, r: 6, width: 7, shade: [{ pts: [[400, 580], [500, 580], [500, G + 10], [410, G + 10]], color: STONE_DARK }] });
  stones(84, 590, 484, G);

  // ---- The tower, standing on the ground beside the house: stone below, wood above, a pointed roof.
  p.rect(470, 590, 120, G - 590, { fill: STONE, r: 8, width: 7, shade: [{ pts: [[548, 580], [600, 580], [600, G + 10], [552, G + 10]], color: STONE_DARK }] });
  stones(470, 590, 590, G);
  p.rect(474, 250, 112, 348, { fill: look.wall, r: 8, width: 7, shade: [{ pts: [[546, 240], [600, 240], [600, 600], [550, 600]], color: look.wallShade }] });
  for (let y = 278; y < 590; y += 26) p.line([[480, y], [580, y]], { width: 3, color: '#00000022', raw: true });
  windowAt(500, 300, 60, 84, true);
  windowAt(500, 452, 60, 84, true);
  windowAt(500, 676, 60, 84, true);
  p.rect(466, 582, 128, 16, { fill: C.walnut, r: 4, width: 5 });
  p.shape([[456, 262], [530, 64], [604, 262]], { fill: look.turretRoof, raw: true, width: 7, shade: [{ pts: [[532, 50], [620, 50], [620, 270], [532, 270]], color: '#00000030' }] });
  for (const y of [130, 180, 226]) p.line([[530 - (y - 64) * 0.37, y], [530 + (y - 64) * 0.37, y]], { width: 3.5, color: '#00000038', raw: true });
  p.ellipse(530, 64, 8, 8, { fill: C.mustard, width: 3.5 });

  // ---- The wooden storey, a little wider than the stone below it.
  p.rect(74, 360, 420, 236, { fill: look.wall, r: 6, width: 7, shade: [{ pts: [[400, 350], [510, 350], [510, 600], [416, 600]], color: look.wallShade }] });
  for (let y = 386; y < 590; y += 26) p.line([[80, y], [488, y]], { width: 3, color: '#00000022', raw: true });
  for (let row = 0, y = 360; y < 584; y += 26, row++) {
    for (let x = 110 + (row % 3) * 70; x < 480; x += 210) {
      p.line([[x, y + 3], [x, y + 23]], { width: 2, color: '#00000026', raw: true });
      p.dot(x + 5, y + 7, 1.6, '#00000040');
      p.dot(x - 5, y + 7, 1.6, '#00000040');
    }
    // A pale lit edge under each board.
    p.line([[80, y + 4], [488, y + 4]], { width: 1.6, color: '#FFFFFF', raw: true, opacity: 0.12 });
  }
  for (const [kx, ky] of [[150, 404], [300, 456], [430, 508], [250, 560]] as const) p.ellipse(kx, ky, 5, 3, { stroke: '#00000030', width: 1.6 });
  windowAt(118, 434, 94, 98);
  windowAt(352, 434, 94, 98);
  flowerBox(108, 540, 114);
  flowerBox(342, 540, 114);
  // The beam along the bottom of the storey, and its shadow on the stone.
  p.rect(66, 584, 436, 18, { fill: C.walnut, r: 4, width: 5 });
  p.rect(84, 602, 400, 14, { fill: C.ink, stroke: null, opacity: 0.18 });

  // ---- The roof: steep, tiled, with a dormer window.
  p.shape([[52, 374], [284, 92], [516, 374]], { fill: look.roof, raw: true, width: 8, shade: [{ pts: [[286, 80], [530, 80], [530, 380], [286, 380]], color: look.roofShade }] });
  for (let row = 0, y = 136; y < 366; y += 22, row++) {
    const half = ((y - 92) / 282) * 232 - 12;
    const tile = 30;
    for (let x = 284 - half + (row % 2) * (tile / 2); x + tile <= 284 + half; x += tile) {
      p.line([[x, y], [x + tile / 2, y + 11], [x + tile, y]], { width: 2.8, color: look.roofShade });
    }
    p.line([[284 - half, y - 2], [284 + half, y - 2]], { width: 1.6, color: '#FFFFFF', raw: true, opacity: 0.1 });
  }
  // A ridge cap along the top edges.
  p.line([[56, 370], [284, 96], [512, 370]], { width: 3, color: '#FFFFFF', raw: true, opacity: 0.25 });
  // Dormer: a little gabled window standing out of the roof.
  p.rect(238, 236, 92, 80, { fill: look.wall, r: 4, width: 5.5 });
  windowAt(256, 250, 56, 60, true);
  p.shape([[226, 246], [284, 196], [342, 246]], { fill: look.roof, raw: true, width: 6, shade: [{ pts: [[286, 190], [350, 190], [350, 250], [286, 250]], color: look.roofShade }] });
  p.rect(42, 366, 484, 18, { fill: look.roofShade, r: 6, width: 6 });

  // ---- The banner under the eaves.
  p.line([[120, 384], [134, 390]], { width: 3.5, raw: true });
  p.line([[444, 384], [430, 390]], { width: 3.5, raw: true });
  p.shape([[134, 386], [430, 386], [424, 416], [282, 410], [140, 416]], { fill: kind === 'old' ? C.terracotta : C.teal, raw: true, width: 5, shade: [{ pts: [[134, 404], [430, 402], [430, 420], [134, 420]], color: kind === 'old' ? C.terracottaDark : '#2C7F8C' }] });

  // ---- The door, under a little porch roof on two posts, with lanterns.
  p.shape([[234, G], [234, 744], [248, 718], [284, 704], [320, 718], [334, 744], [334, G]], { fill: look.trim, raw: true, width: 6 });
  p.shape([[245, G], [245, 748], [258, 728], [284, 718], [310, 728], [323, 748], [323, G]], { fill: look.door, raw: true, width: 5, shade: [{ pts: [[286, 710], [340, 710], [340, G], [288, G]], color: '#00000030' }] });
  for (const dx of [264, 304]) p.line([[dx, 740], [dx, G - 6]], { width: 3, opacity: 0.5, raw: true });
  p.ellipse(284, 752, 12, 12, { fill: GLOW, width: 4 });
  p.dot(312, 806, 5, C.mustard);
  for (const px of [214, 354]) p.rect(px - 5, 690, 10, G - 690, { fill: C.woodDark, r: 3, width: 4 });
  p.shape([[196, 696], [216, 664], [352, 664], [372, 696]], { fill: look.roof, raw: true, width: 5.5, shade: [{ pts: [[290, 650], [380, 650], [380, 700], [290, 700]], color: look.roofShade }] });
  p.rect(214, G - 12, 140, 14, { fill: '#9E8CB0', r: 4, width: 5 });
  lantern(196, 740);
  lantern(372, 740);
  windowAt(112, 680, 76, 92, true);
  windowAt(390, 680, 66, 92, true);
  for (const [px, c] of [[160, C.terracotta], [420, C.mustard]] as const) {
    p.shape([[px - 16, G - 34], [px + 16, G - 34], [px + 11, G], [px - 11, G]], { fill: c, raw: true, width: 4 });
    p.dot(px - 6, G - 44, 11, C.sage);
    p.dot(px + 7, G - 48, 10, C.sageDark);
  }

  // The shadow of the eaves on the wall, a gutter, and a downpipe down the corner.
  p.rect(74, 384, 420, 30, { fill: C.ink, stroke: null, opacity: 0.16 });
  p.rect(40, 380, 488, 10, { fill: '#9AA0B5', r: 4, width: 3.5 });
  p.rect(488, 388, 10, G - 400, { fill: '#9AA0B5', r: 4, width: 3.5 });
  for (const y of [470, 640, 790]) p.rect(485, y, 16, 6, { fill: '#9AA0B5', r: 2, width: 2.5 });
  p.shape([[480, G - 14], [506, G - 14], [512, G], [478, G]], { fill: '#9AA0B5', raw: true, width: 3 });
  // A cat flap in the door, a doormat, and a house number.
  p.rect(268, G - 52, 32, 30, { fill: look.trim, r: 6, width: 3.5 });
  p.rect(272, G - 48, 24, 22, { fill: '#00000040', r: 4, stroke: null });
  p.rect(236, G - 6, 96, 8, { fill: '#B8403F', r: 3, width: 3 });
  p.rect(340, 760, 26, 20, { fill: C.cream, r: 4, width: 3 });
  p.line([[346, 766], [346, 774], [352, 774]], { width: 2.2, raw: true });
  p.line([[357, 766], [361, 766], [357, 774], [362, 774]], { width: 2.2, raw: true });

  if (kind === 'old') {
    // Wear and tear: streaks under the windows, a cracked pane, moss on the roof, and a shutter hanging by one hinge.
    for (const wx of [165, 399]) p.shape([[wx - 30, 546], [wx + 30, 546], [wx + 20, 584], [wx - 18, 590]], { fill: '#2A214024', raw: true, stroke: null, wobble: 3 });
    p.line([[372, 444], [384, 466], [378, 482], [392, 500]], { width: 2, raw: true, color: '#FFFFFF' });
    for (const [mx, my, mr] of [[120, 352], [176, 300], [420, 340], [380, 286], [240, 200]].map(([a, b], i) => [a, b, 10 + (i % 3) * 5] as const)) {
      p.ellipse(mx, my, mr * 1.4, mr * 0.7, { fill: '#6F9C5A', stroke: null, opacity: 0.85, wobble: 2 });
      p.dot(mx - mr * 0.4, my - 2, mr * 0.3, '#9CD49A');
    }
    p.shape([[90, 440], [114, 434], [122, 532], [100, 544]], { fill: look.trim, raw: true, width: 3.5 });
    for (let k = 0; k < 4; k++) p.line([[96 + k * 1.5, 452 + k * 22], [112 + k * 2, 450 + k * 22]], { width: 2, raw: true, opacity: 0.6 });
    // Ivy up the stone and the tower, and an old aerial on the roof.
    for (const [x0, top] of [[100, 610], [478, 610]] as const) {
      const ivy: Pt[] = [[x0, G - 4], [x0 - 6, G - 70], [x0 + 6, G - 140], [x0 - 4, G - 200], [x0 + 4, top]];
      p.line(ivy, { width: 4.5, color: C.moss });
      for (let i = 0; i < 9; i++) p.dot(x0 + (i % 2 ? 10 : -9), G - 20 - i * ((G - top) / 9), 7.5, i % 2 ? C.sageDark : C.sage);
    }
    p.line([[284, 92], [284, 40]], { width: 4.5, raw: true });
    p.line([[262, 52], [306, 48]], { width: 4, raw: true });
    p.line([[268, 64], [300, 62]], { width: 4, raw: true });
  } else {
    // Bunting along the porch, a weathervane on the tower, and a mailbox with its flag up.
    const colours = [C.mustard, C.terracotta, C.teal, C.pink];
    const at = (i: number): Pt => [92 + i * 38, 618 + Math.sin((i / 10) * Math.PI) * 22];
    p.line(Array.from({ length: 11 }, (_, i) => at(i)), { width: 3.5, raw: true });
    for (let i = 0; i < 10; i++) {
      const [x, y] = at(i + 0.5);
      p.shape([[x - 14, y - 2], [x + 14, y - 2], [x, y + 28]], { fill: colours[i % 4], raw: true, width: 3.5 });
    }
    p.line([[530, 60], [530, 18]], { width: 4.5, raw: true });
    p.line([[506, 34], [554, 34]], { width: 4, raw: true });
    p.shape([[530, 14], [522, 6], [524, 0], [530, 3], [536, 0], [538, 6]], { fill: C.terracotta, width: 3 });
    p.rect(616, 776, 10, G - 776, { fill: C.walnut, r: 3, width: 4.5 });
    p.rect(590, 744, 62, 36, { fill: C.teal, r: 15, width: 5 });
    p.line([[646, 754], [646, 728]], { width: 4, raw: true });
    p.rect(646, 726, 12, 12, { fill: C.terracotta, r: 2, width: 3 });
  }
  return { key, svg: p.svg(HOUSE.w, HOUSE.h), w: HOUSE.w, h: HOUSE.h };
}

/**
 * Four kinds of tree, in the storybook way: a round oak built from overlapping clumps of leaves,
 * a tall poplar, a tiered pine, and an apple tree. Each has light and dark leaves and a trunk with branches.
 * The picture's bottom middle is where the trunk meets the ground.
 */
export const TREE_KINDS = 4;
export function treeArt(n: number): Art {
  const key = `tree_${n}`;
  const p = pen(key);
  const W = 280;
  const H = 400;
  const cx = W / 2;
  const base = H - 10;
  const trunk = (w: number, top: number) => {
    p.shape([[cx - w, base], [cx - w * 0.6, top], [cx + w * 0.6, top], [cx + w, base], [cx + w + 10, base + 4], [cx - w - 10, base + 4]], { fill: C.walnut, raw: true, width: 6, shade: [{ pts: [[cx + 2, top], [cx + 40, top], [cx + 40, base + 10], [cx + 4, base + 10]], color: '#5A3D29' }] });
    p.line([[cx - 4, base - 20], [cx - 2, base - 60]], { width: 3, raw: true, opacity: 0.5 });
    p.line([[cx + 6, base - 50], [cx + 4, base - 90]], { width: 3, raw: true, opacity: 0.5 });
  };
  const clump = (x: number, y: number, rx: number, ry: number, fill: string, light?: string) => {
    p.ellipse(x, y, rx, ry, { fill, width: 5.5, shade: light ? [{ pts: [[x - rx, y - ry], [x + rx * 0.2, y - ry], [x - rx * 0.2, y], [x - rx, y]], color: light }] : undefined });
  };

  if (n === 0) {
    // Oak: a stout trunk forking into branches, and a crown of clumps.
    trunk(18, 220);
    p.line([[cx - 4, 230], [cx - 50, 170]], { width: 12 });
    p.line([[cx + 6, 230], [cx + 56, 176]], { width: 11 });
    clump(cx - 70, 170, 52, 46, C.moss);
    clump(cx + 72, 172, 54, 46, C.moss);
    clump(cx - 36, 110, 62, 56, C.sageDark, C.sage);
    clump(cx + 44, 112, 60, 54, C.sageDark, C.sage);
    clump(cx, 70, 66, 56, C.sage, C.sageLight);
    clump(cx - 8, 160, 56, 44, C.sage, C.sageLight);
    for (const [x, y] of [[cx - 30, 70], [cx + 20, 100], [cx - 54, 136], [cx + 60, 150]]) p.line([[x - 8, y], [x, y - 6], [x + 8, y]], { width: 3, opacity: 0.55 });
  } else if (n === 1) {
    // Poplar: tall and narrow, like a flame.
    trunk(10, 300);
    const crown: Pt[] = [[cx, 18], [cx + 34, 80], [cx + 46, 170], [cx + 40, 260], [cx + 18, 318], [cx - 18, 318], [cx - 42, 258], [cx - 46, 168], [cx - 32, 80]];
    p.shape(crown, { fill: C.sageDark, width: 6, shade: [{ pts: [[cx - 60, 0], [cx - 4, 0], [cx - 10, 330], [cx - 60, 330]], color: C.sage }] });
    for (let i = 0; i < 6; i++) p.line([[cx - 10 + (i % 2) * 22, 70 + i * 40], [cx - 4 + (i % 2) * 22, 96 + i * 40]], { width: 3, opacity: 0.5 });
  } else if (n === 2) {
    // Pine: tiers of needles, darkest at the bottom.
    trunk(11, 300);
    const tiers: [number, number, string][] = [[300, 112, C.moss], [236, 96, C.sageDark], [176, 78, C.sageDark], [120, 58, C.sage]];
    for (const [y, half, fill] of tiers) {
      const top = y - half * 1.25;
      const pts: Pt[] = [[cx, top]];
      for (let i = 0; i <= 6; i++) pts.push([cx + half - (i / 6) * half * 2, y + (i % 2 ? 10 : 0)]);
      p.shape(pts, { fill, raw: true, width: 6 });
    }
  } else {
    // Apple tree: a round crown with red apples, and a few on the grass.
    trunk(15, 236);
    p.line([[cx, 240], [cx - 40, 196]], { width: 10 });
    clump(cx - 50, 160, 64, 58, C.sageDark, C.sage);
    clump(cx + 52, 156, 64, 60, C.sageDark, C.sage);
    clump(cx, 104, 76, 66, C.sage, C.sageLight);
    for (const [x, y] of [[cx - 60, 150], [cx - 20, 90], [cx + 30, 130], [cx + 70, 170], [cx + 10, 180], [cx - 80, 190], [cx + 50, 84]]) {
      p.dot(x, y, 8, '#C9483A');
      p.dot(x - 2, y - 3, 2.5, '#F2B9A4');
    }
    p.dot(cx - 60, base - 4, 7, '#C9483A');
    p.dot(cx + 74, base - 2, 7, '#C9483A');
  }
  // Grass round the foot of the trunk.
  for (const dx of [-34, -18, 20, 36]) p.line([[cx + dx, base + 4], [cx + dx + (dx < 0 ? -6 : 6), base - 14]], { width: 4, color: C.moss, raw: true });
  return { key, svg: p.svg(W, H + 6), w: W, h: H + 6 };
}

/** A warning sign for bumps ahead: a yellow diamond with two humps on it. */
export function bumpSignArt(): Art {
  const p = pen('sign_bump');
  p.rect(48, 92, 12, 150, { fill: C.walnut, r: 3, width: 4.5 });
  p.shape([[54, 6], [102, 54], [54, 102], [6, 54]], { fill: C.mustard, raw: true, width: 6 });
  p.shape([[54, 16], [92, 54], [54, 92], [16, 54]], { raw: true, width: 3 });
  p.line([[28, 66], [38, 48], [48, 66], [60, 48], [70, 66], [80, 66]], { width: 5 });
  return { key: 'sign_bump', svg: p.svg(110, 246), w: 110, h: 246 };
}

/** A hill sign: a slope with a little truck climbing it. */
export function hillSignArt(): Art {
  const p = pen('sign_hill');
  p.rect(48, 92, 12, 150, { fill: C.walnut, r: 3, width: 4.5 });
  p.shape([[54, 6], [102, 54], [54, 102], [6, 54]], { fill: C.mustard, raw: true, width: 6 });
  p.shape([[24, 72], [84, 36], [84, 72]], { fill: C.ink, raw: true, width: 3 });
  p.rect(40, 50, 16, 9, { fill: C.cream, r: 2, width: 2.5 });
  return { key: 'sign_hill', svg: p.svg(110, 246), w: 110, h: 246 };
}

/** A milestone: a little white stone with a rounded top. The distance is written on it in the game. */
export function milestoneArt(): Art {
  const p = pen('milestone');
  p.shape([[10, 120], [10, 40], [20, 14], [46, 4], [72, 14], [82, 40], [82, 120]], { fill: C.cream, raw: true, width: 6, shade: [{ pts: [[56, 0], [90, 0], [90, 130], [60, 130]], color: C.creamShade }] });
  p.rect(10, 24, 72, 14, { fill: C.terracotta, r: 3, stroke: null });
  return { key: 'milestone', svg: p.svg(92, 128), w: 92, h: 128 };
}

/** The joke sign's size, and the box on its plank that the words must fit inside (in the picture's pixels). */
export const PLANK = { w: 340, h: 320, text: { x: 170, y: 84, w: 280, h: 120 } };

/** A hand-painted plank on two crooked posts, nailed up by a local with opinions. The words are added in the game. */
export function plankSignArt(): Art {
  const p = pen('sign_plank');
  const { w, h } = PLANK;
  p.rect(48, 140, 14, h - 144, { fill: C.walnut, r: 3, width: 4.5 });
  p.rect(w - 62, 146, 14, h - 150, { fill: C.walnut, r: 3, width: 4.5 });
  p.shape([[8, 14], [w - 10, 6], [w - 4, 158], [14, 164]], { fill: C.cream, raw: true, width: 6, shade: [{ pts: [[0, 138], [w, 130], [w, 172], [0, 172]], color: C.creamShade }] });
  for (const [nx, ny] of [[55, 26], [w - 55, 20], [55, 150], [w - 55, 146]] as const) p.dot(nx, ny, 3.6, C.walnut);
  p.line([[130, 30], [170, 33]], { width: 2, color: C.woodLine, raw: true, opacity: 0.5 });
  p.line([[200, 140], [250, 138]], { width: 2, color: C.woodLine, raw: true, opacity: 0.5 });
  return { key: 'sign_plank', svg: p.svg(w, h), w, h };
}

/** The colours a toll plaza is painted in, per place: booth body and its shade, canopy fascia. */
export const TOLL_SKINS: Record<string, [string, string, string]> = {
  meadow: ['#7EC4E0', '#4E96B4', '#2E5E86'],
  autumn: ['#8EB47A', '#5E8A54', '#3E5E3A'],
  snow: ['#E05A4A', '#B03A30', '#7A2A2E'],
  coast: ['#5ECFC0', '#2E9A8E', '#1E6A6A'],
};

/**
 * A toll booth seen from the side, on its concrete island behind the road: the barrier's hinge post with
 * its pivot cap, the hut with a flat overhanging roof and an amber beacon on top, a big window with the
 * sleepy attendant in it, a TOLL plate, and the island's kerb painted in yellow and black chevrons.
 */
export function tollBoothArt(skin = 'meadow'): Art {
  const [body, shade] = TOLL_SKINS[skin] ?? TOLL_SKINS.meadow;
  const key = skin === 'meadow' ? 'toll_booth' : `toll_booth_${skin}`;
  const p = pen(key);
  const w = 260;
  const h = 360;
  // The island and its chevron kerb.
  p.rect(0, h - 34, w, 34, { fill: '#B8B4C4', r: 2, width: 4.5 });
  for (let x = 4; x < w - 20; x += 30) p.shape([[x, h - 30], [x + 14, h - 30], [x + 26, h - 4], [x + 12, h - 4]], { fill: '#2A2140', raw: true, stroke: null });
  for (let x = 18; x < w - 10; x += 30) p.shape([[x, h - 30], [x + 14, h - 30], [x + 26, h - 4], [x + 12, h - 4]], { fill: C.mustard, raw: true, stroke: null });
  // The hinge post, striped, with its pivot cap where the barrier turns.
  p.rect(18, h - 200, 26, 170, { fill: C.cream, r: 4, width: 4.5 });
  for (let y = h - 190; y < h - 40; y += 36) p.rect(18, y, 26, 16, { fill: C.terracotta, r: 0, stroke: null });
  p.ellipse(31, h - 158, 20, 20, { fill: '#9AA0B5', width: 4.5, shade: [{ pts: [[10, h - 156], [52, h - 160], [52, h - 136], [10, h - 136]], color: '#6E7488' }] });
  p.dot(31, h - 158, 5, '#4A4E60');
  // The hut.
  p.rect(70, 120, 170, h - 152, { fill: body, r: 6, width: 6, shade: [{ pts: [[190, 110], [250, 110], [250, h], [194, h]], color: shade }] });
  // Its flat roof, overhanging, with the amber beacon.
  p.rect(56, 102, 198, 22, { fill: '#E8E4F0', r: 4, width: 5, shade: [{ pts: [[50, 116], [260, 116], [260, 130], [50, 130]], color: '#B8B4C4' }] });
  p.rect(140, 82, 28, 22, { fill: '#4A4E60', r: 4, width: 4 });
  p.ellipse(154, 74, 16, 16, { fill: '#FFB43A', width: 4 });
  p.ellipse(149, 69, 5, 4, { fill: '#FFFFFF', stroke: null, opacity: 0.8 });
  // The window, with the attendant asleep: cap, closed eyes, moustache.
  p.rect(90, 146, 120, 92, { fill: '#FFE2A8', r: 6, width: 5 });
  p.line([[96, 150], [120, 150], [96, 176]], { width: 3, color: '#FFFFFF', raw: true, opacity: 0.6 });
  p.ellipse(150, 214, 30, 26, { fill: C.cream, width: 4 });
  p.shape([[120, 198], [126, 182], [150, 176], [174, 182], [180, 198]], { fill: C.dusk, width: 4 });
  p.rect(116, 194, 72, 8, { fill: C.dusk, r: 3, width: 3 });
  p.line([[136, 214], [144, 217]], { width: 3, raw: true });
  p.line([[156, 217], [164, 214]], { width: 3, raw: true });
  p.shape([[140, 224], [150, 220], [160, 224], [156, 230], [144, 230]], { fill: C.walnut, raw: true, width: 2.5 });
  p.rect(84, 234, 132, 12, { fill: C.walnut, r: 3, width: 4 });
  // The TOLL plate and a door.
  p.rect(98, 256, 104, 30, { fill: '#2E3440', r: 5, width: 3.5 });
  p.rect(120, 292, 56, h - 326, { fill: shade, r: 4, width: 4 });
  p.dot(166, 310, 3.5, C.mustard);
  return { key, svg: p.svg(w, h), w, h };
}

/**
 * The plaza's canopy, behind the road: a deep roof slab on two columns, a fascia in the place's colour
 * (the game writes TOLL on it and lights the downlights under the slab).
 */
export const CANOPY = { w: 780, h: 560, slab: 70, fascia: { x: 390, y: 104 }, lights: [190, 390, 590] };
export function tollCanopyArt(skin = 'meadow'): Art {
  const [, , fascia] = TOLL_SKINS[skin] ?? TOLL_SKINS.meadow;
  const key = `toll_canopy_${skin}`;
  const p = pen(key);
  const { w, h, slab } = CANOPY;
  for (const cx of [40, w - 40]) p.rect(cx - 18, slab + 60, 36, h - slab - 60, { fill: '#C9C6D4', r: 3, width: 4.5, shade: [{ pts: [[cx + 2, 0], [cx + 30, 0], [cx + 30, h], [cx + 4, h]], color: '#9A96A8' }] });
  p.rect(0, slab, w, 70, { fill: fascia, r: 4, width: 5.5, shade: [{ pts: [[0, slab + 50], [w, slab + 50], [w, slab + 80], [0, slab + 80]], color: mix(fascia, '#000000', 0.3) }] });
  p.rect(10, slab - 16, w - 20, 18, { fill: '#E8E4F0', r: 3, width: 4 });
  p.rect(CANOPY.fascia.x - 110, slab + 12, 220, 46, { fill: '#F4F0E6', r: 6, width: 4 });
  for (const lx of CANOPY.lights) p.rect(lx - 40, slab + 70, 80, 10, { fill: '#FFF6D8', r: 3, width: 3 });
  return { key, svg: p.svg(w, h), w, h };
}

/** The barrier: stripes at 45°, little red lamps along it, a red STOP disc at its tip, a counterweight. */
export function tollArmArt(): Art {
  const p = pen('toll_arm');
  const w = 420;
  const h = 64;
  p.rect(30, 22, w - 92, 20, { fill: C.cream, r: 10, width: 4.5 });
  for (let x = 36; x < w - 70; x += 40) p.shape([[x, 24], [x + 18, 24], [x + 4, 40], [x - 14, 40]], { fill: C.terracotta, raw: true, stroke: null });
  for (let x = 70; x < w - 80; x += 80) p.ellipse(x, 32, 5, 5, { fill: '#FF4A3A', width: 2 });
  p.ellipse(22, 32, 22, 22, { fill: '#E0402E', width: 4.5 });
  p.rect(10, 28, 24, 8, { fill: '#FFFFFF', r: 2, stroke: null });
  p.rect(w - 66, 12, 58, 40, { fill: '#6E7488', r: 6, width: 4.5, shade: [{ pts: [[w - 70, 38], [w, 36], [w, 56], [w - 70, 56]], color: '#4A4E60' }] });
  return { key: 'toll_arm', svg: p.svg(w, h), w, h };
}

/**
 * A level crossing signal, side-on: a post with the X crossbuck on top, two red lamps under hoods on a
 * crossbar (they flash in turn), a bell, and the relay cabinet at its foot.
 */
export const RAIL_SIGNAL = { w: 220, h: 460, lamps: [[60, 250], [160, 250]] as [number, number][] };
export function railSignalArt(): Art {
  const p = pen('rail_signal');
  const { w, h } = RAIL_SIGNAL;
  p.rect(100, 70, 20, h - 70, { fill: '#E8E4F0', r: 3, width: 4.5 });
  for (let y = 300; y < h - 20; y += 40) p.rect(100, y, 20, 18, { fill: '#2A2140', r: 0, stroke: null });
  // The crossbuck.
  for (const a of [0.55, -0.55]) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const L = 90;
    const T = 16;
    p.shape([[110 - c * L - s * T, 90 - s * L + c * T], [110 + c * L - s * T, 90 + s * L + c * T], [110 + c * L + s * T, 90 + s * L - c * T], [110 - c * L + s * T, 90 - s * L - c * T]], { fill: '#F4F0E6', raw: true, width: 4 });
  }
  // The crossbar with its two hooded lamps, and the bell above.
  p.rect(30, 236, 160, 14, { fill: '#2A2140', r: 3, stroke: null });
  for (const [lx, ly] of RAIL_SIGNAL.lamps) {
    p.ellipse(lx, ly, 30, 30, { fill: '#1A1626', width: 4 });
    p.ellipse(lx, ly, 20, 20, { fill: '#5A2020', stroke: null });
    p.shape([[lx - 32, ly - 22], [lx + 32, ly - 22], [lx + 26, ly - 36], [lx - 26, ly - 36]], { fill: '#1A1626', raw: true, width: 3 });
  }
  p.ellipse(110, 186, 24, 18, { fill: '#2A2140', width: 4 });
  p.ellipse(110, 196, 30, 8, { fill: '#2A2140', width: 3 });
  // The relay cabinet.
  p.rect(130, h - 110, 72, 110, { fill: '#9AA0B5', r: 4, width: 4.5, shade: [{ pts: [[180, h - 120], [210, h - 120], [210, h], [182, h]], color: '#6E7488' }] });
  for (let k = 0; k < 4; k++) p.line([[140, h - 90 + k * 12], [190, h - 90 + k * 12]], { width: 2, color: '#6E7488', raw: true });
  return { key: 'rail_signal', svg: p.svg(w, h), w, h };
}

/** A signpost pointing home, with a little house on it. */
export function homeSignArt(): Art {
  const p = pen('sign_home');
  p.rect(32, 70, 14, 180, { fill: C.walnut, r: 3, width: 5 });
  p.shape([[12, 20], [180, 20], [214, 56], [180, 92], [12, 92]], { fill: C.terracotta, raw: true, width: 6, shade: [{ pts: [[0, 66], [220, 62], [220, 100], [0, 100]], color: C.terracottaDark }] });
  p.shape([[40, 54], [62, 34], [84, 54], [84, 78], [40, 78]], { fill: C.cream, raw: true, width: 4 });
  p.rect(56, 62, 12, 16, { fill: C.walnut, r: 2, width: 3 });
  for (let i = 0; i < 3; i++) p.line([[104 + i * 22, 56], [116 + i * 22, 56]], { width: 6, color: C.cream, raw: true });
  return { key: 'sign_home', svg: p.svg(224, 254), w: 224, h: 254 };
}

/** The dashboard's size, and where its parts sit inside it (in the picture's own pixels). */
export const DASH = { w: 740, h: 262, speedo: { x: 170, y: 150 }, gear: { x: 418, y: 126 }, lamp: { x: 622, y: 74 }, slot: { x: 622, top: 132, bottom: 232 } };

/**
 * The dashboard, as one piece of a 1950s pickup: a teal painted steel fascia (the truck's own colour) with a
 * chrome rim, a cream pinstripe, rivets, recessed wells for the speedometer and gear gauge, and on the right the
 * handbrake: a chrome-ringed warning lamp above a slot for the pull handle.
 */
export function dashArt(): Art {
  const p = pen('dash');
  p.plain = true;
  const { w, h } = DASH;
  const BODY = C.teal;
  const SHADE = '#22707F';
  // Drop shadow, chrome rim, painted face.
  p.rect(8, 12, w - 8, h - 12, { fill: C.ink, r: 40, stroke: null, opacity: 0.35 });
  p.rect(0, 0, w - 8, h - 12, { fill: CHROME_SHADE, r: 40, width: 5, shade: [{ pts: [[0, 0], [w, 0], [w, 40], [0, 60]], color: '#F4F4F0' }] });
  p.rect(10, 10, w - 28, h - 32, { fill: BODY, r: 32, width: 4, shade: [{ pts: [[0, h * 0.62], [w, h * 0.5], [w, h], [0, h]], color: SHADE }] });
  // A soft shine across the top of the paint.
  p.rect(36, 18, w - 80, 16, { fill: '#FFFFFF', r: 8, stroke: null, opacity: 0.14 });
  // The cream pinstripe, inset.
  p.rect(22, 22, w - 52, h - 56, { r: 24, width: 2.4, stroke: C.cream });
  // Rivets round the edge.
  for (let x = 60; x < w - 60; x += 80) {
    for (const y of [16, h - 26]) {
      p.dot(x, y, 3.2, SHADE);
      p.dot(x - 1, y - 1, 1.2, '#BFEFF2');
    }
  }
  // Wells behind the two gauges, so they sit into the panel.
  p.ellipse(DASH.speedo.x, DASH.speedo.y - 18, 140, 128, { fill: '#1C5560', stroke: null, opacity: 0.9 });
  p.ellipse(DASH.gear.x, DASH.gear.y, 92, 92, { fill: '#1C5560', stroke: null, opacity: 0.9 });
  // The handbrake: a lamp in a chrome ring, and a slot for the handle with a chrome surround.
  const { lamp, slot } = DASH;
  p.ellipse(lamp.x, lamp.y, 46, 46, { fill: CHROME_SHADE, width: 4.5, shade: [{ pts: [[lamp.x - 60, lamp.y - 60], [lamp.x + 30, lamp.y - 60], [lamp.x - 60, lamp.y + 30]], color: '#F7F6EF' }] });
  p.ellipse(lamp.x, lamp.y, 36, 36, { fill: '#3A1F2A', width: 3 });
  p.rect(slot.x - 26, slot.top - 10, 52, slot.bottom - slot.top + 20, { fill: CHROME_SHADE, r: 18, width: 4.5, shade: [{ pts: [[slot.x - 40, slot.top - 20], [slot.x + 40, slot.top - 20], [slot.x + 40, slot.top + 20], [slot.x - 40, slot.top + 40]], color: '#F7F6EF' }] });
  p.rect(slot.x - 10, slot.top, 20, slot.bottom - slot.top, { fill: '#14323A', r: 10, width: 3 });
  // ON / OFF marks beside the slot.
  p.line([[slot.x + 36, slot.top + 14], [slot.x + 48, slot.top + 14]], { width: 4, color: C.terracotta, raw: true });
  p.line([[slot.x + 36, slot.bottom - 14], [slot.x + 48, slot.bottom - 14]], { width: 4, color: C.cream, raw: true });
  return { key: 'dash', svg: p.svg(w, h), w, h };
}

/** The handbrake's pull handle: a red T-grip on a chrome shaft. */
export function hbHandleArt(): Art {
  const p = pen('hb_handle');
  p.plain = true;
  p.rect(32, 30, 12, 46, { fill: CHROME, width: 3.5, r: 5 });
  p.rect(4, 6, 68, 30, { fill: C.terracotta, r: 14, width: 4.5, shade: [{ pts: [[0, 24], [80, 22], [80, 40], [0, 40]], color: C.terracottaDark }] });
  p.rect(14, 12, 40, 6, { fill: '#FFFFFF', r: 3, stroke: null, opacity: 0.35 });
  return { key: 'hb_handle', svg: p.svg(76, 80), w: 76, h: 80 };
}

/** The results screen's paper: a delivery note with a torn bottom edge, faint rules and two strips of tape. */
export const RECEIPT = { w: 1000, h: 780 };
export function receiptArt(): Art {
  const p = pen('receipt');
  p.plain = true;
  const { w, h } = RECEIPT;
  const PAPER = '#FFF6E6';
  // The torn edge: a zigzag along the bottom.
  const edge: Pt[] = [];
  for (let x = w - 20; x >= 20; x -= 25) edge.push([x, h - 30 - ((x / 25) % 2 ? 14 : 0)]);
  const outline: Pt[] = [[20, 20], [w - 20, 20], [w - 20, h - 30], ...edge, [20, h - 30]];
  p.shape(outline.map(([x, y]) => [x + 10, y + 14] as Pt), { fill: C.ink, stroke: null, raw: true, opacity: 0.35, wobble: 0 });
  p.shape(outline, { fill: PAPER, raw: true, width: 5, wobble: 0.6, stroke: C.ink });
  // Faint blue rules, and a red margin line.
  for (let y = 190; y < h - 60; y += 42) p.line([[40, y], [w - 40, y]], { width: 1.6, color: '#BFD2E6', raw: true, wobble: 0 });
  p.line([[84, 30], [84, h - 50]], { width: 2, color: '#F2A7A0', raw: true, wobble: 0 });
  // A coffee ring, because it has been in the truck.
  p.ellipse(w - 150, h - 140, 64, 60, { stroke: '#C98552', width: 5, wobble: 2, opacity: 0.25 });
  p.ellipse(w - 150, h - 140, 56, 52, { stroke: '#C98552', width: 2, wobble: 2, opacity: 0.18 });
  // Tape at the top corners.
  for (const [x, a] of [[70, -0.5], [w - 70, 0.5]] as const) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const pts: Pt[] = [[-60, -18], [60, -18], [60, 18], [-60, 18]].map(([px, py]) => [x + px * c - py * s, 26 + px * s + py * c] as Pt);
    p.shape(pts, { fill: '#F2E3B8', stroke: null, raw: true, opacity: 0.85, wobble: 1.5 });
  }
  return { key: 'receipt', svg: p.svg(w + 12, h + 16), w: w + 12, h: h + 16 };
}

/** A ribbon banner with folded tails, for the title on the results screen. */
export function ribbonArt(): Art {
  const p = pen('ribbon');
  p.plain = true;
  const w = 820;
  const h = 170;
  // Tails behind, with their folds in shadow.
  for (const s of [-1, 1]) {
    const x = s < 0 ? 70 : w - 70;
    p.shape([[x, 60], [x - s * 70, 60], [x - s * 40, 100], [x - s * 70, 140], [x, 140]], { fill: C.terracottaDark, raw: true, width: 5 });
    p.shape([[x, 140], [x + s * 50, 140], [x, 116]], { fill: '#7E2A33', raw: true, width: 4 });
  }
  p.shape([[60, 30], [w - 60, 30], [w - 50, 116], [w / 2, 126], [50, 116]], { fill: C.terracotta, width: 6, shade: [{ pts: [[0, 92], [w, 88], [w, 140], [0, 140]], color: C.terracottaDark }] });
  p.line([[90, 46], [w - 90, 46]], { width: 2.4, color: '#FFD3C4', raw: true, opacity: 0.8 });
  p.line([[86, 100], [w / 2, 108], [w - 86, 100]], { width: 2.4, color: '#FFD3C4', opacity: 0.6 });
  return { key: 'ribbon', svg: p.svg(w, h), w, h };
}

/** A rubber stamp's ring: two rough circles in red ink, the words and stars go inside in the game. */
export function stampArt(): Art {
  const p = pen('stamp');
  p.plain = true;
  const s = 280;
  const c = s / 2;
  p.ellipse(c, c, 124, 124, { stroke: C.terracottaDark, width: 10, wobble: 2.2 });
  p.ellipse(c, c, 104, 104, { stroke: C.terracottaDark, width: 4, wobble: 1.8 });
  // The band across the middle for the word DELIVERED.
  p.rect(c - 132, c - 26, 264, 52, { fill: C.terracottaDark, r: 6, stroke: null, wobble: 1.4 });
  // Ink speckle, as rubber stamps never print evenly.
  for (let i = 0; i < 40; i++) {
    const a = (i * 2.4) % (Math.PI * 2);
    const r = 20 + ((i * 37) % 100);
    p.dot(c + Math.cos(a) * r, c + Math.sin(a) * r, 1.4 + (i % 3), '#FFF6E6');
  }
  return { key: 'stamp', svg: p.svg(s, s), w: s, h: s };
}

/** The speedometer's geometry, shared by the drawing and the dashboard that moves its needle. */
export const SPEEDO = { size: 300, r: 112, from: Math.PI * 0.75, sweep: Math.PI * 1.5, max: 80 };

/**
 * A 1950s-style speedometer face, after vintage gauges on Pinterest: a thick chrome bezel with a shine,
 * a cream face, a teal scale band that turns red at the top, fine minor ticks and bold major ones,
 * an odometer window, and a little fuel scale in the gap at the bottom. The numbers, needle and
 * glass are added in the game, so they stay sharp and can move.
 */
export function speedoArt(): Art {
  const p = pen('speedo');
  p.plain = true;
  const s = SPEEDO.size;
  const c = s / 2;
  const R = SPEEDO.r;
  const at = (v: number, rad: number): Pt => {
    const a = SPEEDO.from + (v / SPEEDO.max) * SPEEDO.sweep;
    return [c + Math.cos(a) * rad, c + Math.sin(a) * rad];
  };
  const band = (v0: number, v1: number, r0: number, r1: number): Pt[] => {
    const pts: Pt[] = [];
    for (let v = v0; v <= v1 + 0.01; v += 1) pts.push(at(v, r0));
    for (let v = v1; v >= v0 - 0.01; v -= 1) pts.push(at(v, r1));
    return pts;
  };

  // Chrome bezel: a thick ring with a bright shine top-left and a darker edge bottom-right,
  // and little knurls round its rim.
  p.ellipse(c, c, R + 34, R + 34, { fill: CHROME_SHADE, width: 6, shade: [{ pts: [[0, 0], [s * 0.62, 0], [0, s * 0.62]], color: '#F7F6EF' }, { pts: [[s, s * 0.45], [s, s], [s * 0.45, s]], color: '#A9AE9F' }] });
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    p.line([[c + Math.cos(a) * (R + 27), c + Math.sin(a) * (R + 27)], [c + Math.cos(a) * (R + 33), c + Math.sin(a) * (R + 33)]], { width: 2.5, raw: true, opacity: 0.35 });
  }
  p.ellipse(c, c, R + 16, R + 16, { fill: '#C9CDC1', width: 4, shade: [{ pts: [[s * 0.55, s], [s, s * 0.55], [s, s]], color: '#B5BAAD' }] });
  // A dark recess between the bezel and the face.
  p.ellipse(c, c, R + 8, R + 8, { fill: C.ink, stroke: null });

  // The face, with a soft lighter middle.
  p.ellipse(c, c, R, R, { fill: '#F3E8CF', width: 3, shade: [{ pts: [[c - R * 0.55, c - R * 0.6], [c + R * 0.5, c - R * 0.62], [c + R * 0.58, c + R * 0.45], [c - R * 0.5, c + R * 0.5]], color: C.cream }] });

  // Scale band: teal up to 60, red from 60 to 80, with a thin ink edge inside.
  p.shape(band(0, 60, R - 6, R - 16), { fill: C.teal, raw: true, stroke: null });
  p.shape(band(60, 80, R - 6, R - 16), { fill: C.terracotta, raw: true, stroke: null });
  p.line(Array.from({ length: 81 }, (_, v) => at(v, R - 17)), { width: 2.5, raw: true, opacity: 0.7, wobble: 0.3 });

  // Ticks: every 2 small, every 5 medium, every 10 long and bold.
  for (let v = 0; v <= SPEEDO.max; v += 2) {
    const major = v % 10 === 0;
    const mid = v % 10 === 5;
    if (!major && v % 2 !== 0) continue;
    p.line([at(v, R - 18), at(v, R - (major ? 34 : mid ? 28 : 24))], { width: major ? 5 : mid ? 3.5 : 2.2, raw: true, wobble: 0.2 });
  }

  // Odometer window below the middle.
  p.rect(c - 33, c + 30, 66, 22, { fill: C.ink, r: 4, width: 3.5 });
  for (let i = 1; i < 5; i++) p.line([[c - 33 + i * 13.2, c + 32], [c - 33 + i * 13.2, c + 50]], { width: 1.5, color: '#6B5A4C', raw: true });

  // Fuel scale in the gap at the bottom of the dial: from E on the left to F on the right.
  const fuel: Pt[] = [];
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI * 0.62 - (k / 10) * Math.PI * 0.24;
    fuel.push([c + Math.cos(a) * (R - 10), c + Math.sin(a) * (R - 10)]);
  }
  p.line(fuel, { width: 4, raw: true });
  for (const k of [0, 5, 10]) {
    const a = Math.PI * 0.62 - (k / 10) * Math.PI * 0.24;
    p.line([[c + Math.cos(a) * (R - 10), c + Math.sin(a) * (R - 10)], [c + Math.cos(a) * (R - 20), c + Math.sin(a) * (R - 20)]], { width: k === 5 ? 2.5 : 3.5, raw: true });
  }
  p.dot(c + Math.cos(Math.PI * 0.62) * (R - 10), c + Math.sin(Math.PI * 0.62) * (R - 10), 4, C.terracotta);

  // Four little screws in the bezel.
  for (const a of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
    const x = c + Math.cos(a) * (R + 24);
    const y = c + Math.sin(a) * (R + 24);
    p.ellipse(x, y, 5, 5, { fill: '#DADDD3', width: 2.5 });
    p.line([[x - 3, y + 2], [x + 3, y - 2]], { width: 1.8, raw: true });
  }
  return { key: 'speedo', svg: p.svg(s, s), w: s, h: s };
}

/** The glass over the speedometer: a soft shine across the top left, laid over the needle. */
export function speedoGlassArt(): Art {
  const p = pen('speedo_glass');
  p.plain = true;
  const s = SPEEDO.size;
  const c = s / 2;
  const R = SPEEDO.r;
  const shine: Pt[] = [];
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI * 1.05 + (k / 16) * Math.PI * 0.62;
    shine.push([c + Math.cos(a) * (R - 6), c + Math.sin(a) * (R - 6)]);
  }
  for (let k = 16; k >= 0; k--) {
    const a = Math.PI * 1.05 + (k / 16) * Math.PI * 0.62;
    shine.push([c + Math.cos(a) * (R - 22) + 8, c + Math.sin(a) * (R - 22) + 10]);
  }
  p.shape(shine, { fill: '#FFFFFF', stroke: null, opacity: 0.38, raw: true });
  p.ellipse(c - R * 0.48, c - R * 0.5, 7, 4, { fill: '#FFFFFF', stroke: null, opacity: 0.7 });
  return { key: 'speedo_glass', svg: p.svg(s, s), w: s, h: s };
}

/** A smaller round gauge beside the speedometer, matching it, that shows which gear you are in. */
export function gearBadgeArt(): Art {
  const p = pen('gear_badge');
  p.plain = true;
  const s = 170;
  const c = s / 2;
  const R = 58;
  p.ellipse(c, c, R + 22, R + 22, { fill: CHROME_SHADE, width: 5.5, shade: [{ pts: [[0, 0], [s * 0.62, 0], [0, s * 0.62]], color: '#F7F6EF' }, { pts: [[s, s * 0.45], [s, s], [s * 0.45, s]], color: '#A9AE9F' }] });
  p.ellipse(c, c, R + 7, R + 7, { fill: C.ink, stroke: null });
  p.ellipse(c, c, R, R, { fill: '#F3E8CF', width: 3, shade: [{ pts: [[c - R * 0.5, c - R * 0.6], [c + R * 0.5, c - R * 0.6], [c + R * 0.5, c + R * 0.4], [c - R * 0.5, c + R * 0.4]], color: C.cream }] });
  // Around the edge, a ring of little teeth, like a gear wheel.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    p.line([[c + Math.cos(a) * (R - 3), c + Math.sin(a) * (R - 3)], [c + Math.cos(a) * (R - 11), c + Math.sin(a) * (R - 11)]], { width: 3.5, color: C.teal, raw: true });
  }
  return { key: 'gear_badge', svg: p.svg(s, s), w: s, h: s };
}


/** The gear lever's gate: a metal plate with an H-shaped slot (and a third leg for reverse). */
export function gateArt(): Art {
  const p = pen('gate');
  p.plain = true;
  const w = 240;
  const h = 200;
  const c = { x: w / 2, y: h / 2 };
  p.rect(10, 10, w - 20, h - 20, { fill: '#D9D3C2', r: 26, width: 6, shade: [{ pts: [[0, h * 0.6], [w, h * 0.5], [w, h], [0, h]], color: '#C7C0AD' }] });
  const slot = (x1: number, y1: number, x2: number, y2: number) => {
    p.line([[c.x + x1, c.y + y1], [c.x + x2, c.y + y2]], { width: 26, color: C.ink, raw: true, wobble: 0.4 });
    p.line([[c.x + x1, c.y + y1], [c.x + x2, c.y + y2]], { width: 16, color: '#4A3A30', raw: true, wobble: 0.3 });
  };
  slot(-64, 0, 64, 0);
  for (const x of [-64, 0]) slot(x, -58, x, 58);
  slot(64, -58, 64, 0);
  for (const [x, y] of [[24, 24], [w - 24, 24], [24, h - 24], [w - 24, h - 24]]) p.dot(x, y, 5, C.walnut);
  return { key: 'gate', svg: p.svg(w, h), w, h };
}

/** The gear lever's knob, seen from above: a round ball with a shine. */
export function knobArt(): Art {
  const p = pen('knob');
  p.plain = true;
  p.ellipse(26, 26, 20, 20, { fill: C.terracotta, width: 5, shade: [{ pts: [[0, 30], [52, 22], [52, 52], [0, 52]], color: C.terracottaDark }] });
  p.ellipse(19, 18, 7, 5, { fill: '#F2B9A4', stroke: null });
  return { key: 'knob', svg: p.svg(52, 52), w: 52, h: 52 };
}

export function hillArt(n: number): Art {
  const key = `hill_${n}`;
  const p = pen(key);
  p.plain = true;
  const h = 260 + n * 70;
  p.shape([[-40, 520], [140, 520 - h * 0.6], [420, 520 - h], [760, 520 - h * 0.7], [1040, 520]], { fill: n % 2 ? '#7DBB8E' : '#93C79A', width: 6, stroke: '#3E8A72' });
  return { key, svg: p.svg(1000, 520), w: 1000, h: 520 };
}

export function cloudArt(n: number): Art {
  const key = `cloud_${n}`;
  const p = pen(key);
  p.plain = true;
  p.shape([[30, 120], [60, 70], [130, 60], [170, 24 + n * 6], [250, 30], [290, 74], [350, 84], [370, 124], [200, 140]], { fill: '#FFD8CF', stroke: '#E79AAE', width: 6, shade: [{ pts: [[0, 110], [400, 100], [400, 170], [0, 170]], color: '#F5B7C2' }] });
  return { key, svg: p.svg(400, 160), w: 400, h: 160 };
}

export function buttonArt(key: string, w: number, fill: string): Art {
  const p = pen(key);
  p.plain = true;
  p.rect(PAD, PAD + 8, w, 84, { fill: C.ink, r: 22, stroke: null });
  p.rect(PAD, PAD, w, 84, { fill, r: 22 });
  return { key, svg: p.svg(w + PAD * 2, 84 + PAD * 2 + 8), w: w + PAD * 2, h: 84 + PAD * 2 + 8 };
}

export function panelArt(key: string, w: number, h: number): Art {
  const p = pen(key);
  p.plain = true;
  p.rect(PAD + 6, PAD + 10, w, h, { fill: C.ink, r: 30, stroke: null, opacity: 0.35 });
  p.rect(PAD, PAD, w, h, { fill: C.cream, r: 30 });
  return { key, svg: p.svg(w + PAD * 2 + 6, h + PAD * 2 + 10), w: w + PAD * 2 + 6, h: h + PAD * 2 + 10 };
}

export function heartArt(key: string, fill: string): Art {
  const p = pen(key);
  p.plain = true;
  p.shape([[30, 54], [8, 30], [10, 14], [22, 10], [30, 20], [38, 10], [50, 14], [52, 30]], { fill, width: 4.5 });
  return { key, svg: p.svg(60, 62), w: 60, h: 62 };
}

/**
 * A stretch of road, drawn from the same heights the physics uses: a packed gravel surface with tyre ruts and
 * striped speed bumps, over layers of earth with stones, roots and the odd thing somebody buried.
 * x0 is where the stretch starts in the world, so every stretch gets its own stones, and the bumps line up.
 */
export type RoadStyle = 'meadow' | 'autumn' | 'snow' | 'town' | 'coast';
export function groundArt(key: string, pts: Pt[], depth: number, x0 = 0, features: Feature[] = FEATURES, style: RoadStyle = 'meadow'): Art {
  const p = pen(key);
  p.plain = true;
  const w = pts[pts.length - 1][0];
  let seed = Math.abs(Math.floor(x0)) + 7;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const yAt = (x: number) => {
    const k = Math.max(0, Math.min(pts.length - 2, Math.floor(x / 30)));
    const [ax, ay] = pts[k];
    const [bx, by] = pts[k + 1];
    return ay + ((by - ay) * (x - ax)) / (bx - ax || 1);
  };
  const path = (dy: (x: number) => number) => pts.map(([x, y]) => `${x.toFixed(1)} ${(y + dy(x)).toFixed(1)}`).join('L');
  const band = (dy0: (x: number) => number, dy1: (x: number) => number) =>
    `M${path(dy0)}L${pts
      .slice()
      .reverse()
      .map(([x, y]) => `${x.toFixed(1)} ${(y + dy1(x)).toFixed(1)}`)
      .join('L')}Z`;
  const wave = (a: number, f: number, ph: number) => (x: number) => Math.sin((x + x0) / f + ph) * a + Math.sin((x + x0) / (f * 0.37) + ph * 2) * a * 0.3;

  // The earth: warm at the top, darker and cooler deeper down.
  p.raw(`<defs><linearGradient id="soil${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stop-color="#C47F58"/><stop offset="0.7" stop-color="#9C5C48"/><stop offset="1" stop-color="#5E3A44"/></linearGradient></defs>`);
  p.raw(`<path d="M${path(() => 0)}L${w} ${depth}L0 ${depth}Z" fill="url(#soil${key})"/>`);
  // Strata: wavy layers of clay, each a little darker, with a pale line along the top of each.
  const layers: [number, string, number][] = [
    [70, '#B06E50', 9],
    [150, '#93594A', 14],
    [250, '#774650', 18],
  ];
  for (const [d, colour, a] of layers) {
    const edge = (x: number) => d + wave(a, 140, d)(x);
    p.raw(`<path d="${band(edge, () => depth)}" fill="${colour}" opacity="0.75"/>`);
    p.raw(`<path d="M${path(edge)}" fill="none" stroke="#E2A27A" stroke-width="2" opacity="0.35"/>`);
  }
  // Grit all through the earth.
  for (let n = 0; n < 520; n++) {
    const x = r() * w;
    const y = yAt(x) + 30 + r() * (depth - yAt(x));
    p.raw(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + r() * 1.8).toFixed(1)}" fill="${r() < 0.5 ? '#3E2433' : '#F2C49A'}" opacity="${(0.12 + r() * 0.22).toFixed(2)}"/>`);
  }
  // Roots hanging down from the verge.
  for (let n = 0; n < (style === 'town' ? 0 : 7); n++) {
    const x = r() * w;
    const y = yAt(x) + 26;
    const len = 30 + r() * 50;
    const root: Pt[] = [
      [x, y],
      [x + (r() - 0.5) * 20, y + len * 0.4],
      [x + (r() - 0.5) * 30, y + len * 0.75],
      [x + (r() - 0.5) * 34, y + len],
    ];
    p.line(root, { width: 2.4, color: '#5A3540', opacity: 0.6 });
    p.line([root[1], [root[1][0] + (r() - 0.5) * 30, root[1][1] + 16]], { width: 1.6, color: '#5A3540', opacity: 0.5 });
  }
  // Stones set into the earth, each with a shadow side and a glint.
  for (let n = 0; n < 16; n++) {
    const x = 20 + r() * (w - 40);
    const y = yAt(x) + 50 + r() * (depth - yAt(x) - 80);
    const rx = 7 + r() * 16;
    const ry = rx * (0.55 + r() * 0.3);
    const tone = ['#B7A49C', '#9C8C93', '#C9B39A', '#8C7C88'][Math.floor(r() * 4)];
    p.ellipse(x, y, rx, ry, { fill: tone, stroke: '#3E2433', width: 2.4, wobble: 1.4 });
    p.ellipse(x + rx * 0.2, y + ry * 0.3, rx * 0.7, ry * 0.45, { fill: mix(tone, '#3E2433', 0.3), stroke: null, wobble: 1 });
    p.ellipse(x - rx * 0.35, y - ry * 0.35, rx * 0.25, ry * 0.18, { fill: '#FFF0DC', stroke: null, wobble: 0.4, opacity: 0.7 });
  }
  // Now and then, something somebody buried: a bone, an old boot, a tin can.
  if (style !== 'town' && r() < 0.75) {
    const x = 200 + r() * (w - 400);
    const y = yAt(x) + 150 + r() * 160;
    const kind = Math.floor(r() * 3);
    if (kind === 0) {
      p.rect(x - 34, y - 6, 68, 12, { fill: '#F4E6CF', r: 6, width: 3 });
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) p.ellipse(x + sx * 36, y + sy * 7, 9, 8, { fill: '#F4E6CF', width: 3 });
    } else if (kind === 1) {
      p.shape([[x - 20, y - 40], [x + 6, y - 40], [x + 8, y - 4], [x + 40, y + 2], [x + 42, y + 18], [x - 22, y + 18]], { fill: '#5B3A4E', width: 3 });
      p.line([[x - 22, y + 12], [x + 42, y + 12]], { width: 3, color: '#2A2140', raw: true });
      for (let k = 0; k < 3; k++) p.line([[x - 14, y - 32 + k * 9], [x + 2, y - 32 + k * 9]], { width: 1.8, color: '#C9A88A', raw: true });
    } else {
      p.rect(x - 16, y - 22, 32, 44, { fill: '#B9BCCB', r: 4, width: 3 });
      p.rect(x - 16, y - 8, 32, 16, { fill: C.terracotta, r: 0, stroke: null });
      p.line([[x - 8, y - 22], [x - 8, y + 22]], { width: 2, color: '#FFFFFF', raw: true, opacity: 0.6 });
    }
  }
  // Under the city: a concrete slab, then the city's insides in cross-section: water mains, cable runs
  // and now and then a manhole shaft with its ladder.
  if (style === 'town') {
    p.raw(`<path d="${band(() => 24, () => 70)}" fill="#3A3650"/>`);
    for (let k = 0; k < 4; k++) p.raw(`<path d="M${path(() => 36 + k * 9)}" fill="none" stroke="#2A2640" stroke-width="2" opacity="0.6"/>`);
    for (let n = 0; n < 4; n++) {
      const x = 80 + r() * (w - 160);
      const y = yAt(x) + 110 + r() * 160;
      const rad = 14 + r() * 20;
      p.raw(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="#4A4664" stroke="#1E1A2C" stroke-width="3"/>`);
      p.raw(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(rad * 0.62).toFixed(1)}" fill="#1E1A2C"/>`);
      p.raw(`<path d="M${(x - rad * 0.7).toFixed(1)} ${(y - rad * 0.5).toFixed(1)}A${rad * 0.85} ${rad * 0.85} 0 0 1 ${(x + rad * 0.2).toFixed(1)} ${(y - rad * 0.85).toFixed(1)}" fill="none" stroke="#8A86A8" stroke-width="2.4" opacity="0.8"/>`);
    }
    const cables = ['#FF3FD0', '#3FF2FF', '#FFB43F'];
    cables.forEach((c, k) => p.raw(`<path d="M${path((x) => 92 + k * 7 + Math.sin((x + x0) / 160) * 6)}" fill="none" stroke="${c}" stroke-width="3" opacity="0.55"/>`));
    if (r() < 0.6) {
      const x = 120 + r() * (w - 240);
      const y = yAt(x);
      p.raw(`<rect x="${(x - 26).toFixed(1)}" y="${(y + 24).toFixed(1)}" width="52" height="120" fill="#1A1626"/>`);
      for (let k = 0; k < 5; k++) p.raw(`<line x1="${(x - 12).toFixed(1)}" y1="${(y + 40 + k * 20).toFixed(1)}" x2="${(x + 12).toFixed(1)}" y2="${(y + 40 + k * 20).toFixed(1)}" stroke="#5A5478" stroke-width="3"/>`);
      p.raw(`<rect x="${(x - 34).toFixed(1)}" y="${(y + 18).toFixed(1)}" width="68" height="8" fill="#5A5478"/>`);
    }
  }
  // The road itself, in the place's own surface.
  if (style === 'town' || style === 'coast') {
    // Asphalt, its edge catching light, with a painted line along it: white dashes in town, yellow on the coast.
    p.raw(`<path d="${band(() => 0, () => 24)}" fill="${style === 'town' ? '#2C2840' : '#4A4858'}"/>`);
    p.raw(`<path d="${band(() => 0, () => 4)}" fill="${style === 'town' ? '#6A6290' : '#7A788C'}"/>`);
    p.raw(`<path d="M${path(() => 13)}" fill="none" stroke="${style === 'town' ? '#E8E4FF' : '#F2C230'}" stroke-width="3.5" stroke-dasharray="60 46" opacity="0.9"/>`);
    if (style === 'town') {
      // Yellow crossings painted across the road now and then, as on Night City's streets.
      for (let cx = 300 + r() * 200; cx < w - 200; cx += 700 + r() * 300) {
        for (let k = 0; k < 6; k++) {
          const sx = cx + k * 26;
          const y = yAt(sx);
          p.raw(`<path d="M${sx.toFixed(1)} ${(y + 2).toFixed(1)}L${(sx + 14).toFixed(1)} ${(y + 2).toFixed(1)}L${(sx + 14).toFixed(1)} ${(y + 22).toFixed(1)}L${sx.toFixed(1)} ${(y + 22).toFixed(1)}Z" fill="#FCEE0A" opacity="0.85"/>`);
        }
      }
      // Wet: streaks of neon reflected in the asphalt.
      for (let n = 0; n < 26; n++) {
        const x = r() * w;
        const y = yAt(x) + 6 + r() * 12;
        const c = ['#FF3FD0', '#3FF2FF', '#FFB43F', '#B57BFF'][Math.floor(r() * 4)];
        p.raw(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(10 + r() * 30).toFixed(1)}" ry="2" fill="${c}" opacity="${(0.25 + r() * 0.3).toFixed(2)}"/>`);
      }
    } else {
      // Sand blown over the road's edge, and shells.
      for (let n = 0; n < 30; n++) {
        const x = r() * w;
        const y = yAt(x) + 2;
        p.raw(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(14 + r() * 30).toFixed(1)}" ry="${(2 + r() * 3).toFixed(1)}" fill="#F0DCAA" opacity="0.85"/>`);
      }
      for (let n = 0; n < 10; n++) {
        const x = r() * w;
        const y = yAt(x) + 40 + r() * 120;
        p.raw(`<path d="M${x.toFixed(1)} ${y.toFixed(1)}l-7 -10a9 9 0 0 1 14 0z" fill="#FFF4E6" stroke="#C9A88A" stroke-width="1.5"/>`);
      }
    }
  } else if (style === 'snow') {
    // Packed snow over ice, two tyre tracks pressed into it, and banks of snow pushed up along the edge.
    p.raw(`<path d="${band(() => 18, () => 30)}" fill="#9EC4E8" opacity="0.85"/>`);
    p.raw(`<path d="${band(() => 0, () => 20)}" fill="#E8EEFA"/>`);
    for (const dy of [7, 13]) p.raw(`<path d="M${path(() => dy)}" fill="none" stroke="#A8B0DA" stroke-width="3" stroke-dasharray="90 14" opacity="0.8"/>`);
    for (let x = r() * 40; x < w; x += 50 + r() * 60) {
      const y = yAt(x);
      const rx = 26 + r() * 30;
      const ry = 8 + r() * 8;
      p.raw(`<ellipse cx="${x.toFixed(1)}" cy="${(y + 1).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#B4BCE6"/>`);
      p.raw(`<ellipse cx="${(x - 2).toFixed(1)}" cy="${(y - 1).toFixed(1)}" rx="${(rx * 0.92).toFixed(1)}" ry="${(ry * 0.7).toFixed(1)}" fill="#F6F9FF"/>`);
    }
    for (let n = 0; n < 60; n++) {
      const x = r() * w;
      const y = yAt(x) + 2 + r() * 16;
      p.raw(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.2" fill="#FFFFFF" opacity="0.9"/>`);
    }
  } else {
    // A country lane: a dark band under the surface, then packed pale gravel on top.
    p.raw(`<path d="${band(() => 18, () => 34)}" fill="#7A4A44" opacity="0.55"/>`);
    p.raw(`<path d="${band(() => 0, () => 22)}" fill="#EDB27D"/>`);
    p.raw(`<path d="${band(() => 0, () => 6)}" fill="#F8CC97"/>`);
    for (const [dy, op] of [
      [9, 0.32],
      [15, 0.22],
    ] as const) {
      p.raw(`<path d="M${path(() => dy)}" fill="none" stroke="#9C5C48" stroke-width="2.4" stroke-dasharray="70 18 140 26" opacity="${op}"/>`);
    }
    for (let n = 0; n < 240; n++) {
      const x = r() * w;
      const y = yAt(x) + 3 + r() * 17;
      const tone = ['#B97E5E', '#FFE2BC', '#8C7C88', '#D69A6A'][Math.floor(r() * 4)];
      p.raw(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(1.2 + r() * 2.4).toFixed(1)}" ry="${(0.9 + r() * 1.4).toFixed(1)}" fill="${tone}" opacity="0.8"/>`);
    }
    // In autumn, fallen leaves all over it.
    if (style === 'autumn') {
      for (let n = 0; n < 160; n++) {
        const x = r() * w;
        const y = yAt(x) + 1 + r() * 10;
        const c = ['#E8743E', '#D8463A', '#F2B23A', '#B85A2A'][Math.floor(r() * 4)];
        const a = (r() * 180).toFixed(0);
        p.raw(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(3 + r() * 3).toFixed(1)}" ry="${(1.6 + r() * 1.2).toFixed(1)}" fill="${c}" transform="rotate(${a} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
      }
    }
  }
  // Speed bumps painted with warning stripes, so the driver sees them coming.
  for (const [fx, fh, fw] of features) {
    if (fh <= 0 || fh > 60) continue;
    const lx = fx - x0;
    if (lx < -fw * 2 || lx > w + fw * 2) continue;
    for (let k = -4; k <= 4; k++) {
      const sx = lx + k * fw * 0.42;
      if (sx < 4 || sx > w - 14) continue;
      const y = yAt(sx);
      p.raw(`<path d="M${(sx - 9).toFixed(1)} ${(y + 1).toFixed(1)}L${(sx + 5).toFixed(1)} ${(y + 1).toFixed(1)}L${(sx + 13).toFixed(1)} ${(y + 19).toFixed(1)}L${(sx - 1).toFixed(1)} ${(y + 19).toFixed(1)}Z" fill="${k % 2 ? '#2A2140' : '#FFC94A'}" opacity="0.9"/>`);
    }
  }
  // Potholes: dark puddles of muddy water with a bright glint.
  for (const [fx, fh, fw0] of features) {
    const fw = Math.max(fw0, (-fh * 0.86) / 0.24);
    if (fh >= 0 || fh < -70) continue;
    const lx = fx - x0;
    if (lx < 0 || lx > w) continue;
    const y = yAt(lx);
    p.ellipse(lx, y + 8, fw * 0.75, 7, { fill: '#5E4A6E', stroke: '#2A2140', width: 2, wobble: 1 });
    p.line([[lx - fw * 0.3, y + 6], [lx + fw * 0.05, y + 5]], { width: 2.4, color: '#D7C6F0', raw: true, opacity: 0.8 });
  }
  p.line(pts.map(([x, y]) => [x, y + 22] as Pt), { width: 2.5, raw: true, opacity: 0.3, wobble: 1 });
  p.line(pts, { width: 7, raw: true, wobble: 1.2 });
  return { key, svg: p.svg(w, depth), w, h: depth };
}

export function farHillArt(n: number): Art {
  const key = `far_${n}`;
  const p = pen(key);
  p.plain = true;
  const h = 300 + n * 90;
  p.shape([[-40, 560], [180, 560 - h * 0.7], [520, 560 - h], [900, 560 - h * 0.55], [1240, 560]], { fill: n % 2 ? '#B9A3D6' : '#A48FCB', width: 5, stroke: '#9580BE' });
  return { key, svg: p.svg(1200, 560), w: 1200, h: 560 };
}

export function sunArt(): Art {
  const p = pen('sun');
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    p.line([[130 + Math.cos(a) * 82, 130 + Math.sin(a) * 82], [130 + Math.cos(a) * 112, 130 + Math.sin(a) * 112]], { width: 6, color: '#FFB86B', raw: true });
  }
  p.ellipse(130, 130, 62, 62, { fill: '#FFD67A', stroke: '#FF9E5E', width: 6 });
  return { key: 'sun', svg: p.svg(260, 260), w: 260, h: 260 };
}

/** A stretch of grass on the far side of the road. Its edge lines up with itself, so pieces can sit side by side. */
export function fieldArt(): Art {
  const p = pen('field');
  p.plain = true;
  const top: Pt[] = [];
  for (let x = 0; x <= 1000; x += 50) top.push([x, 24 + Math.sin((x / 1000) * Math.PI * 4) * 5]);
  p.raw(`<path d="M${top.map(([x, y]) => `${x} ${y.toFixed(1)}`).join('L')}L1000 320L0 320Z" fill="#8FC99A"/>`);
  p.line(top, { width: 5, color: C.sage, raw: true, wobble: 0 });
  return { key: 'field', svg: p.svg(1000, 320), w: 1000, h: 320 };
}

/** Houses across the road: a cottage, a tall house and a shop. */
export function townArt(n: number): Art {
  const key = `town_${n}`;
  const p = pen(key);
  const line = { stroke: FAR_LINE, width: 5 };
  const pane = { fill: '#FFE3A3', r: 3, stroke: FAR_LINE, width: 4 };
  const door = { fill: '#8A5A6E', r: 4, ...line };
  if (n === 0) {
    p.rect(30, 130, 220, 150, { fill: '#F6C9B6', r: 4, ...line });
    p.shape([[14, 138], [140, 40], [266, 138]], { fill: '#C66B7A', raw: true, ...line });
    p.rect(120, 200, 44, 80, door);
    p.rect(54, 170, 44, 44, pane);
    p.rect(190, 170, 44, 44, pane);
  } else if (n === 1) {
    p.rect(60, 70, 160, 210, { fill: '#B8D8E8', r: 4, ...line });
    p.shape([[46, 78], [140, 14], [234, 78]], { fill: '#7E6BB0', raw: true, ...line });
    for (const [x, y] of [[84, 100], [156, 100], [84, 162], [156, 162]]) p.rect(x, y, 40, 44, pane);
    p.rect(118, 224, 44, 56, door);
  } else {
    p.rect(20, 120, 240, 160, { fill: '#F3D9A0', r: 4, ...line });
    p.rect(20, 96, 240, 30, { fill: '#6CB8D8', r: 4, ...line });
    p.shape([[30, 150], [250, 150], [262, 186], [18, 186]], { fill: '#C66B7A', raw: true, ...line });
    p.rect(44, 198, 100, 58, pane);
    p.rect(176, 198, 50, 82, door);
  }
  return { key, svg: p.svg(280, 290), w: 280, h: 290 };
}

export function fenceArt(): Art {
  const p = pen('fence');
  p.line([[6, 34], [294, 34]], { width: 6, color: FAR_LINE, raw: true });
  p.line([[6, 62], [294, 62]], { width: 6, color: FAR_LINE, raw: true });
  for (let x = 16; x < 280; x += 38) p.shape([[x, 90], [x, 22], [x + 9, 10], [x + 18, 22], [x + 18, 90]], { fill: '#FFF1E0', raw: true, stroke: FAR_LINE, width: 4 });
  return { key: 'fence', svg: p.svg(300, 96), w: 300, h: 96 };
}

/** A telephone pole and the wires that sag across to the next one, 700 away. */
export function poleArt(): Art {
  const p = pen('pole');
  const sag = (y: number): Pt[] => {
    const pts: Pt[] = [];
    for (let x = 30; x <= 730; x += 50) pts.push([x, y + Math.sin(((x - 30) / 700) * Math.PI) * 46]);
    return pts;
  };
  p.line(sag(38), { width: 3, color: FAR_LINE, raw: true, wobble: 0 });
  p.line(sag(60), { width: 3, color: FAR_LINE, raw: true, wobble: 0 });
  p.rect(22, 20, 16, 330, { fill: '#6E4A68', r: 3, stroke: FAR_LINE, width: 4 });
  p.rect(0, 30, 60, 12, { fill: '#6E4A68', r: 3, stroke: FAR_LINE, width: 4 });
  return { key: 'pole', svg: p.svg(740, 350), w: 740, h: 350 };
}

export function lampPostArt(): Art {
  const p = pen('lamppost');
  p.rect(40, 60, 14, 330, { fill: C.dusk, r: 4 });
  p.line([[47, 62], [47, 30], [96, 26]], { width: 9 });
  p.shape([[84, 24], [124, 24], [116, 52], [92, 52]], { fill: C.sticky, raw: true, width: 5 });
  p.rect(30, 380, 34, 16, { fill: C.dusk, r: 4, width: 5 });
  return { key: 'lamppost', svg: p.svg(140, 400), w: 140, h: 400 };
}

export function bushArt(n: number): Art {
  const key = `bush_${n}`;
  const p = pen(key);
  p.shape([[10, 110], [14, 66], [44, 40], [70, 52], [96, 22], [140, 30], [160, 64], [196, 70], [206, 110]], { fill: n ? C.sage : C.sageDark, shade: [{ pts: [[120, 0], [220, 0], [220, 120], [150, 120]], color: n ? C.sageDark : C.moss }] });
  return { key, svg: p.svg(216, 116), w: 216, h: 116 };
}

export function tuftArt(n: number): Art {
  const key = `tuft_${n}`;
  const p = pen(key);
  const blades: Pt[][] = n ? [[[20, 56], [14, 20]], [[30, 56], [32, 8]], [[40, 56], [52, 22]]] : [[[16, 46], [8, 18]], [[26, 46], [24, 6]], [[36, 46], [40, 14]], [[44, 46], [56, 26]]];
  for (const b of blades) p.line(b, { width: 6, color: C.moss, raw: true });
  return { key, svg: p.svg(64, 60), w: 64, h: 60 };
}

export function flowerArt(n: number): Art {
  const key = `flower_${n}`;
  const p = pen(key);
  p.line([[30, 84], [28, 40]], { width: 5, color: C.moss, raw: true });
  p.line([[29, 62], [44, 52]], { width: 5, color: C.moss, raw: true });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    p.ellipse(28 + Math.cos(a) * 12, 28 + Math.sin(a) * 12, 9, 9, { fill: n ? C.cream : C.terracotta, width: 3.5 });
  }
  p.dot(28, 28, 6, C.mustard);
  return { key, svg: p.svg(60, 88), w: 60, h: 88 };
}

/** Small marks in the earth under the road: a stone, a crack, a smaller stone. */
export function pebbleArt(n: number): Art {
  const key = `pebble_${n}`;
  const p = pen(key);
  if (n === 0) p.ellipse(22, 16, 14, 9, { fill: C.woodLine, stroke: C.woodDark, width: 3.5 });
  else if (n === 1) p.line([[6, 14], [40, 12]], { width: 4, color: C.woodDark, raw: true, opacity: 0.7 });
  else p.ellipse(14, 12, 7, 6, { fill: C.oat, stroke: C.woodDark, width: 3 });
  return { key, svg: p.svg(46, 30), w: 46, h: 30 };
}

/** Whether this browser can blur a canvas drawing. Safari could not for a long time. */
const CAN_BLUR = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;

export type EyeMood = 'open' | 'blink' | 'squint' | 'wide' | 'happy';
export const EYE_MOODS: EyeMood[] = ['open', 'blink', 'squint', 'wide', 'happy'];

/** The truck's headlight is its eye. It looks ahead, blinks, strains at high revs and pops wide when jolted. */
export function eyeArt(mood: EyeMood): Art {
  const key = `eye_${mood}`;
  const p = pen(key);
  p.plain = true;
  const c = 24;
  if (mood === 'blink') {
    p.ellipse(c, c, 12, 15, { fill: '#D88466', width: 3.5 });
    p.line([[c - 10, c + 1], [c, c + 5], [c + 10, c + 1]], { width: 3.5 });
  } else if (mood === 'happy') {
    p.ellipse(c, c, 12, 15, { fill: '#D88466', width: 3.5 });
    p.line([[c - 8, c + 4], [c, c - 5], [c + 8, c + 4]], { width: 4 });
  } else {
    const r = mood === 'wide' ? 1.15 : 1;
    p.ellipse(c, c, 12 * r, 15 * r, { fill: C.cream, width: 3.5 });
    p.dot(c + 4, c + (mood === 'squint' ? 3 : 0), mood === 'wide' ? 3.6 : 5.2);
    p.dot(c + 2, c - 4, 1.8, '#FFFFFF');
    if (mood === 'squint') {
      p.shape([[c - 13, c - 16], [c + 13, c - 16], [c + 13, c - 2], [c - 13, c + 1]], { fill: '#D88466', raw: true, width: 3.5 });
    }
  }
  return { key, svg: p.svg(48, 48), w: 48, h: 48 };
}

/** A pine-tree air freshener on a string. It swings from the cab roof as the truck speeds up and slows down. */
export function freshenerArt(): Art {
  const p = pen('freshener');
  p.line([[16, 2], [16, 22]], { width: 2.5, raw: true });
  p.shape([[16, 18], [27, 36], [21, 36], [30, 52], [2, 52], [11, 36], [5, 36]], { fill: C.sage, raw: true, width: 3, shade: [{ pts: [[16, 10], [34, 10], [34, 60], [16, 60]], color: C.sageDark }] });
  p.rect(13, 52, 6, 6, { fill: C.walnut, r: 1, width: 2.5 });
  return { key: 'freshener', svg: p.svg(32, 62), w: 32, h: 62 };
}

/** A whip aerial with a pennant, standing up from the bonnet. It leans back with speed and wobbles on bumps. */
export function aerialArt(): Art {
  const p = pen('aerial');
  p.line([[10, 96], [10, 10]], { width: 3.5, raw: true });
  p.shape([[10, 10], [44, 18], [10, 28]], { fill: C.mustard, raw: true, width: 3.5 });
  p.dot(10, 96, 4);
  return { key: 'aerial', svg: p.svg(52, 100), w: 52, h: 100 };
}

/** The rev counter's face: 0 to 7 thousand rpm round a three-quarter circle, with the red zone marked. */
export const TACH = { r: 108, from: Math.PI * 0.75, sweep: Math.PI * 1.5, max: 7000 };
export function tachArt(): Art {
  const p = pen('tach');
  p.plain = true;
  const s = 260;
  const c = s / 2;
  p.ellipse(c, c, TACH.r + 10, TACH.r + 10, { fill: C.cream, width: 7 });
  const at = (rpm: number, rad: number): Pt => {
    const a = TACH.from + (rpm / TACH.max) * TACH.sweep;
    return [c + Math.cos(a) * rad, c + Math.sin(a) * rad];
  };
  // The red zone, from the redline to the end of the dial.
  const red: Pt[] = [];
  for (let r = 5800; r <= 7000; r += 100) red.push(at(r, TACH.r - 6));
  for (let r = 7000; r >= 5800; r -= 100) red.push(at(r, TACH.r - 24));
  p.shape(red, { fill: C.terracotta, raw: true, stroke: null });
  for (let k = 0; k <= 7; k++) {
    p.line([at(k * 1000, TACH.r - 2), at(k * 1000, TACH.r - 22)], { width: 5, raw: true });
    if (k < 7) p.line([at(k * 1000 + 500, TACH.r - 4), at(k * 1000 + 500, TACH.r - 14)], { width: 3, raw: true, opacity: 0.6 });
  }
  return { key: 'tach', svg: p.svg(s, s), w: s, h: s };
}

/** Turns a drawing into a texture Phaser can use. */
export function loadArt(textures: Phaser.Textures.TextureManager, art: Art): Promise<void> {
  return new Promise((resolve, reject) => {
    if (textures.exists(art.key)) return resolve();
    const img = new Image();
    img.onload = () => {
      if (art.blur && CAN_BLUR) {
        const canvas = document.createElement('canvas');
        canvas.width = art.w;
        canvas.height = art.h;
        const ctx = canvas.getContext('2d')!;
        ctx.filter = `blur(${art.blur}px)`;
        // Scenery that tiles sideways is blurred with its neighbours either side, so its edges match up.
        const tiles = art.w === 2400;
        for (const dx of tiles ? [-art.w, 0, art.w] : [0]) ctx.drawImage(img, dx, 0, art.w, art.h);
        textures.addCanvas(art.key, canvas);
      } else {
        textures.addImage(art.key, img);
      }
      resolve();
    };
    img.onerror = () => reject(new Error(`could not draw ${art.key}`));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(art.svg)}`;
  });
}

export type CursorKind = 'point' | 'open' | 'grab' | 'rope';
export const CURSOR_KINDS: CursorKind[] = ['point', 'open', 'grab', 'rope'];
/** Where in each 48-pixel cursor picture the click lands. */
export const CURSOR_HOTSPOT: Record<CursorKind, [number, number]> = { point: [5, 4], open: [22, 24], grab: [24, 26], rope: [24, 24] };

/**
 * The game's own mouse pointers, as cartoon gloves: an arrow with a cuff, an open glove over things you can
 * pick up, a fist while carrying, and a lasso for roping. Each has a soft drop shadow so it reads on any colour.
 */
export function cursorArt(kind: CursorKind): Art {
  const key = `cursor_${kind}`;
  const p = new Pen(key, 0, 0);
  p.plain = true;
  p.steady = true;
  const GLOVE = '#FFFDF6';
  const FOLD = '#D9CFE0';
  const CUFF = C.terracotta;
  const INK = C.ink;
  const o = { width: 3, wobble: 0 };
  /** Draws a shape twice: a soft shadow down and to the right, then the shape itself. */
  const solid = (pts: Pt[], fill: string, raw = true) => {
    p.shape(pts.map(([x, y]) => [x + 2, y + 3] as Pt), { fill: '#2A2140', stroke: null, raw, wobble: 0, opacity: 0.28 });
    p.shape(pts, { fill, stroke: INK, raw, ...o });
  };
  const rr = (x: number, y: number, w: number, h: number, r: number): Pt[] => {
    const pts: Pt[] = [];
    const corner = (cx: number, cy: number, a0: number) => {
      for (let i = 0; i <= 4; i++) {
        const a = a0 + (i / 4) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    corner(x + w - r, y + r, -Math.PI / 2);
    corner(x + w - r, y + h - r, 0);
    corner(x + r, y + h - r, Math.PI / 2);
    corner(x + r, y + r, Math.PI);
    return pts;
  };

  if (kind === 'point') {
    // A crisp arrow with a little cuff band, so it belongs with the gloves.
    const arrow: Pt[] = [[5, 4], [5, 38], [14, 30], [20, 43], [27, 40], [21, 27], [33, 27]];
    solid(arrow, GLOVE);
    p.shape([[9, 13], [9, 28], [13, 25]], { fill: FOLD, stroke: null, raw: true, wobble: 0 });
    p.line([[14, 31], [21, 28]], { width: 4.5, color: CUFF, raw: true, wobble: 0 });
  } else if (kind === 'open') {
    // An open glove, fingers spread, ready to grab.
    for (const [x, top, tilt] of [[13, 8, -3], [20, 4, -1], [27, 5, 1], [34, 10, 3]] as const) {
      const f = rr(x - 3.6, top, 7.2, 22, 3.6).map(([px, py]) => [px + ((py - top) / 22) * -tilt, py] as Pt);
      solid(f, GLOVE);
    }
    solid([[4, 27], [8, 21], [13, 22], [17, 30], [12, 34]], GLOVE, false);
    solid(rr(8, 21, 31, 19, 8), GLOVE);
    for (const x of [16.5, 23.5, 30.5]) p.line([[x, 22], [x, 27]], { width: 1.6, color: FOLD, raw: true, wobble: 0 });
    // The cuff.
    solid(rr(12, 38, 24, 8, 3), CUFF);
  } else if (kind === 'grab') {
    // A fist, gripping.
    solid(rr(9, 14, 30, 24, 10), GLOVE);
    for (const x of [16, 23, 30]) p.line([[x, 15], [x + 1, 23]], { width: 2.2, color: INK, raw: true, wobble: 0 });
    p.line([[12, 30], [36, 30]], { width: 1.6, color: FOLD, raw: true, wobble: 0 });
    solid([[6, 24], [12, 20], [19, 26], [15, 33], [8, 31]], GLOVE, false);
    solid(rr(13, 36, 22, 8, 3), CUFF);
  } else {
    // A lasso: a loop of rope with a knot, and a target dot in the middle to aim with.
    p.ellipse(26, 27, 16, 13, { stroke: '#2A2140', width: 9, wobble: 0, opacity: 0.25 });
    p.ellipse(24, 24, 16, 13, { stroke: INK, width: 9, wobble: 0 });
    p.ellipse(24, 24, 16, 13, { stroke: '#D9B67E', width: 5, wobble: 0 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      p.line([[24 + Math.cos(a) * 14, 24 + Math.sin(a) * 11.5], [24 + Math.cos(a + 0.3) * 18, 24 + Math.sin(a + 0.3) * 14.5]], { width: 1.4, color: '#8C6A3E', raw: true, wobble: 0 });
    }
    p.ellipse(38, 33, 5, 4, { fill: '#D9B67E', stroke: INK, width: 2.5, wobble: 0 });
    const tail: Pt[] = [[40, 35], [44, 40], [41, 45], [46, 47]];
    p.line(tail, { width: 6, color: INK, wobble: 0 });
    p.line(tail, { width: 3, color: '#D9B67E', wobble: 0 });
    p.dot(24, 24, 4.5, INK);
    p.dot(24, 24, 3, CUFF);
  }
  return { key, svg: p.svg(48, 48), w: 48, h: 48 };
}

/**
 * The driver, drawn the way cartoon drivers are on the reference boards: a big head that fills the
 * window, a strong silhouette (a red knit beanie with a pompom, a tuft of hair escaping at the back), a
 * face turned three-quarters towards the road so both eyes read, a button nose sticking out past the
 * cheek, and the acting done by thick eyebrows, eye shapes and the mouth. A mustard jacket, the arm out
 * along the sill and a mitten gripping the door.
 *  - calm: a soft smile;  blink;  whistle: eyes shut, lips pursed;
 *  - strain: eyes screwed up, teeth gritted (high revs);  worried: brows up, glancing back at the load;
 *  - panic: eyes huge, mouth wide, beanie and hair flying up;  happy: a big grin;
 *  - surprised: eyes round, a little "o" (a jolt);  cool: half-lidded and smug (flying along in top gear).
 */
export type DriverMood = 'calm' | 'blink' | 'whistle' | 'strain' | 'worried' | 'panic' | 'happy' | 'surprised' | 'cool';
export const DRIVER_MOODS: DriverMood[] = ['calm', 'blink', 'whistle', 'strain', 'worried', 'panic', 'happy', 'surprised', 'cool'];
export const DRIVER = { w: 150, h: 150, head: { x: 70, y: 66 } };
export function driverArt(mood: DriverMood): Art {
  const key = `driver_${mood}`;
  const p = pen(key);
  const { x: cx, y: cy } = DRIVER.head;
  const SKIN = '#FFD3AE';
  const SKIN_SHADE = '#EFAE88';
  const JACKET = C.mustard;
  const JACKET_SHADE = '#D99A2E';
  const HAT = '#D9483A';
  const HAT_SHADE = '#B23A30';
  const HAIR = '#5A3A2E';
  const INK = C.ink;
  const limb = (pts: Pt[], colour: string, thick: number) => {
    p.line(pts, { width: thick + 8, raw: true, wobble: 0.3 });
    p.line(pts, { width: thick, color: colour, raw: true, wobble: 0.3 });
  };
  const panic = mood === 'panic';
  // The beanie sits high, so the brows and eyes stay clear of it; it jumps when they do.
  const up = (panic ? -12 : mood === 'surprised' ? -5 : 0) - 11;
  // Jacket shoulders, down to the sill, with a collar.
  p.shape([[cx - 36, cy + 31], [cx - 32, cy + 20], [cx - 14, cy + 14], [cx + 14, cy + 14], [cx + 30, cy + 20], [cx + 34, cy + 31]], { fill: JACKET, width: 4.5, shade: [{ pts: [[cx + 6, cy + 8], [cx + 44, cy + 8], [cx + 44, cy + 36], [cx + 10, cy + 36]], color: JACKET_SHADE }] });
  p.shape([[cx - 12, cy + 14], [cx + 2, cy + 26], [cx + 14, cy + 14]], { fill: '#F4F0E6', raw: true, width: 3 });
  // The arm along the sill, and a mitten gripping the door.
  limb([[cx + 18, cy + 24], [cx + 46, cy + 27], [cx + 62, cy + 30]], JACKET, 17);
  limb([[cx + 63, cy + 33], [cx + 64, cy + 50]], JACKET, 14);
  p.ellipse(cx + 64, cy + 58, 11, 10, { fill: HAT, width: 4 });
  p.ellipse(cx + 56, cy + 53, 5, 6, { fill: HAT, width: 3 });
  // Hair escaping at the back, standing on end in a panic.
  if (panic) p.shape([[cx - 34, cy + 6], [cx - 44, cy - 10], [cx - 32, cy - 6], [cx - 38, cy - 22], [cx - 24, cy - 12], [cx - 22, cy + 8]], { fill: HAIR, raw: true, width: 3.5 });
  else p.shape([[cx - 32, cy + 12], [cx - 40, cy + 2], [cx - 34, cy - 6], [cx - 24, cy - 2], [cx - 22, cy + 10]], { fill: HAIR, width: 3.5 });
  // The head: round, with a little chin forward.
  p.shape([[cx - 30, cy - 6], [cx - 22, cy - 26], [cx, cy - 31], [cx + 22, cy - 24], [cx + 31, cy - 4], [cx + 29, cy + 16], [cx + 18, cy + 27], [cx - 2, cy + 30], [cx - 22, cy + 22], [cx - 31, cy + 8]], {
    fill: SKIN,
    width: 4.5,
    shade: [{ pts: [[cx - 40, cy + 16], [cx + 40, cy + 14], [cx + 40, cy + 40], [cx - 40, cy + 40]], color: SKIN_SHADE }],
  });
  // An ear at the back of the head.
  p.ellipse(cx - 24, cy + 6, 7, 9, { fill: SKIN, width: 3.5 });
  p.line([[cx - 25, cy + 2], [cx - 23, cy + 9]], { width: 2.4, color: SKIN_SHADE, raw: true });
  // The beanie: a dome with a folded, ribbed band, and a pompom that jumps when they jump.
  p.shape([[cx - 32, cy - 6 + up], [cx - 26, cy - 26 + up], [cx - 6, cy - 38 + up], [cx + 14, cy - 36 + up], [cx + 30, cy - 22 + up], [cx + 33, cy - 6 + up]], { fill: HAT, width: 4.5, shade: [{ pts: [[cx + 8, cy - 50], [cx + 44, cy - 50], [cx + 44, cy], [cx + 8, cy]], color: HAT_SHADE }] });
  p.rect(cx - 34, cy - 12 + up, 69, 13, { fill: '#F4F0E6', r: 5, width: 4 });
  for (let k = 0; k < 8; k++) p.line([[cx - 28 + k * 8, cy - 10 + up], [cx - 28 + k * 8, cy - 1 + up]], { width: 2, color: '#C9C2B4', raw: true });
  p.ellipse(cx - 12, cy - 42 + up * 1.6, 10, 9, { fill: '#F4F0E6', width: 3.5 });
  // Cheeks: rosy, rosier when happy or straining.
  const blush = mood === 'happy' || mood === 'strain' ? 0.9 : 0.55;
  p.ellipse(cx + 24, cy + 14, 6, 4, { fill: '#F48C86', stroke: null, opacity: blush });
  p.ellipse(cx - 8, cy + 15, 5, 3.5, { fill: '#F48C86', stroke: null, opacity: blush });
  // Eyes: the near one (left) a little bigger than the far one, three-quarters view.
  const eyes: [number, number, number][] = [
    [cx + 2, cy + 3, 1],
    [cx + 20, cy + 3, 0.85],
  ];
  for (const [ex, ey, k] of eyes) {
    const rx = 7.5 * k;
    const ry = 9 * k;
    if (mood === 'blink') p.line([[ex - rx, ey + 1], [ex, ey + 4], [ex + rx, ey + 1]], { width: 4 });
    else if (mood === 'happy' || mood === 'whistle') p.line([[ex - rx, ey + 3], [ex, ey - 4], [ex + rx, ey + 3]], { width: 4 });
    else if (mood === 'strain') p.line([[ex - rx, ey - 4], [ex + rx * 0.6, ey + 1], [ex - rx, ey + 5]].map(([x, y]): Pt => [ex + (x - ex) * (ex > cx + 10 ? -1 : 1), y]), { width: 4 });
    else {
      const big = panic ? 1.35 : mood === 'surprised' ? 1.2 : 1;
      p.ellipse(ex, ey, rx * big, ry * big, { fill: '#FFFFFF', width: 3.5 });
      const look = mood === 'worried' ? -3 : panic || mood === 'surprised' ? 0 : 2.5;
      const pr = panic ? 2.2 : mood === 'surprised' ? 3 : 4.2;
      p.dot(ex + look, ey + 1, pr * k, INK);
      if (!panic) p.dot(ex + look + 1.6, ey - 1.8, 1.4 * k, '#FFFFFF');
      // Lids: half down when cool.
      if (mood === 'cool') p.shape([[ex - rx - 2, ey - 1], [ex - rx - 2, ey - ry - 3], [ex + rx + 2, ey - ry - 3], [ex + rx + 2, ey - 1]], { fill: SKIN, raw: true, width: 3.5 });
    }
  }
  // Eyebrows: thick, tapered shapes, doing most of the acting. [inner lift, outer lift] for each.
  const brow: Record<DriverMood, [number, number]> = { calm: [0, 0], blink: [0, 0], whistle: [-2, -2], strain: [5, -3], worried: [-7, 3], panic: [-12, -8], happy: [-4, -4], surprised: [-9, -7], cool: [2, -5] };
  const [inner, outer] = brow[mood];
  for (const [ex, ey, k] of eyes) {
    const far = ex > cx + 10;
    const inX = far ? ex - 7 * k : ex + 7 * k;
    const outX = far ? ex + 8 * k : ex - 8 * k;
    const by = ey - 14 * k;
    // The far brow in 'cool' goes up (one raised eyebrow); the near one stays level.
    const raise = mood === 'cool' && far ? -5 : 0;
    p.shape([[outX, by + outer + raise], [inX, by + inner + raise], [inX, by + inner + raise + 4], [outX, by + outer + raise + 3]], { fill: HAIR, raw: true, width: 2.5 });
  }
  // The button nose, sticking out past the cheek.
  p.ellipse(cx + 30, cy + 12, 7, 6, { fill: SKIN, width: 3.5, shade: [{ pts: [[cx + 22, cy + 14], [cx + 40, cy + 14], [cx + 40, cy + 22], [cx + 22, cy + 22]], color: SKIN_SHADE }] });
  // The mouth.
  const mx = cx + 15;
  const my = cy + 21;
  if (panic) {
    p.shape([[mx - 9, my - 4], [mx + 9, my - 4], [mx + 7, my + 9], [mx - 7, my + 9]], { fill: '#7A2A3A', width: 3.5 });
    p.rect(mx - 7, my - 3, 14, 4, { fill: '#FFFFFF', r: 1, stroke: null });
  } else if (mood === 'happy') {
    p.shape([[mx - 11, my - 3], [mx + 11, my - 3], [mx + 6, my + 7], [mx - 6, my + 7]], { fill: '#7A2A3A', width: 3.5 });
    p.ellipse(mx, my + 4, 5, 3, { fill: '#F27A7A', stroke: null });
  } else if (mood === 'strain') {
    p.rect(mx - 10, my - 4, 20, 9, { fill: '#FFFFFF', r: 2, width: 3 });
    for (const dx of [-4, 1, 6]) p.line([[mx + dx, my - 4], [mx + dx, my + 5]], { width: 1.8 });
  } else if (mood === 'surprised') p.ellipse(mx, my + 1, 4.5, 5, { fill: '#7A2A3A', width: 3 });
  else if (mood === 'whistle') p.ellipse(mx + 4, my, 3.2, 3.2, { fill: '#7A2A3A', width: 3 });
  else if (mood === 'worried') p.line([[mx - 8, my + 1], [mx - 3, my - 1], [mx + 2, my + 2], [mx + 7, my - 1]], { width: 3.5 });
  else if (mood === 'cool') p.line([[mx - 6, my + 1], [mx + 2, my + 3], [mx + 9, my - 3]], { width: 3.5 });
  else p.line([[mx - 7, my], [mx, my + 4], [mx + 7, my]], { width: 3.5 });
  // Sweat when it is going wrong.
  if (panic || mood === 'strain' || mood === 'worried') p.shape([[cx - 18, cy - 4], [cx - 13, cy + 6], [cx - 18, cy + 10], [cx - 23, cy + 6]], { fill: '#BFEAF6', width: 2.5 });
  return { key, svg: p.svg(DRIVER.w, DRIVER.h), w: DRIVER.w, h: DRIVER.h };
}

/** A red jerrycan of fuel, with its handles and a cap, standing by the road. */
export function fuelCanArt(): Art {
  const p = pen('fuel_can');
  p.rect(14, 22, 62, 78, { fill: '#D8403A', r: 8, width: 4.5, shade: [{ pts: [[50, 10], [90, 10], [90, 110], [52, 110]], color: '#A82E2E' }] });
  p.rect(22, 8, 30, 16, { fill: '#D8403A', r: 6, width: 4 });
  p.rect(28, 12, 18, 7, { fill: C.cream, r: 3, stroke: null });
  p.rect(56, 10, 14, 14, { fill: '#B9BCCB', r: 3, width: 3.5 });
  p.line([[22, 44], [68, 80]], { width: 4, color: '#A82E2E', raw: true });
  p.line([[68, 44], [22, 80]], { width: 4, color: '#A82E2E', raw: true });
  p.rect(26, 54, 38, 16, { fill: C.cream, r: 4, width: 3 });
  p.line([[33, 62], [57, 62]], { width: 3, color: '#D8403A', raw: true });
  return { key: 'fuel_can', svg: p.svg(92, 110), w: 92, h: 110 };
}

/** A winch post: a yellow-and-black bollard with a steel ring on top, and a little sign with a hook on it. */
export function winchPostArt(): Art {
  const p = pen('winch_post');
  const w = 120;
  const h = 200;
  p.rect(48, 50, 26, 150, { fill: C.mustard, r: 5, width: 4.5 });
  for (let y = 70; y < 190; y += 34) p.shape([[48, y], [74, y - 12], [74, y + 2], [48, y + 14]], { fill: '#2A2140', raw: true, stroke: null });
  p.ellipse(61, 36, 18, 18, { fill: 'none', stroke: '#9AA0B5', width: 7 } as never);
  p.ellipse(61, 36, 18, 18, { stroke: C.ink, width: 2.5 });
  p.rect(76, 96, 40, 34, { fill: '#2E6AD8', r: 4, width: 3.5 });
  p.line([[96, 104], [96, 118], [90, 122], [86, 116]], { width: 3, color: '#FFFFFF' });
  return { key: 'winch_post', svg: p.svg(w, h), w, h };
}

/**
 * A roll of bubble wrap, blown off another mover's van somewhere up the road: a fat translucent roll, its
 * end showing the spiral, bubbles all over it, and a strip of tape where it came loose.
 */
export function bubbleWrapArt(): Art {
  const p = pen('bubble_wrap');
  const w = 110;
  const h = 80;
  p.rect(14, 16, 74, 50, { fill: '#CFEFFF', r: 24, width: 4, shade: [{ pts: [[0, 50], [w, 50], [w, h], [0, h]], color: '#A8D8EE' }] });
  for (let row = 0; row < 3; row++) for (let k = 0; k < 5; k++) p.ellipse(28 + k * 13 + (row % 2) * 6, 26 + row * 13, 4.5, 4.5, { fill: '#EAF8FF', width: 1.6 });
  p.ellipse(88, 41, 15, 25, { fill: '#DDF4FF', width: 4 });
  p.line([[88, 41], [92, 36], [86, 30], [80, 40], [88, 52], [97, 42]], { width: 2, color: '#8ABCD6' });
  // The loose end of the sheet, flapping off the roll, and its tape.
  p.shape([[16, 40], [2, 52], [8, 70], [24, 62]], { fill: '#CFEFFF', raw: true, width: 3, opacity: 0.9 });
  p.rect(40, 12, 24, 10, { fill: '#D8B068', r: 2, width: 2.5, opacity: 0.95 });
  p.ellipse(34, 24, 9, 4, { fill: '#FFFFFF', stroke: null, opacity: 0.8 });
  return { key: 'bubble_wrap', svg: p.svg(w, h), w, h };
}
