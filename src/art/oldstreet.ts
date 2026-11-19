import { pen, type Art } from './art';
import type { Pt } from './ink';
import { TILE, plainPen, rnd, wave, peaks } from './backdrop';

/**
 * Old Street, redrawn by hand in the title's printed identity: a golden-hour screen print.
 *
 * The rules every piece here follows:
 * - a limited palette - the poster's inks (ink, oxblood, red, ember, gold, bone) plus two land greens
 *   chosen to sit under a warm sky (an olive and a deep bottle green), nothing else;
 * - far layers are flat silhouettes with no outline, shaded with halftone dots and lit with a thin
 *   ember rim from the low sun; near things are ink-outlined, as on the poster;
 * - shapes are simplified and bold, readable as shapes first (Dorfromantik's "silhouette first").
 *
 * Every picture keeps the key and size of the one it replaces, so the game places it exactly as before.
 */
export const OS = {
  ink: '#0A0712',
  ox: '#3A0F22',
  plum: '#5A1A3A',
  wine: '#7A2440',
  red: '#E3263A',
  ember: '#FF6A30',
  gold: '#FFB23F',
  sand: '#F2C98A',
  bone: '#F3E3CC',
  olive: '#7E8A44',
  oliveLight: '#A3A653',
  bottle: '#2A4636',
  bottleDark: '#1A2E24',
};

/** A halftone screen as an SVG pattern: dots of one colour on a grid turned by an angle. */
function screen(id: string, colour: string, step = 12, r = 3, angle = 30): string {
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${step}" height="${step}" patternTransform="rotate(${angle})"><circle cx="${step / 4}" cy="${step / 4}" r="${r}" fill="${colour}"/><circle cx="${(step * 3) / 4}" cy="${(step * 3) / 4}" r="${r}" fill="${colour}"/></pattern>`;
}
/** A path through points, closed. */
const path = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;

// ---------------------------------------------------------------- the sky's sun

