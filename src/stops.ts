import Phaser from 'phaser';
import { pen, type Art } from './art';
import { C, mix } from './ink';

/**
 * The checkpoints: a different roadside building for every stop, each with its own silhouette,
 * sign, props, lights and one moving part. They are drawn standing on their ground line at the
 * bottom of the picture; the game writes the names on and runs the animation.
 *
 *   0  Corner Fuel           a 1950s station, flat canopy, arrow pylon with chasing bulbs
 *   1  Maple Mill Fuel & Pie a stone watermill and pie shop, its wheel turning in the millrace
 *   2  Summit Lodge          an A-frame ski lodge under deep snow, string lights and smoke
 *   3  Starlite Diner        a chrome streamline diner with a rooftop neon sign
 */

export interface StopLook {
  key: string;
  w: number;
  h: number;
  /** Where the name goes, how wide it may be, and its colours. */
  sign: { x: number; y: number; w: number; size: number; color: string; stroke: string; rot?: number };
  /** Warm lights to glow (windows, lamps, canopy), as [x, y, width, height, colour]. */
  glows: [number, number, number, number, number][];
  /** Where the canopy or porch stands, so the parked truck sits under it. */
  bay: number;
}

const INK = C.ink;
const WALL_LIGHT = '#FFD98A';

// ---------------------------------------------------------------- 0. Corner Fuel

export const CORNER: StopLook = {
  key: 'stopart_0',
  w: 900,
  h: 560,
  sign: { x: 760, y: 92, w: 128, size: 26, color: '#FFF4DE', stroke: '#8E1E24', rot: -0.03 },
  glows: [
    [180, 420, 300, 120, 0xffd27a],
    [560, 300, 300, 50, 0xfff6d8],
  ],
  bay: 560,
};
function cornerArt(): Art {
  const p = pen(CORNER.key);
  const { h } = CORNER;
  // The station house: white, a rounded front corner, a red band, big shop windows and a garage door.
  p.shape([[40, h], [40, 300], [300, 300], [330, 310], [340, 340], [340, h]], { fill: '#F4EFE6', width: 5, raw: true, shade: [{ pts: [[260, 290], [360, 290], [360, h], [270, h]], color: '#DCD3C6' }] });
  p.rect(30, 286, 316, 26, { fill: '#D8463A', width: 4, r: 4 });
  p.rect(30, 280, 316, 8, { fill: '#F4EFE6', stroke: null, r: 2 });
  p.rect(70, 360, 150, 120, { fill: WALL_LIGHT, width: 4, r: 4 });
  for (const x of [120, 170]) p.line([[x, 362], [x, 478]], { width: 3, raw: true });
  p.rect(64, 476, 162, 10, { fill: '#C9C2B8', width: 3, r: 2 });
  // Shelves of oil cans through the window.
  for (let k = 0; k < 5; k++) p.rect(82 + k * 26, 432, 16, 22, { fill: ['#2F7F6A', '#D8463A', '#FFB23F'][k % 3], width: 2, r: 2 });
  p.rect(244, 360, 76, h - 360, { fill: '#9EB7C8', width: 4, r: 3 });
  for (let y = 376; y < h - 10; y += 22) p.line([[248, y], [316, y]], { width: 2, color: '#6E8796', raw: true });
  // The flat canopy on a single slanted column, with a light strip underneath.
  p.shape([[380, 228], [880, 210], [886, 244], [384, 262]], { fill: '#F4EFE6', width: 5, raw: true });
  p.shape([[382, 244], [884, 226], [886, 244], [384, 262]], { fill: '#D8463A', stroke: null, raw: true });
  p.shape([[600, 254], [624, 254], [596, h], [572, h]], { fill: '#C9C2B8', width: 4, raw: true });
  for (const lx of [460, 560, 700, 800]) p.rect(lx - 30, 254 - (lx - 380) * 0.036, 60, 7, { fill: '#FFF6D8', width: 2, r: 3 });
  // Two round-shouldered vintage pumps with glass globes.
  for (const px of [470, 690]) {
    p.rect(px - 32, 410, 64, h - 410 - 12, { fill: '#D8463A', width: 4, r: 18 });
    p.rect(px - 22, 430, 44, 36, { fill: '#F4EFE6', width: 3, r: 6 });
    p.line([[px - 12, 446], [px + 12, 446]], { width: 2, raw: true });
    p.ellipse(px, 394, 22, 22, { fill: '#FFF4DE', width: 4 });
    p.rect(px - 22, 388, 44, 10, { fill: '#D8463A', stroke: null, r: 2 });
    p.line([[px + 32, 470], [px + 52, 500], [px + 40, 540]], { width: 5 });
    p.rect(px - 40, h - 14, 80, 14, { fill: '#9A96A8', width: 3, r: 3 });
  }
  // The arrow pylon: a tall slanted blade with a round sign, and a chain of bulbs down its edge.
  p.shape([[748, h], [770, 140], [800, 140], [790, h]], { fill: '#F4EFE6', width: 5, raw: true });
  p.shape([[690, 60], [840, 50], [850, 130], [700, 136]], { fill: '#D8463A', width: 6, raw: true });
  p.shape([[700, 70], [832, 60], [840, 122], [708, 128]], { fill: '#8E1E24', stroke: null, raw: true });
  p.shape([[770, 180], [860, 214], [790, 250]], { fill: '#FFB23F', width: 4, raw: true });
  // Tyres stacked, a soda machine, an air post and flowers by the door.
  for (let k = 0; k < 3; k++) p.ellipse(350, h - 16 - k * 22, 30, 12, { fill: '#2A2633', width: 3 });
  p.rect(150, h - 92, 56, 92, { fill: '#C8302C', width: 4, r: 8 });
  p.rect(160, h - 80, 36, 30, { fill: '#FFF4DE', width: 2.5, r: 4 });
  p.rect(856, h - 120, 14, 120, { fill: '#9A96A8', width: 3, r: 3 });
  for (let k = 0; k < 6; k++) p.dot(60 + k * 14, h - 16, 7, [C.terracotta, C.mustard, C.pink][k % 3]);
  return { key: CORNER.key, svg: p.svg(CORNER.w, h), w: CORNER.w, h };
}
/** The bulbs down the arrow pylon, lit one after another. */
export const CORNER_BULBS: [number, number][] = Array.from({ length: 10 }, (_, i) => [774 - i * 0.6 + 10, 160 + i * 36]);

