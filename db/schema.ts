export const gameRoomsSchema = `
CREATE TABLE IF NOT EXISTS game_rooms (
  code TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  blue_token TEXT NOT NULL,
  red_token TEXT,
  green_token TEXT,
  fourth_token TEXT,
  host_user_id TEXT,
  guest_user_id TEXT,
  third_user_id TEXT,
  fourth_user_id TEXT,
  player_count INTEGER NOT NULL DEFAULT 2,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting',
  updated_at INTEGER NOT NULL
)
`;
