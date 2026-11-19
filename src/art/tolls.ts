import { pen, type Art } from './art';
import { C, type Pt } from './ink';

/**
 * The toll plazas. Every place on the way has its own, built the way that place would build one:
 *
 *   meadow  A turnpike: a timber portal like a covered bridge's mouth, barn-red boards, a cupola and lanterns,
 *           and an old stone tollhouse with a canted bay window and a tariff board, hollyhocks at its foot.
 *   autumn  The Maple Gate: two round stone towers under slate cones, a crenellated arch between them grown
 *           over with red ivy, and a half-timbered Tudor lodge with a jettied upper floor.
 *   snow    A mountain pass post: a log gantry under a snow-loaded roof with carved fretwork and icicles,
 *           a bell, and an alpine chalet with heart-cut shutters and a cuckoo clock in the gable.
 *   coast   The bay bridge: streamline deco pylons, a long sea-green slab with speed stripes, a lighthouse
 *           lantern on a stepped tower, and a rounded kiosk with portholes, a life ring and a gull.
 *
 * Each plaza is three drawings: the portal that spans the road, its feet (drawn on the ground under each leg,
 * so a portal on a hill crest still stands on the road), and the booth with its barrier post.
 * Legs and foundations run on below the ground line; the road, drawn in front, hides what is underground.
 */

export const TOLL_SKINS = { meadow: 0, autumn: 1, snow: 2, coast: 3 } as const;
export type TollSkin = keyof typeof TOLL_SKINS;

export interface Plaza {
  portal: {
    w: number;
    h: number;
    /** The art's ground line: where the legs would meet level ground. */
    ground: number;
    /** The legs' x in the art, each stood on its own patch of road by a foot. */
    legs: number[];
    sign: { x: number; y: number; text: string; size: number; color: string; stroke: string; spacing?: number };
    /** Lamps under the span, as [x, y]; each throws a pool of light on the road beneath. */
    lamps: Pt[];
    lampTint: number;
  };
  foot: { w: number; h: number; ground: number };
  booth: { w: number; h: number; ground: number; hinge: number; beacon: Pt; beaconTint: number; face: Pt };
}

const INK = C.ink;
const BONE = '#F3E3CC';
const SAND = '#D9C3A6';
const TAN = '#B89A7A';
const STONE_LINE = '#8A6E58';
const RED = '#E3263A';
const RED_DARK = '#9E1A2E';
const EMBER = '#FF6A30';
const RUST = '#C0602E';
const GOLD = '#FFB23F';
const GOLD_DARK = '#D98A2A';
const OX = '#3A0F22';
const PLUM = '#5A1A3A';
const WOOD = '#6A2E2E';
const HONEY = '#B87A52';
const BARN = '#A8452E';
const OLIVE = '#7E8A44';
const PINE = '#2A4636';
const SEA = '#3E6E5E';
const LIT = '#FFC86B';
const LIT_DEEP = '#FF9E4A';

/** Points round part of an ellipse, from angle a0 to a1. */
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt;
  });

type P = ReturnType<typeof pen>;

