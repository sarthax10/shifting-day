import type { LegLog } from './score';
import { LEG1_FEATURES, type Feature } from './terrain';

/**
 * The trip, in five legs. Each leg is its own stretch of road through its own biome, at its own time
 * of day and weather: the afternoon you leave, a misty autumn morning in the valley, the violet hour and snow
 * on the pass, a rainy night in town, and a bright morning on the coast as you arrive. Every leg but the last ends at a roadside stop where you park,
 * with the handbrake on, to save the trip.
 */

export type BiomeKey = 'meadow' | 'autumn' | 'snow' | 'town' | 'coast';

export interface Leg {
  n: number;
  /** The leg's name, on the checkpoint card and the milestones. */
  title: string;
  biome: BiomeKey;
  /** Bumps and hills: [where, how tall, how wide]. */
  features: Feature[];
  /** Where the parking bay at the end of the leg starts. */
  finish: number;
  /** Toll gates (or rail crossings in town) that make you stop with the handbrake on. */
  gates: number[];
  /** What the gates are, for their signs. */
  gateKind: 'toll' | 'rail';
  /** Signs from the locals. */
  jokes: [number, string][];
  /** The stop at the end of the leg, where you park to save; the last leg ends at the new house. */
  stop?: { name: string; palette: number };
}

/** A run of small bumps, one after another: a washboard road. */
const washboard = (from: number, n: number, h = 22, w = 54, gap = 140): [number, number, number][] => Array.from({ length: n }, (_, i) => [from + i * gap, h, w]);

export const LEGS: Leg[] = [
  {
    n: 1,
    title: 'Old Street',
    biome: 'meadow',
    features: LEG1_FEATURES,
    finish: 24700,
    gates: [6740, 11640, 16740],
    gateKind: 'toll',
    jokes: [
      [2100, 'DRIVE SLOW.\nYOUR STUFF\nIS WATCHING.'],
      [3300, 'BUMPS AHEAD.\nMANY. SORRY.'],
      [5400, 'LAST CHANCE\nTO TURN BACK'],
      [8600, 'NO, REALLY.\nIT IS UPHILL.'],
      [12300, 'FUEL STOP\nSOON-ISH'],
      [15400, 'LOST A SOFA?\nKEEP IT.\n- MGMT'],
      [19700, 'CAT SPOTTED\nLOOKING SMUG\nAT TRAFFIC'],
      [22800, 'CORNER FUEL\nAHEAD.\nPARK NICELY.'],
    ],
    stop: { name: 'Corner Fuel', palette: 0 },
  },
  {
    n: 2,
    title: 'Maple Valley',
    biome: 'autumn',
    features: [
      [2600, 60, 600],
      [7900, 240, 600],
      // A shorter, gentler climb than leg one's - reinforcing the skill just learned, not raising the bar yet.
      [13000, 170, 240, 700],
      [9800, -60, 140],
      [10500, 30, 52],
      [10700, 30, 52],
      [11900, 260, 640],
      [13900, -140, 520],
      [15700, 210, 480],
      // The valley floor: a longer run through the woods before the mill.
      [17000, 40, 60],
      [17250, 40, 60],
      [18300, -70, 260],
      [19500, 190, 480],
      [20600, 30, 52],
      [20800, 30, 52],
      [21000, 30, 52],
      [22400, 230, 560],
      [23700, -60, 140],
      [24500, 140, 420],
      [26300, -50, 90],
      [26700, -50, 90],
      [27700, 110, 420],
    ],
    finish: 29400,
    gates: [7840, 11840, 15640, 22340],
    gateKind: 'toll',
    jokes: [
      [2000, 'MAPLE VALLEY.\nPOP. 12.\nAND A BEAR.'],
      [3000, 'TUNNEL AHEAD.\nHONKING IS\nFOR GEESE.'],
      [9200, 'DO NOT FEED\nTHE MOOSE\nYOUR SOFA'],
      [13200, 'SCENIC VIEW.\nEYES ON\nTHE ROAD.'],
      [19000, 'LEAF PEEPERS\nAHEAD.\nPEEP BACK.'],
      [23200, 'SLOW DOWN.\nTHE TREES ARE\nSHOWING OFF.'],
      [26000, 'PIE IN 3 KM.\nWORTH IT.'],
    ],
    stop: { name: 'Maple Mill Fuel & Pie', palette: 1 },
  },
  {
    n: 3,
    title: 'Frostpeak Pass',
    biome: 'snow',
    features: [
      ...washboard(2200, 7),
      [8700, 230, 560],
      // The pass's one real test: taller and steeper than any other leg's cliff.
      [10200, 290, 200, 800],
      [11000, -55, 90],
      [11400, -55, 90],
      [11800, -55, 90],
      ...washboard(13000, 9, 24, 54, 136),
      // Higher still: a second toll, more washboard, and a last ledge below the summit.
      [15400, -60, 200],
      [16600, 200, 520],
      ...washboard(17800, 6, 26, 56, 140),
      [19600, -80, 260],
      [20800, 240, 220, 700],
      [23600, 60, 300],
      [25100, 170, 700],
      [27300, -70, 240],
    ],
    finish: 29200,
    gates: [8640, 16540, 25040],
    gateKind: 'toll',
    jokes: [
      [1800, 'ICY ROAD.\nBRAKE EARLY.\nTHEN EARLIER.'],
      [3100, 'TUNNEL.\nIT IS WARMER\nIN THERE. BRIEFLY.'],
      [9800, 'SNOWMEN HAVE\nRIGHT OF WAY'],
      [14600, 'YES, IT IS\nCOLD. YES, THE\nCAT IS FINE.'],
      [17400, 'AVALANCHE\nRISK: LOW.\nSOFA RISK: HIGH.'],
      [22600, 'HALFWAY UP.\nOR DOWN.\nHARD TO SAY.'],
      [27800, 'SUMMIT LODGE.\nHOT COCOA.\nWARM CAT.'],
    ],
    stop: { name: 'Summit Lodge', palette: 2 },
  },
  {
    n: 4,
    title: 'Neon Town',
    biome: 'town',
    features: [
      [2800, 26, 50],
      [3000, 26, 50],
      // A proper rise under the city's own lights, to match everywhere else - town had been the
      // flattest leg in the game despite being the biggest visual set piece.
      [4200, 200, 480],
      [7600, 210, 520],
      [12000, 230, 220, 800],
      [9400, 26, 50],
      [9600, 26, 50],
      [13200, 26, 50],
      [13400, 26, 50],
      // Downtown: more speed bumps, another crossing, and a ramp up to the elevated road.
      [15400, 26, 50],
      [15600, 26, 50],
      [16800, 180, 480],
      [20600, -60, 200],
      [21800, 240, 220, 760],
      [25200, 26, 50],
      [25400, 26, 50],
      [26600, 90, 420],
      [27400, 220, 460],
    ],
    finish: 29200,
    gates: [7700, 10600, 14600, 19400],
    gateKind: 'rail',
    jokes: [
      [1900, 'WELCOME TO\nNEON TOWN.\nMIND THE BUMPS.'],
      [9000, 'OPEN LATE.\nVERY LATE.\nTOO LATE.'],
      [11200, 'TRAINS: YES.\nOFTEN: ALSO\nYES.'],
      [18200, 'PARKING:\nNONE.\nEVER.'],
      [23600, 'NEON TOWN\nNEVER SLEEPS.\nNEITHER\nWILL YOU.'],
      [27200, 'STARLITE\nDINER. PIE\nNOT INCLUDED.'],
    ],
    stop: { name: 'Starlite Diner', palette: 3 },
  },
  {
    n: 5,
    title: 'Coast Road',
    biome: 'coast',
    features: [
      [3000, 120, 600],
      [8100, 200, 560],
      [11300, 230, 220, 800],
      [10400, -80, 300],
      [12500, 36, 56],
      [12700, 36, 56],
      [14600, 220, 600],
      [16200, -70, 260],
      [17400, 180, 520],
      [19900, 200, 520],
      [21000, 30, 52],
      [21200, 30, 52],
      [22600, -50, 160],
      [23800, 120, 500],
      // The final stretch: gentle rises along the shore, the new house in sight.
      [27000, -60, 120],
      [28300, 60, 400],
      // One more climb before home - shorter than the first, a last use for a skill well learned.
      [29000, 150, 240, 450],
    ],
    finish: 30600,
    gates: [8040, 14540, 19840],
    gateKind: 'toll',
    jokes: [
      [2000, 'THE SEA.\nIT IS BIG.\nYOU ARE NOT.'],
      [3100, 'THE SEA IS ON\nTHE OTHER SIDE\nOF THIS HILL.'],
      [11600, 'THE SEA AGAIN.\nSTILL BIG.'],
      [21600, 'ALMOST HOME.\nNO PRESSURE.'],
      [24200, 'THE FINAL\nSTRETCH.\nEVERYONE WAVE.'],
      [26600, 'NEW HOUSE\nAHEAD.\nBREATHE.'],
      [28100, 'ONE LAST\nCLIMB.\nALMOST THERE.'],
    ],
  },
];

