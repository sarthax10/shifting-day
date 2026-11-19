import { C, Pen, ellipsePts, mix, type Pt } from './ink';
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
export const BOIL_FRAMES = 2;
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
  p.rect(x, y, w, h, { fill: '#E8B878', r: 4, shade: [{ pts: [[x + w * 0.7, y], [x + w, y], [x + w, y + h], [x + w * 0.76, y + h]], color: '#C98A48' }] });
  p.line([[x + 3, y + h * 0.18], [x + w - 3, y + h * 0.18]], { width: 2.5, opacity: 0.45, raw: true });
  p.rect(x + w * 0.42, y + 2, w * 0.16, h * 0.5, { fill: '#FF6A30', stroke: null, r: 1, opacity: 0.95 });
  p.rect(x + w * 0.38, y + h * 0.36, w * 0.24, h * 0.1, { fill: '#0A0712', r: 3, width: 2 });
  p.rect(x + w * 0.1, y + h * 0.6, w * 0.3, h * 0.22, { fill: '#F3E3CC', r: 2, width: 2.5 });
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
      const fabric = '#7A2440';
      const light = '#A8384A';
      p.rect(x + 22, y, w - 44, h * 0.66, { fill: fabric, r: 20, shade: [{ pts: [[x, y + h * 0.4], [x + w, y + h * 0.36], [x + w, y + h], [x, y + h]], color: '#5A1A3A' }] });
      for (let i = 0; i < 3; i++) p.line([[x + 40 + i * (w - 80) / 2, y + 14], [x + 40 + i * (w - 80) / 2, y + h * 0.4]], { width: 2.5, opacity: 0.4, raw: true });
      const seat = (sx: number) => p.rect(sx, y + h * 0.44, (w - 72) / 2 - 2, h * 0.3, { fill: light, r: 12, width: 4.5 });
      seat(x + 36);
      seat(x + w / 2 + 2);
      p.rect(x, y + h * 0.3, 42, h * 0.58, { fill: fabric, r: 18, shade: [{ pts: [[x + 24, y], [x + 50, y], [x + 50, y + h], [x + 24, y + h]], color: '#5A1A3A' }] });
      p.rect(x + w - 42, y + h * 0.3, 42, h * 0.58, { fill: fabric, r: 18 });
      p.rect(x + 12, y + h * 0.76, w - 24, h * 0.16, { fill: '#3A0F22', r: 4, width: 4.5 });
      for (const lx of [x + 28, x + w - 28]) p.shape([[lx - 6, y + h * 0.9], [lx + 6, y + h * 0.9], [lx + 3, y + h], [lx - 3, y + h]], { fill: C.woodDark, raw: true, width: 3.5 });
      p.rect(x + w * 0.62, y + h * 0.18, w * 0.16, h * 0.3, { fill: '#FFB23F', r: 8, width: 4 });
      shine(p, [[x + 40, y + 8], [x + w * 0.45, y + 6]]);
    },
  },
  {
    key: 'armchair', name: 'Armchair', w: m(0.85), h: m(0.9), density: 0.0012, friction: 0.9, hearts: 2,
    draw(p, x, y, w, h) {
      p.shape([[x + 16, y + h * 0.62], [x + 14, y + 18], [x + w * 0.5, y + 2], [x + w - 14, y + 18], [x + w - 16, y + h * 0.62]], { fill: '#2A4636', width: 5.5, shade: [{ pts: [[x + w * 0.6, y], [x + w, y], [x + w, y + h], [x + w * 0.66, y + h]], color: '#1A2E24' }] });
      for (const [bx, by] of [[0.32, 0.25], [0.68, 0.25], [0.5, 0.42]]) p.dot(x + w * bx, y + h * by, 3.5, '#FFB23F');
      p.rect(x + 18, y + h * 0.55, w - 36, h * 0.22, { fill: '#7E8A44', r: 8, width: 4.5 });
      p.rect(x, y + h * 0.42, 26, h * 0.42, { fill: '#2A4636', r: 10, width: 5 });
      p.rect(x + w - 26, y + h * 0.42, 26, h * 0.42, { fill: '#2A4636', r: 10, width: 5 });
      p.rect(x + 10, y + h * 0.8, w - 20, h * 0.1, { fill: '#1A2E24', r: 3, width: 4 });
      for (const lx of [x + 18, x + w - 18]) p.line([[lx, y + h * 0.9], [lx + (lx < x + w / 2 ? -4 : 4), y + h]], { width: 6 });
      shine(p, [[x + w * 0.24, y + 16], [x + w * 0.48, y + 8]]);
    },
  },
  {
    key: 'fridge', name: 'Fridge', w: m(0.7), h: m(1.7), density: 0.0022, friction: 0.7, hearts: 2,
    draw(p, x, y, w, h) {
      p.rect(x, y, w, h, { fill: '#F3E3CC', r: 14, shade: [{ pts: [[x + w * 0.74, y], [x + w, y], [x + w, y + h], [x + w * 0.8, y + h]], color: '#D9C3A6' }] });
      p.line([[x + 3, y + h * 0.36], [x + w - 3, y + h * 0.36]], { width: 4 });
      p.rect(x + 12, y + h * 0.1, 8, h * 0.18, { fill: '#3A0F22', r: 3, width: 3 });
      p.rect(x + 12, y + h * 0.42, 8, h * 0.22, { fill: '#3A0F22', r: 3, width: 3 });
      p.rect(x + w * 0.46, y + h * 0.08, 26, 20, { fill: '#FFB23F', width: 2.5, r: 1 });
      p.dot(x + w * 0.46 + 13, y + h * 0.08 + 3, 3.5, C.terracotta);
      p.ellipse(x + w * 0.6, y + h * 0.5, 9, 9, { fill: C.mustard, width: 2.5 });
      p.rect(x + w * 0.32, y + h * 0.58, 24, 30, { fill: '#FFF6E6', width: 2.5, r: 1 });
      p.line([[x + w * 0.32 + 5, y + h * 0.58 + 10], [x + w * 0.32 + 19, y + h * 0.58 + 10]], { width: 1.8, raw: true });
      p.rect(x + 6, y + h - 10, w - 12, 8, { fill: '#3A0F22', stroke: null, r: 1 });
      shine(p, [[x + 8, y + 10], [x + 8, y + h * 0.3]], 4);
    },
  },
  {
    key: 'washer', name: 'Washing machine', w: m(0.6), h: m(0.85), density: 0.003, friction: 0.7, hearts: 1,
    draw(p, x, y, w, h) {
      p.rect(x, y, w, h, { fill: '#F3E3CC', r: 8, shade: [{ pts: [[x + w * 0.74, y], [x + w, y], [x + w, y + h], [x + w * 0.82, y + h]], color: '#D9C3A6' }] });
      p.line([[x + 3, y + h * 0.2], [x + w - 3, y + h * 0.2]], { width: 3.5 });
      p.dot(x + 14, y + h * 0.1, 4.5, C.terracotta);
      p.ellipse(x + w * 0.62, y + h * 0.1, 8, 8, { fill: '#FFB23F', width: 2.5 });
      p.ellipse(x + w / 2, y + h * 0.6, w * 0.32, w * 0.32, { fill: '#3A0F22', width: 5 });
      p.ellipse(x + w / 2, y + h * 0.6, w * 0.23, w * 0.23, { fill: '#7E8A44', width: 3, shade: [{ pts: [[x, y + h * 0.62], [x + w, y + h * 0.58], [x + w, y + h], [x, y + h]], color: '#2A4636' }] });
      p.line([[x + w * 0.4, y + h * 0.52], [x + w * 0.5, y + h * 0.48]], { width: 3, color: '#FFFFFF', opacity: 0.8 });
    },
  },
  {
    key: 'tv', name: 'Old TV', w: m(0.62), h: m(0.55), density: 0.0016, friction: 0.7, hearts: 2, fragile: 12,
    draw(p, x, y, w, h) {
      p.line([[x + w * 0.42, y + 8], [x + w * 0.28, y - 2]], { width: 3, raw: true });
      p.line([[x + w * 0.58, y + 8], [x + w * 0.74, y - 4]], { width: 3, raw: true });
      p.rect(x, y + 6, w, h - 16, { fill: '#7A2440', r: 10, shade: [{ pts: [[x + w * 0.76, y], [x + w, y], [x + w, y + h], [x + w * 0.8, y + h]], color: '#3A0F22' }] });
      p.rect(x + 8, y + 14, w * 0.66, h - 34, { fill: '#2A4636', r: 12, width: 4.5, shade: [{ pts: [[x, y + 10], [x + w * 0.4, y + 10], [x, y + h * 0.5]], color: '#7E8A44' }] });
      p.dot(x + w * 0.86, y + h * 0.3, 4.5, '#FFB23F');
      p.dot(x + w * 0.86, y + h * 0.5, 4.5, C.cream);
      for (const lx of [x + 12, x + w - 12]) p.line([[lx, y + h - 10], [lx + (lx < x + w / 2 ? -4 : 4), y + h]], { width: 5 });
    },
  },
  {
    key: 'bookshelf', name: 'Bookshelf', w: m(0.8), h: m(1.6), density: 0.0018, friction: 0.8, hearts: 2,
    draw(p, x, y, w, h) {
      p.rect(x, y, w, h, { fill: '#7A2440', r: 4, shade: [{ pts: [[x + w * 0.84, y], [x + w, y], [x + w, y + h], [x + w * 0.88, y + h]], color: '#3A0F22' }] });
      const shelves = 4;
      const colours = ['#E3263A', '#F3E3CC', '#FFB23F', '#2A4636', '#FF6A30', '#7E8A44', '#0A0712'];
      for (let s = 0; s < shelves; s++) {
        const top = y + 10 + s * ((h - 20) / shelves);
        const bottom = top + (h - 20) / shelves - 8;
        p.rect(x + 8, top, w - 16, bottom - top, { fill: '#2A0B18', stroke: null, r: 1 });
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
      p.rect(x, y, w, h, { fill: '#F3E3CC', r: 12, shade: [{ pts: [[x, y + h * 0.65], [x + w, y + h * 0.6], [x + w, y + h], [x, y + h]], color: '#D9C3A6' }] });
      for (let i = 1; i < 9; i++) p.dot(x + (w / 9) * i, y + h / 2, 2.5, '#FF6A30');
      p.line([[x + 6, y + h * 0.3], [x + w - 6, y + h * 0.3]], { width: 2.4, color: '#E3263A', raw: true });
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
        p.line([[cx, y + h * 0.58], [tx, ty]], { width: 2, color: '#1A2E24', opacity: 0.7 });
        // The splits monstera leaves are known for.
        p.line([[mx + nx * 0.6, my + ny * 0.6], [mx + nx * 0.2, my + ny * 0.2]], { width: 3, color: '#F3E3CC', opacity: 0.8 });
      };
      leaf(-Math.PI * 0.84, h * 0.4, '#1A2E24');
      leaf(-Math.PI * 0.18, h * 0.42, '#1A2E24');
      leaf(-Math.PI * 0.64, h * 0.52, '#2A4636');
      leaf(-Math.PI * 0.38, h * 0.54, '#2A4636');
      leaf(-Math.PI * 0.5, h * 0.46, '#7E8A44');
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
      p.ellipse(cx, cy, r, r, { fill: '#F7EFE0', width: 3.5, shade: [{ pts: [[x, cy - r * 0.15], [x + w, cy - r * 0.25], [x + w, y + w], [x, y + w]], color: '#7E8A44' }] });
      p.shape([[cx - r * 0.4, cy + r * 0.3], [cx + r * 0.1, cy + r * 0.05], [cx + r * 0.5, cy + r * 0.3], [cx + r * 0.1, cy + r * 0.6]], { fill: C.mustard, width: 2.5 });
      p.shape([[cx - r * 0.4, cy + r * 0.3], [cx - r * 0.75, cy + r * 0.05], [cx - r * 0.7, cy + r * 0.6]], { fill: C.terracotta, width: 2.5, raw: true });
      p.dot(cx + r * 0.25, cy + r * 0.25, 2);
      p.line([[cx - r * 0.55, cy - r * 0.5], [cx - r * 0.25, cy - r * 0.72]], { width: 3, color: '#FFFFFF' });
      p.rect(cx - r * 0.55, y - 1, r * 1.1, 6, { fill: '#F7EFE0', r: 2, width: 2.5 });
    },
  },
  {
    key: 'jam', name: 'Homemade jam', w: m(0.12), h: m(0.16) + 12, density: 0.0018, friction: 0.6, hearts: 3, fragile: 11,
    draw(p, x, y, w, h) {
      p.rect(x + 2, y + 12, w - 4, h - 12, { fill: '#F7EFE0', r: 8, width: 3.5, shade: [{ pts: [[x, y + h * 0.36], [x + w, y + h * 0.32], [x + w, y + h], [x, y + h]], color: '#E3263A' }] });
      p.rect(x + 6, y + h * 0.5, w - 12, h * 0.22, { fill: C.cream, r: 2, width: 2 });
      p.rect(x + 5, y, w - 10, 14, { fill: '#F3E3CC', r: 2, width: 3, shade: [{ pts: [[x, y], [x + w, y], [x + w, y + 7], [x, y + 7]], color: '#E3263A' }] });
      shine(p, [[x + 8, y + 18], [x + 8, y + h * 0.42]], 2.5);
    },
  },
  {
    key: 'suitcase', name: 'Suitcase', w: m(0.7), h: m(0.45), density: 0.0024, friction: 0.6, hearts: 1,
    draw(p, x, y, w, h) {
      p.rect(x + w * 0.36, y - 2, w * 0.28, 12, { fill: C.walnut, r: 5, width: 3.5 });
      p.rect(x, y + 8, w, h - 8, { fill: '#E3263A', r: 8, shade: [{ pts: [[x, y + h * 0.72], [x + w, y + h * 0.66], [x + w, y + h], [x, y + h]], color: '#9E1A2E' }] });
      for (const sx of [x + w * 0.26, x + w * 0.74]) p.rect(sx - 4, y + 9, 8, h - 10, { fill: '#3A0F22', r: 1, width: 2.5 });
      p.rect(x + w * 0.4, y + h * 0.42, w * 0.2, h * 0.22, { fill: '#FFB23F', r: 1, width: 2.5 });
      p.ellipse(x + w * 0.12, y + h * 0.4, 7, 7, { fill: '#F3E3CC', width: 2.5 });
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
      p.rect(x + w * 0.44, y + h * 0.36, w * 0.12, 6, { fill: '#F3E3CC', r: 1, width: 2 });
      p.line([[x + w * 0.66, y + 6], [x + w * 0.82, y - 8]], { width: 4, color: '#3A0F22' });
    },
  },
  {
    key: 'record', name: 'Record player', w: m(0.48), h: m(0.3), density: 0.0014, friction: 0.7, hearts: 2, fragile: 11,
    draw(p, x, y, w, h) {
      p.rect(x, y + h * 0.3, w, h * 0.7, { fill: C.mustard, r: 6, shade: [{ pts: [[x, y + h * 0.8], [x + w, y + h * 0.75], [x + w, y + h], [x, y + h]], color: C.dry }] });
      p.ellipse(x + w * 0.42, y + h * 0.3, w * 0.34, h * 0.14, { fill: C.ink, width: 2.5 });
      p.ellipse(x + w * 0.42, y + h * 0.3, w * 0.1, h * 0.05, { fill: C.terracotta, stroke: null });
      p.line([[x + w * 0.86, y + h * 0.2], [x + w * 0.62, y + h * 0.3]], { width: 3, color: '#3A0F22' });
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
      for (const py of [y + 4, y + 11]) for (const s of [-1, 1]) p.dot(cx + s * 11, py, 2.5, '#F3E3CC');
      const bodyPts: Pt[] = [[cx, y + h * 0.48], [cx + w * 0.38, y + h * 0.52], [cx + w * 0.3, y + h * 0.66], [cx + w * 0.5, y + h * 0.84], [cx, y + h], [cx - w * 0.5, y + h * 0.84], [cx - w * 0.3, y + h * 0.66], [cx - w * 0.38, y + h * 0.52]];
      p.shape(bodyPts, { fill: '#F2C98A', width: 4.5, shade: [{ pts: [[cx + 4, y + h * 0.4], [x + w + 10, y + h * 0.4], [x + w + 10, y + h + 10], [cx + 8, y + h + 10]], color: '#D99A3A' }] });
      p.ellipse(cx, y + h * 0.72, w * 0.16, w * 0.16, { fill: C.ink, width: 2.5 });
      p.rect(cx - w * 0.18, y + h * 0.86, w * 0.36, 6, { fill: C.walnut, r: 2, width: 2 });
      for (const s of [-3, 0, 3]) p.line([[cx + s, y + 14], [cx + s, y + h * 0.88]], { width: 1, color: '#E8E8E8', raw: true });
    },
  },
  {
    key: 'clock', name: 'Grandfather clock', w: m(0.5), h: m(1.9), density: 0.0016, friction: 0.7, hearts: 3, fragile: 14,
    draw(p, x, y, w, h) {
      p.shape([[x, y + 30], [x + w * 0.2, y + 6], [x + w / 2, y], [x + w * 0.8, y + 6], [x + w, y + 30], [x + w, y + h], [x, y + h]], { fill: '#5A1A3A', raw: true, width: 5, shade: [{ pts: [[x + w * 0.76, y], [x + w + 4, y], [x + w + 4, y + h], [x + w * 0.8, y + h]], color: '#3A0F22' }] });
      p.ellipse(x + w / 2, y + 48, w * 0.34, w * 0.34, { fill: C.cream, width: 4 });
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        p.dot(x + w / 2 + Math.cos(a) * w * 0.26, y + 48 + Math.sin(a) * w * 0.26, 1.6);
      }
      p.line([[x + w / 2, y + 48], [x + w / 2, y + 36]], { width: 2.5, raw: true });
      p.line([[x + w / 2, y + 48], [x + w / 2 + 9, y + 50]], { width: 2.5, raw: true });
      p.rect(x + w * 0.2, y + h * 0.3, w * 0.6, h * 0.48, { fill: '#2A0B18', r: 4, width: 4 });
      p.line([[x + w / 2, y + h * 0.32], [x + w / 2 + 4, y + h * 0.66]], { width: 2.5, color: C.mustard, raw: true });
      p.ellipse(x + w / 2 + 4, y + h * 0.68, 10, 10, { fill: C.mustard, width: 3 });
      p.rect(x - 4, y + h - 16, w + 8, 16, { fill: '#3A0F22', r: 2, width: 4 });
      shine(p, [[x + 6, y + 34], [x + 6, y + h * 0.4]]);
    },
  },
  {
    key: 'chair', name: 'Kitchen chair', w: m(0.45), h: m(0.9), density: 0.0012, friction: 0.8, hearts: 1,
    draw(p, x, y, w, h) {
      p.rect(x + 4, y, 10, h * 0.55, { fill: '#7E8A44', r: 2, width: 3.5 });
      for (const ry of [y + 10, y + h * 0.22, y + h * 0.34]) p.rect(x + 4, ry, w * 0.5, 8, { fill: '#7E8A44', r: 2, width: 3 });
      p.rect(x, y + h * 0.5, w, 14, { fill: '#7E8A44', r: 3, width: 4, shade: [{ pts: [[x, y + h * 0.5 + 8], [x + w, y + h * 0.5 + 8], [x + w, y + h], [x, y + h]], color: '#2A4636' }] });
      for (const lx of [x + 6, x + w - 8]) p.line([[lx, y + h * 0.5 + 12], [lx + (lx < x + w / 2 ? -2 : 2), y + h]], { width: 6, color: C.ink });
      p.line([[x + 8, y + h * 0.8], [x + w - 8, y + h * 0.8]], { width: 3.5, raw: true });
    },
  },
  {
    key: 'lamp', name: 'Floor lamp', w: m(0.45), h: m(1.6), density: 0.0008, friction: 0.7, hearts: 1, fragile: 13,
    draw(p, x, y, w, h) {
      const cx = x + w / 2;
      p.line([[cx, y + 64], [cx, y + h - 12]], { width: 7, raw: true });
      p.line([[cx - 2, y + 70], [cx - 2, y + h - 16]], { width: 2, color: '#FF6A30', raw: true });
      p.rect(x + 6, y + h - 14, w - 12, 14, { fill: '#3A0F22', r: 4, width: 4.5 });
      p.shape([[x + 14, y], [x + w - 14, y], [x + w, y + 66], [x, y + 66]], { fill: '#FFB23F', raw: true, shade: [{ pts: [[cx + 6, y], [x + w, y], [x + w, y + 66], [cx + 14, y + 66]], color: '#FF6A30' }] });
      p.line([[x + 4, y + 62], [x + w - 4, y + 62]], { width: 3, color: C.terracotta, raw: true });
    },
  },
  {
    key: 'cat', name: 'Biscuit the cat', w: m(0.56), h: m(0.56), density: 0.0008, friction: 0.8, hearts: 3, pet: true,
    /**
     * The cat from the title: black, rim-lit in ember along its top edges as if the sun were behind it,
     * plum inside its tall ears, amber almond eyes with slit pupils. It sits like a sack of flour, wide flat
     * head, tufted cheeks, and gives you the side-eye; its tail flicks out behind.
     */
    draw(p, x, y, w, h, mood = 'calm') {
      const GINGER = '#1A1226';
      const DEEP = '#0A0712';
      const STRIPE = '#2E2038';
      const CREAMY = '#2A1C36';
      const EYE = '#FFB23F';
      const RIM = '#FF9A5A';
      const LINE = '#C9A0B8';
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
      p.line(tail, { width: 15, color: DEEP });
      p.line(tail, { width: 10, color: GINGER });
      p.line(tail.slice(1).map(([tx, ty]) => [tx + 3, ty - 2] as Pt), { width: 2.4, color: RIM });
      p.line([[x + w - 3, y + h * 0.62], [x + w - 13, y + h * 0.6]], { width: 3, color: STRIPE, raw: true });
      p.line([[x + w - 2, y + h * 0.72], [x + w - 12, y + h * 0.74]], { width: 3, color: STRIPE, raw: true });
      // Body: a sack, wider at the bottom, the fur bristling all over when it panics.
      const body: Pt[] = panic
        ? fluffy(cx, y + h * 0.72, w * 0.4, h * 0.3, () => 1.4)
        : [[x + 8, y + h - 3], [x + 6, y + h * 0.78], [x + w * 0.2, y + h * 0.5], [x + w * 0.8, y + h * 0.5], [x + w - 8, y + h * 0.78], [x + w - 10, y + h - 3]];
      p.shape(body, { fill: GINGER, width: 4, raw: panic, shade: [{ pts: [[x, y + h * 0.84], [x + w, y + h * 0.8], [x + w, y + h], [x, y + h]], color: DEEP }] });
      for (const sx of [0.14, 0.24, 0.76, 0.86]) p.line([[x + w * sx, y + h * 0.66], [x + w * (sx + (sx < 0.5 ? 0.05 : -0.05)), y + h * 0.78]], { width: 2.6, color: STRIPE, opacity: 0.85 });
      // Chest bib, with a lick of fur.
      p.shape([[cx - w * 0.1, y + h * 0.6], [cx, y + h * 0.8], [cx + w * 0.1, y + h * 0.6]], { fill: CREAMY, stroke: null });
      p.line([[x + w * 0.8, y + h * 0.52], [x + w - 8, y + h * 0.78]], { width: 2.6, color: RIM, raw: true, opacity: 0.9 });
      // Little white front paws, side by side, very proper.
      for (const px of [cx - 8, cx + 8]) {
        p.ellipse(px, y + h - 6, 7.5, 5.5, { fill: CREAMY, width: 2.8 });
        p.line([[px - 2, y + h - 9], [px - 2, y + h - 4]], { width: 1.4, raw: true, color: LINE });
        p.line([[px + 2, y + h - 9], [px + 2, y + h - 4]], { width: 1.4, raw: true, color: LINE });
      }
      // Ears: small, set wide on the big flat head; flat back when it is cross or scared.
      // Ears say it first: flat back when cross or scared, out sideways when worried or dizzy, droopy when
      // sleepy, and up tall when happy.
      const flat = mood === 'grumpy' || panic;
      const sideways = mood === 'worried' || mood === 'dizzy';
      for (const s of [-1, 1]) {
        const ex = cx + s * w * 0.25;
        const tip: Pt = flat ? [ex + s * 18, y + h * 0.16] : sideways ? [ex + s * 22, headY - h * 0.16] : mood === 'sleepy' ? [ex + s * 12, y + h * 0.08] : mood === 'happy' ? [ex + s * 4, y - 8] : [ex + s * 6, y - 5];
        p.shape([[ex - s * 11, headY - h * 0.2], tip, [ex + s * 12, headY - h * 0.08]], { fill: GINGER, raw: true, width: 3.6 });
        p.shape([[ex - s * 5, headY - h * 0.18], [tip[0] - s * 2, tip[1] + 6], [ex + s * 7, headY - h * 0.1]], { fill: '#3A1A2E', raw: true, stroke: null });
        p.line([[ex + s * 12, headY - h * 0.08], [tip[0], tip[1] + 2]], { width: 2.4, color: RIM, raw: true });
      }
      // Head: wide and flat, with tufts at the cheeks.
      const hrx = w * 0.4;
      const hry = h * 0.26;
      p.shape(fluffy(cx, headY, hrx, hry, panic ? () => 1.6 : cheeks), { fill: GINGER, width: 4, raw: true, shade: [{ pts: [[cx - w, headY + hry * 0.4], [cx + w, headY + hry * 0.3], [cx + w, headY + h], [cx - w, headY + h]], color: '#3A2A4A' }] });
      const crown: Pt[] = [];
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI * 1.3 + (i / 12) * Math.PI * 0.62;
        crown.push([cx + Math.cos(a) * hrx * 0.97, headY + Math.sin(a) * hry * 0.97]);
      }
      p.line(crown, { width: 2.4, color: RIM, raw: true, opacity: 0.9 });
      // A faint tabby M on the forehead, only where the light catches it.
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
          p.line([[ex - 7, eyeY + 3], [ex, eyeY - 4], [ex + 7, eyeY + 3]], { width: 3.4, color: EYE });
          continue;
        }
        if (mood === 'sleepy') {
          // Dozing: lids down, with lashes.
          p.line([[ex - 7, eyeY], [ex, eyeY + 4], [ex + 7, eyeY]], { width: 3.2, color: LINE });
          for (const lx of [-4, 0, 4]) p.line([[ex + lx, eyeY + 3], [ex + lx * 1.3, eyeY + 6]], { width: 1.6, raw: true, color: LINE });
          continue;
        }
        if (mood === 'dizzy') {
          p.ellipse(ex, eyeY, er, er, { fill: '#FFFFFF', width: 2.6 });
          spiral(p, ex, eyeY, er * 0.85);
          continue;
        }
        const almond: Pt[] = [[ex - er - 2, eyeY + 1], [ex - er * 0.5, eyeY - er * 0.9], [ex + er * 0.5, eyeY - er * 0.95], [ex + er + 2, eyeY - 1 - s], [ex + er * 0.5, eyeY + er * 0.9], [ex - er * 0.5, eyeY + er * 0.95]];
        if (panic) p.ellipse(ex, eyeY, er, er, { fill: '#FFFFFF', width: 2.6 });
        else {
          p.shape(almond, { fill: EYE, width: 2.6, stroke: DEEP });
          p.ellipse(ex, eyeY, er * 0.5, er * 0.5, { fill: '#FFE08A', stroke: null, opacity: 0.85 });
        }
        if (panic) {
          p.dot(ex + s * 1, eyeY, 2.2);
          continue;
        }
        // Pupils looking sideways at you: the side-eye.
        const look = mood === 'worried' ? 0 : 3.6;
        p.ellipse(ex + look * 0.6, eyeY, mood === 'worried' ? 3.4 : 1.8, er * 0.85, { fill: C.ink, stroke: null });
        p.dot(ex + look * 0.6 - 2.6, eyeY - 3, 1.4, '#FFFFFF');
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
      } else if (mood === 'happy') p.line([[cx - 6, ny + 5], [cx - 3, ny + 7], [cx, ny + 4], [cx + 3, ny + 7], [cx + 6, ny + 5]], { width: 2.2, color: LINE });
      else if (mood === 'worried') p.line([[cx - 5, ny + 8], [cx - 2, ny + 6], [cx + 1, ny + 8], [cx + 4, ny + 6]], { width: 2, color: LINE });
      else if (mood === 'grumpy') p.line([[cx - 5, ny + 8], [cx, ny + 5], [cx + 5, ny + 8]], { width: 2.4, color: LINE });
      else if (mood === 'dizzy') {
        p.line([[cx - 4, ny + 6], [cx + 4, ny + 6]], { width: 2, raw: true, color: LINE });
        p.ellipse(cx + 2, ny + 9, 3, 4, { fill: '#F27A8A', width: 1.8 });
      } else p.line([[cx - 4, ny + 6], [cx + 4, ny + 6.5]], { width: 2, raw: true, color: LINE });
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
      p.rect(x, y + h - 12, w, 12, { fill: '#2A4636', r: 2, width: 3.5 });
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
  tailgate: { x: -190, w: 18, h: 90 },
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


