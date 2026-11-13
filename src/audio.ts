import { ZZFX } from 'zzfx';

/**
 * All of the game's sound, on one audio context, through one mixer:
 *
 *   music ─┐
 *   sfx ───┤
 *   amb ───┼─► master ─► gentle compressor ─► speakers
 *   engine ┘
 *
 * The music is synthesised and sequenced here (no recordings, so no licences to worry about): plucked
 * strings made with the Karplus–Strong method, a round bass, soft pads, brushed drums, and a whistled
 * melody, the way the driver whistles on screen. Effects are ZzFX sounds played through the sfx bus.
 */

export const ctx: AudioContext = ZZFX.audioContext;
const SR = ctx.sampleRate;

// ---------------------------------------------------------------- The mixer

const master = ctx.createGain();
const comp = ctx.createDynamicsCompressor();
comp.threshold.value = -16;
comp.knee.value = 12;
comp.ratio.value = 3;
comp.attack.value = 0.01;
comp.release.value = 0.2;
master.connect(comp).connect(ctx.destination);
/** A meter on the final mix, for checking levels while testing. */
const meter = ctx.createAnalyser();
meter.fftSize = 2048;
comp.connect(meter);
/** The current mix level: RMS and peak, 0 to 1. */
export function mixLevel() {
  const d = new Float32Array(meter.fftSize);
  meter.getFloatTimeDomainData(d);
  let sum = 0;
  let peak = 0;
  for (const v of d) {
    sum += v * v;
    peak = Math.max(peak, Math.abs(v));
  }
  return { rms: Math.sqrt(sum / d.length), peak };
}
const bus = (level: number) => {
  const g = ctx.createGain();
  g.gain.value = level;
  g.connect(master);
  return g;
};
const musicBus = bus(0.5);
const sfxBus = bus(0.9);
const ambBus = bus(0.5);
const engineBus = bus(0.55);

/** A little room reverb for the music, made from a burst of decaying noise. */
const reverb = ctx.createConvolver();
{
  const len = Math.floor(SR * 1.6);
  const ir = ctx.createBuffer(2, len, SR);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  reverb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  reverb.connect(wet).connect(musicBus);
}

// ---------------------------------------------------------------- Settings: volume and mute, remembered

interface Settings {
  muted: boolean;
  music: number;
}
const KEY = 'shifting-day-audio';
const settings: Settings = (() => {
  try {
    return { muted: false, music: 1, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { muted: false, music: 1 };
  }
})();
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private windows may refuse; the setting just lasts for this visit.
  }
};
const applyVolume = () => master.gain.setTargetAtTime(settings.muted ? 0 : 0.9, ctx.currentTime, 0.05);
applyVolume();

export const audio = {
  get muted() {
    return settings.muted;
  },
  toggleMute() {
    settings.muted = !settings.muted;
    save();
    applyVolume();
    return settings.muted;
  },
  /** Browsers only allow sound after the player has clicked or pressed a key. */
  unlock() {
    if (ctx.state !== 'running') void ctx.resume();
  },
};

// ---------------------------------------------------------------- Sound effects

