import Phaser from 'phaser';
import { pen, type Art } from './art';
import type { Pt } from './ink';
import type { BiomeKey } from './legs';
import { P, clump, rng, type Palette } from './trees';
import { H, W } from './terrain';

/**
 * How one place turns into the next: through a road tunnel.
 *
 * Fading one landscape into another looks like a slideshow. Side-scrolling games hide the change behind
 * something the player passes through. Here the road runs up to a steep, faceted cliff dressed as the place
 * you are leaving, into a portal (a concrete headwall with a horseshoe arch, wing walls and a guard rail,
 * lamps receding inside), through a sodium-lit bore, and out of a cliff dressed as the place you arrive in.
 *
 * Inside, the screen is framed the way good 2D interiors are: a near-black ceiling across the top and a
 * near-black floor along the bottom, in front of everything, around a lit strip of tiled wall with pools of
 * amber light, jet fans, exit signs and reflectors. Everything under the frame is washed amber. While the
 * frame covers the whole screen, the scenery behind it is swapped.
 */

export const TUNNEL = { from: 3600, to: 6800 };
export const SWITCH = (TUNNEL.from + TUNNEL.to) / 2;

/** The mouth picture: the cliff and its portal, with the road at `road` and the arch's middle at `portal`. */
const MOUTH = { w: 2100, h: 1700, road: 1640, portal: 1760 };
/** The portal: its arch and the headwall around it. */
const ARCH = { w: 400, h: 330 };
const HEAD = { w: 600, h: 470 };
/** The bore's height inside, from the road to the ceiling. */
const BORE = 330;
/** The portal seen from the side: how thick its headwall is, and how far its hood reaches out over the road. */
const COLLAR = 70;
const HOOD = 190;

interface Dress {
  /** The cliff's rock: lit faces, middle faces, faces in shade. */
  rock: [string, string, string];
  /** What grows on top, and the turf or snow it grows in. */
  trees: Palette[] | 'pines' | 'none';
  turf: string;
  snow?: boolean;
  /** The headwall. */
  head: [string, string];
}

const DRESS: Record<BiomeKey, Dress> = {
  meadow: { rock: ['#B9B4C6', '#8E8AA2', '#62607A'], trees: [P.oak, P.oakDeep, P.oak], turf: '#6FA97C', head: ['#D8D2C4', '#A8A094'] },
  autumn: { rock: ['#D2A88E', '#A47C6A', '#6E4E4C'], trees: [P.red, P.gold, P.rust], turf: '#C29A4E', head: ['#D8CCBA', '#A89A88'] },
  snow: { rock: ['#A6B4CE', '#74829E', '#4A5672'], trees: 'pines', turf: '#F4F8FF', snow: true, head: ['#C9CED8', '#8E96A8'] },
  town: { rock: ['#A4A8B6', '#7A7E8E', '#525666'], trees: 'none', turf: '#7E8496', head: ['#C4C8D2', '#8E92A0'] },
  coast: { rock: ['#E8C69C', '#C29A72', '#8E6A52'], trees: [P.sea, P.sea, P.oakDeep], turf: '#9CB86A', head: ['#E4DCCC', '#B4AA98'] },
};

export const mouthKey = (biome: BiomeKey) => `tunnel_mouth_${biome}`;

/** A pine, in three tiers, with snow on each if it is snowing. */
function pine(p: ReturnType<typeof pen>, x: number, y: number, s: number, snow: boolean) {
  p.rect(x - 5 * s, y - 20 * s, 10 * s, 24 * s, { fill: '#4A3438', width: 2.5, r: 2 });
  for (let t = 0; t < 3; t++) {
    const ty = y - 14 * s - t * 36 * s;
    const tw = (46 - t * 11) * s;
    p.shape([[x, ty - 60 * s], [x + tw, ty], [x - tw, ty]], { fill: snow ? '#24405A' : '#2E6A56', raw: true, width: 3, shade: [{ pts: [[x, ty - 70 * s], [x + tw + 4, ty - 70 * s], [x + tw + 4, ty + 4], [x, ty + 4]], color: snow ? '#183048' : '#1F4A40' }] });
    if (snow) p.shape([[x, ty - 60 * s], [x + tw * 0.55, ty - 28 * s], [x + tw * 0.2, ty - 32 * s], [x - tw * 0.55, ty - 26 * s]], { fill: '#F4F8FF', raw: true, width: 2.4 });
  }
}