/**
 * The truck, designed from scratch in the title screen's inks - ember, bone, red and ink - by the three
 * hands a vehicle like this needs:
 *
 * - as a car: one confident shape. A rounded fifties cab with a peaked brow over a raked windscreen, a
 *   short hood sloping down to a chrome grille, body-colour arches sitting over big lifted wheels, and a
 *   long straight belt line tying cab to bed. Mass sits low (ink chassis, sills and bumper); the cab stands
 *   tall and light (bone roof).
 * - as a poster: flat inks with a hard ink outline, a bone stripe with a red pinstripe running nose to
 *   tail, halftone dots for shade along the lower body, a bone highlight down every top edge, and on the
 *   door a roundel with the cat from the logo.
 * - as a game piece: a silhouette that reads at the HUD's tiny size - a clear nose and tail, the headlight
 *   (the truck's eye) in a proper chrome pod, a big window for the driver, stake sides so the cargo sits in
 *   the bed rather than on a plank, and a turret for the crossbow on a roll hoop behind the cab.
 *
 * Every shape the physics uses, and every spot the game hangs something from (the eye, the driver, the
 * freshener, the aerial, the exhaust, the crossbow's turret, the cable's fairlead), stays where it was.
 * 'truck' is everything behind the cargo; 'truck_front' is the bed side, drawn in front of it.
 */