/** ZzFX recipes: [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo, filter]. */
export const SOUND = {
  pick: [0.5, 0.05, 420, 0.01, 0.02, 0.06, 0, 1.5, 0, 0, 120, 0.03],
  drop: [0.45, 0.05, 220, 0.005, 0.02, 0.08, 0, 1.5, 0, 0, -60, 0.03, 0, 0.3],
  lost: [0.6, 0.02, 300, 0.02, 0.12, 0.25, 0, 1.2, -4, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0.05],
  crack: [0.75, 0.3, 900, 0, 0.01, 0.16, 4, 2.2, 0, 0, 0, 0, 0, 1.4, 0, 0.2, 0.02],
  tie: [0.5, 0.05, 180, 0.01, 0.03, 0.08, 1, 1.4, 12],
  untie: [0.4, 0.05, 240, 0.01, 0.03, 0.06, 1, 1.4, -10],
  honk: [0.55, 0, 310, 0.02, 0.18, 0.08, 2, 0.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0.02],
  beep: [0.3, 0, 1180, 0.01, 0.12, 0.05, 1, 1.4],
  clunk: [0.6, 0.05, 110, 0, 0.02, 0.07, 4, 1, 0, 0, 0, 0, 0, 0.5],
  grind: [0.6, 0.4, 600, 0.01, 0.16, 0.22, 3, 2, 0, 0, 0, 0, 0, 1.8, 0, 0.4],
  bang: [0.8, 0.2, 80, 0, 0.03, 0.12, 4, 2.5, 0, 0, 0, 0, 0, 1, 0, 0.3],
  ratchet: [0.45, 0.05, 900, 0, 0.05, 0.08, 4, 3, 0, 0, 0, 0, 0.012, 0.6],
  stall: [0.6, 0.1, 70, 0.01, 0.1, 0.35, 3, 1, -2, 0, 0, 0, 0, 0.8],
  crank: [0.5, 0.2, 60, 0.02, 0.4, 0.1, 3, 1, 0, 0, 0, 0, 0.06, 1.2],
  squeal: [0.22, 0.1, 1400, 0.02, 0.15, 0.1, 2, 0.5, 0, 0, 0, 0, 0, 0.4],
  win: [0.6, 0, 523, 0.02, 0.15, 0.3, 0, 1.3, 0, 0, 200, 0.08, 0.1],
  click: [0.35, 0, 700, 0, 0.01, 0.03, 1, 2, 0, 0, 300, 0.01],
  meow: [0.6, 0.08, 620, 0.05, 0.12, 0.25, 0, 1.6, -3, 2, 0, 0, 0, 0, 3, 0, 0, 0.8, 0.05],
  hiss: [0.4, 0.1, 2000, 0.02, 0.2, 0.15, 4, 1, 0, 0, 0, 0, 0, 3],
  chirp: [0.5, 0.15, 2600, 0.01, 0.03, 0.06, 0, 1.4, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0.6],
  pop: [0.35, 0.2, 500, 0, 0.01, 0.05, 0, 1.5, 0, 0, 400, 0.01],
  stamp: [0.9, 0.05, 60, 0, 0.02, 0.18, 4, 1, 0, 0, 0, 0, 0, 1.2, 0, 0, 0, 0.5],
} as const;
export type SoundName = keyof typeof SOUND;

/** Plays a recipe through the effects bus, optionally quieter, higher or lower, or panned. */
export function playRecipe(params: readonly (number | undefined)[], volume = 1, rate = 1, pan = 0) {
  try {
    const samples = ZZFX.buildSamples(...params);
    const buf = ctx.createBuffer(1, samples.length, ZZFX.sampleRate);
    buf.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = volume;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(g).connect(p).connect(sfxBus);
    src.start();
  } catch {
    // Sound is a nicety. The game carries on without it.
  }
}

export function play(name: SoundName, volume = 1, rate = 1, pan = 0) {
  playRecipe(SOUND[name], volume, rate, pan);
}

/** A knock, as loud as it was hard. */
export function thud(force: number) {
  playRecipe([Math.min(0.75, 0.12 + force * 0.05), 0.2, 90 + Math.random() * 40, 0, 0.02, 0.08, 4, 1.2, 0, 0, 0, 0, 0, 0.6]);
}

// ---------------------------------------------------------------- Instruments

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const noiseBuffer = (() => {
  const b = ctx.createBuffer(1, SR * 2, SR);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
})();

/** A plucked string by Karplus–Strong: a burst of noise fed round a short, slowly darkening delay line. */
const plucks = new Map<string, AudioBuffer>();
function pluckBuffer(midi: number, bright: number) {
  const key = `${midi}:${bright}`;
  let b = plucks.get(key);
  if (b) return b;
  const f = midiHz(midi);
  const len = Math.floor(SR * 1.8);
  b = ctx.createBuffer(1, len, SR);
  const d = b.getChannelData(0);
  const period = Math.max(2, Math.round(SR / f));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = (Math.random() * 2 - 1) * (0.6 + bright * 0.4);
  // Soften the initial burst for a warmer, nylon-ish attack.
  for (let i = 1; i < period; i++) ring[i] = ring[i] * bright + ring[i - 1] * (1 - bright);
  const decay = 0.996 - (midi > 72 ? 0.003 : 0);
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const next = (idx + 1) % period;
    const v = ring[idx];
    ring[idx] = (v + ring[next]) * 0.5 * decay;
    d[i] = v;
    idx = next;
  }
  plucks.set(key, b);
  return b;
}