// ---------------------------------------------------------------- The trip, saved at each checkpoint

/** One thing on the truck, where it sat relative to the truck when it parked. */
export interface Carried {
  key: string;
  broken: boolean;
  dx: number;
  dy: number;
  angle: number;
  tied: boolean;
}

export interface Trip {
  /** The leg to drive next. */
  leg: number;
  cargo: Carried[];
  /** Things lost or broken so far, for the final bill. */
  lost: string[];
  broken: string[];
  /** Parking bonuses earned at each stop. */
  parking: number[];
  /** The score each leg banked at its checkpoint, by leg (see world/score.ts). */
  scores?: number[];
  /** Each leg in full, for the leaderboard: its score's parts, its time, what fell off and broke. */
  logs?: LegLog[];
  /** Coins picked up along the way, to spend at the stops. */
  coins?: number;
  /** Seconds on the road so far. */
  time: number;
}

const SAVE = 'shifting-day-trip';

export function loadTrip(): Trip | null {
  try {
    const t = JSON.parse(localStorage.getItem(SAVE) ?? 'null') as Trip | null;
    return t && t.leg >= 2 && t.leg <= LEGS.length ? t : null;
  } catch {
    return null;
  }
}

export function saveTrip(t: Trip) {
  try {
    localStorage.setItem(SAVE, JSON.stringify(t));
  } catch {
    // Private windows may refuse; the trip still carries on in this visit.
  }
}

export function clearTrip() {
  try {
    localStorage.removeItem(SAVE);
  } catch {
    // As above.
  }
}
