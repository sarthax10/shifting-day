import Phaser from 'phaser';
import { Engine, ambience, audio, chime, music, play, thud } from './audio';
import { BOIL_FRAMES, HOUSE, ITEMS, PLANK, OFFICIAL_SIGN, RECEIPT, VALUE, TREE_KINDS, TRUCK, type ItemSpec, type Mood, DRIVER, type DriverMood, TOLL_SKINS, CANOPY, RAIL_SIGNAL } from './art';
import { DASH_RIGHT, Dash } from './dash';
import { CURSOR } from './cursors';
import { Fx } from './fx';
import { buildBackdrop } from './backdrop';
import { Drivetrain, REDLINE, type Gear } from './drivetrain';
import { C } from './ink';
import { FINISH, GROUND, H, W, WORLD_END, WORLD_START, groundY, setRoad } from './terrain';
import { LEGS, clearTrip, saveTrip, type Leg, type Trip } from './legs';
import { BIOMES, blendAt, type Built } from './biomes';
import { STOP_LOOKS, placeStop } from './stops';
import { MEADOW_TREES } from './trees';
import type { BiomeKey } from './legs';

/** Road pictures are cut into pieces this wide, starting this far down the screen. */
export { CHUNK, CHUNK_TOP } from './prepare';
import { CHUNK, CHUNK_TOP, groundKey, grassKey, prepareLeg } from './prepare';
import { applyBiomeFX } from './postfx';
import { chip, hudText, uiText, toastText, headingText, INK_BG } from './ui';

// The physics library that ships inside Phaser. Its own types are loose, so bodies are `any` here.
/* eslint-disable @typescript-eslint/no-explicit-any */
const M = (Phaser.Physics.Matter as any).Matter;
type Body = any;

const TEXT = '"Karla", sans-serif';
const TITLE = '"Fraunces", serif';
/** How hard the brakes slow the truck, in pixels a frame each frame. */
const BRAKE = 0.3;
const hexOf = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;
/** Where things sit on the truck, in its own coordinates: the headlight eye, the air freshener's hook, the aerial's foot, the exhaust. */
const EYE_AT = { x: 401, y: -28 };
/** Where the driver's head sits in the cab window, in the truck's own coordinates. */
export const DRIVER_AT = { x: 258, y: -96 };
const FRESHENER_AT = { x: 300, y: -138 };
const AERIAL_AT = { x: 354, y: -64 };
const PIPE_AT = { x: -210, y: 37 };
const TRUCK_X = 1440;
/** Bodies that share a negative group never touch each other. */
const TRUCK_GROUP = -7;
const ROPES = 3;
/** About six drawings a second, like Pip's Last Sprint. */
const BOIL_MS = 160;
const STILL = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A picture whose line boils: it cycles through a few redraws of the same drawing. */
interface Inked {
  img: Phaser.GameObjects.Image;
  base: string;
}

/** The same "random" numbers every time, so the scenery does not change between runs. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A rope is a real chain: small round links, each tied to the next, with the two end links tied to
 * rings on the truck bed. It is laid over the thing a little shorter than it needs to be, so it pulls
 * tight and drapes over whatever is under it, and moves when the load moves.
 */
interface Rope {
  links: Body[];
  joins: any[];
}

/** Rope links are their own kind of body: they touch the load, but not the truck or each other. */
const ROPE_CATEGORY = 0x0002;
const ROPE_LINK = 12;

interface Gate {
  x: number;
  body: Body;
  arm: Phaser.GameObjects.Image;
  state: 'closed' | 'checking' | 'open';
  timer: number;
  announced: boolean;
  nagged: boolean;
  bumped: boolean;
  still: number;
  snore: number;
  booth: { x: number; y: number };
  /** Its lights: a traffic light's red and green and the booth's beacon, or a crossing's two red lamps. */
  red?: Phaser.GameObjects.Image;
  green?: Phaser.GameObjects.Image;
  beacon?: Phaser.GameObjects.Image;
  flashers: Phaser.GameObjects.Image[];
  /** How long the check takes once stopped with the handbrake on: varies a little so every gate does not feel identical. */
  checkTime: number;
}

/** Where the bay outside the new house starts and ends, in the world. */
const bay = () => ({ from: FINISH + 80, to: FINISH + 900 });
import { TUNNEL, buildTunnel, type Tunnel } from './tunnel';
import { Extras } from './extras';
import { Crossbow } from './crossbow';
/** Where the last biome's roadside ends and this one's begins, around the blend. */
/** True where the tunnel's rock hides the roadside, so nothing is put there. */
const inTunnel = (x: number, on: boolean) => on && x > TUNNEL.from - 300 && x < TUNNEL.to + 300;
/** How far the truck reaches behind and in front of its middle (tailgate to bumper). */
const TRUCK_BACK = 194;
const TRUCK_NOSE = 476;
/** The toll gates, each partway up a hill so the stop is on a slope. */

interface Thing {
  spec: ItemSpec;
  body: Body;
  img: Phaser.GameObjects.Image;
  ink: Inked;
  shadow: Phaser.GameObjects.Image;
  /** A bright shape over something shiny (the fish bowl's highlight), where it sits relative to the thing's middle. */
  spark?: { img: Phaser.GameObjects.Image; dx: number; dy: number };
  /** Still on its way to the new house, in one piece. */
  aboard: boolean;
  broken: boolean;
  /** Left behind: faded, and the truck passes through it. */
  ghost: boolean;
  groundFrames: number;
  /** On the truck when it set off. */
  packed?: boolean;
  /** Fell off on the way. */
  lost?: boolean;
  /** Out of the physics world, far behind the truck. */
  gone?: boolean;
  rope?: Rope;
  /** Broken on an earlier leg (carried on as broken). */
  wasBroken?: boolean;
  mood: Mood;
  moodUntil: number;
}

type Phase = 'intro' | 'pack' | 'drive' | 'arrived' | 'done';

export class PlayScene extends Phaser.Scene {
  private phase: Phase = 'pack';
  private things: Thing[] = [];
  private byBody = new Map<number, Thing>();
  /** Broken things restored on the truck, in the same order as trip.lost's broken cargo, waiting to be taped up. */
  private pendingBroken: Thing[] = [];
  private lostFoundBtn?: { box: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text };
  private lostFoundPanel?: Phaser.GameObjects.Container;
  private chassis!: Body;
  private wheels: Body[] = [];
  private truckImg!: Phaser.GameObjects.Image;
  private truckFront!: Phaser.GameObjects.Image;
  private wheelImgs: Phaser.GameObjects.Image[] = [];
  private truckShadow!: Phaser.GameObjects.Image;
  private fx!: Fx;
  private slabs: Body[] = [];
  private slabsIn = new Set<Body>();
  private roadAt = -1e9;
  private fxLabel!: Phaser.GameObjects.Text;
  private fxChip!: Phaser.GameObjects.Rectangle;
  /** Fuel and bubble wrap; and the anchor crossbow. */
  private crossbow!: Crossbow;
  private extras!: Extras;
  private extrasLabel!: Phaser.GameObjects.Text;
  private extrasChip!: Phaser.GameObjects.Rectangle;
  private extrasIcons!: { wrap: Phaser.GameObjects.Image; fuel: Phaser.GameObjects.Image; fuelBarBg: Phaser.GameObjects.Rectangle; fuelBar: Phaser.GameObjects.Rectangle };
  private fuelPctText!: Phaser.GameObjects.Text;
  private headlight!: Phaser.GameObjects.Image;
  private drive = new Drivetrain();
  private eye!: Inked;
  private driver!: Inked;
  /** The driver's head on a spring: it lags behind bumps and jolts. */
  private headBob = { y: 0, v: 0 };
  private whistleUntil = 0;
  private driverBlink = 0;
  private eyeMood = 'open';
  private eyeUntil = 0;
  private nextBlink = 0;
  private freshener!: Phaser.GameObjects.Image;
  private aerial!: Phaser.GameObjects.Image;
  /** The company name painted on the side of the bed. */
  private decal!: Phaser.GameObjects.Text;
  /** The air freshener swings as a pendulum and the aerial as a spring: angle and speed of each. */
  private swing = { fa: 0, fv: 0, aa: 0, av: 0 };
  private lastForward = 0;
  private dash!: Dash;
  private hudHearts!: Phaser.GameObjects.Text;
  private tag!: Phaser.GameObjects.Text;
  private tagFor: Thing | null = null;
  private hudLabel!: Phaser.GameObjects.Text;
  private hudBar!: Phaser.GameObjects.Graphics;
  private hudTruck!: Phaser.GameObjects.Image;
  private hudHomes: Phaser.GameObjects.Image[] = [];
  private joltTip = false;
  private scenery2: { sails: Phaser.GameObjects.Image[]; clouds: { img: Phaser.GameObjects.Image; speed: number }[] } = { sails: [], clouds: [] };
  private chimneys: { x: number; y: number; kind: 'old' | 'new'; n: number }[] = [];
  private boiling: Inked[] = [];
  private cursorNow = '';
  private boilFrame = 0;
  /** From the truck's centre of mass to the (0, 0) its picture is drawn around. */
  private anchor = { x: 0, y: 0 };
  private held: { thing: Thing; dx: number; dy: number; angle: number } | null = null;
  private keys!: Record<'left' | 'right' | 'a' | 'd' | 'q' | 'e' | 'r' | 'f' | 'shift' | 'ctrl' | 'up' | 'down' | 'n' | 'one' | 'two' | 'three' | 'four' | 'p' | 'space' | 'w' | 'esc', Phaser.Input.Keyboard.Key>;
  private paused = false;
  private pauseUi?: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private toastChip!: Phaser.GameObjects.Rectangle;
  private goButton!: Phaser.GameObjects.Container;
  private ropeButton!: Phaser.GameObjects.Container;
  private ropeLabel!: Phaser.GameObjects.Text;
  private ropeLines!: Phaser.GameObjects.Graphics;
  private ropesLeft = ROPES;
  private roping = false;
  private engine = new Engine();
  private driveTime = 0;
  private arrivedAt = 0;
  private camLead = 0;
  /** When a wheel last touched the road: the engine keeps driving through a brief hop over a bump. */
  private groundedAt = 0;
  private stopAnims: ((time: number, delta: number) => void)[] = [];
  private tunnel?: Tunnel;
  /** The handbrake (the parking brake): on when the truck sets off, P or Space pulls it on or lets it off. */
  private handbrake = true;
  private brakeNagged = 0;
  private stallNagged = false;
  /** Toll gates on the hills: the barrier only lifts once the truck has stopped with its handbrake on. */
  private gates: Gate[] = [];
  /** The parking bay outside the new house. */
  private parkNote = 0;
  private parkBonus = 0;
  /** The leg being driven, the trip so far, and the leg's living scenery. */
  private leg: Leg = LEGS[0];
  private trip!: Trip;
  private world!: Built;
  /** The worlds on screen: this leg's own and, at its start, the last leg's, each split into depth bands that fade. */
  private worlds: { built: Built; layers: Phaser.GameObjects.Layer[]; prev: boolean }[] = [];
  private grassBands: { strips: Phaser.GameObjects.Image[]; prev: boolean }[] = [];
  private lastSlam = 0;
  private lastThud = 0;
  private frame = 0;

  constructor() {
    super('play');
  }

  /** How far the truck still has to back up, during the opening. */
  private introLeft = 0;
  private introFrom = 0;
  private introTime = 0;

  create(data?: { intro?: boolean; leg?: number; trip?: Trip }) {
    this.leg = LEGS[Math.min(LEGS.length, Math.max(1, data?.leg ?? 1)) - 1];
    setRoad(this.leg.features, this.leg.finish);
    this.trip = data?.trip ?? { leg: 1, cargo: [], lost: [], broken: [], parking: [], time: 0 };
    this.phase = data?.intro && this.leg.n === 1 ? 'intro' : 'pack';
    this.parkBonus = 0;
    this.parkNote = 0;
    this.things = [];
    this.byBody.clear();
    this.wheels = [];
    this.wheelImgs = [];
    this.boiling = [];
    this.cursorNow = '';
    this.boilFrame = 0;
    this.roadAt = -1e9;
    this.drive = new Drivetrain();
    this.swing = { fa: 0, fv: 0, aa: 0, av: 0 };
    this.lastForward = 0;
    this.eyeMood = 'open';
    this.joltTip = false;
    this.chimneys = [];
    this.held = null;
    this.ropesLeft = ROPES;
    this.roping = false;
    this.driveTime = 0;
    this.arrivedAt = 0;
    this.frame = 0;
    this.cameras.main.scrollX = 0;

    this.fx = new Fx(this);
    this.fx.setup(W, H);
    this.scenery();
    this.road();
    this.truck();
    this.household();
    this.hud();
    this.controls();
    this.extras = new Extras({
      scene: this,
      leg: this.leg,
      groundY,
      chassis: () => this.chassis,
      nose: () => this.onTruckAt(TRUCK_NOSE - 10, 30),
      say: (t) => this.say(t),
      float: (x, y, t, c) => this.floatText(x, y, t, c),
      phase: () => this.phase,
    });
    this.extras.build(this.trip?.coins ?? 0);
    this.crossbow = new Crossbow({
      scene: this,
      bodies: () => [this.chassis, ...this.wheels],
      mount: () => this.onTruckAt(196, -198),
      pullFrom: () => this.onTruckAt(TRUCK_NOSE - 10, 30),
      truckAngle: () => this.chassis.angle,
      phase: () => this.phase,
      say: (t) => this.say(t),
      reeling: () => this.keys.w.isDown,
      ground: (x) => groundY(x),
      cliffs: this.leg.features.filter((f) => f.length > 3).map(([fx]) => fx),
    });
    this.crossbow.build();
    this.input.mouse?.disableContextMenu();
    // The resource readout: its own clear chip, icons instead of just words, a fuel bar that reddens when low.
    const hudY = 146;
    this.extrasChip = chip(this, 40, hudY, 320, 58).setScrollFactor(0).setDepth(100).setVisible(false);
    const wrapIcon = this.add.image(78, hudY, 'bubble_wrap').setScale(0.46).setScrollFactor(0).setDepth(101).setVisible(false);
    this.extrasLabel = this.add.text(108, hudY, '', hudText(1.1)).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    const fuelIcon = this.add.image(208, hudY, 'fuel_can').setScale(0.4).setScrollFactor(0).setDepth(101).setVisible(false);
    const fuelBarBg = this.add.rectangle(238, hudY, 92, 16, 0x14101f, 0.8).setOrigin(0, 0.5).setStrokeStyle(2, 0xfff2da, 0.3).setScrollFactor(0).setDepth(101).setVisible(false);
    const fuelBar = this.add.rectangle(240, hudY, 88, 12, 0x9cc58a).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102).setVisible(false);
    this.extrasIcons = { wrap: wrapIcon, fuel: fuelIcon, fuelBarBg, fuelBar };
    this.fuelPctText = this.add.text(240, hudY + 18, '', { fontFamily: TEXT, fontSize: '16px', color: C.cream }).setOrigin(0, 0).setScrollFactor(0).setDepth(101).setVisible(false);

    this.matter.world.on('collisionstart', (event: { pairs: { bodyA: Body; bodyB: Body }[] }) => this.knocks(event.pairs));

    // The opening: the truck starts off to the right and backs up to the house, beeping.
    if (this.phase === 'intro') {
      this.introFrom = 1400;
      this.introLeft = this.introFrom;
      this.introTime = 0;
      this.slideTruck(this.introFrom);
      this.goButton.setVisible(false);
      this.ropeButton.setVisible(false);
      this.hint.setVisible(false);
      this.engine.start();
      this.cameras.main.fadeIn(350, 42, 33, 64);
    }
    this.events.once('shutdown', () => {
      this.engine.stop();
      ambience.quiet();
    });
    music.play('pack');
    music.setMelody(true);
    ambience.birds(true);
    ambience.setSpeed(0);

    // Get the next leg's pictures ready while this one is played.
    void prepareLeg(this.textures, this.leg.n + 1);
    if (this.leg.n > 1) this.legCard();