function pluck(dest: AudioNode, midi: number, t: number, vel = 0.5, bright = 0.6, pan = 0) {
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(midi, bright);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.setTargetAtTime(0, t + 0.9, 0.25);
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  src.connect(g).connect(p);
  p.connect(dest);
  p.connect(reverb);
  src.start(t);
  src.stop(t + 2);
}

function bass(dest: AudioNode, midi: number, t: number, dur: number, vel = 0.5) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = midiHz(midi);
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = midiHz(midi);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 520;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.012);
  g.gain.setTargetAtTime(vel * 0.6, t + 0.02, 0.08);
  g.gain.setTargetAtTime(0, t + dur * 0.9, 0.04);
  o.connect(lp);
  sub.connect(lp);
  lp.connect(g).connect(dest);
  o.start(t);
  sub.start(t);
  o.stop(t + dur + 0.3);
  sub.stop(t + dur + 0.3);
}

function pad(dest: AudioNode, notes: number[], t: number, dur: number, vel = 0.08) {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + dur * 0.35);
  g.gain.setTargetAtTime(0, t + dur * 0.8, dur * 0.2);
  lp.connect(g);
  g.connect(dest);
  g.connect(reverb);
  for (const n of notes) {
    for (const det of [-7, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midiHz(n);
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur * 1.3);
    }
  }
}

/** A whistle: a pure tone with a little vibrato and a breathy edge, sliding up into each note. */
function whistle(dest: AudioNode, midi: number, t: number, dur: number, vel = 0.12) {
  const f = midiHz(midi);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f * 0.97, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.6;
  const vibAmt = ctx.createGain();
  vibAmt.gain.setValueAtTime(0, t);
  vibAmt.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.3, dur));
  vib.connect(vibAmt).connect(o.frequency);
  const breath = ctx.createBufferSource();
  breath.buffer = noiseBuffer;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = f;
  bp.Q.value = 18;
  const bg = ctx.createGain();
  bg.gain.value = 0.35;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.04);
  g.gain.setValueAtTime(vel, t + Math.max(0.05, dur - 0.06));
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g);
  breath.connect(bp).connect(bg).connect(g);
  g.connect(dest);
  g.connect(reverb);
  o.start(t);
  vib.start(t);
  breath.start(t, Math.random());
  o.stop(t + dur + 0.05);
  vib.stop(t + dur + 0.05);
  breath.stop(t + dur + 0.05);
}

function kick(dest: AudioNode, t: number, vel = 0.7) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.35);
}

function noiseHit(dest: AudioNode, t: number, type: BiquadFilterType, freq: number, q: number, decay: number, vel: number, toVerb = false) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  src.connect(f).connect(g).connect(dest);
  if (toVerb) g.connect(reverb);
  src.start(t, Math.random() * 1.5);
  src.stop(t + decay + 0.02);
}
const snare = (d: AudioNode, t: number, vel = 0.35) => noiseHit(d, t, 'bandpass', 2200, 0.7, 0.16, vel, true);
const hat = (d: AudioNode, t: number, vel = 0.12) => noiseHit(d, t, 'highpass', 7500, 0.5, 0.045, vel);
const shaker = (d: AudioNode, t: number, vel = 0.08) => noiseHit(d, t, 'bandpass', 5500, 1.2, 0.07, vel);
const clap = (d: AudioNode, t: number, vel = 0.25) => {
  for (const off of [0, 0.011, 0.023]) noiseHit(d, t + off, 'bandpass', 1500, 1.4, 0.09, vel, true);
};

// ---------------------------------------------------------------- Songs