/**
 * A tunnel mouth, drawn as the entrance: the cliff rising from the left, the portal on the right. The exit is
 * the same picture flipped.
 */
export function tunnelMouthArt(biome: BiomeKey): Art {
  const d = DRESS[biome];
  const key = mouthKey(biome);
  const { w, h, road, portal } = MOUTH;
  const p = pen(key);
  const r = rng(biome.length * 131 + 7);
  const [lit, mid, dark] = d.rock;

  // The cliff's skyline: low rocks at first, then terraces climbing steeply to off the top of the screen
  // just before the portal. Each terrace is a ledge something can grow on.
  const ledges: Pt[] = [
    [0, road + 10],
    [180, road - 40],
    [320, road - 70],
    [420, road - 220],
    [600, road - 250],
    [700, road - 470],
    [880, road - 500],
    [980, road - 760],
    [1160, road - 800],
    [1260, road - 1120],
    [1420, road - 1160],
    [1500, -60],
    [w, -60],
  ];
  const top = (x: number) => {
    for (let i = 1; i < ledges.length; i++) {
      const [ax, ay] = ledges[i - 1];
      const [bx, by] = ledges[i];
      if (x <= bx) return ay + ((by - ay) * (x - ax)) / Math.max(1, bx - ax);
    }
    return -60;
  };
  // The body of the cliff, then broken into facets: a jittered grid of triangles, each shaded as a plane
  // turned towards or away from the light (from the upper left), the way stylised rock is painted.
  p.shape([...ledges, [w, h], [0, h]], { fill: mid, raw: true, width: 4.5, wobble: 0.3 });
  const gx = 120;
  const gy = 130;
  const cols = Math.ceil(w / gx) + 1;
  const rows = Math.ceil(h / gy) + 1;
  const vtx: Pt[][] = [];
  for (let i = 0; i <= cols; i++) {
    vtx.push([]);
    for (let j = 0; j <= rows; j++) {
      const x = i * gx + (i && i < cols ? (r() - 0.5) * gx * 0.7 : 0);
      const y = j * gy + (r() - 0.5) * gy * 0.6;
      vtx[i].push([x, Math.min(h, Math.max(y, top(x) + 4))]);
    }
  }
  const area = (a: Pt, b: Pt, c: Pt) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const q = [vtx[i][j], vtx[i + 1][j], vtx[i + 1][j + 1], vtx[i][j + 1]];
      for (const tri of [
        [q[0], q[1], q[2]],
        [q[0], q[2], q[3]],
      ]) {
        if (area(tri[0], tri[1], tri[2]) < 300) continue;
        const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
        if (cy > road - 10 && cx > portal - HEAD.w / 2 - 40) continue;
        // Planes near the top catch the light; lower down and to the right, more fall into shade.
        const nearTop = cy - top(cx) < 160;
        const k = r() + (nearTop ? 0.35 : 0) - (cy / h) * 0.3;
        const fill = k > 0.8 ? lit : k < 0.25 ? dark : mid;
        if (fill === mid && r() < 0.5) continue;
        p.shape(tri, { fill, raw: true, width: 2, wobble: 0.2, stroke: dark });
      }
    }
  }
  // The skyline edge, drawn again over the facets so it stays crisp.
  p.line(ledges.slice(0, -1), { width: 5, raw: true, wobble: 0.3 });
  // Turf (or snow) on each ledge, and things growing on it.
  for (let i = 1; i < ledges.length - 2; i += 2) {
    const [ax, ay] = ledges[i];
    const [bx, by] = ledges[i + 1];
    p.shape(
      [
        [ax - 10, ay + 2],
        [bx + 6, by + 2],
        [bx + 2, by + 24],
        [ax - 6, ay + 22],
      ],
      { fill: d.turf, raw: true, width: 3, wobble: 0.8 },
    );
    for (let x = ax + 20; x < bx - 10; x += 56 + r() * 40) {
      const y = ay + ((by - ay) * (x - ax)) / (bx - ax) + 6;
      if (d.trees === 'pines') pine(p, x, y, 0.9 + r() * 0.6, !!d.snow);
      else if (d.trees !== 'none') {
        const pal = d.trees[Math.floor(r() * d.trees.length)];
        if (r() < 0.5) {
          p.rect(x - 6, y - 70, 12, 76, { fill: '#5A3E3A', width: 3, r: 3 });
          clump(p, x - 28, y - 86, 44, 36, pal, r);
          clump(p, x + 28, y - 80, 42, 34, pal, r);
          clump(p, x, y - 118, 50, 40, pal, r);
        } else clump(p, x, y - 16, 40 + r() * 16, 28 + r() * 8, pal, r);
      } else if (r() < 0.6) {
        // In town: a lamp post or a fence on each terrace.
        p.rect(x - 3, y - 110, 6, 112, { fill: '#3A3E4A', stroke: null, r: 2 });
        p.rect(x - 14, y - 116, 28, 8, { fill: '#E8E2B0', width: 2, r: 3 });
      }
    }
  }
  // Snow lying on the ledges and along the skyline.
  if (d.snow) for (let i = 1; i < ledges.length - 2; i++) p.line([ledges[i], ledges[i + 1]], { width: 10, color: '#F4F8FF', raw: true });

  // The guard rail along the road up to the portal.
  const railY = road - 46;
  p.line([[200, railY], [portal - 760, railY]], { width: 7, color: '#C9CED8', raw: true, wobble: 0 });
  for (let x = 220; x < portal - 760; x += 70) p.rect(x - 4, railY - 4, 8, 50, { fill: '#8E96A8', width: 2.4, r: 1 });

  // The cutting: the road runs into the hill between concrete retaining walls. This is the far one,
  // rising as the hill does, with panel joints and weep holes.
  const [headLit, headShade] = d.head;
  const wallTop = (x: number) => road - 40 - Math.min(1, Math.max(0, (x - (portal - 700)) / 600)) * 200;
  const wallPts: Pt[] = [];
  for (let x = portal - 760; x <= w; x += 20) wallPts.push([x, wallTop(x)]);
  p.shape([...wallPts, [w, road + 6], [portal - 760, road + 6]], { fill: headLit, raw: true, width: 4, shade: [{ pts: [[portal - 800, road - 40], [w, road - 40], [w, road + 10], [portal - 800, road + 10]], color: headShade }] });
  p.line(wallPts, { width: 8, color: headShade, raw: true, wobble: 0 });
  for (let x = portal - 680; x < w; x += 120) {
    p.line([[x, wallTop(x) + 6], [x, road]], { width: 2, color: headShade, raw: true });
    if (wallTop(x) < road - 120) p.ellipse(x + 60, road - 70, 6, 6, { fill: '#2A2A34', stroke: null });
  }
  if (d.snow) p.line(wallPts.map(([x, y]): Pt => [x, y - 4]), { width: 10, color: '#F4F8FF', raw: true });
  return { key, svg: p.svg(w, h), w, h };
}

