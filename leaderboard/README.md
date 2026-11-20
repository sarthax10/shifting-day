# The leaderboard

A Cloudflare Worker with a D1 database, on Cloudflare's free plan. The game sends finished runs here and
shows the top ten on the score card. Until it is deployed, the game has no leaderboard button.

| File | What it is |
|---|---|
| `src/worker.js` | The Worker: `GET /scores` for the top ten, `POST /scores` to send a run |
| `schema.sql` | The `scores` table |
| `wrangler.toml` | The Worker's settings, and which database it uses |

## What it refuses

A browser game can always be made to send a made-up score, so the Worker only refuses what the game could
not have produced:

- anything other than five leg scores, or a leg above 2420 (everything on the truck, perfect parking and a
  clean leg)
- a total that is not the sum of its legs
- a run under two minutes or over six hours
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
```

For `SALT`, type any long random text. It keeps the stored player hashes from being matched to addresses.

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

See the board: `npx wrangler@4 d1 execute shifting-day-leaderboard --remote --command "SELECT * FROM scores ORDER BY score DESC LIMIT 20"`

Remove an entry: `npx wrangler@4 d1 execute shifting-day-leaderboard --remote --command "DELETE FROM scores WHERE id = 123"`
