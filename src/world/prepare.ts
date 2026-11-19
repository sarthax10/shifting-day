import Phaser from 'phaser';
import * as art from '../art/art';
import { mix, type Pt } from '../art/ink';
import { BIOMES, blendAt, posterize, recolor, type ArtJob } from './biomes';
import { STOP_ART_JOBS } from '../art/stops';
import { TREE_ART_JOBS } from '../art/trees';
import { tunnelMouthArt } from './tunnel';
import { grassStripArt } from '../art/backdrop';
import { LEGS, type BiomeKey } from './legs';
import { finaleArts } from './finale';
import { H, WORLD_START, groundAt } from './terrain';

/**
 * Loading a leg's pictures without stalling the game.
 *
 * Every picture is drawn by a job; a leg is a list of jobs, run a few milliseconds at a time between frames,
 * so the game keeps its frame rate while the next leg is drawn (in the background, before the checkpoint).
 * Each texture is recorded against the owner that asked for it - a leg (its road), a place (its scenery,
 * shared by the two legs that pass through it) or the shared set (stops, trees) - so nothing is drawn twice,
 * and letting a leg go removes only what no kept owner still holds.
 */

/** Road pictures are cut into pieces this wide, starting this far down the screen. */
export const CHUNK = 1500;
export const CHUNK_TOP = 500;

/** The key of one piece of a leg's road picture. The first leg keeps its original names. */
export const groundKey = (leg: number, i: number) => (leg === 1 ? `ground_${i}` : `ground_${leg}_${i}`);
/** The foreground grass strip for a biome. */
export const grassKey = (leg: number) => (LEGS[leg - 1].biome === 'meadow' ? 'bd_grass' : `bd_grass_${LEGS[leg - 1].biome}`);

interface Job {
  owner: string;
  run: ArtJob;
}

/** Texture keys by the owner that loaded them. */
const owned = new Map<string, Set<string>>();
/** Owners whose pictures are all loaded, so their jobs are skipped. */
const complete = new Set<string>();
const loading = new Map<number, Promise<void>>();
const ready = new Set<number>();

const legOwner = (n: number) => `leg:${n}`;
const placeOwner = (b: BiomeKey) => `place:${b}`;
const SHARED = 'shared';
const CORE = 'core';

/** One piece of a leg's road, in its place's colours, blending from the last place's before the tunnel. */
function groundJob(n: number, i: number, x0: number): ArtJob {
  return () => {
    const leg = LEGS[n - 1];
    const biome = BIOMES[leg.biome];
    const pts: Pt[] = [];
    for (let x = 0; x <= CHUNK; x += 30) pts.push([x, groundAt(leg.features, x0 + x) - CHUNK_TOP]);
    const prev = n > 1 ? BIOMES[LEGS[n - 2].biome].ground : biome.ground;
    const w = n > 1 ? blendAt(x0 + CHUNK / 2) : 1;
    const style = (w < 0.5 ? LEGS[n - 2].biome : leg.biome) as art.RoadStyle;
    const a = art.groundArt(groundKey(n, i), pts, H - CHUNK_TOP + 40, x0, leg.features, style);
    const map: Record<string, string> = {};
    for (const key of new Set([...Object.keys(prev), ...Object.keys(biome.ground)].map((k) => k.trim()))) map[key] = mix(prev[key] ?? key, biome.ground[key] ?? key, w);
    const coloured = Object.keys(map).length ? recolor(a, a.key, map) : a;
    return style === 'town' ? posterize(coloured) : coloured;
  };
}

/** A place's scenery, its tunnel mouth and its grass strip. */
function placeJobs(b: BiomeKey, leg: number): Job[] {
  const owner = placeOwner(b);
  if (complete.has(owner)) return [];
  const jobs: Job[] = BIOMES[b].arts().map((run) => ({ owner, run }));
  jobs.push({ owner, run: () => tunnelMouthArt(b) });
  if (b !== 'meadow') jobs.push({ owner, run: () => recolor(grassStripArt(), grassKey(leg), BIOMES[b].grass) });
  return jobs;
}

/** Everything a leg needs that is not already loaded. */
function legJobs(n: number): Job[] {
  const leg = LEGS[n - 1];
  const jobs: Job[] = [];
  const owner = legOwner(n);
  for (let x0 = WORLD_START, i = 0; x0 < leg.finish + 1200; x0 += CHUNK, i++) jobs.push({ owner, run: groundJob(n, i, x0) });
  if (!leg.stop) jobs.push({ owner, run: finaleArts });
  jobs.push(...placeJobs(leg.biome, n));
  if (n > 1) jobs.push(...placeJobs(LEGS[n - 2].biome, n - 1));
  if (!complete.has(SHARED)) jobs.push(...[...STOP_ART_JOBS, ...TREE_ART_JOBS].map((run) => ({ owner: SHARED, run })));
  return jobs;
}