export function truckArt(front = false): Art {
  const t = TRUCK;
  const p = pen(front ? 'truck_front' : 'truck');
  const X = (n: number) => n + t.ox;
  const Y = (n: number) => n + t.oy;
  const P = (pts: Pt[]) => pts.map(([x, y]) => [X(x), Y(y)] as Pt);
  const INKT = '#231A2A';
  const INK_LIT = '#3E3248';
  const BODY = '#F0643A';
  const BODY_SHADE = '#C8432F';
  const BODY_DEEP = '#9E2F2A';
  const BODY_LIGHT = '#FF9A6C';
  const BONE = '#F3E3CC';
  const BONE_SHADE = '#D8C1A2';
  const RED = '#C8283A';
  const AMBER = '#FFB23F';
  const done = (key: string): Art => ({ key, svg: p.svg(t.w, t.h), w: t.w, h: t.h });
  const solid = { stroke: INKT, raw: true } as const;

  /** Whether a point is inside a polygon (truck coordinates). */
  const inside = (poly: Pt[], x: number, y: number) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  /** Halftone shade: ink dots inside a shape, growing toward its foot, kept clear of its edge. */
  const halftone = (poly: Pt[], y0: number, y1: number, step = 9, maxR = 3.2, color = BODY_DEEP, opacity = 0.55) => {
    const xs = poly.map((q) => q[0]);
    for (let y = y0, row = 0; y <= y1; y += step, row++) {
      const r = maxR * ((y - y0) / (y1 - y0)) ** 1.2;
      if (r < 0.6) continue;
      for (let x = Math.min(...xs) + (row % 2) * (step / 2); x <= Math.max(...xs); x += step) {
        if ([[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]].every(([dx, dy]) => inside(poly, x + dx, y + dy))) {
          p.shape(ellipsePts(X(x), Y(y), r, r), { fill: color, stroke: null, raw: true, wobble: 0.2, opacity });
        }
      }
    }
  };
  /** A wheel arch in body colour: a thick band over the tyre, an ink well inside it, piping on its edge. */
  const arch = (cx: number, cy: number, outer: number, inner: number, part: 'well' | 'band' | 'both' = 'both') => {
    // The arch stops a little above the wheel's centre (the picture ends just there), with flat-cut feet.
    const a0 = Math.PI + 0.16;
    const span = Math.PI - 0.32;
    const well: Pt[] = [];
    for (let i = 0; i <= 18; i++) {
      const a = a0 + (i / 18) * span;
      well.push([cx + Math.cos(a) * inner, cy + Math.sin(a) * inner * 0.95]);
    }
    if (part !== 'band') p.shape(P(well), { fill: '#1A1420', raw: true, stroke: null });
    if (part === 'well') return;
    const band: Pt[] = [];
    for (let i = 0; i <= 18; i++) {
      const a = a0 + (i / 18) * span;
      band.push([cx + Math.cos(a) * outer, cy + Math.sin(a) * outer * 0.92]);
    }
    for (let i = 18; i >= 0; i--) {
      const a = a0 + (i / 18) * span;
      band.push([cx + Math.cos(a) * inner, cy + Math.sin(a) * inner * 0.95]);
    }
    p.shape(P(band), { fill: BODY, ...solid, width: 5.5, shade: [{ pts: [[X(cx - outer), Y(cy - outer * 0.35)], [X(cx + outer), Y(cy - outer * 0.35)], [X(cx + outer), Y(cy + 4)], [X(cx - outer), Y(cy + 4)]], color: BODY_SHADE }] });
    const top: Pt[] = [];
    for (let i = 2; i <= 16; i++) {
      const a = Math.PI + (i / 18) * Math.PI;
      top.push([X(cx + Math.cos(a) * (outer - 5)), Y(cy + Math.sin(a) * (outer - 5) * 0.92)]);
    }
    p.line(top, { width: 2.6, color: BODY_LIGHT, raw: true, opacity: 0.9 });
  };

  if (front) {
    // ---- The bed's near side, in front of the cargo: an ember panel, a stake rail on top, the livery
    // stripe running on from the cab, a bone name plate (the game writes the company name on it), and
    // the tail light and chevrons at the back.
    const panel: Pt[] = [[-200, -56], [188, -56], [188, 22], [-194, 22], [-200, 14]];
    p.shape(P(panel), { fill: BODY, ...solid, width: 6.5, shade: [{ pts: [[X(-210), Y(4)], [X(200), Y(4)], [X(200), Y(30)], [X(-210), Y(30)]], color: BODY_SHADE }] });
    halftone(panel, -4, 20, 8, 2.8);
    p.line(P([[-194, -50], [184, -50]]), { width: 2.6, color: BODY_LIGHT, raw: true });
    // The stripe.
    p.shape(P([[-200, -42], [188, -42], [188, -30], [-200, -30]]), { fill: BONE, raw: true, stroke: null });
    p.line(P([[-200, -26], [188, -26]]), { width: 3, color: RED, raw: true });
    // Stake posts and the top rail: ink posts, bone slats.
    p.shape(P([[-204, -84], [192, -84], [192, -72], [-204, -72]]), { fill: BONE, ...solid, width: 4.5, shade: [{ pts: [[X(-210), Y(-77)], [X(200), Y(-77)], [X(200), Y(-70)], [X(-210), Y(-70)]], color: BONE_SHADE }] });
    for (const x of [-196, -102, -8, 86, 180]) {
      p.rect(X(x - 7), Y(-88), 14, 34, { fill: INKT, r: 3, stroke: INKT, width: 2 });
      p.dot(X(x), Y(-78), 2.2, '#8A8090');
    }
    // The name plate.
    p.shape(P([[-104, -20], [104, -20], [104, 8], [-104, 8]]), { fill: BONE, ...solid, width: 4 });
    p.line(P([[-98, -16], [98, -16]]), { width: 1.6, color: BONE_SHADE, raw: true });
    for (const [x, y] of [[-98, -14], [98, -14], [-98, 2], [98, 2]] as const) p.dot(X(x), Y(y), 2, INK_LIT);
    // Tail: chevrons up the tailgate's edge, a round tail light in a chrome ring, and a reflector.
    for (let k = 0; k < 4; k++) p.shape(P([[-208, -58 + k * 18], [-198, -58 + k * 18], [-198, -50 + k * 18], [-208, -42 + k * 18]]), { fill: k % 2 ? INKT : AMBER, raw: true, stroke: null });
    p.ellipse(X(-212), Y(-8), 12, 12, { fill: '#E9E4DA', stroke: INKT, width: 3.5 });
    p.ellipse(X(-212), Y(-8), 8, 8, { fill: RED, stroke: null });
    p.dot(X(-214), Y(-11), 2.4, '#FFB0A0');
    // The back wheel's arch sits over the panel's foot (its dark well is in the layer behind the wheel).
    arch(t.wheels[0].x, t.wheels[0].y, 84, 66, 'band');
    return done('truck_front');
  }

  const [rw, fw] = t.wheels;

  // ---- Chassis: an ink frame, the tailpipe, and a tow hitch, all low and dark so the mass sits down.
  p.rect(X(-194), Y(20), 606, 30, { fill: INKT, r: 8, stroke: INKT, width: 3 });
  p.line(P([[-186, 26], [404, 26]]), { width: 2, color: INK_LIT, raw: true });
  p.rect(X(-222), Y(31), 44, 12, { fill: '#E9E4DA', r: 6, stroke: INKT, width: 3.5 });
  p.ellipse(X(-222), Y(37), 4, 5, { fill: INKT, stroke: null });
  p.rect(X(-214), Y(42), 22, 10, { fill: INK_LIT, r: 3, stroke: INKT, width: 3 });

  // ---- The far stake rail, behind the cargo, in shadow.
  p.shape(P([[-196, -84], [184, -84], [184, -74], [-196, -74]]), { fill: BONE_SHADE, raw: true, stroke: INKT, width: 3.5, opacity: 0.85 });
  for (const x of [-150, -56, 38, 132]) p.rect(X(x - 6), Y(-86), 12, 86, { fill: INK_LIT, r: 3, stroke: INKT, width: 2.5 });

  // ---- The roll hoop behind the cab, the crossbow's turret on top, spotlights, and the cable drum.
  p.line(P([[164, 4], [164, -150], [170, -172], [186, -184]]), { width: 15, color: INKT });
  p.line(P([[164, 0], [164, -150], [170, -172], [186, -184]]), { width: 7, color: INK_LIT });
  p.ellipse(X(196), Y(-194), 22, 14, { fill: INKT, stroke: INKT, width: 3 });
  p.ellipse(X(196), Y(-200), 18, 9, { fill: BODY, stroke: INKT, width: 3.5 });
  p.dot(X(196), Y(-201), 4, AMBER);
  for (const sx of [148, 176]) {
    p.ellipse(X(sx), Y(-166), 11, 11, { fill: INKT, stroke: INKT, width: 3 });
    p.ellipse(X(sx), Y(-166), 7, 7, { fill: '#FFF2C8', stroke: null });
  }
  p.line(P([[140, -166], [184, -166]]), { width: 3.5, color: INKT, raw: true });
  p.ellipse(X(140), Y(-30), 26, 26, { fill: INKT, stroke: INKT, width: 3 });
  for (let k = 0; k < 3; k++) p.ellipse(X(140), Y(-30), 20 - k * 5, 20 - k * 5, { stroke: '#B7AFA6', width: 1.8 });
  p.dot(X(140), Y(-30), 4, BODY);
  p.line(P([[146, -50], [156, -110], [176, -180]]), { width: 2.4, color: '#B7AFA6', opacity: 0.9 });

  // ---- Wheel arch over the front wheel (the back one is on the bed side, in front of the cargo).
  arch(fw.x, fw.y, 84, 66);
  arch(rw.x, rw.y, 84, 66, 'well');

  // ---- The body: one rounded shape from the back of the cab to the nose.
  const body: Pt[] = [
    [186, 22], [184, -110], [190, -140], [206, -152], [296, -158], [326, -154], [338, -126], [350, -86], [368, -72], [430, -64], [460, -56], [474, -38], [476, -6], [468, 16], [444, 24], [380, 24],
  ];
  p.shape(P(body), { fill: BODY, stroke: INKT, width: 7, wobble: 1.2, shade: [{ pts: [[X(180), Y(-6)], [X(490), Y(-12)], [X(490), Y(40)], [X(180), Y(40)]], color: BODY_SHADE }, { pts: [[X(180), Y(-160)], [X(198), Y(-160)], [X(196), Y(30)], [X(180), Y(30)]], color: BODY_SHADE }] });
  halftone([[196, -100], [340, -100], [360, -70], [460, -54], [470, -30], [466, 14], [196, 14]], -20, 16, 8, 3);

  // The bone roof, two-tone, with three amber marker lights on its brow.
  p.shape(P([[190, -136], [204, -150], [296, -156], [326, -152], [332, -140], [212, -140], [198, -128]]), { fill: BONE, ...solid, width: 5, wobble: 0.8 });
  p.line(P([[208, -150], [296, -154]]), { width: 3, color: '#FFFFFF', raw: true, opacity: 0.7 });
  for (const mx of [234, 258, 282]) p.rect(X(mx - 7), Y(-162), 14, 7, { fill: AMBER, r: 3, stroke: INKT, width: 2.5 });
  // The brow: a peak over the windscreen.
  p.shape(P([[300, -156], [354, -150], [356, -141], [328, -140]]), { fill: BODY, ...solid, width: 4.5 });

  // Windows: the side glass (the driver sits in it) and a sliver of the raked windscreen.
  const glass: Pt[] = [[214, -134], [318, -136], [336, -92], [214, -88]];
  p.shape(P(glass), { fill: GLASS, ...solid, width: 5 });
  p.shape(P([[226, -134], [252, -134], [228, -96], [214, -96], [214, -116]]), { fill: '#FFFFFF', raw: true, stroke: null, opacity: 0.28 });
  p.shape(P([[262, -135], [272, -135], [250, -90], [240, -90]]), { fill: '#FFFFFF', raw: true, stroke: null, opacity: 0.2 });
  p.shape(P([[330, -140], [342, -140], [356, -92], [344, -90]]), { fill: '#8FC0CC', ...solid, width: 3.5 });
  // The B-pillar and the door's shut lines, handle and mirror.
  p.line(P([[212, -132], [212, -86]]), { width: 4, color: INKT, raw: true });
  p.shape(P([[208, -82], [344, -84], [356, -60], [352, 12], [208, 12]]), { stroke: INKT, width: 2.6, raw: true, opacity: 0.85 });
  p.rect(X(306), Y(-70), 26, 7, { fill: BONE, r: 3, stroke: INKT, width: 2.5 });
  p.line(P([[338, -100], [356, -114]]), { width: 4, color: INKT, raw: true });
  p.ellipse(X(360), Y(-120), 10, 12, { fill: INKT, stroke: INKT, width: 2.5 });
  p.ellipse(X(361), Y(-121), 6, 8, { fill: '#B7D8DE', stroke: null });

  // The livery: a bone stripe with a red pinstripe, running back from a point on the fender.
  p.shape(P([[186, -42], [366, -42], [382, -36], [366, -30], [186, -30]]), { fill: BONE, raw: true, stroke: null });
  p.line(P([[186, -26], [372, -26]]), { width: 3, color: RED, raw: true });

  // The door roundel: the cat from the logo, in ink on bone, in a red ring.
  p.ellipse(X(276), Y(-4), 25, 25, { fill: RED, stroke: INKT, width: 3.5 });
  p.ellipse(X(276), Y(-4), 19, 19, { fill: BONE, stroke: null });
  p.shape(P([[262, 8], [262, -8], [258, -20], [268, -12], [284, -12], [294, -20], [290, -8], [290, 8]]), { fill: INKT, raw: true, stroke: null });
  for (const ex of [270, 282]) p.ellipse(X(ex), Y(-3), 3.2, 2.2, { fill: AMBER, stroke: null });

  // The hood: louvres, and a bone highlight down its top edge.
  for (let k = 0; k < 3; k++) p.line(P([[372 + k * 12, -56], [380 + k * 12, -54]]), { width: 3, color: BODY_DEEP, raw: true });
  p.line(P([[352, -82], [370, -70], [430, -62], [458, -54]]), { width: 3, color: BODY_LIGHT, opacity: 0.95 });

  // The headlight pod (the eye sits in it): body-colour cowl, chrome ring, dark socket.
  p.ellipse(X(401), Y(-28), 30, 30, { fill: BODY, stroke: INKT, width: 5, shade: [{ pts: [[X(370), Y(-24)], [X(434), Y(-28)], [X(434), Y(4)], [X(370), Y(4)]], color: BODY_SHADE }] });
  p.ellipse(X(401), Y(-28), 23, 23, { fill: '#E9E4DA', stroke: INKT, width: 3.5 });
  p.ellipse(X(401), Y(-28), 18, 18, { fill: '#2A2236', stroke: null });
  p.shape(P([[372, -50], [424, -56], [430, -48], [376, -42]]), { fill: BODY, ...solid, width: 3.5 });

  // The grille: a chrome surround and ink bars, set into the nose.
  p.shape(P([[442, -48], [470, -40], [474, -4], [468, 10], [446, 12]]), { fill: '#E9E4DA', ...solid, width: 4.5 });
  p.shape(P([[448, -40], [464, -35], [467, -4], [462, 4], [450, 5]]), { fill: INKT, raw: true, stroke: null });
  for (let k = 0; k < 5; k++) p.line(P([[450, -32 + k * 8], [465, -29 + k * 8]]), { width: 2.4, color: '#B7AFA6', raw: true });

  // Sills: an ink rocker with a bone pinstripe, and the fuel cap behind the door.
  p.shape(P([[186, 10], [444, 10], [440, 26], [186, 26]]), { fill: INKT, ...solid, width: 3 });
  p.line(P([[192, 14], [436, 14]]), { width: 2, color: BONE, raw: true, opacity: 0.8 });
  p.ellipse(X(198), Y(-62), 7, 7, { fill: '#E9E4DA', stroke: INKT, width: 2.5 });

  // The bumper: ink, chunky, with the winch's fairlead (the cable runs from here) and red tow hooks.
  p.shape(P([[432, 6], [484, 2], [490, 32], [436, 38]]), { fill: INKT, ...solid, width: 4, shade: [{ pts: [[X(430), Y(26)], [X(494), Y(22)], [X(494), Y(40)], [X(430), Y(40)]], color: '#14101A' }] });
  p.line(P([[440, 10], [482, 6]]), { width: 2.2, color: INK_LIT, raw: true });
  p.rect(X(454), Y(16), 24, 10, { fill: '#E9E4DA', r: 4, stroke: INKT, width: 2.5 });
  for (const hx of [442, 484]) {
    p.ellipse(X(hx), Y(22), 6, 6, { fill: RED, stroke: INKT, width: 2.5 });
    p.ellipse(X(hx), Y(22), 2.4, 2.4, { fill: INKT, stroke: null });
  }
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
 * The wheels, as a matched pair: chunky ink tyres with bold tread blocks and a raised bone ring on the
 * sidewall, on deep-dish ember steel wheels with a bone rim line, six ink holes and a chrome cap.
 */
export function wheelArt(front = false): Art {
  const r = TRUCK.wheelR;
  const s = r * 2 + PAD * 2;
  const c = s / 2;
  const key = front ? 'wheel_front' : 'wheel';
  const p = pen(key);
  const INKT = '#231A2A';
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const b = a + 0.2;
    p.shape([[c + Math.cos(a) * (r + 4), c + Math.sin(a) * (r + 4)], [c + Math.cos(b) * (r + 4), c + Math.sin(b) * (r + 4)], [c + Math.cos(b) * (r - 6), c + Math.sin(b) * (r - 6)], [c + Math.cos(a) * (r - 6), c + Math.sin(a) * (r - 6)]], { fill: INKT, raw: true, stroke: INKT, width: 2.5 });
  }
  p.ellipse(c, c, r - 1, r - 1, { fill: '#2E2638', stroke: INKT, width: 4 });
  // A raised bone ring on the sidewall, broken like raised lettering.
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * Math.PI * 2;
    const pts: [number, number][] = [];
    for (let k = 0; k <= 4; k++) {
      const a = a0 + (k / 4) * 0.45;
      pts.push([c + Math.cos(a) * r * 0.84, c + Math.sin(a) * r * 0.84]);
    }
    p.line(pts, { width: 3, color: '#F3E3CC', raw: true, opacity: 0.85 });
  }
  // The deep-dish wheel.
  p.ellipse(c, c, r * 0.66, r * 0.66, { fill: '#F0643A', stroke: INKT, width: 4, shade: [{ pts: [[c - r, c + 2], [c + r, c - 4], [c + r, c + r], [c - r, c + r]], color: '#C8432F' }] });
  p.ellipse(c, c, r * 0.56, r * 0.56, { stroke: '#F3E3CC', width: 3.5 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    p.ellipse(c + Math.cos(a) * r * 0.38, c + Math.sin(a) * r * 0.38, r * 0.085, r * 0.085, { fill: INKT, stroke: null });
  }
  p.ellipse(c, c, r * 0.2, r * 0.2, { fill: '#E9E4DA', stroke: INKT, width: 3, shade: [{ pts: [[c - r, c + 2], [c + r, c - 2], [c + r, c + r], [c - r, c + r]], color: '#B7AFA6' }] });
  p.dot(c, c, r * 0.06, INKT);
  // A highlight on the tyre's shoulder.
  const hi: [number, number][] = [];
  for (let k = 0; k <= 6; k++) {
    const a = Math.PI * 1.05 + (k / 6) * 0.7;
    hi.push([c + Math.cos(a) * (r - 6), c + Math.sin(a) * (r - 6)]);
  }
  p.line(hi, { width: 3, color: '#FFFFFF', raw: true, opacity: 0.22 });
  return { key, svg: p.svg(s, s), w: s, h: s };
}


