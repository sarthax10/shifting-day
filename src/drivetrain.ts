/**
 * The truck's engine, clutch and gearbox.
 *
 * Built the way a real car works (after Marco Monster's "Car Physics for Games" and
 * x-engineer.org on clutches), scaled to the game's pixels and frames:
 *
 *   wheel force = engine torque(rpm) × throttle × gear ratio × final drive × efficiency ÷ wheel radius
 *   engine rpm  = wheel speed × gear ratio × final drive   (while the clutch is closed)
 *
 * Low gears multiply the engine's torque, so they pull hard but run out of revs quickly.
 * High gears are the other way round. Top speed is not set anywhere: it is where the drive
 * force meets rolling resistance and air drag.
 *
 * A shift opens the clutch for a moment: no drive reaches the wheels, and the engine spins
 * on its own (up if the player holds the throttle, down towards idle if not). When the clutch
 * closes again, the engine is forced to the speed the wheels now demand. If the two did not
 * match, the difference comes out as a jolt through the truck, forwards or backwards, and
 * the load shifts. A smooth shift matches the revs.
 */

export type Gear = 'R' | 'N' | 1 | 2 | 3 | 4;
export const GEARS: Gear[] = ['R', 'N', 1, 2, 3, 4];

/** Gear ratios, like an old four-speed pickup. Reverse is a low gear the other way round. */
const RATIO: Record<string, number> = { R: -3.6, N: 0, 1: 3.5, 2: 2.15, 3: 1.42, 4: 1.0 };

export const IDLE = 850;
export const REDLINE = 5800;
/** The rev limiter cuts the fuel here. */
export const LIMIT = 6200;

/**
 * Engine rpm for each pixel-per-frame of road speed in a gear of ratio 1.
 * It folds the final drive and the wheel size into one number.
 */
const RPM_PER_SPEED = 470;
/** Speed change per frame, per unit of torque and gear ratio: the final drive, efficiency and the truck's weight. */
const PULL = 0.112;
/** Rolling resistance grows with speed; air drag with speed squared. Together they set the top speed. */
const ROLLING = 0.0032;
const DRAG = 0.00042;
/** How hard the engine slows the truck when the throttle is shut and a gear is in. */
const ENGINE_BRAKE = 0.000006;
/** Seconds the clutch stays open during a shift. */
const SHIFT_TIME = 0.22;
/** Speed change per rpm of mismatch when the clutch bites. */
const JOLT = 0.00012;

/**
 * How much of its best torque the engine makes at each rpm. Weak at idle, strongest in the
 * middle, falling away towards the redline, like a real torque curve.
 */
const CURVE: [number, number][] = [
  [0, 0.4],
  [1000, 0.6],
  [2000, 0.83],
  [3000, 0.96],
  [3800, 1.0],
  [4800, 0.93],
  [5600, 0.8],
  [6300, 0.6],
];

export function torqueAt(rpm: number): number {
  if (rpm <= CURVE[0][0]) return CURVE[0][1];
  for (let i = 1; i < CURVE.length; i++) {
    const [r1, t1] = CURVE[i];
    if (rpm <= r1) {
      const [r0, t0] = CURVE[i - 1];
      return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
    }
  }
  return CURVE[CURVE.length - 1][1];
}

export function gearName(g: Gear): string {
  return typeof g === 'number' ? String(g) : g;
}

export interface ShiftResult {
  ok: boolean;
  /** Why the gearbox refused, to tell the player. */
  why?: string;
}

export interface DriveOutput {
  /** Change in forward speed this frame from the engine, engine braking and resistance, in pixels a frame. */
  accel: number;
  /** A one-off change in forward speed from the clutch biting on a mismatch. */
  jolt: number;
  /** True for the frame a shift completes. */
  shifted: boolean;
  /** True for the frame the engine stalls. */
  stalled: boolean;
}