/**
 * Gives the frame back: waits for the next frame to be drawn, then carries on straight after it. (Waiting for
 * idle time instead starves the loading while the screen animates, as the title and the game always do.)
 */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
/** When this says so (the truck is on the move), loading waits, so a slow picture never stalls the drive. */
let hold: () => boolean = () => false;
export function holdLoadingWhile(fn: () => boolean) {
  hold = fn;
}

/**
 * How long one slice of jobs may run before giving the frame back. Short in the game, so the drive keeps its
 * frame rate; longer on the title screen, which has little to animate; long when the player is only waiting.
 */
let sliceMs = 6;
export function setLoadBudget(ms: number) {
  sliceMs = ms;
}

/**
 * Runs the jobs in order: each draws its picture, which is then decoded into a texture. Turning a big SVG into
 * a texture happens on the main thread, so in the game they are decoded one at a time (yielding between),
 * which keeps any single stall short. Off the road, with a bigger budget, a few decode at once.
 */
async function run(textures: Phaser.Textures.TextureManager, jobs: Job[]) {
  const owners = new Set<string>();
  const inFlight = new Set<Promise<void>>();
  let slice = performance.now();
  queued += jobs.length;
  for (const job of jobs) {
    while (hold()) await nextFrame();
    const out = job.run();
    for (const a of Array.isArray(out) ? out : [out]) {
      if (!owned.has(job.owner)) owned.set(job.owner, new Set());
      owned.get(job.owner)!.add(a.key);
      const load = art.loadArt(textures, a).finally(() => inFlight.delete(load));
      inFlight.add(load);
      while (inFlight.size >= (sliceMs > 6 ? 4 : 1)) await Promise.race(inFlight);
      if (performance.now() - slice > sliceMs) {
        await nextFrame();
        slice = performance.now();
      }
    }
    owners.add(job.owner);
    finished++;
  }
  await Promise.all(inFlight);
  for (const o of owners) complete.add(o);
}

/** Jobs started and finished so far, for the title's loading readout. */
let queued = 0;
let finished = 0;
/** How far the background drawing has got, 0 to 1 (1 when nothing is waiting). */
export const loadProgress = () => (queued === 0 ? 1 : finished / queued);

/**
 * The pictures every leg uses (the truck, the cargo, the dashboard, the signs), drawn once, in the
 * background behind the title screen. Every leg waits for them before its own pictures start.
 */
let core: Promise<void> = Promise.resolve();
let corePending = 0;
/** Queues core pictures behind any already queued; the promise settles when these are drawn. */
export function prepareCore(textures: Phaser.Textures.TextureManager, jobs: ArtJob[]): Promise<void> {
  corePending++;
  core = core.then(() => run(textures, jobs.map((job) => ({ owner: CORE, run: job })))).then(() => {
    corePending--;
  });
  return core;
}

/** Whether a leg's pictures are all in memory. */
export function legReady(textures: Phaser.Textures.TextureManager, n: number): boolean {
  return corePending === 0 && ready.has(n) && textures.exists(groundKey(n, 0));
}

/** Draws everything a leg needs, once, a slice at a time. Later calls return the same promise, so it is safe to call early. */
export function prepareLeg(textures: Phaser.Textures.TextureManager, n: number): Promise<void> {
  if (n < 1 || n > LEGS.length) return Promise.resolve();
  let p = loading.get(n);
  if (!p) {
    p = core.then(() => run(textures, legJobs(n))).then(() => {
      ready.add(n);
    });
    loading.set(n, p);
  }
  return p;
}

/** Removes an owner's textures, except any that another owner still holds. */
function release(textures: Phaser.Textures.TextureManager, owner: string) {
  const keys = owned.get(owner);
  if (!keys) return;
  owned.delete(owner);
  complete.delete(owner);
  const held = new Set<string>();
  for (const set of owned.values()) for (const k of set) held.add(k);
  for (const k of keys) if (!held.has(k) && textures.exists(k)) textures.remove(k);
}

/**
 * Lets go of the legs not kept: their road, and the scenery of any place none of the kept legs passes
 * through. Holding every leg driven so far is what made phones close the tab.
 */
export function unloadLegsExcept(textures: Phaser.Textures.TextureManager, keep: number[]) {
  const places = new Set<BiomeKey>();
  for (const n of keep) {
    if (n < 1 || n > LEGS.length) continue;
    places.add(LEGS[n - 1].biome);
    if (n > 1) places.add(LEGS[n - 2].biome);
  }
  for (const n of [...loading.keys()]) {
    if (keep.includes(n)) continue;
    release(textures, legOwner(n));
    loading.delete(n);
    ready.delete(n);
  }
  for (const b of Object.keys(BIOMES) as BiomeKey[]) if (!places.has(b)) release(textures, placeOwner(b));
}