// ---------------------------------------------------------------- 1. Maple Mill Fuel & Pie

export const MILL: StopLook = {
  key: 'stopart_1',
  w: 960,
  h: 600,
  sign: { x: 330, y: 300, w: 300, size: 30, color: '#FFF0D6', stroke: '#5A3426' },
  glows: [
    [250, 450, 260, 120, 0xffc860],
    [120, 220, 80, 70, 0xffd27a],
  ],
  bay: 680,
};
/** Where the mill wheel turns, and the millrace that pours onto it. */
export const MILL_WHEEL = { x: 680, y: 440, r: 130 };
function millArt(): Art {
  const p = pen(MILL.key);
  const { h } = MILL;
  // The mill: a tall stone body under a steep shingled roof scattered with leaves.
  p.rect(40, 230, 480, h - 230, { fill: '#B8A798', width: 5, r: 6, shade: [{ pts: [[400, 220], [540, 220], [540, h], [420, h]], color: '#9E8E82' }] });
  for (let row = 0; row < 9; row++) {
    for (let sx = 50 + (row % 2) * 26; sx < 500; sx += 56) p.rect(sx, 250 + row * 38, 46, 30, { stroke: '#8A7A70', width: 2.4, r: 8, opacity: 0.7 });
  }
  p.shape([[20, 240], [280, 60], [540, 240]], { fill: '#8E4A3A', width: 6, raw: true, shade: [{ pts: [[280, 50], [560, 50], [560, 250], [280, 250]], color: '#743A2E' }] });
  for (let r = 0; r < 6; r++) {
    const y = 110 + r * 24;
    const half = ((y - 60) / 180) * 260 - 12;
    for (let x = 280 - half; x < 280 + half; x += 22) p.line([[x, y], [x + 11, y + 9], [x + 22, y]], { width: 2.4, color: '#5E2E26' });
  }
  for (const [lx, ly] of [[120, 214], [200, 150], [340, 120], [420, 196], [260, 200]] as const) p.ellipse(lx, ly, 10, 6, { fill: ['#E8743E', '#F2C45A', '#D8463A'][lx % 3], stroke: null });
  // A round attic window, and the chimney.
  p.ellipse(280, 160, 26, 26, { fill: WALL_LIGHT, width: 4 });
  p.line([[254, 160], [306, 160]], { width: 3, raw: true });
  p.rect(400, 80, 40, 90, { fill: '#9E8E82', width: 4, r: 3 });
  // The pie shop front: a striped awning, a window full of pies, a door, a chalkboard.
  for (let k = 0; k < 9; k++) p.shape([[110 + k * 40, 340], [150 + k * 40, 340], [146 + k * 40, 384], [114 + k * 40, 384]], { fill: k % 2 ? '#C8302C' : '#F4EADC', width: 3, raw: true });
  p.rect(100, 330, 370, 14, { fill: '#5A3426', width: 3, r: 3 });
  p.rect(130, 400, 220, 120, { fill: WALL_LIGHT, width: 4, r: 4 });
  for (let k = 0; k < 4; k++) {
    p.ellipse(160 + k * 52, 490, 22, 8, { fill: '#D9923A', width: 2.5 });
    p.ellipse(160 + k * 52, 486, 18, 5, { fill: '#B8642A', stroke: null });
  }
  p.rect(370, 400, 80, h - 400, { fill: '#6A3E2E', width: 4, r: 4 });
  p.dot(436, 500, 5, '#FFD27A');
  p.rect(60, h - 110, 56, 80, { fill: '#2E3A34', width: 4, r: 3 });
  p.line([[66, h - 30], [60, h]], { width: 4 });
  p.line([[110, h - 30], [116, h]], { width: 4 });
  // The millrace: a wooden chute on posts carrying water to the top of the wheel.
  p.rect(520, 270, 220, 26, { fill: '#7A5034', width: 4, r: 3 });
  p.rect(700, 296, 14, h - 296, { fill: '#6A4430', width: 3, r: 2 });
  // The wheel's axle housing on the wall.
  p.ellipse(MILL_WHEEL.x, MILL_WHEEL.y, 22, 22, { fill: '#5A3426', width: 4 });
  // An old pump, pumpkins and a hay bale.
  p.rect(800, 420, 60, h - 420, { fill: '#2F7F6A', width: 4, r: 14 });
  p.ellipse(830, 404, 24, 24, { fill: '#FFF0D6', width: 4 });
  p.rect(812, 440, 36, 30, { fill: '#F4EADC', width: 3, r: 5 });
  p.line([[860, 470], [884, 510], [870, 560]], { width: 5 });
  for (const [x, r] of [[600, 26], [640, 18], [904, 22]] as const) {
    p.ellipse(x, h - r, r * 1.2, r, { fill: '#E8743E', width: 3.5 });
    p.line([[x, h - r * 2], [x + 4, h - r * 2 - 10]], { width: 4, color: '#3E5A2E' });
  }
  p.rect(480, h - 50, 90, 50, { fill: '#E2B85A', width: 4, r: 8 });
  return { key: MILL.key, svg: p.svg(MILL.w, h), w: MILL.w, h };
}
/** The mill wheel: spokes, paddles and rims, drawn separately so it can turn. */
function millWheelArt(): Art {
  const p = pen('mill_wheel');
  const r = MILL_WHEEL.r;
  const c = r + 14;
  p.ellipse(c, c, r, r, { stroke: '#5A3426', width: 14, wobble: 0.3 });
  p.ellipse(c, c, r - 24, r - 24, { stroke: '#7A5034', width: 8, wobble: 0.3 });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    p.line([[c, c], [c + Math.cos(a) * (r - 6), c + Math.sin(a) * (r - 6)]], { width: 7, color: '#6A4430' });
    const px = c + Math.cos(a) * r;
    const py = c + Math.sin(a) * r;
    p.shape([[px - Math.sin(a) * 22, py + Math.cos(a) * 22], [px + Math.sin(a) * 22, py - Math.cos(a) * 22], [px + Math.sin(a) * 22 + Math.cos(a) * 16, py - Math.cos(a) * 22 + Math.sin(a) * 16], [px - Math.sin(a) * 22 + Math.cos(a) * 16, py + Math.cos(a) * 22 + Math.sin(a) * 16]], { fill: '#8E5C3A', width: 3, raw: true });
  }
  p.ellipse(c, c, 20, 20, { fill: '#3E2A22', width: 4 });
  return { key: 'mill_wheel', svg: p.svg(c * 2, c * 2), w: c * 2, h: c * 2 };
}

