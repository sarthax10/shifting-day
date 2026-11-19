import Phaser from 'phaser';
import { H, W } from '../world/terrain';
import { BONE, BONE_CSS, DISPLAY, EMBER, EMBER_CSS, INK, INK_CSS, MONO, RED } from './poster';
import { play } from '../systems/audio';

/** What the trip came to, for the card at the end. */
export interface Tally {
  delivered: { key: string; value: number }[];
  broken: { key: string; value: number }[];
  lost: number;
  earned: number;
  penalty: number;
  bonus: number;
  parking: number;
  stops: number;
  score: number;
  stars: number;
  verdict: string;
  time: string;
  best: string | null;
  record: boolean;
}

const OX_CSS = '#3A0F22';
const RED_CSS = '#E3263A';
const CARD = { w: 1280, h: 560, stub: 340 };

/**
 * The end of the trip, printed as a poster: HOME SWEET HOME over ember rays, and the delivery note as a
 * ticket - the bill on the left, a perforated stub on the right with the rating stamped on and the run's
 * time. Everything arrives in a sequence (card, items, the total counting up, the stamp), and SHIFT AGAIN
 * (or Enter) starts a new move.
 */
export function showScorecard(scene: Phaser.Scene, t: Tally, onAgain: () => void) {
  const depth = 200;
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(depth);
  const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (root.add(o), o);

  // The ground: the palace dimmed behind ink, and slow rays turning behind the headline.
  const veil = add(scene.add.rectangle(0, 0, W, H, INK, 0.62).setOrigin(0).setInteractive());
  veil.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => e.stopPropagation());
  const rays = add(scene.add.graphics({ x: W / 2, y: 170 }));
  for (let k = 0; k < 24; k++) {
    const a0 = (k / 24) * Math.PI * 2;
    const a1 = a0 + Math.PI / 24;
    rays.fillStyle(k % 2 ? EMBER : RED, 0.16).fillTriangle(0, 0, Math.cos(a0) * 1600, Math.sin(a0) * 1600, Math.cos(a1) * 1600, Math.sin(a1) * 1600);
  }
  scene.tweens.add({ targets: rays, rotation: Math.PI * 2, duration: 90000, repeat: -1 });

  // The headline.
  const kicker = add(scene.add.text(W / 2, 64, 'THE END OF THE ROAD', { fontFamily: MONO, fontStyle: 'bold', fontSize: '22px', color: EMBER_CSS, letterSpacing: 8, backgroundColor: INK_CSS, padding: { x: 18, y: 8 } }).setOrigin(0.5));
  const head = add(scene.add.text(W / 2, 168, 'HOME SWEET HOME', { fontFamily: DISPLAY, fontSize: '124px', color: BONE_CSS, letterSpacing: 4, stroke: INK_CSS, strokeThickness: 10 }).setOrigin(0.5).setShadow(8, 10, RED_CSS, 0, true, false));
  const rule = add(scene.add.rectangle(W / 2, 254, Math.min(head.width, 640), 6, EMBER));

  // The ticket.
  const cx = W / 2;
  const top = 300;
  const left = cx - CARD.w / 2;
  const perf = left + CARD.w - CARD.stub;
  const card = scene.add.container(0, 0);
  add(card);
  const paper = scene.add.graphics();
  paper.fillStyle(INK, 0.5).fillRoundedRect(left + 12, top + 14, CARD.w, CARD.h, 18);
  paper.fillStyle(BONE, 1).fillRoundedRect(left, top, CARD.w, CARD.h, 18);
  paper.lineStyle(6, INK, 1).strokeRoundedRect(left, top, CARD.w, CARD.h, 18);
  paper.fillStyle(EMBER, 1).fillRect(left + 6, top + 6, perf - left - 12, 12);
  // The perforation: notches top and bottom, and a dotted tear line.
  paper.fillStyle(INK, 1).fillCircle(perf, top, 18).fillCircle(perf, top + CARD.h, 18);
  for (let y = top + 30; y < top + CARD.h - 24; y += 22) paper.fillStyle(INK, 0.6).fillCircle(perf, y, 3.5);
  card.add(paper);
  const text = (x: number, y: number, s: string, style: Phaser.Types.GameObjects.Text.TextStyle, ox = 0, oy = 0.5) => {
    const o = scene.add.text(x, y, s, style).setOrigin(ox, oy);
    card.add(o);
    return o;
  };
  const x0 = left + 56;
  const x1 = perf - 50;
  text(x0, top + 62, 'SHIFT HAPPENS MOVING CO.', { fontFamily: DISPLAY, fontSize: '40px', color: INK_CSS, letterSpacing: 2 });
  text(x1, top + 62, `DELIVERY NOTE  Nº ${String(1000 + (t.score % 9000)).padStart(4, '0')}`, { fontFamily: MONO, fontStyle: 'bold', fontSize: '18px', color: OX_CSS, letterSpacing: 3 }, 1);

  // What came off the truck: tiles of the dearest things, the broken ones crossed out in red.
  const tiles = [...t.delivered.slice().sort((a, b) => b.value - a.value), ...t.broken.map((b) => ({ ...b, broken: true }))].slice(0, 9) as { key: string; value: number; broken?: boolean }[];
  const tileY = top + 168;
  const popIns: Phaser.GameObjects.Image[] = [];
  tiles.forEach((it, i) => {
    const x = x0 + 46 + i * 98;
    const g = scene.add.graphics();
    g.fillStyle(it.broken ? 0xf2d0c8 : 0xffffff, 0.6).fillRoundedRect(x - 44, tileY - 52, 88, 104, 10);
    g.lineStyle(3, INK, 1).strokeRoundedRect(x - 44, tileY - 52, 88, 104, 10);
    card.add(g);
    const img = scene.add.image(x, tileY - 8, it.key);
    const k = Math.min(58 / img.height, 66 / img.width);
    img.setScale(0).setData('k', k);
    card.add(img);
    popIns.push(img);
    text(x, tileY + 36, it.broken ? `−${Math.round(it.value / 2)}` : `${it.value}`, { fontFamily: DISPLAY, fontSize: '22px', color: it.broken ? RED_CSS : INK_CSS }, 0.5);
    if (it.broken) card.add(scene.add.graphics().lineStyle(5, RED, 1).lineBetween(x - 30, tileY - 38, x + 30, tileY + 18).lineBetween(x + 30, tileY - 38, x - 30, tileY + 18));
  });
  if (!tiles.length) text(x0, tileY, 'NOTHING. NOT ONE THING.', { fontFamily: DISPLAY, fontSize: '36px', color: OX_CSS });

  // The bill, line by line, dotted leaders to the figures.
  const lines: [string, string, string][] = [
    [`DELIVERED SAFELY  ×${t.delivered.length}`, `+${t.earned}`, INK_CSS],
    [`BROKEN  ×${t.broken.length}`, t.broken.length ? `−${t.penalty}` : '0', t.broken.length ? RED_CSS : OX_CSS],
    [`FELL OFF ON THE WAY  ×${t.lost}`, '0', OX_CSS],
    ['CAREFUL DRIVER BONUS', t.bonus ? `+${t.bonus}` : '—', t.bonus ? INK_CSS : OX_CSS],
    [`PARKING AT ${t.stops} STOP${t.stops === 1 ? '' : 'S'}`, `+${t.parking}`, INK_CSS],
  ];
  const leaders = scene.add.graphics();
  card.add(leaders);
  lines.forEach(([label, value, colour], i) => {
    const y = top + 268 + i * 38;
    const l = text(x0, y, label, { fontFamily: MONO, fontStyle: 'bold', fontSize: '20px', color: colour, letterSpacing: 2 });
    const v = text(x1, y, value, { fontFamily: DISPLAY, fontSize: '26px', color: colour }, 1);
    leaders.fillStyle(INK, 0.35);
    for (let x = x0 + l.width + 14; x < x1 - v.width - 14; x += 10) leaders.fillCircle(x, y + 6, 1.8);
  });
  const sumY = top + 268 + lines.length * 38 + 8;
  leaders.fillStyle(INK, 1).fillRect(x0, sumY - 14, x1 - x0, 3).fillRect(x0, sumY - 7, x1 - x0, 3);
  text(x0, sumY + 40, 'TOTAL', { fontFamily: DISPLAY, fontSize: '48px', color: INK_CSS, letterSpacing: 2 });
  const total = text(x1, sumY + 36, '0', { fontFamily: DISPLAY, fontSize: '84px', color: EMBER_CSS, stroke: INK_CSS, strokeThickness: 6 }, 1);

  // The stub: the run's time, the best, and the rating stamped on.
  const sx = perf + CARD.stub / 2;
  text(sx, top + 70, 'RUN TIME', { fontFamily: MONO, fontStyle: 'bold', fontSize: '18px', color: OX_CSS, letterSpacing: 6 }, 0.5);
  text(sx, top + 126, t.time, { fontFamily: DISPLAY, fontSize: '64px', color: INK_CSS, letterSpacing: 2 }, 0.5);
  text(sx, top + 182, t.best ? `BEST  ${t.best}` : 'FIRST RUN', { fontFamily: MONO, fontStyle: 'bold', fontSize: '18px', color: OX_CSS, letterSpacing: 4 }, 0.5);
  if (t.record) {
    const tag = scene.add.container(sx + 110, top + 30).setRotation(0.18);
    tag.add(scene.add.rectangle(0, 0, 150, 40, RED).setStrokeStyle(3, INK));
    tag.add(scene.add.text(0, 0, 'NEW BEST', { fontFamily: DISPLAY, fontSize: '24px', color: BONE_CSS, letterSpacing: 2 }).setOrigin(0.5));
    card.add(tag);
  }
  const stamp = scene.add.container(sx, top + 380).setRotation(-0.14);
  const ring = scene.add.graphics();
  ring.lineStyle(6, RED, 1).strokeCircle(0, 0, 124);
  ring.lineStyle(2.5, RED, 1).strokeCircle(0, 0, 110);
  stamp.add(ring);
  const word = t.stars === 3 ? 'WITH CARE' : t.stars === 2 ? 'MOSTLY' : t.stars === 1 ? 'SORT OF' : 'BARELY';
  stamp.add(scene.add.text(0, -8, 'DELIVERED', { fontFamily: DISPLAY, fontSize: '40px', color: RED_CSS, letterSpacing: 3 }).setOrigin(0.5));
  stamp.add(scene.add.text(0, 40, word, { fontFamily: MONO, fontStyle: 'bold', fontSize: '20px', color: RED_CSS, letterSpacing: 5 }).setOrigin(0.5));
  const stars: Phaser.GameObjects.Text[] = [];
  for (let i = 0; i < 3; i++) {
    const s = scene.add.text((i - 1) * 46, -64, '★', { fontFamily: DISPLAY, fontSize: '50px', color: i < t.stars ? EMBER_CSS : '#D9C3A6', stroke: INK_CSS, strokeThickness: 4 }).setOrigin(0.5).setScale(0);
    stamp.add(s);
    stars.push(s);
  }
  stamp.setAlpha(0).setScale(2.2);
  card.add(stamp);

  // Under the card: the verdict, and the way out.
  const verdict = add(scene.add.text(W / 2, top + CARD.h + 52, `“${t.verdict}”`, { fontFamily: MONO, fontStyle: 'italic', fontSize: '24px', color: BONE_CSS }).setOrigin(0.5));
  const btn = scene.add.container(W / 2, top + CARD.h + 128);
  const tape = scene.add.rectangle(0, 0, 360, 74, EMBER).setStrokeStyle(4, INK).setInteractive({ useHandCursor: true });
  btn.add([tape, scene.add.text(0, 2, 'SHIFT AGAIN', { fontFamily: DISPLAY, fontSize: '40px', color: INK_CSS, letterSpacing: 3 }).setOrigin(0.5)]);
  add(btn);
  tape.on('pointerover', () => scene.tweens.add({ targets: btn, scale: 1.06, duration: 120 }));
  tape.on('pointerout', () => scene.tweens.add({ targets: btn, scale: 1, duration: 120 }));
  let gone = false;
  const again = () => {
    if (gone) return;
    gone = true;
    play('click');
    onAgain();
  };
  tape.on('pointerdown', again);
  scene.input.keyboard?.once('keydown-ENTER', again);

  // The sequence.
  for (const o of [kicker, head, rule, verdict, btn]) o.setAlpha(0);
  scene.tweens.add({ targets: [kicker, head, rule], alpha: 1, duration: 400 });
  scene.tweens.add({ targets: head, scale: { from: 0.8, to: 1 }, duration: 520, ease: 'Back.easeOut' });
  card.setY(80).setAlpha(0);
  scene.tweens.add({ targets: card, y: 0, alpha: 1, duration: 520, delay: 200, ease: 'Back.easeOut' });
  popIns.forEach((img, i) => scene.tweens.add({ targets: img, scale: img.getData('k') as number, delay: 600 + i * 70, duration: 260, ease: 'Back.easeOut' }));
  const count = { v: 0 };
  scene.tweens.add({ targets: count, v: t.score, delay: 1000, duration: 1300, ease: 'Cubic.easeOut', onUpdate: () => total.setText(String(Math.round(count.v))) });
  scene.tweens.add({
    targets: stamp,
    scale: 1,
    alpha: 0.92,
    delay: 2400,
    duration: 180,
    ease: 'Quad.easeIn',
    onComplete: () => {
      play('stamp');
      scene.cameras.main.shake(90, 0.002);
      stars.forEach((s, i) => scene.tweens.add({ targets: s, scale: 1, delay: 120 + i * 140, duration: 220, ease: 'Back.easeOut', onStart: () => i < t.stars && play('tie') }));
    },
  });
  scene.tweens.add({ targets: [verdict, btn], alpha: 1, delay: 2900, duration: 400 });
  return root;
}