/** Coursed stonework: staggered rounded blocks, inked lightly over a wall already filled. */
function stones(p: P, x: number, y: number, w: number, h: number, rowH = 26, stoneW = 46, color = STONE_LINE) {
  for (let r = 0, yy = y + 3; yy < y + h - 6; r++, yy += rowH) {
    for (let xx = x + 4 - (r % 2) * (stoneW / 2); xx < x + w - 6; xx += stoneW) {
      const x0 = Math.max(x + 3, xx);
      const x1 = Math.min(x + w - 3, xx + stoneW - 5);
      if (x1 - x0 > 8) p.rect(x0, yy, x1 - x0, Math.min(rowH - 5, y + h - 3 - yy), { stroke: color, width: 2.2, r: 7, opacity: 0.85 });
    }
  }
}
/** Leaded diamond panes: diagonal cames both ways, kept inside the rectangle. */
function lattice(p: P, x: number, y: number, w: number, h: number, step: number) {
  const seg = (ax: number, ay: number, bx: number, by: number) => {
    let t0 = 0;
    let t1 = 1;
    const dx = bx - ax;
    const dy = by - ay;
    for (const [q, r] of [[-dx, ax - x], [dx, x + w - ax], [-dy, ay - y], [dy, y + h - ay]]) {
      if (q === 0) {
        if (r < 0) return;
        continue;
      }
      const t = r / q;
      if (q < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
    if (t1 - t0 > 0.02) p.line([[ax + dx * t0, ay + dy * t0], [ax + dx * t1, ay + dy * t1]], { width: 1.8, color: INK, raw: true, opacity: 0.5 });
  };
  for (let c = -h; c < w; c += step) {
    seg(x + c, y + h, x + c + h, y);
    seg(x + c, y, x + c + h, y + h);
  }
}
/** A row of shingle scallops along y, from x0 to x1. */
function scallops(p: P, x0: number, x1: number, y: number, r: number, color: string, width = 2.4) {
  const pts: Pt[] = [];
  for (let x = x0; x < x1 - 1; x += r * 2) pts.push(...arc(x + r, y, r, r * 0.8, Math.PI, 0, 6));
  if (pts.length > 1) p.line(pts, { width, color, raw: true });
}
/** A five-point star. */
function star(p: P, cx: number, cy: number, r: number, fill: string, width = 3) {
  const pts: Pt[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * (k % 2 ? r * 0.45 : r), cy + Math.sin(a) * (k % 2 ? r * 0.45 : r)]);
  }
  p.shape(pts, { fill, width, raw: true, stroke: INK });
}
/** A maple leaf, pointing up. */
function leaf(p: P, cx: number, cy: number, s: number, fill: string, rot = 0) {
  const base: Pt[] = [[0, -1], [0.22, -0.55], [0.55, -0.7], [0.45, -0.3], [0.95, -0.25], [0.6, 0.1], [0.7, 0.35], [0.12, 0.3], [0.08, 0.8], [-0.08, 0.8], [-0.12, 0.3], [-0.7, 0.35], [-0.6, 0.1], [-0.95, -0.25], [-0.45, -0.3], [-0.55, -0.7], [-0.22, -0.55]];
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  p.shape(base.map(([x, y]) => [cx + (x * c - y * sn) * s, cy + (x * sn + y * c) * s] as Pt), { fill, raw: true, width: 2, stroke: INK });
}
/** A hanging lantern: chain, cap, glowing glass, base. */
function lantern(p: P, x: number, y0: number, y: number, body: string = INK) {
  p.line([[x, y0], [x, y - 16]], { width: 3, raw: true });
  p.shape([[x - 14, y - 6], [x - 6, y - 18], [x + 6, y - 18], [x + 14, y - 6]], { fill: body, raw: true, width: 3 });
  p.rect(x - 11, y - 6, 22, 28, { fill: LIT, width: 3.5, r: 3 });
  p.line([[x, y - 4], [x, y + 20]], { width: 2, color: body, raw: true });
  p.rect(x - 14, y + 22, 28, 7, { fill: body, width: 3, r: 2 });
}
/** The attendant, dozing at the window: head, hat by place, closed eyes, a moustache, shoulders. */
function keeper(p: P, cx: number, cy: number, bottom: number, hat: 'cap' | 'tudor' | 'beanie' | 'sailor', coat: string) {
  p.shape([[cx - 44, bottom], [cx - 36, cy + 26], [cx - 12, cy + 18], [cx + 12, cy + 18], [cx + 36, cy + 26], [cx + 44, bottom]], { fill: coat, width: 3.5 });
  p.ellipse(cx, cy, 25, 24, { fill: BONE, width: 4 });
  p.line([[cx - 14, cy + 1], [cx - 6, cy + 4]], { width: 3, raw: true });
  p.line([[cx + 6, cy + 4], [cx + 14, cy + 1]], { width: 3, raw: true });
  p.shape([[cx - 11, cy + 11], [cx, cy + 7], [cx + 11, cy + 11], [cx + 7, cy + 16], [cx - 7, cy + 16]], { fill: OX, raw: true, width: 2.5 });
  p.ellipse(cx - 16, cy + 9, 5, 3.5, { fill: '#F2A38A', stroke: null });
  p.ellipse(cx + 16, cy + 9, 5, 3.5, { fill: '#F2A38A', stroke: null });
  if (hat === 'cap') {
    p.shape([[cx - 27, cy - 8], [cx - 22, cy - 24], [cx + 4, cy - 30], [cx + 26, cy - 20], [cx + 40, cy - 10], [cx + 22, cy - 6]], { fill: TAN, width: 3.5 });
    p.line([[cx - 18, cy - 14], [cx + 22, cy - 18]], { width: 2, color: STONE_LINE, raw: true });
  } else if (hat === 'tudor') {
    p.ellipse(cx, cy - 18, 34, 9, { fill: OX, width: 3.5 });
    p.shape([[cx - 22, cy - 18], [cx - 16, cy - 34], [cx + 16, cy - 34], [cx + 22, cy - 18]], { fill: OX, width: 3.5 });
    p.shape([[cx + 10, cy - 32], [cx + 30, cy - 52], [cx + 22, cy - 28]], { fill: GOLD, width: 2.5 });
  } else if (hat === 'beanie') {
    p.shape([[cx - 26, cy - 8], [cx - 22, cy - 28], [cx, cy - 36], [cx + 22, cy - 28], [cx + 26, cy - 8]], { fill: RED, width: 3.5 });
    p.rect(cx - 28, cy - 14, 56, 10, { fill: BONE, width: 3, r: 4 });
    p.ellipse(cx, cy - 40, 9, 9, { fill: BONE, width: 3 });
  } else {
    p.shape([[cx - 26, cy - 10], [cx - 24, cy - 28], [cx + 24, cy - 28], [cx + 26, cy - 10]], { fill: BONE, width: 3.5 });
    p.rect(cx - 27, cy - 16, 54, 8, { fill: PINE, r: 2, width: 2.5 });
    p.shape([[cx - 28, cy - 10], [cx + 28, cy - 10], [cx + 20, cy - 2], [cx - 20, cy - 2]], { fill: INK, raw: true, width: 2.5 });
    p.dot(cx, cy - 22, 4, GOLD);
  }
}
/** The barrier's post, its STOP disc and pivot cap, in a place's own style. */
function hingePost(p: P, ground: number, body: string, band: string, below: number, cap: 'ball' | 'stone' | 'snow' | 'deco') {
  const top = ground - 210;
  if (cap === 'stone') {
    p.rect(12, top, 38, ground - top + below, { fill: SAND, width: 4.5 });
    stones(p, 12, top, 38, ground - top + below, 22, 38);
    p.rect(6, top - 14, 50, 18, { fill: TAN, width: 4, r: 3 });
    p.ellipse(31, top - 26, 14, 14, { fill: GOLD, width: 3.5 });
  } else {
    p.rect(18, top, 26, ground - top + below, { fill: body, width: 4.5, r: 3 });
    for (let y = top + 10; y < ground - 10; y += 36) p.rect(18, y, 26, 16, { fill: band, stroke: null, r: 0 });
    if (cap === 'ball') {
      p.rect(12, top - 10, 38, 14, { fill: body, width: 4, r: 3 });
      p.ellipse(31, top - 24, 14, 14, { fill: body, width: 4 });
    } else if (cap === 'snow') {
      p.shape([[10, top + 4], [14, top - 14], [31, top - 22], [48, top - 14], [52, top + 4]], { fill: BONE, width: 4 });
    } else {
      p.rect(12, top - 8, 38, 12, { fill: GOLD, width: 3.5, r: 2 });
      p.rect(18, top - 22, 26, 14, { fill: body, width: 3.5, r: 2 });
      p.shape([[22, top - 22], [31, top - 40], [40, top - 22]], { fill: GOLD, raw: true, width: 3 });
    }
  }
  p.ellipse(31, ground - 158, 21, 21, { fill: INK, width: 4.5 });
  p.ellipse(31, ground - 158, 9, 9, { fill: GOLD, stroke: null });
}

// ================================================================ the plazas' measurements

const PORTAL_H = 880;
const PORTAL_GROUND = 740;
const BOOTH_H = 540;
const BOOTH_GROUND = 410;
const FOOT = { w: 170, h: 130, ground: 76 };

const plaza = (sign: Plaza['portal']['sign'], lamps: Pt[], lampTint: number, beacon: Pt, beaconTint: number, face: Pt): Plaza => ({
  portal: { w: 780, h: PORTAL_H, ground: PORTAL_GROUND, legs: [70, 710], sign, lamps, lampTint },
  foot: FOOT,
  booth: { w: 330, h: BOOTH_H, ground: BOOTH_GROUND, hinge: 31, beacon, beaconTint, face },
});

export const PLAZAS: Record<TollSkin, Plaza> = {
  meadow: plaza({ x: 390, y: 152, text: 'TOLL', size: 36, color: INK, stroke: BONE }, [[230, 262], [550, 262]], 0xffd08a, [270, 196], 0xffb43a, [168, 268]),
  autumn: plaza({ x: 390, y: 144, text: 'MAPLE GATE', size: 30, color: OX, stroke: BONE, spacing: 2 }, [[250, 300], [530, 300]], 0xffb060, [262, 204], 0xffa040, [148, 308]),
  snow: plaza({ x: 390, y: 254, text: 'PASS TOLL', size: 30, color: BONE, stroke: RED_DARK, spacing: 2 }, [[180, 262], [600, 262]], 0xffd8a0, [266, 238], 0xffc060, [160, 270]),
  coast: plaza({ x: 390, y: 196, text: 'BAY BRIDGE TOLL', size: 28, color: PINE, stroke: BONE, spacing: 2 }, [[150, 246], [300, 246], [480, 246], [630, 246]], 0xfff0c0, [165, 98], 0xffd060, [161, 256]),
};

// ================================================================ meadow: the turnpike