/** The old house's picture size, and where its chimney top and SOLD sign are, for the game to use. */
export const HOUSE = { w: 660, h: 880, ground: 866, chimney: { x: 150, y: 214 }, banner: { x: 462, y: 432 } };

/**
 * The house being left: old, poor and falling down, so the move reads as an escape from it to the
 * manor by the sea. Built on the same rules as the manor but turned the other way - where the manor is
 * symmetrical, tall, white and lit, this is squat, leaning and sagging, in dull weathered browns and
 * dirty plaster, with almost no light in it. The whole thing leans to the right; the ridge sags; tiles
 * are missing down to the battens, one patch is rusty tin and another a blue tarp held down with rope
 * and a tyre. Plaster has fallen away to the brick, the beams are cracked, one window is boarded up and
 * the other cracked with a shutter hanging off, the door is patched with a plank, the step has gone
 * and a cinder block stands in for it. The chimney leans the other way, propped up on a pole, and the
 * gutter hangs loose. Weeds grow out of everything. A SOLD sign stands crooked in front.
 */
export function shackArt(key: string): Art {
  const p = pen(key);
  const G = HOUSE.ground;
  const PLASTER = '#D9C3A6';
  const PLASTER_SHADE = '#B89A7A';
  const WOOD = '#6A2E2E';
  const WOOD_DARK = '#3A0F22';
  const WOOD_PALE = '#B87A52';
  const BRICK = '#A8452E';
  const ROOF = '#5A1A3A';
  const ROOF_SHADE = '#3A0F22';
  const BATTEN = '#0A0712';
  const MOSS = '#7E8A44';
  const WEED = '#7E8A44';
  const WEED_DRY = '#D99A3A';
  const TARP = '#FF6A30';
  const RUST = '#C0602E';
  const DIM = '#FFB23F';
  /** Everything leans: points further up are pushed further right. */
  const lean = ([x, y]: Pt): Pt => [x + (G - y) * 0.07, y];
  const L = (pts: Pt[]) => pts.map(lean);
  /** A board nailed on, as a thin rotated rectangle with two nail heads. */
  const board = (a: Pt, b: Pt, w: number, fill = WOOD_PALE) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (w / 2);
    const ny = (dx / len) * (w / 2);
    p.shape([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], { fill, raw: true, width: 3.5 });
    for (const t of [0.08, 0.92]) p.dot(a[0] + dx * t, a[1] + dy * t, 2.6, BATTEN);
    p.line([[a[0] + dx * 0.2, a[1] + dy * 0.2], [a[0] + dx * 0.7, a[1] + dy * 0.7]], { width: 1.4, raw: true, opacity: 0.35 });
  };
  const weeds = (x: number, y: number, n: number, h: number) => {
    for (let i = 0; i < n; i++) {
      const bx = x + (i - n / 2) * 7;
      const bend = ((i * 37) % 11) - 5;
      p.line([[bx, y], [bx + bend * 0.5, y - h * 0.5], [bx + bend * 1.4, y - h * (0.7 + ((i * 13) % 5) / 10)]], { width: 3, color: i % 3 ? WEED : WEED_DRY });
    }
  };
  const crack = (pts: Pt[]) => p.line(L(pts), { width: 2.2, raw: true, opacity: 0.7 });

  // ---- The chimney, leaning out to the left, missing bricks at the top, propped on a pole.
  p.shape([[120, 228], [176, 222], [196, 470], [138, 476]], { fill: BRICK, raw: true, width: 5.5, shade: [{ pts: [[160, 210], [210, 210], [210, 480], [166, 480]], color: '#7A2A2E' }] });
  for (let y = 240; y < 460; y += 20) p.line([[124 + (y - 228) * 0.08, y], [178 + (y - 222) * 0.08, y - 1]], { width: 1.8, color: '#6A2430', raw: true, opacity: 0.7 });
  p.shape([[114, 226], [140, 214], [144, 230], [118, 236]], { fill: BRICK, raw: true, width: 4 });
  p.rect(156, 206, 18, 20, { fill: '#8A8A86', r: 2, width: 3.5 });
  p.line([[72, G - 300], [128, 330]], { width: 9, color: WOOD_DARK });

  // ---- The walls: dirty plaster over a timber frame, leaning right.
  p.shape(L([[118, 482], [516, 482], [522, G], [112, G]]), { fill: PLASTER, raw: true, width: 7, shade: [{ pts: [[430, 470], [560, 470], [570, G + 6], [440, G + 6]], color: PLASTER_SHADE }] });
  // Where the plaster has fallen away: bare brick in ragged patches.
  for (const [cx, cy, rx, ry] of [[190, 560, 52, 34], [452, 640, 44, 54], [160, 780, 38, 30], [360, 520, 30, 18]] as const) {
    const blob: Pt[] = Array.from({ length: 11 }, (_, i) => {
      const a = (i / 11) * Math.PI * 2;
      const r = 0.75 + ((i * 7) % 5) / 10;
      return lean([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
    });
    p.shape(blob, { fill: BRICK, width: 3, stroke: '#6A2430' });
    for (let y = cy - ry + 10; y < cy + ry - 4; y += 14) p.line([lean([cx - rx * 0.7, y]), lean([cx + rx * 0.7, y])], { width: 1.6, color: '#6A2430', raw: true, opacity: 0.8 });
  }
  // Water stains running down from the eaves.
  for (const x of [170, 300, 420]) p.shape(L([[x - 26, 486], [x + 24, 486], [x + 14, 600], [x + 2, 640], [x - 10, 590]]), { fill: '#3A0F22', raw: true, stroke: null, opacity: 0.18, wobble: 3 });
  // The frame: corner posts, a sill beam, a beam across and a split brace.
  for (const x of [120, 508]) p.shape(L([[x - 9, 486], [x + 9, 486], [x + 9, G], [x - 9, G]]), { fill: WOOD, raw: true, width: 4.5 });
  p.shape(L([[110, 652], [524, 646], [524, 664], [110, 670]]), { fill: WOOD, raw: true, width: 4.5 });
  p.shape(L([[130, 500], [236, 640], [224, 648], [124, 514]]), { fill: WOOD, raw: true, width: 3.5 });
  crack([[176, 566], [184, 574], [180, 584]]);
  crack([[330, 700], [342, 720], [336, 744], [350, 770]]);
  crack([[470, 520], [462, 548], [476, 566]]);
  crack([[250, 690], [236, 706], [242, 724]]);

  // ---- The roof: a heavy gable whose ridge has sagged, tiles missing down to the battens.
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const s = Math.sin(t * Math.PI);
    left.push(lean([66 + (318 - 66) * t + s * 16, 500 + (262 - 500) * t + s * 22]));
    right.push(lean([318 + (572 - 318) * t - s * 14, 262 + (500 - 262) * t + s * 20]));
  }
  p.shape([...left, ...right.slice(1), lean([572, 500]), lean([66, 500])], { fill: ROOF, raw: true, width: 7.5, shade: [{ pts: [[340, 240], [640, 240], [640, 510], [340, 510]], color: ROOF_SHADE }] });
  // Tile courses, broken.
  for (let row = 0, y = 300; y < 486; y += 22, row++) {
    const f = (y - 262) / 238;
    const half = f * 236 - 26;
    for (let x = 318 - half + (row % 2) * 13; x + 26 <= 318 + half; x += 26) {
      if ((x * 3 + row * 7) % 9 === 0) continue;
      p.line([lean([x, y]), lean([x + 13, y + 9]), lean([x + 26, y])], { width: 2.6, color: ROOF_SHADE });
    }
  }
  // A hole where the tiles have gone, showing the battens and the dark inside.
  p.shape(L([[230, 344], [292, 330], [306, 384], [262, 408], [222, 392]]), { fill: '#140A12', raw: true, width: 4 });
  for (const y of [350, 366, 382, 398]) p.line([lean([226, y]), lean([300, y - 6])], { width: 4, color: '#6A2E2E', raw: true });
  for (const [x, y] of [[312, 404], [206, 414], [330, 436]] as const) p.shape(L([[x, y], [x + 22, y - 4], [x + 24, y + 8], [x + 2, y + 12]]), { fill: ROOF_SHADE, raw: true, width: 3 });
  // A rusty tin patch, nailed down.
  p.shape(L([[296, 440], [372, 434], [378, 488], [300, 492]]), { fill: RUST, raw: true, width: 4.5, shade: [{ pts: [[340, 420], [390, 420], [390, 500], [340, 500]], color: '#8A3A22' }] });
  for (let x = 306; x < 372; x += 12) p.line([lean([x, 440]), lean([x + 3, 488])], { width: 2, color: '#5A2418', raw: true, opacity: 0.7 });
  // A blue tarp over the far slope, roped down and weighted with a tyre.
  p.shape(L([[110, 470], [170, 404], [214, 430], [192, 492], [120, 496]]), { fill: TARP, width: 4, shade: [{ pts: [[150, 440], [220, 440], [220, 500], [150, 500]], color: '#D9502A' }] });
  p.line(L([[118, 430], [208, 486]]), { width: 2.6, color: '#F3E3CC' });
  // Held down with a couple of loose bricks.
  for (const [bx, by] of [[150, 450], [184, 470]] as const) p.shape(L([[bx - 16, by - 8], [bx + 16, by - 10], [bx + 18, by + 6], [bx - 14, by + 8]]), { fill: BRICK, raw: true, width: 3.5 });
  // Moss along the eaves and the ridge.
  for (const [x, y, r] of [[96, 486, 16], [150, 472, 11], [280, 286, 10], [360, 296, 12], [520, 482, 15], [452, 470, 10]] as const) {
    p.ellipse(...lean([x, y]), r * 1.5, r * 0.7, { fill: MOSS, stroke: null, opacity: 0.9, wobble: 2 });
  }
  // Eave board, broken at one end, and a gutter hanging down loose.
  p.shape(L([[60, 498], [470, 498], [474, 512], [64, 514]]), { fill: WOOD_DARK, raw: true, width: 4.5 });
  p.shape(L([[480, 500], [578, 506], [572, 518], [478, 512]]), { fill: WOOD_DARK, raw: true, width: 4 });
  p.shape([lean([70, 516]), lean([360, 520]), [lean([360, 520])[0] + 64, 574], [lean([360, 520])[0] + 54, 582], lean([354, 530]), lean([70, 528])], { fill: '#8A6A52', raw: true, width: 3.5 });
  weeds(lean([200, 516])[0], 516, 5, 30);
  // A bent old aerial on the ridge.
  const top = lean([318, 262]);
  p.line([top, [top[0] + 10, top[1] - 70]], { width: 4, raw: true });
  p.line([[top[0] - 14, top[1] - 52], [top[0] + 36, top[1] - 62]], { width: 3.5, raw: true });
  p.line([[top[0] + 4, top[1] - 34], [top[0] + 30, top[1] - 20]], { width: 3.5, raw: true });
  // The attic window: a dark hole with one board across.
  const aw = lean([318, 400]);
  p.ellipse(aw[0], aw[1], 30, 30, { fill: WOOD, width: 4.5 });
  p.ellipse(aw[0], aw[1], 21, 21, { fill: '#140A12', width: 3 });
  board([aw[0] - 34, aw[1] + 10], [aw[0] + 32, aw[1] - 12], 12);

  // ---- Windows: one boarded up, one cracked with a shutter hanging off, a weak light behind it.
  const w1 = lean([132, 700]);
  p.rect(w1[0], w1[1], 92, 96, { fill: WOOD, r: 2, width: 5 });
  p.rect(w1[0] + 8, w1[1] + 8, 76, 80, { fill: '#140A12', r: 1, width: 3 });
  p.shape([[w1[0] + 10, w1[1] + 10], [w1[0] + 40, w1[1] + 10], [w1[0] + 20, w1[1] + 46]], { fill: '#7A2440', raw: true, stroke: null, opacity: 0.6 });
  board([w1[0] - 10, w1[1] + 18], [w1[0] + 102, w1[1] + 30], 18);
  board([w1[0] - 6, w1[1] + 74], [w1[0] + 100, w1[1] + 58], 18, '#8A5A3E');
  board([w1[0] + 8, w1[1] - 6], [w1[0] + 82, w1[1] + 104], 16, '#C48A5A');
  const w2 = lean([396, 700]);
  p.rect(w2[0], w2[1], 86, 96, { fill: WOOD, r: 2, width: 5 });
  p.rect(w2[0] + 8, w2[1] + 8, 70, 80, { fill: DIM, r: 1, width: 3, shade: [{ pts: [[w2[0], w2[1] + 50], [w2[0] + 90, w2[1] + 44], [w2[0] + 90, w2[1] + 96], [w2[0], w2[1] + 96]], color: '#8A6A44' }] });
  p.line([[w2[0] + 43, w2[1] + 8], [w2[0] + 43, w2[1] + 88]], { width: 3.5, raw: true });
  p.line([[w2[0] + 8, w2[1] + 48], [w2[0] + 78, w2[1] + 48]], { width: 3.5, raw: true });
  p.shape([[w2[0] + 44, w2[1] + 9], [w2[0] + 77, w2[1] + 9], [w2[0] + 77, w2[1] + 47], [w2[0] + 44, w2[1] + 47]], { fill: '#140A12', raw: true, stroke: null });
  p.line([[w2[0] + 12, w2[1] + 60], [w2[0] + 30, w2[1] + 72], [w2[0] + 26, w2[1] + 86]], { width: 1.6, color: '#FFFFFF', raw: true, opacity: 0.7 });
  // The shutter, hanging by its bottom hinge.
  p.shape([[w2[0] + 92, w2[1] + 96], [w2[0] + 120, w2[1] + 86], [w2[0] + 150, w2[1] + 160], [w2[0] + 124, w2[1] + 172]], { fill: '#7E8A44', raw: true, width: 4 });
  for (let k = 1; k < 4; k++) p.line([[w2[0] + 98 + k * 8, w2[1] + 106 + k * 16], [w2[0] + 122 + k * 8, w2[1] + 96 + k * 16]], { width: 2, raw: true, opacity: 0.5 });
  p.rect(w2[0] - 8, w2[1] + 94, 102, 10, { fill: WOOD_DARK, r: 2, width: 3.5 });

  // ---- The door: faded, off-true, a plank across the split, light leaking under it; no step left.
  const d = lean([262, 680]);
  p.shape([[d[0] - 6, G - 30], [d[0] - 6, d[1] - 6], [d[0] + 96, d[1] - 10], [d[0] + 98, G - 30]], { fill: WOOD_DARK, raw: true, width: 5 });
  p.shape([[d[0] + 4, G - 34], [d[0] + 2, d[1] + 2], [d[0] + 86, d[1] - 2], [d[0] + 90, G - 38]], { fill: '#7E8A44', raw: true, width: 4.5, shade: [{ pts: [[d[0] + 50, d[1] - 10], [d[0] + 100, d[1] - 10], [d[0] + 100, G], [d[0] + 50, G]], color: '#2A4636' }] });
  for (const [x, y, w, h] of [[14, 20, 26, 40], [52, 70, 30, 24], [10, 96, 20, 16]] as const) p.rect(d[0] + x, d[1] + y, w, h, { fill: WOOD_PALE, r: 2, stroke: null, opacity: 0.65 });
  board([d[0] - 4, d[1] + 70], [d[0] + 96, d[1] + 52], 16);
  p.dot(d[0] + 76, d[1] + 82, 5, '#B8A060');
  p.rect(d[0] + 6, G - 38, 80, 5, { fill: DIM, r: 1, stroke: null, opacity: 0.8 });
  // Where the step was: a cinder block, a bucket for the leak, and a broken plank.
  p.rect(d[0] + 10, G - 30, 70, 30, { fill: '#B89A7A', r: 3, width: 4.5 });
  for (const hx of [d[0] + 22, d[0] + 50]) p.rect(hx, G - 24, 18, 16, { fill: '#3A0F22', r: 2, stroke: null });
  p.shape([[d[0] + 110, G - 2], [d[0] + 114, G - 38], [d[0] + 146, G - 38], [d[0] + 150, G - 2]], { fill: '#8A6A52', raw: true, width: 4 });
  p.line([[d[0] + 114, G - 38], [d[0] + 130, G - 56], [d[0] + 146, G - 38]], { width: 2.6, raw: true });
  board([d[0] - 70, G - 4], [d[0] - 10, G - 22], 12, '#8A5A3E');

  // ---- A broken fence and weeds everywhere at the foot.
  for (const [x, h, tilt] of [[18, 110, -8], [44, 70, 4], [70, 104, 14], [96, 40, 0]] as const) {
    p.shape([[x, G], [x + 18, G], [x + 18 + tilt, G - h], [x + 9 + tilt, G - h - 12], [x + tilt, G - h]], { fill: WOOD_PALE, raw: true, width: 3.5 });
  }
  board([8, G - 70], [92, G - 50], 10, '#8A5A3E');
  for (const [x, n, h] of [[60, 7, 50], [130, 6, 44], [250, 5, 36], [420, 8, 54], [520, 6, 48], [610, 5, 40]] as const) weeds(x, G, n, h);

  // ---- The SOLD sign: a faded red board nailed crooked across the roof, high enough to be seen over
  // the pile of furniture in front. The game writes on it.
  p.shape(L([[370, 410], [500, 400], [506, 452], [374, 462]]), { fill: '#B8463E', raw: true, width: 5, shade: [{ pts: [[360, 440], [520, 430], [520, 470], [360, 470]], color: '#93342F' }] });
  for (const pt of [[380, 418], [494, 410], [384, 452], [498, 444]] as const) p.dot(...lean(pt as unknown as Pt), 3, BATTEN);
  // ---- Lived-in, worn-out detail: a sagging washing line with patched laundry, a rusty satellite dish,
  // a rain barrel under the broken gutter, a bent bicycle wheel, a crooked mailbox, a bird's nest in
  // the gutter, cobwebs in the window corners, and a dead plant in a cracked pot.
  const lineA: Pt = [24, G - 130];
  const lineB: Pt = lean([150, 640]);
  p.line([lineA, [(lineA[0] + lineB[0]) / 2, G - 96], lineB], { width: 2.2, raw: false, opacity: 0.85 });
  for (const [t, c, w, h] of [[0.25, '#B5A893', 34, 44], [0.5, '#2A4636', 28, 52], [0.72, '#C9403A', 26, 30]] as const) {
    const x = lineA[0] + (lineB[0] - lineA[0]) * t;
    const y = G - 104 + Math.sin(t * Math.PI) * 12 - (lineB[1] - lineA[1]) * -t * 0.2;
    p.shape([[x - w / 2, y], [x + w / 2, y], [x + w / 2 - 3, y + h], [x - w / 2 + 2, y + h - 4]], { fill: c, raw: true, width: 3 });
    p.rect(x - 6, y + h * 0.4, 10, 10, { fill: '#8A5A3E', r: 1, width: 2 });
    p.dot(x - w / 2 + 3, y, 2.4, WOOD_DARK);
  }
  // The dish, rusted, hanging off its bracket on the wall.
  const dish = lean([470, 540]);
  p.line([[dish[0] - 6, dish[1] + 30], [dish[0] + 12, dish[1]]], { width: 4, raw: true });
  p.ellipse(dish[0] + 16, dish[1] - 6, 26, 20, { fill: '#B89A7A', width: 3.5, shade: [{ pts: [[dish[0], dish[1]], [dish[0] + 50, dish[1]], [dish[0] + 50, dish[1] + 20], [dish[0], dish[1] + 20]], color: RUST }] });
  p.line([[dish[0] + 16, dish[1] - 6], [dish[0] + 40, dish[1] - 22]], { width: 2.4, raw: true });
  // A rain barrel catching the leak from the gutter.
  p.rect(lean([540, G])[0] - 30, G - 70, 52, 70, { fill: '#6A2E2E', r: 8, width: 4 });
  for (const y of [G - 58, G - 22]) p.line([[lean([540, G])[0] - 30, y], [lean([540, G])[0] + 22, y]], { width: 3.5, color: '#0A0712', raw: true });
  // A bent bicycle wheel leaning on the wall, and a dead plant in a cracked pot.
  p.ellipse(lean([110, G])[0] + 6, G - 40, 36, 38, { stroke: '#0A0712', width: 4 });
  p.line([[lean([110, G])[0] - 22, G - 64], [lean([110, G])[0] + 30, G - 18]], { width: 2, raw: true, opacity: 0.6 });
  p.line([[lean([110, G])[0] + 6, G - 78], [lean([110, G])[0] + 6, G - 2]], { width: 2, raw: true, opacity: 0.6 });
  const pot = lean([370, G]);
  p.shape([[pot[0] - 18, G - 34], [pot[0] + 18, G - 34], [pot[0] + 13, G], [pot[0] - 13, G]], { fill: '#A4603A', raw: true, width: 3.5 });
  p.line([[pot[0] - 4, G - 34], [pot[0] + 2, G - 14]], { width: 1.6, raw: true });
  for (const d of [-1, 1]) p.line([[pot[0], G - 34], [pot[0] + d * 10, G - 56], [pot[0] + d * 18, G - 50]], { width: 2.6, color: WEED_DRY });
  // A crooked mailbox on a leaning post by the fence.
  p.line([[118, G], [128, G - 104]], { width: 7, color: WOOD_DARK });
  p.shape([[106, G - 122], [150, G - 128], [154, G - 96], [110, G - 92]], { fill: '#7E8A44', raw: true, width: 3.5 });
  p.line([[150, G - 124], [158, G - 146]], { width: 2.6, raw: true });
  p.rect(156, G - 152, 12, 8, { fill: '#C9403A', r: 1, width: 2 });
  // A bird's nest in the hanging gutter, and cobwebs in the window corners.
  const nest = lean([330, 520]);
  p.ellipse(nest[0], nest[1], 20, 9, { fill: '#8A5A3E', width: 2.6 });
  for (let k = 0; k < 5; k++) p.line([[nest[0] - 18 + k * 8, nest[1] - 4], [nest[0] - 12 + k * 8, nest[1] + 6]], { width: 1.4, raw: true, opacity: 0.6 });
  for (const [wx, wy, sx] of [[w1[0] + 8, w1[1] + 8, 1], [w2[0] + 78, w2[1] + 8, -1]] as const) {
    for (let k = 0; k < 3; k++) p.line([[wx, wy + k * 8], [wx + sx * (16 - k * 4), wy]], { width: 1.2, color: '#FFFFFF', raw: true, opacity: 0.55 });
    p.line([[wx, wy], [wx + sx * 20, wy + 20]], { width: 1.2, color: '#FFFFFF', raw: true, opacity: 0.55 });
  }

  return { key, svg: p.svg(HOUSE.w, HOUSE.h), w: HOUSE.w, h: HOUSE.h };
}

