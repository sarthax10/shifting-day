import Phaser from 'phaser';
import { ITEMS, type ItemSpec } from './art';
import { groundY, FINISH, type Feature } from './terrain';

// Mirrors game.ts's own private constants for the bay (FINISH+80 to FINISH+900) and the truck's nose/back
// offsets from its centre, close enough to steer by without reaching into the scene for them.
const TRUCK_NOSE = 476;
const TRUCK_BACK = 194;
import { clearTrip, loadTrip } from './legs';

// The same escape hatch game.ts itself uses to reach the raw matter-js library through Phaser's bundle.
const M = (Phaser.Physics.Matter as unknown as { Matter: { Body: { setPosition: (b: MatterJS.BodyType, p: { x: number; y: number }) => void; setVelocity: (b: MatterJS.BodyType, v: { x: number; y: number }) => void } } }).Matter;

/**
 * A dev-only autopilot that plays the whole game, start to finish: packs the truck, drives, stops for
 * gates, fires the anchor crossbow at every cliff, parks, claims the Lost & Found, and moves itself on to
 * the next leg - the same loop a person would, driven through the same inputs (the keyboard `Key` objects
 * and the pointer) rather than by poking at physics directly. It is meant to catch the kind of bug that
 * only shows up over a full run: a leg that can't be finished, a cliff that can't be climbed, a stuck
 * truck, a crash in some rarely-hit path. Run it from the browser console with `__qa()`; it logs its way
 * leg by leg and prints a report at the end. It never ships: see the `import.meta.env.DEV` guard in
 * main.ts.
 */

/** The handful of scene members the autopilot drives or reads. Everything else it leaves alone. */
interface QAScene {
  sys: Phaser.Scenes.Systems;
  scene: Phaser.Scenes.ScenePlugin;
  cameras: Phaser.Cameras.Scene2D.CameraManager;
  input: Phaser.Input.InputPlugin;
  things: { spec: ItemSpec; body: MatterJS.BodyType; ghost: boolean; gone?: boolean; broken: boolean; aboard: boolean; lost?: boolean; packed?: boolean; ink: { img: Phaser.GameObjects.Image } }[];
  leg: { n: number; title: string; features: Feature[]; stop?: unknown };
  trip: { lost: string[] };
  pendingBroken: { spec: ItemSpec; broken: boolean; aboard: boolean; ink: { img: Phaser.GameObjects.Image } }[];
  lostFoundBtn?: unknown;
  gates: { x: number; state: 'closed' | 'checking' | 'open' }[];
  chassis: MatterJS.BodyType;
  handbrake: boolean;
  parkNote: number;
  phase: string;
  pauseUi?: unknown;
  keys: Record<'d' | 'a' | 'w' | 'p' | 'space', { isDown: boolean }>;
  drive: { stalled: boolean; gear: unknown };
  bed(): { x: number; y: number };
  onTruck(t: unknown): boolean;
  addThing(spec: ItemSpec, x: number, y: number, angle: number): void;
  go(): void;
  openLostFound(): void;
  closeLostFound(): void;
  togglePause(): void;
  toggleHandbrake(): void;
  tryRestart(): void;
  gearTo(gear: unknown): void;
}