function meadowPortal(p: P) {
  const G = PORTAL_GROUND;
  const bottom = PORTAL_H;
  // Two heavy timber posts, grained, with knee braces up into the tie beam.
  for (const lx of [70, 710]) {
    p.rect(lx - 30, 186, 60, bottom - 186, { fill: WOOD, width: 5, r: 2, shade: [{ pts: [[lx + 8, 180], [lx + 34, 180], [lx + 34, bottom], [lx + 10, bottom]], color: OX }] });
    for (const dx of [-14, 2, 16]) p.line([[lx + dx, 200], [lx + dx + 2, 360], [lx + dx - 1, 520], [lx + dx + 1, G]], { width: 1.6, color: OX, opacity: 0.8 });
    // A horseshoe for luck, and the fare board on the left post.
    p.line(arc(lx, 330, 12, 14, Math.PI * 0.7, Math.PI * 2.3, 10), { width: 5, color: TAN });
  }
  for (const [x0, x1] of [[100, 190], [680, 590]]) p.shape([[x0, 300], [x1, 188], [x1 + (x1 > x0 ? 26 : -26), 188], [x0, 330]], { fill: WOOD, raw: true, width: 4 });
  p.rect(14, 174, 752, 30, { fill: WOOD, width: 5, r: 2 });
  for (const bx of [24, 740]) p.ellipse(bx + 8, 189, 10, 10, { fill: HONEY, width: 3 });
  // The barn-board band: red boards with battens, bone X-braced end panels like barn doors.
  p.rect(26, 116, 728, 62, { fill: BARN, width: 5, r: 1, shade: [{ pts: [[26, 160], [754, 160], [754, 180], [26, 180]], color: WOOD }] });
  for (let x = 46; x < 744; x += 22) p.line([[x, 118], [x, 176]], { width: 2.4, color: WOOD, raw: true });
  for (const x0 of [34, 640]) {
    p.rect(x0, 122, 106, 50, { stroke: BONE, width: 5, r: 1 });
    p.line([[x0 + 4, 126], [x0 + 102, 168]], { width: 5, color: BONE, raw: true });
    p.line([[x0 + 102, 126], [x0 + 4, 168]], { width: 5, color: BONE, raw: true });
  }
  // The name board, bone with an ink rule, nailed on.
  p.rect(290, 124, 200, 56, { fill: BONE, width: 5, r: 2 });
  p.rect(298, 131, 184, 42, { stroke: INK, width: 2, r: 1 });
  for (const nx of [302, 478]) p.dot(nx, 136, 3, INK);
  // The roof: dark shingles in scalloped rows, a heavy eave, and the cupola with its vane.
  p.shape([[2, 120], [778, 120], [738, 58], [42, 58]], { fill: PLUM, raw: true, width: 5, shade: [{ pts: [[2, 104], [778, 104], [778, 124], [2, 124]], color: OX }] });
  for (let r = 0; r < 3; r++) scallops(p, 46 - r * 12, 734 + r * 12, 74 + r * 16, 10, OX);
  p.rect(0, 114, 780, 10, { fill: INK, r: 2, width: 2 });
  p.rect(356, 18, 68, 44, { fill: BARN, width: 4.5, r: 1 });
  for (let k = 0; k < 4; k++) p.line([[366, 28 + k * 9], [414, 28 + k * 9]], { width: 3, color: INK, raw: true });
  p.shape([[346, 22], [434, 22], [390, 2]], { fill: PLUM, raw: true, width: 4 });
  p.line([[390, 6], [390, 0]], { width: 3, raw: true });
  // Bunting strung between the braces.
  const sag = (t: number) => 236 + Math.sin(t * Math.PI) * 26;
  const n = 15;
  p.line(Array.from({ length: 31 }, (_, i) => [130 + (i / 30) * 520, sag(i / 30)] as Pt), { width: 2.4, raw: true });
  for (let k = 0; k < n; k++) {
    const t0 = (k + 0.15) / n;
    const t1 = (k + 0.85) / n;
    const xa = 130 + t0 * 520;
    const xb = 130 + t1 * 520;
    p.shape([[xa, sag(t0)], [xb, sag(t1)], [(xa + xb) / 2, (sag(t0) + sag(t1)) / 2 + 26]], { fill: [RED, BONE, GOLD][k % 3], raw: true, width: 2.4 });
  }
  // The lanterns hang from the tie beam.
  for (const [lx] of PLAZAS.meadow.portal.lamps) lantern(p, lx, 204, 254);
  // The fare board on the left post.
  p.rect(28, 380, 84, 110, { fill: BONE, width: 4, r: 2 });
  p.rect(28, 380, 84, 22, { fill: RED, width: 4, r: 2 });
  for (let k = 0; k < 4; k++) {
    p.line([[38, 418 + k * 18], [80, 418 + k * 18]], { width: 2.4, raw: true });
    p.dot(98, 418 + k * 18, 3.5, INK);
  }
}
function meadowFoot(p: P) {
  const g = FOOT.ground;
  p.shape([[34, g + 50], [30, g - 14], [42, g - 34], [128, g - 34], [140, g - 14], [136, g + 50]], { fill: SAND, raw: true, width: 4.5, shade: [{ pts: [[100, g - 40], [150, g - 40], [150, g + 60], [104, g + 60]], color: TAN }] });
  stones(p, 34, g - 32, 102, 80, 22, 34);
  for (const [x, c] of [[24, OLIVE], [146, OLIVE], [40, GOLD]] as const) p.line([[x, g + 4], [x - 4, g - 20], [x + 2, g - 30]], { width: 3, color: c });
}
function meadowBooth(p: P) {
  const G = BOOTH_GROUND;
  const B = BOOTH_H;
  // A stone footing that runs into the ground, the limewashed walls, quoins at the corners.
  p.rect(60, G - 40, 222, B - G + 40, { fill: SAND, width: 4.5, r: 1 });
  stones(p, 60, G - 40, 222, B - G + 40, 24, 44);
  // The canted bay: three faces, the side ones turned away and shaded.
  p.shape([[72, G - 40], [72, 200], [118, 186], [118, G - 40]], { fill: SAND, raw: true, width: 4.5 });
  p.shape([[118, G - 40], [118, 186], [218, 186], [218, G - 40]], { fill: BONE, raw: true, width: 4.5 });
  p.shape([[218, G - 40], [218, 186], [270, 200], [270, G - 40]], { fill: TAN, raw: true, width: 4.5 });
  for (let y = 200; y < G - 50; y += 34) for (const [x, w] of [[118, 14], [204, 14]] as const) p.rect(x, y, w, 20, { fill: BONE, width: 2.5, r: 1 });
  // A hipped slate roof over the bay, the chimney behind.
  p.rect(214, 62, 34, 100, { fill: BARN, width: 4.5, r: 1 });
  for (let y = 72; y < 160; y += 16) p.line([[216, y], [246, y]], { width: 2, color: WOOD, raw: true });
  p.rect(208, 54, 46, 14, { fill: WOOD, width: 4, r: 2 });
  p.rect(220, 40, 14, 16, { fill: RUST, width: 3, r: 1 });
  p.shape([[54, 206], [118, 110], [218, 110], [286, 206]], { fill: PLUM, raw: true, width: 5, shade: [{ pts: [[218, 100], [300, 100], [300, 210], [218, 210]], color: OX }] });
  for (let r = 0; r < 4; r++) {
    const y = 128 + r * 20;
    const k = (y - 110) / 96;
    scallops(p, 118 - k * 64 + 6, 218 + k * 68 - 6, y, 9, OX);
  }
  p.line([[118, 110], [218, 110]], { width: 5, raw: true });
  p.rect(50, 200, 240, 10, { fill: INK, r: 2, width: 2 });
  // The front window: a pointed Gothic arch, lit, latticed, with the keeper dozing behind.
  const win: Pt[] = [[128, 322], [128, 262], ...arc(168, 262, 40, 52, Math.PI, Math.PI * 1.5, 8), ...arc(168, 262, 40, 52, Math.PI * 1.5, Math.PI * 2, 8), [208, 322]];
  p.shape(win, { fill: LIT, raw: true, width: 5, shade: [{ pts: [[120, 290], [216, 280], [216, 330], [120, 330]], color: LIT_DEEP }] });
  keeper(p, 168, 268, 320, 'cap', PINE);
  lattice(p, 129, 262, 78, 58, 20);
  p.line([[168, 212], [168, 262]], { width: 3, raw: true });
  p.line([[129, 262], [207, 262]], { width: 3, raw: true });
  p.shape(win, { stroke: INK, raw: true, width: 6 });
  p.rect(120, 320, 96, 12, { fill: BONE, width: 3.5, r: 2 });
  // Slim lancets in the side faces.
  for (const [x, f] of [[86, LIT_DEEP], [234, LIT_DEEP]] as const) p.shape([[x, 310], [x, 250], [x + 10, 232], [x + 20, 250], [x + 20, 310]], { fill: f, raw: true, width: 4 });
  // The tariff board under the window.
  p.rect(116, 344, 104, 54, { fill: BONE, width: 4, r: 2 });
  p.rect(116, 344, 104, 14, { fill: RED, width: 3.5, r: 2 });
  for (let k = 0; k < 2; k++) {
    p.line([[124, 368 + k * 13], [180, 368 + k * 13]], { width: 2.2, raw: true });
    p.dot(206, 368 + k * 13, 3, INK);
  }
  // The lamp on its iron bracket.
  p.line([[270, 230], [270, 214], [258, 214]], { width: 4, raw: true });
  lantern(p, 262, 214, 196 + 18);
  // Hollyhocks and a milk churn.
  for (const [x, hgt, c] of [[66, 110, RED], [80, 140, BONE], [278, 120, GOLD]] as const) {
    p.line([[x, G], [x + 2, G - hgt]], { width: 3, color: OLIVE });
    for (let k = 0; k < 4; k++) p.dot(x + (k % 2 ? 5 : -4), G - hgt + 10 + k * 18, 7 - k, c);
  }
  p.shape([[44, G], [42, G - 52], [50, G - 62], [70, G - 62], [78, G - 52], [76, G]], { fill: SAND, raw: true, width: 4 });
  p.rect(46, G - 36, 28, 6, { fill: TAN, r: 1, stroke: null });
  p.rect(48, G - 72, 24, 12, { fill: TAN, width: 3, r: 3 });
  hingePost(p, G, BONE, RED, B - G, 'ball');
}