const NOTES: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
/** A chord name ("Bm", "F#m", "G7") as MIDI notes, root in the octave from C3. */
function chord(name: string) {
  const m = /^([A-G][#b]?)(m?)(7?)$/.exec(name)!;
  const root = 48 + NOTES[m[1]];
  const notes = [root, root + (m[2] ? 3 : 4), root + 7];
  if (m[3]) notes.push(root + 10);
  return notes;
}

/** One note of a melody: [bar, sixteenth step, MIDI note, length in sixteenths]. */
type Note = [number, number, number, number];

interface Song {
  bpm: number;
  /** How far the off-beat eighths lag, as a fraction of a sixteenth (0 is straight). */
  swing: number;
  chords: string[];
  melody: Note[];
  /** Plays one sixteenth: the accompaniment for this step of this bar. */
  step(o: Out, bar: number, s: number, t: number, sixteenth: number, chordNotes: number[]): void;
  loop: boolean;
}

interface Out {
  dest: AudioNode;
  /** 0 to 1: how much is going on (the drive's speed); songs bring parts in and out with it. */
  intensity: number;
}

const SONGS: Record<string, Song> = {
  /** The title: a gentle finger-picked tune in G, with a soft pad and the whistle. */
  title: {
    bpm: 84,
    swing: 0.12,
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'D'],
    melody: [
      [0, 0, 71, 4], [0, 4, 74, 4], [0, 8, 79, 6], [0, 14, 78, 2],
      [1, 0, 76, 8], [1, 8, 74, 8],
      [2, 0, 72, 4], [2, 4, 76, 4], [2, 8, 74, 6], [2, 14, 72, 2],
      [3, 0, 71, 12],
      [4, 0, 71, 4], [4, 4, 74, 4], [4, 8, 79, 6], [4, 14, 81, 2],
      [5, 0, 79, 4], [5, 4, 76, 4], [5, 8, 74, 8],
      [6, 0, 72, 4], [6, 4, 76, 4], [6, 8, 72, 4], [6, 12, 69, 4],
      [7, 0, 74, 6], [7, 6, 72, 2], [7, 8, 69, 8],
    ],
    loop: true,
    step(o, bar, s, t, six, ch) {
      // Arpeggio up and back down the chord, in eighths.
      if (s % 2 === 0) {
        const pattern = [0, 1, 2, 3, 2, 1, 2, 1];
        const k = pattern[s / 2];
        const n = k === 3 ? ch[0] + 12 : ch[k] + 12;
        pluck(o.dest, n, t, 0.32 + (s === 0 ? 0.1 : 0), 0.55, ((s / 2) % 2 ? 0.25 : -0.25));
      }
      if (s === 0) {
        bass(o.dest, ch[0] - 12, t, six * 7, 0.42);
        pad(o.dest, ch.map((n) => n + 12), t, six * 16, 0.035);
      }
      if (s === 8) bass(o.dest, ch[2] - 12, t, six * 7, 0.3);
      void bar;
    },
  },

  /** Packing: a bouncy oom-pah in F on ukulele, plucked bass and a shaker, with a cheeky melody. */
  pack: {
    bpm: 116,
    swing: 0.18,
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C'],
    melody: [
      [0, 0, 72, 2], [0, 2, 74, 2], [0, 4, 72, 2], [0, 8, 69, 2], [0, 10, 65, 2], [0, 12, 67, 4],
      [1, 0, 67, 2], [1, 4, 64, 2], [1, 8, 67, 2], [1, 12, 72, 4],
      [2, 0, 74, 2], [2, 2, 72, 2], [2, 4, 69, 2], [2, 8, 65, 2], [2, 12, 69, 4],
      [3, 0, 70, 4], [3, 4, 74, 4], [3, 8, 77, 6],
      [4, 0, 77, 2], [4, 2, 76, 2], [4, 4, 74, 2], [4, 6, 72, 2], [4, 8, 69, 4], [4, 12, 72, 4],
      [5, 0, 76, 4], [5, 4, 74, 2], [5, 6, 72, 2], [5, 8, 67, 8],
      [6, 0, 70, 2], [6, 2, 72, 2], [6, 4, 74, 4], [6, 8, 70, 4], [6, 12, 74, 4],
      [7, 0, 72, 4], [7, 4, 76, 4], [7, 8, 79, 4], [7, 12, 76, 4],
    ],
    loop: true,
    step(o, bar, s, t, six, ch) {
      // Oom: bass on the beat. Pah: a bright ukulele strum on the off-beat.
      if (s === 0) bass(o.dest, ch[0] - 12, t, six * 3, 0.5);
      if (s === 8) bass(o.dest, ch[2] - 12, t, six * 3, 0.42);
      if (s === 4 || s === 12) ch.forEach((n, i) => pluck(o.dest, n + 12, t + i * 0.012, 0.22, 0.85, 0.2));
      if (s % 2 === 0) shaker(o.dest, t, s % 4 === 0 ? 0.06 : 0.1);
      if (s === 12 && bar % 2 === 1) clap(o.dest, t, 0.18);
    },
  },

  /** The drive: a road-trip groove in D. Strummed guitar, bass and brushed drums; drums follow your speed. */
  drive: {
    bpm: 100,
    swing: 0.06,
    chords: ['D', 'A', 'Bm', 'G', 'G', 'D', 'A', 'A'],
    melody: [
      [0, 0, 66, 4], [0, 4, 69, 4], [0, 8, 74, 6], [0, 14, 73, 2],
      [1, 0, 71, 4], [1, 4, 69, 8], [1, 12, 64, 4],
      [2, 0, 66, 4], [2, 4, 71, 4], [2, 8, 74, 4], [2, 12, 76, 4],
      [3, 0, 74, 12], [3, 12, 71, 4],
      [4, 0, 71, 4], [4, 4, 74, 4], [4, 8, 78, 8],
      [5, 0, 76, 4], [5, 4, 74, 4], [5, 8, 69, 8],
      [6, 0, 73, 4], [6, 4, 76, 4], [6, 8, 73, 4], [6, 12, 69, 4],
      [7, 0, 69, 14],
    ],
    loop: true,
    step(o, bar, s, t, six, ch) {
      const k = o.intensity;
      // Strum pattern: down, down-up, up-down-up.
      const strums: Record<number, number> = { 0: 1, 4: 1, 6: -1, 10: -1, 12: 1, 14: -1 };
      if (strums[s] !== undefined) {
        const notes = strums[s] > 0 ? [...ch, ch[0] + 12] : [ch[0] + 12, ...ch].reverse();
        notes.forEach((n, i) => pluck(o.dest, n + 12, t + i * 0.014, strums[s] > 0 ? 0.2 : 0.13, 0.7, -0.3));
      }
      if (s === 0 || s === 8) bass(o.dest, ch[0] - 12, t, six * 5, 0.5);
      if (s === 6 || s === 14) bass(o.dest, (s === 6 ? ch[2] : ch[1]) - 12, t, six * 2, 0.35);
      // Drums come in as the truck picks up speed.
      if (k > 0.12) {
        if (s === 0 || s === 8 || (s === 10 && bar % 2 === 1)) kick(o.dest, t, 0.55 * Math.min(1, k * 1.6));
        if (s === 4 || s === 12) snare(o.dest, t, 0.28 * Math.min(1, k * 1.5));
      }
      if (k > 0.45 && s % 2 === 0) hat(o.dest, t, s % 4 === 2 ? 0.11 : 0.06);
      if (k <= 0.12 && s % 4 === 2) shaker(o.dest, t, 0.05);
    },
  },

  /** Arrival: a short, happy fanfare in C, then a gentle sign-off. */
  results: {
    bpm: 96,
    swing: 0.1,
    chords: ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'C'],
    melody: [
      [0, 0, 72, 2], [0, 2, 76, 2], [0, 4, 79, 4], [0, 8, 84, 8],
      [1, 0, 81, 4], [1, 4, 79, 4], [1, 8, 77, 8],
      [2, 0, 79, 4], [2, 4, 77, 2], [2, 6, 76, 2], [2, 8, 74, 8],
      [3, 0, 72, 12],
      [4, 0, 76, 4], [4, 4, 72, 4], [4, 8, 69, 8],
      [5, 0, 77, 4], [5, 4, 76, 4], [5, 8, 72, 8],
      [6, 0, 74, 4], [6, 4, 76, 4], [6, 8, 79, 8],
      [7, 0, 72, 16],
    ],
    loop: true,
    step(o, bar, s, t, six, ch) {
      if (s === 0 || s === 8) ch.forEach((n, i) => pluck(o.dest, n + 12, t + i * 0.018, 0.24, 0.7));
      if (s === 4 || s === 12) pluck(o.dest, ch[2] + 12, t, 0.16, 0.7, 0.3);
      if (s === 0) {
        bass(o.dest, ch[0] - 12, t, six * 7, 0.45);
        pad(o.dest, ch.map((n) => n + 12), t, six * 16, 0.03);
      }
      if (bar < 4 && (s === 4 || s === 12)) snare(o.dest, t, 0.15);
      if (bar < 4 && s === 0) kick(o.dest, t, 0.4);
    },
  },
};

