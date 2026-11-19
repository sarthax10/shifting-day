import type { Art } from './art';
import type { Pt } from './ink';
import { TILE, rnd, wave, peaks } from './backdrop';

/**
 * Maple Valley, redrawn by hand in the title's printed identity: a misty autumn dawn, as a screen print.
 *
 * Where Old Street is golden hour (wine sky, ember light), the valley is the morning after: a cool violet
 * sky warming to peach at the horizon, mist lying in the folds of the hills, and the woods on fire with
 * colour against it. The rules are Old Street's:
 * - only the poster's inks, plus the valley's own few: a dusk violet, a mauve for distance, a peach for the
 *   low sun, two evergreens and a deep bottle teal for water;
 * - far layers are flat silhouettes with no outline, shaded with halftone dots, rimmed where the low sun
 *   catches them, and sinking into the mist at their feet;
 * - shapes are bold and simple, readable as shapes first.
 *
 * Every picture keeps the key and size of the one it replaces, so the biome places it exactly as before.
 */
export const MV = {
  ink: '#0A0712',
  ox: '#3A0F22',
  plum: '#5A1A3A',
  wine: '#7A2440',
  violet: '#4A2A52',
  mauve: '#8E4A66',
  rose: '#B8607A',
  peach: '#F2A884',
  apricot: '#F9C890',
  bone: '#F3E3CC',
  mist: '#F6D9C0',
  red: '#E3263A',
  ember: '#FF6A30',
  gold: '#FFB23F',
  rust: '#C0602E',
  ochre: '#D98A2A',
  bottle: '#2A4636',
  bottleDark: '#1A2E24',
  olive: '#7E8A44',
  teal: '#2E5A4E',
  tealDeep: '#1E3A34',
  tealLight: '#4E8A7A',
};

/** The dawn sky, top to horizon. */
export const MV_SKY: [number, string][] = [
  [0, '#24163A'],
  [0.3, '#4E2A58'],
  [0.56, '#9A4E72'],
  [0.78, '#E8967E'],
  [0.92, '#F8C49A'],
  [1, '#FBE2BC'],
];