// ---------------------------------------------------------------- 2. Summit Lodge

export const LODGE: StopLook = {
  key: 'stopart_2',
  w: 940,
  h: 620,
  sign: { x: 300, y: 512, w: 240, size: 30, color: '#FFE9C4', stroke: '#3A2418' },
  glows: [
    [300, 330, 300, 260, 0xffb040],
    [700, 470, 160, 90, 0xffc860],
  ],
  bay: 690,
};
function lodgeArt(): Art {
  const p = pen(LODGE.key);
  const { h } = LODGE;
  // The A-frame: a log wall, a huge triangular window glowing gold, the steep roof under deep snow.
  p.rect(70, 380, 460, h - 380, { fill: '#7A4E36', width: 5, r: 4 });
  for (let y = 396; y < h; y += 22) p.line([[74, y], [526, y]], { width: 3, color: '#5E3A28', raw: true });
  p.shape([[300, 150], [470, 470], [130, 470]], { fill: '#FFC860', width: 5, raw: true, shade: [{ pts: [[300, 330], [470, 470], [130, 470]], color: '#FFA840' }] });
  for (const [a, b] of [[[300, 150], [300, 470]], [[215, 310], [385, 310]], [[172, 390], [428, 390]]] as const) p.line([a as [number, number], b as [number, number]], { width: 5, raw: true, color: '#3A2418' });
  // Silhouettes inside: a person by the fire, a lamp.
  p.ellipse(250, 420, 14, 14, { fill: '#8E4E2A', stroke: null });
  p.rect(236, 434, 28, 36, { fill: '#8E4E2A', stroke: null, r: 6 });
  p.shape([[40, 520], [300, 40], [560, 520], [520, 520], [300, 110], [80, 520]], { fill: '#5A3626', width: 5, raw: true });
  // Snow piled on the roof, bulging over the edges, with icicles.
  p.shape([[22, 528], [300, 24], [578, 528], [552, 540], [300, 76], [48, 540]], { fill: '#F4F8FF', width: 4, raw: true, shade: [{ pts: [[300, 60], [600, 60], [600, 560], [300, 560]], color: '#D6E2F2' }] });
  for (let k = 0; k < 9; k++) {
    const x = 60 + k * 26;
    const y = 540 - k * 46;
    p.shape([[x, y], [x + 6, y], [x + 3, y + 18 + (k % 3) * 8]], { fill: '#E6F2FF', width: 2, raw: true });
    const x2 = 540 - k * 26;
    p.shape([[x2, y], [x2 + 6, y], [x2 + 3, y + 14 + (k % 2) * 10]], { fill: '#E6F2FF', width: 2, raw: true });
  }
  // A stone chimney poking through the snow.
  p.rect(400, 120, 50, 140, { fill: '#8A8A98', width: 4, r: 3 });
  p.rect(394, 108, 62, 22, { fill: '#F4F8FF', width: 3, r: 8 });
  // The porch and its sign board, firewood, skis, a snowman and a snow-capped pump.
  p.rect(170, 490, 260, 44, { fill: '#5A3626', width: 4, r: 6 });
  for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) p.ellipse(580 + k * 26, h - 16 - j * 24, 13, 12, { fill: '#9A6A4A', width: 3 });
  for (const [x, c] of [[668, '#D8463A'], [686, '#3E6EA6']] as const) p.shape([[x, h], [x - 10, h - 170], [x - 2, h - 172], [x + 8, h]], { fill: c, width: 3, raw: true });
  p.ellipse(760, h - 50, 50, 46, { fill: '#F4F8FF', width: 4 });
  p.ellipse(760, h - 128, 36, 34, { fill: '#F4F8FF', width: 4 });
  p.ellipse(760, h - 184, 26, 25, { fill: '#F4F8FF', width: 4 });
  p.dot(752, h - 190, 3, INK);
  p.dot(768, h - 190, 3, INK);
  p.shape([[760, h - 182], [784, h - 178], [760, h - 176]], { fill: C.mustard, width: 2, raw: true });
  p.line([[740, h - 160], [784, h - 160]], { width: 10, color: '#D8463A' });
  p.rect(830, 470, 56, h - 470, { fill: '#3E6EA6', width: 4, r: 12 });
  p.rect(824, 460, 68, 18, { fill: '#F4F8FF', width: 3, r: 8 });
  p.rect(842, 492, 32, 28, { fill: '#E6F2FF', width: 3, r: 4 });
  return { key: LODGE.key, svg: p.svg(LODGE.w, h), w: LODGE.w, h };
}
/** The string lights along the eaves, as points that twinkle. */
export const LODGE_LIGHTS: [number, number][] = Array.from({ length: 18 }, (_, i) => {
  const t = i / 17;
  const left = t < 0.5;
  const u = left ? t * 2 : (t - 0.5) * 2;
  return left ? [60 + u * 230, 524 - u * 440 + Math.sin(u * 20) * 6] : [310 + u * 230, 84 + u * 440 + Math.sin(u * 20) * 6];
});