/** The new house - a royal palace by the sea - and where its chimney (the dome's lantern) and banner are. */
export const MANOR = { w: 1400, h: 1270, ground: 1250, chimney: { x: 700, y: 180 }, banner: { x: 700, y: 852 } };
/** Headroom over the palace for the royal banner on its dome: everything is drawn this much lower. */
const MANOR_TOP = 110;

/**
 * The house at the end of the trip, redrawn as a palace you could not have dreamed of from the old
 * shack: royal, grand and printed in the poster's inks - bone stone, gold, royal red and ink line.
 *
 * Built the way grand architecture reads from a distance: strict symmetry and a clear hierarchy that
 * steps up to one crowning point. Corner pavilions with red roofs and bone cupolas; long wings of
 * arched windows behind a gilded balustrade; two tall towers with gold onion domes and flags; and in
 * the middle a domed block with a columned portico, a crowned crest in its pediment, and over it all
 * a great gilded dome on a windowed drum with a lantern, a crown and the royal banner. In front: grand
 * stairs with a red carpet, red sentry boxes, gilded lamps, palms and a wrought-iron, gold-tipped fence.
 */
export function manorArt(key: string): Art {
  const p = pen(key);
  const G = MANOR.ground - MANOR_TOP;
  const CX = 700;
  const BONE = '#F3E3CC';
  const BONE_SHADE = '#D9C3A6';
  const STONE = '#E6D2B2';
  const GOLD = '#FFB23F';
  const GOLD_DEEP = '#D98A2A';
  const GOLD_LIGHT = '#FFDB8A';
  const RED = '#C8283A';
  const RED_DEEP = '#7E1426';
  const INK = '#0A0712';
  const GLOW = '#FFC86B';
  const GLOW_DEEP = '#FF9E4A';
  const IRON = '#231A2A';
  const LEAF = '#2A4636';
  const LEAF_DARK = '#1A2E24';
  const id = key.replace(/[^a-z0-9]/gi, '');
  let glows = 0;
  const glow = (cx: number, cy: number, rx: number, ry: number, opacity = 0.45) => {
    const g = `${id}pg${glows++}`;
    p.raw(`<defs><radialGradient id="${g}"><stop offset="0" stop-color="${GLOW}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${GLOW}" stop-opacity="0"/></radialGradient></defs><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${g})"/>`);
  };
  const arch = (x: number, y: number, w: number, h: number): Pt[] => {
    const r = w / 2;
    const pts: Pt[] = [[x + w, y + h], [x, y + h]];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      pts.push([x + r + Math.cos(a) * r, y + r + Math.sin(a) * r]);
    }
    return pts;
  };
  /** A lit arched window in a stone surround with a gold keystone; with a balcony if asked. */
  const win = (x: number, y: number, w: number, h: number, balcony = false) => {
    glow(x + w / 2, y + h + 16, w, 28, 0.32);
    p.shape(arch(x - 6, y - 6, w + 12, h + 8), { fill: STONE, raw: true, width: 4 });
    p.shape(arch(x, y, w, h), { fill: GLOW, raw: true, width: 3.5, shade: [{ pts: [[x, y + h * 0.55], [x + w, y + h * 0.5], [x + w, y + h], [x, y + h]], color: GLOW_DEEP }] });
    p.line([[x + w / 2, y + 6], [x + w / 2, y + h - 2]], { width: 2.8, raw: true });
    p.line([[x + 3, y + h * 0.58], [x + w - 3, y + h * 0.58]], { width: 2.6, raw: true });
    p.shape([[x + w / 2 - 7, y - 10], [x + w / 2 + 7, y - 10], [x + w / 2 + 4, y + 5], [x + w / 2 - 4, y + 5]], { fill: GOLD, raw: true, width: 2.6 });
    p.rect(x - 9, y + h, w + 18, 9, { fill: STONE, r: 2, width: 3 });
    if (balcony) {
      for (let bx = x - 8; bx <= x + w + 8; bx += 8) p.line([[bx, y + h + 10], [bx, y + h + 30]], { width: 2.2, color: IRON, raw: true });
      p.line([[x - 12, y + h + 31], [x + w + 12, y + h + 31]], { width: 3.4, color: GOLD, raw: true });
    }
  };
  /** A balustrade: rails and turned balusters, gold-capped. */
  const balustrade = (x0: number, x1: number, y: number, h = 40) => {
    p.rect(x0, y + h - 10, x1 - x0, 11, { fill: STONE, r: 2, width: 3.5 });
    for (let x = x0 + 10; x < x1 - 8; x += 18) p.shape([[x - 4, y + 9], [x + 4, y + 9], [x + 6, y + 20], [x + 3, y + h - 10], [x - 3, y + h - 10], [x - 6, y + 20]], { fill: BONE, raw: true, width: 2.4 });
    p.rect(x0 - 5, y, x1 - x0 + 10, 10, { fill: GOLD, r: 2, width: 3 });
  };
  const urn = (x: number, y: number, s = 1) => {
    p.shape([[x - 14 * s, y - 30 * s], [x + 14 * s, y - 30 * s], [x + 10 * s, y - 12 * s], [x + 5 * s, y - 5 * s], [x + 9 * s, y], [x - 9 * s, y], [x - 5 * s, y - 5 * s], [x - 10 * s, y - 12 * s]], { fill: GOLD, raw: true, width: 3 });
    p.dot(x, y - 34 * s, 5 * s, GOLD_LIGHT);
  };
  const flag = (x: number, y: number, flip: number, color: string) => {
    p.line([[x, y + 80], [x, y]], { width: 4, raw: true, color: IRON });
    p.shape([[x, y + 4], [x + 70 * flip, y + 10], [x + 52 * flip, y + 21], [x + 72 * flip, y + 34], [x, y + 34]], { fill: color, width: 3.2 });
    p.dot(x, y - 3, 5, GOLD);
  };
  /** An onion dome: bulbous, ribbed, gold, with a lantern spike. */
  const onion = (cx: number, base: number, rw: number, rh: number, fill = GOLD, deep = GOLD_DEEP) => {
    const pts: Pt[] = [[cx - rw * 0.9, base], [cx - rw * 1.05, base - rh * 0.3], [cx - rw * 0.85, base - rh * 0.62], [cx - rw * 0.35, base - rh * 0.88], [cx, base - rh], [cx + rw * 0.35, base - rh * 0.88], [cx + rw * 0.85, base - rh * 0.62], [cx + rw * 1.05, base - rh * 0.3], [cx + rw * 0.9, base]];
    p.shape(pts, { fill, width: 5, shade: [{ pts: [[cx + 2, base - rh - 10], [cx + rw * 1.3, base - rh - 10], [cx + rw * 1.3, base + 4], [cx + 2, base + 4]], color: deep }] });
    for (const k of [-0.55, 0, 0.55]) p.line([[cx + k * rw * 0.95, base - 2], [cx + k * rw * 0.95, base - rh * 0.4], [cx + k * rw * 0.3, base - rh * 0.9]], { width: 2.6, color: k < 0 ? GOLD_LIGHT : deep, opacity: 0.9 });
    p.rect(cx - rw * 0.95, base - 6, rw * 1.9, 12, { fill: deep, r: 3, width: 3 });
  };

  // ================================================================ the crowning dome, at the back
  const DOME_BASE = 300;
  // The drum: a ring of arched windows between pilasters.
  p.rect(CX - 150, DOME_BASE, 300, 200, { fill: BONE, r: 4, width: 6, shade: [{ pts: [[CX + 60, DOME_BASE - 10], [CX + 170, DOME_BASE - 10], [CX + 170, DOME_BASE + 210], [CX + 60, DOME_BASE + 210]], color: BONE_SHADE }] });
  for (let i = 0; i < 5; i++) {
    const x = CX - 128 + i * 54;
    win(x, DOME_BASE + 46, 32, 100);
    p.rect(x - 11, DOME_BASE + 20, 8, 170, { fill: STONE, r: 1, stroke: null });
  }
  p.rect(CX - 166, DOME_BASE - 14, 332, 22, { fill: GOLD, r: 3, width: 4 });
  p.rect(CX - 160, DOME_BASE + 186, 320, 16, { fill: STONE, r: 2, width: 3.5 });
  // The dome itself: a great gilded bulb with ribs, a light streak and a bone band of medallions.
  onion(CX, DOME_BASE - 8, 165, 210);
  p.line([[CX - 120, DOME_BASE - 60], [CX - 96, DOME_BASE - 130], [CX - 50, DOME_BASE - 180]], { width: 7, color: '#FFFFFF', opacity: 0.45 });
  for (let i = 0; i < 7; i++) p.dot(CX - 120 + i * 40, DOME_BASE - 24, 6, RED);
  // The lantern, the crown, the banner on its pole.
  p.rect(CX - 26, DOME_BASE - 262, 52, 50, { fill: BONE, r: 3, width: 4 });
  glow(CX, DOME_BASE - 236, 40, 30, 0.6);
  p.rect(CX - 10, DOME_BASE - 254, 20, 34, { fill: GLOW, r: 8, width: 3 });
  p.shape([[CX - 34, DOME_BASE - 262], [CX - 38, DOME_BASE - 292], [CX - 18, DOME_BASE - 276], [CX, DOME_BASE - 304], [CX + 18, DOME_BASE - 276], [CX + 38, DOME_BASE - 292], [CX + 34, DOME_BASE - 262]], { fill: GOLD, raw: true, width: 3.5, shade: [{ pts: [[CX, DOME_BASE - 310], [CX + 44, DOME_BASE - 310], [CX + 44, DOME_BASE - 260], [CX, DOME_BASE - 260]], color: GOLD_DEEP }] });
  for (const dx of [-38, 0, 38]) p.dot(CX + dx, DOME_BASE - (dx ? 294 : 306), 5, RED);
  flag(CX, DOME_BASE - 395, 1, RED);

  // ================================================================ the towers
  for (const tx of [430, 970]) {
    p.rect(tx - 58, 330, 116, G - 330, { fill: BONE, r: 4, width: 6, shade: [{ pts: [[tx + 22, 320], [tx + 64, 320], [tx + 64, G + 4], [tx + 22, G + 4]], color: BONE_SHADE }] });
    for (const y of [470, 660, 850]) p.rect(tx - 62, y, 124, 12, { fill: STONE, r: 2, width: 3 });
    win(tx - 22, 370, 44, 80);
    win(tx - 22, 520, 44, 110, true);
    win(tx - 22, 700, 44, 120);
    // A clock face on each tower.
    p.ellipse(tx, 900, 30, 30, { fill: BONE, width: 4 });
    p.ellipse(tx, 900, 22, 22, { stroke: GOLD, width: 3 });
    p.line([[tx, 900], [tx, 884]], { width: 3, raw: true });
    p.line([[tx, 900], [tx + 12, 904]], { width: 3, raw: true });
    p.rect(tx - 70, 318, 140, 20, { fill: GOLD, r: 3, width: 4 });
    onion(tx, 322, 66, 140);
    p.rect(tx - 6, 156, 12, 30, { fill: GOLD, r: 2, width: 3 });
    flag(tx, 92, tx < CX ? -1 : 1, RED);
  }

  // ================================================================ the wings and corner pavilions
  // Wings: two long storeys of arched windows behind a gilded balustrade with urns.
  for (const [x0, x1] of [[240, 372], [1028, 1160]] as const) {
    p.rect(x0, 560, x1 - x0, G - 560, { fill: BONE, r: 2, width: 6, shade: [{ pts: [[x1 - 34, 550], [x1 + 4, 550], [x1 + 4, G + 4], [x1 - 34, G + 4]], color: BONE_SHADE }] });
    p.rect(x0 - 6, 556, x1 - x0 + 12, 16, { fill: STONE, r: 3, width: 3.5 });
    p.rect(x0 - 4, 800, x1 - x0 + 8, 12, { fill: STONE, r: 2, width: 3 });
    balustrade(x0 + 4, x1 - 4, 516);
    for (const wx of [x0 + 22, x1 - 22 - 44]) {
      win(wx, 610, 44, 130, true);
      win(wx, 850, 44, 150);
    }
  }
  // Corner pavilions: wider, with red roofs and bone cupolas, a gold band under the eaves.
  for (const [x0, x1] of [[70, 250], [1150, 1330]] as const) {
    const mid = (x0 + x1) / 2;
    p.rect(x0, 470, x1 - x0, G - 470, { fill: BONE, r: 3, width: 6, shade: [{ pts: [[x1 - 40, 460], [x1 + 4, 460], [x1 + 4, G + 4], [x1 - 40, G + 4]], color: BONE_SHADE }] });
    p.rect(x0 - 8, 460, x1 - x0 + 16, 18, { fill: GOLD, r: 3, width: 3.5 });
    p.shape([[x0 - 14, 464], [mid, 360], [x1 + 14, 464]], { fill: RED, raw: true, width: 5.5, shade: [{ pts: [[mid, 350], [x1 + 30, 350], [x1 + 30, 470], [mid, 470]], color: RED_DEEP }] });
    for (let k = 1; k < 4; k++) p.line([[x0 - 14 + k * 24, 464 - k * 18], [x1 + 14 - k * 24, 464 - k * 18]], { width: 2.4, color: RED_DEEP, raw: true, opacity: 0.8 });
    p.rect(mid - 20, 316, 40, 46, { fill: BONE, r: 3, width: 4 });
    p.shape([[mid - 26, 318], [mid, 286], [mid + 26, 318]], { fill: GOLD, raw: true, width: 3.5 });
    p.dot(mid, 280, 5, GOLD);
    win(mid - 26, 530, 52, 130, true);
    win(mid - 26, 760, 52, 140);
    p.rect(x0 - 4, 720, x1 - x0 + 8, 12, { fill: STONE, r: 2, width: 3 });
    // Crowned red banners hung from the eaves.
    for (const bx of [x0 + 22, x1 - 22]) {
      p.shape([[bx - 16, 482], [bx + 16, 482], [bx + 16, 580], [bx, 596], [bx - 16, 580]], { fill: RED, raw: true, width: 3.5, shade: [{ pts: [[bx + 2, 470], [bx + 22, 470], [bx + 22, 600], [bx + 2, 600]], color: RED_DEEP }] });
      p.shape([[bx - 9, 540], [bx - 10, 524], [bx - 4, 531], [bx, 520], [bx + 4, 531], [bx + 10, 524], [bx + 9, 540]], { fill: GOLD, raw: true, width: 2 });
    }
  }

  // ================================================================ the central block and portico
  p.rect(480, 440, 440, G - 440, { fill: BONE, r: 3, width: 6.5, shade: [{ pts: [[860, 430], [926, 430], [926, G + 4], [860, G + 4]], color: BONE_SHADE }] });
  for (const x of [480, 896]) p.rect(x, 440, 24, G - 440, { fill: STONE, r: 1, width: 3.5 });
  p.rect(466, 430, 468, 20, { fill: GOLD, r: 3, width: 4 });
  // The pediment, with the royal crest: a red shield under a gold crown, between gold laurels.
  p.shape([[456, 440], [CX, 320], [944, 440]], { fill: BONE, raw: true, width: 6.5, shade: [{ pts: [[CX + 2, 310], [960, 310], [960, 450], [CX + 2, 450]], color: BONE_SHADE }] });
  p.line([[476, 434], [CX, 334], [924, 434]], { width: 3, color: GOLD_DEEP, raw: true });
  p.shape([[CX - 26, 360], [CX + 26, 360], [CX + 26, 392], [CX, 414], [CX - 26, 392]], { fill: RED, raw: true, width: 3.5, shade: [{ pts: [[CX + 2, 356], [CX + 30, 356], [CX + 30, 418], [CX + 2, 418]], color: RED_DEEP }] });
  p.line([[CX, 364], [CX, 408]], { width: 3, color: GOLD, raw: true });
  p.shape([[CX - 22, 358], [CX - 24, 340], [CX - 12, 350], [CX, 334], [CX + 12, 350], [CX + 24, 340], [CX + 22, 358]], { fill: GOLD, raw: true, width: 2.6 });
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) p.ellipse(CX + s * (44 + k * 12), 396 - k * 10, 9, 5, { fill: GOLD, width: 2 });
  urn(456, 440, 0.8);
  urn(944, 440, 0.8);
  urn(CX, 322, 0.7);
  // Piano nobile: a great central arched window with a balcony, two more either side.
  win(CX - 56, 480, 112, 190, true);
  for (const x of [520, 836]) win(x, 500, 46, 150);
  // The entablature the banner hangs on, and the colonnade under it.
  p.rect(470, 716, 460, 54, { fill: STONE, r: 3, width: 5, shade: [{ pts: [[470, 754], [930, 754], [930, 772], [470, 772]], color: BONE_SHADE }] });
  for (let x = 480; x < 924; x += 22) p.rect(x, 762, 10, 8, { fill: GOLD_DEEP, r: 1, stroke: null });
  p.shape([[580, 722], [820, 722], [812, 762], [CX, 754], [588, 762]], { fill: RED, raw: true, width: 4, shade: [{ pts: [[580, 748], [820, 748], [820, 766], [580, 766]], color: RED_DEEP }] });
  p.line([[588, 728], [812, 728]], { width: 2.4, color: GOLD, raw: true });
  // Behind the columns: shade, a lantern, and the grand door.
  p.rect(500, 770, 400, G - 770 - 80, { fill: INK, stroke: null, opacity: 0.2 });
  glow(CX, 960, 200, 100, 0.5);
  p.shape(arch(CX - 68, 820, 136, G - 80 - 820), { fill: GOLD, raw: true, width: 5 });
  p.shape(arch(CX - 56, 832, 112, G - 80 - 832), { fill: RED_DEEP, raw: true, width: 4, shade: [{ pts: [[CX, 820], [CX + 70, 820], [CX + 70, G], [CX, G]], color: '#5A0E1C' }] });
  p.line([[CX, 840], [CX, G - 82]], { width: 3.5, color: GOLD, raw: true });
  for (const [x, y] of [[CX - 28, 900], [CX + 28, 900], [CX - 28, 980], [CX + 28, 980]] as const) p.rect(x - 16, y, 32, 52, { stroke: GOLD, width: 2.6, r: 2 });
  for (const x of [CX - 10, CX + 10]) p.dot(x, 960, 5, GOLD);
  glow(CX, 790, 46, 46, 0.6);
  p.line([[CX, 770], [CX, 786]], { width: 3, raw: true, color: IRON });
  p.shape([[CX - 12, 786], [CX + 12, 786], [CX + 15, 812], [CX - 15, 812]], { fill: GLOW, raw: true, width: 3 });
  for (const x of [522, 594, 666, 734, 806, 878]) {
    p.rect(x - 16, 770, 32, G - 770 - 80, { fill: BONE, r: 2, width: 4.5, shade: [{ pts: [[x + 4, 768], [x + 18, 768], [x + 18, G], [x + 4, G]], color: BONE_SHADE }] });
    for (const fx of [-7, 0, 7]) p.line([[x + fx, 786], [x + fx, G - 98]], { width: 1.5, raw: true, opacity: 0.25 });
    p.rect(x - 22, 768, 44, 14, { fill: GOLD, r: 2, width: 3 });
    p.rect(x - 22, G - 96, 44, 16, { fill: STONE, r: 2, width: 3 });
  }

  // ================================================================ the grounds in front
  // Grand stairs widening to the ground, a red carpet up the middle.
  for (let i = 0; i < 5; i++) {
    const y = G - 80 + i * 16;
    const half = 230 + i * 36;
    p.rect(CX - half, y, half * 2, 16, { fill: i % 2 ? STONE : BONE, r: 2, width: 3.5 });
  }
  p.shape([[CX - 56, G - 80], [CX + 56, G - 80], [CX + 96, G], [CX - 96, G]], { fill: RED, raw: true, width: 3.5, shade: [{ pts: [[CX, G - 86], [CX + 110, G - 86], [CX + 110, G + 2], [CX, G + 2]], color: RED_DEEP }] });
  for (let i = 0; i < 5; i++) p.line([[CX - 56 - i * 8, G - 78 + i * 16], [CX + 56 + i * 8, G - 78 + i * 16]], { width: 2, color: GOLD, raw: true });
  // Gilded lamps at the foot of the stairs.
  for (const lx of [420, 980]) {
    p.rect(lx - 5, G - 210, 10, 210, { fill: IRON, r: 2, width: 3 });
    p.rect(lx - 14, G - 14, 28, 14, { fill: GOLD, r: 2, width: 3 });
    glow(lx, G - 232, 64, 64, 0.6);
    p.shape([[lx - 16, G - 214], [lx + 16, G - 214], [lx + 12, G - 252], [lx - 12, G - 252]], { fill: GLOW, raw: true, width: 3.5 });
    p.shape([[lx - 18, G - 252], [lx, G - 274], [lx + 18, G - 252]], { fill: GOLD, raw: true, width: 3 });
  }
  // Sentry boxes, in royal red, by the wings.
  for (const sx of [300, 1100]) {
    p.rect(sx - 30, G - 170, 60, 170, { fill: RED, r: 2, width: 4, shade: [{ pts: [[sx + 8, G - 180], [sx + 34, G - 180], [sx + 34, G], [sx + 8, G]], color: RED_DEEP }] });
    p.shape([[sx - 38, G - 168], [sx, G - 206], [sx + 38, G - 168]], { fill: GOLD, raw: true, width: 3.5 });
    p.rect(sx - 18, G - 140, 36, 120, { fill: INK, r: 14, stroke: null, opacity: 0.85 });
    p.rect(sx - 34, G - 10, 68, 10, { fill: STONE, r: 1, width: 2.6 });
  }
  // Palms in gold-banded urns by the pavilions.
  for (const [x, lean] of [[200, -36], [1200, 36]] as const) {
    const top: Pt = [x + lean, G - 300];
    p.line([[x, G - 30], [x + lean * 0.3, G - 110], [x + lean * 0.7, G - 210], top], { width: 18, color: '#5A3A30' });
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.95 + (i / 6) * Math.PI * 0.9;
      const len = 120 + (i % 3) * 18;
      const tip: Pt = [top[0] + Math.cos(a) * len, top[1] + Math.sin(a) * len * 0.55 + 44];
      const midp: Pt = [top[0] + Math.cos(a) * len * 0.5, top[1] + Math.sin(a) * len * 0.5 - 6];
      const nx = -Math.sin(a) * 17;
      const ny = Math.cos(a) * 17;
      p.shape([top, [midp[0] + nx, midp[1] + ny], tip, [midp[0] - nx, midp[1] - ny]], { fill: i % 2 ? LEAF : LEAF_DARK, width: 3.5 });
    }
    urn(x, G, 1.6);
  }
  // The wrought-iron fence with gold finials, gapped for the stairs.
  for (const [x0, x1] of [[30, 440], [960, 1370]] as const) {
    p.line([[x0, G - 70], [x1, G - 70]], { width: 4, color: IRON, raw: true });
    p.line([[x0, G - 16], [x1, G - 16]], { width: 4, color: IRON, raw: true });
    for (let x = x0; x <= x1; x += 22) {
      p.line([[x, G - 4], [x, G - 78]], { width: 3, color: IRON, raw: true });
      p.shape([[x - 5, G - 78], [x, G - 92], [x + 5, G - 78]], { fill: GOLD, raw: true, width: 2 });
    }
    for (const px of [x0, x1]) {
      p.rect(px - 12, G - 120, 24, 120, { fill: STONE, r: 2, width: 3.5 });
      urn(px, G - 120, 0.7);
    }
  }

  const svg = p.svg(MANOR.w, MANOR.h).replace(/(<svg[^>]*>)/, `$1<g transform="translate(0 ${MANOR_TOP})">`).replace(/<\/svg>$/, '</g></svg>');
  return { key, svg, w: MANOR.w, h: MANOR.h };
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

