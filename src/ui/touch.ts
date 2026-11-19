/**
 * The touchscreen's controls, laid out the way mobile driving games do it: two big pedals under the thumbs
 * (brake on the left, gas on the right), the gear rocker beside the brake and the handbrake lever and reel
 * button beside the gas, and pause and sound in the top corner. Everything else (aiming the crossbow,
 * dragging furniture) is a touch on the picture itself.
 *
 * They are HTML over the canvas rather than drawn in it: that keeps them crisp at any size, sized in real
 * screen units (a thumb is the same size on a phone and an iPad, whatever the game is scaled to), clear of
 * the notch and the home bar, and able to take several fingers at once. On a phone they sit in the empty
 * bands either side of the game; on an iPad, over its bottom corners. Printed in the poster's inks.
 */

/** A touchscreen is the main input: phones and tablets, including iPads, which report themselves as Macs. */
export const isTouchDevice = () =>
  typeof window !== 'undefined' && (window.matchMedia('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 1) && !window.matchMedia('(pointer: fine)').matches;

/** What the game asks of the controls each frame. */
export interface TouchView {
  /** Show the driving controls (pedals, gears, handbrake, reel). */
  driving: boolean;
  /** Show the packing controls (turn what you hold). */
  packing: boolean;
  /** Something is being held, so the turn buttons do something. */
  holding: boolean;
  /** Show the pause and sound buttons. */
  menu: boolean;
  gear: string;
  handbrake: boolean;
  muted: boolean;
}

export interface TouchActions {
  turn(dir: -1 | 1): void;
  gearUp(): void;
  gearDown(): void;
  handbrake(): void;
  pause(): void;
  sound(): void;
}

const CSS = `
#touchpad { position: fixed; inset: 0; pointer-events: none; z-index: 5; font-family: Anton, Impact, sans-serif; color: #F3E3CC;
  --u: clamp(52px, 7.4vmin + 18px, 84px); --gap: clamp(8px, 1.6vmin, 16px);
  --edge-l: max(14px, env(safe-area-inset-left)); --edge-r: max(14px, env(safe-area-inset-right)); --edge-b: max(12px, env(safe-area-inset-bottom)); --edge-t: max(10px, env(safe-area-inset-top)); }
#touchpad .pod { position: absolute; bottom: var(--edge-b); display: flex; align-items: flex-end; gap: var(--gap); transition: opacity .18s, transform .18s; }
#touchpad .pod.left { left: var(--edge-l); }
#touchpad .pod.right { right: var(--edge-r); flex-direction: row-reverse; }
#touchpad .top { position: absolute; top: var(--edge-t); left: var(--edge-l); display: flex; gap: var(--gap); transition: opacity .18s; }
#touchpad .hide { opacity: 0; pointer-events: none !important; transform: translateY(14px); }
#touchpad .hide * { pointer-events: none !important; }
#touchpad button { pointer-events: auto; touch-action: none; -webkit-tap-highlight-color: transparent; appearance: none; -webkit-appearance: none; background: transparent; border: 0; padding: 0; margin: 0; font: inherit; color: inherit; cursor: pointer; user-select: none; -webkit-user-select: none; }
/* The pedals: tall ink plates with ribbed treads, a bone edge, and a hard red print offset. */
#touchpad .pedal { position: relative; width: calc(var(--u) * 1.32); height: calc(var(--u) * 1.9); border-radius: calc(var(--u) * .24);
  background: repeating-linear-gradient(180deg, rgba(243,227,204,.16) 0 4px, transparent 4px 13px) center 22% / 64% 54% no-repeat, rgba(10,7,18,.82);
  box-shadow: inset 0 0 0 3px #F3E3CC, 5px 6px 0 #E3263A; transition: transform .06s, background-color .06s, box-shadow .06s; }
#touchpad .pedal span { position: absolute; left: 0; right: 0; bottom: 12%; font-size: calc(var(--u) * .3); letter-spacing: .06em; text-align: center; }
#touchpad .pedal.gas { box-shadow: inset 0 0 0 3px #F3E3CC, 5px 6px 0 #FF6A30; }
#touchpad .pedal.on { transform: translate(3px, 4px) scale(.98); box-shadow: inset 0 0 0 3px #0A0712, 1px 1px 0 #E3263A; }
#touchpad .pedal.brake.on { background-color: #E3263A; }
#touchpad .pedal.gas.on { background-color: #FF6A30; color: #0A0712; }
/* The gear rocker: up and down halves around the gear on a bone key-cap. */
#touchpad .rocker { display: flex; flex-direction: column; align-items: center; width: calc(var(--u) * .98); border-radius: calc(var(--u) * .5); background: rgba(10,7,18,.82); box-shadow: inset 0 0 0 3px #F3E3CC, 4px 5px 0 #E3263A; padding: 4px 0; }
#touchpad .rocker button { width: 100%; height: calc(var(--u) * .78); display: grid; place-items: center; border-radius: calc(var(--u) * .5); }
#touchpad .rocker button i { width: 0; height: 0; border-left: calc(var(--u) * .2) solid transparent; border-right: calc(var(--u) * .2) solid transparent; }
#touchpad .rocker .up i { border-bottom: calc(var(--u) * .24) solid #F3E3CC; }
#touchpad .rocker .down i { border-top: calc(var(--u) * .24) solid #F3E3CC; }
#touchpad .rocker button.on { background: #FF6A30; }
#touchpad .rocker button.on i { border-bottom-color: #0A0712; border-top-color: #0A0712; }
#touchpad .rocker b { display: grid; place-items: center; width: calc(var(--u) * .7); height: calc(var(--u) * .62); background: #F3E3CC; color: #0A0712; font-weight: 400; font-size: calc(var(--u) * .46); line-height: 1; border-radius: 6px; box-shadow: 3px 3px 0 #8A7864; }
/* Round buttons: the handbrake lever, reel, pause and sound. */
#touchpad .col { display: flex; flex-direction: column; gap: var(--gap); align-items: center; }
#touchpad .round { width: calc(var(--u) * .92); height: calc(var(--u) * .92); border-radius: 50%; background: rgba(10,7,18,.82); box-shadow: inset 0 0 0 3px #F3E3CC, 4px 5px 0 #E3263A; display: grid; place-items: center; font-size: calc(var(--u) * .26); letter-spacing: .05em; transition: transform .06s; }
#touchpad .round.on { transform: translate(2px, 3px); box-shadow: inset 0 0 0 3px #0A0712, 1px 1px 0 #E3263A; background: #FF6A30; color: #0A0712; }
#touchpad .round.brakeon { background: #E3263A; }
#touchpad .round small { display: block; font-family: "Space Mono", monospace; font-weight: 700; font-size: calc(var(--u) * .12); letter-spacing: .14em; margin-top: 2px; opacity: .85; }
#touchpad .top .round { width: calc(var(--u) * .7); height: calc(var(--u) * .7); font-size: calc(var(--u) * .24); box-shadow: inset 0 0 0 2px #F3E3CC, 3px 4px 0 #E3263A; }
#touchpad .top .round.muted { opacity: .55; }
#touchpad .round svg { width: 52%; height: 52%; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
#touchpad .pack .round { width: var(--u); height: var(--u); }
#touchpad .pack.idle .round { opacity: .45; }
#touchpad .pack b { position: absolute; left: 0; right: 0; bottom: calc(100% + 6px); text-align: center; font-family: "Space Mono", monospace; font-weight: 700; font-size: calc(var(--u) * .14); letter-spacing: .2em; opacity: .8; text-shadow: 0 1px 2px #0A0712; }
@media (prefers-reduced-motion: reduce) { #touchpad * { transition: none !important; } }
`;

interface Pad {
  root: HTMLElement;
  pods: HTMLElement[];
  pack: HTMLElement;
  top: HTMLElement;
  gear: HTMLElement;
  hb: HTMLButtonElement;
  sound: HTMLButtonElement;
  held: { gas: boolean; brake: boolean; reel: boolean };
  actions: TouchActions | null;
  shown: string;
}

let pad: Pad | null = null;

const buzz = () => navigator.vibrate?.(8);

/** A button held down with one finger while other fingers do other things. */
function holdable(el: HTMLElement, set: (on: boolean) => void) {
  const down = (e: PointerEvent) => {
    e.preventDefault();
    el.setPointerCapture?.(e.pointerId);
    el.classList.add('on');
    set(true);
    buzz();
  };
  const up = () => {
    el.classList.remove('on');
    set(false);
  };
  el.addEventListener('pointerdown', down);
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) el.addEventListener(ev, up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** A button that acts once per tap, with a brief press. */
function tappable(el: HTMLElement, act: () => void) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.classList.add('on');
    buzz();
    act();
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) el.addEventListener(ev, () => el.classList.remove('on'));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

function build(): Pad {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'touchpad';
  root.innerHTML = `
    <div class="pod left hide">
      <button class="pedal brake" aria-label="Brake"><span>BRAKE</span></button>
      <div class="rocker"><button class="up" aria-label="Gear up"><i></i></button><b>1</b><button class="down" aria-label="Gear down"><i></i></button></div>
    </div>
    <div class="pod right hide">
      <button class="pedal gas" aria-label="Gas"><span>GAS</span></button>
      <div class="col"><button class="round reel" aria-label="Reel in">REEL</button><button class="round hb" aria-label="Handbrake">P<small>BRAKE</small></button></div>
    </div>
    <div class="pod left pack hide">
      <b>TURN</b>
      <button class="round turn-l" aria-label="Turn left"><svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M7 2.5v4.6h4.6"/></svg></button>
      <button class="round turn-r" aria-label="Turn right"><svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M17 2.5v4.6h-4.6"/></svg></button>
    </div>
    <div class="top hide">
      <button class="round pause" aria-label="Pause">II</button>
      <button class="round sound" aria-label="Sound">♪</button>
    </div>`;
  document.body.appendChild(root);
  const q = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
  const p: Pad = {
    root,
    pods: [q('.pod.left:not(.pack)'), q('.pod.right')],
    pack: q('.pod.pack'),
    top: q('.top'),
    gear: q('.rocker b'),
    hb: q('.hb'),
    sound: q('.sound'),
    held: { gas: false, brake: false, reel: false },
    actions: null,
    shown: '',
  };
  holdable(q('.gas'), (v) => (p.held.gas = v));
  holdable(q('.brake'), (v) => (p.held.brake = v));
  holdable(q('.reel'), (v) => (p.held.reel = v));
  // Turning repeats while the button is held, a step at a time, like holding Q or E.
  for (const [sel, dir] of [['.turn-l', -1], ['.turn-r', 1]] as const) {
    let timer = 0;
    holdable(q(sel), (on) => {
      clearInterval(timer);
      if (!on) return;
      p.actions?.turn(dir);
      timer = window.setInterval(() => p.actions?.turn(dir), 140);
    });
  }
  tappable(q('.rocker .up'), () => p.actions?.gearUp());
  tappable(q('.rocker .down'), () => p.actions?.gearDown());
  tappable(p.hb, () => p.actions?.handbrake());
  tappable(q('.pause'), () => p.actions?.pause());
  tappable(p.sound, () => p.actions?.sound());
  return p;
}

/** The touch controls, made once and shared by every scene; null on a device without a touchscreen. */
export function touchPad() {
  if (!isTouchDevice()) return null;
  pad ??= build();
  const p = pad;
  return {
    get gas() {
      return p.held.gas;
    },
    get brake() {
      return p.held.brake;
    },
    get reel() {
      return p.held.reel;
    },
    bind(actions: TouchActions | null) {
      p.actions = actions;
    },
    /** Brings the controls in line with the game; cheap to call every frame. */
    sync(v: TouchView) {
      const key = `${v.driving}|${v.packing}|${v.holding}|${v.menu}|${v.gear}|${v.handbrake}|${v.muted}`;
      if (key === p.shown) return;
      p.shown = key;
      for (const pod of p.pods) pod.classList.toggle('hide', !v.driving);
      p.pack.classList.toggle('hide', !v.packing);
      p.pack.classList.toggle('idle', !v.holding);
      p.top.classList.toggle('hide', !v.menu);
      p.gear.textContent = v.gear;
      p.hb.classList.toggle('brakeon', v.handbrake);
      p.sound.classList.toggle('muted', v.muted);
      // A finger still down on a pedal as the controls hide must not keep the truck going.
      if (!v.driving) p.held.gas = p.held.brake = p.held.reel = false;
    },
  };
}

export type TouchPad = NonNullable<ReturnType<typeof touchPad>>;
