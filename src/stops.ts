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
const BONE = '#F3E3CC';
const SAND = '#D9C3A6';
const TAN = '#B89A7A';
const RED = '#E3263A';
const RED_DARK = '#9E1A2E';
const EMBER = '#FF6A30';
const GOLD = '#FFB23F';
const GOLD_DARK = '#D98A2A';
const OX = '#3A0F22';
const PLUM = '#5A1A3A';
const WOOD = '#6A2E2E';
const PINE = '#2A4636';
const LIT = '#FFC86B';
const LIT_DEEP = '#FF9E4A';

/** A sunburst of alternating rays behind a sign, the poster's signature flourish. */
function burst(p: ReturnType<typeof pen>, cx: number, cy: number, r: number, n: number, a: string, b: string) {
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2;
    const a1 = ((k + 1) / n) * Math.PI * 2;
    p.shape([[cx, cy], [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r], [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r]], { fill: k % 2 ? a : b, raw: true, stroke: null });
  }
}
/** A five-point star. */
function star(p: ReturnType<typeof pen>, cx: number, cy: number, r: number, fill: string, width = 4) {
  const pts: [number, number][] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
    const rr = k % 2 ? r * 0.45 : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  p.shape(pts, { fill, width, raw: true, stroke: INK });
}

// ---------------------------------------------------------------- 0. Corner Fuel

