ALTER TABLE game_rooms ADD COLUMN green_token TEXT;
ALTER TABLE game_rooms ADD COLUMN third_user_id TEXT;
ALTER TABLE game_rooms ADD COLUMN player_count INTEGER NOT NULL DEFAULT 2;