// ---------------------------------------------------------------- 3. Starlite Diner

export const DINER: StopLook = {
  key: 'stopart_3',
  w: 1000,
  h: 520,
  sign: { x: 330, y: 92, w: 340, size: 52, color: '#FF6AA0', stroke: '#FFE6F0' },
  glows: [
    [330, 330, 560, 120, 0xffc8a0],
    [330, 92, 420, 110, 0xff4f8b],
    [800, 380, 160, 80, 0x5cf2ff],
  ],
  bay: 760,
};
function dinerArt(): Art {
  const p = pen(DINER.key);
  const { h } = DINER;
  // The diner car: a long box with rounded ends, chrome bands, a pink stripe, and a band of lit windows.
  p.rect(40, 210, 600, 270, { fill: '#C9CED8', width: 6, r: 60, shade: [{ pts: [[0, 400], [700, 400], [700, 500], [0, 500]], color: '#A4AAB8' }] });
  for (let y = 230; y < 470; y += 16) p.line([[90, y], [590, y]], { width: 2, color: '#E8ECF2', raw: true, opacity: 0.7 });
  p.rect(40, 384, 600, 26, { fill: '#FF5C8A', width: 4, r: 4 });
  p.rect(70, 270, 540, 100, { fill: '#FFE2B8', width: 5, r: 10 });
  for (let x = 130; x < 610; x += 60) p.line([[x, 272], [x, 368]], { width: 4, raw: true, color: '#8A92A6' });
  // Inside: a counter, stools, pie cases and two diners.
  p.rect(90, 336, 500, 12, { fill: '#C83A5A', stroke: null, r: 3 });
  for (let x = 110; x < 590; x += 44) p.ellipse(x, 360, 12, 6, { fill: '#D8463A', stroke: null });
  for (const x of [220, 420]) {
    p.ellipse(x, 300, 14, 14, { fill: '#5A3E4E', stroke: null });
    p.rect(x - 14, 312, 28, 26, { fill: '#5A3E4E', stroke: null, r: 6 });
  }
  // The door with a porthole, steps, and a roof cornice.
  p.rect(560, 290, 60, 160, { fill: '#9AA2B6', width: 4, r: 6 });
  p.ellipse(590, 330, 18, 18, { fill: '#FFE2B8', width: 3 });
  p.rect(546, 450, 90, 30, { fill: '#7A8094', width: 3, r: 3 });
  p.rect(30, 196, 620, 22, { fill: '#E8ECF2', width: 4, r: 10 });
  // The rooftop sign frame (the neon words are lit in the game) with a star on top.
  p.rect(130, 40, 400, 100, { fill: '#1A1630', width: 5, r: 14 });
  p.line([[200, 140], [200, 198]], { width: 6 });
  p.line([[460, 140], [460, 198]], { width: 6 });
  const star = (cx: number, cy: number, r: number) => {
    const pts: [number, number][] = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
      const rr = k % 2 ? r * 0.45 : r;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    p.shape(pts, { fill: '#FFE07A', width: 4, raw: true });
  };
  star(560, 40, 30);
  // A little canopy over one pump, an OPEN sign, and a parked retro car.
  p.rect(700, 250, 260, 20, { fill: '#2A2E50', width: 4, r: 4 });
  p.rect(820, 270, 12, h - 270, { fill: '#9AA2B6', width: 3, r: 3 });
  p.rect(760, 380, 50, h - 380, { fill: '#FF5C8A', width: 4, r: 12 });
  p.rect(768, 396, 34, 24, { fill: '#1A1630', width: 2.5, r: 4 });
  p.rect(700, 300, 120, 44, { fill: '#1A1630', width: 4, r: 8 });
  p.shape([[860, h - 10], [866, h - 60], [900, h - 86], [960, h - 86], [984, h - 60], [992, h - 10]], { fill: '#5CC8C0', width: 4, raw: true });
  p.rect(894, h - 80, 64, 24, { fill: '#2A3A5A', width: 3, r: 6 });
  for (const wx of [884, 970]) p.ellipse(wx, h - 10, 14, 14, { fill: '#1E1C2A', width: 3 });
  return { key: DINER.key, svg: p.svg(DINER.w, h), w: DINER.w, h };
}

