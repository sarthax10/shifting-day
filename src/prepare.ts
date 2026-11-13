import Phaser from 'phaser';
import * as art from './art';
import type { Pt } from './ink';
import { BIOMES, blendAt, recolor } from './biomes';
import { stopBuildingArts } from './stops';
import { treeArts } from './trees';
import { tunnelMouthArt } from './tunnel';
import { mix } from './ink';
import { grassStripArt } from './backdrop';
import { LEGS } from './legs';
import { H, WORLD_START, groundAt } from './terrain';

/** Road pictures are cut into pieces this wide, starting this far down the screen. */
export const CHUNK = 1500;
export const CHUNK_TOP = 500;

/** The key of one piece of a leg's road picture. The first leg keeps its original names. */
export const groundKey = (leg: number, i: number) => (leg === 1 ? `ground_${i}` : `ground_${leg}_${i}`);
/** The foreground grass strip for a biome. */
export const grassKey = (leg: number) => (LEGS[leg - 1].biome === 'meadow' ? 'bd_grass' : `bd_grass_${LEGS[leg - 1].biome}`);

/** Every picture a leg needs: its road, in its biome's colours, its scenery and its foreground. */
function legArts(n: number): art.Art[] {
  const leg = LEGS[n - 1];
  const biome = BIOMES[leg.biome];
  const out: art.Art[] = [];
  const end = leg.finish + 1200;
  for (let x0 = WORLD_START, i = 0; x0 < end; x0 += CHUNK, i++) {
    const pts: Pt[] = [];
    for (let x = 0; x <= CHUNK; x += 30) pts.push([x, groundAt(leg.features, x0 + x) - CHUNK_TOP]);
    // Before the tunnel's middle the road is still the last place's; after it, this one's.
    const prev = n > 1 ? BIOMES[LEGS[n - 2].biome].ground : biome.ground;
    const w = n > 1 ? blendAt(x0 + CHUNK / 2) : 1;
    const style = (w < 0.5 ? LEGS[n - 2].biome : leg.biome) as art.RoadStyle;
    const a = art.groundArt(groundKey(n, i), pts, H - CHUNK_TOP + 40, x0, leg.features, style);
    const map: Record<string, string> = {};
    for (const key of new Set([...Object.keys(prev), ...Object.keys(biome.ground)].map((k) => k.trim()))) {
      map[key] = mix(prev[key] ?? key, biome.ground[key] ?? key, w);
    }
    out.push(Object.keys(map).length ? recolor(a, a.key, map) : a);
  }
  if (leg.biome !== 'meadow') out.push(recolor(grassStripArt(), grassKey(n), biome.grass));
  out.push(...biome.arts());
  // The last biome's pictures too, for the stretch where this leg blends out of it.
  if (n > 1) {
    const before = LEGS[n - 2].biome;
    out.push(...BIOMES[before].arts());
    // The tunnel between them, a mouth dressed for each.
    out.push(tunnelMouthArt(before), tunnelMouthArt(leg.biome));
    if (before !== 'meadow') out.push(recolor(grassStripArt(), grassKey(n - 1), BIOMES[before].grass));
  }
  return out;
}

const loading = new Map<number, Promise<void>>();

/** Draws everything a leg needs, once. Later calls return the same promise, so it is safe to call early. */
export function prepareLeg(textures: Phaser.Textures.TextureManager, n: number): Promise<void> {
  if (n < 1 || n > LEGS.length) return Promise.resolve();
  let p = loading.get(n);
  if (!p) {
    p = Promise.all([...legArts(n), ...stopBuildingArts(), ...treeArts()].map((a) => art.loadArt(textures, a))).then(() => undefined);
    loading.set(n, p);
  }
  return p;
}