/** The official sign's size, and the box within its plate that the words must fit inside. */
export const OFFICIAL_SIGN = { w: 280, h: 236, text: { x: 140, y: 112, w: 232, h: 150 } };

/**
 * An official highway sign: a single galvanised post, a reflective white plate with a bold red
 * border and four rivets, a little warning triangle up top - next to the locals' hand-painted jokes,
 * this one means business. Used for the instructions that actually matter: stop, handbrake on.
 */
export function officialSignArt(): Art {
  const p = pen('sign_official');
  const { w, h } = OFFICIAL_SIGN;
  // The post, and a flange bolted to the ground.
  p.rect(w / 2 - 10, 160, 20, h - 160, { fill: '#8A8478', r: 3, width: 4.5, shade: [{ pts: [[w / 2, 160], [w / 2 + 10, 160], [w / 2 + 10, h], [w / 2, h]], color: '#5F5B50' }] });
  p.rect(w / 2 - 26, h - 16, 52, 14, { fill: '#5F5B50', r: 3, width: 3.5 });
  // The reflective plate: white, rounded, a thick red border.
  p.rect(4, 4, w - 8, 172, { fill: '#F4F2EA', r: 16, width: 7, shade: [{ pts: [[0, 110], [w, 100], [w, 180], [0, 180]], color: '#D8D4C4' }] });
  p.rect(18, 18, w - 36, 144, { stroke: '#C9483A', width: 9, r: 10 });
  for (const [cx, cy] of [[24, 24], [w - 24, 24], [24, 154], [w - 24, 154]] as const) p.dot(cx, cy, 4.2, '#8A8478');
  // A small warning triangle, top centre, above where the words go.
  p.shape([[w / 2, 36], [w / 2 + 24, 70], [w / 2 - 24, 70]], { fill: '#F2C14E', raw: true, width: 4 });
  p.rect(w / 2 - 3, 44, 6, 16, { fill: C.ink, r: 2, stroke: null });
  p.dot(w / 2, 62, 3, C.ink);
  return { key: 'sign_official', svg: p.svg(w, h), w, h };
}