export const CORNER: StopLook = {
  key: 'stopart_0',
  w: 900,
  h: 560,
  sign: { x: 770, y: 92, w: 140, size: 26, color: BONE, stroke: INK, rot: -0.03 },
  glows: [
    [150, 420, 220, 120, 0xffc86b],
    [630, 262, 460, 40, 0xfff0d0],
  ],
  bay: 560,
};
function cornerArt(): Art {
  const p = pen(CORNER.key);
  const { h } = CORNER;
  // The station house: bone walls on an oxblood plinth, a stepped parapet with a red band and a star.
  p.rect(30, 300, 330, h - 300, { fill: BONE, width: 5, r: 3, shade: [{ pts: [[270, 290], [370, 290], [370, h], [280, h]], color: SAND }] });
  p.rect(30, h - 44, 330, 44, { fill: OX, width: 4, r: 1 });
  for (let x = 44; x < 350; x += 40) p.line([[x, h - 40], [x, h - 6]], { width: 2, color: PLUM, raw: true });
  p.shape([[22, 304], [22, 250], [120, 250], [120, 226], [270, 226], [270, 250], [368, 250], [368, 304]], { fill: RED, width: 5, raw: true, shade: [{ pts: [[22, 286], [368, 286], [368, 306], [22, 306]], color: RED_DARK }] });
  p.rect(22, 296, 346, 12, { fill: INK, r: 1, stroke: null });
  for (let x = 40; x < 360; x += 28) p.rect(x, 258, 14, 14, { fill: GOLD, r: 7, width: 2.5, stroke: INK });
  burst(p, 195, 226, 46, 16, GOLD, EMBER);
  star(p, 195, 222, 30, BONE, 4);
  // The shop window: lit gold, oil cans on shelves, a striped awning over it.
  p.rect(48, 362, 200, 124, { fill: LIT, width: 5, r: 3, shade: [{ pts: [[48, 440], [250, 420], [250, 490], [48, 490]], color: LIT_DEEP }] });
  for (const x of [114, 180]) p.line([[x, 364], [x, 484]], { width: 4, raw: true });
  p.rect(56, 448, 184, 6, { fill: OX, r: 1, stroke: null });
  for (let k = 0; k < 6; k++) p.rect(62 + k * 30, 424, 18, 24, { fill: [RED, PINE, GOLD][k % 3], width: 2.5, r: 2, stroke: INK });
  p.line([[56, 370], [86, 370], [56, 400]], { width: 3, color: '#FFFFFF', raw: true, opacity: 0.6 });
  for (let k = 0; k < 7; k++) p.shape([[40 + k * 31, 326], [71 + k * 31, 326], [67 + k * 31, 356], [44 + k * 31, 356]], { fill: k % 2 ? BONE : RED, raw: true, width: 3, stroke: INK });
  for (let k = 0; k < 7; k++) p.ellipse(55 + k * 31, 358, 15, 6, { fill: k % 2 ? BONE : RED, width: 2.5, stroke: INK });
  // The garage door: a red roller door with ink ribs and a gold handle, OPEN in its window strip.
  p.rect(266, 340, 82, h - 384, { fill: RED, width: 4.5, r: 2, shade: [{ pts: [[316, 330], [350, 330], [350, h], [318, h]], color: RED_DARK }] });
  for (let y = 360; y < h - 50; y += 18) p.line([[268, y], [346, y]], { width: 2.5, color: INK, raw: true });
  p.rect(276, 372, 62, 16, { fill: LIT, width: 2.5, r: 1, stroke: INK });
  p.rect(296, h - 64, 22, 8, { fill: GOLD, width: 2, r: 2, stroke: INK });
  // The canopy: a heavy red fascia with a bone chevron trim, on two slanted ink columns, downlights under it.
  for (const cx of [470, 780]) p.shape([[cx - 10, 260], [cx + 14, 260], [cx + 2, h], [cx - 22, h]], { fill: INK, raw: true, width: 4, stroke: INK });
  p.shape([[380, 196], [890, 180], [890, 244], [380, 260]], { fill: RED, raw: true, width: 6, stroke: INK, shade: [{ pts: [[380, 236], [890, 220], [890, 246], [380, 262]], color: RED_DARK }] });
  p.shape([[380, 196], [890, 180], [890, 194], [380, 210]], { fill: BONE, raw: true, width: 3, stroke: INK });
  for (let x = 392, i = 0; x < 880; x += 26, i++) {
    const y = 212 - (x - 380) * 0.0314;
    p.shape([[x, y + 10], [x + 13, y + 10], [x + 22, y + 26], [x + 9, y + 26]], { fill: i % 2 ? GOLD : BONE, raw: true, stroke: null });
  }
  for (const lx of [440, 540, 660, 760, 850]) p.rect(lx - 30, 254 - (lx - 380) * 0.0314, 60, 9, { fill: GOLD, width: 2.5, r: 3, stroke: INK });
  // Two round-shouldered pumps: red bodies, bone faces, gold globes, ink hoses, on a sand island.
  p.rect(400, h - 18, 360, 18, { fill: SAND, width: 4, r: 2, stroke: INK });
  for (let x = 404, i = 0; x < 756; x += 24, i++) p.shape([[x, h - 16], [x + 12, h - 16], [x + 20, h - 3], [x + 8, h - 3]], { fill: i % 2 ? INK : EMBER, raw: true, stroke: null });
  for (const px of [530, 680]) {
    p.rect(px - 34, 400, 68, h - 418, { fill: RED, width: 5, r: 20, stroke: INK, shade: [{ pts: [[px + 10, 390], [px + 40, 390], [px + 40, h], [px + 12, h]], color: RED_DARK }] });
    p.rect(px - 24, 424, 48, 40, { fill: BONE, width: 3.5, r: 6, stroke: INK });
    p.line([[px - 14, 440], [px + 14, 440]], { width: 2.5, raw: true });
    p.line([[px - 14, 452], [px + 6, 452]], { width: 2.5, raw: true });
    p.rect(px - 20, 478, 40, 8, { fill: GOLD, width: 2, r: 2, stroke: INK });
    p.ellipse(px, 384, 24, 24, { fill: GOLD, width: 4.5, stroke: INK });
    p.ellipse(px - 7, 377, 7, 5, { fill: '#FFFFFF', stroke: null, opacity: 0.8 });
    p.rect(px - 24, 380, 48, 10, { fill: INK, stroke: null, r: 2 });
    p.line([[px + 34, 470], [px + 54, 500], [px + 44, h - 24]], { width: 6 });
  }
  // The pylon: an ink blade, a red sign board in a gold sunburst, and an ember arrow pointing in.
  burst(p, 770, 92, 88, 20, GOLD, EMBER);
  p.ellipse(770, 92, 88, 88, { stroke: INK, width: 5 });
  p.shape([[748, h], [768, 140], [802, 140], [792, h]], { fill: INK, width: 4, raw: true, stroke: INK });
  p.shape([[690, 54], [850, 44], [858, 136], [698, 142]], { fill: RED, width: 6, raw: true, stroke: INK });
  p.shape([[700, 64], [842, 54], [848, 126], [708, 132]], { fill: OX, stroke: null, raw: true });
  p.shape([[690, 54], [850, 44], [852, 60], [692, 70]], { fill: BONE, stroke: null, raw: true });
  p.shape([[800, 178], [880, 214], [800, 250], [812, 214]], { fill: EMBER, width: 4.5, raw: true, stroke: INK });
  // Tyres, a soda machine, an air post and potted flowers.
  for (let k = 0; k < 3; k++) {
    p.ellipse(380, h - 16 - k * 22, 28, 12, { fill: INK, width: 3, stroke: INK });
    p.ellipse(380, h - 16 - k * 22, 12, 5, { fill: OX, stroke: null });
  }
  p.rect(864, h - 130, 16, 130, { fill: BONE, width: 3.5, r: 3, stroke: INK });
  p.ellipse(872, h - 138, 14, 14, { fill: EMBER, width: 3, stroke: INK });
  return { key: CORNER.key, svg: p.svg(CORNER.w, h), w: CORNER.w, h };
}
/** The bulbs down the arrow pylon, lit one after another. */
export const CORNER_BULBS: [number, number][] = Array.from({ length: 10 }, (_, i) => [784 - i * 0.6, 160 + i * 36]);

