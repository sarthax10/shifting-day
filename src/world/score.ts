/**
 * The score: every checkpoint banks a score for the leg just driven, and the trip's score is the sum of the
 * five. A leg scores
 *
 *   the worth of every intact thing on the truck when it parks
 *   + the parking bonus (10 to 100, for how centred the truck is in the bay)
 *   + CLEAN_LEG, when nothing fell off or broke on the way and the truck carried something
 *   − half the worth of each thing that broke on this leg (only on the leg it broke)
 *
 * so carrying a thing safely the whole way pays at every stop, losing one early costs every leg after, and
 * buying it back at a Lost & Found earns it back from the next stop on. Time is kept apart (the run clock),
 * so emptying the truck to race never pays.
 */

/** The bonus for a leg with nothing lost or broken. */
export const CLEAN_LEG = 50;

/** The total needed for one, two and three stars. */
export const STARS = [1500, 3000, 4500];

/** What one leg banked, as shown on its checkpoint card. */
export interface LegScore {
  cargo: number;
  parking: number;
  clean: number;
  penalty: number;
  score: number;
}

export function legScore(cargo: number, parking: number, nothingLost: boolean, penalty: number): LegScore {
  const clean = cargo > 0 && nothingLost ? CLEAN_LEG : 0;
  return { cargo, parking, clean, penalty, score: Math.max(0, cargo + parking + clean - penalty) };
}

/** One leg as the leaderboard keeps it: its score and how it was made, its time, and what went wrong. */
export interface LegLog extends LegScore {
  /** Seconds on this leg, packing at its start included. */
  time: number;
  /** Things that fell off on this leg, and things that broke on it. */
  lost: string[];
  broken: string[];
}

/**
 * A per-leg list with leg n's entry set. Entries are kept by leg, never appended, so a leg can be banked
 * once: replaying it from a save, or coming back from the title, cannot count it twice.
 */
export function withLeg<T>(xs: T[] | undefined, n: number, v: T, fill: T): T[] {
  const out = [...(xs ?? [])];
  while (out.length < n - 1) out.push(fill);
  out[n - 1] = v;
  return out;
}

/** A leg that never happened, as a gap in a log. */
export const NO_LEG: LegLog = { cargo: 0, parking: 0, clean: 0, penalty: 0, score: 0, time: 0, lost: [], broken: [] };

/** The score banked so far. */
export const banked = (scores: number[] | undefined) => (scores ?? []).reduce((a, b) => a + b, 0);

export const starsFor = (total: number) => STARS.filter((s) => total >= s).length;
