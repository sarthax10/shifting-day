-- Shifting Day's leaderboard.

-- One row per finished run that was sent.
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  -- The whole run, in seconds.
  time REAL NOT NULL,
  stars INTEGER NOT NULL,
  -- What made it home, as JSON: the things' keys.
  delivered TEXT NOT NULL,
  -- Each leg in full, as JSON: its score's parts, its time, what fell off and broke.
  logs TEXT NOT NULL,
  -- A salted hash of the player's address, for the submission cooldown. Never the address itself.
  player TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_by_score ON runs (score DESC, time ASC);
CREATE INDEX IF NOT EXISTS runs_by_time ON runs (time ASC, score DESC);
CREATE INDEX IF NOT EXISTS runs_by_player ON runs (player, created);

-- Each run's five legs, for the leg boards.
CREATE TABLE IF NOT EXISTS legs (
  run_id INTEGER NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  leg INTEGER NOT NULL,
  score INTEGER NOT NULL,
  time REAL NOT NULL,
  PRIMARY KEY (run_id, leg)
);
CREATE INDEX IF NOT EXISTS legs_by_time ON legs (leg, time ASC, score DESC);
CREATE INDEX IF NOT EXISTS legs_by_score ON legs (leg, score DESC, time ASC);

-- Players whose runs are refused, set from the admin console.
CREATE TABLE IF NOT EXISTS bans (
  player TEXT PRIMARY KEY,
  note TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL
);
