# The leaderboard

A Cloudflare Worker with a D1 database, on Cloudflare's free plan. The game sends finished runs here, and
the score card's LEADERBOARD button shows three boards: FASTEST and TOP SCORE for whole runs, and BY LEG for
any one leg, by time or by score. Tapping a name opens that run's card: every leg's time and score, how the
score was made (cargo, parking, clean leg, breakage), what fell off or broke where, and which pets made it.
Until it is deployed, the game has no leaderboard button.

| File | What it is |
|---|---|
| `src/worker.js` | The Worker (below) |
| `schema.sql` | The `runs` table (one row per run) and `legs` (each run's five legs, for the leg boards) |
| `wrangler.toml` | The Worker's settings, and which database it uses |

| Call | Answers |
|---|---|
| `GET /runs?by=time` or `by=score` | The top 20 whole runs |
| `GET /legs?leg=1..5&by=time` or `by=score` | The top 20 results on one leg |
| `GET /runs/:id` | One run in full, for its card |
| `POST /runs` | Sends a run; answers with its id and its place on both whole-run boards |
| `GET /admin` | The admin console (`src/admin.html`), behind the `ADMIN_KEY` secret |

## What it refuses

A browser game can always be made to send a made-up score, so the Worker only refuses what the game could
not have produced:

- anything but five legs
- a leg whose score is not its cargo + parking + clean-leg bonus + speed bonus − breakage, whose breakage is not half the
  worth of what it says broke, that claims a clean leg with something lost or broken, or that names a thing
  the game does not have
- a speed bonus that is not whole seconds at 5 points each, or lasts longer than the leg
- a leg under 30 seconds or over two hours, and totals that are not the sum of the legs
- stars the run did not earn (the Worker works them out itself)
- names that are empty, longer than 12 characters, or rude (letters, digits, spaces, `.`, `-` and `_` only)
- a second submission from the same player within 20 seconds

Players are told apart by a salted hash of their address for the cooldown. The address itself is never
stored.

## Deploy it (once)

You need a free Cloudflare account. Then, from the project folder:

```bash
cd leaderboard
npx wrangler@4 login
```

This opens Cloudflare in your browser to let Wrangler use your account.

```bash
npx wrangler@4 d1 create shifting-day-leaderboard
```

Copy the `database_id` it prints into `wrangler.toml`, in place of `REPLACE_WITH_DATABASE_ID`.

```bash
npx wrangler@4 d1 execute shifting-day-leaderboard --remote --file schema.sql
npx wrangler@4 secret put SALT
npx wrangler@4 secret put ADMIN_KEY
```

For `SALT` and `ADMIN_KEY`, type any long random text (keep the admin key: it unlocks the console). It keeps the stored player hashes from being matched to addresses.

```bash
npx wrangler@4 deploy
```

It prints the Worker's address, like `https://shifting-day-leaderboard.<your-subdomain>.workers.dev`.
Put that in `src/systems/leaderboard.ts` as `LEADERBOARD_URL`, then build and upload the game again.

## Run it locally

```bash
npx wrangler@4 d1 execute shifting-day-leaderboard --local --file schema.sql
npx wrangler@4 dev --local --port 8787
```

Point `LEADERBOARD_URL` at `http://127.0.0.1:8787` while testing (the Worker accepts localhost).

## Looking after it

The admin console is at `<worker address>/admin`. Unlock it with the `ADMIN_KEY` secret (kept locally in
`leaderboard/.admin-key`, which git ignores). It lists every run, opens any run in full, renames, deletes,
clears all of one player's runs, and bans a player so their new runs are refused. To change the key:
`npx wrangler@4 secret put ADMIN_KEY`, and put the same text in `.admin-key`.

From the command line:


See the board: `npx wrangler@4 d1 execute shifting-day-leaderboard --remote --command "SELECT id, name, score, time FROM runs ORDER BY score DESC LIMIT 20"`

Remove a run: `npx wrangler@4 d1 execute shifting-day-leaderboard --remote --command "DELETE FROM legs WHERE run_id = 123; DELETE FROM runs WHERE id = 123"`
