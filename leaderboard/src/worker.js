/**
 * Shifting Day's leaderboard: a Cloudflare Worker over a D1 database.
 *
 *   GET  /runs?by=time|score        the top whole runs, fastest or highest scoring first
 *   GET  /legs?leg=1..5&by=time|score  the top results on one leg
 *   GET  /runs/:id                  one run in full, for its card
 *   POST /runs                      send a finished run -> { id, rank: { time, score } }
 *
 * A browser game can never fully stop someone sending a made-up run, but this refuses anything the game
 * could not have produced. Each leg must add up (cargo + parking + clean-leg bonus - breakage = its score,
 * and the breakage must be half the worth of what it says broke), its time must be one a real drive could
 * take, the legs must add up to the run, and every thing named must be one of the game's. Names are cleaned,
 * and a player can send one run every 20 seconds.
 */

/** What each thing is worth: the same table as the game's (src/art/art.ts VALUE). */
const VALUE = {
  cat: 250, clock: 220, bird: 200, fish: 160, fridge: 150, guitar: 140, sofa: 120, record: 120, washer: 110,
  tv: 90, armchair: 90, bookshelf: 80, rug: 70, suitcase: 70, mattress: 60, plant: 60, toolbox: 60,
  jam: 50, lamp: 50, box_m: 40, box_l: 30, chair: 30, box_s: 20,
};
const ALL_WORTH = Object.values(VALUE).reduce((a, b) => a + b, 0);
const CLEAN_LEG = 50;
/** The total needed for one, two and three stars (src/world/score.ts STARS). */
const STARS = [1500, 3000, 4500];
/** No real leg is quicker than this, in seconds; none is worth keeping after two hours. */
const LEG_MIN = 20;
const LEG_MAX = 2 * 3600;
/** Seconds a player waits between submissions. */
const COOLDOWN = 20;
const TOP = 20;

/** Pages allowed to call this: the game on itch.io and GitHub Pages, and a local dev server. */
const ORIGINS = [/^https:\/\/([a-z0-9-]+\.)*itch\.zone$/, /^https:\/\/([a-z0-9-]+\.)*itch\.io$/, /^https:\/\/sarthax10\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];

/** A short list of words no name on the board may contain. */
const BLOCKED = ['fuck', 'shit', 'cunt', 'nigg', 'fag', 'rape', 'nazi', 'hitler', 'whore', 'slut', 'dick', 'cock', 'pussy', 'bitch', 'retard', 'kkk'];