/**
 * A tunnel portal seen from the side, as the player sees it: the headwall's thickness standing over the road
 * (dir 1: the tunnel goes off to the right), a hood reaching out over the road towards the approaching truck,
 * a name plate, and, before it, a traffic light and a height-limit sign. Drawn in front of the truck, so the
 * truck goes in under it.
 */
function portalInProfile(scene: Phaser.Scene, x: number, dir: 1 | -1, groundY: (x: number) => number, d: Dress, name: string, depth: number) {
  const g = scene.add.graphics().setDepth(depth);
  const toInt = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;
  const [lit, shade] = d.head.map(toInt);
  const cy = groundY(x) - BORE;
  const X = (dx: number) => x + dir * dx;
  const poly = (pts: [number, number][], fill: number) => {
    const v = pts.map(([px, py]) => new Phaser.Math.Vector2(px, py));
    g.fillStyle(fill, 1);
    g.fillPoints(v, true);
    g.lineStyle(4, 0x2a2140, 1);
    g.strokePoints(v, true);
  };
  // The headwall's thickness, from the hood up into the hill.
  poly(
    [
      [X(0), cy - 210],
      [X(COLLAR), cy - 230],
      [X(COLLAR), cy + 20],
      [X(0), cy + 20],
    ],
    lit,
  );
  // The hood: a sloped canopy reaching out over the road, its underside in shade.
  poly(
    [
      [X(0), cy - 120],
      [X(-HOOD), cy - 34],
      [X(-HOOD), cy + 10],
      [X(0), cy + 22],
    ],
    lit,
  );
  poly(
    [
      [X(-HOOD), cy + 10],
      [X(0), cy + 22],
      [X(COLLAR), cy + 22],
      [X(COLLAR), cy + 36],
      [X(-HOOD), cy + 24],
    ],
    shade,
  );
  // Panel joints along the hood.
  g.lineStyle(2, shade, 1);
  for (const k of [0.33, 0.66]) g.lineBetween(X(-HOOD * k), cy - 34 - (1 - k) * 86 + 8, X(-HOOD * k), cy + 14);
  // Snow on the hood, and ice hanging off its edge.
  if (d.snow) {
    poly(
      [
        [X(4), cy - 128],
        [X(-HOOD - 8), cy - 40],
        [X(-HOOD - 6), cy - 26],
        [X(0), cy - 108],
      ],
      0xf4f8ff,
    );
    for (let k = 0; k < 7; k++) {
      const ix = X(-HOOD + 10 + k * 26);
      g.fillStyle(0xe8f4ff, 1);
      g.fillTriangle(ix - 5, cy + 24, ix + 5, cy + 24, ix, cy + 44 + ((k * 37) % 20));
    }
  }
  // The name plate, on the headwall above the hood.
  // The tunnel's name, lettered along the hood's side.
  const slope = Math.atan2(86, HOOD) * -dir;
  scene.add
    .text(X(-HOOD / 2 + 6), cy - 36, name, { fontFamily: 'Karla', fontSize: '15px', fontStyle: 'bold', color: '#3A3448' })
    .setOrigin(0.5)
    .setRotation(slope)
    .setDepth(depth + 0.02);
  // Before the portal: a traffic light (green: in you go) and a height-limit sign, behind the road.
  const px = X(-HOOD - 160);
  const py = groundY(px);
  scene.add.rectangle(px, py, 10, 300, 0x3a3e4a).setOrigin(0.5, 1).setDepth(-5.2).setStrokeStyle(2, 0x2a2140);
  scene.add.rectangle(px, py - 300, 40, 104, 0x1e1a24).setOrigin(0.5, 0).setDepth(-5.2).setStrokeStyle(3, 0x2a2140);
  [0x5a2020, 0x5a4a20, 0x3aff8a].forEach((c, k) => scene.add.circle(px, py - 282 + k * 32, 11, c).setDepth(-5.19));
  scene.add.image(px, py - 218, 'halo').setDepth(-5.18).setDisplaySize(90, 90).setTint(0x3aff8a).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
  scene.add.circle(px + dir * -70, py - 200, 30, 0xffffff).setDepth(-5.2).setStrokeStyle(8, 0xd83a3a);
  scene.add.text(px + dir * -70, py - 200, '3.8m', { fontFamily: 'Karla', fontSize: '17px', fontStyle: 'bold', color: '#1a1620' }).setOrigin(0.5).setDepth(-5.19);
  scene.add.rectangle(px + dir * -70, py, 6, 170, 0x3a3e4a).setOrigin(0.5, 1).setDepth(-5.21);
}