// ================================================================ autumn: the maple gate

function autumnPortal(p: P) {
  const G = PORTAL_GROUND;
  const bottom = PORTAL_H;
  // The arch wall: battlements on top, an elliptical opening beneath, stones throughout.
  const wall: Pt[] = [[120, 98], [660, 98], [660, 372], ...arc(390, 372, 270, 160, 0, -Math.PI, 30), [120, 372]];
  p.shape(wall, { fill: SAND, raw: true, width: 5, shade: [{ pts: [[120, 96], [660, 96], [660, 130], [120, 130]], color: TAN }] });
  stones(p, 120, 98, 540, 120, 26, 52);
  p.shape(wall, { stroke: INK, raw: true, width: 5 });
  for (let x = 128; x < 650; x += 52) p.rect(x, 70, 32, 34, { fill: SAND, width: 4.5, r: 1 });
  p.rect(116, 96, 548, 12, { fill: TAN, width: 4, r: 1 });
  // Voussoirs round the arch and the keystone with the maple crest.
  for (let k = 1; k < 12; k++) {
    const a = -Math.PI + (k / 12) * Math.PI;
    const [x0, y0] = [390 + Math.cos(a) * 270, 372 + Math.sin(a) * 160];
    const [x1, y1] = [390 + Math.cos(a) * 304, 372 + Math.sin(a) * 194];
    p.line([[x0, y0], [x1, y1]], { width: 3, color: STONE_LINE, raw: true });
  }
  p.line(arc(390, 372, 304, 194, -Math.PI * 0.98, -Math.PI * 0.02, 30), { width: 3, color: STONE_LINE, raw: true });
  p.shape([[362, 170], [418, 170], [408, 222], [372, 222]], { fill: TAN, raw: true, width: 4.5 });
  // The name ribbon across the wall.
  p.shape([[214, 122], [566, 122], [586, 146], [566, 168], [214, 168], [194, 146]], { fill: BONE, raw: true, width: 5 });
  p.shape([[194, 146], [170, 128], [178, 146], [170, 166]], { fill: RED, raw: true, width: 3.5 });
  p.shape([[586, 146], [610, 128], [602, 146], [610, 166]], { fill: RED, raw: true, width: 3.5 });
  p.shape([[376, 180], [404, 180], [404, 206], [390, 216], [376, 206]], { fill: GOLD, raw: true, width: 3 });
  leaf(p, 390, 196, 13, RED);
  // The towers: round, coursed, with arrow slits, a corbelled parapet and slate cones with pennants.
  for (const cx of [70, 710]) {
    p.rect(cx - 62, 160, 124, bottom - 160, { fill: SAND, width: 5, r: 2, shade: [{ pts: [[cx + 18, 150], [cx + 70, 150], [cx + 70, bottom], [cx + 22, bottom]], color: TAN }, { pts: [[cx - 70, 150], [cx - 46, 150], [cx - 46, bottom], [cx - 70, bottom]], color: TAN }] });
    stones(p, cx - 62, 166, 124, G - 166, 28, 40);
    p.rect(cx - 70, 140, 140, 26, { fill: SAND, width: 4.5, r: 1 });
    for (let x = cx - 64; x < cx + 64; x += 20) p.rect(x, 164, 12, 12, { fill: TAN, width: 2.5, r: 1 });
    for (const y of [240, 420]) {
      p.rect(cx - 8, y, 16, 54, { fill: LIT_DEEP, width: 3.5, r: 6 });
      p.line([[cx - 16, y + 27], [cx + 16, y + 27]], { width: 3, raw: true });
    }
    p.shape([[cx - 78, 144], [cx, 6], [cx + 78, 144]], { fill: PLUM, raw: true, width: 5, shade: [{ pts: [[cx, 0], [cx + 90, 0], [cx + 90, 150], [cx, 150]], color: OX }] });
    for (let r = 0; r < 5; r++) {
      const y = 40 + r * 22;
      const half = ((y - 6) / 138) * 78 - 6;
      scallops(p, cx - half, cx + half, y, 7, OX, 2);
    }
    p.line([[cx, 8], [cx, -4]], { width: 3, raw: true });
    p.shape([[cx, -2], [cx + (cx < 390 ? -40 : 40), 6], [cx, 14]], { fill: RED, raw: true, width: 3 });
  }
  // Ivy climbing the towers and spilling over the arch, its leaves turning red and gold.
  const ivy = (pts: Pt[], seed: number) => {
    p.line(pts, { width: 3, color: WOOD });
    pts.forEach(([x, y], i) => leaf(p, x + (i % 2 ? 8 : -8), y, 9 + ((i + seed) % 3) * 2, [RED, EMBER, GOLD, RUST][(i + seed) % 4], (i % 2 ? 0.6 : -0.6)));
  };
  ivy([[30, G - 20], [26, 600], [40, 520], [30, 440], [44, 360], [60, 290], [100, 250], [140, 230]], 0);
  ivy([[750, G - 60], [740, 560], [752, 470], [736, 390], [720, 320], [690, 260], [650, 220]], 1);
  ivy([[300, 108], [330, 124], [270, 132], [240, 160], [200, 170]], 2);
  ivy([[480, 108], [520, 170], [560, 180], [600, 214]], 3);
  for (const [lx, ly] of PLAZAS.autumn.portal.lamps) {
    const top = 372 + Math.sin(-Math.acos((lx - 390) / 270)) * 160;
    lantern(p, lx, top, ly - 6);
  }
}
function autumnFoot(p: P) {
  const g = FOOT.ground;
  p.shape([[8, g + 54], [12, g - 8], [26, g - 30], [144, g - 30], [158, g - 8], [162, g + 54]], { fill: TAN, raw: true, width: 4.5 });
  stones(p, 12, g - 28, 146, 80, 24, 36, '#6E5646');
  for (const [x, y, c] of [[20, g - 4, RED], [150, g - 10, GOLD], [96, g + 2, EMBER]] as const) leaf(p, x, y, 10, c, x / 40);
}
function autumnBooth(p: P) {
  const G = BOOTH_GROUND;
  const B = BOOTH_H;
  // Stone plinth, then the ground floor in plaster with close-set oxblood studs.
  p.rect(70, G - 60, 196, B - G + 60, { fill: TAN, width: 4.5, r: 1 });
  stones(p, 70, G - 60, 196, B - G + 60, 22, 40, '#6E5646');
  p.rect(76, 260, 184, G - 320, { fill: BONE, width: 4.5, r: 1 });
  for (let x = 84; x < 256; x += 24) if (x < 100 || x > 196) p.rect(x, 262, 9, G - 324, { fill: WOOD, stroke: null, r: 0 });
  p.rect(76, 258, 184, 10, { fill: WOOD, width: 3.5, r: 0 });
  p.rect(76, G - 70, 184, 10, { fill: WOOD, width: 3.5, r: 0 });
  // The leaded window on the ground floor, the keeper inside.
  p.rect(100, 274, 100, 72, { fill: LIT, width: 5, r: 2, shade: [{ pts: [[100, 320], [200, 310], [200, 350], [100, 350]], color: LIT_DEEP }] });
  keeper(p, 148, 308, 344, 'tudor', RED_DARK);
  lattice(p, 101, 275, 98, 70, 18);
  p.rect(100, 274, 100, 72, { stroke: WOOD, width: 7, r: 2 });
  p.line([[150, 276], [150, 344]], { width: 4, color: WOOD, raw: true });
  // The jettied upper floor: wider, with X-braced timbers and a little oriel.
  p.rect(54, 158, 228, 100, { fill: BONE, width: 5, r: 1, shade: [{ pts: [[54, 240], [282, 240], [282, 260], [54, 260]], color: SAND }] });
  for (const x0 of [54, 120, 216]) {
    p.rect(x0, 160, 10, 96, { fill: WOOD, stroke: null, r: 0 });
    p.line([[x0 + 6, 164], [x0 + 60, 252]], { width: 7, color: WOOD, raw: true });
    p.line([[x0 + 60, 164], [x0 + 6, 252]], { width: 7, color: WOOD, raw: true });
  }
  p.rect(272, 160, 10, 96, { fill: WOOD, stroke: null, r: 0 });
  p.rect(146, 176, 60, 56, { fill: LIT_DEEP, width: 4.5, r: 2 });
  p.line([[176, 178], [176, 230]], { width: 3, raw: true });
  p.rect(140, 230, 72, 10, { fill: WOOD, width: 3, r: 1 });
  for (let x = 60; x < 280; x += 22) p.rect(x, 254, 12, 12, { fill: WOOD, width: 2.5, r: 2 });
  // A steep rust-tiled roof and a tall Tudor chimney stack with twisted pots.
  p.rect(210, 30, 40, 110, { fill: BARN, width: 4.5, r: 1 });
  for (let y = 40; y < 136; y += 14) p.line([[212, y], [248, y]], { width: 2, color: WOOD, raw: true });
  for (const x of [214, 232]) {
    p.rect(x, 4, 14, 28, { fill: RUST, width: 3, r: 2 });
    for (let k = 0; k < 3; k++) p.line([[x + 1, 8 + k * 8], [x + 13, 12 + k * 8]], { width: 1.8, color: WOOD, raw: true });
  }
  p.shape([[38, 164], [168, 46], [298, 164]], { fill: RUST, raw: true, width: 5, shade: [{ pts: [[168, 40], [310, 40], [310, 170], [168, 170]], color: WOOD }] });
  for (let r = 0; r < 5; r++) {
    const y = 72 + r * 20;
    const half = ((y - 46) / 118) * 130 - 6;
    scallops(p, 168 - half, 168 + half, y, 8, WOOD, 2.2);
  }
  p.rect(34, 158, 268, 10, { fill: INK, r: 2, width: 2 });
  // The iron lantern on its scrolled bracket, a pumpkin, a barrel of apples, red leaves.
  p.line([[282, 196], [270, 186], [258, 190], [262, 202]], { width: 4 });
  lantern(p, 262, 190, 206);
  p.ellipse(244, G - 18, 26, 20, { fill: EMBER, width: 4 });
  for (const dx of [-12, 0, 12]) p.line([[244 + dx, G - 36], [244 + dx * 1.2, G - 2]], { width: 2, color: RUST, raw: true });
  p.line([[244, G - 38], [250, G - 48]], { width: 4, color: PINE });
  p.shape([[60, G], [56, G - 56], [94, G - 56], [90, G]], { fill: HONEY, raw: true, width: 4 });
  for (const y of [G - 46, G - 14]) p.line([[57, y], [93, y]], { width: 3, raw: true });
  for (const x of [64, 76, 88]) p.dot(x, G - 60, 7, RED);
  leaf(p, 110, G - 4, 10, RED, 0.4);
  leaf(p, 284, G - 6, 9, GOLD, -0.5);
  hingePost(p, G, SAND, TAN, B - G, 'stone');
}