const G_INK = '#0A0712';
const G_BONE = '#F3E3CC';
const G_EMBER = '#FF6A30';
const G_RED = '#E3263A';
const G_GOLD = '#FFB23F';
const G_OLIVE = '#7E8A44';

/** The barrier: ember and ink stripes, gold lamps along it, a red STOP disc at its tip, an ink counterweight. */
export function tollArmArt(): Art {
  const p = pen('toll_arm');
  const w = 420;
  const h = 64;
  p.rect(30, 22, w - 92, 20, { fill: G_BONE, r: 4, width: 4.5, stroke: G_INK });
  for (let x = 36, i = 0; x < w - 70; x += 36, i++) p.shape([[x, 24], [x + 18, 24], [x + 4, 40], [x - 14, 40]], { fill: i % 2 ? G_INK : G_EMBER, raw: true, stroke: null });
  for (let x = 70; x < w - 80; x += 80) p.ellipse(x, 32, 5.5, 5.5, { fill: G_GOLD, width: 2, stroke: G_INK });
  p.ellipse(22, 32, 22, 22, { fill: G_RED, width: 4.5, stroke: G_INK });
  p.rect(10, 28, 24, 8, { fill: G_BONE, r: 1, stroke: null });
  p.rect(w - 66, 12, 58, 40, { fill: G_INK, r: 4, width: 4, stroke: G_INK });
  for (let k = 0; k < 3; k++) p.line([[w - 58 + k * 16, 18], [w - 58 + k * 16, 46]], { width: 2.5, color: G_EMBER, raw: true });
  return { key: 'toll_arm', svg: p.svg(w, h), w, h };
}