export interface Tunnel {
  /** 0 outside, 1 deep inside: how much of the screen the tunnel fills. */
  inside(cameraMid: number): number;
  update(time: number, scrollX: number): void;
}

const NAMES: Partial<Record<BiomeKey, string>> = { meadow: 'OLD HILL TUNNEL', autumn: 'MAPLE TUNNEL', snow: 'FROSTPEAK TUNNEL', town: 'CITY TUNNEL', coast: 'SEAVIEW TUNNEL' };

/**
 * Builds the tunnel on the road: the entrance cliff dressed as `from`, the bore, and the exit cliff dressed
 * as `to`.
 */
export function buildTunnel(scene: Phaser.Scene, from: BiomeKey, to: BiomeKey, groundY: (x: number) => number): Tunnel {
  const { from: x0, to: x1 } = TUNNEL;
  // Behind everything at the roadside (trees, lamps, signs, gates), in front of the scenery behind it.
  const mouthDepth = -9.6;
  const wallDepth = -5.5;
  const frameDepth = 59.4;
  // The mouths: the arch's middle at each end of the tunnel.
  scene.add.image(x0 - MOUTH.portal, groundY(x0) + (MOUTH.h - MOUTH.road), mouthKey(from)).setOrigin(0, 1).setDepth(mouthDepth);
  scene.add.image(x1 + MOUTH.portal - MOUTH.w, groundY(x1) + (MOUTH.h - MOUTH.road), mouthKey(to)).setOrigin(0, 1).setDepth(mouthDepth).setFlipX(true);
  // Inside starts behind each portal's headwall.
  const a = x0 + COLLAR;
  const b = x1 - COLLAR;
  const step = 40;
  const line = (f: (x: number) => number, x0_ = a, x1_ = b) => {
    const out: Phaser.Math.Vector2[] = [];
    for (let x = x0_; x <= x1_; x += step) out.push(new Phaser.Math.Vector2(x, f(x)));
    out.push(new Phaser.Math.Vector2(x1_, f(x1_)));
    return out;
  };
  const ceiling = (x: number) => groundY(x) - BORE;
  const g = scene.add.graphics().setDepth(wallDepth);
  // The back wall: dark concrete above, a band of pale tiles below with a coloured stripe, a kerb at the foot.
  g.fillStyle(0x3a302e, 1);
  g.fillPoints([...line((x) => ceiling(x) - 40), ...line((x) => groundY(x) + 6).reverse()], true);
  const tileTop = (x: number) => groundY(x) - 200;
  g.fillStyle(0xd8c8a8, 1);
  g.fillPoints([...line(tileTop), ...line((x) => groundY(x) - 34).reverse()], true);
  g.lineStyle(1.5, 0xb8a888, 1);
  for (let k = 1; k < 6; k++) {
    g.beginPath();
    line((x) => tileTop(x) + k * 28).forEach((v, i) => (i ? g.lineTo(v.x, v.y) : g.moveTo(v.x, v.y)));
    g.strokePath();
  }
  for (let x = a + 20; x < b; x += 36) g.lineBetween(x, tileTop(x), x, groundY(x) - 34);
  const stripe = from === 'town' || to === 'town' ? 0x2e6ad8 : 0x2e8a6a;
  g.fillStyle(stripe, 1);
  g.fillPoints([...line((x) => tileTop(x) - 16), ...line(tileTop).reverse()], true);
  g.fillStyle(0x6a6060, 1);
  g.fillPoints([...line((x) => groundY(x) - 34), ...line((x) => groundY(x) + 6).reverse()], true);
  // Panel joints in the upper wall, and a cable tray.
  g.lineStyle(2, 0x2a2224, 1);
  for (let x = a + 100; x < b; x += 200) g.lineBetween(x, ceiling(x) - 40, x, tileTop(x) - 16);
  g.lineStyle(5, 0x1e1818, 1);
  g.beginPath();
  line((x) => ceiling(x) + 30).forEach((v, i) => (i ? g.lineTo(v.x, v.y) : g.moveTo(v.x, v.y)));
  g.strokePath();
  // Exit doors with green signs, and amber reflectors along the kerb.
  for (let x = a + 600; x < b - 300; x += 1000) {
    scene.add.rectangle(x, groundY(x) - 34, 64, 120, 0x2e4a3a).setOrigin(0.5, 1).setDepth(wallDepth + 0.05).setStrokeStyle(3, 0x141018);
    scene.add.rectangle(x, groundY(x) - 172, 74, 26, 0x2fbf6a).setDepth(wallDepth + 0.05).setStrokeStyle(2, 0x141018);
    scene.add.text(x, groundY(x) - 172, 'EXIT', { fontFamily: 'Karla', fontSize: '17px', fontStyle: 'bold', color: '#FFFFFF' }).setOrigin(0.5).setDepth(wallDepth + 0.06);
    scene.add.image(x, groundY(x) - 172, 'halo').setDepth(58.6).setDisplaySize(150, 70).setTint(0x2fbf6a).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD);
  }
  for (let x = a + 40; x < b; x += 100) {
    scene.add.circle(x, groundY(x) - 20, 4, 0xffb030).setDepth(wallDepth + 0.05);
    scene.add.image(x, groundY(x) - 20, 'halo').setDepth(58.6).setDisplaySize(24, 24).setTint(0xffb030).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD);
  }

  // The frame: the ceiling across the top of the screen and the floor along the bottom, near-black, in
  // front of everything but the dashboard. Each begins at its headwall with a concrete lip.
  const frame = scene.add.graphics().setDepth(frameDepth);
  const dim = (c: string, k: number) => Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.HexStringToColor(c), Phaser.Display.Color.HexStringToColor('#0E0A12'), 100, k * 100);
  const hex = (o: { r: number; g: number; b: number }) => (o.r << 16) | (o.g << 8) | o.b;
  for (const [l, r_, biome] of [
    [a, SWITCH, from],
    [SWITCH, b, to],
  ] as const) {
    frame.fillStyle(hex(dim(DRESS[biome].rock[2], 0.62)), 1);
    frame.fillPoints([new Phaser.Math.Vector2(l, -1400), new Phaser.Math.Vector2(r_, -1400), ...line(ceiling, l, r_).reverse()], true);
    // Facets of rock, a shade lighter and darker, so it reads as the hill cut through.
    const rr = rng(Math.round(l));
    for (let x = l; x < r_; x += 110) {
      for (let y = ceiling(x) - 60; y > -200; y -= 120) {
        const pts = [new Phaser.Math.Vector2(x + rr() * 40, y), new Phaser.Math.Vector2(x + 90 + rr() * 40, y - 30 - rr() * 60), new Phaser.Math.Vector2(x + 40 + rr() * 60, y - 110)];
        if (pts.some((v) => v.x > r_ || v.x < l)) continue;
        frame.fillStyle(hex(dim(DRESS[biome].rock[rr() < 0.5 ? 1 : 2], rr() < 0.5 ? 0.55 : 0.7)), 1);
        frame.fillTriangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y);
      }
    }
  }
  for (const [x, dir, biome] of [
    [a, 1, from],
    [b, -1, to],
  ] as const) {
    const cy = ceiling(x);
    const edge = [new Phaser.Math.Vector2(x, cy - 230), new Phaser.Math.Vector2(x - dir * 230, cy - 470), new Phaser.Math.Vector2(x - dir * 330, cy - 760), new Phaser.Math.Vector2(x - dir * 420, -1400)];
    frame.fillStyle(hex(dim(DRESS[biome].rock[2], 0.62)), 1);
    frame.fillPoints([...edge, new Phaser.Math.Vector2(x + dir * 2, -1400), new Phaser.Math.Vector2(x + dir * 2, cy)], true);
    frame.lineStyle(14, Phaser.Display.Color.HexStringToColor(DRESS[biome].turf).color, 1);
    frame.strokePoints(edge, false);
    frame.lineStyle(4, 0x2a2140, 1);
    frame.strokePoints(edge.map((v) => new Phaser.Math.Vector2(v.x - dir * 7, v.y)), false);
  }
  frame.fillStyle(0x15111a, 1);
  // The floor sits in front of the near grass strip too.
  const floor = scene.add.graphics().setDepth(61);
  floor.fillStyle(0x15111a, 1);
  floor.fillPoints([...line((x) => groundY(x) + 34), new Phaser.Math.Vector2(b, H + 600), new Phaser.Math.Vector2(a, H + 600)], true);
  // Faint panel lines in the ceiling, so it reads as concrete overhead rather than a black bar.
  frame.lineStyle(2, 0x221c28, 1);
  for (let k = 1; k < 8; k++) {
    frame.beginPath();
    line((x) => ceiling(x) - k * 70).forEach((v, i) => (i ? frame.lineTo(v.x, v.y) : frame.moveTo(v.x, v.y)));
    frame.strokePath();
  }
  for (let x = a + 130; x < b; x += 260) frame.lineBetween(x, ceiling(x) - 560, x, ceiling(x));
  // The lips at each end, and the ceiling's lit edge.
  for (const [x, dir, biome] of [
    [x0, 1, from],
    [x1, -1, to],
  ] as const) {
    portalInProfile(scene, x, dir, groundY, DRESS[biome], NAMES[biome] ?? 'TUNNEL', frameDepth + 0.05);
    // The floor's edge under the headwall.
    floor.fillStyle(0x15111a, 1);
    floor.fillRect(Math.min(x, x + dir * COLLAR), groundY(x) + 34, COLLAR, H + 600);
  }
  frame.lineStyle(4, 0x3a3240, 1);
  frame.beginPath();
  line(ceiling).forEach((v, i) => (i ? frame.lineTo(v.x, v.y) : frame.moveTo(v.x, v.y)));
  frame.strokePath();
  // The kerb's edge along the floor, catching the lamplight.
  floor.lineStyle(3, 0x8a6a3a, 1);
  floor.beginPath();
  line((x) => groundY(x) + 34).forEach((v, i) => (i ? floor.lineTo(v.x, v.y) : floor.moveTo(v.x, v.y)));
  floor.strokePath();
  // Lane signals hanging from the ceiling: a green arrow pointing down at the lane.
  for (let x = a + 900; x < b - 300; x += 1200) {
    frame.fillStyle(0x0e0b12, 1);
    frame.fillRect(x - 3, ceiling(x) - 2, 6, 30);
    frame.fillStyle(0x221c28, 1);
    frame.fillRoundedRect(x - 26, ceiling(x) + 26, 52, 44, 6);
    scene.add.triangle(x, ceiling(x) + 40, -12, -8, 12, -8, 0, 10, 0x3aff8a).setDepth(frameDepth + 0.01);
    scene.add.image(x, ceiling(x) + 44, 'halo').setDepth(frameDepth + 0.02).setDisplaySize(90, 70).setTint(0x3aff8a).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
  }
  // Jet fans hanging from the ceiling.
  for (let x = a + 500; x < b - 300; x += 1200) {
    for (const dx of [-70, 70]) {
      frame.fillStyle(0x15111a, 1);
      frame.fillRect(x + dx - 6, ceiling(x) - 2, 12, 26);
      frame.fillStyle(0x2a2430, 1);
      frame.fillRoundedRect(x + dx - 56, ceiling(x) + 22, 112, 44, 16);
      frame.lineStyle(3, 0x0e0b12, 1);
      frame.strokeRoundedRect(x + dx - 56, ceiling(x) + 22, 112, 44, 16);
    }
  }
  // Lamps along the ceiling: a lit strip, a hot glow, a soft pool of light on the wall, and a wide pool
  // over the road that lights the truck as it passes underneath.
  const warm = from === 'town' || to === 'town' ? 0xd8ecff : 0xffb24a;
  const glows: Phaser.GameObjects.Image[] = [];
  for (let x = a + 120; x < b - 60; x += 260) {
    frame.fillStyle(0x0e0b12, 1);
    frame.fillRect(x - 40, ceiling(x) - 2, 80, 12);
    scene.add.rectangle(x, ceiling(x) + 10, 64, 5, warm).setDepth(frameDepth + 0.01);
    scene.add.image(x, ceiling(x) + BORE * 0.45, 'halo').setDepth(wallDepth + 0.04).setDisplaySize(300, BORE * 1.1).setTint(warm).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    glows.push(scene.add.image(x, ceiling(x) + 12, 'halo').setDepth(frameDepth + 0.02).setDisplaySize(220, 110).setTint(warm).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD));
    glows.push(scene.add.image(x, groundY(x) - 120, 'halo').setDepth(58.6).setDisplaySize(380, 280).setTint(warm).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD));
  }
  // The amber cast over everything under the frame (the truck too), stronger the further in you are.
  const amber = scene.add.rectangle(0, 0, W, H, warm === 0xffb24a ? 0xd89a5a : 0x9ab0d8, 1).setOrigin(0).setScrollFactor(0).setDepth(58.5).setBlendMode(Phaser.BlendModes.MULTIPLY).setAlpha(0);
  const inside = (mid: number) => {
    const e = Math.min(mid - a, b - mid);
    return Math.max(0, Math.min(1, (e + 300) / 700));
  };
  return {
    inside,
    update(time, scrollX) {
      const k = inside(scrollX + W / 2);
      amber.setAlpha(k);
      glows.forEach((l, i) => l.setVisible(k > 0.01));
      void time;
    },
  };
}