// ================================================================ snow: the mountain pass

function snowPortal(p: P) {
  const G = PORTAL_GROUND;
  const bottom = PORTAL_H;
  // Log posts with ring-cut tops, knee logs up into the beam, and a red-banded snow pole on the left.
  for (const lx of [70, 710]) {
    p.rect(lx - 28, 200, 56, bottom - 200, { fill: HONEY, width: 5, r: 10, shade: [{ pts: [[lx + 6, 190], [lx + 34, 190], [lx + 34, bottom], [lx + 8, bottom]], color: WOOD }] });
    for (let y = 250; y < G; y += 70) p.line([[lx - 20, y], [lx - 8, y + 6]], { width: 2.2, color: WOOD, raw: true });
    const dir = lx < 390 ? 1 : -1;
    p.shape([[lx + dir * 24, 330], [lx + dir * 118, 214], [lx + dir * 146, 214], [lx + dir * 24, 364]], { fill: HONEY, raw: true, width: 4.5 });
  }
  p.rect(110, 380, 18, G - 380, { fill: BONE, width: 3.5, r: 3 });
  for (let y = 392; y < G - 10; y += 40) p.rect(110, y, 18, 18, { fill: RED, stroke: null, r: 0 });
  // The great beam, a squared log with ringed ends.
  p.rect(0, 176, 780, 46, { fill: HONEY, width: 5, r: 6, shade: [{ pts: [[0, 206], [780, 206], [780, 224], [0, 224]], color: WOOD }] });
  for (const ex of [22, 758]) {
    p.ellipse(ex, 199, 20, 22, { fill: SAND, width: 4 });
    p.ellipse(ex, 199, 12, 13, { stroke: HONEY, width: 2 });
    p.ellipse(ex, 199, 4, 5, { stroke: HONEY, width: 2 });
  }
  // Icicles under the beam.
  for (let x = 30, k = 0; x < 760; x += 28, k++) if (x < 300 || x > 480) p.shape([[x, 220], [x + 9, 220], [x + 4, 236 + (k % 3) * 9]], { fill: BONE, raw: true, width: 2.4 });
  // The roof: shingles under a deep pillow of snow, with a carved fretwork valance of heart cut-outs.
  p.shape([[6, 152], [774, 152], [734, 88], [46, 88]], { fill: WOOD, raw: true, width: 5 });
  for (let r = 0; r < 3; r++) scallops(p, 50 - r * 12, 730 + r * 12, 104 + r * 16, 10, OX);
  p.rect(10, 148, 760, 30, { fill: RED_DARK, width: 4.5, r: 1 });
  for (let x = 30; x < 760; x += 36) {
    p.shape([[x, 156], [x + 6, 152], [x + 10, 158], [x + 14, 152], [x + 20, 156], [x + 10, 170]], { fill: OX, width: 1.5 });
  }
  const snow: Pt[] = [[-2, 96], [10, 66], [60, 54], [140, 48], [260, 44], [390, 40], [520, 44], [640, 48], [720, 54], [770, 66], [782, 96], [760, 104], [700, 92], [600, 96], [480, 90], [390, 96], [280, 90], [170, 96], [70, 92], [20, 104]];
  p.shape(snow, { fill: BONE, width: 5, shade: [{ pts: [[0, 80], [780, 80], [780, 110], [0, 110]], color: SAND }] });
  // A little bell tower on the ridge.
  p.rect(366, 4, 48, 42, { fill: RED_DARK, width: 4, r: 2 });
  p.ellipse(390, 26, 12, 13, { fill: GOLD, width: 3 });
  p.shape([[356, 10], [390, -4], [424, 10], [420, 16], [360, 16]], { fill: BONE, width: 4 });
  // The pass's sign: a red board with a bone border, hung on chains, a gold star either side.
  for (const cx of [278, 502]) p.line([[cx, 222], [cx, 230]], { width: 3, raw: true });
  p.rect(250, 228, 280, 56, { fill: RED, width: 5, r: 4, shade: [{ pts: [[250, 268], [530, 268], [530, 286], [250, 286]], color: RED_DARK }] });
  p.rect(258, 235, 264, 42, { stroke: BONE, width: 3, r: 2 });
  star(p, 238, 256, 14, GOLD);
  star(p, 542, 256, 14, GOLD);
  p.shape([[244, 228], [250, 218], [280, 214], [300, 222], [420, 220], [510, 214], [536, 222], [536, 230]], { fill: BONE, width: 3 });
  for (const [lx, ly] of PLAZAS.snow.portal.lamps) lantern(p, lx, 222, ly - 8, OX);
}
function snowFoot(p: P) {
  const g = FOOT.ground;
  p.rect(30, g - 26, 110, 80, { fill: TAN, width: 4.5, r: 3 });
  stones(p, 30, g - 26, 110, 80, 22, 36);
  p.shape([[6, g + 10], [12, g - 14], [40, g - 30], [70, g - 40], [100, g - 36], [140, g - 26], [162, g - 8], [166, g + 10]], { fill: BONE, width: 4.5, shade: [{ pts: [[90, g - 50], [170, g - 50], [170, g + 20], [90, g + 20]], color: SAND }] });
}
function snowBooth(p: P) {
  const G = BOOTH_GROUND;
  const B = BOOTH_H;
  // Stone base, then honey log walls with round log-ends at the corners.
  p.rect(64, G - 50, 214, B - G + 50, { fill: TAN, width: 4.5, r: 1 });
  stones(p, 64, G - 50, 214, B - G + 50, 24, 42);
  p.rect(74, 196, 194, G - 246, { fill: HONEY, width: 4.5, r: 1, shade: [{ pts: [[220, 190], [270, 190], [270, G], [222, G]], color: WOOD }] });
  for (let y = 212; y < G - 52; y += 20) {
    p.line([[78, y], [264, y]], { width: 2.4, color: WOOD, raw: true });
    for (const x of [72, 270]) p.ellipse(x, y - 9, 9, 9, { fill: SAND, width: 2.5 });
  }
  // The window, flanked by red shutters with hearts cut out, the keeper inside, a geranium box below.
  p.rect(116, 236, 92, 74, { fill: LIT, width: 5, r: 3, shade: [{ pts: [[116, 286], [208, 278], [208, 312], [116, 312]], color: LIT_DEEP }] });
  keeper(p, 160, 270, 308, 'beanie', PINE);
  p.line([[162, 238], [162, 308]], { width: 4, raw: true });
  p.line([[118, 270], [206, 270]], { width: 3, raw: true, opacity: 0.6 });
  p.rect(116, 236, 92, 74, { stroke: INK, width: 5, r: 3 });
  for (const x of [90, 210]) {
    p.rect(x, 232, 24, 82, { fill: RED, width: 4, r: 2 });
    for (let y = 242; y < 312; y += 14) p.line([[x + 3, y], [x + 21, y]], { width: 1.6, color: RED_DARK, raw: true });
    p.shape([[x + 12, 268], [x + 6, 262], [x + 8, 256], [x + 12, 259], [x + 16, 256], [x + 18, 262]], { fill: INK, width: 1.5 });
  }
  p.rect(108, 314, 108, 22, { fill: WOOD, width: 4, r: 2 });
  for (let k = 0; k < 6; k++) p.dot(118 + k * 18, 310, 8, k % 2 ? RED : EMBER);
  p.shape([[106, 318], [112, 306], [160, 302], [212, 306], [218, 318]], { fill: BONE, width: 3 });
  // The wide gable roof with deep eaves and a carved bargeboard, loaded with snow, icicles off the eaves.
  p.shape([[36, 206], [171, 96], [306, 206], [292, 214], [171, 116], [50, 214]], { fill: WOOD, raw: true, width: 5 });
  p.shape([[60, 200], [171, 112], [282, 200]], { fill: HONEY, raw: true, width: 4 });
  for (let k = 0; k < 6; k++) {
    const y = 128 + k * 13;
    const half = ((y - 112) / 88) * 111;
    p.line([[171 - half, y], [171 + half, y]], { width: 2, color: WOOD, raw: true });
  }
  p.ellipse(171, 168, 20, 20, { fill: BONE, width: 4 });
  p.line([[171, 168], [171, 154]], { width: 2.5, raw: true });
  p.line([[171, 168], [181, 172]], { width: 2.5, raw: true });
  p.shape([[164, 140], [171, 132], [178, 140], [171, 146]], { fill: RED, raw: true, width: 2 });
  p.shape([[26, 210], [40, 186], [120, 116], [171, 80], [222, 116], [302, 186], [316, 210], [300, 214], [222, 136], [171, 100], [120, 136], [42, 214]], { fill: BONE, width: 5, shade: [{ pts: [[171, 70], [330, 70], [330, 220], [171, 220]], color: SAND }] });
  for (let k = 0; k < 7; k++) {
    const x = 50 + k * 38;
    if (x > 150 && x < 200) continue;
    p.shape([[x, 214], [x + 8, 214], [x + 4, 230 + (k % 3) * 8]], { fill: BONE, raw: true, width: 2.2 });
  }
  // The lantern by the door, skis against the wall, and a drift at the foot.
  p.line([[268, 254], [278, 246], [278, 228]], { width: 3.5 });
  lantern(p, 266, 222, 244);
  for (const [x, c] of [[252, RED], [266, GOLD]] as const) p.shape([[x, G], [x - 8, G - 150], [x, G - 154], [x + 8, G]], { fill: c, raw: true, width: 3.5 });
  p.shape([[50, G + 6], [56, G - 14], [100, G - 24], [160, G - 18], [210, G - 22], [290, G - 12], [296, G + 6]], { fill: BONE, width: 4 });
  hingePost(p, G, RED, BONE, B - G, 'snow');
}