export type SongName = keyof typeof SONGS;

/**
 * The sequencer: looks a little way ahead and schedules every note on the audio clock, so timing
 * stays tight even if the game stutters. Changing song crossfades between them.
 */
class Music {
  private song?: Song;
  private name?: SongName;
  private out?: GainNode;
  private nextTime = 0;
  private bar = 0;
  private s = 0;
  private timer?: number;
  private intensity = 0;
  private melodyOn = true;

  play(name: SongName, fade = 1.2) {
    if (this.name === name) return;
    const old = this.out;
    if (old) {
      old.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
      setTimeout(() => old.disconnect(), fade * 2000);
    }
    this.name = name;
    this.song = SONGS[name];
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0, ctx.currentTime);
    this.out.gain.linearRampToValueAtTime(settings.music, ctx.currentTime + fade);
    this.out.connect(musicBus);
    this.bar = 0;
    this.s = 0;
    this.nextTime = ctx.currentTime + 0.08;
    if (this.timer === undefined) this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(fade = 1) {
    if (this.out) this.out.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
    this.name = undefined;
    this.song = undefined;
  }

  /** 0 to 1. The drive song brings its drums in with this. */
  setIntensity(k: number) {
    this.intensity += (Math.max(0, Math.min(1, k)) - this.intensity) * 0.05;
  }

