/** Screen size the game is designed at. */
export const W = 1920;
export const H = 1080;
/** Height of the flat road. */
export const GROUND = 880;
export const WORLD_START = -600;
/** Where the road ends, for the leg being driven (a little past its finish). */
export let WORLD_END = 25900;
/** The truck has arrived once it passes this. */
export let FINISH = 24700;

/** Bumps (positive) and holes (negative) along the road: [where, how tall, how wide]. */
/** The first leg's road (the tutorial): kept as the default. */
export const LEG1_FEATURES: [number, number, number][] = [
  [2500, 24, 55],
  [3100, 28, 52],
  [3320, 28, 52],
  [4300, 150, 430],
  [5100, -36, 70],
  [5520, -40, 80],
  [5760, 32, 50],
  [6800, 220, 480],
  [7700, 18, 48],
  [7880, 18, 48],
  [8060, 18, 48],
  [8750, -74, 260],
  [9350, 38, 58],
  // Second stretch: three bumps in a row, then a big hill.
  [10300, 30, 52],
  [10520, 30, 52],
  [10740, 30, 52],
  [11700, 200, 520],
  // Potholes, close together.
  [12700, -50, 90],
  [13000, -56, 90],
  [13800, 190, 400],
  // Washboard: four small bumps, one after another.
  [14600, 22, 54],
  [14740, 22, 54],
  [14880, 22, 54],
  [15020, 22, 54],
  [15900, -90, 300],
  // The steep one.
  [16800, 220, 560],
  [17900, -40, 70],
  [18200, 40, 60],
  [18400, -44, 70],
  [19300, 170, 440],
  [20100, -100, 320],
  [20900, 26, 58],
  [21060, 26, 58],
  [21220, 26, 58],
  [22100, 150, 300],
  [22900, -60, 100],
  [23500, 32, 50],
];

/** The road of the leg being driven. */
export let FEATURES: [number, number, number][] = LEG1_FEATURES;

/** Switches the road to another leg's: its bumps and hills, and where it finishes. */
export function setRoad(features: [number, number, number][], finish: number) {
  FEATURES = features;
  FINISH = finish;
  WORLD_END = finish + 1200;
}

export function groundY(x: number): number {
  return groundAt(FEATURES, x);
}

/** The road height at x, for any leg's bumps and hills. */
export function groundAt(features: [number, number, number][], x: number): number {
  let y = GROUND;
  for (const [fx, h, w0] of features) {
    // Dips are widened until their walls are no steeper than about 13°, so the wheels roll through them
    // instead of slamming into the far side and stopping dead. (The steepest slope of a dip h deep and
    // w wide is about 0.86·h/w.)
    const w = h < 0 ? Math.max(w0, (-h * 0.86) / 0.24) : w0;
    const d = (x - fx) / w;
    if (d > -3.2 && d < 3.2) y -= h * Math.exp(-d * d);
  }
  return y;
}