// ================================================================ coast: the bay bridge

function coastPortal(p: P) {
  const G = PORTAL_GROUND;
  const bottom = PORTAL_H;
  // Stepped deco pylons: bone, fluted in sea green, gold set-backs, a sunrise fan and a porthole lamp.
  for (const cx of [70, 710]) {
    p.rect(cx - 44, 260, 88, bottom - 260, { fill: BONE, width: 5, r: 2, shade: [{ pts: [[cx + 14, 250], [cx + 50, 250], [cx + 50, bottom], [cx + 16, bottom]], color: SAND }] });
    for (const dx of [-24, -8, 8, 24]) p.line([[cx + dx, 340], [cx + dx, G - 10]], { width: 4, color: SEA, raw: true });
    p.rect(cx - 52, 240, 104, 24, { fill: GOLD, width: 4.5, r: 1 });
    p.rect(cx - 36, 110, 72, 134, { fill: BONE, width: 5, r: 1 });
    p.rect(cx - 44, 96, 88, 18, { fill: GOLD, width: 4, r: 1 });
    p.rect(cx - 24, 46, 48, 54, { fill: BONE, width: 4.5, r: 1 });
    p.rect(cx - 30, 36, 60, 14, { fill: GOLD, width: 4, r: 1 });
    p.shape([[cx - 14, 36], [cx, 6], [cx + 14, 36]], { fill: SEA, raw: true, width: 3.5 });
    for (let k = 0; k < 7; k++) {
      const a0 = Math.PI + (k / 7) * Math.PI;
      const a1 = Math.PI + ((k + 1) / 7) * Math.PI;
      p.shape([[cx, 300], [cx + Math.cos(a0) * 34, 300 + Math.sin(a0) * 34], [cx + Math.cos(a1) * 34, 300 + Math.sin(a1) * 34]], { fill: k % 2 ? SEA : GOLD, raw: true, stroke: null });
    }
    p.shape(arc(cx, 300, 34, 34, Math.PI, Math.PI * 2, 14), { stroke: INK, raw: true, width: 3.5 });
    p.ellipse(cx, 70, 12, 12, { fill: LIT, width: 3.5 });
    // A life ring on each pylon.
    p.ellipse(cx, 470, 30, 30, { fill: RED, width: 4.5 });
    p.ellipse(cx, 470, 14, 14, { fill: BONE, width: 3.5 });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      p.line([[cx + Math.cos(a) * 15, 470 + Math.sin(a) * 15], [cx + Math.cos(a) * 29, 470 + Math.sin(a) * 29]], { width: 8, color: BONE, raw: true });
    }
  }
  // The central lighthouse tower rising out of the slab.
  p.rect(344, 70, 92, 104, { fill: BONE, width: 5, r: 1, shade: [{ pts: [[406, 60], [440, 60], [440, 180], [408, 180]], color: SAND }] });
  for (const dx of [-26, 0, 26]) p.line([[390 + dx, 80], [390 + dx, 170]], { width: 3.5, color: SEA, raw: true });
  p.rect(334, 60, 112, 14, { fill: GOLD, width: 4, r: 1 });
  p.rect(360, 24, 60, 40, { fill: LIT, width: 4.5, r: 2 });
  for (const x of [380, 400]) p.line([[x, 26], [x, 62]], { width: 2.5, raw: true });
  p.shape([[354, 26], [362, 8], [390, 0], [418, 8], [426, 26]], { fill: RED, raw: true, width: 4 });
  // The long slab: rounded ends, sea green, three bone speed stripes, gold edge, portholes underneath.
  p.rect(12, 162, 756, 76, { fill: PINE, width: 6, r: 38, shade: [{ pts: [[0, 220], [780, 220], [780, 240], [0, 240]], color: INK }] });
  for (const [y, w] of [[176, 4], [186, 4], [222, 4]] as const) p.line([[44, y], [736, y]], { width: w, color: BONE, raw: true });
  p.line([[30, 232], [750, 232]], { width: 3, color: GOLD, raw: true });
  p.rect(200, 172, 380, 48, { fill: BONE, width: 4.5, r: 24 });
  star(p, 226, 196, 12, GOLD, 2.5);
  star(p, 554, 196, 12, GOLD, 2.5);
  for (const [lx] of PLAZAS.coast.portal.lamps) {
    p.ellipse(lx, 244, 18, 10, { fill: GOLD_DARK, width: 3.5 });
    p.ellipse(lx, 244, 11, 6, { fill: LIT, stroke: null });
  }
  // Gulls perched on the pylons.
  for (const [gx, gy, flip] of [[52, 34, 1], [728, 34, -1]] as const) {
    p.ellipse(gx, gy, 16, 9, { fill: BONE, width: 3 });
    p.ellipse(gx + flip * 12, gy - 8, 7, 7, { fill: BONE, width: 3 });
    p.shape([[gx + flip * 18, gy - 9], [gx + flip * 28, gy - 7], [gx + flip * 18, gy - 5]], { fill: GOLD, raw: true, width: 2 });
    p.shape([[gx - flip * 4, gy - 4], [gx - flip * 22, gy - 2], [gx - flip * 4, gy + 6]], { fill: SAND, raw: true, width: 2 });
  }
}
function coastFoot(p: P) {
  const g = FOOT.ground;
  p.rect(22, g - 12, 126, 70, { fill: SAND, width: 4.5, r: 2 });
  p.rect(32, g - 32, 106, 24, { fill: BONE, width: 4.5, r: 2 });
  p.rect(22, g - 14, 126, 8, { fill: GOLD, width: 3, r: 1 });
  for (let x = 40; x < 140; x += 20) p.line([[x, g - 2], [x, g + 50]], { width: 2.4, color: TAN, raw: true });
}
function coastBooth(p: P) {
  const G = BOOTH_GROUND;
  const B = BOOTH_H;
  // A sea-green plinth with a gold band running into the ground.
  p.rect(66, G - 36, 216, B - G + 36, { fill: PINE, width: 4.5, r: 2 });
  p.rect(66, G - 40, 216, 10, { fill: GOLD, width: 3, r: 1 });
  // The streamline body: a bone pill with rounded ends, speed stripes wrapping its right end.
  p.rect(70, 176, 206, G - 214, { fill: BONE, width: 5, r: 36, shade: [{ pts: [[232, 170], [290, 170], [290, G], [234, G]], color: SAND }] });
  for (const y of [326, 340, 354]) p.line([[78, y], [270, y]], { width: 4, color: SEA, raw: true });
  // The window band with round ends, the keeper in a sailor's cap.
  p.rect(92, 206, 140, 98, { fill: LIT, width: 5, r: 26, shade: [{ pts: [[92, 270], [232, 262], [232, 306], [92, 306]], color: LIT_DEEP }] });
  keeper(p, 161, 256, 302, 'sailor', SEA);
  p.line([[96, 230], [228, 230]], { width: 3, raw: true, opacity: 0.5 });
  p.rect(92, 206, 140, 98, { stroke: INK, width: 5, r: 26 });
  p.line([[104, 216], [130, 216], [104, 242]], { width: 3, color: '#FFFFFF', raw: true, opacity: 0.5 });
  for (let k = 0; k < 8; k++) p.shape([[86 + k * 19, 190], [105 + k * 19, 190], [103 + k * 19, 208], [88 + k * 19, 208]], { fill: k % 2 ? BONE : SEA, raw: true, width: 2.5 });
  for (let k = 0; k < 8; k++) p.ellipse(95.5 + k * 19, 209, 9.5, 5, { fill: k % 2 ? BONE : SEA, width: 2.2 });
  // A porthole by the window, and the ticket slot.
  p.ellipse(256, 250, 16, 16, { fill: LIT_DEEP, width: 4.5 });
  p.ellipse(256, 250, 21, 21, { stroke: GOLD, width: 3 });
  p.rect(110, 364, 40, 10, { fill: INK, r: 2, stroke: null });
  // The roof slab with a rounded nose, the deco fin and its lamp, a gold star on top.
  p.rect(58, 160, 230, 22, { fill: PINE, width: 4.5, r: 11 });
  p.line([[70, 170], [276, 170]], { width: 2.5, color: BONE, raw: true });
  p.shape([[138, 160], [138, 128], [146, 128], [146, 112], [184, 112], [184, 128], [192, 128], [192, 160]], { fill: BONE, raw: true, width: 4.5 });
  for (const x of [154, 165, 176]) p.line([[x, 116], [x, 158]], { width: 2.5, color: SEA, raw: true });
  p.rect(148, 82, 34, 30, { fill: LIT, width: 4, r: 3 });
  p.shape([[144, 84], [165, 64], [186, 84]], { fill: RED, raw: true, width: 3.5 });
  star(p, 165, 54, 10, GOLD, 2.5);
  // A gull on the roof, a bollard with a rope coil, an anchor by the door.
  p.ellipse(92, 148, 15, 9, { fill: BONE, width: 3 });
  p.ellipse(82, 140, 7, 7, { fill: BONE, width: 3 });
  p.shape([[76, 140], [66, 142], [76, 144]], { fill: GOLD, raw: true, width: 2 });
  p.line([[92, 156], [90, 162]], { width: 2.5, color: GOLD, raw: true });
  p.rect(246, G - 54, 30, 54, { fill: INK, width: 3.5, r: 6 });
  p.ellipse(261, G - 56, 19, 8, { fill: INK, width: 3 });
  for (let k = 0; k < 3; k++) p.ellipse(261, G - 30 + k * 2, 22 - k * 3, 7, { stroke: HONEY, width: 4 });
  p.line([[200, 380], [200, 404]], { width: 4, raw: true });
  p.line(arc(200, 396, 16, 10, 0, Math.PI, 8), { width: 4, raw: true });
  p.line([[190, 384], [210, 384]], { width: 4, raw: true });
  hingePost(p, G, SEA, BONE, B - G, 'deco');
}

