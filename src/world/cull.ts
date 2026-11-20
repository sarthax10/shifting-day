import Phaser from 'phaser';
import { W } from './terrain';

/**
 * Keeping the frame rate along a long road.
 *
 * Phaser draws everything in a scene every frame, on screen or not, and a Graphics re-tessellates every one
 * of its shapes each time: a roadside rail drawn as one Graphics the length of a leg costs thousands of
 * shapes a frame for the few hundred pixels anyone can see. So static roadside pieces are made in strips
 * about a screen wide, and a Culler hides (and stops updating) whatever is off screen.
 */

type Cullable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;

export class Culler {
  private items: { objs: Cullable[]; x0: number; x1: number; sf: number; on: boolean }[] = [];

  /** Shows these only while x0..x1 (world x, at scroll factor sf) is on screen or close to it. */
  add(objs: Cullable[], x0: number, x1: number, sf = 1) {
    this.items.push({ objs, x0, x1, sf, on: true });
    return this;
  }

  update(scrollX: number) {
    for (const c of this.items) {
      const left = c.x0 - scrollX * c.sf;
      const right = c.x1 - scrollX * c.sf;
      const on = right > -300 && left < W + 300;
      if (on === c.on) continue;
      c.on = on;
      // Hidden is not drawn; inactive is not updated either (particle emitters keep emitting otherwise).
      for (const o of c.objs) o.setVisible(on).setActive(on);
    }
  }
}

type Placed = Phaser.GameObjects.GameObject & { x: number; scrollFactorX: number; cameraFilter: number; getBounds?: () => Phaser.Geom.Rectangle };

/** The kinds of object a SceneryCuller takes on: ones with bounds, drawn as a quad or a shape. */
const KINDS = new Set(['Image', 'Sprite', 'TileSprite', 'Text', 'Rectangle', 'Arc', 'Ellipse', 'Triangle', 'Polygon', 'Container', 'NineSlice']);

/**
 * Every static piece of a scene's world, culled from one camera while it is off screen. Phaser processes and
 * submits every object in a scene every frame, so a leg's trees, lamps, poles, signs and buildings, all
 * the way down a road many screens long, cost the same as the few in view. This masks the rest out of the
 * camera (through each object's camera filter, so its own visibility, which the game sets for its own
 * reasons, is never touched) and keeps working for things that move, since it reads their position live.
 */
export class SceneryCuller {
  private items: { o: Placed; off: number; w: number; sf: number; out: boolean }[] = [];
  constructor(private readonly camera: Phaser.Cameras.Scene2D.Camera) {}

  /** Takes on everything in these lists (and inside their layers) that scrolls with the world. */
  addAll(list: Phaser.GameObjects.GameObject[]) {
    for (const g of list) {
      const o = g as Placed;
      if (o.type === 'Layer') {
        this.addAll((o as unknown as Phaser.GameObjects.Layer).list);
        continue;
      }
      if (!KINDS.has(o.type) || !(o.scrollFactorX > 0) || !o.getBounds) continue;
      const b = o.getBounds();
      // Anything a screen wide or more is always partly in view: not worth the check.
      if (!Number.isFinite(b.x) || b.width >= W) continue;
      this.items.push({ o, off: b.x - o.x, w: b.width, sf: o.scrollFactorX, out: false });
    }
    return this;
  }

  update(scrollX: number) {
    const id = this.camera.id;
    for (const e of this.items) {
      const left = e.o.x + e.off - scrollX * e.sf;
      const out = left + e.w < -250 || left > W + 250;
      if (out === e.out) continue;
      e.out = out;
      if (out) e.o.cameraFilter |= id;
      else e.o.cameraFilter &= ~id;
    }
  }
}

/** The widest picture `bake` makes in one piece. */
const BAKE_MAX = 2048;

/**
 * Paints a static Graphics into pictures, once, and removes it: the part of it from x0 to x1 and y0 to y1,
 * in pieces at most BAKE_MAX wide, each an image at the Graphics' depth. For shapes that stay in view
 * (the tunnel the truck drives through), where culling cannot help and redrawing them every frame costs
 * more than holding them as pictures.
 */
export function bake(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, key: string, x0: number, x1: number, y0: number, y1: number) {
  const x = Math.floor(x0);
  const y = Math.floor(y0);
  const h = Math.ceil(y1 - y);
  const out: Phaser.GameObjects.Image[] = [];
  for (let a = x, i = 0; a < x1; a += BAKE_MAX, i++) {
    const w = Math.ceil(Math.min(BAKE_MAX, x1 - a));
    const k = `${key}_${i}`;
    if (scene.textures.exists(k)) scene.textures.remove(k);
    const t = scene.textures.addDynamicTexture(k, w, h)!;
    t.draw(g, -a, -y).render();
    out.push(scene.add.image(a, y, k).setOrigin(0).setDepth(g.depth).setAlpha(g.alpha));
  }
  g.destroy();
  return out;
}

/** Strips about a screen wide, for drawing a long static roadside piece a strip at a time. */
export const STRIP = 1600;

/**
 * Draws a long static piece as one Graphics per strip, from x0 to x1. `draw` fills one strip, from a to b;
 * anything that joins across strips (a rail, a wire) should run a step past b so the strips meet.
 */
export function strips(scene: Phaser.Scene, culler: Culler, x0: number, x1: number, depth: number, draw: (g: Phaser.GameObjects.Graphics, a: number, b: number) => void, margin = 60) {
  for (let a = x0; a < x1; a += STRIP) {
    const b = Math.min(x1, a + STRIP);
    const g = scene.add.graphics().setDepth(depth);
    draw(g, a, b);
    culler.add([g], a - margin, b + margin);
  }
}