export class Drivetrain {
  gear: Gear = 1;
  rpm = IDLE;
  /** The throttle pedal, eased so it does not snap. 0 to 1. */
  throttle = 0;
  /** True while the clutch is slipping to get the truck moving from very slow. */
  slipping = false;
  /** True for a moment when the rev limiter cuts in. */
  limiting = false;
  /**
   * The engine has stalled: pulling away in too high a gear asks the clutch to drag the whole truck
   * from a stop with almost no torque multiplication, and the engine dies. It restarts in a low gear.
   */
  stalled = false;
  /** 0 to 1: how much the engine is labouring at too few revs for its gear (for a shudder and a sound). */
  lugging = 0;
  /** How much of its power the engine can make: less when the tank is dry and it is coughing along. */
  power = 1;
  private shiftLeft = 0;
  private shiftTime = SHIFT_TIME;
  private next: Gear = 1;
  private limitTimer = 0;

  get shifting() {
    return this.shiftLeft > 0;
  }

  /** The gear the lever is heading for: the next gear during a shift, or the current one. */
  get target(): Gear {
    return this.shifting ? this.next : this.gear;
  }

  /** How far through the shift the lever is, 0 to 1. */
  get progress() {
    return this.shifting ? 1 - this.shiftLeft / this.shiftTime : 1;
  }

  /** The ratio of any gear: how many turns of the engine make one turn of the gearbox output. */
  static ratioOf(g: Gear) {
    return RATIO[String(g)];
  }

  get ratio() {
    return RATIO[String(this.gear)];
  }

  /** Engine rpm the wheels demand in a gear, at a forward speed in pixels a frame. */
  wheelRpm(speed: number, gear: Gear = this.gear) {
    return Math.abs(speed * RATIO[String(gear)] * RPM_PER_SPEED);
  }

  /** Moves the lever one step up (+1) or down (-1), in the order R, N, 1, 2, 3, 4. */
  shift(dir: 1 | -1, speed: number): ShiftResult {
    const i = GEARS.indexOf(this.target) + dir;
    if (i < 0 || i >= GEARS.length) return { ok: false };
    return this.shiftTo(GEARS[i], speed);
  }

  /** Moves the lever straight to a gear, as on a real H-pattern gearbox: 4th to 2nd is one move. */
  shiftTo(to: Gear, speed: number): ShiftResult {
    const from = this.target;
    if (to === from) return { ok: false };
    // Reverse only goes in when the truck has (nearly) stopped, or the gears grind.
    if (to === 'R' && speed > 0.6) return { ok: false, why: 'Stop first, then reverse.' };
    if (from === 'R' && to !== 'N' && speed < -0.6) return { ok: false, why: 'Stop first.' };
    // A downshift that would spin the engine past its limit is refused, as a real gearbox's synchros would fight it.
    if (typeof to === 'number' && speed > 0 && this.wheelRpm(speed, to) > LIMIT + 250) {
      return { ok: false, why: `Too fast for ${to}${['st', 'nd', 'rd', 'th'][to - 1]}!` };
    }
    this.next = to;
    this.shiftTime = to === 'N' || from === 'N' ? SHIFT_TIME * 0.6 : SHIFT_TIME;
    this.shiftLeft = this.shiftTime;
    return { ok: true };
  }