// ---------------------------------------------------------------- 1. Maple Mill Fuel & Pie

export const MILL: StopLook = {
  key: 'stopart_1',
  w: 960,
  h: 600,
  sign: { x: 290, y: 300, w: 300, size: 30, color: BONE, stroke: INK },
  glows: [
    [220, 460, 260, 120, 0xffc86b],
    [280, 160, 70, 70, 0xffc86b],
  ],
  bay: 680,
};
/** Where the mill wheel turns, and the millrace that pours onto it. */
export const MILL_WHEEL = { x: 680, y: 440, r: 130 };
function millArt(): Art {
  const p = pen(MILL.key);
  const { h } = MILL;
  // The mill: a tall stone body, its stones drawn as rounded blocks in sand and tan, quoins at the corners.
  p.rect(40, 230, 500, h - 230, { fill: SAND, width: 5, r: 4, stroke: INK, shade: [{ pts: [[420, 220], [560, 220], [560, h], [440, h]], color: TAN }] });
  for (let row = 0; row < 9; row++) {
    for (let sx = 52 + (row % 2) * 26; sx < 520; sx += 56) p.rect(sx, 250 + row * 38, 46, 30, { stroke: TAN, width: 2.4, r: 8, opacity: 0.8 });
  }
  for (let y = 240; y < h - 20; y += 52) for (const x of [40, 512]) p.rect(x, y, 28, 26, { fill: BONE, width: 3, r: 2, stroke: INK });
  // The roof: steep plum shingles under an oxblood ridge, scattered with ember and gold leaves.
  p.shape([[14, 244], [290, 52], [566, 244]], { fill: PLUM, width: 6, raw: true, stroke: INK, shade: [{ pts: [[290, 40], [580, 40], [580, 250], [290, 250]], color: OX }] });
  for (let r = 0; r < 7; r++) {
    const y = 96 + r * 22;
    const half = ((y - 52) / 192) * 276 - 14;
    for (let x = 290 - half; x < 290 + half; x += 22) p.line([[x, y], [x + 11, y + 9], [x + 22, y]], { width: 2.4, color: OX });
  }
  p.shape([[8, 250], [290, 46], [572, 250], [560, 256], [290, 64], [20, 256]], { fill: OX, raw: true, width: 3.5, stroke: INK });
  for (const [lx, ly, c] of [[110, 222, EMBER], [190, 160, GOLD], [350, 120, RED], [430, 200, GOLD], [260, 206, EMBER], [480, 228, RED]] as const) {
    p.shape([[lx, ly - 9], [lx + 8, ly], [lx, ly + 9], [lx - 8, ly]], { fill: c, raw: true, width: 2, stroke: INK });
  }
  // A round attic window glowing, with a crossbar; and the stone chimney.
  p.ellipse(290, 160, 30, 30, { fill: LIT, width: 5, stroke: INK });
  p.line([[260, 160], [320, 160]], { width: 4, raw: true });
  p.line([[290, 130], [290, 190]], { width: 4, raw: true });
  p.rect(400, 76, 44, 100, { fill: TAN, width: 4.5, r: 2, stroke: INK });
  p.rect(394, 70, 56, 16, { fill: OX, width: 3.5, r: 2, stroke: INK });
  // The name board, ink with a gold rule, on two iron brackets.
  p.rect(130, 276, 320, 50, { fill: OX, width: 5, r: 4, stroke: INK });
  p.rect(140, 284, 300, 34, { stroke: GOLD, width: 2.5, r: 2 });
  // The pie shop: a red and bone awning with scalloped edge, a lit window of pies, a door, a chalkboard.
  for (let k = 0; k < 10; k++) p.shape([[70 + k * 38, 340], [108 + k * 38, 340], [104 + k * 38, 380], [74 + k * 38, 380]], { fill: k % 2 ? BONE : RED, width: 3, raw: true, stroke: INK });
  for (let k = 0; k < 10; k++) p.ellipse(89 + k * 38, 382, 19, 8, { fill: k % 2 ? BONE : RED, width: 2.5, stroke: INK });
  p.rect(60, 330, 400, 14, { fill: INK, width: 3, r: 3, stroke: INK });
  p.rect(90, 404, 240, 124, { fill: LIT, width: 5, r: 4, stroke: INK, shade: [{ pts: [[90, 470], [330, 450], [330, 530], [90, 530]], color: LIT_DEEP }] });
  p.line([[210, 406], [210, 526]], { width: 4, raw: true });
  p.rect(98, 498, 224, 8, { fill: OX, r: 1, stroke: null });
  for (let k = 0; k < 4; k++) {
    p.ellipse(126 + k * 56, 490, 22, 9, { fill: GOLD, width: 2.5, stroke: INK });
    p.ellipse(126 + k * 56, 486, 17, 5, { fill: GOLD_DARK, stroke: null });
    for (let j = -1; j <= 1; j++) p.line([[126 + k * 56 + j * 7, 482], [126 + k * 56 + j * 7 + 3, 490]], { width: 1.5, color: OX, raw: true });
  }
  p.line([[98, 412], [128, 412], [98, 442]], { width: 3, color: '#FFFFFF', raw: true, opacity: 0.6 });
  p.rect(360, 400, 86, h - 400, { fill: WOOD, width: 4.5, r: 4, stroke: INK, shade: [{ pts: [[410, 390], [450, 390], [450, h], [412, h]], color: OX }] });
  p.rect(372, 414, 62, 50, { fill: LIT, width: 3, r: 3, stroke: INK });
  p.dot(432, 508, 5, GOLD);
  p.rect(36, h - 106, 46, 76, { fill: PINE, width: 4, r: 2, stroke: INK });
  p.line([[46, h - 84], [72, h - 84]], { width: 2, color: BONE, raw: true });
  p.line([[46, h - 70], [66, h - 70]], { width: 2, color: BONE, raw: true });
  p.line([[42, h - 30], [36, h]], { width: 4 });
  p.line([[76, h - 30], [82, h]], { width: 4 });
  // The millrace: a timber chute on a post, carrying water to the top of the wheel.
  p.rect(530, 268, 222, 28, { fill: WOOD, width: 4.5, r: 2, stroke: INK });
  for (let x = 546; x < 750; x += 30) p.line([[x, 270], [x, 294]], { width: 2, color: OX, raw: true });
  p.rect(706, 296, 16, h - 296, { fill: WOOD, width: 3.5, r: 2, stroke: INK });
  p.ellipse(MILL_WHEEL.x, MILL_WHEEL.y, 24, 24, { fill: OX, width: 4.5, stroke: INK });
  // A green pump, pumpkins and a hay bale.
  p.rect(800, 420, 62, h - 420, { fill: PINE, width: 5, r: 16, stroke: INK });
  p.ellipse(831, 402, 24, 24, { fill: GOLD, width: 4.5, stroke: INK });
  p.rect(812, 440, 38, 32, { fill: BONE, width: 3, r: 5, stroke: INK });
  p.line([[862, 470], [886, 510], [872, 560]], { width: 5 });
  for (const [x, r] of [[596, 26], [636, 18], [910, 22]] as const) {
    p.ellipse(x, h - r, r * 1.25, r, { fill: EMBER, width: 3.5, stroke: INK });
    p.line([[x - r * 0.4, h - r * 1.8], [x - r * 0.4, h - 4]], { width: 2, color: '#C0602E', raw: true });
    p.line([[x + r * 0.4, h - r * 1.8], [x + r * 0.4, h - 4]], { width: 2, color: '#C0602E', raw: true });
    p.line([[x, h - r * 2], [x + 4, h - r * 2 - 10]], { width: 4, color: PINE });
  }
  p.rect(476, h - 52, 92, 52, { fill: GOLD, width: 4, r: 8, stroke: INK });
  for (let x = 488; x < 560; x += 14) p.line([[x, h - 46], [x + 4, h - 6]], { width: 2, color: GOLD_DARK, raw: true });
  return { key: MILL.key, svg: p.svg(MILL.w, h), w: MILL.w, h };
}
/** The mill wheel: spokes, paddles and rims, drawn separately so it can turn. */
function millWheelArt(): Art {
  const p = pen('mill_wheel');
  const r = MILL_WHEEL.r;
  const c = r + 14;
  p.ellipse(c, c, r, r, { stroke: INK, width: 18, wobble: 0.3 });
  p.ellipse(c, c, r, r, { stroke: WOOD, width: 10, wobble: 0.3 });
  p.ellipse(c, c, r - 26, r - 26, { stroke: INK, width: 11, wobble: 0.3 });
  p.ellipse(c, c, r - 26, r - 26, { stroke: RED_DARK, width: 5, wobble: 0.3 });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    p.line([[c, c], [c + Math.cos(a) * (r - 6), c + Math.sin(a) * (r - 6)]], { width: 8, color: INK });
    p.line([[c, c], [c + Math.cos(a) * (r - 8), c + Math.sin(a) * (r - 8)]], { width: 4, color: WOOD });
    const px = c + Math.cos(a) * r;
    const py = c + Math.sin(a) * r;
    p.shape([[px - Math.sin(a) * 22, py + Math.cos(a) * 22], [px + Math.sin(a) * 22, py - Math.cos(a) * 22], [px + Math.sin(a) * 22 + Math.cos(a) * 16, py - Math.cos(a) * 22 + Math.sin(a) * 16], [px - Math.sin(a) * 22 + Math.cos(a) * 16, py + Math.cos(a) * 22 + Math.sin(a) * 16]], { fill: k % 2 ? EMBER : GOLD, width: 3.5, raw: true, stroke: INK });
  }
  p.ellipse(c, c, 24, 24, { fill: OX, width: 4.5, stroke: INK });
  p.dot(c, c, 8, GOLD);
  return { key: 'mill_wheel', svg: p.svg(c * 2, c * 2), w: c * 2, h: c * 2 };
}