  /** The whistled melody can be left out, for when the driver has something else on their mind. */
  setMelody(on: boolean) {
    this.melodyOn = on;
  }

  private schedule() {
    if (!this.song || !this.out || ctx.state !== 'running') {
      this.nextTime = ctx.currentTime + 0.05;
      return;
    }
    const song = this.song;
    const six = 60 / song.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const t = this.nextTime + (this.s % 4 === 2 ? song.swing * six : 0);
      const ch = chord(song.chords[this.bar % song.chords.length]);
      const o = { dest: this.out, intensity: this.intensity };
      song.step(o, this.bar, this.s, t, six, ch);
      if (this.melodyOn) {
        for (const [b, st, n, len] of song.melody) if (b === this.bar % song.chords.length && st === this.s) whistle(this.out, n, t, len * six * 0.95, 0.1);
      }
      this.nextTime += six;
      this.s++;
      if (this.s === 16) {
        this.s = 0;
        this.bar++;
      }
    }
  }
}
export const music = new Music();

/** A short musical sting through the music bus: a rising plucked arpeggio, for checkpoints and good news. */
export function chime(root = 72) {
  const t = ctx.currentTime + 0.02;
  [0, 4, 7, 12, 16].forEach((d, i) => pluck(musicBus, root + d, t + i * 0.07, 0.35, 0.8, i % 2 ? 0.3 : -0.3));
}

// ---------------------------------------------------------------- The engine

/**
 * The truck's engine, from four layers: a sawtooth at the firing rate (two firings per turn of a
 * four-cylinder crank), a square an octave up, a sub-octave sine for weight, and filtered noise for
 * intake roar. A soft-clipper gives it grit, a low-pass opens with revs and throttle, and the whole
 * thing pulses at the firing rate so it chugs at idle. Labouring adds a slow, uneven shudder.
 */
export class Engine {
  private nodes?: {
    saw: OscillatorNode;
    sq: OscillatorNode;
    sub: OscillatorNode;
    noise: AudioBufferSourceNode;
    noiseFilter: BiquadFilterNode;
    noiseGain: GainNode;
    lp: BiquadFilterNode;
    out: GainNode;
    chug: OscillatorNode;
    chugAmt: GainNode;
  };

  start() {
    if (this.nodes) return;
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    const sq = ctx.createOscillator();
    sq.type = 'square';
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    const mix = ctx.createGain();
    const sawG = ctx.createGain();
    sawG.gain.value = 0.5;
    const sqG = ctx.createGain();
    sqG.gain.value = 0.16;
    const subG = ctx.createGain();
    subG.gain.value = 0.7;
    saw.connect(sawG).connect(mix);
    sq.connect(sqG).connect(mix);
    sub.connect(subG).connect(mix);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.Q.value = 0.9;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    noise.connect(noiseFilter).connect(noiseGain).connect(mix);
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    shaper.curve = curve;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 3;
    const pulse = ctx.createGain();
    pulse.gain.value = 0.75;
    const chug = ctx.createOscillator();
    chug.type = 'sine';
    const chugAmt = ctx.createGain();
    chugAmt.gain.value = 0.25;
    chug.connect(chugAmt).connect(pulse.gain);
    const out = ctx.createGain();
    out.gain.value = 0;
    mix.connect(shaper).connect(lp).connect(pulse).connect(out).connect(engineBus);
    const now = ctx.currentTime;
    for (const o of [saw, sq, sub, chug]) o.start(now);
    noise.start(now);
    out.gain.setTargetAtTime(0.5, now, 0.3);
    this.nodes = { saw, sq, sub, noise, noiseFilter, noiseGain, lp, out, chug, chugAmt };
  }

