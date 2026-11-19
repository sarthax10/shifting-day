import Phaser from 'phaser';
import { Engine, ambience, audio, chime, music, play, thud } from './audio';
import { BOIL_FRAMES, HOUSE, MANOR, ITEMS, PLANK, OFFICIAL_SIGN, RECEIPT, VALUE, TREE_KINDS, TRUCK, type ItemSpec, type Mood, DRIVER, type DriverMood, RAIL_SIGNAL } from './art';
import { PLAZAS, TOLL_LIGHT, TOLL_SKINS, tollKeys, type TollSkin } from './tolls';
import { DASH_RIGHT, Dash } from './dash';
import { CURSOR } from './cursors';
import { Fx } from './fx';
import { buildBackdrop } from './backdrop';
import { Drivetrain, REDLINE, type Gear } from './drivetrain';
import { C } from './ink';
import { FINISH, GROUND, H, W, WORLD_END, WORLD_START, groundY, setRoad } from './terrain';
import { LEGS, clearTrip, loadTrip, saveTrip, type Leg, type Trip } from './legs';
import { BIOMES, blendAt, type Built } from './biomes';
import { STOP_LOOKS, placeStop } from './stops';
import { MEADOW_TREES } from './trees';
import type { BiomeKey } from './legs';

/** Road pictures are cut into pieces this wide, starting this far down the screen. */
export { CHUNK, CHUNK_TOP } from './prepare';
import { CHUNK, CHUNK_TOP, groundKey, grassKey, holdLoadingWhile, legReady, prepareLeg, unloadLegsExcept } from './prepare';
import { applyBiomeFX } from './postfx';
import { buildFinale } from './finale';
import { showScorecard } from './scorecard';
import { chip, hudText, uiText, INK_BG } from './ui';
import { Prompter } from './prompts';
import { PosterList, posterSheet, openControls, ensurePosterTextures, DISPLAY as POSTER_FONT, MONO as POSTER_MONO, BONE_CSS, EMBER_CSS, INK_CSS } from './poster';

// The physics library that ships inside Phaser. Its own types are loose, so bodies are `any` here.
/* eslint-disable @typescript-eslint/no-explicit-any */
const M = (Phaser.Physics.Matter as any).Matter;
type Body = any;