    // Paper grain and darker corners over the whole picture, under the buttons and text.
    this.add.image(0, 0, 'vignette').setOrigin(0).setDisplaySize(W, H).setScrollFactor(0).setDepth(95);
    if (!STILL) this.time.addEvent({ delay: BOIL_MS, loop: true, callback: () => this.boil() });
  }

  /** A picture with a boiling line. */
  private inked(x: number, y: number, base: string): Inked {
    const entry = { img: this.add.image(x, y, `${base}#0`), base };
    this.boiling.push(entry);
    return entry;
  }

  /** Changes which drawing a boiling picture shows. */
  private redraw(entry: Inked, base: string) {
    entry.base = base;
    entry.img.setTexture(`${base}#${this.boilFrame}`);
  }

  private boil() {
    this.boilFrame = (this.boilFrame + 1) % BOIL_FRAMES;
    // Each picture is a little out of step with its neighbours, so the whole screen does not twitch at once.
    this.boiling.forEach((b, i) => b.img.active && b.img.setTexture(`${b.base}#${(this.boilFrame + i) % BOIL_FRAMES}`));
  }

  /** Things hitting each other: a thud, and fragile things may break. */
  private knocks(pairs: { bodyA: Body; bodyB: Body; collision?: { supports?: { x: number; y: number }[] } }[]) {
    let loudest = 0;
    for (const pair of pairs) {
      const a = pair.bodyA.parent ?? pair.bodyA;
      const b = pair.bodyB.parent ?? pair.bodyB;
      const speed = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      loudest = Math.max(loudest, speed);
      if (this.phase === 'drive' || this.phase === 'arrived') this.impact(a, b, speed, pair.collision?.supports?.[0]);
      if (this.phase === 'drive' && (a.label === 'gate' || b.label === 'gate') && speed > 2) {
        const g = this.gates.find((x) => x.body === a || x.body === b);
        if (g && !g.bumped) {
          g.bumped = true;
          this.say("Ow! It's a barrier, not a suggestion.");
          this.lookStartled(700);
        }
      }
      if (this.phase !== 'drive') continue;
      for (const [me, other] of [[a, b], [b, a]]) {
        const t = this.byBody.get(me.id);
        if (!t?.spec.fragile || t.broken) continue;
        // A heavy thing hits harder than a light one, and the road is hardest of all.
        const weight = other.isStatic ? 1.5 : Phaser.Math.Clamp(other.mass / me.mass, 0.6, 2.5);
        if (speed * weight > t.spec.fragile) this.shatter(t);
      }
    }
    if (loudest > 3.5 && this.time.now - this.lastThud > 90) {
      this.lastThud = this.time.now;
      thud(loudest);
    }
  }

  /** What a hard knock looks like: the thing squashes and springs back, a twinkle pops, and grit flies off the road. */
  private impact(a: Body, b: Body, speed: number, at?: { x: number; y: number }) {
    if (speed < 4) return;
    const where = at ?? { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 };
    for (const body of [a, b]) {
      const t = this.byBody.get(body.id);
      if (!t || t.img.getData('squash')) continue;
      const k = Math.min(0.1, speed * 0.012);
      t.img.setData('squash', true);
      this.tweens.add({ targets: t.img, scaleX: 1 + k, scaleY: 1 - k, duration: 70, yoyo: true, ease: 'Quad.easeOut', onComplete: () => t.img.setScale(1).setData('squash', false) });
    }
    if (speed > 4.5) {
      const tw = this.add.image(where.x, where.y, 'twinkle').setDepth(25).setScale(0.2).setTint(0xfff3c4);
      this.tweens.add({ targets: tw, scale: 0.5 + Math.min(0.6, speed * 0.05), angle: 45, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => tw.destroy() });
    }
    // Hitting the road: a spray of grit and a cloud of dust, and a wheel slamming down shakes the camera.
    const road = a.isStatic ? a : b.isStatic ? b : null;
    if (road && road.label === 'road') {
      const other = road === a ? b : a;
      const isWheel = this.wheels.includes(other);
      if (isWheel && speed < 7) return;
      const n = Math.min(10, Math.floor(speed * 1.2));
      for (let i = 0; i < n; i++) {
        const chip = this.add.image(where.x, where.y, 'bit').setDepth(9).setScale(0.3 + Math.random() * 0.4).setTint([0xedb27d, 0xb97e5e, 0x8c7c88][i % 3]).setRotation(Math.random() * 6);
        const vx = (Math.random() - 0.5) * 160 - other.velocity.x * 12;
        this.tweens.add({ targets: chip, x: where.x + vx, y: { value: where.y - 40 - Math.random() * 50, ease: 'Quad.easeOut' }, angle: 360, duration: 300, onComplete: () => this.tweens.add({ targets: chip, y: where.y + 10, alpha: 0, duration: 260, ease: 'Quad.easeIn', onComplete: () => chip.destroy() }) });
      }
      for (let i = 0; i < 3; i++) this.dust(where.x + (i - 1) * 26, where.y - 6);
      // Only a really heavy landing nudges the camera, and only a little.
      if (isWheel && speed > 9 && this.time.now - this.lastSlam > 800) {
        this.lastSlam = this.time.now;
        this.cameras.main.shake(120, 0.0025);
      }
    }
  }

  private toggleHandbrake() {
    if (this.phase !== 'drive') return;
    this.handbrake = !this.handbrake;
    play('ratchet');
    const lever = this.onTruckAt(240, -40);
    this.floatText(lever.x, lever.y - 40, this.handbrake ? 'Handbrake on' : 'Handbrake off', this.handbrake ? C.terracotta : C.cream);
  }

  /** Driving with the handbrake on: smoke from the back wheel, a squeal, and a reminder. */
  private fightingBrake() {
    if (this.frame % 5 === 0) {
      const w = this.wheels[0].position;
      const puff = this.add.image(w.x - 20, w.y + TRUCK.wheelR - 10, 'puff').setDepth(9).setScale(0.5).setTint(0xd8d0e0).setAlpha(0.8);
      this.tweens.add({ targets: puff, x: puff.x - 90, y: puff.y - 70, scale: 1.6, alpha: 0, duration: 900, onComplete: () => puff.destroy() });
    }
    if (this.frame % 30 === 0) play('squeal');
    // The smoke and squeal say it; the driver's startled look says it again. No toast needed.
    if (this.time.now - this.brakeNagged > 4000) {
      this.brakeNagged = this.time.now;
      this.lookStartled(600);
    }
  }

  /** The engine labouring in too high a gear: the truck judders. The shudder and sound are the warning. */
  private truckShudder(how: number) {
    const c = this.chassis;
    M.Body.setAngularVelocity(c, c.angularVelocity + (Math.random() - 0.5) * 0.004 * how);
  }

  private stalledOut() {
    play('stall');
    this.exhaust(true);
    this.lookStartled(900);
    this.stallNagged = false;
    this.say('Stalled! Too high a gear to pull away. Shift to 1st (press 1), then D.');
  }

  /** Turning the key: only in a low gear, as the clutch can not drag the truck off in 3rd or 4th. */
  private tryRestart() {
    const g = this.drive.target;
    if (typeof g === 'number' && g >= 3) {
      if (!this.stallNagged) {
        this.stallNagged = true;
        this.say('It will only start in 1st, 2nd, N or R. Press 1.');
      }
      return;
    }
    this.drive.restart();
    play('crank');
    this.exhaust(true);
  }

  /**
   * The gates. A toll plaza: a canopy over the road with its downlights, a booth on a chevron island with a
   * sleepy attendant and an amber beacon, a traffic light, and the barrier. In town, a level crossing:
   * rails across the road, the crossbuck signal with its two red lamps flashing in turn, and the barrier.
   * Either way, the attendant (or the rules) want to see the handbrake on.
   */
  private buildGates() {
    this.gates = [];
    const rail = this.leg.gateKind === 'rail';
    const skin = this.leg.biome in TOLL_SKINS ? this.leg.biome : 'meadow';
    const glow = (x: number, y: number, w: number, h: number, tint: number, depth: number, alpha = 0) =>
      this.add.image(x, y, 'halo').setDisplaySize(w, h).setTint(tint).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
    for (const x of this.leg.gates) {
      const y = groundY(x);
      // The very last gate of the whole trip: they already know you're coming, so it is waved
      // through, no stop needed - one small reward for a trip full of stopping at these.
      const isFinal = this.leg.n === LEGS.length && x === this.leg.gates[this.leg.gates.length - 1];
      let red: Phaser.GameObjects.Image | undefined;
      let green: Phaser.GameObjects.Image | undefined;
      let beacon: Phaser.GameObjects.Image | undefined;
      const flashers: Phaser.GameObjects.Image[] = [];
      if (rail) {
        // Rails set into the road, with their sleepers in the ground beneath.
        const r = this.add.graphics().setDepth(0.6);
        for (const dx of [-80, 40]) {
          r.fillStyle(0x2a2238, 1).fillRect(x + dx - 8, groundY(x + dx) + 8, 56, 12);
          r.fillStyle(0x9a9ab8, 1).fillRect(x + dx, groundY(x + dx) - 4, 40, 7);
          r.fillStyle(0xe8e8ff, 1).fillRect(x + dx, groundY(x + dx) - 4, 40, 2);
        }
        const sx = x + 70;
        this.add.image(sx, y + 8, 'rail_signal').setOrigin(0.5, 1).setDepth(-6);
        const top = y + 8 - RAIL_SIGNAL.h;
        for (const [lx, ly] of RAIL_SIGNAL.lamps) {
          const lamp = this.add.circle(sx - RAIL_SIGNAL.w / 2 + lx, top + ly, 18, 0xff3a2a).setDepth(-5.85).setAlpha(0);
          flashers.push(lamp as unknown as Phaser.GameObjects.Image, glow(sx - RAIL_SIGNAL.w / 2 + lx, top + ly, 140, 140, 0xff3a2a, -5.8));
        }
      } else {
        // The canopy, its downlights and the pools of light they throw on the road.
        this.add.image(x + 60, y + 20, `toll_canopy_${skin}`).setOrigin(0.5, 1).setDepth(-6.5);
        const top = y + 20 - CANOPY.h;
        this.add.text(x + 60, top + CANOPY.slab + 35, 'TOLL', { fontFamily: TITLE, fontSize: '34px', color: C.ink }).setOrigin(0.5).setDepth(-6.4);
        for (const lx of CANOPY.lights) {
          const gx = x + 60 - CANOPY.w / 2 + lx;
          glow(gx, top + CANOPY.slab + 84, 170, 60, 0xfff0c0, -6.3, 0.7);
          glow(gx, groundY(gx) + 6, 280, 46, 0xfff0c0, 0.7, 0.4);
        }
        this.add.image(x, y + 8, skin === 'meadow' ? 'toll_booth' : `toll_booth_${skin}`).setOrigin(31 / 260, 1).setDepth(-6);
        beacon = glow(x - 31 + 154, y + 8 - 360 + 74, 90, 90, 0xffb43a, -5.9);
        // The traffic light before the barrier: red until you are let through.
        const tx = x - 90;
        this.add.rectangle(tx, groundY(tx) + 8, 12, 300, 0x3a3e4a).setOrigin(0.5, 1).setDepth(-6).setStrokeStyle(3, 0x2a2140);
        this.add.rectangle(tx, groundY(tx) - 296, 40, 74, 0x1e1a24).setOrigin(0.5, 0).setDepth(-6).setStrokeStyle(3, 0x2a2140);
        this.add.circle(tx, groundY(tx) - 276, 12, 0x4a1a1a).setDepth(-5.95);
        this.add.circle(tx, groundY(tx) - 242, 12, 0x1a3a24).setDepth(-5.95);
        red = this.add.circle(tx, groundY(tx) - 276, 12, 0xff3a2a).setDepth(-5.9) as unknown as Phaser.GameObjects.Image;
        green = this.add.circle(tx, groundY(tx) - 242, 12, 0x3aff8a).setDepth(-5.9).setAlpha(0) as unknown as Phaser.GameObjects.Image;
        flashers.push(glow(tx, groundY(tx) - 276, 80, 80, 0xff3a2a, -5.85, 0.6), glow(tx, groundY(tx) - 242, 80, 80, 0x3aff8a, -5.85, 0));
      }
      const arm = this.add.image(x, y - 150, 'toll_arm').setOrigin((420 - 37) / 420, 0.5).setDepth(22);
      // Where the barrier is, the road is blocked - unless it is already up and waiting for no one.
      const body = M.Bodies.rectangle(x + 10, y - 150, 26, 300, { isStatic: true, label: 'gate', friction: 0.2 });
      if (isFinal) {
        arm.setRotation(Math.PI / 2).setDepth(-5.7);
        if (red) red.setAlpha(0);
        if (green) green.setAlpha(1);
        for (const f of flashers) f.setAlpha(0);
      } else this.matter.world.add(body);
      // The white line to stop at, painted on the road, and a warning sign before it.
      const line = this.add.graphics().setDepth(0.5);
      line.fillStyle(0xfff6e4, 0.9);
      for (let k = 0; k < 4; k++) line.fillRect(x - 230 + k * 8, groundY(x - 230 + k * 8) + 2, 6, 16);
      const sx = x - 900;
      const tilt = -0.01;
      this.add.image(sx, groundY(sx) + 10, 'sign_official').setOrigin(0.5, 1).setDepth(-6).setScale(0.8).setRotation(tilt);
      const words = this.add
        .text(
          sx,
          groundY(sx) + 10 - (OFFICIAL_SIGN.h - OFFICIAL_SIGN.text.y) * 0.8,
          isFinal ? 'TOLL AHEAD\nALREADY OPEN\nCARRY ON' : this.leg.gateKind === 'rail' ? 'RAIL CROSSING\nSTOP\nHANDBRAKE ON' : 'TOLL AHEAD\nSTOP\nHANDBRAKE ON',
          { fontFamily: TEXT, fontStyle: 'bold', fontSize: '28px', color: C.ink, align: 'center', lineSpacing: 0, letterSpacing: 0.5 },
        )
        .setOrigin(0.5)
        .setDepth(-5.9)
        .setRotation(tilt);
      words.setScale(Math.min(1, (OFFICIAL_SIGN.text.w * 0.8) / words.width, (OFFICIAL_SIGN.text.h * 0.8) / words.height));
      // A little variety in how long the check takes, so thirteen stops across the trip do not all
      // feel exactly the same length.
      const checkTime = isFinal ? 0 : 0.9 + Math.random() * 0.7;
      this.gates.push({ x, body, arm, state: isFinal ? 'open' : 'closed', timer: 0, announced: isFinal, nagged: false, bumped: false, still: 0, snore: 0, booth: { x: x + 100, y: y - 180 }, red, green, beacon, flashers, checkTime });
    }
  }

  private updateGates(forward: number, delta: number) {
    const front = this.onTruckAt(TRUCK_NOSE, 0).x;
    const dt = delta / 1000;
    const now = this.time.now;
    for (const g of this.gates) {
      if (g.state === 'open') continue;
      // Lights: the crossing's lamps flash in turn; the booth's beacon pulses.
      if (this.leg.gateKind === 'rail') {
        const on = Math.floor(now / 420) % 2;
        g.flashers.forEach((l, i) => l.setAlpha(Math.floor(i / 2) === on ? (i % 2 ? 0.75 : 1) : 0));
      } else g.beacon?.setAlpha(0.35 + Math.max(0, Math.sin(now / 160)) * 0.6);
      const gap = g.x - front;
      // The attendant snores until somebody turns up.
      g.snore += dt;
      if (g.state === 'closed' && g.snore > 1.4 && Math.abs(gap) < 2200) {
        g.snore = 0;
        const z = this.add.text(g.booth.x, g.booth.y, 'z', { fontFamily: TITLE, fontSize: '30px', color: C.cream, stroke: C.ink, strokeThickness: 4 }).setDepth(-5);
        this.tweens.add({ targets: z, x: z.x + 40, y: z.y - 70, scale: 1.6, alpha: 0, duration: 1600, onComplete: () => z.destroy() });
      }
      if (!g.announced && gap < 900 && gap > 0) {
        g.announced = true;
        this.say(this.leg.gateKind === 'rail' ? 'Level crossing! Stop at the line and put the handbrake on (P).' : 'Toll gate! Stop at the line and put the handbrake on (P).');
      }
      const stopped = gap > -10 && gap < 340 && Math.abs(forward) < 0.15;
      g.still = stopped ? g.still + dt : 0;
      if (g.state === 'closed' && stopped && this.handbrake) {
        g.state = 'checking';
        g.timer = 0;
        const wake = this.add.text(g.booth.x, g.booth.y + 10, '!', { fontFamily: TITLE, fontSize: '54px', color: C.mustard, stroke: C.ink, strokeThickness: 6 }).setOrigin(0.5).setDepth(-5);
        this.tweens.add({ targets: wake, y: wake.y - 40, alpha: 0, delay: 500, duration: 600, onComplete: () => wake.destroy() });
        play('beep');
      } else if (g.state === 'closed' && g.still > 1 && !this.handbrake && !g.nagged) {
        g.nagged = true;
        this.say('"Handbrake on, please. Rules are rules." (P)');
      }
      if (g.state === 'checking') {
        // Let the handbrake off too soon and the attendant starts over.
        if (!this.handbrake) g.state = 'closed';
        g.timer += dt;
        if (g.timer > g.checkTime) {
          g.state = 'open';
          this.matter.world.remove(g.body);
          play('ratchet');
          this.tweens.add({ targets: g.arm, rotation: Math.PI / 2, duration: 700, ease: 'Back.easeOut' });
          // Once it swings up it stands beside the road, so the truck drives past in front of it.
          g.arm.setDepth(-5.7);
          // Lights change: green for go, the crossing goes dark, the beacon rests.
          g.red?.setAlpha(0);
          g.green?.setAlpha(1);
          if (this.leg.gateKind === 'rail') g.flashers.forEach((l) => l.setAlpha(0));
          else {
            g.flashers[0]?.setAlpha(0);
            g.flashers[1]?.setAlpha(0.6);
          }
          g.beacon?.setAlpha(0);
          this.floatText(g.booth.x, g.booth.y - 20, 'Off you go!', C.cream);
          const quips = ['Mind the hill. Low gear.', 'Lovely handbrake work.', 'Pull away in 1st, or you will stall.'];
          this.say(`"${quips[this.leg.gates.indexOf(g.x) % quips.length]}" Handbrake off (P), then go.`);
        }
      }
    }
  }

  /** The parking bay outside the new house: two cones, painted lines, and a P sign. */
  private buildBay() {
    const paint = this.add.graphics().setDepth(0.5);
    for (let x = bay().from; x < bay().to; x += 40) {
      paint.fillStyle(0xffc94a, 0.95).fillRect(x, groundY(x) + 3, 24, 7);
    }
    for (const x of [bay().from, bay().to]) {
      const y = groundY(x);
      paint.fillStyle(0xfff6e4, 1).fillRect(x - 4, y + 1, 8, 18);
      const cone = this.add.graphics().setDepth(23);
      cone.fillStyle(0x2a2140).fillTriangle(x - 24, y + 4, x + 24, y + 4, x, y - 62);
      cone.fillStyle(0xee6a4d).fillTriangle(x - 19, y + 1, x + 19, y + 1, x, y - 56);
      cone.fillStyle(0xfff2da).fillRect(x - 10, y - 30, 20, 9);
      cone.fillStyle(0x2a2140).fillRect(x - 28, y, 56, 8);
    }
  }

  /** Parking: the truck must stop wholly inside the bay with the handbrake on. Neat parking earns a bonus. */
  private parking(forward: number) {
    const cx = this.chassis.position.x;
    const back = this.onTruckAt(-TRUCK_BACK, 0).x;
    const nose = this.onTruckAt(TRUCK_NOSE, 0).x;
    if (this.parkNote === 0 && nose > bay().from - 1400) {
      this.parkNote = 1;
      this.say('Nearly home! Park in the bay between the cones, then handbrake on (P).');
    }
    if (this.parkNote === 1 && nose > bay().to + 40) {
      this.parkNote = 2;
      this.say('Too far! Stop, press R, and back into the bay.');
    }
    const inside = back > bay().from && nose < bay().to;
    if (inside && Math.abs(forward) < 0.1 && this.handbrake) {
      // A bonus for parking right in the middle of the bay.
      const slack = (bay().to - bay().from - (TRUCK_BACK + TRUCK_NOSE)) / 2;
      const off = Math.abs((back + nose) / 2 - (bay().from + bay().to) / 2);
      this.parkBonus = Math.round(Phaser.Math.Clamp(100 * (1 - off / slack), 10, 100));
      this.phase = 'arrived';
      this.dash.show(false);
      this.hint.setVisible(false).setText('');
      this.arrivedAt = this.time.now;
      this.engine.stop();
      this.confetti();
      play('honk');
      chime(72);
      music.play('results', 0.6);
      ambience.setSpeed(0);
      ambience.birds(true);
      this.floatText(cx, this.chassis.position.y - 220, this.parkBonus >= 90 ? 'Perfect parking!' : 'Parked!', C.mustard);
    }
  }

  /**
   * Builds a biome and gathers everything it made into four layers by depth (far scenery, roadside,
   * road-level effects, and weather in front), so the whole biome can be faded in or out as one.
   */
  private buildWorld(key: BiomeKey, range: [number, number], prev: boolean) {
    const before = new Set(this.children.list);
    const built = BIOMES[key].build(this, { reach: WORLD_END, horizon: GROUND - 40, groundY, finish: FINISH, range, busy: [...this.leg.gates.flatMap((x) => [x - 900, x]), ...this.leg.jokes.map(([x]) => x)] });
    const made = this.children.list.filter((o) => !before.has(o));
    const bands: [number, number, number][] = [
      [-Infinity, -12, -12],
      [-12, 0, -8.5],
      [0, 30, 0.7],
      [30, Infinity, 56],
    ];
    const layers = bands.map(([, , d]) => this.add.layer().setDepth(d - (prev ? 0.01 : 0)));
    for (const o of made) {
      const d = (o as unknown as { depth: number }).depth ?? 0;
      const i = bands.findIndex(([lo, hi]) => d >= lo && d < hi);
      layers[i].add(o);
    }
    return { built, layers, prev };
  }

  /** A roadside stop: the shop and the canopy over the pumps, its name on the board, its lights. */
  /** A checkpoint stop, its building standing so that its canopy or porch is over the bay centred on mid. */
  private stopAt(mid: number, stop: { name: string; palette: number }) {
    const look = STOP_LOOKS[stop.palette];
    this.stopAnims.push(placeStop(this, stop.palette, mid - look.bay, GROUND + 6, stop.name, () => undefined));
  }

  /** Loads the truck as it was left at the last stop: the same things, where they sat, broken or not, tied or not. */
  private restoreCargo() {
    const b = this.bed();
    const restored: { t: Thing; tied: boolean }[] = [];
    this.pendingBroken = [];
    for (const c of this.trip.cargo) {
      const spec = ITEMS.find((s) => s.key === c.key);
      if (!spec) continue;
      this.addThing(spec, b.x + c.dx, b.y + c.dy, c.angle);
      const t = this.things[this.things.length - 1];
      if (c.broken) {
        t.broken = true;
        t.wasBroken = true;
        t.aboard = false;
        this.redraw(t.ink, `${spec.key}_broken`);
        this.pendingBroken.push(t);
      }
      restored.push({ t, tied: c.tied });
    }
    this.time.delayedCall(450, () => {
      for (const r of restored) if (r.tied && this.ropesLeft > 0 && !r.t.rope) this.tie(r.t);
    });
    this.maybeOfferLostFound();
  }

  /** Parked at a stop: the trip is saved there, with the load as it sits, and the next leg is offered. */
  private checkpoint() {
    this.phase = 'done';
    this.engine.stop();
    play('win');
    const b = this.bed();
    const cos = Math.cos(-this.chassis.angle);
    const sin = Math.sin(-this.chassis.angle);
    const onBoard = this.things.filter((t) => t.packed && !t.lost && !t.ghost && this.onTruck(t));
    const cargo = onBoard.map((t) => {
      const dx = t.body.position.x - b.x;
      const dy = t.body.position.y - b.y;
      return { key: t.spec.key, broken: t.broken, dx: dx * cos - dy * sin, dy: dx * sin + dy * cos, angle: t.body.angle - this.chassis.angle, tied: !!t.rope };
    });
    const lostNow = this.things.filter((t) => t.packed && !onBoard.includes(t)).map((t) => t.spec.key);
    const brokeNow = this.things.filter((t) => t.packed && t.broken && !t.wasBroken).map((t) => t.spec.key);
    this.extras.stop();
    this.crossbow.stop();
    const trip: Trip = { leg: this.leg.n + 1, cargo, lost: [...this.trip.lost, ...lostNow], broken: [...this.trip.broken, ...brokeNow], parking: [...this.trip.parking, this.parkBonus], time: this.trip.time + this.driveTime, coins: this.extras.coins + (this.parkBonus >= 90 ? 1 : 0) };
    saveTrip(trip);
    void prepareLeg(this.textures, trip.leg);
    const worth = onBoard.filter((t) => !t.broken).reduce((n, t) => n + this.valueOf(t), 0);
    this.time.delayedCall(900, () => this.checkpointCard(trip, lostNow.length, brokeNow.length, worth));
  }

  /** A button over the pile, only when there is something to claim: what fell off or broke on earlier legs. */
  private maybeOfferLostFound() {
    const pending = () => this.trip.lost.length + this.pendingBroken.length;
    if (!pending()) return;
    const mk = () => {
      const btn = this.button(W / 2, 60, 'btn_rope', `Lost & Found (${pending()})`, 28, () => this.openLostFound());
      btn.box.setScrollFactor(0).setDepth(100);
      this.lostFoundBtn = btn;
    };
    mk();
  }

  /**
   * The stop's Lost & Found, opened from the pile: whatever fell off or broke on earlier legs. Claiming a
   * lost thing has it dropped off by a passing truck - literally, it falls out of the sky onto the ground -
   * so it still has to be dragged onto the truck like everything else. Pets always find their own way back,
   * for free; the stop has tape for broken things, fixed on the spot. Both cost a few rolls of bubble wrap.
   */
  private openLostFound() {
    if (this.lostFoundPanel) return;
    const x = W / 2;
    const nameOf = (key: string) => ITEMS.find((i) => i.key === key)?.name ?? key;
    const isPet = (key: string) => !!ITEMS.find((i) => i.key === key)?.pet;
    const rowsCount = () => this.trip.lost.length + this.pendingBroken.length;
    const rowH = 84;
    const h = 220 + Math.max(1, rowsCount()) * rowH;
    const top = Math.max(140, H / 2 - h / 2);
    const panel = this.add.container(0, 0).setScrollFactor(0).setDepth(250);
    this.lostFoundPanel = panel;
    const scrim = this.add.rectangle(x, H / 2, W, H, 0x120d1f, 0.55).setInteractive();
    const board = this.add.rectangle(x, top + h / 2, 500, h, 0x7a4a2e).setStrokeStyle(6, 0x2a2140).setInteractive();
    // Clicks on the board itself just stop there - only the darkened area outside it, caught by the
    // scrim below, should close the panel.
    board.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => e.stopPropagation());
    const paper = this.add.rectangle(x, top + h / 2 + 8, 460, h - 60, 0xfff4e0).setStrokeStyle(4, 0x2a2140);
    const sign = this.add.rectangle(x, top + 4, 330, 64, 0xd8572a).setStrokeStyle(5, 0x2a2140).setAngle(-2);
    const title = this.add.text(x, top, 'LOST & FOUND', { fontFamily: TITLE, fontSize: '40px', color: C.cream }).setOrigin(0.5).setAngle(-2);
    title.setScale(Math.min(1, (300 * 0.85) / title.width));
    const purse = this.add.text(x, top + 66, '', { fontFamily: TEXT, fontSize: '23px', color: C.walnut }).setOrigin(0.5);
    // Three ways to close it, since one small button was apparently not enough to find: a bigger X in
    // the board's corner, a click anywhere outside the board, and Escape.
    scrim.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.closeLostFound();
    });
    // A tab sitting above the board itself, clear of both the ribbon and the corner rivets.
    const closeBtn = this.add.circle(x + 200, top - 22, 30, 0x2a2140).setStrokeStyle(3, 0xfff2da, 0.6).setInteractive({ cursor: CURSOR.open });
    const closeX = this.add.text(x + 200, top - 23, 'X', { fontFamily: TITLE, fontSize: '28px', color: C.cream }).setOrigin(0.5);
    closeBtn.on('pointerover', () => closeBtn.setScale(1.1));
    closeBtn.on('pointerout', () => closeBtn.setScale(1));
    closeBtn.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      play('click');
      this.closeLostFound();
    });
    panel.add([scrim, board, paper, sign, title, purse, closeBtn, closeX]);
    for (const [px, py] of [[x - 215, top + 46], [x + 215, top + 46], [x - 215, top + h - 24], [x + 215, top + h - 24]]) panel.add(this.add.circle(px, py, 7, 0xc9a24a).setStrokeStyle(3, 0x2a2140));
    const showPurse = () => purse.setText(`You have ${this.extras.coins} roll${this.extras.coins === 1 ? '' : 's'} of bubble wrap`);
    showPurse();
    this.tweens.add({ targets: panel, alpha: { from: 0, to: 1 }, duration: 220 });
    const empty = this.add.text(x, top + 150, 'Nothing handed in.\nEverything made it!', { fontFamily: TEXT, fontSize: '26px', color: C.sageDark, align: 'center' }).setOrigin(0.5).setVisible(!rowsCount());
    panel.add(empty);
    let y = top + 124;
    const dropXs = [260, 420, 580, 740, 900, 1060];
    let dropAt = 0;
    const row = (key: string, label: string, cost: number, act: () => void) => {
      const ry = y;
      const tex = isPet(key) ? `${key}_calm` : key;
      const frame = this.textures.exists(`${tex}#0`) ? `${tex}#0` : tex;
      if (this.textures.exists(frame)) {
        const icon = this.add.image(x - 185, ry, frame);
        icon.setScale(Math.min(60 / icon.width, 60 / icon.height));
        panel.add(icon);
      }
      const text = this.add.text(x - 140, ry, label, { fontFamily: TEXT, fontSize: '22px', color: C.ink, wordWrap: { width: 185 } }).setOrigin(0, 0.5);
      const tag = this.add.rectangle(x + 165, ry, 120, 50, cost ? 0xf2c14e : 0x9cc58a).setStrokeStyle(4, 0x2a2140);
      const price = this.add.text(x + 165, ry - 2, cost ? `${cost} rolls` : 'Free', { fontFamily: TITLE, fontSize: '26px', color: C.ink }).setOrigin(0.5);
      panel.add([text, tag, price]);
      let done = false;
      tag.setInteractive({ cursor: CURSOR.open });
      tag.on('pointerover', () => !done && tag.setScale(1.06));
      tag.on('pointerout', () => tag.setScale(1));
      tag.on('pointerdown', (_p: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (done) return;
        if (this.extras.coins < cost) {
          play('click');
          this.tweens.add({ targets: [tag, price], x: '+=8', duration: 50, yoyo: true, repeat: 3 });
          return this.say('Not enough bubble wrap. It lies where the road gets tricky.');
        }
        done = true;
        this.extras.coins -= cost;
        act();
        showPurse();
        play('stamp');
        tag.setFillStyle(0xd7e8c8).setScale(1);
        price.setText('Done!').setColor(C.sageDark);
        text.setColor(C.sageDark);
        if (!this.trip.lost.length && !this.pendingBroken.length) this.time.delayedCall(500, () => this.closeLostFound());
      });
      y += rowH;
    };
    [...this.trip.lost].forEach((key) => {
      const spec = ITEMS.find((s) => s.key === key);
      if (!spec) return;
      row(key, nameOf(key), isPet(key) ? 0 : 3, () => {
        const at = this.trip.lost.indexOf(key);
        if (at >= 0) this.trip.lost.splice(at, 1);
        const dx = dropXs[dropAt++ % dropXs.length];
        this.addThing(spec, dx, -420, Math.random() * 0.8 - 0.4);
        play('honk', 0.5);
        this.cameras.main.shake(80, 0.0015);
      });
    });
    [...this.pendingBroken].forEach((t) => {
      row(t.spec.key, `Tape up the ${nameOf(t.spec.key).toLowerCase()}`, 2, () => {
        const at = this.pendingBroken.indexOf(t);
        if (at >= 0) this.pendingBroken.splice(at, 1);
        t.broken = false;
        t.aboard = true;
        this.redraw(t.ink, t.spec.pet ? `${t.spec.key}_calm` : t.spec.key);
        const brokenAt = this.trip.broken.indexOf(t.spec.key);
        if (brokenAt >= 0) this.trip.broken.splice(brokenAt, 1);
      });
    });
  }

  private closeLostFound() {
    this.lostFoundPanel?.destroy(true);
    this.lostFoundPanel = undefined;
    const pending = this.trip.lost.length + this.pendingBroken.length;
    if (this.lostFoundBtn) {
      if (pending) this.lostFoundBtn.label.setText(`Lost & Found (${pending})`);
      else {
        this.lostFoundBtn.box.destroy(true);
        this.lostFoundBtn = undefined;
      }
    }
  }

  private checkpointCard(trip: Trip, lost: number, broke: number, worth: number) {
    const cx = W / 2;
    const cy = H / 2;
    const k = 0.82;
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d = 201) => o.setScrollFactor(0).setDepth(d);
    fixed(this.add.rectangle(cx, cy, W, H, 0x2a2140, 0.5), 199);
    const paper = fixed(this.add.image(cx, cy - 10, 'receipt').setScale(k), 200);
    this.tweens.add({ targets: paper, y: { from: cy + 50, to: cy - 10 }, duration: 420, ease: 'Back.easeOut' });
    const top = cy - 10 - (RECEIPT.h * k) / 2;
    fixed(this.add.image(cx, top - 4, 'ribbon').setScale(0.82), 202);
    fixed(this.add.text(cx, top - 14, `Checkpoint ${this.leg.n}`, { fontFamily: TITLE, fontSize: '52px', color: C.cream, stroke: C.terracottaDark, strokeThickness: 4 }).setOrigin(0.5), 203);
    fixed(this.add.text(cx, top + 92, this.leg.stop!.name, { fontFamily: TITLE, fontSize: '42px', color: C.ink }).setOrigin(0.5), 202);
    fixed(this.add.text(cx, top + 138, 'TRIP SAVED  ·  YOU CAN QUIT AND CARRY ON LATER', { fontFamily: TEXT, fontSize: '19px', color: C.sageDark }).setOrigin(0.5), 202);
    const lines: [string, string][] = [
      ['Still on the truck', `${worth} pts`],
      ['Broke on this leg', broke ? String(broke) : 'none'],
      ['Fell off on this leg', lost ? String(lost) : 'none'],
      [this.parkBonus >= 90 ? 'Parking: perfect!' : 'Parking', `+${this.parkBonus}`],
    ];
    lines.forEach(([label, value], i) => {
      const y = top + 210 + i * 46;
      fixed(this.add.text(cx - 300, y, label, { fontFamily: TEXT, fontSize: '28px', color: C.ink }).setOrigin(0, 0.5), 202);
      fixed(this.add.text(cx + 300, y, value, { fontFamily: TITLE, fontSize: '28px', color: C.ink }).setOrigin(1, 0.5), 202);
    });
    const next = LEGS[trip.leg - 1];
    fixed(this.add.text(cx, top + 420, `Next: ${next.title}`, { fontFamily: TITLE, fontSize: '32px', color: C.terracottaDark }).setOrigin(0.5), 202);
    const go = this.button(cx + 160, top + 520, 'btn', 'Continue', 44, () => {
      go.label.setText('Loading...');
      void prepareLeg(this.textures, trip.leg).then(() => this.scene.restart({ leg: trip.leg, trip }));
    });
    go.box.setDepth(205);
    this.button(cx - 190, top + 520, 'btn_rope', 'Title', 40, () => this.scene.start('title')).box.setDepth(205);
  }

  /** The start of a leg: its name, large, and the mood of the place, fading away. */
  private legCard() {
    const moods: Record<string, string> = { autumn: 'A misty autumn morning', snow: 'Blue hour on the high pass', town: 'A rainy night in town', coast: 'A bright morning by the sea', meadow: '' };
    const t1 = this.add.text(W / 2, 330, `Leg ${this.leg.n}  ·  ${this.leg.title}`, { fontFamily: TITLE, fontSize: '96px', color: C.cream, stroke: C.ink, strokeThickness: 10 }).setOrigin(0.5).setScrollFactor(0).setDepth(150).setAlpha(0);
    const t2 = this.add.text(W / 2, 430, moods[this.leg.biome], { fontFamily: TEXT, fontSize: '40px', color: C.cream, stroke: C.ink, strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(150).setAlpha(0);
    this.tweens.add({ targets: [t1, t2], alpha: 1, y: '-=20', duration: 900, ease: 'Sine.easeOut', hold: 2200, yoyo: true, onComplete: () => (t1.destroy(), t2.destroy()) });
    this.time.delayedCall(4600, () => this.phase === 'pack' && this.say("Check your load and re-tie anything loose, then Let's go!"));
  }

  /** Confetti and streamers over the new house when the truck pulls up. */
  private confetti() {
    for (let i = 0; i < 9; i++) this.time.delayedCall(i * 70 + Math.random() * 60, () => play('pop', 0.8, 0.8 + Math.random() * 0.6, Math.random() * 1.6 - 0.8));
    const cam = this.cameras.main;
    const colours = [0xee6a4d, 0xffb23f, 0x5daa7a, 0x3fa7b5, 0xf49aa0, 0xb9a3d6, 0xfff2da];
    for (let i = 0; i < 140; i++) {
      const side = i % 2 ? 1 : -1;
      const x0 = cam.scrollX + W / 2 + side * (W / 2 - 60);
      const y0 = cam.scrollY + H * 0.75;
      const bit = this.add.image(x0, y0, 'bit').setDepth(150).setTint(colours[i % colours.length]).setScale(1.4 + Math.random() * 1.2, 1 + Math.random() * 0.8);
      const peakX = x0 - side * (200 + Math.random() * 700);
      const peakY = cam.scrollY + 80 + Math.random() * 300;
      const delay = Math.random() * 250;
      this.tweens.add({
        targets: bit,
        x: peakX,
        y: { value: peakY, ease: 'Cubic.easeOut' },
        angle: (Math.random() - 0.5) * 720,
        duration: 700,
        delay,
        onComplete: () =>
          this.tweens.add({
            targets: bit,
            x: peakX + (Math.random() - 0.5) * 220,
            y: cam.scrollY + H + 40,
            angle: bit.angle + (Math.random() - 0.5) * 900,
            scaleX: { from: bit.scaleX, to: -bit.scaleX },
            duration: 2600 + Math.random() * 1600,
            ease: 'Sine.easeIn',
            onComplete: () => bit.destroy(),
          }),
      });
    }
  }

  /** Wind streaks past the truck when it is going fast. */
  private speedLines(forward: number) {
    if (this.phase !== 'drive' || forward < 7 || this.frame % 3 !== 0) return;
    const cam = this.cameras.main;
    const y = cam.scrollY + 160 + Math.random() * (GROUND - 300);
    const x = cam.scrollX + W + 40;
    const line = this.add.rectangle(x, y, 80 + forward * 16, 3, 0xfff6e4, 0.5).setDepth(55).setOrigin(0, 0.5);
    this.tweens.add({ targets: line, x: x - W * 0.7, alpha: 0, duration: 420, onComplete: () => line.destroy() });
  }

  private scenery() {
    const rnd = seeded(11);
    const meadow = this.leg.biome === 'meadow';
    // The biome: sky, layered scenery with haze between, weather, and its own roadside.
    // The world: this leg's biome and, where the leg begins, the last leg's, which it slowly turns into.
    this.worlds = [];
    const before = this.leg.n > 1 ? LEGS[this.leg.n - 2].biome : null;
    // Between the two, a tunnel: the last place's scenery up to its entrance, this one's from its exit.
    const tunnel = !!before && before !== this.leg.biome;
    if (before && tunnel) this.worlds.push(this.buildWorld(before, [-1000, TUNNEL.from - 300], true));
    this.worlds.push(this.buildWorld(this.leg.biome, tunnel ? [TUNNEL.to + 300, FINISH] : [-1000, FINISH], false));
    this.world = this.worlds[this.worlds.length - 1].built;
    this.tunnel = before && tunnel ? buildTunnel(this, before, this.leg.biome, groundY) : undefined;
    applyBiomeFX(this.cameras.main, this.leg.biome);
    const tun = (x: number) => inTunnel(x, tunnel);
    if (meadow) {
      const sun = this.add.image(1480, 250, 'sun').setScrollFactor(0.04).setDepth(-45);
      this.fx.light(sun, 0xffc65a, 0.75, 250, 0.12);
    }

    // The far side of the road: a strip of grass with a town on it, sliding by more slowly than the road.
    const far = meadow ? 0.6 : 0;
    const reach = W + WORLD_END * far;
    for (let x = -100; meadow && x < reach; x += 1000) {
      this.add.image(x, GROUND - 64, 'field').setOrigin(0, 0).setScrollFactor(far).setDepth(-22);
    }
    for (let x = 500; meadow && x < reach; x += 700) {
      this.add.image(x, GROUND - 30, 'pole').setOrigin(30 / 740, 1).setScrollFactor(far).setDepth(-21);
    }
    // The town starts past the first screen, so nothing stands right behind the parked truck.
    for (let x = 2000; meadow && x < reach; x += 320 + rnd() * 400) {
      const kind = Math.floor(rnd() * 4);
      if (kind === 3) this.add.image(x, GROUND - 30, 'fence').setOrigin(0, 1).setScrollFactor(far).setDepth(-20);
      else this.add.image(x, GROUND - 30, `town_${kind}`).setOrigin(0, 280 / 290).setScrollFactor(far).setDepth(-20).setScale(0.85 + rnd() * 0.25);
    }

    // This side of the road, behind the truck.
    // The two houses, standing on the ground line of their pictures. Their banners are written on in the game.
    // The old house only where the trip starts, the new one only where it ends.
    const houses = ([[-20, 'house_old', 'SOLD'], [FINISH + 250, 'house_new', 'WELCOME!']] as [number, string, string][]).filter(([, key]) => (key === 'house_old' ? this.leg.n === 1 : !this.leg.stop));
    this.chimneys = [];
    for (const [x0, key, words] of houses) {
      const k = 0.95;
      const groundY0 = GROUND + 6;
      this.inked(x0, groundY0, key).img.setOrigin(0, HOUSE.ground / HOUSE.h).setDepth(-10).setScale(k);
      const banner = key === 'house_old' ? HOUSE.oldBanner : HOUSE.banner;
      this.add.text(x0 + banner.x * k, groundY0 - (HOUSE.ground - banner.y) * k, words, { fontFamily: TITLE, fontSize: words.length > 5 ? '24px' : '30px', color: C.cream, stroke: C.ink, strokeThickness: 5 }).setOrigin(0.5).setDepth(-9.9).setRotation(-0.03);
      this.chimneys.push({ x: x0 + HOUSE.chimney.x * k, y: groundY0 - (HOUSE.ground - HOUSE.chimney.y) * k, kind: key === 'house_old' ? 'old' : 'new', n: 0 });
    }
    // The stops: the one this leg starts from, and the one it ends at.
    this.stopAnims = [];
    if (this.leg.n > 1) this.stopAt(TRUCK_X + 120, LEGS[this.leg.n - 2].stop!);
    if (this.leg.stop) this.stopAt(FINISH + 490, this.leg.stop);
    for (let x = 2200, i = 0; meadow && x < FINISH - 200; x += 520 + ((i * 173) % 300), i++) {
      if (tun(x)) continue;
      this.add.image(x, groundY(x) + 10, MEADOW_TREES[(i * 7) % MEADOW_TREES.length]).setOrigin(0.5, 1).setDepth(-9).setScale(0.85 + ((i * 37) % 30) / 100).setFlipX(i % 2 === 1);
    }
    // Warning signs before each run of bumps and each big hill, worked out from the road itself.
    const bumps = this.leg.features
      .filter(([, h]) => h > 0 && h < 60)
      .map(([x, , w]) => x - w * 4)
      .filter((x, i, all) => i === 0 || x - all[i - 1] > 900)
      .filter((x) => x > 2000);
    // (Nothing in front of the stop the leg starts from.)
    const hills = this.leg.features.filter(([, h]) => h >= 60).map(([x, , w]) => x - w * 2.4).filter((x) => x > 2000);
    for (const x of bumps) this.add.image(x, groundY(x) + 8, 'sign_bump').setOrigin(0.5, 1).setDepth(-6).setScale(0.8);
    for (const x of hills.filter((h) => this.leg.gates.every((g) => Math.abs(g - h) > 400))) this.add.image(x, groundY(x) + 8, 'sign_hill').setOrigin(0.5, 1).setDepth(-6).setScale(0.8);
    for (let x = 4600; x < FINISH - 1500; x += 4000) {
      if (tun(x)) continue;
      const km = Math.round((FINISH - x) / 1000);
      this.add.image(x, groundY(x) + 10, 'milestone').setOrigin(0.5, 1).setDepth(-6).setScale(0.75);
      this.add.text(x, groundY(x) - 34, `${km} km`, { fontFamily: TITLE, fontSize: '22px', color: C.ink }).setOrigin(0.5).setDepth(-5.9);
      this.add.text(x, groundY(x) - 66, this.leg.stop ? 'NEXT STOP' : 'HOME', { fontFamily: TEXT, fontSize: this.leg.stop ? '12px' : '15px', color: C.cream }).setOrigin(0.5).setDepth(-5.9);
    }
    // Signs from the locals, who have seen a lot of people try this.
    const jokes = this.leg.jokes;
    for (const [x, words] of jokes) {
      const tilt = ((x * 31) % 7 - 3) * 0.012;
      // The board stands on the ground; the words are shrunk until they fit inside its plank, and tilt with it.
      const k = 0.8;
      const foot = groundY(x) + 10;
      this.add.image(x, foot, 'sign_plank').setOrigin(0.5, 1).setDepth(-6).setScale(k).setRotation(tilt);
      const label = this.add.text(0, 0, words, { fontFamily: TITLE, fontSize: '26px', color: C.ink, align: 'center', lineSpacing: -2 }).setOrigin(0.5).setDepth(-5.9).setRotation(tilt);
      label.setScale(Math.min(1, (PLANK.text.w * k) / label.width, (PLANK.text.h * k) / label.height));
      // Where the middle of the plank lands once the board is turned about its foot.
      const dx = (PLANK.text.x - PLANK.w / 2) * k;
      const dy = (PLANK.text.y - PLANK.h) * k;
      label.setPosition(x + dx * Math.cos(tilt) - dy * Math.sin(tilt), foot + dx * Math.sin(tilt) + dy * Math.cos(tilt));
    }
    this.buildGates();
    this.buildBay();
    this.add.image(FINISH - 700, groundY(FINISH - 700) + 8, 'sign_home').setOrigin(0.5, 1).setDepth(-6).setScale(0.85);
    for (let x = 1960; BIOMES[this.leg.biome].lamps && x < FINISH + 300; x += 1250 + rnd() * 500) {
      if (tun(x)) continue;
      this.add.image(x, groundY(x) + 6, 'lamppost').setOrigin(47 / 140, 396 / 400).setDepth(-8);
      // The lantern is a separate bright shape, so the glow does not spill over the dark post.
      const lamp = this.add.image(x + 57, groundY(x) - 352, 'spark').setDepth(-7).setScale(0.62, 0.5).setTint(0xfff0b4);
      this.fx.light(lamp, 0xffbf4d, 0.85, 80, 0.2);
    }
    const growing = !['snow', 'town'].includes(this.leg.biome);
    for (let x = 820; growing && x < WORLD_END; x += 380 + rnd() * 620) {
      if (tun(x)) continue;
      this.add.image(x, groundY(x) + 16, `bush_${Math.floor(rnd() * 2)}`).setOrigin(0.5, 1).setDepth(-7).setScale(0.7 + rnd() * 0.4);
    }
    for (let x = WORLD_START + 80; growing && x < WORLD_END; x += 70 + rnd() * 170) {
      const key = rnd() < 0.22 ? `flower_${Math.floor(rnd() * 2)}` : `tuft_${Math.floor(rnd() * 2)}`;
      if (tun(x)) continue;
      this.add.image(x, groundY(x) + 8, key).setOrigin(0.5, 1).setDepth(-1).setFlipX(rnd() < 0.5);
    }
    // Stones and cracks in the earth under the road.
    for (let x = WORLD_START + 40; x < WORLD_END; x += 90 + rnd() * 190) {
      this.add.image(x, groundY(x) + 58 + rnd() * 40, `pebble_${Math.floor(rnd() * 3)}`).setDepth(1).setRotation((rnd() - 0.5) * 0.5);
    }
    // Close to the camera: a strip of tall grass and wildflowers, sliding by faster than the road.
    const near = 1.3;
    this.grassBands = [];
    const legsGrass = this.worlds.length > 1 ? [this.leg.n - 1, this.leg.n] : [this.leg.n];
    for (const n of legsGrass) {
      const strips: Phaser.GameObjects.Image[] = [];
      for (let x = -200; x < W + WORLD_END * near; x += 1200) strips.push(this.add.image(x, H + 40, LEGS[n - 1].biome === 'town' ? 'town_wet' : LEGS[n - 1].biome === 'snow' ? 'snow_near' : grassKey(n)).setOrigin(0, 1).setScrollFactor(near, 1).setDepth(n === this.leg.n ? 60.1 : 60));
      this.grassBands.push({ strips, prev: n !== this.leg.n });
    }

    if (this.leg.n === 1) this.add.text(960, 70, 'Shifting Day', { fontFamily: TITLE, fontSize: '120px', color: C.terracotta, stroke: C.ink, strokeThickness: 12 }).setOrigin(0.5, 0).setDepth(-5);
    if (this.leg.n === 1) this.add.text(960, 222, 'Moving day. One small truck. Everything shifts.', { fontFamily: TEXT, fontSize: '38px', color: C.ink }).setOrigin(0.5, 0).setDepth(-5);
    if (!this.leg.stop) this.add.text(FINISH + 700, 16, 'Home!', { fontFamily: TITLE, fontSize: '96px', color: C.mustard, stroke: C.ink, strokeThickness: 10 }).setOrigin(0.5, 0).setDepth(-5);
  }

  private road() {
    for (let x0 = WORLD_START, i = 0; x0 < WORLD_END; x0 += CHUNK, i++) {
      this.add.image(x0, CHUNK_TOP, groundKey(this.leg.n, i)).setOrigin(0, 0).setDepth(0);
    }
    const step = 30;
    const thick = 80;
    const slabs: Body[] = [];
    for (let x = WORLD_START; x < WORLD_END; x += step) {
      // Each piece is a four-sided block whose top edge runs exactly along the road from x to x + step,
      // so neighbouring pieces share their edges and the wheels roll over the joins without a bump.
      const y1 = groundY(x);
      const y2 = groundY(x + step);
      const quad = [
        { x, y: y1 },
        { x: x + step, y: y2 },
        { x: x + step, y: y2 + thick },
        { x, y: y1 + thick },
      ];
      const cx = quad.reduce((n, p) => n + p.x, 0) / 4;
      const cy = quad.reduce((n, p) => n + p.y, 0) / 4;
      const slab = M.Bodies.fromVertices(cx, cy, [quad], { isStatic: true, friction: 1, frictionStatic: 2, label: 'road' });
      // fromVertices centres the shape on its centre of mass; put its top edge back exactly on the road.
      const top = slab.vertices.reduce((m: number, v: { y: number }) => Math.min(m, v.y), Infinity);
      M.Body.setPosition(slab, { x: slab.position.x + (x + step / 2 - (slab.bounds.min.x + slab.bounds.max.x) / 2), y: slab.position.y + (Math.min(y1, y2) - top) });
      slabs.push(slab);
    }
    // Walls at both ends of the world.
    slabs.push(M.Bodies.rectangle(WORLD_START - 40, GROUND - 400, 80, 1200, { isStatic: true, label: 'road' }));
    slabs.push(M.Bodies.rectangle(WORLD_END + 40, GROUND - 400, 80, 1200, { isStatic: true, label: 'road' }));
    // Hundreds of road pieces make the physics slow, and the truck only ever touches the few beside it.
    // So the road is kept in pieces, and only those near the truck are in the world at any moment.
    this.slabs = slabs;
    this.slabsIn = new Set();
    this.nearRoad(0, true);
  }

  /** Puts the road pieces within reach of this x into the physics world, and takes the others out. */
  private nearRoad(x: number, force = false) {
    if (!force && Math.abs(x - this.roadAt) < 250) return;
    this.roadAt = x;
    const from = x - 1700;
    const to = x + 2700;
    const keep: Body[] = [];
    for (const b of this.slabs) {
      const near = b.bounds.max.x > from && b.bounds.min.x < to;
      const there = this.slabsIn.has(b);
      if (near && !there) keep.push(b);
      else if (!near && there) {
        this.matter.world.remove(b);
        this.slabsIn.delete(b);
      }
    }
    if (keep.length) this.matter.world.add(keep);
    for (const b of keep) this.slabsIn.add(b);
  }

  private truck() {
    const t = TRUCK;
    const ax = TRUCK_X;
    const ay = GROUND - t.wheelR - t.wheels[0].y;
    const part = (x: number, y: number, w: number, h: number, density = 0.0015) => M.Bodies.rectangle(ax + x + w / 2, ay + y + h / 2, w, h, { density });
    const parts = [
      part(t.bed.x, 0, t.bed.w, t.bed.t),
      part(t.tailgate.x, -t.tailgate.h, t.tailgate.w, t.tailgate.h + t.bed.t),
      part(t.cab.x, t.cab.top, t.cab.w, 26 - t.cab.top),
      part(t.hood.x, t.hood.top, t.hood.w, 26 - t.hood.top),
      part(t.frame.x, t.frame.y, t.frame.w, t.frame.h, 0.03),
    ];
    const filter = { group: TRUCK_GROUP };
    // No air friction from the physics engine: the drivetrain models drag itself (counting it twice stole 4th gear).
    this.chassis = M.Body.create({ parts, friction: 0.9, frictionStatic: 1.6, frictionAir: 0.003, collisionFilter: filter, label: 'truck', sleepThreshold: Infinity });
    this.anchor = { x: ax - this.chassis.position.x, y: ay - this.chassis.position.y };
    this.matter.world.add(this.chassis);

    for (const w of t.wheels) {
      const wheel = M.Bodies.circle(ax + w.x, ay + w.y, t.wheelR, { friction: 0, frictionStatic: 0, frictionAir: 0, density: 0.02, restitution: 0.05, collisionFilter: filter, label: 'wheel', sleepThreshold: Infinity });
      const axle = M.Constraint.create({
        bodyA: this.chassis,
        pointA: { x: ax + w.x - this.chassis.position.x, y: ay + w.y - this.chassis.position.y },
        bodyB: wheel,
        length: 0,
        stiffness: 0.75,
        damping: 0.55,
      });
      // Handbrake: the wheels cannot move until the player sets off.
      M.Body.setStatic(wheel, true);
      this.matter.world.add([wheel, axle]);
      this.wheels.push(wheel);
      // Mismatched: knobbies at the back, an old red steelie at the front.
      this.wheelImgs.push(this.inked(0, 0, this.wheels.length === 2 ? 'wheel_front' : 'wheel').img.setDepth(12));
    }
    // While it is being loaded the truck is held perfectly still, so it cannot sag on its springs and tip the load.
    M.Body.setStatic(this.chassis, true);
    this.truckImg = this.inked(0, 0, 'truck').img.setOrigin(t.ox / t.w, t.oy / t.h).setDepth(10);
    // The bed's side and tailgate, drawn over the load so it sits inside the bed.
    this.truckFront = this.inked(0, 0, 'truck_front').img.setOrigin(t.ox / t.w, t.oy / t.h).setDepth(21);
    this.truckShadow = this.add.image(0, 0, 'shadow').setDepth(2);
    // The headlight glows from behind the eye.
    this.headlight = this.add.image(0, 0, 'spark').setDepth(11).setScale(0.52, 0.62).setAlpha(0);
    this.fx.light(this.headlight, 0xffc457, 0.6, 76, 0.1);
    this.driver = this.inked(0, 0, 'driver_calm');
    this.driver.img.setOrigin(DRIVER.head.x / DRIVER.w, DRIVER.head.y / DRIVER.h).setDepth(10.3);
    this.eye = this.inked(0, 0, 'eye_open');
    this.eye.img.setDepth(11.5);
    this.freshener = this.inked(0, 0, 'freshener').img.setOrigin(0.5, 2 / 62).setDepth(10.6);
    this.aerial = this.inked(0, 0, 'aerial').img.setOrigin(10 / 52, 96 / 100).setDepth(9.5);
    this.decal = this.add.text(0, 0, 'SHIFT HAPPENS', { fontFamily: TITLE, fontSize: '22px', color: C.terracotta }).setOrigin(0.5).setDepth(21.5);
    this.decal.setScale(Math.min(1, 176 / this.decal.width));
  }

  private household() {
    if (this.leg.n > 1) return this.restoreCargo();
    // Piles on the pavement: each pile is a list of rows, bottom row first. "~" lays a thing on its side.
    const piles: { cx: number; rows: string[][] }[] = [
      { cx: 175, rows: [['sofa'], ['mattress'], ['rug'], ['lamp~'], ['box_s', 'jam', 'box_s']] },
      { cx: 400, rows: [['fridge'], ['cat']] },
      { cx: 545, rows: [['bookshelf'], ['box_m'], ['plant']] },
      { cx: 690, rows: [['box_l'], ['box_m'], ['fish']] },
      { cx: 835, rows: [['suitcase'], ['toolbox'], ['record']] },
      { cx: 975, rows: [['armchair'], ['guitar~'], ['bird']] },
      { cx: 1100, rows: [['washer'], ['tv'], ['chair']] },
      { cx: 1196, rows: [['clock']] },
    ];
    for (const pile of piles) {
      let floor = GROUND;
      for (const row of pile.rows) {
        const entries = row.map((name) => {
          const side = name.endsWith('~');
          const spec = ITEMS.find((s) => s.key === name.replace('~', ''))!;
          return { spec, side, w: side ? spec.h : spec.w, h: side ? spec.w : spec.h };
        });
        const total = entries.reduce((sum, e) => sum + e.w, 0) + (entries.length - 1) * 8;
        let x = pile.cx - total / 2;
        for (const e of entries) {
          this.addThing(e.spec, x + e.w / 2, floor - e.h / 2 - 1, e.side ? Math.PI / 2 : 0);
          x += e.w + 8;
        }
        floor -= Math.max(...entries.map((e) => e.h)) + 1;
      }
    }
  }

  private addThing(spec: ItemSpec, x: number, y: number, angle: number) {
    const opts = { density: spec.density, friction: spec.friction, frictionStatic: spec.friction * 1.6, restitution: spec.bounce ?? 0.02, frictionAir: 0.012, angle, label: spec.key };
    const body = spec.round ? M.Bodies.circle(x, y, spec.w / 2, opts) : M.Bodies.rectangle(x, y, spec.w, spec.h, { ...opts, chamfer: { radius: spec.pet ? 18 : 7 } });
    this.matter.world.add(body);
    const ink = this.inked(x, y, spec.pet ? `${spec.key}_calm` : spec.key);
    const img = ink.img.setDepth(20);
    const shadow = this.add.image(x, GROUND, 'shadow').setDepth(2);
    const thing: Thing = { spec, body, img, ink, shadow, aboard: true, broken: false, ghost: false, groundFrames: 0, mood: 'calm', moodUntil: 0 };
    if (spec.key === 'fish') {
      const spark = this.add.image(x, y, 'spark').setDepth(21).setScale(0.3, 0.22).setTint(0xffffff).setRotation(-0.7);
      this.fx.light(spark, 0xffd873, 0.8, 42, 0.3);
      thing.spark = { img: spark, dx: -spec.w * 0.2, dy: -spec.w * 0.3 };
    }
    this.things.push(thing);
    this.byBody.set(body.id, thing);
  }

  private button(x: number, y: number, key: string, text: string, size: number, onClick: () => void) {
    const bg = this.add.image(0, 0, key);
    const label = this.add.text(0, -6, text, { fontFamily: TITLE, fontSize: `${size}px`, color: C.ink }).setOrigin(0.5);
    bg.setScrollFactor(0);
    label.setScrollFactor(0);
    const box = this.add.container(x, y, [bg, label]).setScrollFactor(0).setDepth(100);
    bg.setInteractive({ cursor: CURSOR.open });
    bg.on('pointerdown', (_p: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      play('click');
      onClick();
    });
    bg.on('pointerover', () => box.setScale(1.05));
    bg.on('pointerout', () => box.setScale(1));
    return { box, label };
  }

  private hud() {
    const style = { fontFamily: TEXT, fontSize: '40px', color: C.ink };
    this.hint = this.add.text(40, 1006, '', { ...style, fontSize: '32px', backgroundColor: C.cream, padding: { x: 20, y: 10 } }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    this.toastChip = this.add.rectangle(W / 2, 330, 10, 10, INK_BG, 0.55).setOrigin(0.5).setStrokeStyle(2, 0xfff2da, 0.25).setScrollFactor(0).setDepth(99).setAlpha(0);
    this.toast = this.add.text(W / 2, 330, '', toastText(46)).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);
    this.ropeLines = this.add.graphics().setDepth(25);

    // Top right: the points on the truck, and how far along the road it is.
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T) => o.setScrollFactor(0).setDepth(100);
    fixed(this.add.image(W - 8, 4, 'card').setOrigin(1, 0));
    fixed(this.add.image(W - 530, 64, 'coin').setScale(0.9));
    this.hudHearts = fixed(this.add.text(W - 500, 64, '', { fontFamily: TITLE, fontSize: '40px', color: C.ink }).setOrigin(0, 0.5));
    this.hudLabel = fixed(this.add.text(W - 330, 64, '', { ...style, fontSize: '30px', color: C.walnut }).setOrigin(0, 0.5));
    this.hudBar = fixed(this.add.graphics());
    this.hudHomes = [fixed(this.add.image(W - 360, 62, 'house_old#0').setScale(0.075)), fixed(this.add.image(W - 66, 62, 'house_new#0').setScale(0.075))];
    this.hudTruck = fixed(this.add.image(W - 330, 54, 'truck#0').setScale(0.1));

    this.tag = this.add
      .text(0, 0, '', { fontFamily: TEXT, fontSize: '28px', color: C.ink, align: 'center', backgroundColor: C.cream, padding: { x: 16, y: 8 }, lineSpacing: -2 })
      .setOrigin(0.5, 1)
      .setDepth(120)
      .setVisible(false);

    // The dashboard appears when the truck sets off.
    this.dash = new Dash(this, () => this.drive);
    this.dash.create();
    // The sound and effects toggles: small chips, not shouting for attention next to the resource HUD.
    if (this.fx.available) {
      this.fxChip = chip(this, 40, 34, 190, 44).setScrollFactor(0).setDepth(100).setInteractive({ cursor: CURSOR.open });
      this.fxLabel = this.add.text(56, 34, '', uiText(22)).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
      this.fxChip.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.toggleFx();
      });
      this.showFx();
    }

    const soundY = this.fx.available ? 86 : 34;
    const soundChip = chip(this, 40, soundY, 190, 44).setScrollFactor(0).setDepth(100).setInteractive({ cursor: CURSOR.open });
    const soundLabel = this.add.text(56, soundY, '', uiText(22)).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    const showSound = () => {
      soundLabel.setText(`Sound: ${audio.muted ? 'off' : 'on'}  (M)`);
      soundChip.setSize(soundLabel.width + 32, 44);
    };
    soundChip.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      audio.toggleMute();
      showSound();
    });
    this.input.keyboard!.on('keydown-M', showSound);
    showSound();

    this.goButton = this.button(W - 210, 990, 'btn', "Let's go!", 50, () => this.go()).box;
    const rope = this.button(W - 560, 990, 'btn_rope', '', 42, () => this.setRoping(!this.roping));
    this.ropeButton = rope.box;
    this.ropeLabel = rope.label;
    this.setRoping(false);
  }

  /** ESC: a pause menu over everything, the engine silenced, Matter and tweens frozen while it's up. */
  private togglePause() {
    // Escape closes whatever is on top first - the Lost & Found, if that's what is open - rather than
    // opening the pause menu underneath it.
    if (this.lostFoundPanel) return this.closeLostFound();
    if (this.phase === 'done' || this.phase === 'intro') return;
    if (this.pauseUi) this.closePause();
    else this.openPause();
  }

  private openPause() {
    this.paused = true;
    this.matter.pause();
    this.tweens.pauseAll();
    this.engine.stop();
    play('click');
    const cx = W / 2;
    const cy = H / 2;
    const ui = this.add.container(0, 0).setScrollFactor(0).setDepth(300);
    this.pauseUi = ui;
    ui.add(this.add.rectangle(cx, cy, W, H, 0x120d1f, 0.68).setScrollFactor(0));
    ui.add(this.add.rectangle(cx, cy, 580, 560, 0x2a2140).setScrollFactor(0));
    ui.add(this.add.rectangle(cx, cy, 554, 534, 0xfff4e0).setScrollFactor(0));
    ui.add(this.add.text(cx, cy - 210, 'PAUSED', headingText(56, C.ink)).setOrigin(0.5).setScrollFactor(0));
    const resume = this.button(cx, cy - 100, 'btn', 'Resume', 36, () => this.closePause());
    ui.add([resume.box]);
    const sound = this.button(cx, cy + 10, 'btn_rope', '', 28, () => {
      audio.toggleMute();
      showSound();
    });
    const showSound = () => sound.label.setText(`Sound: ${audio.muted ? 'off' : 'on'}`);
    showSound();
    ui.add([sound.box]);
    const restart = this.button(cx, cy + 120, 'btn_rope', 'Restart leg', 30, () => {
      this.closePause();
      void this.scene.restart({ leg: this.leg.n, trip: this.trip });
    });
    ui.add([restart.box]);
    const quit = this.button(cx, cy + 220, 'btn_rope', 'Quit to title', 30, () => {
      this.closePause();
      this.scene.start('title');
    });
    ui.add([quit.box]);
    for (const box of [resume.box, sound.box, restart.box, quit.box]) box.setDepth(100);
  }

  private closePause() {
    if (!this.pauseUi) return;
    this.pauseUi.destroy(true);
    this.pauseUi = undefined;
    this.paused = false;
    this.matter.resume();
    this.tweens.resumeAll();
    if (this.phase === 'drive') this.engine.start();
    play('click');
  }

  private toggleFx() {
    this.fx.toggle();
    this.showFx();
  }

  private showFx() {
    this.fxLabel.setText(`Effects: ${this.fx.enabled ? 'on' : 'off'}  (F)`);
    this.fxChip.setSize(this.fxLabel.width + 32, 44);
  }

  private valueOf(t: Thing) {
    return VALUE[t.spec.key] ?? 10;
  }

  /** Shows a thing's name and worth above it, or hides the tag. */
  private showTag(t: Thing | null) {
    this.tagFor = t;
    if (!t) return this.tag.setVisible(false);
    const notes = [t.spec.pet ? 'pet' : '', t.spec.fragile ? 'fragile' : ''].filter(Boolean).join(' · ');
    this.tag.setText(`${t.spec.name}\n★ ${this.valueOf(t)} points${notes ? `  ·  ${notes}` : ''}`).setVisible(true);
    this.tag.setColor(t.spec.fragile ? C.terracottaDark : C.ink);
  }

  /** A number that floats up from a point in the world and fades: points won or lost. */
  private floatText(x: number, y: number, text: string, colour: string) {
    const t = this.add.text(x, y, text, { fontFamily: TITLE, fontSize: '40px', color: colour, stroke: C.ink, strokeThickness: 7 }).setOrigin(0.5).setDepth(130);
    this.tweens.add({ targets: t, y: y - 90, alpha: 0, duration: 1400, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
  }

  /** Sets the mouse pointer, only when it changes. */
  private pointer(kind: keyof typeof CURSOR) {
    if (kind === this.cursorNow) return;
    this.cursorNow = kind;
    this.input.setDefaultCursor(CURSOR[kind]);
  }

  /** While packing: a fist while dragging, an open hand over something that can be picked up, a rope coil in rope mode. */
  private choosePointer() {
    if (this.phase !== 'pack') {
      if (this.tagFor) this.showTag(null);
      return this.pointer('point');
    }
    const p = this.input.activePointer;
    p.updateWorldPoint(this.cameras.main);
    const hit = M.Query.point(this.things.filter((t) => !t.ghost).map((t) => t.body), { x: p.worldX, y: p.worldY }) as Body[];
    const over = this.held?.thing ?? this.things.filter((t) => hit.includes(t.body)).pop() ?? null;
    if (over !== this.tagFor) this.showTag(over);
    if (over) this.tag.setPosition(over.body.position.x, over.body.bounds.min.y - 12);
    if (this.held) return this.pointer('grab');
    if (this.roping) return this.pointer('rope');
    this.pointer(over ? 'open' : 'point');
  }

  /** Rope mode: the next click ties a thing down, or unties it. */
  private setRoping(on: boolean) {
    this.roping = on && this.phase === 'pack';
    this.ropeLabel.setText(`Rope × ${this.ropesLeft}`).setColor(this.roping ? C.terracottaDark : C.ink);
    if (this.phase !== 'pack') return;
    this.hint.setText(this.roping ? 'Click a thing on the truck to tie it down.   Click a tied thing to untie it.' : 'Drag things on to the truck.   Scroll or Q / E to turn them.   R for rope.');
    this.pointer(this.roping ? 'rope' : 'point');
  }

  private controls() {
    const kb = this.input.keyboard!;
    this.keys = {
      left: kb.addKey('LEFT'),
      right: kb.addKey('RIGHT'),
      a: kb.addKey('A'),
      d: kb.addKey('D'),
      q: kb.addKey('Q'),
      e: kb.addKey('E'),
      r: kb.addKey('R'),
      f: kb.addKey('F'),
      shift: kb.addKey('SHIFT'),
      ctrl: kb.addKey('CTRL'),
      up: kb.addKey('UP'),
      down: kb.addKey('DOWN'),
      n: kb.addKey('N'),
      one: kb.addKey('ONE'),
      two: kb.addKey('TWO'),
      three: kb.addKey('THREE'),
      four: kb.addKey('FOUR'),
      p: kb.addKey('P'),
      w: kb.addKey('W'),
      space: kb.addKey('SPACE'),
      esc: kb.addKey('ESC'),
    };
    this.keys.esc.on('down', () => this.togglePause());
    this.keys.p.on('down', () => this.toggleHandbrake());
    this.keys.space.on('down', () => this.toggleHandbrake());
    this.input.mouse?.disableContextMenu();
    const turn = (by: number) => {
      if (this.held) this.held.angle += by;
    };
    this.keys.q.on('down', () => (this.phase === 'drive' ? this.gearShift(-1) : turn(-Math.PI / 12)));
    this.keys.e.on('down', () => (this.phase === 'drive' ? this.gearShift(1) : turn(Math.PI / 12)));
    this.keys.shift.on('down', () => this.gearShift(1));
    this.keys.up.on('down', () => this.gearShift(1));
    this.keys.ctrl.on('down', () => this.gearShift(-1));
    this.keys.down.on('down', () => this.gearShift(-1));
    const pick: [Phaser.Input.Keyboard.Key, Gear][] = [[this.keys.one, 1], [this.keys.two, 2], [this.keys.three, 3], [this.keys.four, 4], [this.keys.n, 'N']];
    for (const [key, gear] of pick) key.on('down', () => this.gearTo(gear));
    this.keys.r.on('down', () => (this.phase === 'drive' ? this.gearTo('R') : this.setRoping(!this.roping)));
    this.keys.f.on('down', () => this.fx.available && this.toggleFx());
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => turn(Math.sign(dy) * (Math.PI / 12)));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Driving: left click fires the anchor crossbow; right click lets the cable go.
      if (this.phase === 'drive') {
        if (p.rightButtonDown()) this.crossbow.release();
        else this.crossbow.fire();
        return;
      }
      if (this.phase !== 'pack') return;
      if (this.held && p.rightButtonDown()) return turn(Math.PI / 2);
      const hit = M.Query.point(this.things.map((t) => t.body), { x: p.worldX, y: p.worldY }) as Body[];
      if (!hit.length) return;
      const thing = this.things.filter((t) => hit.includes(t.body)).pop()!;
      if (this.roping) {
        if (thing.rope) this.untie(thing, true);
        else this.tie(thing);
        return;
      }
      if (thing.rope) this.untie(thing, true);
      const snap = Math.PI / 12;
      this.held = { thing, dx: p.worldX - thing.body.position.x, dy: p.worldY - thing.body.position.y, angle: Math.round(thing.body.angle / snap) * snap };
      thing.img.setDepth(30);
      this.fx.pulse(thing.img, 0xffc24d, 0.85, 650);
      play('pick');
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.held || p.rightButtonReleased()) return;
      const b = this.held.thing.body;
      M.Body.setVelocity(b, { x: b.velocity.x * 0.25, y: b.velocity.y * 0.25 });
      this.held.thing.img.setDepth(20);
      const dropped = this.held.thing;
      this.held = null;
      play('drop');
      this.time.delayedCall(450, () => {
        if (this.phase === 'pack' && this.onTruck(dropped)) this.floatText(dropped.body.position.x, dropped.body.bounds.min.y - 20, `+${this.valueOf(dropped)}`, C.mustard);
      });
    });
  }

  private say(text: string) {
    this.toast.setText(text).setAlpha(1).setY(330);
    this.toastChip.setSize(this.toast.width + 64, this.toast.height + 34).setAlpha(1).setY(330);
    this.tweens.killTweensOf([this.toast, this.toastChip]);
    this.tweens.add({ targets: [this.toast, this.toastChip], alpha: 0, y: 290, delay: 1100, duration: 500 });
  }

  /** Where the middle of the top of the truck bed is. */
  private bed() {
    const c = this.chassis;
    const cos = Math.cos(c.angle);
    const sin = Math.sin(c.angle);
    return { x: c.position.x + this.anchor.x * cos - this.anchor.y * sin, y: c.position.y + this.anchor.x * sin + this.anchor.y * cos, cos, sin };
  }

  /** True when a thing is resting on the road and not on the truck. */
  private onRoad(t: Thing): boolean {
    return t.body.bounds.max.y > groundY(t.body.position.x) - 10;
  }

  /** True when a thing is sitting on the truck, or on something that is. */
  private onTruck(t: Thing): boolean {
    const dx = t.body.position.x - this.bed().x;
    return !this.onRoad(t) && dx > TRUCK.bed.x - 40 && dx < TRUCK.cab.x + 60;
  }

  private tie(t: Thing) {
    if (!this.onTruck(t)) return this.say('Rope only holds things that are on the truck.');
    if (this.ropesLeft < 1) return this.say('No rope left. Untie something first.');
    const bed = this.bed();
    const lo = TRUCK.bed.x + TRUCK.tailgate.w + 6;
    const hi = TRUCK.cab.x - 6;
    const b = t.body;
    const half = (b.bounds.max.x - b.bounds.min.x) / 2 + 16;
    const mid = Phaser.Math.Clamp(b.position.x - bed.x, lo, hi);
    const onBed = (along: number) => ({ x: bed.x + along * bed.cos, y: bed.y + along * bed.sin });
    const hookL = onBed(Phaser.Math.Clamp(mid - half, lo, hi));
    const hookR = onBed(Phaser.Math.Clamp(mid + half, lo, hi));
    // Lay the rope from one ring, up and over the top of the thing (and anything stacked on it), down to the other.
    const top = b.bounds.min.y - 8;
    const path = [hookL, { x: b.bounds.min.x - 4, y: top }, { x: b.bounds.max.x + 4, y: top }, hookR];
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const c = path[i + 1];
      const n = Math.max(1, Math.round(Math.hypot(c.x - a.x, c.y - a.y) / ROPE_LINK));
      for (let k = 0; k < n; k++) pts.push({ x: a.x + ((c.x - a.x) * k) / n, y: a.y + ((c.y - a.y) * k) / n });
    }
    pts.push(hookR);
    let laid = 0;
    for (let i = 1; i < pts.length; i++) laid += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    // Each link is a little shorter than the gap it was laid in, so the whole rope pulls tight.
    const gap = (laid / (pts.length - 1)) * 0.93;
    const links: Body[] = pts.map((p) =>
      M.Bodies.circle(p.x, p.y, 4.5, {
        density: 0.004,
        friction: 0.9,
        frictionAir: 0.04,
        collisionFilter: { group: TRUCK_GROUP, category: ROPE_CATEGORY, mask: 0x0001 },
        label: 'rope',
      }),
    );
    const joins: any[] = [];
    for (let i = 1; i < links.length; i++) {
      joins.push(M.Constraint.create({ bodyA: links[i - 1], bodyB: links[i], length: gap, stiffness: 0.95, damping: 0.08 }));
    }
    // The two ends are tied to rings on the bed.
    for (const [link, hook] of [[links[0], hookL], [links[links.length - 1], hookR]] as const) {
      joins.push(M.Constraint.create({ bodyA: this.chassis, pointA: { x: hook.x - this.chassis.position.x, y: hook.y - this.chassis.position.y }, bodyB: link, length: 0, stiffness: 1, damping: 0.1 }));
    }
    this.matter.world.add([...links, ...joins]);
    t.rope = { links, joins };
    this.ropesLeft--;
    this.fx.pulse(t.img, 0xff9a3c, 0.95, 750);
    play('tie');
    this.setRoping(false);
  }

  private untie(t: Thing, giveBack: boolean) {
    if (!t.rope) return;
    for (const j of t.rope.joins) this.matter.world.remove(j);
    for (const l of t.rope.links) this.matter.world.remove(l);
    t.rope = undefined;
    if (giveBack) {
      this.ropesLeft++;
      play('untie');
    }
    this.setRoping(false);
  }

  private go() {
    if (this.phase !== 'pack') return;
    if (this.held) {
      this.held.thing.img.setDepth(20);
      this.held = null;
    }
    if (!this.things.some((t) => this.onTruck(t))) return this.say('Put something on the truck first!');
    for (const t of this.things) {
      if (!this.onTruck(t)) this.leave(t);
      else t.packed = true;
    }
    this.setRoping(false);
    this.phase = 'drive';
    M.Body.setStatic(this.chassis, false);
    for (const w of this.wheels) M.Body.setStatic(w, false);
    // Everything on board stays awake from now on, so it moves with the truck.
    for (const t of this.things) {
      if (!t.aboard) continue;
      t.body.sleepThreshold = Infinity;
      M.Sleeping.set(t.body, false);
    }
    this.goButton.setVisible(false);
    this.ropeButton.setVisible(false);
    this.pointer('point');
    this.hint.setPosition(DASH_RIGHT + 24, 1046).setFontSize(24).setText('D gas    A brake    P handbrake    SHIFT / CTRL gears    CLICK fire anchor    W reel in    RIGHT-CLICK let go');
    this.dash.show(true);
    this.handbrake = true;
    this.say("Handbrake's on. Press P to let it off, then hold D. Change up with SHIFT when the gear goes red.");
    play('honk');
    this.engine.start();
    music.play('drive');
    ambience.birds(false);
  }

  /** The truck's speed along its own length, forwards positive. */
  private forwardSpeed() {
    const c = this.chassis;
    return c.velocity.x * Math.cos(c.angle) + c.velocity.y * Math.sin(c.angle);
  }

  private gearShift(dir: 1 | -1) {
    if (this.phase !== 'drive') return;
    this.shifted(this.drive.shift(dir, this.forwardSpeed()));
  }

  /** Moves the lever straight to a gear: from a number key, or a click on the gate. */
  private gearTo(gear: Gear) {
    if (this.phase !== 'drive') return;
    this.shifted(this.drive.shiftTo(gear, this.forwardSpeed()));
  }

  private shifted(result: { ok: boolean; why?: string }) {
    if (result.ok) {
      play('clunk');
      return;
    }
    if (!result.why) return;
    play('grind');
    this.say(result.why);
    this.cameras.main.shake(120, 0.0015);
    this.lookStartled(500);
  }

  private lookStartled(ms: number) {
    this.eyeMood = 'wide';
    this.eyeUntil = this.time.now + ms;
  }

  /** A clutch biting on a mismatch: the truck lurches, the load slides, and the eye pops. */
  private jolted(jolt: number) {
    const size = Math.abs(jolt);
    if (size < 0.25) return;
    if (size > 0.6) this.cameras.main.shake(110, Math.min(0.003, size * 0.0015));
    thud(size * 4);
    this.lookStartled(450);
    if (jolt > 0.3) this.backfire();
    if (size > 0.7 && !this.joltTip) {
      this.joltTip = true;
      this.say(jolt > 0 ? 'Lurch! Ease off the gas before you shift.' : 'Clunk! Too slow for that gear: rev a little first.');
    }
  }

  /** Puts something at a point on the truck, given in the truck's own coordinates. */
  private onTruckAt(lx: number, ly: number) {
    const b = this.bed();
    return { x: b.x + lx * b.cos - ly * b.sin, y: b.y + lx * b.sin + ly * b.cos };
  }

  /** A puff from the exhaust pipe: grey smoke, drifting back and up. */
  private exhaust(big = false) {
    const p = this.onTruckAt(PIPE_AT.x, PIPE_AT.y);
    const puff = this.add.image(p.x, p.y, 'puff').setDepth(9).setTint(0xb5a998).setAlpha(big ? 0.85 : 0.6).setScale(big ? 0.5 : 0.3);
    this.tweens.add({ targets: puff, x: p.x - 50 - Math.random() * 30, y: p.y - 26 - Math.random() * 20, scale: big ? 1.3 : 0.8, alpha: 0, duration: big ? 900 : 650, onComplete: () => puff.destroy() });
  }

  /** A pop from the exhaust when the clutch shoves the truck forward: a flash and a bang. */
  private backfire() {
    const p = this.onTruckAt(PIPE_AT.x, PIPE_AT.y);
    const flash = this.add.image(p.x - 10, p.y, 'spark').setDepth(9.2).setTint(0xff9a3c).setScale(0.9, 0.7);
    this.tweens.add({ targets: flash, scale: 0, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
    this.exhaust(true);
    play('bang');
  }

  /** The eye, the air freshener and the aerial follow the truck, and react to how it is driven. */
  private truckLife(forward: number) {
    const angle = this.chassis.angle;
    const accel = forward - this.lastForward;
    this.lastForward = forward;

    const e = this.onTruckAt(EYE_AT.x, EYE_AT.y);
    this.eye.img.setPosition(e.x, e.y).setRotation(angle);
    let mood = 'open';
    const now = this.time.now;
    if (this.phase === 'arrived' || this.phase === 'done') mood = 'happy';
    else if (now < this.eyeUntil) mood = this.eyeMood;
    else if (this.phase === 'drive' && this.drive.rpm > REDLINE - 400 && this.drive.throttle > 0.5) mood = 'squint';
    else if (now > this.nextBlink) {
      mood = 'blink';
      if (now > this.nextBlink + 130) this.nextBlink = now + 2400 + Math.random() * 2800;
    }
    if (`eye_${mood}` !== this.eye.base) this.redraw(this.eye, `eye_${mood}`);

    // The driver: their head lags on a spring when the truck jolts, and their face follows the drive.
    const hb = this.headBob;
    hb.v += -hb.y * 0.22 - hb.v * 0.28 + this.chassis.velocity.y * 0.35 + accel * 0.2;
    hb.y = Math.max(-10, Math.min(10, hb.y + hb.v));
    const dpos = this.onTruckAt(DRIVER_AT.x, DRIVER_AT.y + hb.y);
    this.driver.img.setPosition(dpos.x, dpos.y).setRotation(angle + hb.v * 0.02);
    let face: DriverMood = 'calm';
    if (this.phase === 'arrived' || this.phase === 'done') face = 'happy';
    // Something on the truck sliding about or falling: real panic. A jolt or a grinding gear: surprise.
    else if (this.things.some((t) => t.spec.pet && t.mood === 'panic')) face = 'panic';
    else if (now < this.eyeUntil && this.eyeMood === 'wide') face = 'surprised';
    else if (this.phase === 'drive' && this.drive.rpm > REDLINE - 400 && this.drive.throttle > 0.5) face = 'strain';
    else if (this.phase === 'drive' && (this.drive.lugging > 0.3 || this.drive.stalled)) face = 'worried';
    else if (now < this.whistleUntil) face = 'whistle';
    // Flying along in top gear without a care: smug.
    else if (this.phase === 'drive' && this.drive.gear === 4 && forward > 7) face = 'cool';
    else if (now > this.driverBlink) {
      face = 'blink';
      if (now > this.driverBlink + 140) this.driverBlink = now + 2600 + Math.random() * 3000;
    }
    if (`driver_${face}` !== this.driver.base) this.redraw(this.driver, `driver_${face}`);

    // The air freshener hangs from the roof and swings like a pendulum: gravity pulls it straight down,
    // and when the truck speeds up it is left behind, so it swings back (and forward when braking).
    const s = this.swing;
    s.fv += -0.035 * Math.sin(s.fa) - 0.06 * s.fv + accel * 0.11;
    s.fa += s.fv;
    const f = this.onTruckAt(FRESHENER_AT.x, FRESHENER_AT.y);
    this.freshener.setPosition(f.x, f.y).setRotation(s.fa);

    // The aerial is a springy whip: the wind bends it back with speed, and jolts set it wobbling.
    const lean = -Math.max(-1, Math.min(1, forward / 10)) * 0.5;
    s.av += (lean - s.aa) * 0.12 - s.av * 0.1 - accel * 0.06;
    s.aa += s.av;
    const a = this.onTruckAt(AERIAL_AT.x, AERIAL_AT.y);
    this.aerial.setPosition(a.x, a.y).setRotation(angle + s.aa);
    const d = this.onTruckAt(0, -7);
    this.decal.setPosition(d.x, d.y).setRotation(angle);

    // The driver whistles out of the window while cruising, and stops dead when the engine screams.
    const cruising = this.phase === 'drive' && Math.abs(forward) > 2 && this.drive.rpm < REDLINE - 900 && now > this.eyeUntil;
    if (cruising && this.frame % 64 === 0) {
      this.whistleUntil = now + 900;
      const w = this.onTruckAt(DRIVER_AT.x + 30, DRIVER_AT.y - 10);
      const note = this.add
        .text(w.x, w.y, Math.random() < 0.5 ? '♪' : '♫', { fontFamily: TEXT, fontSize: '30px', color: C.cream, stroke: C.ink, strokeThickness: 5 })
        .setOrigin(0.5)
        .setDepth(30)
        .setRotation((Math.random() - 0.5) * 0.5);
      this.tweens.add({ targets: note, x: w.x - 120 - Math.random() * 60, y: w.y - 110, alpha: 0, scale: 1.4, duration: 1700, ease: 'Sine.easeOut', onComplete: () => note.destroy() });
      this.tweens.add({ targets: note, angle: { from: -14, to: 14 }, yoyo: true, repeat: 2, duration: 280 });
    }
  }

  /** The card at the top right: hearts, and either what is on the truck or how far along the road it is. */
  private updateHud(onTruck: number, points: number, pct: number) {
    this.hudHearts.setText(String(points));
    const packing = this.phase === 'pack' || this.phase === 'intro';
    this.hudLabel.setVisible(packing).setText(`${onTruck} of ${this.things.length} on the truck`);
    this.hudTruck.setVisible(!packing);
    for (const h of this.hudHomes) h.setVisible(!packing);
    const g = this.hudBar.clear();
    if (packing) return;
    const x0 = W - 330;
    const x1 = W - 96;
    g.lineStyle(14, Phaser.Display.Color.HexStringToColor(C.ink).color).lineBetween(x0, 70, x1, 70);
    g.lineStyle(8, Phaser.Display.Color.HexStringToColor(C.creamShade).color).lineBetween(x0, 70, x1, 70);
    g.lineStyle(8, Phaser.Display.Color.HexStringToColor(C.sage).color).lineBetween(x0, 70, x0 + (x1 - x0) * pct, 70);
    this.hudTruck.setX(x0 + (x1 - x0) * pct);
  }

  /** Smoke from the chimneys: plain puffs from the old house, little hearts from the new one. */
  private chimneySmoke() {
    if (this.frame % 24 !== 0) return;
    const cam = this.cameras.main;
    for (const c of this.chimneys) {
      if (c.x < cam.scrollX - 300 || c.x > cam.scrollX + W + 300) continue;
      c.n++;
      const heart = c.kind === 'new' && c.n % 2 === 0;
      const puff = this.add.image(c.x, c.y, heart ? 'heart' : 'puff').setDepth(-11).setTint(heart ? 0xffd9cf : 0xe8dfcf).setAlpha(0.85).setScale(heart ? 0.35 : 0.45);
      this.tweens.add({ targets: puff, y: c.y - 200, x: c.x + 50 + Math.random() * 30, scale: heart ? 0.7 : 1.4, alpha: 0, angle: heart ? 0 : 40, duration: 2800, onComplete: () => puff.destroy() });
    }
  }

  /** Takes a left-behind thing out of the physics world for good, once it is far behind. */
  private forget(t: Thing) {
    if (t.gone) return;
    t.gone = true;
    this.matter.world.remove(t.body);
    t.img.setVisible(false);
    t.shadow.setVisible(false);
    t.spark?.img.setVisible(false);
  }

  /** A thing that is no longer coming along. The truck drives through it, so it cannot wedge under a wheel. */
  private leave(t: Thing) {
    this.untie(t, false);
    t.aboard = false;
    t.ghost = true;
    t.img.setAlpha(0.6).setDepth(5);
    t.body.collisionFilter = { ...t.body.collisionFilter, group: TRUCK_GROUP };
  }

  private name(t: Thing): string {
    return t.spec.pet || /^Goldie/.test(t.spec.name) ? t.spec.name : `the ${t.spec.name.toLowerCase()}`;
  }

  private lose(t: Thing) {
    this.leave(t);
    t.lost = true;
    this.floatText(t.body.position.x, t.body.position.y - 40, 'Lost!', C.cream);
    this.say(t.spec.pet ? `${t.spec.name} fell off!` : `Oh no, ${this.name(t)}!`);
    play('lost');
    if (t.spec.pet) this.time.delayedCall(250, () => play(t.spec.key === 'cat' ? 'meow' : 'chirp'));
    this.cameras.main.shake(120, 0.002);
  }

  /** A fragile thing breaks. It stays where it is, as dead weight. */
  private shatter(t: Thing) {
    const wasAboard = t.aboard;
    t.broken = true;
    t.aboard = false;
    this.redraw(t.ink, `${t.spec.key}_broken`);
    if (!wasAboard) return;
    this.say(`Crack! That was ${this.name(t)}.`);
    for (let i = 0; i < 12; i++) {
      const { x, y } = t.body.position;
      const shard = this.add.image(x, y, 'bit').setDepth(24).setScale(0.3 + Math.random() * 0.5, 0.25).setTint(i % 2 ? 0xfff2da : 0xb9bccb).setRotation(Math.random() * 6);
      const a = Math.random() * Math.PI * 2;
      const d = 60 + Math.random() * 90;
      this.tweens.add({ targets: shard, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 40, angle: 540, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => shard.destroy() });
    }
    this.floatText(t.body.position.x, t.body.position.y - 40, `−${Math.round(this.valueOf(t) / 2)}`, C.terracotta);
    play('crack');
    this.cameras.main.shake(120, 0.0025);
  }

  private moodOf(t: Thing): Mood {
    if (this.held?.thing === t) return 'panic';
    if (t.ghost) return 'grumpy';
    if (this.phase === 'arrived' || this.phase === 'done') return 'happy';
    // Waiting about, a pet nods off now and then.
    const doze = (this.time.now / 1000 + t.body.id * 3.7) % 18 > 12;
    if (this.phase !== 'drive') return doze ? 'sleepy' : 'calm';
    const c = this.chassis;
    const slip = Math.hypot(t.body.velocity.x - c.velocity.x, t.body.velocity.y - c.velocity.y);
    const tipped = Math.abs(Phaser.Math.Angle.Wrap(t.body.angle)) > 0.6;
    if (slip > 2.2 || tipped || Math.abs(t.body.angularVelocity) > 0.04) return 'panic';
    if (slip > 0.8 || Math.abs(c.velocity.x) > 4.5 || Math.abs(c.angle) > 0.12) return 'worried';
    // A gentle, steady drive is very relaxing.
    return doze && slip < 0.4 && Math.abs(c.velocity.x) < 3.5 ? 'sleepy' : 'calm';
  }

  private faces() {
    const rank: Record<Mood, number> = { calm: 0, happy: 0, grumpy: 0, sleepy: 0, worried: 1, dizzy: 1, panic: 2 };
    for (const t of this.things) {
      if (!t.spec.pet) continue;
      const mood = this.moodOf(t);
      // A fright lingers for a moment, so faces do not flicker.
      if (rank[mood] < rank[t.mood] && this.time.now < t.moodUntil) continue;
      // Once a fright is over, a pet is dizzy for a moment before it calms down.
      if (t.mood === 'panic' && rank[mood] < 2) {
        t.mood = 'dizzy';
        t.moodUntil = this.time.now + 1400;
        this.redraw(t.ink, `${t.spec.key}_dizzy`);
        continue;
      }
      if (rank[mood] > 0) t.moodUntil = this.time.now + 600;
      if (mood === t.mood) continue;
      t.mood = mood;
      this.redraw(t.ink, `${t.spec.key}_${mood}`);
    }
  }

  private drawRopes() {
    const g = this.ropeLines.clear();
    const colour = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;
    for (const t of this.things) {
      if (!t.rope) continue;
      const links = t.rope.links.map((l: Body) => ({ x: l.position.x, y: l.position.y }));
      // A smooth curve through the links, so the rope bends rather than kinks.
      const curve = new Phaser.Curves.Spline(links.map((p: { x: number; y: number }) => new Phaser.Math.Vector2(p.x, p.y)));
      const pts = curve.getPoints(links.length * 3);
      const ends = [links[0], links[links.length - 1]];
      for (const h of ends) g.fillStyle(colour('#B9BCCB')).fillCircle(h.x, h.y + 2, 8).lineStyle(3.5, colour(C.ink)).strokeCircle(h.x, h.y + 2, 8);
      g.lineStyle(9.5, colour(C.ink)).strokePoints(pts);
      g.lineStyle(5.5, colour('#E8C48A')).strokePoints(pts);
      g.lineStyle(1.5, colour('#FFF1D0'), 0.7).strokePoints(pts.map((p) => new Phaser.Math.Vector2(p.x - 0.8, p.y - 1.4)));
      // The twist of the fibres: short slanted strokes all along it.
      g.lineStyle(2, colour('#A07040'));
      let carry = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 0.01) continue;
        const tx = (b.x - a.x) / len;
        const ty = (b.y - a.y) / len;
        let d = 7 - carry;
        while (d < len) {
          const x = a.x + tx * d;
          const y = a.y + ty * d;
          g.lineBetween(x - tx * 2.4 - ty * 2.8, y - ty * 2.4 + tx * 2.8, x + tx * 2.4 + ty * 2.8, y + ty * 2.4 - tx * 2.8);
          d += 7;
        }
        carry = (carry + len) % 7;
      }
      for (const h of ends) g.fillStyle(colour('#E8C48A')).fillCircle(h.x, h.y, 5).lineStyle(3, colour(C.ink)).strokeCircle(h.x, h.y, 5);
    }
  }

  /** Moves the parked truck (body and wheels) sideways, without the physics: for the opening only. */
  private slideTruck(dx: number) {
    M.Body.setPosition(this.chassis, { x: this.chassis.position.x + dx, y: this.chassis.position.y });
    for (const w of this.wheels) {
      M.Body.setPosition(w, { x: w.position.x + dx, y: w.position.y });
      M.Body.setAngle(w, w.angle + dx / TRUCK.wheelR);
    }
  }

  /** The truck backing up to the house, slowing as it arrives; then loading can start. */
  private reverseIn(delta: number) {
    this.introTime += delta / 1000;
    const duration = 3.2;
    const k = Math.min(1, this.introTime / duration);
    const eased = 1 - Math.pow(1 - k, 3);
    const want = this.introFrom * (1 - eased);
    this.slideTruck(want - this.introLeft);
    this.introLeft = want;
    this.engine.rev(1100 + 1400 * (1 - k), 0.4 * (1 - k));
    if (Math.floor(this.introTime / 0.45) !== Math.floor((this.introTime - delta / 1000) / 0.45) && k < 0.95) play('beep');
    if (k >= 1) {
      this.phase = 'pack';
      this.engine.stop();
      this.engine = new Engine();
      this.goButton.setVisible(true);
      this.ropeButton.setVisible(true);
      this.hint.setVisible(true);
      this.setRoping(false);
      play('honk');
      this.say('Load up! Drag things on to the truck.');
    }
  }

  /** Keeps the bright shapes on the things they belong to. */
  private syncGlows(time: number) {
    const bed = this.bed();
    const lx = 402;
    const ly = -28;
    this.headlight.setPosition(bed.x + lx * bed.cos - ly * bed.sin, bed.y + lx * bed.sin + ly * bed.cos).setRotation(this.chassis.angle);
    this.fx.brighten(this.headlight, this.phase === 'drive' ? 1 : 0.6);
    for (const t of this.things) {
      if (!t.spark) continue;
      const cos = Math.cos(t.body.angle);
      const sin = Math.sin(t.body.angle);
      t.spark.img.setPosition(t.body.position.x + t.spark.dx * cos - t.spark.dy * sin, t.body.position.y + t.spark.dx * sin + t.spark.dy * cos).setRotation(t.body.angle - 0.7);
      t.spark.img.setVisible(!t.broken).setAlpha(t.ghost ? 0.5 : 1);
    }
    this.fx.update(time);
  }

  /** Soft shadows on the road, under the truck and under anything resting on or falling towards it. */
  private shadows() {
    const bed = this.bed();
    for (const t of this.things) {
      const b = t.body;
      const road = groundY(b.position.x);
      const gap = road - b.bounds.max.y;
      const dx = b.position.x - bed.x;
      const overTruck = dx > TRUCK.bed.x - 10 && dx < TRUCK.hood.x + TRUCK.hood.w && b.bounds.max.y < bed.y + 40;
      // Things stacked on other things cast no shadow of their own, or a pile would sit in a black pool.
      const show = !overTruck && gap > -40 && (gap < 14 || (gap < 320 && b.speed > 1.5));
      t.shadow.setVisible(show);
      if (!show) continue;
      const near = 1 - Math.max(0, gap) / 320;
      t.shadow.setPosition(b.position.x, road + 6).setAlpha(near * (t.ghost ? 0.5 : 0.9)).setScale(((b.bounds.max.x - b.bounds.min.x) / 256) * (1.3 - near * 0.15), 0.9);
    }
    const mid = bed.x + 105 * bed.cos;
    this.truckShadow.setPosition(mid, groundY(mid) + 8).setScale(680 / 256, 1.3);
  }

  private dust(x: number, y: number) {
    const puff = this.add.image(x, y, 'puff').setDepth(8).setScale(0.4).setAlpha(0.6).setRotation(Math.random() * 6);
    this.tweens.add({ targets: puff, scale: 1.1, alpha: 0, y: y - 34, x: x - 30, duration: 520, onComplete: () => puff.destroy() });
  }

  private finish() {
    this.phase = 'done';
    this.engine.stop();
    play('win');
    const packed = this.things.filter((t) => t.packed);
    const delivered = packed.filter((t) => t.aboard && !t.broken);
    const broken = packed.filter((t) => t.broken);
    const lost = packed.filter((t) => t.lost && !t.broken);
    const lostCount = lost.length + this.trip.lost.length;
    const parking = [...this.trip.parking, this.parkBonus].reduce((a, b) => a + b, 0);
    const tripTime = this.trip.time + this.driveTime;
    clearTrip();
    const earned = delivered.reduce((n, t) => n + this.valueOf(t), 0);
    const penalty = broken.reduce((n, t) => n + Math.round(this.valueOf(t) / 2), 0);
    const bonus = broken.length === 0 && lostCount === 0 && delivered.length > 0 ? 100 : 0;
    const score = Math.max(0, earned - penalty + bonus + parking);
    const stars = score >= 900 ? 3 : score >= 600 ? 2 : score >= 300 ? 1 : 0;
    const catLeft = !this.things.find((t) => t.spec.key === 'cat')?.aboard;
    const verdict = catLeft
      ? 'Biscuit is walking home. Biscuit will not forget this.'
      : stars === 3
        ? 'A perfect move. The neighbours are impressed.'
        : stars === 2
          ? 'Most of it made it. Good enough!'
          : stars === 1
            ? 'We can buy a new fridge. Probably.'
            : 'We are minimalists now.';

    const cx = W / 2;
    const cy = H / 2;
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d = 201) => o.setScrollFactor(0).setDepth(d);
    const shown: Phaser.GameObjects.GameObject[] = [];
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T) => (shown.push(o), o);
    keep(fixed(this.add.rectangle(cx, cy, W, H, 0x2a2140, 0.55), 199));
    // A delivery note from the moving company, taped up, with a ribbon across the top.
    const paperY = cy - 10;
    const top = paperY - RECEIPT.h / 2;
    const left = cx - RECEIPT.w / 2 + 110;
    const paper = keep(fixed(this.add.image(cx, paperY, 'receipt'), 200));
    this.tweens.add({ targets: paper, y: { from: paperY + 60, to: paperY }, duration: 420, ease: 'Back.easeOut' });
    keep(fixed(this.add.image(cx, top - 6, 'ribbon'), 202));
    keep(fixed(this.add.text(cx, top - 18, 'Home sweet home!', { fontFamily: TITLE, fontSize: '62px', color: C.cream, stroke: C.terracottaDark, strokeThickness: 4 }).setOrigin(0.5), 203));
    keep(fixed(this.add.text(left, top + 104, 'SHIFT HAPPENS MOVING CO.', { fontFamily: TITLE, fontSize: '28px', color: C.ink }).setOrigin(0, 0.5), 202));
    keep(fixed(this.add.text(left, top + 136, `Delivery note No. ${String(1000 + (score % 9000)).padStart(4, '0')}  ·  ${tripTime >= 60 ? `${Math.floor(tripTime / 60)} min ` : ''}${Math.round(tripTime % 60)} s on the road`, { fontFamily: TEXT, fontSize: '20px', color: C.walnut }).setOrigin(0, 0.5), 202));
    const ink = this.add.graphics();
    keep(fixed(ink, 202));
    const dashed = (y: number, x0: number, x1: number) => {
      ink.fillStyle(0x2a2140, 0.55);
      for (let x = x0; x < x1; x += 18) ink.fillRect(x, y - 1.5, 10, 3);
    };
    dashed(top + 166, left, cx + RECEIPT.w / 2 - 50);

    // What came off the truck: little tags with each thing and its points. Broken things are crossed out.
    const tagged = [...delivered.slice().sort((a, b) => this.valueOf(b) - this.valueOf(a)), ...broken].slice(0, 9);
    const rowY = top + 236;
    tagged.forEach((t, i) => {
      const x = cx + 20 + (i - (tagged.length - 1) / 2) * 100;
      const isBroken = t.broken;
      const tag = this.add.graphics();
      tag.fillStyle(0x2a2140, 0.25).fillRoundedRect(x - 40, rowY - 44, 88, 108, 12);
      tag.fillStyle(isBroken ? 0xf2dcd6 : 0xfff2da).fillRoundedRect(x - 44, rowY - 50, 88, 108, 12);
      tag.lineStyle(3, 0x2a2140).strokeRoundedRect(x - 44, rowY - 50, 88, 108, 12);
      tag.fillStyle(0x2a2140).fillCircle(x, rowY - 40, 4);
      keep(fixed(tag, 202));
      const img = keep(fixed(this.add.image(x, rowY - 2, t.img.texture.key), 203));
      img.setScale(Math.min(62 / img.height, 70 / img.width));
      const value = isBroken ? `−${Math.round(this.valueOf(t) / 2)}` : String(this.valueOf(t));
      keep(fixed(this.add.text(x, rowY + 40, value, { fontFamily: TITLE, fontSize: '20px', color: isBroken ? C.terracottaDark : C.walnut }).setOrigin(0.5), 203));
      if (isBroken) {
        const x2 = this.add.graphics().lineStyle(4, 0xb8403f).lineBetween(x - 28, rowY - 30, x + 28, rowY + 24).lineBetween(x + 28, rowY - 30, x - 28, rowY + 24);
        keep(fixed(x2, 204));
      }
      img.setScale(0);
      this.tweens.add({ targets: img, scale: Math.min(62 / img.height, 70 / img.width), delay: 300 + i * 70, duration: 260, ease: 'Back.easeOut' });
    });
    if (!tagged.length) keep(fixed(this.add.text(cx, rowY, 'Nothing. Not one thing.', { fontFamily: TITLE, fontSize: '30px', color: C.walnut }).setOrigin(0.5), 202));
    dashed(top + 318, left, cx + RECEIPT.w / 2 - 50);

    // The bill, line by line, with dotted leaders to the numbers.
    const right = cx + 120;
    const lines: [string, string, string][] = [
      [`Delivered safely (${delivered.length})`, `+${earned}`, C.ink],
      [`Broken (${broken.length})`, broken.length ? `−${penalty}` : '0', broken.length ? C.terracottaDark : C.walnut],
      [`Fell off on the way (${lostCount})`, '0', C.walnut],
      ['Careful driver bonus', bonus ? `+${bonus}` : '—', bonus ? C.sageDark : C.walnut],
      [`Parking at ${this.trip.parking.length + 1} stops`, `+${parking}`, C.sageDark],
    ];
    lines.forEach(([label, value, colour], i) => {
      const y = top + 358 + i * 42;
      const l = keep(fixed(this.add.text(left, y, label, { fontFamily: TEXT, fontSize: '27px', color: colour }).setOrigin(0, 0.5), 202));
      const v = keep(fixed(this.add.text(right, y, value, { fontFamily: TITLE, fontSize: '28px', color: colour }).setOrigin(1, 0.5), 202));
      ink.fillStyle(0x2a2140, 0.35);
      for (let x = left + l.width + 12; x < right - v.width - 12; x += 10) ink.fillCircle(x, y + 8, 1.8);
    });
    const sumY = top + 358 + lines.length * 42 + 6;
    ink.fillStyle(0x2a2140).fillRect(left, sumY - 18, right - left, 3).fillRect(left, sumY - 11, right - left, 3);
    keep(fixed(this.add.text(left, sumY + 30, 'TOTAL', { fontFamily: TITLE, fontSize: '40px', color: C.ink }).setOrigin(0, 0.5), 202));
    const total = keep(fixed(this.add.text(right, sumY + 28, '0', { fontFamily: TITLE, fontSize: '62px', color: C.terracotta, stroke: C.ink, strokeThickness: 5 }).setOrigin(1, 0.5), 202));
    const count = { v: 0 };
    this.tweens.add({ targets: count, v: score, delay: 700, duration: 1300, ease: 'Cubic.easeOut', onUpdate: () => total.setText(String(Math.round(count.v))) });

    // The rating, stamped on in red ink once the total has counted up.
    const sx = cx + 300;
    const sy = top + 470;
    const words = stars === 3 ? 'WITH CARE' : stars === 2 ? 'MOSTLY' : stars === 1 ? 'SORT OF' : 'BARELY';
    const stamp = this.add.container(sx, sy).setScrollFactor(0).setDepth(204).setRotation(-0.22);
    stamp.add(this.add.image(0, 0, 'stamp').setScrollFactor(0));
    stamp.add(this.add.text(0, 0, 'DELIVERED', { fontFamily: TITLE, fontSize: '32px', color: '#FFF6E6' }).setOrigin(0.5).setScrollFactor(0));
    stamp.add(this.add.text(0, -62, '★'.repeat(stars) + '☆'.repeat(3 - stars), { fontFamily: TITLE, fontSize: '58px', color: C.terracottaDark }).setOrigin(0.5).setScrollFactor(0));
    stamp.add(this.add.text(0, 58, words, { fontFamily: TITLE, fontSize: '26px', color: C.terracottaDark }).setOrigin(0.5).setScrollFactor(0));
    stamp.setAlpha(0).setScale(2.2);
    this.tweens.add({
      targets: stamp,
      scale: 1,
      alpha: 0.92,
      delay: 2100,
      duration: 180,
      ease: 'Quad.easeIn',
      onComplete: () => {
        play('stamp');
        this.cameras.main.shake(90, 0.002);
        for (let i = 0; i < stars; i++) this.time.delayedCall(120 + i * 140, () => play('tie'));
      },
    });

    // A note scribbled at the bottom, and the button to go again.
    keep(fixed(this.add.text(left, top + RECEIPT.h - 92, `“${verdict}”`, { fontFamily: TEXT, fontSize: '26px', color: C.walnut, fontStyle: 'italic' }).setOrigin(0, 0.5), 202));
    const again = this.button(cx, top + RECEIPT.h + 46, 'btn', 'Shift again', 46, () => this.scene.restart({ intro: false })).box.setDepth(205);
    shown.push(again);
    for (const o of shown) {
      const a = o as unknown as Phaser.GameObjects.Components.Alpha;
      const target = a.alpha;
      a.setAlpha(0);
      this.tweens.add({ targets: o, alpha: target, duration: 350 });
    }
  }

  update(time: number, delta: number) {
    if (this.paused) return;
    const cam = this.cameras.main;
    this.frame++;
    if (this.phase === 'intro') this.reverseIn(delta);

    // Carry the held thing towards the pointer, and keep it at the angle the player chose.
    if (this.held && this.phase === 'pack') {
      const p = this.input.activePointer;
      p.updateWorldPoint(cam);
      const b = this.held.thing.body;
      let vx = (p.worldX - this.held.dx - b.position.x) * 0.3;
      let vy = (p.worldY - this.held.dy - b.position.y) * 0.3;
      const v = Math.hypot(vx, vy);
      if (v > 34) {
        vx *= 34 / v;
        vy *= 34 / v;
      }
      M.Sleeping.set(b, false);
      M.Body.setVelocity(b, { x: vx, y: vy });
      const turn = Phaser.Math.Angle.Wrap(this.held.angle - b.angle);
      M.Body.setAngularVelocity(b, turn * 0.25);
    }

    // Driving. The engine, clutch and gearbox work out how hard the wheels push (see drivetrain.ts),
    // and that push is applied to the truck along the way it is facing, while a wheel is on the road.
    // The wheels themselves slide freely and only turn for show.
    let forward = 0;
    if (this.phase !== 'pack' && this.phase !== 'intro') {
      const right = this.keys.right.isDown || this.keys.d.isDown;
      const left = this.keys.left.isDown || this.keys.a.isDown;
      const c = this.chassis;
      const dir = { x: Math.cos(c.angle), y: Math.sin(c.angle) };
      forward = c.velocity.x * dir.x + c.velocity.y * dir.y;
      const grounded = this.wheels.some((w) => w.position.y + TRUCK.wheelR > groundY(w.position.x) - 6);
      if (grounded) this.groundedAt = this.time.now;
      const traction = this.time.now - this.groundedAt < 180;
      const pedal = this.phase === 'drive' && right ? 1 : 0;
      this.drive.power = this.extras.update(Math.min(0.05, delta / 1000), this.drive, this.phase === 'drive');
      const ptr = this.input.activePointer;
      ptr.updateWorldPoint(cam);
      this.crossbow.update(Math.min(0.05, delta / 1000), { x: ptr.worldX, y: ptr.worldY });
      const showExtras = this.phase === 'drive';
      const wrapText = `${this.extras.coins}`;
      if (this.extrasLabel.text !== wrapText) this.extrasLabel.setText(wrapText);
      const fuelPct = Math.round(this.extras.fuel * 100);
      this.fuelPctText.setText(`${fuelPct}%`);
      this.extrasIcons.fuelBar.width = 88 * Phaser.Math.Clamp(this.extras.fuel, 0, 1);
      this.extrasIcons.fuelBar.setFillStyle(this.extras.fuel < 0.25 ? 0xd8572a : this.extras.fuel < 0.5 ? 0xf2c14e : 0x9cc58a);
      for (const o of [this.extrasChip, this.extrasLabel, this.extrasIcons.wrap, this.extrasIcons.fuel, this.extrasIcons.fuelBarBg, this.extrasIcons.fuelBar, this.fuelPctText]) o.setVisible(showExtras);
      const out = this.drive.step(Math.min(0.05, delta / 1000), forward, pedal);
      if (out.stalled) this.stalledOut();
      if (this.drive.stalled && pedal) this.tryRestart();
      let dv = out.accel;
      const slope = Math.sin(c.angle);
      if (this.phase !== 'drive') dv = -forward * 0.07;
      else if (this.handbrake) {
        // The handbrake holds the truck still, hills and all. Driving against it only drags the truck along, smoking.
        dv = pedal && !this.drive.stalled ? -forward * 0.3 + Math.max(0, out.accel) * 0.25 : -forward;
        if (pedal && !this.drive.stalled && this.drive.gear !== 'N') this.fightingBrake();
      } else if (left) {
        const brake = BRAKE * BIOMES[this.leg.biome].grip;
        dv += Math.abs(forward) > brake ? -brake * Math.sign(forward) : -forward;
      }
      // On the flat, a truck nearly at rest stays at rest; on a slope it rolls, unless something holds it.
      else if (!pedal && Math.abs(forward) < 0.12 && Math.abs(slope) < 0.03) dv = -forward;
      if (this.drive.lugging > 0.4 && this.frame % 10 === 0) this.truckShudder(this.drive.lugging * 0.6);
      // Settle the truck's rocking on its springs while it is on the road (a real truck's shock absorbers).
      if (grounded) M.Body.setAngularVelocity(c, c.angularVelocity * 0.9);
      if (traction) {
        const kick = dv + out.jolt;
        // The push goes to the whole truck, body and wheels alike: the wheels are heavy bodies of their own, and
        // pushing only the body let them soak up three quarters of the engine (and of the brakes).
        for (const b of [c, ...this.wheels]) M.Body.setVelocity(b, { x: b.velocity.x + dir.x * kick, y: b.velocity.y + dir.y * kick });
      }
      if (out.jolt) this.jolted(out.jolt);
      // While the clutch slips - pulling away, or spinning for grip rather than gripping - the wheels
      // spin at the engine's own speed, not the truck's: real wheelspin, not a wheel that just sits
      // still because the truck has not gone anywhere yet.
      const wheelSpeed = this.drive.slipping && !this.drive.shifting && this.drive.gear !== 'N' && !this.drive.stalled ? this.drive.slipSpeed : forward;
      for (const w of this.wheels) M.Body.setAngularVelocity(w, wheelSpeed / TRUCK.wheelR);
      if (this.drive.stalled) this.engine.rev(30, -0.75);
      else this.engine.rev(this.drive.rpm, this.drive.throttle, this.drive.limiting, this.drive.lugging);
      if (this.phase === 'drive') {
        music.setIntensity(Math.abs(forward) / 8);
        music.setMelody(!this.drive.stalled);
        ambience.setSpeed(forward);
      }
      if (grounded && Math.abs(forward) > 2.5 && this.frame % 9 === 0) {
        const rear = this.wheels[0].position;
        this.dust(rear.x - 20, rear.y + TRUCK.wheelR - 14);
      }
      if (this.phase === 'drive' && this.frame % (pedal ? 7 : 20) === 0) this.exhaust();
      if (this.phase === 'drive') {
        this.dash.update(forward, Math.max(0, (this.chassis.position.x - TRUCK_X) / 1000), this.extras.fuel, this.handbrake);
        this.updateGates(forward, delta);
        this.parking(forward);
      }
    }

    if (this.phase !== 'pack' && this.phase !== 'intro') this.nearRoad(this.chassis.position.x);
    if (this.phase === 'drive') {
      this.driveTime += delta / 1000;
      const cx = this.chassis.position.x;
      for (const t of this.things) {
        if (t.ghost) {
          if (t.body.position.x < cx - 1600) this.forget(t);
          continue;
        }
        t.groundFrames = this.onRoad(t) ? t.groundFrames + 1 : 0;
        if (t.groundFrames <= 40 && t.body.position.x > cx - 1100) continue;
        if (t.aboard) this.lose(t);
        else this.leave(t);
      }

    } else if (this.phase === 'arrived' && this.time.now - this.arrivedAt > 1600) {
      if (this.leg.stop) this.checkpoint();
      else this.finish();
    }

    // Pictures follow the physics.
    const bed = this.bed();
    this.truckImg.setPosition(bed.x, bed.y).setRotation(this.chassis.angle);
    this.truckFront.setPosition(bed.x, bed.y).setRotation(this.chassis.angle);
    this.wheels.forEach((w, i) => this.wheelImgs[i].setPosition(w.position.x, w.position.y).setRotation(w.angle));
    for (const t of this.things) t.img.setPosition(t.body.position.x, t.body.position.y).setRotation(t.body.angle);
    this.faces();
    this.drawRopes();
    this.choosePointer();
    this.shadows();
    this.syncGlows(time);
    this.truckLife(forward);
    this.speedLines(forward);
    // The last place's scenery until the middle of the tunnel, where the rock hides the whole screen; this
    // place's after it. One swap, out of sight: no fading.
    const k = this.worlds.length > 1 ? blendAt(cam.scrollX + W / 2) : 1;
    for (const wd of this.worlds) {
      const on = wd.prev ? k === 0 : k === 1;
      // Weather (the top band) stays outside: no leaves or snow blowing through the tunnel.
      const sheltered = (this.tunnel?.inside(cam.scrollX + W / 2) ?? 0) > 0.35;
      wd.layers.forEach((l, i) => l.setAlpha(1).setVisible(on && !(i === 3 && sheltered)));
      if (on) wd.built.update(time, delta, cam.scrollX);
    }
    this.tunnel?.update(time, cam.scrollX);
    for (const a of this.stopAnims) a(time, delta);
    for (const g of this.grassBands) for (const s of g.strips) s.setVisible(g.prev ? k === 0 : this.grassBands.length > 1 ? k === 1 : true);
    this.chimneySmoke();

    // The camera holds still on the house while loading and during the opening; it follows the truck on the road.
    if (this.phase !== 'pack' && this.phase !== 'intro') {
      // Lead the truck by its speed, smoothed, so bumps and gear jolts do not jerk the view.
      this.camLead += (this.chassis.velocity.x * 14 - this.camLead) * 0.04;
      const ahead = this.camLead;
      const want = Math.max(0, this.chassis.position.x - 900 + ahead);
      cam.scrollX += (Math.min(want, WORLD_END - W) - cam.scrollX) * 0.07;
    }

    const aboard = this.things.filter((t) => t.aboard && ((this.phase !== 'pack' && this.phase !== 'intro') || this.onTruck(t)));
    const points = aboard.filter((t) => !t.broken).reduce((n, t) => n + this.valueOf(t), 0);
    const pct = Phaser.Math.Clamp((this.chassis.position.x - TRUCK_X) / (FINISH - TRUCK_X), 0, 1);
    this.updateHud(aboard.length, points, pct);
  }
}