  /** Sets the engine from its rpm, throttle (0 to 1), whether the limiter is cutting in, and how hard it is labouring. */
  rev(rpm: number, throttle: number, cut = false, lugging = 0) {
    const n = this.nodes;
    if (!n) return;
    const now = ctx.currentTime;
    const dead = rpm < 120;
    const fire = Math.max(6, rpm / 30);
    const wobble = lugging > 0.2 ? 1 + Math.sin(now * 23) * 0.06 * lugging : 1;
    n.saw.frequency.setTargetAtTime(fire * wobble, now, 0.04);
    n.sq.frequency.setTargetAtTime(fire * 2.01, now, 0.04);
    n.sub.frequency.setTargetAtTime(fire / 2, now, 0.04);
    n.chug.frequency.setTargetAtTime(fire / 2, now, 0.04);
    n.chugAmt.gain.setTargetAtTime(0.18 + Math.max(0, 1 - rpm / 2500) * 0.25 + lugging * 0.3, now, 0.1);
    n.lp.frequency.setTargetAtTime(180 + rpm * 0.16 + Math.max(0, throttle) * 900, now, 0.05);
    n.noiseFilter.frequency.setTargetAtTime(200 + rpm * 0.3, now, 0.05);
    n.noiseGain.gain.setTargetAtTime(Math.max(0, throttle) * 0.25 + rpm / 40000, now, 0.08);
    const level = dead ? 0 : cut ? 0.18 : 0.38 + Math.max(0, throttle) * 0.32;
    n.out.gain.setTargetAtTime(level, now, cut ? 0.01 : 0.06);
  }

  stop() {
    const n = this.nodes;
    if (!n) return;
    this.nodes = undefined;
    const now = ctx.currentTime;
    n.out.gain.setTargetAtTime(0, now, 0.25);
    setTimeout(() => {
      for (const o of [n.saw, n.sq, n.sub, n.chug]) o.stop();
      n.noise.stop();
      n.out.disconnect();
    }, 1500);
  }
}

// ---------------------------------------------------------------- Ambience

/**
 * The world around: birdsong while standing still at the houses, and on the road, wind and the roar of
 * tyres on gravel that both grow with speed.
 */
class Ambience {
  private wind?: GainNode;
  private windFilter?: BiquadFilterNode;
  private road?: GainNode;
  private birdsOn = false;
  private birdTimer?: number;

  private ensure() {
    if (this.wind) return;
    const make = (type: BiquadFilterType, freq: number, q: number) => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(ambBus);
      src.start();
      return { f, g };
    };
    const w = make('bandpass', 500, 0.6);
    this.wind = w.g;
    this.windFilter = w.f;
    this.road = make('lowpass', 260, 0.7).g;
  }

  /** Speed in pixels a frame (about 0 to 11). */
  setSpeed(speed: number) {
    this.ensure();
    const k = Math.min(1, Math.abs(speed) / 10);
    const now = ctx.currentTime;
    this.wind!.gain.setTargetAtTime(k * k * 0.35, now, 0.3);
    this.windFilter!.frequency.setTargetAtTime(380 + k * 900, now, 0.3);
    this.road!.gain.setTargetAtTime(k * 0.45, now, 0.15);
  }

  birds(on: boolean) {
    this.birdsOn = on;
    if (on && this.birdTimer === undefined) this.tweet();
  }

  private tweet() {
    if (!this.birdsOn) {
      this.birdTimer = undefined;
      return;
    }
    // A little phrase of two to five chirps, somewhere off to one side.
    const pan = Math.random() * 1.6 - 0.8;
    const n = 2 + Math.floor(Math.random() * 4);
    const rate = 0.8 + Math.random() * 0.5;
    for (let i = 0; i < n; i++) setTimeout(() => playRecipe(SOUND.chirp, 0.25, rate * (1 + (i % 2) * 0.12), pan), i * 110);
    this.birdTimer = window.setTimeout(() => this.tweet(), 1800 + Math.random() * 4200);
  }

  quiet() {
    this.birds(false);
    this.setSpeed(0);
  }
}
export const ambience = new Ambience();