/** The poster's two faces: Anton for words that matter, Space Mono for small labels. */
const TEXT = '"Space Mono", monospace';
const TITLE = '"Anton", "Impact", sans-serif';
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
/** How long something that fell off can still be caught with the crossbow, in frames: about five seconds. */
const CATCH_FRAMES = 320;
/** Rope to tie the load down with: enough to secure the wobbly things on every leg. */
const ROPES = 5;
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
/** A run's time as m:ss.t (or h:mm:ss for very long runs); without tenths for the receipt and best. */
function clock(s: number, tenths = true) {
  const t = Math.max(0, s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = Math.floor(t % 60);
  const mm = h ? String(m).padStart(2, '0') : String(m);
  const base = `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
  return tenths && !h ? `${base}.${Math.floor((t * 10) % 10)}` : base;
}
const BEST_KEY = 'shifting-day-best-run';
/** The quickest finished run on this device, in seconds, if there is one. */
function bestRun(): number | null {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}
/** Records a finished run; true when it beats the best. */
function saveRun(s: number): boolean {
  const best = bestRun();
  if (best !== null && s >= best) return false;
  try {
    localStorage.setItem(BEST_KEY, String(s));
  } catch {
    // Private mode: the run still counts, it just is not remembered.
  }
  return true;
}
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
  private lostFoundBoard?: { sign: Phaser.GameObjects.Container; show: () => void };
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
  private hudClock!: Phaser.GameObjects.Text;
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
  // A touchscreen's stand-ins for held keys: on-screen buttons set these each frame instead.
  private touchGas = false;
  private touchBrake = false;
  private touchReel = false;
  /** A touch aiming the crossbow fires on release, once it has had a chance to drag the aim first,
   * rather than firing the instant a finger lands wherever it happens to touch down. */
  private touchAiming = false;
  private touchButtons: (Phaser.GameObjects.Arc | Phaser.GameObjects.Text)[] = [];
  private paused = false;
  private pauseUi?: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.Text;
  /** In-world prompts that teach the controls as they come up (there are no toast messages). */
  private prompts!: Prompter;
  private gantry?: { banner: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text };
  private lastSaveMoment = -9999;
  private walls?: Body[];
  /** True while this leg's pictures are being drawn again; the scene restarts once they are. */
  private waiting = false;
  /** Whether the next leg has started loading in the background. */
  private prefetched = false;
  /** The last stretch home, run every frame on the final leg. */
  private finale?: (time: number, camMid: number, celebrating: boolean) => void;
  /** Whose colour grade the camera wears: the last place until the tunnel, then this one. */
  private fxPlace: BiomeKey = 'meadow';
  private pauseList?: PosterList;
  private closeControls?: () => void;
  private lostFoundList?: PosterList;
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
    // Starting again ("Shift again", a new game) after later legs ran: this leg's pictures were let go
    // to save memory. Draw them again first, then come back, rather than drive on a road with no picture.
    this.waiting = !legReady(this.textures, this.leg.n);
    if (this.waiting) {
      this.phase = 'pack';
      this.cameras.main.setBackgroundColor('#0A0712');
      void prepareLeg(this.textures, this.leg.n).then(() => this.scene.restart(data));
      return;
    }
    setRoad(this.leg.features, this.leg.finish);
    this.prefetched = false;
    // Background loading waits while the truck is moving, and runs whenever it stands still.
    holdLoadingWhile(() => this.sys.isActive() && this.phase === 'drive' && Math.abs(this.chassis?.velocity.x ?? 0) > 0.6);
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
    this.walls = undefined;
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
    this.prompts = new Prompter(this);
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
      cliffAhead: (x) =>
        this.prompts.show('cliff', ['AIM AT THE TOP', { key: 'fire' }, 'THEN', { key: 'reel' }], () => ({ x: x + 120, y: groundY(x + 120) - 170 }), () => this.chassis.position.x > x + 260),
      reeling: () => this.keys.w.isDown || !!this.input.gamepad?.pad1?.buttons[1]?.pressed || this.touchReel,
      ground: (x) => groundY(x),
      cliffs: this.leg.features.filter((f) => f.length > 3).map(([fx]) => fx),
      tryCatch: (b) => this.tryCatch(b),
    });
    this.crossbow.build();
    this.input.mouse?.disableContextMenu();
    // The resource readout: its own clear chip, icons instead of just words, a fuel bar that reddens when low.
    const hudY = 146;
    this.extrasChip = chip(this, 40, hudY, 320, 58).setScrollFactor(0).setDepth(100).setVisible(false);
    this.hudIcons();
    const wrapIcon = this.add.image(78, hudY, 'i_wrap').setScrollFactor(0).setDepth(101).setVisible(false);
    this.extrasLabel = this.add.text(108, hudY, '', hudText(1.1)).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    const fuelIcon = this.add.image(208, hudY, 'i_fuel').setScrollFactor(0).setDepth(101).setVisible(false);
    const fuelBarBg = this.add.rectangle(238, hudY, 92, 16, 0x3a0f22, 1).setOrigin(0, 0.5).setStrokeStyle(2, 0xf3e3cc, 0.5).setScrollFactor(0).setDepth(101).setVisible(false);
    const fuelBar = this.add.rectangle(240, hudY, 88, 12, 0xff6a30).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102).setVisible(false);
    this.extrasIcons = { wrap: wrapIcon, fuel: fuelIcon, fuelBarBg, fuelBar };
    this.fuelPctText = this.add.text(240, hudY + 14, '', { fontFamily: TEXT, fontStyle: 'bold', fontSize: '12px', color: '#F3E3CC', letterSpacing: 2 }).setOrigin(0, 0).setScrollFactor(0).setDepth(101).setVisible(false);

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

    // Only this leg is kept in memory: the ones left behind are let go, and the next is drawn when the
    // truck parks at this leg's checkpoint (its card waits on it), not all the way through this one.
    unloadLegsExcept(this.textures, [this.leg.n]);
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
    entry.img.setTexture(this.textures.exists(`${base}#${this.boilFrame}`) ? `${base}#${this.boilFrame}` : `${base}#0`);
  }

  private boil() {
    this.boilFrame = (this.boilFrame + 1) % BOIL_FRAMES;
    // Each picture is a little out of step with its neighbours, so the whole screen does not twitch at once.
    // A picture drawn only once (the houses) just keeps its one drawing.
    this.boiling.forEach((b, i) => {
      if (!b.img.active) return;
      const key = `${b.base}#${(this.boilFrame + i) % BOIL_FRAMES}`;
      if (this.textures.exists(key)) b.img.setTexture(key);
    });
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
          this.say('OW!');
          this.lookStartled(700);
        }
      }
      if (this.phase !== 'drive') continue;
      for (const [me, other] of [[a, b], [b, a]]) {
        const t = this.byBody.get(me.id);
        if (!t?.spec.fragile || t.broken) continue;
        // A heavy thing hits harder than a light one, and the road is hardest of all.
        const weight = other.isStatic ? 1.5 : Phaser.Math.Clamp(other.mass / me.mass, 0.6, 2.5);
        // Fragile things take a firmer knock than before to break: the game should forgive a bump.
        if (speed * weight > t.spec.fragile * 1.6) this.shatter(t);
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
    this.say('STALLED!');
    this.prompts.show('stall', [{ key: 'first' }, 'FIRST GEAR, THEN', { key: 'gas' }], () => this.overTruck(), () => !this.drive.stalled);
  }

  /** Turning the key: only in a low gear, as the clutch can not drag the truck off in 3rd or 4th. */
  private tryRestart() {
    const g = this.drive.target;
    if (typeof g === 'number' && g >= 3) {
      if (!this.stallNagged) {
        this.stallNagged = true;
        this.say('TOO HIGH A GEAR');
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
    const skin = (this.leg.biome in TOLL_SKINS ? this.leg.biome : 'meadow') as TollSkin;
    const plaza = PLAZAS[skin];
    const keys = tollKeys(skin);
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
      let face = { x: x + 100, y: y - 180 };
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
        // The portal over the road. Gates sit on hill crests, so its legs reach down to the road on either
        // side, each stood on a foot of its own; the span rides level from the higher of the two.
        const P = plaza.portal;
        const cx = x + 60;
        const legs = P.legs.map((lx) => cx - P.w / 2 + lx);
        const gl = Math.min(...legs.map((lx) => groundY(lx))) + 8;
        this.add.image(cx, gl, keys.portal).setOrigin(0.5, P.ground / P.h).setDepth(-6.5);
        for (const lx of legs) this.add.image(lx, groundY(lx) + 10, keys.foot).setOrigin(0.5, plaza.foot.ground / plaza.foot.h).setDepth(-6.45);
        const top = gl - P.ground;
        this.add.text(cx - P.w / 2 + P.sign.x, top + P.sign.y, P.sign.text, { fontFamily: TITLE, fontSize: P.sign.size + "px", color: P.sign.color, stroke: P.sign.stroke, strokeThickness: 3, letterSpacing: P.sign.spacing ?? 0 }).setOrigin(0.5).setDepth(-6.4);
        for (const [lx, ly] of P.lamps) {
          const gx = cx - P.w / 2 + lx;
          glow(gx, top + ly, 120, 120, P.lampTint, -6.3, 0.75);
          glow(gx, groundY(gx) + 6, 260, 44, P.lampTint, 0.7, 0.35);
        }
        // The booth: its barrier post's pivot is where the arm swings from.
        const B = plaza.booth;
        const by = y + 8;
        this.add.image(x, by, keys.booth).setOrigin(B.hinge / B.w, B.ground / B.h).setDepth(-6);
        beacon = glow(x - B.hinge + B.beacon[0], by - B.ground + B.beacon[1], 90, 90, B.beaconTint, -5.9);
        face = { x: x - B.hinge + B.face[0], y: by - B.ground + B.face[1] - 70 };
        // The traffic light before the barrier: red until you are let through.
        const tx = x - 90;
        const lt = groundY(tx) + 8 - TOLL_LIGHT.ground;
        this.add.image(tx, groundY(tx) + 8, 'toll_light').setOrigin(0.5, TOLL_LIGHT.ground / TOLL_LIGHT.h).setDepth(-6);
        red = this.add.circle(tx, lt + 20, 11, 0xff3a2a).setDepth(-5.9) as unknown as Phaser.GameObjects.Image;
        green = this.add.circle(tx, lt + 54, 11, 0x3aff8a).setDepth(-5.9).setAlpha(0) as unknown as Phaser.GameObjects.Image;
        flashers.push(glow(tx, lt + 20, 80, 80, 0xff3a2a, -5.85, 0.6), glow(tx, lt + 54, 80, 80, 0x3aff8a, -5.85, 0));
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
      this.gates.push({ x, body, arm, state: isFinal ? 'open' : 'closed', timer: 0, announced: isFinal, nagged: false, bumped: false, still: 0, snore: 0, booth: face, red, green, beacon, flashers, checkTime });
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
        this.gatePrompt(g);
      }
      const stopped = gap > -10 && gap < 340 && Math.abs(forward) < 0.15;
      g.still = stopped ? g.still + dt : 0;
      if (g.state === 'closed' && stopped && this.handbrake) {
        g.state = 'checking';
        // Stopped at the first gate: start drawing the next leg, while the truck is standing still.
        if (!this.prefetched && this.leg.stop) {
          this.prefetched = true;
          void prepareLeg(this.textures, this.leg.n + 1);
        }
        g.timer = 0;
        const wake = this.add.text(g.booth.x, g.booth.y + 10, '!', { fontFamily: TITLE, fontSize: '54px', color: C.mustard, stroke: C.ink, strokeThickness: 6 }).setOrigin(0.5).setDepth(-5);
        this.tweens.add({ targets: wake, y: wake.y - 40, alpha: 0, delay: 500, duration: 600, onComplete: () => wake.destroy() });
        play('beep');
      } else if (g.state === 'closed' && g.still > 1 && !this.handbrake && !g.nagged) {
        g.nagged = true;
        this.gatePrompt(g);
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
          this.prompts.show('gateGo', [{ key: 'handbrake' }, 'OFF, THEN', { key: 'gas' }], () => this.overTruck(), () => !this.handbrake);
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
    // The gantry over the bay: two ink posts, a printed banner with a chequered strip, flags on top.
    const left = bay().from - 40;
    const right = bay().to + 40;
    const gy = Math.min(groundY(left), groundY(right));
    const top = gy - 520;
    const g = this.add.graphics().setDepth(-3);
    g.fillStyle(0x0a0712, 1).fillRect(left - 10, top, 20, gy - top).fillRect(right - 10, top, 20, gy - top);
    for (const px of [left, right]) for (let yy = top + 140; yy < gy - 20; yy += 60) g.fillStyle(0xff6a30, 1).fillRect(px - 10, yy, 20, 6);
    const banner = this.add.rectangle((left + right) / 2, top + 50, right - left + 60, 100, 0x0a0712).setStrokeStyle(4, 0xf3e3cc, 0.6).setDepth(-3);
    for (let i = 0, x = left - 30; x < right + 30; x += 24, i++) {
      g.fillStyle(i % 2 ? 0xf3e3cc : 0x0a0712, 1).fillRect(x, top + 100, 24, 16);
      g.fillStyle(i % 2 ? 0x0a0712 : 0xf3e3cc, 1).fillRect(x, top + 116, 24, 16);
    }
    // The stop's own name across the banner (the gantry stands in front of its sign), CHECKPOINT over it.
    const word = this.leg.stop ? this.leg.stop.name.toUpperCase() : 'HOME';
    const label = this.add.text((left + right) / 2, top + 58, word, { fontFamily: TITLE, fontSize: '62px', color: '#F3E3CC', letterSpacing: 4 }).setOrigin(0.5).setDepth(-2.9).setShadow(6, 7, '#E3263A', 0, true, false);
    label.setScale(Math.min(1, (right - left) / label.width));
    this.add.text((left + right) / 2, top + 14, this.leg.stop ? `CHECKPOINT ${String(this.leg.n).padStart(2, '0')}` : 'THE END OF THE ROAD', { fontFamily: TEXT, fontStyle: 'bold', fontSize: '18px', color: '#FF6A30', letterSpacing: 6 }).setOrigin(0.5).setDepth(-2.9);
    const flags = [left, right].map((px, i) => {
      g.fillStyle(0x0a0712, 1).fillRect(px - 3, top - 90, 6, 90);
      return this.add.triangle(px + 2, top - 84, 0, 0, 0, 36, 60, 18, i ? 0xff6a30 : 0xe3263a).setOrigin(0, 0).setDepth(-3);
    });
    this.tweens.add({ targets: flags, scaleX: { from: 1, to: 0.82 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.gantry = { banner, label };
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
      this.prompts.show('park', ['PARK BETWEEN THE CONES', { key: 'handbrake' }], () => ({ x: (bay().from + bay().to) / 2, y: this.chassis.position.y - 330 }), () => this.phase !== 'drive');
    }
    if (this.parkNote === 1 && nose > bay().to + 40) {
      this.parkNote = 2;
      this.prompts.show('reverse', [{ key: 'reverse' }, 'BACK INTO THE BAY'], () => this.overTruck(), () => this.phase !== 'drive' || this.onTruckAt(TRUCK_NOSE, 0).x < bay().to);
    }
    const inside = back > bay().from && nose < bay().to;
    if (inside && Math.abs(forward) < 0.1 && this.handbrake) {
      // A bonus for parking right in the middle of the bay.
      const slack = (bay().to - bay().from - (TRUCK_BACK + TRUCK_NOSE)) / 2;
      const off = Math.abs((back + nose) / 2 - (bay().from + bay().to) / 2);
      this.parkBonus = Math.round(Phaser.Math.Clamp(100 * (1 - off / slack), 10, 100));
      this.phase = 'arrived';
      this.dash.show(false);
      for (const o of this.touchButtons) o.setVisible(false);
      this.hint.setVisible(false).setText('');
      this.arrivedAt = this.time.now;
      this.engine.stop();
      // The gantry's banner flares ember as the truck parks under it.
      if (this.gantry) {
        this.gantry.banner.setFillStyle(0xff6a30);
        this.gantry.label.setColor('#0A0712');
        this.tweens.add({ targets: this.gantry.label, scale: { from: 1.3, to: 1 }, duration: 380, ease: 'Back.easeOut' });
      }
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

  /**
   * The stop's Lost & Found billboard, standing behind the pile at every stop once you have reached it:
   * a printed board on two posts, lit by a pair of lamps, with the count of what is waiting on a red
   * badge. Hover lifts it and brightens the lamps; click it to open the Lost & Found.
   */
  private maybeOfferLostFound() {
    const pending = () => this.trip.lost.length + this.pendingBroken.length;
    ensurePosterTextures(this);
    const x = 640;
    const gy = GROUND + 6;
    const bw = 440;
    const bh = 236;
    const top = -640;
    const sign = this.add.container(x, gy).setDepth(-4);
    const posts = this.add.graphics();
    posts.fillStyle(0x0a0712, 1);
    for (const px of [-150, 150]) posts.fillRect(px - 9, top + bh - 10, 18, -top - bh + 10);
    posts.lineStyle(8, 0x0a0712, 1).lineBetween(-150, -200, 150, -330).lineBetween(-150, -330, 150, -200);
    for (const px of [-150, 150]) for (const py of [-210, -320]) posts.fillStyle(0xff6a30, 1).fillCircle(px, py, 4);
    sign.add(posts);
    // The lamps on their arms over the board, and their light on it.
    const lights: Phaser.GameObjects.Image[] = [];
    for (const lx of [-120, 120]) {
      sign.add(this.add.rectangle(lx, top - 26, 6, 30, 0x0a0712));
      sign.add(this.add.rectangle(lx, top - 40, 30, 14, 0x0a0712).setStrokeStyle(2, 0xf3e3cc, 0.4));
      const l = this.add.image(lx, top + 70, 'halo').setDisplaySize(260, 220).setTint(0xffc07a).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
      lights.push(l);
    }
    // The board: ink, a bone border, halftone in a corner, the words, a count badge and a strip of tape.
    const board = this.add.rectangle(0, top + bh / 2, bw, bh, 0x0a0712).setStrokeStyle(4, 0x0a0712);
    sign.add(this.add.rectangle(8, top + bh / 2 + 10, bw, bh, 0x000000, 0.35));
    sign.add(board);
    sign.add(this.add.rectangle(0, top + bh / 2, bw - 20, bh - 20).setStrokeStyle(2, 0xf3e3cc, 0.5));
    const dots = this.add.graphics();
    for (let yy = top + 20; yy < top + bh - 14; yy += 12) {
      for (let xx = bw / 2 - 140 + ((yy / 12) % 2 ? 6 : 0); xx < bw / 2 - 14; xx += 12) {
        const k = (xx - (bw / 2 - 140)) / 140;
        if (k * k * 4.5 > 0.5) dots.fillStyle(0xe3263a, 0.3 + k * 0.4).fillCircle(xx, yy, k * k * 4.5);
      }
    }
    sign.add(dots);
    const title = this.add.text(-bw / 2 + 30, top + 68, 'LOST & FOUND', { fontFamily: TITLE, fontSize: '66px', color: '#F3E3CC', letterSpacing: 2 }).setOrigin(0, 0.5).setShadow(5, 6, '#E3263A', 0, true, false);
    const sub = this.add.text(-bw / 2 + 32, top + 128, '', { fontFamily: TEXT, fontStyle: 'bold', fontSize: '16px', color: '#F3E3CC', letterSpacing: 3 }).setOrigin(0, 0.5).setAlpha(0.8);
    const tapeImg = this.add.image(-bw / 2 + 24, top + 186, 't_tape').setOrigin(0, 0.5).setDisplaySize(200, 52).setAngle(-3);
    const claim = this.add.text(-bw / 2 + 50, top + 184, 'CLAIM IT', { fontFamily: TITLE, fontSize: '34px', color: '#0A0712', letterSpacing: 2 }).setOrigin(0, 0.5).setAngle(-3);
    const badge = this.add.circle(bw / 2 - 52, top + 4, 34, 0xe3263a).setStrokeStyle(4, 0x0a0712);
    const count = this.add.text(bw / 2 - 52, top + 2, '', { fontFamily: TITLE, fontSize: '40px', color: '#F3E3CC' }).setOrigin(0.5);
    sign.add([title, sub, tapeImg, claim, badge, count, ...lights]);
    const show = () => {
      const n = pending();
      count.setText(String(n));
      badge.setFillStyle(n ? 0xe3263a : 0x3a0f22);
      sub.setText(n ? `${n} THING${n === 1 ? '' : 'S'} HANDED IN` : 'NOTHING HANDED IN');
      claim.setText(n ? 'CLAIM IT' : 'ALL CLEAR');
    };
    show();
    this.lostFoundBoard = { sign, show };
    board.setInteractive({ cursor: CURSOR.open });
    board.on('pointerover', () => {
      this.tweens.killTweensOf(sign);
      this.tweens.add({ targets: sign, scale: 1.03, duration: 160, ease: 'Back.easeOut' });
      for (const l of lights) l.setAlpha(0.6);
    });
    board.on('pointerout', () => {
      this.tweens.killTweensOf(sign);
      this.tweens.add({ targets: sign, scale: 1, duration: 160 });
      for (const l of lights) l.setAlpha(0.35);
    });
    board.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      play('click');
      this.prompts.dismiss(true, 'lostfound');
      this.openLostFound();
    });
    // The lamps flicker on as you arrive.
    for (const l of lights) this.tweens.add({ targets: l, alpha: { from: 0, to: 0.35 }, duration: 90, yoyo: true, repeat: 2, delay: 600 });
    if (pending()) this.time.delayedCall(2200, () => this.prompts.show('lostfound', [{ key: 'fire' }, 'THE BILLBOARD TO CLAIM'], () => ({ x, y: gy + top - 110 }), () => this.phase !== 'pack' || !pending(), { once: true }));
  }

  /**
   * The stop's Lost & Found, opened from the pile: whatever fell off or broke on earlier legs. Claiming a
   * lost thing has it dropped off by a passing truck - literally, it falls out of the sky onto the ground -
   * so it still has to be dragged onto the truck like everything else. Pets always find their own way back,
   * for free; the stop has tape for broken things, fixed on the spot. Both cost a few rolls of bubble wrap.
   */
  private openLostFound() {
    if (this.lostFoundPanel) return;
    const nameOf = (key: string) => ITEMS.find((i) => i.key === key)?.name ?? key;
    const isPet = (key: string) => !!ITEMS.find((i) => i.key === key)?.pet;
    const count = this.trip.lost.length + this.pendingBroken.length;
    // The Lost & Found, printed like the title: the same sheet and type. Each row is the thing, its
    // name, and a price on torn tape you click to claim it; claimed rows go dim and read CLAIMED.
    const panel = posterSheet(this, 'LOST & FOUND', 250, { alpha: 0.9 });
    this.lostFoundPanel = panel;
    const purse = this.add.text(W / 2, 266, '', { fontFamily: POSTER_MONO, fontStyle: 'bold', fontSize: '26px', color: BONE_CSS, letterSpacing: 5 }).setOrigin(0.5);
    const status = this.add.text(W / 2, H - 196, '', { fontFamily: POSTER_MONO, fontStyle: 'bold', fontSize: '22px', color: EMBER_CSS, letterSpacing: 3, backgroundColor: INK_CSS, padding: { x: 16, y: 8 } }).setOrigin(0.5);
    panel.add([purse, status]);
    const showPurse = () => purse.setText(`BUBBLE WRAP: ${this.extras.coins} ROLL${this.extras.coins === 1 ? '' : 'S'}`);
    showPurse();
    if (!count) panel.add(this.add.text(W / 2, 520, 'NOTHING HANDED IN.\nEVERYTHING MADE IT.', { fontFamily: POSTER_FONT, fontSize: '56px', color: BONE_CSS, align: 'center', letterSpacing: 2 }).setOrigin(0.5).setAlpha(0.8));
    const rowH = Math.min(96, 560 / Math.max(1, count));
    let y = 360 + rowH / 2;
    const dropXs = [260, 420, 580, 740, 900, 1060];
    let dropAt = 0;
    const left = W / 2 - 420;
    const row = (key: string, label: string, cost: number, act: () => void) => {
      const ry = y;
      const tex = isPet(key) ? `${key}_calm` : key;
      const frame = this.textures.exists(`${tex}#0`) ? `${tex}#0` : tex;
      const icon = this.textures.exists(frame) ? this.add.image(left, ry, frame) : undefined;
      if (icon) icon.setScale(Math.min((rowH - 14) / icon.width, (rowH - 14) / icon.height, 1));
      const text = this.add.text(left + 70, ry, label.toUpperCase(), { fontFamily: POSTER_FONT, fontSize: '40px', color: BONE_CSS, letterSpacing: 1 }).setOrigin(0, 0.5);
      const tag = this.add.image(left + 820, ry, 't_tape').setOrigin(1, 0.5).setAngle(-1.5).setScale(220 / 640, 0.8);
      const price = this.add.text(left + 710, ry, cost ? `${cost} ROLLS` : 'FREE', { fontFamily: POSTER_FONT, fontSize: '34px', color: INK_CSS, letterSpacing: 2 }).setOrigin(0.5);
      const rule = this.add.rectangle(left - 40, ry + rowH / 2, 900, 2, 0xf3e3cc, 0.15).setOrigin(0, 0.5);
      panel.add([rule, text, tag, price]);
      if (icon) panel.add(icon);
      let done = false;
      tag.setInteractive({ cursor: CURSOR.open });
      tag.on('pointerover', () => !done && tag.setAngle(1.5));
      tag.on('pointerout', () => tag.setAngle(-1.5));
      tag.on('pointerdown', (_p: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (done) return;
        if (this.extras.coins < cost) {
          play('click');
          this.tweens.add({ targets: [tag, price], x: '+=8', duration: 50, yoyo: true, repeat: 3 });
          status.setText('NOT ENOUGH BUBBLE WRAP  ·  IT LIES WHERE THE ROAD GETS TRICKY');
          return;
        }
        done = true;
        this.extras.coins -= cost;
        act();
        showPurse();
        status.setText('');
        play('stamp');
        tag.setTint(0x6a5a5a).disableInteractive();
        price.setText('CLAIMED');
        for (const o of [text, icon]) o?.setAlpha(0.4);
        if (!this.trip.lost.length && !this.pendingBroken.length) this.time.delayedCall(600, () => this.closeLostFound());
      });
      y += rowH;
    };
    [...this.trip.lost].forEach((key) => {
      const spec = ITEMS.find((sp) => sp.key === key);
      if (!spec) return;
      row(key, nameOf(key), isPet(key) ? 0 : 2, () => {
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
    const list = new PosterList(this, W / 2 - 90, H - 120, [{ label: () => 'BACK', act: () => this.closeLostFound() }], { size: 54 });
    this.lostFoundList = list;
    panel.add(list.container);
  }

  private closeLostFound() {
    this.lostFoundList?.destroy();
    this.lostFoundList = undefined;
    this.lostFoundPanel?.destroy(true);
    this.lostFoundPanel = undefined;
    const pending = this.trip.lost.length + this.pendingBroken.length;
    void pending;
    this.lostFoundBoard?.show();
  }

  /**
   * Parked at a checkpoint: a printed sheet over the scene, with the leg's tally, a TRIP SAVED stamp
   * slammed on, and the next leg named, in the same look as the title and the menus.
   */
  private checkpointCard(trip: Trip, lost: number, broke: number, worth: number) {
    const cx = W / 2;
    const sheet = posterSheet(this, `CHECKPOINT ${String(this.leg.n).padStart(2, '0')}`, 200, { alpha: 0.88, kicker: this.leg.stop!.name.toUpperCase() });
    sheet.setAlpha(0);
    this.tweens.add({ targets: sheet, alpha: 1, duration: 300 });
    const lines: [string, string][] = [
      ['STILL ON THE TRUCK', `${worth} PTS`],
      ['BROKE ON THIS LEG', broke ? String(broke) : 'NONE'],
      ['FELL OFF ON THIS LEG', lost ? String(lost) : 'NONE'],
      [this.parkBonus >= 90 ? 'PARKING · PERFECT' : 'PARKING', `+${this.parkBonus}`],
    ];
    lines.forEach(([label, value], i) => {
      const y = 360 + i * 78;
      sheet.add(this.add.rectangle(cx, y + 34, 820, 2, 0xf3e3cc, 0.18));
      sheet.add(this.add.text(cx - 410, y, label, { fontFamily: TEXT, fontStyle: 'bold', fontSize: '24px', color: '#F3E3CC', letterSpacing: 4 }).setOrigin(0, 0.5).setAlpha(0.85));
      sheet.add(this.add.text(cx + 410, y, value, { fontFamily: TITLE, fontSize: '52px', color: i === 0 ? '#FF6A30' : '#F3E3CC', letterSpacing: 1 }).setOrigin(1, 0.5));
    });
    const next = LEGS[trip.leg - 1];
    sheet.add(this.add.text(cx, 700, `NEXT  ·  ${next.title.toUpperCase()}`, { fontFamily: TITLE, fontSize: '46px', color: '#0A0712', letterSpacing: 3, backgroundColor: '#FF6A30', padding: { x: 22, y: 6 } }).setOrigin(0.5).setAngle(-1.5));
    // The stamp, slammed on at an angle a moment after the sheet lands.
    const stamp = this.add.text(cx + 330, 250, 'TRIP SAVED', { fontFamily: TITLE, fontSize: '54px', color: '#E3263A', letterSpacing: 3, padding: { x: 14, y: 4 } }).setOrigin(0.5).setAngle(-12).setAlpha(0).setScrollFactor(0).setDepth(206);
    stamp.setStroke('#E3263A', 0);
    const box = this.add.rectangle(cx + 330, 250, stamp.width + 16, stamp.height + 4).setStrokeStyle(5, 0xe3263a).setAngle(-12).setAlpha(0).setScrollFactor(0).setDepth(206);
    this.time.delayedCall(450, () => {
      play('stamp');
      this.cameras.main.shake(120, 0.004);
      this.tweens.add({ targets: [stamp, box], alpha: 0.9, scale: { from: 1.8, to: 1 }, duration: 200, ease: 'Cubic.easeIn' });
    });
    const go = this.button(cx + 170, 860, 'btn', 'Continue', 44, () => {
      go.label.setText('Loading...');
      void prepareLeg(this.textures, trip.leg).then(() => this.scene.restart({ leg: trip.leg, trip }));
    });
    go.box.setDepth(205);
    this.button(cx - 170, 860, 'btn_rope', 'Title', 40, () => this.scene.start('title')).box.setDepth(205);
  }

  /** The start of a leg: its name, large, and the mood of the place, fading away. */
  private legCard() {
    const moods: Record<string, string> = { autumn: 'A misty autumn morning', snow: 'The violet hour on the high pass', town: 'A rainy night in town', coast: 'A bright morning by the sea', meadow: '' };
    // The leg's title card, in the poster's type: the place in Anton, the mood in small mono on an ink strip.
    const t1 = this.add.text(W / 2, 330, `${this.leg.title.toUpperCase()}`, { fontFamily: POSTER_FONT, fontSize: '128px', color: BONE_CSS, stroke: INK_CSS, strokeThickness: 12, letterSpacing: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(150).setAlpha(0).setShadow(8, 10, '#E3263A', 0, true, false);
    const t2 = this.add.text(W / 2, 450, `LEG ${this.leg.n}  ·  ${moods[this.leg.biome].toUpperCase()}`, { fontFamily: POSTER_MONO, fontStyle: 'bold', fontSize: '28px', color: BONE_CSS, letterSpacing: 6, backgroundColor: INK_CSS, padding: { x: 20, y: 10 } }).setOrigin(0.5).setScrollFactor(0).setDepth(150).setAlpha(0);
    this.tweens.add({ targets: [t1, t2], alpha: 1, y: '-=20', duration: 900, ease: 'Sine.easeOut', hold: 2200, yoyo: true, onComplete: () => (t1.destroy(), t2.destroy()) });
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
    // The way home: the last leg ends in golden hour, an avenue, arches and fireworks.
    this.finale = this.leg.stop ? undefined : buildFinale(this, { finish: FINISH, groundY, far: this.worlds[this.worlds.length - 1].layers[0], font: POSTER_FONT });
    this.tunnel = before && tunnel ? buildTunnel(this, before, this.leg.biome, groundY) : undefined;
    // The last place keeps its own light until the swap inside the tunnel, so leaving a checkpoint does
    // not suddenly re-light the scenery you are still driving through.
    this.fxPlace = tunnel && before ? before : this.leg.biome;
    applyBiomeFX(this.cameras.main, this.fxPlace);
    const tun = (x: number) => inTunnel(x, tunnel);
    if (meadow) {
      const sun = this.add.image(1180, 400, 'sun').setScrollFactor(0.04).setDepth(-45);
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
      // The manor is a bigger picture: drawn smaller so its dome and flag stay on screen.
      const k = key === 'house_old' ? 1.1 : 0.68;
      const groundY0 = GROUND + 6;
      // The old house is a cottage; the new one is a manor, a bigger picture with its own landmarks.
      const look = key === 'house_old' ? HOUSE : MANOR;
      this.inked(x0, groundY0, key).img.setOrigin(0, look.ground / look.h).setDepth(-10).setScale(k);
      const banner = look.banner;
      this.add.text(x0 + banner.x * k, groundY0 - (look.ground - banner.y) * k, words, { fontFamily: TITLE, fontSize: words.length > 5 ? '24px' : '30px', color: C.cream, stroke: C.ink, strokeThickness: 5 }).setOrigin(0.5).setDepth(-9.9).setRotation(-0.03);
      this.chimneys.push({ x: x0 + look.chimney.x * k, y: groundY0 - (look.ground - look.chimney.y) * k, kind: key === 'house_old' ? 'old' : 'new', n: 0 });
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

    // Over the old street, the game's own logo, as on the title screen (painted there, so it may be missing
    // if a leg was opened directly while building).
    if (this.leg.n === 1 && this.textures.exists('t_logo_small')) this.add.image(960, 250, 't_logo_small').setScale(0.9).setDepth(-5);
    if (!this.leg.stop) this.add.text(FINISH + 700, 30, 'HOME!', { fontFamily: POSTER_FONT, fontSize: '120px', color: BONE_CSS, stroke: INK_CSS, strokeThickness: 12, letterSpacing: 3 }).setOrigin(0.5, 0).setDepth(-5).setShadow(8, 10, '#E3263A', 0, true, false);
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
    // The company name, in the logo's face, printed in ink on the bed's bone name plate.
    this.decal = this.add.text(0, 0, 'SHIFT HAPPENS', { fontFamily: '"Anton", "Impact", sans-serif', fontSize: '24px', color: '#231A2A', letterSpacing: 4 }).setOrigin(0.5).setDepth(21.5);
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
    // Grippier than they were: loads still shift on a bump, but slide off far less.
    const opts = { density: spec.density, friction: Math.min(1, spec.friction * 1.35), frictionStatic: spec.friction * 2.4, restitution: spec.bounce ?? 0.02, frictionAir: 0.012, angle, label: spec.key };
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

  /**
   * A button in the poster's style. The main action ('btn') is printed in ink on a strip of torn ember
   * tape; a secondary one ('btn_rope') is bone type on an ink chip with an ember edge. Both lift and
   * tilt on hover and squash and flash when pressed, and size themselves to their label.
   */
  private button(x: number, y: number, key: string, text: string, size: number, onClick: () => void) {
    ensurePosterTextures(this);
    const primary = key === 'btn';
    const h = Math.round(size * 1.7);
    const label = this.add.text(0, 0, text.toUpperCase(), { fontFamily: POSTER_FONT, fontSize: `${Math.round(size * 1.05)}px`, color: primary ? INK_CSS : BONE_CSS, letterSpacing: 2 }).setOrigin(0.5);
    const tapeBg = this.add.image(0, 0, 't_tape').setAngle(-1.5);
    const chip = this.add.rectangle(0, 0, 10, h, 0x0a0712, 0.9).setStrokeStyle(2, 0xf3e3cc, 0.35);
    const edge = this.add.rectangle(0, 0, 7, h, 0xff6a30).setOrigin(0, 0.5);
    const bg: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle = primary ? tapeBg : chip;
    (primary ? chip : tapeBg).setVisible(false);
    edge.setVisible(!primary);
    const fit = () => {
      const w = label.width + size * 1.6;
      if (primary) tapeBg.setDisplaySize(w, h * 1.08);
      else {
        chip.setSize(w, h);
        chip.setDisplaySize(w, h);
        edge.setX(-w / 2);
      }
      bg.input?.hitArea.setTo?.(0, 0, bg.width, bg.height);
    };
    const setText = label.setText.bind(label);
    label.setText = ((v: string | string[]) => {
      setText(String(v).toUpperCase());
      fit();
      return label;
    }) as typeof label.setText;
    fit();
    const box = this.add.container(x, y, [tapeBg, chip, edge, label]).setScrollFactor(0).setDepth(100);
    for (const o of [tapeBg, chip, edge, label]) o.setScrollFactor(0);
    bg.setInteractive({ cursor: CURSOR.open });
    bg.on('pointerdown', (_p: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      play('click');
      this.tweens.killTweensOf(box);
      box.setScale(0.92);
      if (primary) tapeBg.setTint(0xf3e3cc);
      else chip.setFillStyle(0xff6a30, 0.9);
      this.tweens.add({ targets: box, scale: 1, duration: 220, ease: 'Back.easeOut', onComplete: () => (tapeBg.clearTint(), chip.setFillStyle(0x0a0712, 0.9)) });
      onClick();
    });
    bg.on('pointerover', () => {
      this.tweens.killTweensOf(box);
      this.tweens.add({ targets: box, scale: 1.07, angle: primary ? 1.2 : 0, duration: 160, ease: 'Back.easeOut' });
      if (!primary) chip.setStrokeStyle(2, 0xff6a30, 0.9);
    });
    bg.on('pointerout', () => {
      this.tweens.killTweensOf(box);
      this.tweens.add({ targets: box, scale: 1, angle: 0, duration: 160, ease: 'Sine.easeOut' });
      if (!primary) chip.setStrokeStyle(2, 0xf3e3cc, 0.35);
    });
    return { box, label };
  }

  private hud() {
    const style = { fontFamily: TEXT, fontSize: '40px', color: C.ink };
    this.hint = this.add.text(40, 1006, '', { fontFamily: TEXT, fontStyle: 'bold', fontSize: '24px', color: '#F3E3CC', letterSpacing: 1, backgroundColor: 'rgba(10, 7, 18, 0.88)', padding: { x: 20, y: 12 } }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    this.ropeLines = this.add.graphics().setDepth(25);
    // The print over everything: a fine ink dot screen and paper grain across the whole picture, so the
    // world (people, buildings, furniture, scenery) reads as printed on the same sheet as the title.
    if (!this.textures.exists('t_dotscreen')) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0x0a0712, 1).fillCircle(3, 3, 1.5).fillCircle(9, 9, 1.5);
      g.generateTexture('t_dotscreen', 12, 12);
      g.destroy();
    }
    this.add.tileSprite(0, 0, W, H, 't_dotscreen').setOrigin(0).setScrollFactor(0).setDepth(94).setAlpha(0.06);
    this.add.image(0, 0, 'grain').setOrigin(0).setDisplaySize(W, H).setScrollFactor(0).setDepth(94).setAlpha(0.7);

    // Top right: the points on the truck, and how far along the road it is.
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T) => o.setScrollFactor(0).setDepth(100);
    fixed(this.add.rectangle(W - 14, 18, 566, 122, 0x0a0712, 0.9).setOrigin(1, 0).setStrokeStyle(2, 0xf3e3cc, 0.3));
    fixed(this.add.rectangle(W - 14, 18, 566, 5, 0xff6a30).setOrigin(1, 0));
    fixed(this.add.text(W - 560, 40, 'POINTS', { fontFamily: TEXT, fontStyle: 'bold', fontSize: '13px', color: '#FF6A30', letterSpacing: 4 }).setOrigin(0, 0.5));
    this.hudHearts = fixed(this.add.text(W - 560, 76, '', { fontFamily: TITLE, fontSize: '46px', color: '#F3E3CC', letterSpacing: 1 }).setOrigin(0, 0.5));
    this.hudLabel = fixed(this.add.text(W - 390, 66, '', { fontFamily: TITLE, fontSize: '32px', color: '#F3E3CC', letterSpacing: 1 }).setOrigin(0, 0.5));
    this.hudBar = fixed(this.add.graphics());
    this.hudHomes = [fixed(this.add.image(W - 360, 62, 'house_old#0').setScale(0.08)), fixed(this.add.image(W - 66, 62, 'house_new#0').setScale(0.05))];
    this.hudTruck = fixed(this.add.image(W - 330, 54, 'truck#0').setScale(0.1));
    // The run clock, one slim line along the foot of the same panel: the whole move so far, and the best yet.
    fixed(this.add.rectangle(W - 22, 114, 550, 1, 0xf3e3cc, 0.18).setOrigin(1, 0));
    const best = bestRun();
    if (best) fixed(this.add.text(W - 560, 127, `BEST ${clock(best, false)}`, { fontFamily: TEXT, fontStyle: 'bold', fontSize: '13px', color: '#F3E3CC', letterSpacing: 2 }).setOrigin(0, 0.5).setAlpha(0.55));
    this.hudClock = fixed(this.add.text(W - 30, 127, '', { fontFamily: TEXT, fontStyle: 'bold', fontSize: '15px', color: '#F3E3CC', letterSpacing: 2 }).setOrigin(1, 0.5));
    fixed(this.add.text(W - 150, 127, 'RUN', { fontFamily: TEXT, fontStyle: 'bold', fontSize: '13px', color: '#FF6A30', letterSpacing: 4 }).setOrigin(1, 0.5));

    this.tag = this.add
      .text(0, 0, '', { fontFamily: TEXT, fontStyle: 'bold', fontSize: '22px', color: '#F3E3CC', align: 'center', backgroundColor: 'rgba(10, 7, 18, 0.92)', padding: { x: 16, y: 10 }, lineSpacing: 2 })
      .setOrigin(0.5, 1)
      .setDepth(120)
      .setVisible(false);

    // The dashboard appears when the truck sets off.
    this.dash = new Dash(this, () => this.drive);
    this.dash.create();
    // The sound and effects toggles: small chips, not shouting for attention next to the resource HUD.
    if (false as boolean) {
      this.fxChip = chip(this, 40, 34, 190, 44).setScrollFactor(0).setDepth(100).setInteractive({ cursor: CURSOR.open });
      this.fxLabel = this.add.text(56, 34, '', uiText(22)).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
      this.fxChip.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.toggleFx();
      });
      this.showFx();
    }

    const soundY = 34;
    const soundChip = chip(this, 40, soundY, 190, 44).setScrollFactor(0).setDepth(100).setInteractive({ cursor: CURSOR.open });
    const soundLabel = this.add.text(56, soundY, '', uiText(22)).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    const showSound = () => {
      soundLabel.setText(`SOUND ${audio.muted ? 'OFF' : 'ON'}  · M`);
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
    this.buildTouchControls();
  }

  /**
   * A touchscreen's own controls, shown only on a device that actually has one: gas and brake as big
   * held buttons, the handbrake as a toggle, a gear up/down pair, and a reel button for the crossbow -
   * everything a key or a mouse click does elsewhere, since there is no keyboard to hold a key down on.
   * Aiming the crossbow itself still just uses the same touch-and-drag the pointer already gets.
   */
  private buildTouchControls() {
    if (!this.sys.game.device.input.touch) return;
    const knob = (x: number, y: number, r: number, label: string, active = false) => {
      // Poster-style knobs: an ink disc with a bone ring and an Anton label, ember while pressed.
      const circle = this.add.circle(x, y, r, active ? 0xff6a30 : 0x0a0712, active ? 0.85 : 0.72).setStrokeStyle(3, 0xf3e3cc, 0.7).setScrollFactor(0).setDepth(110).setInteractive({ cursor: CURSOR.open });
      const text = this.add.text(x, y, label, { fontFamily: TITLE, fontSize: `${Math.round(r * 0.52)}px`, color: '#F3E3CC', letterSpacing: 1 }).setOrigin(0.5).setScrollFactor(0).setDepth(111);
      this.touchButtons.push(circle, text);
      return { circle, text };
    };
    const hold = (x: number, y: number, r: number, label: string, set: (v: boolean) => void) => {
      const { circle } = knob(x, y, r, label);
      circle.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        set(true);
        circle.setFillStyle(0xff6a30, 0.9);
      });
      const up = () => {
        set(false);
        circle.setFillStyle(0x0a0712, 0.72);
      };
      circle.on('pointerup', up);
      circle.on('pointerout', up);
    };
    const tap = (x: number, y: number, r: number, label: string, act: () => void) => {
      const { circle } = knob(x, y, r, label);
      circle.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        play('click');
        act();
        this.tweens.add({ targets: circle, scale: 1.15, duration: 80, yoyo: true });
      });
    };
    hold(1815, 900, 72, 'GAS', (v) => (this.touchGas = v));
    hold(1665, 950, 54, 'BRAKE', (v) => (this.touchBrake = v));
    hold(1690, 790, 44, 'REEL', (v) => (this.touchReel = v));
    tap(1550, 760, 40, 'UP', () => this.gearShift(1));
    tap(1550, 860, 40, 'DN', () => this.gearShift(-1));
    const hb = knob(1815, 770, 40, 'P');
    hb.circle.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.toggleHandbrake();
      hb.circle.setFillStyle(this.handbrake ? 0xe3263a : 0x0a0712, this.handbrake ? 0.9 : 0.72);
    });
    // A pause button of its own, shown throughout - there is no Escape key on a touchscreen.
    const pauseBtn = this.add.circle(W / 2, 40, 30, 0x0a0712, 0.8).setStrokeStyle(3, 0xf3e3cc, 0.7).setScrollFactor(0).setDepth(111).setInteractive({ cursor: CURSOR.open });
    this.add.text(W / 2, 40, 'II', { fontFamily: TITLE, fontSize: '28px', color: '#F3E3CC' }).setOrigin(0.5).setScrollFactor(0).setDepth(112);
    pauseBtn.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.togglePause();
    });
    for (const o of this.touchButtons) o.setVisible(false);
  }

  /** ESC: a pause menu over everything, the engine silenced, Matter and tweens frozen while it's up. */
  private togglePause() {
    // Escape closes whatever is on top first - the Controls sheet, then the Lost & Found - rather than
    // the menu underneath it.
    if (this.closeControls) return this.closeControls();
    if (this.lostFoundPanel) return this.closeLostFound();
    if (this.phase === 'done' || this.phase === 'intro') return;
    if (this.pauseUi) this.closePause();
    else this.openPause();
  }

  /** The pause menu, printed like the title screen: the same sheet, type and torn-tape list. */
  private openPause() {
    this.paused = true;
    this.matter.pause();
    this.tweens.pauseAll();
    this.engine.stop();
    play('click');
    const ui = posterSheet(this, 'PAUSED', 300, { alpha: 0.9, kicker: `LEG ${this.leg.n}  ·  ${this.leg.title.toUpperCase()}` });
    this.pauseUi = ui;
    const list = new PosterList(
      this,
      W / 2 - 200,
      400,
      [
        { label: () => 'RESUME', act: () => this.closePause() },
        {
          label: () => 'CONTROLS',
          act: () => {
            list.setEnabled(false);
            this.closeControls = openControls(this, 320, () => {
              this.closeControls = undefined;
              list.setEnabled(true);
            }, this.prompts.mode);
          },
        },
        {
          label: () => `SOUND: ${audio.muted ? 'OFF' : 'ON'}`,
          act: () => {
            audio.toggleMute();
            list.refresh();
          },
        },
        {
          label: () => 'RESTART LEG',
          act: () => {
            this.closePause();
            // From the last checkpoint as it was saved: anything claimed from the Lost & Found since is
            // back in it, rather than lost with the run being restarted.
            void this.scene.restart(this.leg.n === 1 ? { intro: false } : { leg: this.leg.n, trip: loadTrip() ?? this.trip });
          },
        },
        {
          label: () => 'QUIT TO TITLE',
          act: () => {
            this.closePause();
            this.scene.start('title');
          },
        },
      ],
      { step: 92, size: 62 },
    );
    this.pauseList = list;
    ui.add(list.container);
    ui.add(this.add.text(W / 2, H - 70, 'ESC / START  TO RESUME', { fontFamily: POSTER_MONO, fontStyle: 'bold', fontSize: '22px', color: BONE_CSS, letterSpacing: 5 }).setOrigin(0.5).setAlpha(0.55));
  }

  private closePause() {
    if (!this.pauseUi) return;
    this.closeControls?.();
    this.pauseList?.destroy();
    this.pauseList = undefined;
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
    this.fxLabel.setText(`EFFECTS ${this.fx.enabled ? 'ON' : 'OFF'}  · F`);
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
    this.tag.setColor(t.spec.fragile ? '#FF6A30' : '#F3E3CC');
  }

  /** A number that floats up from a point in the world and fades: points won or lost. */
  private floatText(x: number, y: number, text: string, colour: string) {
    const t = this.add.text(x, y, text.toUpperCase(), { fontFamily: POSTER_FONT, fontSize: '42px', color: colour, stroke: INK_CSS, strokeThickness: 9, letterSpacing: 1 }).setOrigin(0.5).setDepth(130).setAngle(Math.random() * 6 - 3);
    t.setShadow(4, 5, '#E3263A', 0, true, false);
    t.setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 90, alpha: 0, delay: 500, duration: 1100, ease: 'Sine.easeIn', onComplete: () => t.destroy() });
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
    this.ropeLabel.setText(`Rope × ${this.ropesLeft}`).setColor(this.roping ? '#FF6A30' : '#F3E3CC');
    if (this.phase !== 'pack') return;
    this.hint.setText(this.roping ? 'CLICK A THING ON THE TRUCK TO TIE IT · CLICK A TIED THING TO UNTIE IT' : 'DRAG THINGS ONTO THE TRUCK · Q / E TURN · R ROPE');
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
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => turn(Math.sign(dy) * (Math.PI / 12)));

    // A gamepad, played the same way: triggers for gas and brake, the right stick to aim, and one
    // button each for the things a key-press does - handbrake, gears, fire. Gas/brake and reeling are
    // read every frame elsewhere (triggers and held buttons); this is just the press-once actions.
    this.input.gamepad?.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      if (this.paused && button.index !== 9) return;
      if (this.phase === 'drive' && button.index === 0) this.toggleHandbrake();
      else if (this.phase === 'drive' && button.index === 2) this.crossbow.fire();
      else if (button.index === 4) this.gearShift(-1);
      else if (button.index === 5) this.gearShift(1);
      else if (button.index === 9) this.togglePause();
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Driving: left click fires the anchor crossbow; right click lets the cable go. A touch instead
      // aims first (the drag this same touch does before lifting) and fires on release - firing the
      // instant a finger lands, before it has had any chance to aim, would not be very playable.
      if (this.phase === 'drive') {
        if (p.wasTouch) {
          this.touchAiming = true;
          return;
        }
        if (p.rightButtonDown()) this.crossbow.release();
        else this.crossbow.fire();
        return;
      }
      if (this.phase !== 'pack') return;
      if (this.held && p.rightButtonDown()) return turn(Math.PI / 2);
      // A finger lands without any hover before it to update where it is in the world, unlike a mouse,
      // so work that out from the touch itself - otherwise the tap tests the last touch's spot instead.
      p.updateWorldPoint(this.cameras.main);
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
      if (this.touchAiming && p.wasTouch) {
        this.touchAiming = false;
        this.crossbow.fire();
      }
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

  /**
   * A word or two popped up over the truck - what just happened, in the moment. There are no toast
   * messages any more: anything that teaches is an in-world prompt (see prompts.ts), and anything that
   * just happened is said right where it happened, in a couple of words, not a sentence to stop and read.
   */
  private say(text: string) {
    const p = this.onTruckAt(240, -250);
    this.floatText(p.x, p.y, text, C.cream);
  }

  /**
   * Something just fell off: time slows for a moment, with an ember flash at the edges of the screen,
   * so there is a real chance to aim the crossbow at it and reel it back. Not more often than every
   * few seconds, so a whole load sliding off does not leave the game crawling.
   */
  private saveMoment() {
    if (this.phase !== 'drive' || this.time.now - this.lastSaveMoment < 4000) return;
    this.lastSaveMoment = this.time.now;
    const timing = (this.matter.world.engine as unknown as { timing: { timeScale: number } }).timing;
    timing.timeScale = 0.4;
    this.tweens.addCounter({ from: 0.4, to: 1, delay: 700, duration: 700, ease: 'Sine.easeIn', onUpdate: (tw) => (timing.timeScale = tw.getValue() ?? 1) });
    const flash = this.add.rectangle(W / 2, H / 2, W, H).setStrokeStyle(26, 0xff6a30, 0.55).setScrollFactor(0).setDepth(96);
    this.tweens.add({ targets: flash, alpha: 0, delay: 500, duration: 900, onComplete: () => flash.destroy() });
    play('pick', 0.6, 0.55);
  }

  /**
   * The HUD's two icons, printed in the poster's inks: a roll of bubble wrap (a bone roll with its
   * bubbles as a halftone, an ink edge) and a fuel can (ember, with a bone cap and an ink cross brace).
   */
  private hudIcons() {
    if (!this.textures.exists('i_wrap')) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0x0a0712).fillRoundedRect(2, 6, 52, 34, 9);
      g.fillStyle(0xf3e3cc).fillRoundedRect(5, 9, 46, 28, 7);
      g.fillStyle(0xd9c3a6);
      for (let y = 14; y < 34; y += 7) for (let x = 10 + ((y / 7) % 2) * 3.5; x < 48; x += 7) g.fillCircle(x, y, 2.4);
      g.fillStyle(0x0a0712).fillEllipse(48, 23, 12, 30);
      g.fillStyle(0xff6a30).fillEllipse(48, 23, 7, 22);
      g.fillStyle(0x0a0712).fillEllipse(48, 23, 3, 9);
      g.generateTexture('i_wrap', 56, 46);
      g.clear();
      g.fillStyle(0x0a0712).fillRoundedRect(4, 8, 38, 40, 6);
      g.fillStyle(0xff6a30).fillRoundedRect(7, 11, 32, 34, 4);
      g.lineStyle(3, 0x0a0712).lineBetween(11, 15, 35, 41).lineBetween(35, 15, 11, 41);
      g.fillStyle(0x0a0712).fillRect(8, 2, 16, 10);
      g.fillStyle(0xf3e3cc).fillRect(11, 4, 10, 6);
      g.lineStyle(4, 0x0a0712).strokeRoundedRect(24, 2, 14, 9, 3);
      g.generateTexture('i_fuel', 46, 50);
      g.destroy();
    }
  }

  /**
   * While loading, the screen's left and right edges are walls, so nothing dropped or flung while
   * packing can tumble out of view. They exist only in the packing phase and go when the truck sets
   * off. There is no ceiling: things claimed from the Lost & Found still drop in from above.
   */
  private packWalls() {
    const packing = this.phase === 'pack';
    if (packing && !this.walls) {
      const cam = this.cameras.main;
      const wall = (x: number) => M.Bodies.rectangle(x, H / 2, 60, H * 4, { isStatic: true, label: 'wall', friction: 0.3, restitution: 0.1 });
      this.walls = [wall(cam.scrollX - 30), wall(cam.scrollX + W + 30)];
      this.matter.world.add(this.walls);
    } else if (!packing && this.walls) {
      for (const b of this.walls) this.matter.world.remove(b);
      this.walls = undefined;
    }
  }

  /** Over the truck's cab, where prompts about driving it stand. */
  private overTruck() {
    const p = this.onTruckAt(150, -320);
    return { x: p.x, y: p.y };
  }

  /** At a toll gate or level crossing: stop at the line, handbrake on, until the attendant starts checking. */
  private gatePrompt(g: { booth: { x: number; y: number }; state: string }) {
    this.prompts.show('gate', ['STOP AT THE LINE', { key: 'handbrake' }], () => ({ x: g.booth.x, y: g.booth.y - 230 }), () => g.state !== 'closed');
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
    if (!this.onTruck(t)) return this.floatText(t.body.position.x, t.body.bounds.min.y - 30, 'NOT ON THE TRUCK', C.cream);
    if (this.ropesLeft < 1) return this.floatText(t.body.position.x, t.body.bounds.min.y - 30, 'NO ROPE LEFT', C.cream);
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
    if (!this.things.some((t) => this.onTruck(t))) return this.say('LOAD SOMETHING FIRST');
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
    if (this.sys.game.device.input.touch && !this.sys.game.device.os.desktop) this.hint.setAlpha(0);
    this.hint.setPosition(DASH_RIGHT + 20, 1040).setFontSize(17).setText('D GAS · A BRAKE · P HANDBRAKE · SHIFT/CTRL GEARS · CLICK FIRE · W REEL · ESC CONTROLS');
    this.dash.show(true);
    for (const o of this.touchButtons) o.setVisible(true);
    this.handbrake = true;
    // Teach driving one step at a time, each prompt waiting for the step before it to be done.
    this.prompts.show('hb', [{ key: 'handbrake' }, 'HANDBRAKE OFF'], () => this.overTruck(), () => !this.handbrake, {
      once: true,
      onDone: () =>
        this.prompts.show('gas', ['HOLD', { key: 'gas' }, 'TO DRIVE'], () => this.overTruck(), () => this.chassis.speed > 4, {
          once: true,
          onDone: () => this.prompts.show('shift', [{ key: 'gearUp' }, 'WHEN THE GEAR GOES RED'], () => this.overTruck(), () => typeof this.drive.target === 'number' && this.drive.target >= 2, { once: true }),
        }),
    });
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
    this.say(result.why.toUpperCase());
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
      this.say(jolt > 0 ? 'LURCH! EASE OFF FIRST' : 'CLUNK! REV IT UP');
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
    this.hudClock.setText(clock(this.trip.time + this.driveTime));
    const packing = this.phase === 'pack' || this.phase === 'intro';
    this.hudLabel.setVisible(packing).setText(`${onTruck} / ${this.things.length} ON THE TRUCK`);
    this.hudTruck.setVisible(!packing);
    for (const h of this.hudHomes) h.setVisible(!packing);
    const g = this.hudBar.clear();
    if (packing) return;
    const x0 = W - 330;
    const x1 = W - 96;
    // The road as a printed strip: dashed bone centre line, the distance covered inked over it in ember.
    g.fillStyle(0x3a0f22, 1).fillRect(x0, 64, x1 - x0, 12);
    g.fillStyle(0xf3e3cc, 0.6);
    for (let x = x0 + 4; x < x1 - 10; x += 22) g.fillRect(x, 69, 11, 2);
    g.fillStyle(0xff6a30, 1).fillRect(x0, 64, (x1 - x0) * pct, 12);
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
    this.prompts.dismiss(false, 'catch');
    play('lost');
    if (t.spec.pet) this.time.delayedCall(250, () => play(t.spec.key === 'cat' ? 'meow' : 'chirp'));
    this.cameras.main.shake(120, 0.002);
  }

  /**
   * The anchor crossbow's other job: something just fell off and is still within its grace period
   * (on the road, not yet officially lost) - a well-aimed bolt reels it straight back onto the bed
   * instead of watching it go. Returns whether this body was actually one of those.
   */
  private tryCatch(body: Body): boolean {
    if (this.phase !== 'drive') return false;
    const t = this.things.find((x) => x.body === body);
    if (!t || !t.packed || t.ghost || t.lost || t.groundFrames <= 0 || t.groundFrames > CATCH_FRAMES) return false;
    const b = this.bed();
    const cos = Math.cos(this.chassis.angle);
    const sin = Math.sin(this.chassis.angle);
    const slot = -140 + Math.random() * 200;
    M.Body.setPosition(t.body, { x: b.x + slot * cos, y: b.y + slot * sin - 90 });
    M.Body.setVelocity(t.body, { x: this.chassis.velocity.x, y: this.chassis.velocity.y });
    M.Body.setAngularVelocity(t.body, 0);
    t.groundFrames = 0;
    this.floatText(t.body.position.x, t.body.position.y - 40, 'Saved!', C.sageDark);
    play('stamp', 1, 1.3);
    return true;
  }

  /** A fragile thing breaks. It stays where it is, as dead weight. */
  private shatter(t: Thing) {
    const wasAboard = t.aboard;
    t.broken = true;
    t.aboard = false;
    this.redraw(t.ink, `${t.spec.key}_broken`);
    if (!wasAboard) return;
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
      const ropes = this.ropesLeft;
      this.prompts.show('load', [{ key: 'drag' }, 'THINGS ONTO THE TRUCK'], () => this.overTruck(), () => this.things.some((t) => this.onTruck(t)), {
        once: true,
        onDone: () => this.prompts.show('rope', [{ key: 'rope' }, 'THEN CLICK A THING TO TIE IT'], () => this.overTruck(), () => this.ropesLeft < ropes || this.phase !== 'pack', { once: true }),
      });
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
    const best = bestRun();
    const record = saveRun(tripTime);
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

    showScorecard(
      this,
      {
        delivered: delivered.map((t) => ({ key: t.img.texture.key, value: this.valueOf(t) })),
        broken: broken.map((t) => ({ key: t.img.texture.key, value: this.valueOf(t) })),
        lost: lostCount,
        earned,
        penalty,
        bonus,
        parking,
        stops: this.trip.parking.length + 1,
        score,
        stars,
        verdict,
        time: clock(tripTime, false),
        best: best !== null ? clock(Math.min(best, tripTime), false) : null,
        record,
      },
      () => this.scene.restart({ intro: false }),
    );
  }

  update(time: number, delta: number) {
    if (this.waiting) return;
    if (this.paused) return;
    this.prompts.update();
    this.packWalls();
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
      const pad = this.input.gamepad?.pad1;
      const right = this.keys.right.isDown || this.keys.d.isDown || (pad?.buttons[7]?.value ?? 0) > 0.15 || this.touchGas;
      const left = this.keys.left.isDown || this.keys.a.isDown || (pad?.buttons[6]?.value ?? 0) > 0.15 || this.touchBrake;
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
      // A deflected right stick aims the crossbow directly, out from the turret in the stick's own
      // direction; otherwise the mouse does, exactly as before.
      const stick = pad?.rightStick;
      const aimAt = stick && Math.hypot(stick.x, stick.y) > 0.25 ? { x: this.onTruckAt(196, -198).x + stick.x * 1000, y: this.onTruckAt(196, -198).y + stick.y * 1000 } : { x: ptr.worldX, y: ptr.worldY };
      this.crossbow.update(Math.min(0.05, delta / 1000), aimAt);
      const showExtras = this.phase === 'drive';
      const wrapText = `${this.extras.coins}`;
      if (this.extrasLabel.text !== wrapText) this.extrasLabel.setText(wrapText);
      const fuelPct = Math.round(this.extras.fuel * 100);
      this.fuelPctText.setText(`${fuelPct}%`);
      this.extrasIcons.fuelBar.width = 88 * Phaser.Math.Clamp(this.extras.fuel, 0, 1);
      this.extrasIcons.fuelBar.setFillStyle(this.extras.fuel < 0.25 ? 0xe3263a : 0xff6a30);
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
    // The run clock: it counts while you pack and while you drive, and stops once you park.
    if (this.phase === 'pack' && !this.waiting) this.driveTime += delta / 1000;
    if (this.phase === 'drive') {
      this.driveTime += delta / 1000;

      const cx = this.chassis.position.x;
      for (const t of this.things) {
        if (t.ghost) {
          if (t.body.position.x < cx - 1600) this.forget(t);
          continue;
        }
        t.groundFrames = this.onRoad(t) ? t.groundFrames + 1 : 0;
        if (t.groundFrames === 1 && t.aboard && t.packed) this.saveMoment();
        if (t.groundFrames === 1 && t.aboard && t.packed) this.prompts.show('catch', [{ key: 'fire' }, 'IT TO CATCH IT'], () => ({ x: t.body.position.x, y: t.body.bounds.min.y - 80 }), () => t.groundFrames === 0);
        // A longer grace than it looks like it needs: long enough to actually aim the crossbow at
        // whatever just fell and reel it back, not just long enough to notice it happened.
        if (t.groundFrames <= CATCH_FRAMES && t.body.position.x > cx - 2400) continue;
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
    const place = k === 1 ? this.leg.biome : LEGS[this.leg.n - 2].biome;
    if (place !== this.fxPlace) {
      this.fxPlace = place;
      applyBiomeFX(cam, place);
    }
    for (const wd of this.worlds) {
      const on = wd.prev ? k === 0 : k === 1;
      // Weather (the top band) stays outside: no leaves or snow blowing through the tunnel.
      const sheltered = (this.tunnel?.inside(cam.scrollX + W / 2) ?? 0) > 0.35;
      wd.layers.forEach((l, i) => l.setAlpha(1).setVisible(on && !(i === 3 && sheltered)));
      if (on) wd.built.update(time, delta, cam.scrollX);
    }
    this.tunnel?.update(time, cam.scrollX);
    this.finale?.(time, cam.scrollX + W / 2, this.phase === 'arrived' || this.phase === 'done');
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
