/**
 * The online leaderboard (leaderboard/ in the repo: a Cloudflare Worker). Empty until it is deployed:
 * while it is, the game simply has no leaderboard button.
 */
export const LEADERBOARD_URL = '';

export interface Entry {
  name: string;
  score: number;
  /** The whole run, in seconds. */
  time: number;
}

/** A run as submitted: the five leg scores (the server checks they add up), and the run time. */
export interface Run {
  name: string;
  legs: number[];
  score: number;
  time: number;
}

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

export const topScores = () => call<{ top: Entry[] }>('/scores').then((r) => r.top);

export const submitRun = (run: Run) =>
  call<{ rank: number; top: Entry[] }>('/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run) });

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