// ================================================================ the traffic light before the barrier

/** The signal head on its post; the game lights the lamps at 20 and 54 below the art's top. */
export const TOLL_LIGHT = { w: 64, h: 380, ground: 304 };
function tollLightArt(): Art {
  const p = pen('toll_light');
  const { w, h, ground } = TOLL_LIGHT;
  p.rect(24, 70, 16, h - 70, { fill: BONE, width: 4, r: 3 });
  for (let y = ground - 60; y < ground; y += 24) p.rect(24, y, 16, 12, { fill: INK, stroke: null, r: 0 });
  p.rect(8, -4 + 2, 48, 76, { fill: INK, width: 4, r: 8 });
  for (const ly of [20, 54]) {
    p.ellipse(32, ly, 13, 13, { fill: '#2A1420', width: 2.5 });
    p.shape([[16, ly - 8], [48, ly - 8], [44, ly - 18], [20, ly - 18]], { fill: INK, raw: true, width: 2.5 });
  }
  return { key: 'toll_light', svg: p.svg(w, h), w, h };
}

// ================================================================ registration

const portals: Record<TollSkin, (p: P) => void> = { meadow: meadowPortal, autumn: autumnPortal, snow: snowPortal, coast: coastPortal };
const feet: Record<TollSkin, (p: P) => void> = { meadow: meadowFoot, autumn: autumnFoot, snow: snowFoot, coast: coastFoot };
const booths: Record<TollSkin, (p: P) => void> = { meadow: meadowBooth, autumn: autumnBooth, snow: snowBooth, coast: coastBooth };

export const tollKeys = (skin: TollSkin) => ({ portal: `toll_canopy_${skin}`, foot: `toll_foot_${skin}`, booth: `toll_booth_${skin}` });

export function tollArts(): Art[] {
  const out: Art[] = [tollLightArt()];
  for (const skin of Object.keys(TOLL_SKINS) as TollSkin[]) {
    const k = tollKeys(skin);
    const { portal, foot, booth } = PLAZAS[skin];
    const a = pen(k.portal);
    portals[skin](a);
    out.push({ key: k.portal, svg: a.svg(portal.w, portal.h), w: portal.w, h: portal.h });
    const f = pen(k.foot);
    feet[skin](f);
    out.push({ key: k.foot, svg: f.svg(foot.w, foot.h), w: foot.w, h: foot.h });
    const b = pen(k.booth);
    booths[skin](b);
    out.push({ key: k.booth, svg: b.svg(booth.w, booth.h), w: booth.w, h: booth.h });
  }
  return out;
}