/** A halftone screen as an SVG pattern: dots of one colour on a grid turned by an angle. */
function screen(id: string, colour: string, step = 12, r = 3, angle = 30): string {
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${step}" height="${step}" patternTransform="rotate(${angle})"><circle cx="${step / 4}" cy="${step / 4}" r="${r}" fill="${colour}"/><circle cx="${(step * 3) / 4}" cy="${(step * 3) / 4}" r="${r}" fill="${colour}"/></pattern>`;
}
/** A path through points, closed. */
const path = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
/** An open path through points. */
const line = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}`;
const doc = (w: number, h: number, defs: string, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
/** Mist pooling at the foot of a layer: a band fading up from the mist colour to nothing. */
const mistFoot = (id: string, w: number, y0: number, y1: number, strength: number) =>
  [`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${MV.mist}" stop-opacity="0"/><stop offset="1" stop-color="${MV.mist}" stop-opacity="${strength}"/></linearGradient>`, `<rect x="0" y="${y0}" width="${w}" height="${y1 - y0}" fill="url(#${id})"/>`];

// ---------------------------------------------------------------- the sun

/** The dawn sun: big and pale, a warm core breaking up into halftone at its rim, as on the title. */
export function valleySunArt(): Art {
  const s = 560;
  const c = s / 2;
  let dots = '';
  const step = 14;
  for (let y = 0; y < s; y += step) {
    for (let x = (y / step) % 2 ? step / 2 : 0; x < s; x += step) {
      const d = Math.hypot(x - c, y - c) / (c - 6);
      if (d < 0.6 || d > 1) continue;
      const k = 1 - (d - 0.6) / 0.4;
      dots += `<circle cx="${x}" cy="${y}" r="${(step * 0.52 * Math.sqrt(k)).toFixed(2)}" fill="url(#vs)"/>`;
    }
  }
  const defs = `<linearGradient id="vs" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${s}"><stop offset="0" stop-color="#FFF6DE"/><stop offset="0.55" stop-color="${MV.apricot}"/><stop offset="1" stop-color="${MV.peach}"/></linearGradient>`;
  return { key: 'bd_a_sun', svg: doc(s, s, defs, `<circle cx="${c}" cy="${c}" r="${(c - 6) * 0.61}" fill="url(#vs)"/>${dots}`), w: s, h: s };
}

// ---------------------------------------------------------------- the far mountains

/**
 * Two ranges of mountains, far off: the back one pale mauve with the season's first snow on its highest
 * peaks, the front one deeper violet with halftone on the faces turned from the sun. A peach rim where
 * the low sun catches the ridges. Both sink into the mist at their feet.
 */
export function valleyFarArt(): Art {
  const key = 'bd_a_far';
  const h = 560;
  const back = peaks(31, [130, 56, 34, 18]);
  const front = peaks(47, [90, 40, 22, 12]);
  const bt: Pt[] = [];
  const ft: Pt[] = [];
  for (let x = 0; x <= TILE; x += 12) {
    bt.push([x, h - 250 - back(x)]);
    ft.push([x, h - 150 - front(x)]);
  }
  let body = `<path d="${path([...bt, [TILE, h], [0, h]])}" fill="url(#fb)"/>`;
  // Snow on the back range's highest peaks: a cap following the ridge down a little way.
  const capLine = Math.min(...bt.map(([, y]) => y)) + 46;
  for (let i = 1; i < bt.length - 1; i++) {
    const [x, y] = bt[i];
    if (y > capLine) continue;
    const [, yl] = bt[i - 1];
    const [, yr] = bt[i + 1];
    if (y <= yl && y <= yr) {
      const depth = capLine - y;
      body += `<path d="${path([[x - depth * 0.9, y + depth * 0.8], [x - 4, y - 1], [x + 4, y - 1], [x + depth * 0.9, y + depth * 0.8], [x + depth * 0.4, y + depth * 0.6], [x, y + depth * 0.85], [x - depth * 0.45, y + depth * 0.6]])}" fill="${MV.bone}" opacity="0.85"/>`;
    }
  }
  body += `<path d="${line(bt.map(([x, y]) => [x, y + 2] as Pt))}" fill="none" stroke="${MV.peach}" stroke-width="2.5" opacity="0.7"/>`;
  // The front range, its shadowed faces dotted.
  body += `<path d="${path([...ft, [TILE, h], [0, h]])}" fill="url(#ff)"/>`;
  for (let x = 24; x < TILE - 24; x += 12) {
    const a = front(x - 12);
    const b = front(x + 12);
    if (b < a - 3) body += `<path d="${path([[x, h - 150 - front(x)], [x + 12, h - 150 - b], [x + 44, h - 20], [x + 4, h - 20]])}" fill="url(#fd)"/>`;
  }
  body += `<path d="${line(ft.map(([x, y]) => [x, y + 2] as Pt))}" fill="none" stroke="${MV.apricot}" stroke-width="3" opacity="0.75"/>`;
  const [mg, mr] = mistFoot('fm', TILE, h - 170, h, 0.7);
  const defs = `<linearGradient id="fb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A86A8A"/><stop offset="1" stop-color="#C08A98"/></linearGradient><linearGradient id="ff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6E3256"/><stop offset="1" stop-color="#9A4E6E"/></linearGradient>${screen('fd', MV.violet, 12, 3)}${mg}`;
  return { key, svg: doc(TILE, h, defs, body + mr), w: TILE, h, blur: 0.6 };
}

// ---------------------------------------------------------------- woods, as crowns

interface CrownRow {
  at: (x: number) => number;
  size: number;
  hues: string[];
  seed: number;
  /** Spires of evergreen among the crowns, this share of them. */
  firs?: number;
  dots: string;
  rim: string;
  skip?: (x: number) => boolean;
}
/**
 * A wood as one printed mass: a row of round crowns side by side, each in its own autumn colour, shaded on
 * the side away from the sun with halftone dots and rimmed where the light catches the top. Firs stand up
 * dark among them. Laid across one tile and again either side of it, so copies join without a seam.
 */
function crowns(row: CrownRow, bottom: number, mass: string): string {
  const { at, size, hues, seed } = row;
  const widths: number[] = [];
  for (let i = 0, x = 0; x < TILE; i++) {
    const w = size * (0.7 + rnd(seed, i) * 0.7);
    widths.push(w);
    x += w;
  }
  const k = TILE / widths.reduce((a, b) => a + b, 0);
  const list: { cx: number; w: number; bh: number; hue: string; fir: boolean; base: number }[] = [];
  let x = 0;
  widths.forEach((w0, i) => {
    const w = w0 * k;
    const cx = x + w / 2;
    x += w;
    const fir = rnd(seed + 3, i) < (row.firs ?? 0);
    list.push({ cx, w, bh: w * (0.34 + rnd(seed + 9, i) * 0.18), hue: hues[Math.floor(rnd(seed + 5, i) * hues.length)], fir, base: at(cx) });
  });
  let out = '';
  for (const shift of [-TILE, 0, TILE]) {
    let run: Pt[] = [];
    const flush = () => {
      if (run.length > 2) out += `<path d="${path([...run, [run[run.length - 1][0], bottom], [run[0][0], bottom]])}" fill="${mass}"/>`;
      run = [];
    };
    for (const c of list) {
      if (row.skip?.(c.cx)) {
        flush();
        continue;
      }
      for (let a = 0; a <= 6; a++) {
        const t = Math.PI + (a / 6) * Math.PI;
        run.push([c.cx + shift + (Math.cos(t) * c.w) / 2, c.base + Math.sin(t) * c.bh]);
      }
    }
    flush();
    for (const c of list) {
      const bx = c.cx + shift;
      if (bx < -c.w || bx > TILE + c.w || row.skip?.(c.cx)) continue;
      if (c.fir) {
        // A fir: a dark spire standing up out of the wood, tiered.
        const ht = c.bh * 2.4;
        const fw = c.w * 0.32;
        const tiers: Pt[] = [];
        for (let t = 0; t <= 4; t++) {
          const y = c.base - ht + (t / 4) * ht;
          const wdt = fw * (t / 4);
          tiers.push([bx + wdt + (t % 2 ? 4 : 0), y]);
        }
        const left = tiers.map(([px, py]) => [bx - (px - bx), py] as Pt).reverse();
        out += `<path d="${path([...tiers, [bx + fw * 0.4, c.base + 6], [bx - fw * 0.4, c.base + 6], ...left])}" fill="${MV.bottle}"/>`;
        out += `<path d="${path([[bx, c.base - ht], ...tiers.slice(1), [bx, c.base + 6]])}" fill="url(#${row.dots})"/>`;
        continue;
      }
      const pts: Pt[] = [];
      for (let a = 0; a <= 10; a++) {
        const t = Math.PI + (a / 10) * Math.PI;
        pts.push([bx + (Math.cos(t) * c.w) / 2, c.base + Math.sin(t) * c.bh]);
      }
      pts.push([bx + c.w * 0.42, c.base + c.bh * 0.4], [bx - c.w * 0.42, c.base + c.bh * 0.4]);
      out += `<path d="${path(pts)}" fill="${c.hue}"/>`;
      // Shade on the side away from the sun (the light is low on the left), in dots.
      const shade: Pt[] = [];
      for (let a = 0; a <= 6; a++) {
        const t = Math.PI * 1.55 + (a / 6) * Math.PI * 0.45;
        shade.push([bx + (Math.cos(t) * c.w) / 2, c.base + Math.sin(t) * c.bh]);
      }
      shade.push([bx + c.w * 0.42, c.base + c.bh * 0.4], [bx + c.w * 0.05, c.base + c.bh * 0.4], [bx + c.w * 0.08, c.base - c.bh * 0.5]);
      out += `<path d="${path(shade)}" fill="url(#${row.dots})"/>`;
      // The rim of light across the top-left of the crown.
      const rim: Pt[] = [];
      for (let a = 0; a <= 6; a++) {
        const t = Math.PI * 1.08 + (a / 6) * Math.PI * 0.5;
        rim.push([bx + (Math.cos(t) * c.w * 0.47), c.base + Math.sin(t) * c.bh * 0.94]);
      }
      out += `<path d="${line(rim)}" fill="none" stroke="${row.rim}" stroke-width="${Math.max(2, c.w / 26).toFixed(1)}" stroke-linecap="round" opacity="0.85"/>`;
    }
  }
  return out;
}

// ---------------------------------------------------------------- the ridge

/**
 * Rolling hills, wooded all over, between the mountains and the valley: muted by distance and lying in
 * mist, with a few things to find on them - a red barn, a white chapel and its steeple, a farmhouse with
 * a curl of smoke.
 */
export function valleyRidgeArt(): Art {
  const key = 'bd_a_ridge';
  const h = 520;
  const hill = wave(37, [80, 34, 18]);
  const at = (x: number) => h - 250 - hill(x);
  const top: Pt[] = [];
  for (let x = 0; x <= TILE; x += 16) top.push([x, at(x)]);
  let body = `<path d="${path([...top, [TILE, h], [0, h]])}" fill="${MV.wine}"/>`;
  body += crowns({ at, size: 50, hues: ['#C8584A', '#D9784A', '#D89A4E', '#B0404A', '#CC6A3E', '#9A3A48'], seed: 61, firs: 0.12, dots: 'rd', rim: '#F8C49A' }, h, '#8A3448');
  body += crowns({ at: (x) => at(x) + 44, size: 56, hues: ['#D8603E', '#E08A3E', '#C8403E', '#E0A24A', '#B84A3E'], seed: 67, firs: 0.1, dots: 'rd2', rim: '#FBD2A0' }, h, '#7A2A40');
  // Landmarks, two to a tile, standing in clearings among the trees.
  const barn = (x: number) => {
    const y = at(x) + 70;
    body += `<path d="${path([[x - 34, y], [x - 34, y - 34], [x - 20, y - 52], [x + 20, y - 52], [x + 34, y - 34], [x + 34, y]])}" fill="${MV.red}"/><path d="${path([[x - 38, y - 32], [x - 22, y - 56], [x + 22, y - 56], [x + 38, y - 32], [x + 34, y - 30], [x + 20, y - 50], [x - 20, y - 50], [x - 34, y - 30]])}" fill="${MV.ox}"/><rect x="${x - 10}" y="${y - 24}" width="20" height="24" fill="${MV.bone}"/><path d="M${x - 10} ${y - 24}L${x + 10} ${y}M${x + 10} ${y - 24}L${x - 10} ${y}" stroke="${MV.red}" stroke-width="2.5"/>`;
  };
  const chapel = (x: number) => {
    const y = at(x) + 66;
    body += `<rect x="${x - 26}" y="${y - 34}" width="52" height="34" fill="${MV.bone}"/><path d="${path([[x - 30, y - 32], [x, y - 52], [x + 30, y - 32]])}" fill="${MV.plum}"/><rect x="${x - 40}" y="${y - 62}" width="16" height="62" fill="${MV.bone}"/><path d="${path([[x - 43, y - 60], [x - 32, y - 100], [x - 21, y - 60]])}" fill="${MV.plum}"/><path d="M${x - 32} ${y - 100}L${x - 32} ${y - 112}M${x - 37} ${y - 106}L${x - 27} ${y - 106}" stroke="${MV.bone}" stroke-width="2"/><rect x="${x - 36}" y="${y - 48}" width="8" height="10" rx="4" fill="${MV.gold}"/>${[-12, 4].map((dx) => `<rect x="${x + dx}" y="${y - 26}" width="8" height="12" rx="4" fill="${MV.gold}"/>`).join('')}`;
  };
  const farm = (x: number) => {
    const y = at(x) + 72;
    body += `<rect x="${x - 30}" y="${y - 30}" width="60" height="30" fill="${MV.apricot}"/><path d="${path([[x - 36, y - 28], [x - 18, y - 50], [x + 18, y - 50], [x + 36, y - 28]])}" fill="${MV.ox}"/><rect x="${x + 12}" y="${y - 62}" width="9" height="16" fill="${MV.ox}"/>${[-18, -2, 14].map((dx) => `<rect x="${x + dx}" y="${y - 22}" width="8" height="10" fill="${MV.gold}"/>`).join('')}<path d="${line([[x + 16, y - 64], [x + 10, y - 84], [x + 22, y - 104], [x + 14, y - 126], [x + 28, y - 150]])}" fill="none" stroke="${MV.mist}" stroke-width="7" stroke-linecap="round" opacity="0.6"/>`;
  };
  barn(420);
  chapel(1240);
  farm(1980);
  const [mg, mr] = mistFoot('rm', TILE, h - 200, h - 40, 0.6);
  const defs = `${screen('rd', MV.ox, 10, 2.4)}${screen('rd2', MV.ox, 10, 2.6)}${mg}`;
  return { key, svg: doc(TILE, h, defs, body + mr), w: TILE, h, blur: 0.4 };
}

// ---------------------------------------------------------------- the valley

/** Where the valley's own falls come over the cliff: kept exactly where the live water expects them. */
export const FALLS = { x: 1180, top: 120, bottom: 360, w: 90 };

/**
 * The valley itself: plum cliffs either side of a gorge, the falls pouring into a pool, a red covered
 * bridge across the gap on stone piers, the woods along the cliff tops blazing red, ember and gold, and
 * the river below - deep teal, holding the sky's peach and the trees' colours in broken reflections.
 * The falls' moving water is a separate strip, laid over the notch left for it.
 */
export function valleyArt(): Art {
  const key = 'bd_a_valley';
  const h = 520;
  const hill = wave(41, [60, 30, 14]);
  const at = (x: number) => h - 260 - hill(x) - (Math.abs(x - FALLS.x) < 260 ? 90 * Math.cos(((x - FALLS.x) / 260) * (Math.PI / 2)) : 0);
  const top: Pt[] = [];
  for (let x = 0; x <= TILE; x += 12) top.push([x, at(x)]);
  // The cliffs: a plum mass with strata, dotted shade low down, and a lit rose edge along the top.
  let body = `<path d="${path([...top, [TILE, h], [0, h]])}" fill="url(#vc)"/>`;
  for (let k = 1; k < 6; k++) body += `<path d="${line(top.map(([x, y]) => [x, y + 30 * k + Math.sin(x / 70 + k) * 6] as Pt))}" fill="none" stroke="${MV.ox}" stroke-width="2.5" opacity="0.55"/>`;
  body += `<path d="${path([...top.map(([x, y]) => [x, y + 120] as Pt), [TILE, h], [0, h]])}" fill="url(#vd)"/>`;
  // The river: a winding band, the shore below it, the sky and the woods reflected in it.
  const turn = (x: number, k: number, ph = 0) => Math.sin((x / TILE) * Math.PI * 2 * k + ph);
  const far = (x: number) => h - 74 + turn(x, 5) * 7 + turn(x, 13, 1) * 3;
  const near = (x: number) => h - 26 + turn(x, 4, 2) * 6 + turn(x, 11) * 2;
  const xs: number[] = [];
  for (let x = 0; x <= TILE; x += 12) xs.push(x);
  body += `<path d="${path([...xs.map((x): Pt => [x, near(x) - 4]), [TILE, h], [0, h]])}" fill="#D8AE86"/>`;
  body += `<path d="${path([...xs.map((x): Pt => [x, far(x)]), ...xs.slice().reverse().map((x): Pt => [x, near(x)])])}" fill="url(#vr)"/>`;
  for (let i = 0, x = 6; x < TILE; i++, x += 18 + rnd(91, i) * 40) body += `<ellipse cx="${x.toFixed(1)}" cy="${(near(x) + 5).toFixed(1)}" rx="${(5 + rnd(93, i) * 6).toFixed(1)}" ry="3" fill="${rnd(95, i) < 0.5 ? '#B88A6A' : MV.bone}" opacity="0.8"/>`;
  const blaze = [MV.red, MV.ember, MV.gold, MV.rust, '#F28A4A', MV.ochre];
  for (let i = 0, x = 20; x < TILE; i++, x += 46 + rnd(73, i) * 44) {
    if (Math.abs(x - FALLS.x) < 160) continue;
    for (let k = 0; k < 3; k++) body += `<rect x="${(x - 12 + k * 10).toFixed(1)}" y="${(far(x) + 3 + k * 4).toFixed(1)}" width="7" height="${10 + k * 3}" fill="${blaze[(i + k) % blaze.length]}" opacity="0.4"/>`;
  }
  for (let i = 0, x = 30; x < TILE; i++, x += 70 + rnd(75, i) * 90) body += `<rect x="${x.toFixed(1)}" y="${((far(x) + near(x)) / 2 + rnd(77, i) * 8 - 4).toFixed(1)}" width="${(30 + rnd(79, i) * 50).toFixed(1)}" height="2.5" fill="${MV.peach}" opacity="0.55"/>`;
  // The pool the falls drop into.
  body += `<ellipse cx="${FALLS.x}" cy="${h - 60}" rx="140" ry="26" fill="${MV.tealDeep}"/><ellipse cx="${FALLS.x}" cy="${h - 54}" rx="110" ry="16" fill="${MV.teal}"/>`;
  // The notch the water has cut: dark and wet behind the falls, with a lip of rock at the top.
  body += `<path d="${path([[FALLS.x - 50, FALLS.top + 6], [FALLS.x + 50, FALLS.top + 4], [FALLS.x + 96, h - 70], [FALLS.x - 96, h - 66]])}" fill="#1E0A18"/>`;
  for (let i = 0; i < 6; i++) body += `<path d="M${FALLS.x - 60 + i * 24} ${FALLS.top + 20}L${FALLS.x - 64 + i * 25} ${h - 80}" stroke="${MV.violet}" stroke-width="2" opacity="0.7"/>`;
  body += `<path d="${path([[FALLS.x - 60, FALLS.top + 4], [FALLS.x, FALLS.top - 4], [FALLS.x + 60, FALLS.top + 2], [FALLS.x + 56, FALLS.top + 18], [FALLS.x, FALLS.top + 10], [FALLS.x - 56, FALLS.top + 20]])}" fill="${MV.ox}"/>`;
  // The woods along the cliff tops, broken where the falls come over: the nearest and richest of them all.
  body += crowns({ at: (x) => at(x) + 12, size: 48, hues: blaze, seed: 71, firs: 0.14, dots: 'vw', rim: '#FFE2A8', skip: (x) => Math.abs(x - FALLS.x) < 90 }, h - 140, MV.wine);
  body += crowns({ at: (x) => at(x) + 50, size: 44, hues: [MV.red, MV.ember, MV.gold, MV.rust], seed: 79, firs: 0.08, dots: 'vw', rim: '#FFE2A8', skip: (x) => Math.abs(x - FALLS.x) < 110 }, h - 130, MV.plum);
  // A red covered bridge across the gap between two cliff tops, on stone piers down to the river.
  const bx = 1750;
  const by = at(bx) + 30;
  for (const px of [bx - 150, bx + 150]) body += `<path d="${path([[px - 18, by + 30], [px + 18, by + 30], [px + 28, far(px) + 4], [px - 28, far(px) + 4]])}" fill="${MV.mauve}"/><path d="${path([[px + 2, by + 30], [px + 18, by + 30], [px + 28, far(px) + 4], [px + 4, far(px) + 4]])}" fill="url(#vd)"/>`;
  body += `<rect x="${bx - 210}" y="${by - 50}" width="420" height="60" fill="${MV.red}"/>`;
  for (let x = bx - 196; x < bx + 200; x += 20) body += `<path d="M${x} ${by - 48}L${x} ${by + 8}" stroke="#B01C30" stroke-width="3"/>`;
  for (const wx of [bx - 120, bx - 40, bx + 40, bx + 120]) body += `<rect x="${wx - 14}" y="${by - 34}" width="28" height="18" fill="${MV.ox}"/>`;
  body += `<path d="${path([[bx - 226, by - 46], [bx - 190, by - 82], [bx + 190, by - 82], [bx + 226, by - 46]])}" fill="${MV.ox}"/><path d="${line([[bx - 190, by - 80], [bx + 190, by - 80]])}" stroke="${MV.peach}" stroke-width="3" opacity="0.8"/><rect x="${bx - 214}" y="${by + 8}" width="428" height="10" fill="${MV.ox}"/>`;
  // A little chapel above the river, its windows lit for the morning.
  const cx = 420;
  const cy = at(cx) + 46;
  body += `<rect x="${cx - 30}" y="${cy - 40}" width="60" height="40" fill="${MV.bone}"/><path d="${path([[cx - 36, cy - 38], [cx, cy - 62], [cx + 36, cy - 38]])}" fill="${MV.ox}"/><rect x="${cx + 22}" y="${cy - 76}" width="18" height="76" fill="${MV.bone}"/><path d="${path([[cx + 18, cy - 74], [cx + 31, cy - 120], [cx + 44, cy - 74]])}" fill="${MV.ox}"/><path d="M${cx + 31} ${cy - 120}L${cx + 31} ${cy - 134}M${cx + 25} ${cy - 128}L${cx + 37} ${cy - 128}" stroke="${MV.bone}" stroke-width="2.5"/>${[-18, -2].map((dx) => `<rect x="${cx + dx}" y="${cy - 30}" width="9" height="14" rx="4.5" fill="${MV.gold}"/>`).join('')}`;
  // Mist lying along the river.
  const [mg, mr] = mistFoot('vm', TILE, h - 150, h - 60, 0.55);
  const defs = `<linearGradient id="vc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${MV.mauve}"/><stop offset="0.45" stop-color="${MV.plum}"/><stop offset="1" stop-color="${MV.ox}"/></linearGradient><linearGradient id="vr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${MV.tealLight}"/><stop offset="0.5" stop-color="${MV.teal}"/><stop offset="1" stop-color="${MV.tealDeep}"/></linearGradient>${screen('vd', MV.ox, 11, 3)}${screen('vw', MV.ox, 9, 2.4)}${mg}`;
  return { key, svg: doc(TILE, h, defs, body + mr), w: TILE, h, blur: 0.25 };
}

/** Glints of the dawn on the river: short bone and peach dashes in the band the river always covers. */
export function valleyGlintArt(): Art {
  const key = 'bd_a_glint';
  const h = 40;
  let body = '';
  for (let i = 0, x = 4; x < TILE - 40; i++, x += 30 + rnd(97, i) * 60) {
    const y = 4 + rnd(99, i) * 30;
    body += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(10 + rnd(101, i) * 26).toFixed(1)}" height="${(2 + rnd(103, i) * 2).toFixed(1)}" rx="1.5" fill="${rnd(105, i) < 0.35 ? MV.peach : '#FFF4E0'}" opacity="0.9"/>`;
  }
  return { key, svg: doc(TILE, h, '', body), w: TILE, h };
}