/**
 * A level crossing signal: an ink post banded in bone, a bone crossbuck edged in red, two red lamps
 * under ink hoods on a crossbar (they flash in turn), a gold bell, and an olive relay cabinet.
 */
export const RAIL_SIGNAL = { w: 220, h: 460, lamps: [[60, 250], [160, 250]] as [number, number][] };
export function railSignalArt(): Art {
  const p = pen('rail_signal');
  const { w, h } = RAIL_SIGNAL;
  p.rect(100, 70, 20, h - 70, { fill: G_INK, r: 2, width: 3, stroke: G_INK });
  for (let y = 300; y < h - 20; y += 40) p.rect(100, y, 20, 18, { fill: G_BONE, r: 0, stroke: null });
  for (const a of [0.55, -0.55]) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const L = 92;
    const T = 17;
    const pts: Pt[] = [[110 - c * L - s * T, 90 - s * L + c * T], [110 + c * L - s * T, 90 + s * L + c * T], [110 + c * L + s * T, 90 + s * L - c * T], [110 - c * L + s * T, 90 - s * L - c * T]];
    p.shape(pts, { fill: G_RED, raw: true, width: 4, stroke: G_INK });
    const inner: Pt[] = [[110 - c * (L - 8) - s * (T - 6), 90 - s * (L - 8) + c * (T - 6)], [110 + c * (L - 8) - s * (T - 6), 90 + s * (L - 8) + c * (T - 6)], [110 + c * (L - 8) + s * (T - 6), 90 + s * (L - 8) - c * (T - 6)], [110 - c * (L - 8) + s * (T - 6), 90 - s * (L - 8) - c * (T - 6)]];
    p.shape(inner, { fill: G_BONE, raw: true, stroke: null });
  }
  p.rect(30, 236, 160, 14, { fill: G_INK, r: 2, stroke: null });
  for (const [lx, ly] of RAIL_SIGNAL.lamps) {
    p.ellipse(lx, ly, 30, 30, { fill: G_INK, width: 4, stroke: G_INK });
    p.ellipse(lx, ly, 20, 20, { fill: '#5A1420', stroke: null });
    p.ellipse(lx, ly, 22, 22, { stroke: G_BONE, width: 2.5 });
    p.shape([[lx - 32, ly - 22], [lx + 32, ly - 22], [lx + 26, ly - 38], [lx - 26, ly - 38]], { fill: G_INK, raw: true, width: 3, stroke: G_INK });
  }
  p.ellipse(110, 186, 24, 18, { fill: G_GOLD, width: 4, stroke: G_INK });
  p.ellipse(110, 196, 30, 8, { fill: '#D98A2A', width: 3, stroke: G_INK });
  p.rect(130, h - 110, 72, 110, { fill: G_OLIVE, r: 3, width: 4.5, stroke: G_INK, shade: [{ pts: [[180, h - 120], [210, h - 120], [210, h], [182, h]], color: '#2A4636' }] });
  for (let k = 0; k < 4; k++) p.line([[140, h - 90 + k * 12], [190, h - 90 + k * 12]], { width: 2, color: G_INK, raw: true, opacity: 0.6 });
  p.rect(146, h - 38, 40, 10, { fill: G_EMBER, r: 1, stroke: null });
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
  const GLOVE = '#F3E3CC';
  const FOLD = '#D9C3A6';
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
 * cheek, and the acting done by thick eyebrows, eye shapes and the mouth. A teal work jacket with a bone
 * collar, and the back arm resting out of the window.
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
  const SKIN = '#F6C9A0';
  const SKIN_SHADE = '#E0A27A';
  const JACKET = '#2E6E6E';
  const JACKET_SHADE = '#1E4A4E';
  const HAT = '#E3263A';
  const HAT_SHADE = '#9E1A2E';
  const HAIR = '#3A1A26';
  const BONE = '#F3E3CC';
  const INK = C.ink;
  const limb = (pts: Pt[], colour: string, thick: number) => {
    p.line(pts, { width: thick + 8, raw: true, wobble: 0.3 });
    p.line(pts, { width: thick, color: colour, raw: true, wobble: 0.3 });
  };
  const panic = mood === 'panic';
  // The beanie sits high, so the brows and eyes stay clear of it; it jumps when they do.
  const up = (panic ? -12 : mood === 'surprised' ? -5 : 0) - 11;
  // A teal work jacket: shoulders down to the sill, a bone collar, a gold zip.
  p.shape([[cx - 36, cy + 31], [cx - 32, cy + 19], [cx - 14, cy + 13], [cx + 14, cy + 13], [cx + 30, cy + 19], [cx + 34, cy + 31]], { fill: JACKET, width: 4.5, shade: [{ pts: [[cx + 4, cy + 8], [cx + 44, cy + 8], [cx + 44, cy + 36], [cx + 8, cy + 36]], color: JACKET_SHADE }] });
  p.shape([[cx - 14, cy + 13], [cx - 4, cy + 25], [cx + 2, cy + 17], [cx + 8, cy + 25], [cx + 16, cy + 13]], { fill: BONE, raw: true, width: 3 });
  p.line([[cx + 2, cy + 18], [cx + 2, cy + 31]], { width: 2.4, color: '#FFB23F', raw: true });
  // The back arm out of the window: the elbow resting on the sill behind them, the forearm hanging down
  // the door, a hand at its end.
  limb([[cx - 16, cy + 22], [cx - 40, cy + 26], [cx - 56, cy + 30]], JACKET_SHADE, 16);
  limb([[cx - 57, cy + 32], [cx - 58, cy + 50]], JACKET_SHADE, 13);
  p.rect(cx - 66, cy + 47, 16, 7, { fill: BONE, width: 3, r: 2 });
  p.shape([[cx - 51, cy + 53], [cx - 65, cy + 53], [cx - 66, cy + 63], [cx - 62, cy + 70], [cx - 54, cy + 70], [cx - 50, cy + 62]], { fill: SKIN, width: 3.5, shade: [{ pts: [[cx - 70, cy + 50], [cx - 59, cy + 50], [cx - 60, cy + 74], [cx - 70, cy + 74]], color: SKIN_SHADE }] });
  for (const fx of [cx - 54, cx - 58, cx - 62]) p.line([[fx, cy + 64], [fx, cy + 70]], { width: 1.8, color: SKIN_SHADE, raw: true });
  p.shape([[cx - 50, cy + 56], [cx - 45, cy + 60], [cx - 47, cy + 64], [cx - 51, cy + 62]], { fill: SKIN, width: 2.8 });
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
  p.rect(cx - 34, cy - 12 + up, 69, 13, { fill: BONE, r: 5, width: 4 });
  for (let k = 0; k < 8; k++) p.line([[cx - 28 + k * 8, cy - 10 + up], [cx - 28 + k * 8, cy - 1 + up]], { width: 2, color: '#D9C3A6', raw: true });
  p.ellipse(cx - 12, cy - 42 + up * 1.6, 10, 9, { fill: BONE, width: 3.5 });
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
