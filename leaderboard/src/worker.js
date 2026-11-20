/**
 * Shifting Day's leaderboard: a Cloudflare Worker over a D1 database.
 *
 *   GET  /scores        the top 10, best score first (ties: the faster run)
 *   POST /scores        { name, legs: [5 leg scores], score, time } -> { rank, top }
 *
 * A browser game can never fully stop someone sending a made-up score, but this refuses anything the game
 * could not have produced: five legs, each no more than a leg can earn, a total that is their sum, a run
 * time a real drive could take, and a clean name. One submission per player every 20 seconds.
 */

/** The most one leg can bank: every thing on the truck (2270), perfect parking (100), a clean leg (50). */
const LEG_MAX = 2270 + 100 + 50;
/** No real run of five legs is quicker than this, in seconds; none is worth keeping after six hours. */
const TIME_MIN = 120;
const TIME_MAX = 6 * 3600;
/** Seconds a player waits between submissions. */
const COOLDOWN = 20;
const TOP = 10;

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

/** The player, as far as the board can tell: a salted hash of their address, never the address itself. */
async function playerOf(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const data = new TextEncoder().encode(`${env.SALT ?? 'shifting-day'}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function top(env) {
  const { results } = await env.DB.prepare('SELECT name, score, time FROM scores ORDER BY score DESC, time ASC, id ASC LIMIT ?').bind(TOP).all();
  return results;
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
  const legs = body.legs;
  if (!Array.isArray(legs) || legs.length !== 5 || !legs.every((n) => Number.isInteger(n) && n >= 0 && n <= LEG_MAX)) return json(request, { error: 'That score does not add up.' }, 400);
  const score = legs.reduce((a, b) => a + b, 0);
  if (body.score !== score) return json(request, { error: 'That score does not add up.' }, 400);
  const time = Number(body.time);
  if (!Number.isFinite(time) || time < TIME_MIN || time > TIME_MAX) return json(request, { error: 'That run time does not add up.' }, 400);

  const player = await playerOf(request, env);
  const now = Math.floor(Date.now() / 1000);
  const last = await env.DB.prepare('SELECT MAX(created) AS at FROM scores WHERE player = ?').bind(player).first();
  if (last?.at && now - last.at < COOLDOWN) return json(request, { error: 'Easy! Try again in a few seconds.' }, 429);

  await env.DB.prepare('INSERT INTO scores (name, score, time, legs, player, created) VALUES (?, ?, ?, ?, ?, ?)').bind(name, score, Math.round(time * 10) / 10, JSON.stringify(legs), player, now).run();
  const better = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE score > ? OR (score = ? AND time < ?)').bind(score, score, time).first();
  return json(request, { rank: (better?.n ?? 0) + 1, top: await top(env) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    if (url.pathname === '/scores' && request.method === 'GET') return json(request, { top: await top(env) });
    if (url.pathname === '/scores' && request.method === 'POST') return submit(request, env);
    return json(request, { error: 'not found' }, 404);
  },
};