/** The sun, low and huge, as on the title: a hot core breaking up into halftone dots at its rim. */
export function sunArt(): Art {
  const s = 520;
  const c = s / 2;
  let dots = '';
  const step = 13;
  for (let y = 0; y < s; y += step) {
    for (let x = (y / step) % 2 ? step / 2 : 0; x < s; x += step) {
      const d = Math.hypot(x - c, y - c) / (c - 6);
      if (d < 0.62 || d > 1) continue;
      const k = 1 - (d - 0.62) / 0.38;
      dots += `<circle cx="${x}" cy="${y}" r="${(step * 0.55 * Math.sqrt(k)).toFixed(2)}" fill="url(#sg)"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><defs><linearGradient id="sg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${s}"><stop offset="0" stop-color="#FFE2A0"/><stop offset="0.5" stop-color="${OS.gold}"/><stop offset="1" stop-color="${OS.ember}"/></linearGradient></defs><circle cx="${c}" cy="${c}" r="${(c - 6) * 0.63}" fill="url(#sg)"/>${dots}</svg>`;
  return { key: 'sun', svg, w: s, h: s };
}

// ---------------------------------------------------------------- the far layers

/** Distant mountains: an oxblood silhouette, sharp peaks, halftone in the shadowed faces, an ember rim. */
export function mountainsArt(): Art {
  const key = 'bd_mountains';
  const h = 620;
  const ridge = peaks(3, [150, 60, 40, 22]);
  const top: Pt[] = [];
  for (let x = 0; x <= TILE; x += 12) top.push([x, h - 160 - ridge(x)]);
  const body = path([...top, [TILE, h], [0, h]]);
  // The shadow sides: wherever the ridge falls away to the right, a dotted wedge down the slope.
  let faces = '';
  for (let x = 24; x < TILE - 24; x += 12) {
    const a = ridge(x - 12);
    const b = ridge(x + 12);
    if (b < a - 3) faces += `<path d="${path([[x, h - 160 - ridge(x)], [x + 12, h - 160 - b], [x + 40, h - 30], [x + 4, h - 30]])}" fill="url(#mdots)"/>`;
  }
  const rim = top.map(([x, y]) => `${x} ${(y + 3).toFixed(1)}`).join('L');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${h}" viewBox="0 0 ${TILE} ${h}"><defs>${screen('mdots', OS.ox, 12, 3.2)}<linearGradient id="mfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${OS.wine}"/><stop offset="1" stop-color="${OS.plum}"/></linearGradient></defs><path d="${body}" fill="url(#mfade)"/>${faces}<path d="M${rim}" fill="none" stroke="${OS.ember}" stroke-width="3" opacity="0.8"/></svg>`;
  return { key, svg, w: TILE, h, blur: 0.6 };
}

/** Wooded hills: a plum silhouette crowded with tree shapes along the crest, darker and dotted lower down. */
export function forestArt(): Art {
  const key = 'bd_forest';
  const h = 520;
  const hill = wave(11, [70, 30, 18]);
  const at = (x: number) => h - 230 - hill(x);
  const top: Pt[] = [];
  for (let x = 0; x <= TILE; x += 16) top.push([x, at(x)]);
  let trees = '';
  for (let r = 0; r < 3; r++) {
    for (let i = 0, x = (r * 17) % 23; x < TILE; i++) {
      const y = at(x) + r * 30;
      const s = 0.8 + rnd(r + 5, i) * 0.6;
      const col = [OS.wine, OS.plum, OS.ox][r];
      if (rnd(r + 9, i) < 0.62) trees += `<path d="${path([[x, y - 52 * s], [x + 15 * s, y + 6], [x - 15 * s, y + 6]])}" fill="${col}"/>`;
      else trees += `<ellipse cx="${x}" cy="${y - 16 * s}" rx="${18 * s}" ry="${21 * s}" fill="${col}"/>`;
      x += 12 + rnd(r + 3, i) * 14;
    }
  }
  const rim = top.map(([x, y]) => `${x} ${(y - 46).toFixed(1)}`);
  void rim;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${h}" viewBox="0 0 ${TILE} ${h}"><defs>${screen('fdots', OS.ink, 12, 3, 20)}</defs><path d="${path([...top, [TILE, h], [0, h]])}" fill="${OS.plum}"/>${trees}<rect x="0" y="${h - 150}" width="${TILE}" height="150" fill="url(#fdots)" opacity="0.6"/><rect x="0" y="${h - 60}" width="${TILE}" height="60" fill="${OS.ox}"/></svg>`;
  return { key, svg, w: TILE, h, blur: 0.4 };
}

/** Farmland in the low sun: olive hills striped with gold and olive fields, bottle-green hedges, red barns. */
export function farmsArt(): Art {
  const key = 'bd_farms';
  const h = 460;
  const p = plainPen(key);
  const hill = wave(23, [56, 26, 14]);
  const at = (x: number) => h - 250 - hill(x);
  const top: Pt[] = [];
  for (let x = 0; x <= TILE; x += 16) top.push([x, at(x)]);
  p.shape([...top, [TILE, h], [0, h]], { fill: OS.olive, stroke: null, raw: true, wobble: 0.2 });
  const crops = [OS.gold, OS.oliveLight, OS.sand, OS.olive, '#D99A3A', OS.oliveLight];
  for (let band = 0; band < 6; band++) {
    const y0 = 18 + band * 34;
    for (let seg = 0; seg < 10; seg++) {
      const x0 = seg * (TILE / 10);
      const x1 = x0 + TILE / 10;
      const pts: Pt[] = [];
      for (let x = x0; x <= x1; x += 24) pts.push([x, at(x) + y0]);
      for (let x = x1; x >= x0; x -= 24) pts.push([x, at(x) + y0 + 30]);
      p.shape(pts, { fill: crops[(band * 3 + seg * 7) % crops.length], stroke: null, raw: true, wobble: 0.15 });
      for (let x = x0 + 8; x < x1; x += 14) p.line([[x, at(x) + y0 + 4], [x + 6, at(x) + y0 + 27]], { width: 1.8, color: '#00000026', raw: true, wobble: 0 });
    }
    for (let x = 6; x < TILE; x += 11) p.dot(x, at(x) + y0 + 31, 6 + rnd(band, x) * 3, rnd(band + 1, x) < 0.5 ? OS.bottle : OS.bottleDark);
  }
  for (let i = 0; i < 9; i++) {
    const x = 120 + i * 260 + rnd(41, i) * 80;
    const y = at(x) + 30 + rnd(43, i) * 60;
    const kind = Math.floor(rnd(47, i) * 3);
    if (kind === 0) {
      p.rect(x - 22, y - 26, 44, 28, { fill: OS.red, stroke: OS.ink, width: 2.5, r: 1 });
      p.shape([[x - 26, y - 24], [x, y - 46], [x + 26, y - 24]], { fill: OS.ox, stroke: OS.ink, width: 2.5, raw: true });
      p.rect(x - 6, y - 14, 12, 16, { fill: OS.bone, stroke: OS.ink, width: 2, r: 1 });
    } else if (kind === 1) {
      for (let k = 0; k < 3; k++) p.ellipse(x + k * 22, y - 8, 11, 12, { fill: OS.gold, stroke: OS.ink, width: 2 });
    } else {
      for (let k = 0; k < 4; k++) p.dot(x + k * 14 - 20, y - 14 - (k % 2) * 8, 15, k % 2 ? OS.bottle : OS.bottleDark);
    }
  }
  return { key, svg: p.svg(TILE, h), w: TILE, h, blur: 0.3 };
}

/** Clouds as on a print: long flat bands, bone on top, peach and ember underneath, dotted where they thin. */
export function cloudBankArt(n: number): Art {
  const key = `bd_cloud_${n}`;
  const w = 760;
  const h = 300;
  // Three short, staggered bands per cloud, rounded at the ends: lit bone on top, peach, then a dotted
  // ember underside - the way a print breaks a cloud into a few flat strokes.
  let shapes = '';
  const rows = [
    { y: h - 150, half: 150, col: '#FFF1DE' },
    { y: h - 118, half: 230, col: '#FFC29E' },
    { y: h - 88, half: 180, col: 'url(#cdots)' },
  ];
  rows.forEach((row, i) => {
    const cx = w / 2 + (rnd(n + 7, i) - 0.5) * 140 + (i - 1) * 40;
    const half = row.half * (0.8 + rnd(n + 3, i) * 0.3);
    const r = 15 - i * 2;
    shapes += `<rect x="${(cx - half).toFixed(1)}" y="${row.y - r}" width="${(half * 2).toFixed(1)}" height="${r * 2}" rx="${r}" fill="${row.col}"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${screen('cdots', OS.ember, 9, 2.6, 0)}</defs><g opacity="0.88">${shapes}</g></svg>`;
  return { key, svg, w, h, blur: 0.4 };
}

/** The tall grass right in front of the camera: bottle-green blades, ember, bone and red wildflowers. */
export function grassStripArt(): Art {
  const key = 'bd_grass';
  const w = 1200;
  const h = 190;
  const p = plainPen(key);
  p.rect(-10, h - 40, w + 20, 60, { fill: OS.bottleDark, stroke: null, r: 0 });
  const greens = [OS.bottle, OS.bottleDark, '#3A5A3C', OS.olive];
  for (let i = 0; i < 240; i++) {
    const x = (i / 240) * w + rnd(3, i) * 6;
    const tall = 50 + rnd(5, i) * 110;
    const lean = (rnd(7, i) - 0.5) * 40;
    p.line([[x, h], [x + lean * 0.4, h - tall * 0.6], [x + lean, h - tall]], { width: 3 + rnd(9, i) * 3, color: greens[i % 4] });
  }
  for (let i = 0; i < 16; i++) {
    const x = 30 + i * 75 + rnd(11, i) * 30;
    const y = h - 70 - rnd(13, i) * 70;
    p.line([[x, h], [x + 4, y]], { width: 2.5, color: OS.bottleDark });
    const colour = [OS.ember, OS.bone, OS.red, OS.gold][i % 4];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      p.ellipse(x + 4 + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 6, { fill: colour, stroke: OS.ink, width: 1.6 });
    }
    p.dot(x + 4, y, 4, OS.ink);
  }
  return { key, svg: p.svg(w, h), w, h };
}

/** A windmill on the farmland: a bone tower with a red cap, and its sails apart so they can turn. */
export function windmillArts(): Art[] {
  const tower = plainPen('bd_mill');
  tower.shape([[30, 160], [40, 40], [70, 40], [80, 160]], { fill: OS.bone, stroke: OS.ink, width: 3, raw: true, shade: [{ pts: [[56, 30], [90, 30], [90, 170], [60, 170]], color: OS.sand }] });
  tower.shape([[30, 44], [55, 16], [80, 44]], { fill: OS.red, stroke: OS.ink, width: 3, raw: true });
  tower.rect(48, 120, 14, 40, { fill: OS.ox, stroke: OS.ink, width: 2, r: 1 });
  tower.rect(49, 70, 12, 14, { fill: OS.gold, stroke: OS.ink, width: 2, r: 1 });
  const sails = plainPen('bd_sails');
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const pt = (u: number, v: number): Pt => [60 + cos * u - sin * v, 60 + sin * u + cos * v];
    sails.shape([pt(8, -3), pt(56, -3), pt(56, 12), pt(14, 12)], { fill: OS.bone, stroke: OS.ink, width: 2.5, raw: true });
    for (const u of [24, 40]) sails.line([pt(u, -3), pt(u, 12)], { width: 1.6, color: OS.ink, raw: true });
    sails.line([pt(4, 0), pt(58, 0)], { width: 3, color: OS.ink, raw: true });
  }
  sails.dot(60, 60, 6, OS.ink);
  return [
    { key: 'bd_mill', svg: tower.svg(110, 170), w: 110, h: 170 },
    { key: 'bd_sails', svg: sails.svg(120, 120), w: 120, h: 120 },
  ];
}

/** Birds: two ink frames, wings up and down. */
export function birdArts(): Art[] {
  const up = plainPen('bd_bird_up');
  up.shape([[4, 18], [14, 4], [20, 14], [26, 4], [36, 18], [20, 16]], { fill: OS.ink, stroke: null, raw: true, wobble: 0.2 });
  const down = plainPen('bd_bird_down');
  down.shape([[4, 8], [14, 20], [20, 12], [26, 20], [36, 8], [20, 14]], { fill: OS.ink, stroke: null, raw: true, wobble: 0.2 });
  return [
    { key: 'bd_bird_up', svg: up.svg(40, 26), w: 40, h: 26 },
    { key: 'bd_bird_down', svg: down.svg(40, 26), w: 40, h: 26 },
  ];
}

/** A falling leaf, in ember. */
export function leafArt(): Art {
  const p = plainPen('bd_leaf');
  p.shape([[4, 12], [12, 3], [22, 8], [14, 18]], { fill: OS.ember, stroke: OS.ink, width: 2 });
  p.line([[5, 12], [20, 8]], { width: 1.4, color: OS.ink, raw: true });
  return { key: 'bd_leaf', svg: p.svg(26, 22), w: 26, h: 22 };
}

export function backdropArts(): Art[] {
  return [mountainsArt(), forestArt(), farmsArt(), cloudBankArt(0), cloudBankArt(1), cloudBankArt(2), grassStripArt(), ...windmillArts(), ...birdArts(), leafArt()];
}

// ---------------------------------------------------------------- the far side of the road

/** A strip of grass across the road: olive, with an ember rim of light along its top edge. */
export function fieldArt(): Art {
  const top: Pt[] = [];
  for (let x = 0; x <= 1000; x += 50) top.push([x, 24 + Math.sin((x / 1000) * Math.PI * 4) * 5]);
  const line = top.map(([x, y]) => `${x} ${y.toFixed(1)}`).join('L');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="320" viewBox="0 0 1000 320"><defs>${screen('gd', OS.bottle, 12, 2.6)}</defs><path d="M${line}L1000 320L0 320Z" fill="${OS.olive}"/><path d="M${line}L1000 320L0 320Z" fill="url(#gd)" opacity="0.5"/><path d="M${line}" fill="none" stroke="${OS.gold}" stroke-width="4"/></svg>`;
  return { key: 'field', svg, w: 1000, h: 320 };
}

/** Houses across the road: a cottage, a tall house and a shop, ink-outlined, lit windows. */
export function townArt(n: number): Art {
  const key = `town_${n}`;
  const p = pen(key);
  const line = { stroke: OS.ink, width: 5 };
  const pane = { fill: OS.gold, r: 2, stroke: OS.ink, width: 4 };
  const door = { fill: OS.ox, r: 2, ...line };
  if (n === 0) {
    p.rect(30, 130, 220, 150, { fill: OS.sand, r: 2, ...line, shade: [{ pts: [[170, 120], [260, 120], [260, 290], [170, 290]], color: '#D9A86A' }] });
    p.shape([[14, 138], [140, 40], [266, 138]], { fill: OS.red, raw: true, ...line, shade: [{ pts: [[140, 30], [280, 30], [280, 140], [140, 140]], color: OS.wine }] });
    p.rect(120, 200, 44, 80, door);
    p.rect(54, 170, 44, 44, pane);
    p.rect(190, 170, 44, 44, pane);
  } else if (n === 1) {
    p.rect(60, 70, 160, 210, { fill: OS.bone, r: 2, ...line, shade: [{ pts: [[160, 60], [230, 60], [230, 290], [160, 290]], color: OS.sand }] });
    p.shape([[46, 78], [140, 14], [234, 78]], { fill: OS.ox, raw: true, ...line });
    for (const [x, y] of [[84, 100], [156, 100], [84, 162], [156, 162]]) p.rect(x, y, 40, 44, pane);
    p.rect(118, 224, 44, 56, door);
  } else {
    p.rect(20, 120, 240, 160, { fill: OS.sand, r: 2, ...line });
    p.rect(20, 96, 240, 30, { fill: OS.ox, r: 2, ...line });
    for (let x = 30, i = 0; x < 250; x += 22, i++) p.shape([[x, 150], [x + 22, 150], [x + 22, 186], [x, 186]], { fill: i % 2 ? OS.bone : OS.red, raw: true, stroke: null });
    p.line([[22, 150], [258, 150]], { width: 4, raw: true });
    p.rect(44, 198, 100, 58, pane);
    p.rect(176, 198, 50, 82, door);
  }
  return { key, svg: p.svg(280, 290), w: 280, h: 290 };
}

export function fenceArt(): Art {
  const p = pen('fence');
  p.line([[6, 34], [294, 34]], { width: 6, color: OS.ink, raw: true });
  p.line([[6, 62], [294, 62]], { width: 6, color: OS.ink, raw: true });
  for (let x = 16; x < 280; x += 38) p.shape([[x, 90], [x, 22], [x + 9, 10], [x + 18, 22], [x + 18, 90]], { fill: OS.bone, raw: true, stroke: OS.ink, width: 4 });
  return { key: 'fence', svg: p.svg(300, 96), w: 300, h: 96 };
}

/** A telegraph pole in ink, its wires sagging to the next. */
export function poleArt(): Art {
  const p = pen('pole');
  const sag = (y: number): Pt[] => {
    const pts: Pt[] = [];
    for (let x = 30; x <= 730; x += 50) pts.push([x, y + Math.sin(((x - 30) / 700) * Math.PI) * 46]);
    return pts;
  };
  p.line(sag(38), { width: 3, color: OS.ink, raw: true, wobble: 0 });
  p.line(sag(60), { width: 3, color: OS.ink, raw: true, wobble: 0 });
  p.rect(22, 20, 16, 330, { fill: OS.ox, r: 2, stroke: OS.ink, width: 4 });
  p.rect(0, 30, 60, 12, { fill: OS.ox, r: 2, stroke: OS.ink, width: 4 });
  for (const x of [6, 54]) p.dot(x, 28, 4, OS.bone);
  return { key: 'pole', svg: p.svg(740, 350), w: 740, h: 350 };
}

// ---------------------------------------------------------------- this side of the road

/** A street lamp: an ink post and a bone-and-gold lantern. */
export function lampPostArt(): Art {
  const p = pen('lamppost');
  p.rect(40, 60, 14, 330, { fill: OS.ink, r: 2 });
  p.line([[47, 62], [47, 30], [96, 26]], { width: 9, color: OS.ink });
  p.shape([[84, 24], [124, 24], [116, 52], [92, 52]], { fill: OS.gold, raw: true, width: 5 });
  p.shape([[80, 24], [104, 10], [128, 24]], { fill: OS.ink, raw: true, stroke: null });
  p.rect(30, 380, 34, 16, { fill: OS.ink, r: 2, width: 5 });
  for (const y of [120, 220, 320]) p.rect(38, y, 18, 6, { fill: OS.ember, r: 1, stroke: null });
  return { key: 'lamppost', svg: p.svg(140, 400), w: 140, h: 400 };
}

export function bushArt(n: number): Art {
  const key = `bush_${n}`;
  const p = pen(key);
  p.shape([[10, 110], [14, 66], [44, 40], [70, 52], [96, 22], [140, 30], [160, 64], [196, 70], [206, 110]], { fill: n ? OS.bottle : OS.olive, shade: [{ pts: [[120, 0], [220, 0], [220, 120], [150, 120]], color: n ? OS.bottleDark : OS.bottle }] });
  if (n) for (const [x, y] of [[60, 60], [120, 44], [160, 78]] as const) p.dot(x, y, 6, OS.ember);
  return { key, svg: p.svg(216, 116), w: 216, h: 116 };
}

export function tuftArt(n: number): Art {
  const key = `tuft_${n}`;
  const p = pen(key);
  const blades: Pt[][] = n ? [[[20, 56], [14, 20]], [[30, 56], [32, 8]], [[40, 56], [52, 22]]] : [[[16, 46], [8, 18]], [[26, 46], [24, 6]], [[36, 46], [40, 14]], [[44, 46], [56, 26]]];
  blades.forEach((b, i) => p.line(b, { width: 6, color: i % 2 ? OS.bottle : OS.olive, raw: true }));
  return { key, svg: p.svg(64, 60), w: 64, h: 60 };
}

export function flowerArt(n: number): Art {
  const key = `flower_${n}`;
  const p = pen(key);
  p.line([[30, 84], [28, 40]], { width: 5, color: OS.bottle, raw: true });
  p.line([[29, 62], [44, 52]], { width: 5, color: OS.bottle, raw: true });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    p.ellipse(28 + Math.cos(a) * 12, 28 + Math.sin(a) * 12, 9, 9, { fill: n ? OS.bone : OS.ember, width: 3.5, stroke: OS.ink });
  }
  p.dot(28, 28, 6, n ? OS.red : OS.gold);
  return { key, svg: p.svg(60, 88), w: 60, h: 88 };
}

// ---------------------------------------------------------------- the roadside signs

/** A warning diamond on an ink post: ember, a hard ink edge and a bone inner rule. */
function diamond(key: string, symbol: (p: ReturnType<typeof pen>) => void): Art {
  const p = pen(key);
  p.rect(48, 92, 12, 150, { fill: OS.ink, r: 2, width: 3 });
  p.shape([[54, 4], [104, 54], [54, 104], [4, 54]], { fill: OS.ember, raw: true, width: 6, stroke: OS.ink, shade: [{ pts: [[54, 0], [110, 0], [110, 110], [54, 110]], color: '#E0502A' }] });
  p.shape([[54, 16], [92, 54], [54, 92], [16, 54]], { raw: true, width: 3, stroke: OS.bone });
  symbol(p);
  return { key, svg: p.svg(110, 246), w: 110, h: 246 };
}
export function bumpSignArt(): Art {
  return diamond('sign_bump', (p) => p.line([[28, 66], [38, 48], [48, 66], [60, 48], [70, 66], [80, 66]], { width: 6, color: OS.ink }));
}
export function hillSignArt(): Art {
  return diamond('sign_hill', (p) => {
    p.shape([[24, 72], [84, 36], [84, 72]], { fill: OS.ink, raw: true, stroke: null });
    p.rect(40, 50, 16, 9, { fill: OS.bone, r: 1, width: 2.5, stroke: OS.ink });
  });
}

/** A milestone: a bone stone with a red band, ink-outlined. The distance is written on it in the game. */
export function milestoneArt(): Art {
  const p = pen('milestone');
  p.shape([[10, 120], [10, 40], [20, 14], [46, 4], [72, 14], [82, 40], [82, 120]], { fill: OS.bone, raw: true, width: 6, stroke: OS.ink, shade: [{ pts: [[56, 0], [90, 0], [90, 130], [60, 130]], color: OS.sand }] });
  p.rect(10, 24, 72, 14, { fill: OS.red, r: 1, stroke: null });
  return { key: 'milestone', svg: p.svg(92, 128), w: 92, h: 128 };
}

/** The locals' joke plank: a bone board on two ink posts, red nails, a strip of ember tape on a corner. */
export function plankSignArt(): Art {
  const p = pen('sign_plank');
  const w = 340;
  const h = 320;
  p.rect(48, 140, 14, h - 144, { fill: OS.ink, r: 2, width: 3 });
  p.rect(w - 62, 146, 14, h - 150, { fill: OS.ink, r: 2, width: 3 });
  p.shape([[8, 14], [w - 10, 6], [w - 4, 158], [14, 164]], { fill: OS.bone, raw: true, width: 6, stroke: OS.ink, shade: [{ pts: [[0, 138], [w, 130], [w, 172], [0, 172]], color: OS.sand }] });
  for (const [nx, ny] of [[55, 26], [w - 55, 20], [55, 150], [w - 55, 146]] as const) p.dot(nx, ny, 4, OS.red);
  p.shape([[w - 84, 2], [w - 14, -2], [w - 10, 26], [w - 80, 30]], { fill: OS.ember, raw: true, stroke: null, opacity: 0.95 });
  return { key: 'sign_plank', svg: p.svg(w, h), w, h };
}

/** The HOME sign near the end: a red arrow pointing on, a bone house on it, three ember dashes. */
export function homeSignArt(): Art {
  const p = pen('sign_home');
  p.rect(32, 70, 14, 180, { fill: OS.ink, r: 2, width: 3 });
  p.shape([[12, 20], [180, 20], [214, 56], [180, 92], [12, 92]], { fill: OS.red, raw: true, width: 6, stroke: OS.ink, shade: [{ pts: [[0, 66], [220, 62], [220, 100], [0, 100]], color: OS.wine }] });
  p.shape([[40, 54], [62, 34], [84, 54], [84, 78], [40, 78]], { fill: OS.bone, raw: true, width: 4, stroke: OS.ink });
  p.rect(56, 62, 12, 16, { fill: OS.ink, r: 1, stroke: null });
  for (let i = 0; i < 3; i++) p.line([[104 + i * 22, 56], [116 + i * 22, 56]], { width: 7, color: OS.gold, raw: true });
  return { key: 'sign_home', svg: p.svg(224, 254), w: 224, h: 254 };
}