export interface QAReport {
  completed: boolean;
  legsPlayed: number;
  issues: string[];
  legSeconds: number[];
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitUntil(pred: () => boolean, timeoutMs: number, tickMs = 100): Promise<boolean> {
  const start = performance.now();
  while (!pred()) {
    if (performance.now() - start > timeoutMs) return false;
    await wait(tickMs);
  }
  return true;
}

export async function runQA(game: Phaser.Game): Promise<QAReport> {
  const report: QAReport = { completed: false, legsPlayed: 0, issues: [], legSeconds: [] };
  const log = (msg: string) => console.log(`%c[QA] ${msg}`, 'color:#5daa7a');
  const warn = (msg: string) => {
    console.warn(`[QA] ISSUE: ${msg}`);
    report.issues.push(msg);
  };
  const scene = () => game.scene.getScene('play') as unknown as QAScene;

  try {
    log('Starting a fresh run from the title screen...');
    clearTrip();
    // The scene registry can still be settling right after a page load; wait for it to exist, then
    // retry the start itself a couple of times before giving up, rather than failing on a timing fluke.
    const registered = await waitUntil(() => !!game.scene.getScene('play'), 4000, 100);
    if (!registered) {
      warn('The play scene was never registered.');
      return report;
    }
    let booted = false;
    for (let attempt = 0; attempt < 3 && !booted; attempt++) {
      game.scene.start('play', { intro: false });
      booted = await waitUntil(() => scene()?.sys?.isActive(), 2500, 100);
    }
    if (!booted) {
      warn('The play scene never became active.');
      return report;
    }

    for (let guard = 0; guard < 20; guard++) {
      const s = scene();
      const legStart = performance.now();
      log(`Leg ${s.leg.n}: ${s.leg.title}`);

      // A quick smoke test of the pause menu, once, on the first leg.
      if (s.leg.n === 1) {
        s.togglePause();
        await wait(150);
        if (!s.pauseUi) warn('Pause menu did not open from togglePause().');
        s.togglePause();
        await wait(150);
        if (s.pauseUi) warn('Pause menu did not close on a second togglePause().');
      }

      // Claim everything waiting in the Lost & Found before packing, the same way a clicked price tag
      // would: pets free, everything else paid for out of the same bubble-wrap balance the HUD shows.
      if (s.lostFoundBtn) {
        log(`Claiming ${s.trip.lost.length} lost thing(s) and ${s.pendingBroken.length} broken one(s)...`);
        const b = s.bed();
        let dropped = 0;
        for (const key of [...s.trip.lost]) {
          const spec = ITEMS.find((i) => i.key === key);
          if (!spec) continue;
          const at = s.trip.lost.indexOf(key);
          if (at >= 0) s.trip.lost.splice(at, 1);
          s.addThing(spec, 220 + (dropped++ % 6) * 150, -420, 0);
        }
        for (const t of [...s.pendingBroken]) {
          t.broken = false;
          t.aboard = true;
          t.ink.img.setTexture(`${t.spec.pet ? t.spec.key + '_calm' : t.spec.key}#0`);
        }
        s.pendingBroken.length = 0;
        s.closeLostFound();
        // The freshly-dropped things need to fall, then get loaded like anything else below.
        await wait(900);
      }

      // Pack the truck: a dozen things not already aboard (the original household pile on leg one, or
      // whatever just fell out of the sky from the Lost & Found) loaded straight onto the bed - a real
      // load to drive with, not literally everything, which only piles on weight no one would carry.
      {
        const b = s.bed();
        const PACK_LIMIT = 12;
        let i = 0;
        for (const t of s.things) {
          if (i >= PACK_LIMIT) break;
          if (t.ghost || t.gone || s.onTruck(t)) continue;
          const dx = -150 + (i % 6) * 55;
          const dy = -90 - Math.floor(i / 6) * 60;
          M.Body.setPosition(t.body, { x: b.x + dx, y: b.y + dy });
          M.Body.setVelocity(t.body, { x: 0, y: 0 });
          i++;
        }
        await wait(300);
        s.go();
      }
      const started = await waitUntil(() => s.phase === 'drive', 2000);
      if (!started) {
        warn(`Leg ${s.leg.n}: go() did not start the drive (nothing packed?).`);
        break;
      }
      // go() sets off with the handbrake on, same as a person would find it; let it off to pull away.
      if (s.handbrake) s.toggleHandbrake();

      // Drive: hold the gas, stop and wait at gates, fire the crossbow and reel in at cliffs, and let
      // the game's own parking logic (parkNote) say when to brake and when to back up. First gear
      // throughout trades speed for torque, so the autopilot never lacks the power to climb a hill.
      s.gearTo(1);
      const cliffs = s.leg.features.filter((f) => f.length > 3).map(([fx]) => fx as number);
      const cleared = new Set<number>();
      let lastX = s.chassis.position.x;
      let lastProgressAt = performance.now();
      let overshotOnce = false;
      let anchoredSince = 0;
      let recoveryAttempts = 0;
      /** The cliff currently being dealt with, if any: set once in range, kept regardless of where the
       * truck drifts to afterwards, so a release-and-retry doesn't lose track of it mid-climb. */
      let activeCliff: number | undefined;
      const driveTickMs = 90;
      // First gear climbs everything reliably but slowly; a leg with several hills needs real minutes,
      // not the one a flatter leg would need. Generous on purpose - the stuck watchdog below is what
      // actually catches a leg that cannot be finished at all.
      const driveTimeout = 240_000;
      const driveStart = performance.now();
      let done = false;
      while (!done) {
        if (performance.now() - driveStart > driveTimeout) {
          warn(`Leg ${s.leg.n}: drive phase timed out after ${driveTimeout / 1000}s at x=${Math.round(s.chassis.position.x)}.`);
          break;
        }
        await wait(driveTickMs);
        const phase = s.phase as string;
        if (phase === 'done') {
          done = true;
          break;
        }
        if (phase !== 'drive' && phase !== 'arrived') continue;

        // Stuck watchdog: no real *forward* progress for 8 seconds while meant to be driving is worth
        // flagging. Only forward counts - a slow backward drift must not keep resetting this, or a truck
        // rolling gently backward down a hill forever would never be caught as stuck.
        if (s.chassis.position.x - lastX > 20) {
          lastX = s.chassis.position.x;
          lastProgressAt = performance.now();
        } else if (performance.now() - lastProgressAt > 8000 && phase === 'drive' && (s as unknown as { crossbow: { state: string } }).crossbow.state === 'ready') {
          warn(`Leg ${s.leg.n}: the truck made no progress for 8s, stuck near x=${Math.round(s.chassis.position.x)}.`);
          lastProgressAt = performance.now();
          if (recoveryAttempts >= 4) {
            // Rocking it free a few times and still nowhere: stop making it worse and let the leg
            // timeout report where it actually gave up.
            warn(`Leg ${s.leg.n}: gave up trying to free it after ${recoveryAttempts} attempts, still at x=${Math.round(s.chassis.position.x)}.`);
            continue;
          }
          recoveryAttempts++;
          // A rocking recovery, the way a person would: back off, then take another run at it. Only
          // while the crossbow is unused - reversing with a rope out or a bolt in the air would just
          // tangle things further, and the cliff branch below has its own way of giving up and retrying.
          log(`Leg ${s.leg.n}: trying to rock it free (attempt ${recoveryAttempts}) at x=${Math.round(s.chassis.position.x)}...`);
          s.keys.w.isDown = false;
          s.keys.d.isDown = false;
          // Brake to a near-stop before each gear change: shifting between forward and reverse while
          // still moving is refused (same as a person grinding the gearbox), which otherwise leaves the
          // truck stuck accelerating the wrong way with nothing able to shift it back.
          s.keys.a.isDown = true;
          await waitUntil(() => Math.abs(s.chassis.velocity.x) < 0.3, 1200, 60);
          s.keys.a.isDown = false;
          s.gearTo('R');
          await wait(150);
          s.keys.d.isDown = true;
          await wait(450);
          s.keys.d.isDown = false;
          s.keys.a.isDown = true;
          await waitUntil(() => Math.abs(s.chassis.velocity.x) < 0.3, 1500, 60);
          s.keys.a.isDown = false;
          s.gearTo(1);
          await wait(150);
          s.keys.d.isDown = true;
          continue;
        }
        if (s.drive.stalled) s.keys.d.isDown = true; // the scene's own update() restarts it while the pedal is held.

        // A cliff ahead: approach to close range, aim at the plateau just past its top, fire, and reel
        // in across it - the same "get up close, then aim up" a person would do, not a long pot shot
        // from wherever the truck happens to be when the cliff first comes into view. Once engaged,
        // keep handling the SAME cliff regardless of where the truck drifts to meanwhile (reeling in,
        // or a release-and-retry) - position alone decides whether to start, never whether to stop.
        if (activeCliff === undefined) {
          activeCliff = cliffs.find((cx) => !cleared.has(cx) && cx - s.chassis.position.x < 400 && cx - s.chassis.position.x > -200);
        }
        if (activeCliff !== undefined) {
          const cliffX = activeCliff;
          // Already past it, however that happened (the game's own overshoot auto-release included):
          // done, don't re-engage.
          if (s.chassis.position.x > cliffX + 260) {
            s.keys.w.isDown = false;
            cleared.add(cliffX);
            activeCliff = undefined;
            anchoredSince = 0;
            continue;
          }
          const anyS = s as unknown as { crossbow: { fire: () => void; release: () => void; state: string } };
          const cb = anyS.crossbow.state;
          s.keys.d.isDown = cb !== 'stuck' && cb !== 'flying';
          if (cb === 'ready') {
            const aimX = cliffX + 300;
            const aimY = groundY(aimX) - 120;
            const p = s.input.activePointer;
            p.x = aimX - s.cameras.main.scrollX;
            p.y = aimY - s.cameras.main.scrollY;
            anyS.crossbow.fire();
          }
          if (cb === 'stuck') {
            if (!anchoredSince) anchoredSince = performance.now();
            s.keys.w.isDown = true;
            if (s.chassis.position.x > cliffX + 260) {
              s.keys.w.isDown = false;
              cleared.add(cliffX);
              activeCliff = undefined;
              anchoredSince = 0;
            } else if (performance.now() - anchoredSince > 7000) {
              // Fully wound in and still short of the top: let go, drift back down, and take another
              // run at it rather than hang here forever. Left active, so the next tick re-aims at the
              // same cliff instead of searching anew from wherever the truck ends up.
              log(`Leg ${s.leg.n}: the cable maxed out short of the top at x=${Math.round(s.chassis.position.x)}; letting go to try again.`);
              s.keys.w.isDown = false;
              anyS.crossbow.release();
              anchoredSince = 0;
            }
          } else {
            anchoredSince = 0;
          }
          continue;
        }
        s.keys.w.isDown = false;

        // A gate ahead, not open yet: brake to a stop, handbrake on, then wait for it to open.
        const gate = s.gates.find((g) => g.state !== 'open' && g.x - s.chassis.position.x < 420 && g.x - s.chassis.position.x > -60);
        if (gate) {
          s.keys.d.isDown = false;
          s.keys.a.isDown = true;
          const stopped = await waitUntil(() => Math.abs(s.chassis.velocity.x) < 0.3, 2500, 80);
          s.keys.a.isDown = false;
          if (stopped && !s.handbrake) s.toggleHandbrake();
          const opened = await waitUntil(() => gate.state === 'open', 6000, 150);
          if (!opened) warn(`Leg ${s.leg.n}: a gate at x=${Math.round(gate.x)} never opened.`);
          if (s.handbrake) s.toggleHandbrake();
          continue;
        }

        // Parking at the end of the leg: drive all the way to the bay's front edge, only then brake to
        // a stop and pull the handbrake - parking() only counts it parked with the handbrake actually
        // on, the same as a gate - backing up first if the truck went past the far end.
        {
          const noseX = s.chassis.position.x + TRUCK_NOSE;
          const backX = s.chassis.position.x - TRUCK_BACK;
          if (noseX >= FINISH + 900) {
            if (!overshotOnce) {
              overshotOnce = true;
              log(`Leg ${s.leg.n}: overshot the bay, backing up.`);
            }
            s.keys.a.isDown = false;
            s.gearTo('R');
            s.keys.d.isDown = true;
          } else if (backX > FINISH + 80) {
            // At least at the bay's front edge: stop here, inside, and set the handbrake.
            if (Math.abs(s.chassis.velocity.x) < 0.2) {
              s.keys.d.isDown = false;
              s.keys.a.isDown = false;
              if (!s.handbrake) s.toggleHandbrake();
            } else {
              s.keys.d.isDown = false;
              s.keys.a.isDown = true;
            }
          } else {
            // Not there yet: keep driving.
            s.keys.a.isDown = false;
            if (s.parkNote === 0) s.gearTo(1);
            s.keys.d.isDown = true;
          }
        }
        if (phase === 'arrived' && !s.handbrake) s.toggleHandbrake();
      }
      s.keys.d.isDown = false;
      s.keys.a.isDown = false;
      s.keys.w.isDown = false;

      const secs = (performance.now() - legStart) / 1000;
      report.legSeconds.push(Math.round(secs));
      report.legsPlayed++;
      log(`Leg ${s.leg.n} done in ${secs.toFixed(1)}s.`);

      if (!s.leg.stop) {
        // The last leg: finish() has already run and cleared the trip. Nothing more to drive to.
        report.completed = true;
        log('Reached the final stop. Run complete.');
        break;
      }

      // checkpoint() saves the trip and shows the card; grab what it saved and start the next leg
      // directly; the same thing clicking "Continue" on the card does.
      const saved = await waitUntil(() => !!loadTrip(), 3000);
      if (!saved) {
        warn(`Leg ${s.leg.n}: no trip was saved after the checkpoint.`);
        break;
      }
      const trip = loadTrip()!;
      await wait(200);
      let next = false;
      for (let attempt = 0; attempt < 3 && !next; attempt++) {
        game.scene.start('play', { leg: trip.leg, trip });
        next = await waitUntil(() => scene()?.sys?.isActive() && scene().leg.n === trip.leg, 2000, 100);
      }
      if (!next) {
        warn(`Leg ${trip.leg}: the scene did not come up after the checkpoint.`);
        break;
      }
    }
  } catch (e) {
    warn(`Crashed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  }

  console.log('%c[QA] Report', 'color:#5daa7a;font-weight:bold', report);
  if (report.issues.length) console.table(report.issues.map((text, i) => ({ '#': i + 1, issue: text })));
  else log('No issues found.');
  return report;
}
