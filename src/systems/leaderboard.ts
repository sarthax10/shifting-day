import type { LegLog } from '../world/score';

/**
 * The online leaderboard (leaderboard/ in the repo: a Cloudflare Worker). Empty until it is deployed:
 * while it is, the game simply has no leaderboard button.
 */
export const LEADERBOARD_URL = '';

/** A finished run, as the game has it: each leg in full, the stars, and what made it home. */
export interface RunLog {
  logs: LegLog[];
  stars: number;
  delivered: string[];
}

/** A run as sent: the run, the name, and the totals (which the server checks against the legs). */
export interface Submission extends RunLog {
  name: string;
  score: number;
  time: number;
}

/** A row on a board. */
export interface Entry {
  id: number;
  name: string;
  score: number;
  time: number;
}

/** One run in full, for its card. */
export interface RunCard extends Entry {
  stars: number;
  delivered: string[];
  logs: LegLog[];
  created: number;
}

export type Board = { kind: 'time' } | { kind: 'score' } | { kind: 'leg'; leg: number; by: 'time' | 'score' };

export const leaderboardOn = () => LEADERBOARD_URL !== '';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`${LEADERBOARD_URL}${path}`, { ...init, signal: ctl.signal });
    const body = (await r.json().catch(() => ({}))) as T & { error?: string };
    if (!r.ok) throw new Error(body.error ?? 'The leaderboard is not answering.');
    return body;
  } catch (e) {
    throw new Error(e instanceof Error && e.name !== 'AbortError' && e.message ? e.message : 'The leaderboard is not answering.');
  } finally {
    clearTimeout(timer);
  }
}

const query = (b: Board) => (b.kind === 'leg' ? `/legs?leg=${b.leg}&by=${b.by}` : `/runs?by=${b.kind}`);

/** The top rows of a board. On a leg board, `score` and `time` are that leg's. */
export const fetchBoard = (b: Board) => call<{ top: Entry[] }>(query(b)).then((r) => r.top);

export const fetchRun = (id: number) => call<RunCard>(`/runs/${id}`);

/** Sends a finished run; answers with its id and where it places on the two whole-run boards. */
export const submitRun = (run: Submission) =>
  call<{ id: number; rank: { time: number; score: number } }>('/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run) });

const NAME_KEY = 'shifting-day-name';
export const savedName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
};
export const saveName = (name: string) => {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Private windows may refuse; the name is just asked for again next time.
  }
};
