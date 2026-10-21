CREATE TABLE IF NOT EXISTS game_rooms (
  code TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  blue_token TEXT NOT NULL,
  red_token TEXT,
  host_user_id TEXT,
  guest_user_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting',
  updated_at INTEGER NOT NULL
);