function cors(request) {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = ORIGINS.some((r) => r.test(origin));
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://sarthax10.github.io',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (request, body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(request) } });

/** A name as the board shows it: letters, digits, spaces, dots, dashes and underscores, 1 to 12 of them. */
function cleanName(raw) {
  const name = String(raw ?? '')
    .normalize('NFKC')
    .replace(/[^A-Za-z0-9 ._-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12)
    .toUpperCase();
  if (!name) return null;
  // Look-alike digits read as letters first, then everything but letters goes: "sh1t" and "s.h.i.t" both match.
  const squashed = name.toLowerCase().replace(/0/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/[^a-z]/g, '');
  if (BLOCKED.some((w) => squashed.includes(w))) return null;
  return name;
}

const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
const isKeys = (xs) => Array.isArray(xs) && xs.length <= 23 && xs.every((k) => typeof k === 'string' && k in VALUE) && new Set(xs).size === xs.length;

/** A leg as the game logs it, checked to add up; null if it does not. */
function cleanLeg(l) {
  if (!l || typeof l !== 'object') return null;
  const { cargo, parking, clean, penalty, score, time, lost, broken } = l;
  if (!isInt(cargo, 0, ALL_WORTH) || !isInt(parking, 0, 100) || (clean !== 0 && clean !== CLEAN_LEG) || !isInt(penalty, 0, ALL_WORTH)) return null;
  if (!isKeys(lost) || !isKeys(broken)) return null;
  if (score !== Math.max(0, cargo + parking + clean - penalty)) return null;
  if (penalty !== broken.reduce((n, k) => n + Math.round(VALUE[k] / 2), 0)) return null;
  if (clean && (cargo === 0 || lost.length || broken.length)) return null;
  if (typeof time !== 'number' || !Number.isFinite(time) || time < LEG_MIN || time > LEG_MAX) return null;
  return { cargo, parking, clean, penalty, score, time: Math.round(time * 10) / 10, lost, broken };
}

/** The player, as far as the board can tell: a salted hash of their address, never the address itself. */
async function playerOf(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const data = new TextEncoder().encode(`${env.SALT ?? 'shifting-day'}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function runs(env, by) {
  const order = by === 'time' ? 'time ASC, score DESC' : 'score DESC, time ASC';
  const { results } = await env.DB.prepare(`SELECT id, name, score, time FROM runs ORDER BY ${order}, id ASC LIMIT ?`).bind(TOP).all();
  return results;
}

async function legs(env, leg, by) {
  const order = by === 'time' ? 'l.time ASC, l.score DESC' : 'l.score DESC, l.time ASC';
  const { results } = await env.DB.prepare(`SELECT r.id AS id, r.name AS name, l.score AS score, l.time AS time FROM legs l JOIN runs r ON r.id = l.run_id WHERE l.leg = ? ORDER BY ${order}, r.id ASC LIMIT ?`).bind(leg, TOP).all();
  return results;
}

async function card(env, id) {
  const r = await env.DB.prepare('SELECT id, name, score, time, stars, delivered, logs, created FROM runs WHERE id = ?').bind(id).first();
  if (!r) return null;
  return { ...r, delivered: JSON.parse(r.delivered), logs: JSON.parse(r.logs) };
}

async function submit(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json(request, { error: 'bad request' }, 400);
  }
  const name = cleanName(body.name);
  if (!name) return json(request, { error: 'Pick another name.' }, 400);
  const logs = Array.isArray(body.logs) && body.logs.length === 5 ? body.logs.map(cleanLeg) : [];
  if (logs.length !== 5 || logs.some((l) => !l)) return json(request, { error: 'That run does not add up.' }, 400);
  const score = logs.reduce((n, l) => n + l.score, 0);
  const time = logs.reduce((n, l) => n + l.time, 0);
  if (body.score !== score || typeof body.time !== 'number' || Math.abs(body.time - time) > 1.5) return json(request, { error: 'That run does not add up.' }, 400);
  if (!isKeys(body.delivered)) return json(request, { error: 'That run does not add up.' }, 400);
  const stars = STARS.filter((s) => score >= s).length;

  const player = await playerOf(request, env);
  const now = Math.floor(Date.now() / 1000);
  const last = await env.DB.prepare('SELECT MAX(created) AS at FROM runs WHERE player = ?').bind(player).first();
  if (last?.at && now - last.at < COOLDOWN) return json(request, { error: 'Easy! Try again in a few seconds.' }, 429);

  const t = Math.round(time * 10) / 10;
  const row = await env.DB.prepare('INSERT INTO runs (name, score, time, stars, delivered, logs, player, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
    .bind(name, score, t, stars, JSON.stringify(body.delivered), JSON.stringify(logs), player, now)
    .first();
  const id = row.id;
  await env.DB.batch(logs.map((l, i) => env.DB.prepare('INSERT INTO legs (run_id, leg, score, time) VALUES (?, ?, ?, ?)').bind(id, i + 1, l.score, l.time)));
  const faster = await env.DB.prepare('SELECT COUNT(*) AS n FROM runs WHERE time < ? OR (time = ? AND score > ?)').bind(t, t, score).first();
  const better = await env.DB.prepare('SELECT COUNT(*) AS n FROM runs WHERE score > ? OR (score = ? AND time < ?)').bind(score, score, t).first();
  return json(request, { id, rank: { time: (faster?.n ?? 0) + 1, score: (better?.n ?? 0) + 1 } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    const by = url.searchParams.get('by') === 'time' ? 'time' : 'score';
    if (url.pathname === '/runs' && request.method === 'GET') return json(request, { top: await runs(env, by) });
    if (url.pathname === '/runs' && request.method === 'POST') return submit(request, env);
    if (url.pathname === '/legs' && request.method === 'GET') {
      const leg = Number(url.searchParams.get('leg'));
      if (!isInt(leg, 1, 5)) return json(request, { error: 'No such leg.' }, 400);
      return json(request, { top: await legs(env, leg, by) });
    }
    const m = url.pathname.match(/^\/runs\/(\d+)$/);
    if (m && request.method === 'GET') {
      const r = await card(env, Number(m[1]));
      return r ? json(request, r) : json(request, { error: 'No such run.' }, 404);
    }
    return json(request, { error: 'not found' }, 404);
  },
};