export const STOP_LOOKS = [CORNER, MILL, LODGE, DINER];
/**
 * The water pouring off the mill's chute: clear blue at its edges, white where it is thickest, with streaks
 * of uneven length. It tiles top to bottom, so it can flow.
 */
function millWaterArt(): Art {
  const key = 'mill_water';
  const w = 46;
  const h = 256;
  const p = pen(key);
  p.plain = true;
  for (let x = 0; x < w; x += 2) {
    const edge = Math.abs(x / w - 0.5) * 2;
    p.rect(x, 0, 2, h, { fill: edge > 0.8 ? '#8CC8D8' : edge > 0.5 ? '#C6EAF2' : '#EEFAFF', stroke: null, r: 0 });
  }
  let seed = 7;
  const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 30; i++) {
    const x = 3 + r() * (w - 6);
    const y = r() * h;
    const len = 30 + r() * 50;
    const c = r() < 0.3 ? '#7EB8CC' : '#FFFFFF';
    p.line([[x, y], [x, y + len]], { width: 1.5 + r() * 2.5, color: c, raw: true, opacity: 0.85, wobble: 0 });
    if (y + len > h) p.line([[x, y - h], [x, y + len - h]], { width: 2, color: c, raw: true, opacity: 0.85, wobble: 0 });
  }
  return { key, svg: p.svg(w, h), w, h };
}

