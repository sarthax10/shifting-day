-- Shifting Day's leaderboard: one row per finished run that was submitted.
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  -- The whole run, in seconds.
  time REAL NOT NULL,
  -- The five leg scores, as JSON, so the total can be checked later.
  legs TEXT NOT NULL,
  -- A salted hash of the player's address, for the submission cooldown. Never the address itself.
  player TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_rank ON scores (score DESC, time ASC);
CREATE INDEX IF NOT EXISTS scores_player ON scores (player, created);