// ---------------------------------------------------------------- 2. Summit Lodge

export const LODGE: StopLook = {
  key: 'stopart_2',
  w: 940,
  h: 620,
  sign: { x: 300, y: 514, w: 250, size: 30, color: GOLD, stroke: INK },
  glows: [
    [300, 340, 300, 260, 0xffa840],
    [720, 470, 140, 90, 0xffc86b],
  ],
  bay: 690,
};
function lodgeArt(): Art {
  const p = pen(LODGE.key);
  const { h } = LODGE;
  // A stone base, and log walls in wood with ink seams and round log-ends at the corners.
  p.rect(70, 380, 460, h - 380, { fill: WOOD, width: 5, r: 3, stroke: INK, shade: [{ pts: [[420, 370], [540, 370], [540, h], [430, h]], color: OX }] });
  for (let y = 398; y < h - 40; y += 22) p.line([[74, y], [526, y]], { width: 3, color: OX, raw: true });
  for (let y = 392; y < h - 40; y += 22) for (const x of [70, 530]) {
    p.ellipse(x, y, 11, 10, { fill: '#B87A52', width: 3, stroke: INK });
    p.ellipse(x, y, 4, 4, { stroke: WOOD, width: 1.5 });
  }
  p.rect(60, h - 40, 480, 40, { fill: TAN, width: 4.5, r: 2, stroke: INK });
  for (let x = 70; x < 530; x += 44) p.rect(x, h - 34, 36, 26, { stroke: '#8A6E58', width: 2, r: 8 });
  // The great window: a triangle of gold, mullioned in ink, with a fire and a figure inside.
  p.shape([[300, 150], [474, 474], [126, 474]], { fill: LIT, width: 6, raw: true, stroke: INK, shade: [{ pts: [[300, 330], [474, 474], [126, 474]], color: LIT_DEEP }] });
  for (const [a, b] of [[[300, 150], [300, 474]], [[214, 310], [386, 310]], [[170, 392], [430, 392]]] as const) p.line([a as [number, number], b as [number, number]], { width: 5, raw: true, color: INK });
  p.rect(340, 420, 70, 54, { fill: OX, stroke: null, r: 2 });
  p.shape([[352, 470], [364, 436], [374, 452], [386, 428], [398, 470]], { fill: EMBER, raw: true, stroke: null });
  p.shape([[362, 470], [374, 452], [386, 470]], { fill: GOLD, raw: true, stroke: null });
  p.ellipse(240, 420, 15, 15, { fill: OX, stroke: null });
  p.rect(224, 434, 32, 40, { fill: OX, stroke: null, r: 8 });
  p.line([[180, 470], [180, 404], [196, 396]], { width: 3, color: OX, raw: true });
  p.ellipse(198, 396, 12, 8, { fill: GOLD, stroke: null });
  // The roof: plum boards on the A, under a thick bone snow cap shaded in halftone, with icicles.
  p.shape([[40, 520], [300, 40], [560, 520], [520, 520], [300, 112], [80, 520]], { fill: PLUM, width: 5, raw: true, stroke: INK });
  p.shape([[22, 528], [300, 22], [578, 528], [552, 542], [300, 78], [48, 542]], { fill: BONE, width: 5, raw: true, stroke: INK, shade: [{ pts: [[300, 60], [600, 60], [600, 560], [300, 560]], color: SAND }] });
  for (let k = 0; k < 9; k++) {
    const x = 60 + k * 26;
    const y = 540 - k * 46;
    p.shape([[x, y], [x + 7, y], [x + 3, y + 18 + (k % 3) * 8]], { fill: BONE, width: 2.5, raw: true, stroke: INK });
    const x2 = 540 - k * 26;
    p.shape([[x2, y], [x2 + 7, y], [x2 + 3, y + 14 + (k % 2) * 10]], { fill: BONE, width: 2.5, raw: true, stroke: INK });
  }
  // A crest at the peak: crossed skis behind a red shield with a gold star.
  for (const s of [-1, 1]) p.line([[300 - s * 40, 70], [300 + s * 40, 6]], { width: 7, color: INK });
  p.shape([[276, 18], [324, 18], [324, 46], [300, 62], [276, 46]], { fill: RED, raw: true, width: 4, stroke: INK });
  star(p, 300, 36, 11, GOLD, 2.5);
  // The stone chimney poking through the snow.
  p.rect(402, 120, 48, 140, { fill: TAN, width: 4.5, r: 2, stroke: INK });
  for (let y = 132; y < 250; y += 24) p.line([[404, y], [448, y]], { width: 2, color: '#8A6E58', raw: true });
  p.rect(394, 106, 64, 24, { fill: BONE, width: 3.5, r: 10, stroke: INK });
  // The porch board the game writes the name on: ink, gold-ruled, on two posts.
  p.rect(160, 490, 280, 48, { fill: INK, width: 4, r: 4, stroke: INK });
  p.rect(168, 497, 264, 34, { stroke: GOLD, width: 2.5, r: 2 });
  // Firewood, skis, a snowman with a red scarf, and a snow-capped red pump.
  for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) {
    p.ellipse(586 + k * 26, h - 16 - j * 24, 13, 12, { fill: '#B87A52', width: 3, stroke: INK });
    p.ellipse(586 + k * 26, h - 16 - j * 24, 5, 5, { stroke: WOOD, width: 1.5 });
  }
  p.shape([[574, h - 74], [612, h - 88], [690, h - 88], [700, h - 74]], { fill: BONE, raw: true, width: 3, stroke: INK });
  for (const [x, c] of [[684, RED], [702, GOLD]] as const) p.shape([[x, h], [x - 10, h - 170], [x - 2, h - 172], [x + 8, h]], { fill: c, width: 3.5, raw: true, stroke: INK });
  p.ellipse(770, h - 50, 50, 46, { fill: BONE, width: 4.5, stroke: INK, shade: [{ pts: [[780, h - 100], [830, h - 100], [830, h], [780, h]], color: SAND }] });
  p.ellipse(770, h - 128, 36, 34, { fill: BONE, width: 4.5, stroke: INK });
  p.ellipse(770, h - 184, 26, 25, { fill: BONE, width: 4.5, stroke: INK });
  p.dot(762, h - 190, 3.5, INK);
  p.dot(778, h - 190, 3.5, INK);
  p.shape([[770, h - 182], [796, h - 178], [770, h - 175]], { fill: EMBER, width: 2, raw: true, stroke: INK });
  p.line([[748, h - 160], [794, h - 160]], { width: 11, color: RED });
  p.line([[788, h - 160], [800, h - 130]], { width: 9, color: RED });
  for (const y of [h - 136, h - 112, h - 64]) p.dot(770, y, 4, INK);
  p.rect(846, 470, 56, h - 470, { fill: RED, width: 4.5, r: 14, stroke: INK, shade: [{ pts: [[880, 460], [906, 460], [906, h], [882, h]], color: RED_DARK }] });
  p.rect(838, 458, 72, 20, { fill: BONE, width: 3.5, r: 10, stroke: INK });
  p.rect(858, 494, 32, 28, { fill: BONE, width: 3, r: 4, stroke: INK });
  p.ellipse(874, 450, 14, 12, { fill: GOLD, width: 3, stroke: INK });
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
  sign: { x: 330, y: 92, w: 340, size: 52, color: GOLD, stroke: RED },
  glows: [
    [330, 320, 560, 110, 0xffc86b],
    [330, 92, 420, 110, 0xff6a30],
    [800, 322, 160, 70, 0xff6a30],
  ],
  bay: 760,
};
function dinerArt(): Art {
  const p = pen(DINER.key);
  const { h } = DINER;
  burst(p, 330, 92, 92, 24, GOLD, EMBER);
  p.ellipse(330, 92, 92, 92, { stroke: INK, width: 5 });
  // The diner car: a long bone body with rounded ends, fluted bands, a red racing stripe and ink trim.
  p.rect(40, 210, 600, 270, { fill: BONE, width: 6, r: 60, stroke: INK, shade: [{ pts: [[0, 400], [700, 400], [700, 500], [0, 500]], color: SAND }] });
  for (let y = 420; y < 470; y += 10) p.line([[80, y], [600, y]], { width: 2, color: TAN, raw: true, opacity: 0.8 });
  p.rect(40, 380, 600, 30, { fill: RED, width: 4.5, r: 3, stroke: INK });
  p.rect(40, 392, 600, 6, { fill: GOLD, r: 0, stroke: null });
  for (const x of [80, 600]) p.shape([[x - 20, 380], [x + 20, 380], [x, 410]], { fill: INK, raw: true, stroke: null });
  // The band of lit windows, mullioned in ink, with a counter, stools and two diners inside.
  p.rect(70, 262, 540, 106, { fill: LIT, width: 5, r: 10, stroke: INK, shade: [{ pts: [[70, 330], [610, 320], [610, 370], [70, 370]], color: LIT_DEEP }] });
  for (let x = 130; x < 610; x += 60) p.line([[x, 264], [x, 366]], { width: 4.5, raw: true, color: INK });
  p.rect(80, 334, 520, 12, { fill: RED_DARK, stroke: null, r: 3 });
  for (let x = 104; x < 590; x += 44) {
    p.ellipse(x, 358, 12, 6, { fill: RED, stroke: null });
    p.line([[x, 362], [x, 368]], { width: 3, color: OX, raw: true });
  }
  for (const x of [220, 420]) {
    p.ellipse(x, 296, 14, 14, { fill: OX, stroke: null });
    p.rect(x - 14, 308, 28, 28, { fill: OX, stroke: null, r: 6 });
  }
  p.rect(300, 306, 60, 28, { fill: BONE, width: 2.5, r: 12, stroke: INK, opacity: 0.85 });
  p.ellipse(330, 322, 18, 6, { fill: GOLD, stroke: null });
  for (const x of [78, 138]) p.line([[x, 272], [x + 24, 272], [x, 300]], { width: 3, color: '#FFFFFF', raw: true, opacity: 0.5 });
  // The door with a porthole, the steps, and the roof cornice in red over ink.
  p.rect(556, 288, 64, 162, { fill: RED, width: 4.5, r: 6, stroke: INK });
  p.ellipse(588, 328, 20, 20, { fill: LIT, width: 4, stroke: INK });
  p.rect(568, 380, 40, 6, { fill: GOLD, r: 2, stroke: null });
  p.rect(542, 450, 94, 30, { fill: TAN, width: 4, r: 2, stroke: INK });
  p.line([[546, 465], [632, 465]], { width: 2.5, raw: true });
  p.rect(26, 194, 628, 26, { fill: RED, width: 5, r: 12, stroke: INK });
  p.rect(36, 214, 608, 8, { fill: INK, r: 2, stroke: null });
  // The rooftop sign: an ink frame in a gold sunburst (the neon words are lit in the game), a star on top.
  for (const bx of [90, 570]) { burst(p, bx, 92, 62, 14, EMBER, GOLD); p.ellipse(bx, 92, 62, 62, { stroke: INK, width: 4 }); }
  p.rect(110, 34, 440, 116, { fill: OX, width: 7, r: 18, stroke: INK });
  p.rect(124, 46, 412, 92, { fill: INK, stroke: null, r: 12 });
  for (let k = 0; k < 16; k++) p.dot(132 + k * 26.5, 44, 4, BONE);
  p.line([[200, 150], [200, 196]], { width: 7 });
  p.line([[460, 150], [460, 196]], { width: 7 });
  star(p, 560, 40, 32, GOLD, 5);
  // The pump canopy, an OPEN 24/7 board, a red pump and a parked ember coupe.
  p.rect(694, 246, 272, 26, { fill: INK, width: 4, r: 3, stroke: INK });
  for (let x = 700, i = 0; x < 960; x += 22, i++) p.rect(x, 252, 14, 14, { fill: i % 2 ? RED : GOLD, r: 7, stroke: null });
  p.rect(826, 272, 14, h - 272, { fill: INK, width: 3, r: 2, stroke: INK });
  p.rect(700, 300, 120, 44, { fill: INK, width: 4, r: 8, stroke: INK });
  p.rect(756, 378, 54, h - 378, { fill: RED, width: 4.5, r: 14, stroke: INK, shade: [{ pts: [[790, 370], [814, 370], [814, h], [792, h]], color: RED_DARK }] });
  p.rect(764, 394, 38, 26, { fill: BONE, width: 2.5, r: 4, stroke: INK });
  p.ellipse(783, 372, 18, 14, { fill: GOLD, width: 3.5, stroke: INK });
  p.shape([[856, h - 10], [862, h - 60], [898, h - 88], [962, h - 88], [986, h - 60], [994, h - 10]], { fill: EMBER, width: 4.5, raw: true, stroke: INK, shade: [{ pts: [[856, h - 40], [994, h - 40], [994, h], [856, h]], color: '#C0602E' }] });
  p.rect(892, h - 82, 66, 24, { fill: LIT, width: 3, r: 6, stroke: INK });
  p.line([[860, h - 46], [990, h - 46]], { width: 3, color: BONE, raw: true });
  for (const wx of [884, 966]) {
    p.ellipse(wx, h - 12, 16, 16, { fill: INK, width: 3, stroke: INK });
    p.ellipse(wx, h - 12, 6, 6, { fill: BONE, stroke: null });
  }
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

/** Every checkpoint building and its moving parts, one job each. */
export const STOP_ART_JOBS: (() => Art)[] = [cornerArt, millArt, millWheelArt, millWaterArt, lodgeArt, dinerArt];

/**
 * Places a stop with its building standing on the ground at x, writes its name, lights its windows
 * and sets its moving part going. Returns a function to call every frame.
 */
export function placeStop(scene: Phaser.Scene, index: number, x: number, ground: number, name: string) {
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
    .text(x + look.sign.x, top + look.sign.y, name.toUpperCase(), { fontFamily: '"Anton", "Impact", sans-serif', fontSize: `${Math.round(look.sign.size * 1.15)}px`, color: look.sign.color, stroke: look.sign.stroke, strokeThickness: 6, align: 'center', ...lettering[index] })
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
  const open = scene.add.text(x + 760, top + 322, 'OPEN 24/7', { fontFamily: '"Anton", "Impact", sans-serif', fontSize: '26px', color: '#FF6A30', letterSpacing: 2 }).setOrigin(0.5).setDepth(-9.6).setShadow(0, 0, '#FF6A30', 12, true, true);
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