  /**
   * One frame of the drivetrain. `speed` is the truck's speed along its own length, in pixels a frame,
   * forwards positive. `pedal` is the throttle key, 0 or 1.
   */
  step(dt: number, speed: number, pedal: number): DriveOutput {
    this.throttle += (pedal - this.throttle) * Math.min(1, dt * 9);
    const out: DriveOutput = { accel: 0, jolt: 0, shifted: false, stalled: false };
    // Rolling resistance and drag always act against the motion.
    out.accel -= ROLLING * speed + DRAG * speed * Math.abs(speed);
    this.lugging = 0;

    if (this.stalled) {
      // A dead engine: the revs fall away, and the lever still moves freely (the clutch is in).
      this.rpm += (0 - this.rpm) * Math.min(1, dt * 5);
      if (this.shifting) {
        this.gear = this.next;
        this.shiftLeft = 0;
        out.shifted = true;
      }
      return out;
    }

    if (this.limitTimer > 0) this.limitTimer -= dt;
    this.limiting = this.limitTimer > 0;

    if (this.shifting) {
      // Clutch open: the engine spins freely, the wheels get nothing.
      this.freeRev(dt);
      this.shiftLeft -= dt;
      if (this.shiftLeft <= 0) {
        this.shiftLeft = 0;
        this.gear = this.next;
        out.shifted = true;
        if (this.gear !== 'N') {
          // Clutch closes. The engine must now turn at the speed the wheels demand.
          const target = Math.max(IDLE, this.wheelRpm(speed));
          const mismatch = this.rpm - target;
          // Engine faster than the wheels: it shoves the truck forward. Slower: it drags it back.
          // In reverse the push is the other way.
          const sign = Math.sign(this.ratio);
          if (Math.abs(speed) > 0.4) out.jolt = Math.max(-0.5, Math.min(0.5, mismatch * JOLT)) * sign;
          this.rpm = target;
        }
      }
      return out;
    }

    if (this.gear === 'N') {
      this.freeRev(dt);
      return out;
    }

    const ratio = this.ratio;
    const demanded = this.wheelRpm(speed);
    // Moving the wrong way for this gear (rolling back down a hill in first, say) counts as very slow.
    const wrongWay = speed * ratio < -0.05;
    if (demanded < IDLE * 1.1 || wrongWay) {
      // Too slow for the clutch to be fully closed: it slips, letting the engine keep its revs
      // while it drags the truck into motion. This is how a car pulls away from a stop.
      this.slipping = true;
      // Pulling away in 3rd or 4th with the throttle open: not enough torque, and the engine dies.
      if (typeof this.gear === 'number' && this.gear >= 3 && this.throttle > 0.35) {
        this.stalled = true;
        out.stalled = true;
        return out;
      }
      const target = IDLE + 2400 * this.throttle;
      this.rpm += (target - this.rpm) * Math.min(1, dt * 6);
    } else {
      this.slipping = false;
      this.rpm = demanded;
    }

    let gas = this.throttle * this.power;
    const taper = Math.max(0, Math.min(1, (LIMIT - this.rpm) / 400));
    this.limiting = taper < 0.25 && gas > 0.5;
    gas *= taper;

    // Too few revs for the gear (climbing a hill in 4th, say): the engine labours and loses its pull,
    // so the truck slows, the revs fall further, and it is time to change down.
    let lug = 1;
    if (!this.slipping && typeof this.gear === 'number' && this.gear >= 2 && this.rpm < 1400) {
      lug = Math.max(0.5, (this.rpm - IDLE) / (1400 - IDLE));
      this.lugging = gas * (1 - lug);
    }
    // Torque through the gears to the road.
    out.accel += gas * torqueAt(this.rpm) * lug * ratio * PULL;
    // Throttle shut with a gear in: the engine holds the truck back, harder at high revs.
    if (!this.slipping) out.accel -= (1 - this.throttle) * ENGINE_BRAKE * this.rpm * Math.abs(ratio) * Math.sign(speed);

    return out;
  }

  /** Turns the key again after a stall. */
  restart() {
    this.stalled = false;
    this.rpm = IDLE;
    this.throttle = 0;
  }

  /** The engine on its own, with the clutch open: revs climb with throttle and fall back towards idle without it. */
  private freeRev(dt: number) {
    const target = this.throttle > 0.05 ? IDLE + (LIMIT - IDLE) * this.throttle : IDLE;
    const rate = target > this.rpm ? 7 : 3.2;
    this.rpm += (target - this.rpm) * Math.min(1, dt * rate);
    if (this.rpm > LIMIT) this.rpm = LIMIT;
  }


}