export function stopBuildingArts(): Art[] {
  return [cornerArt(), millArt(), millWheelArt(), millWaterArt(), lodgeArt(), dinerArt()];
}

/**
 * Places a stop with its building standing on the ground at x, writes its name, lights its windows
 * and sets its moving part going. Returns a function to call every frame.
 */
export function placeStop(scene: Phaser.Scene, index: number, x: number, ground: number, name: string, light: (img: Phaser.GameObjects.Image, colour: number) => void) {
  const look = STOP_LOOKS[index];
  const top = ground - look.h;
  scene.add.image(x, ground, look.key).setOrigin(0, 1).setDepth(-10);
  // Each stop's lettering leans on what that kind of sign actually looks like: bold spaced-out caps
  // on the gas station's metal pylon, a plain hand-lettered board at the mill, carved-looking serif at
  // the lodge, and a leaning neon script at the diner - the same word would not suit all four alike.
  const lettering: Record<number, { fontStyle?: string; letterSpacing?: number }> = {
    0: { fontStyle: 'bold', letterSpacing: 1.5 },
    3: { fontStyle: 'italic', letterSpacing: 1 },
  };
  const label = scene.add
    .text(x + look.sign.x, top + look.sign.y, name.toUpperCase(), { fontFamily: '"Fraunces", serif', fontSize: `${look.sign.size}px`, color: look.sign.color, stroke: look.sign.stroke, strokeThickness: 6, align: 'center', ...lettering[index] })
    .setOrigin(0.5)
    .setDepth(-9.8)
    .setRotation(look.sign.rot ?? 0);
  // A safety margin under the configured width: the stroke bleeds past the glyph box, and a couple of
  // these plates are tapered rather than square, so fitting to the raw width alone can still overflow.
  label.setScale(Math.min(1, (look.sign.w * 0.84) / label.width));
  // Neon (the diner) glows: a soft halo of its own colour round every letter.
  if (index === 3) label.setShadow(0, 0, look.sign.color, 24, true, true);
  for (const [gx, gy, gw, gh, colour] of look.glows) {
    scene.add.image(x + gx, top + gy, 'halo').setDepth(-9.7).setDisplaySize(gw * 1.6, gh * 1.8).setTint(colour).setAlpha(0.42).setBlendMode(Phaser.BlendModes.ADD);
  }
  const t0 = Math.random() * 1000;
  if (index === 0) {
    // Corner Fuel: the bulbs on the arrow pylon light up one after another.
    const bulbs = CORNER_BULBS.map(([bx, by]) => scene.add.image(x + bx, top + by, 'halo').setDepth(-9.6).setDisplaySize(30, 30).setTint(0xffe08a).setBlendMode(Phaser.BlendModes.ADD));
    return (time: number) => bulbs.forEach((b, i) => b.setAlpha((Math.floor((time + t0) / 110) - i) % 5 === 0 ? 1 : 0.35));
  }
  if (index === 1) {
    // Maple Mill: the wheel turns, water pours from the chute onto it, and spray rises.
    const wheel = scene.add.image(x + MILL_WHEEL.x, top + MILL_WHEEL.y, 'mill_wheel').setDepth(-9.9);
    const water = scene.add.tileSprite(x + 740, top + 296, 46, MILL.h - 296 - 20, 'mill_water').setOrigin(0, 0).setDepth(-9.95).setAlpha(0.95);
    scene.add.particles(x + 763, ground - 20, 'halo', { lifespan: 1400, speedX: { min: -40, max: 40 }, speedY: { min: -50, max: -10 }, scale: { start: 0.12, end: 0.4 }, alpha: { start: 0.5, end: 0 }, tint: 0xffffff, frequency: 70 }).setDepth(-9.5);
    smoke(scene, x + 420, top + 80);
    return (_time: number, delta: number) => {
      wheel.rotation += delta * 0.0011;
      water.tilePositionY -= delta * 0.4;
    };
  }
  if (index === 2) {
    // Summit Lodge: string lights twinkle along the eaves, the fire flickers, smoke rises.
    const lights = LODGE_LIGHTS.map(([lx, ly], i) => scene.add.image(x + lx, top + ly, 'halo').setDepth(-9.6).setDisplaySize(22, 22).setTint([0xffd27a, 0xff8a5a, 0x9fe8ff, 0xc8ff8a][i % 4]).setBlendMode(Phaser.BlendModes.ADD));
    const fire = scene.add.image(x + 300, top + 420, 'halo').setDepth(-9.6).setDisplaySize(240, 160).setTint(0xff9a40).setBlendMode(Phaser.BlendModes.ADD);
    smoke(scene, x + 425, top + 100);
    return (time: number) => {
      lights.forEach((l, i) => l.setAlpha(0.55 + Math.abs(Math.sin((time + t0) / 500 + i * 1.3)) * 0.45));
      fire.setAlpha(0.35 + Math.random() * 0.15);
    };
  }
  // Starlite Diner: the rooftop neon buzzes, the star sparkles, OPEN blinks.
  const star = scene.add.image(x + 560, top + 40, 'halo').setDepth(-9.6).setDisplaySize(120, 120).setTint(0xffe07a).setBlendMode(Phaser.BlendModes.ADD);
  const open = scene.add.text(x + 760, top + 322, 'OPEN 24/7', { fontFamily: '"Karla", sans-serif', fontSize: '24px', color: '#5CF2FF' }).setOrigin(0.5).setDepth(-9.6).setShadow(0, 0, '#5CF2FF', 12, true, true);
  const reflections = [label, open].map(() => 0);
  void reflections;
  return (time: number) => {
    const off = Math.random() < 0.015;
    label.setAlpha(off ? 0.3 : 1);
    star.setAlpha(0.6 + Math.sin((time + t0) / 300) * 0.3);
    open.setAlpha(Math.floor((time + t0) / 700) % 4 === 0 ? 0.25 : 1);
  };
}

/** A soft column of smoke rising from a chimney. */
function smoke(scene: Phaser.Scene, x: number, y: number) {
  scene.add.particles(x, y, 'puff', { lifespan: 4200, speedX: { min: 6, max: 20 }, speedY: { min: -40, max: -24 }, scale: { start: 0.35, end: 1.3 }, alpha: { start: 0.5, end: 0 }, tint: 0xe6e2ea, frequency: 420 }).setDepth(-11);
}

/** For colouring a look without redrawing it (not used yet). */
export const tone = (c: string, k: number) => mix(c, '#000000', k);
