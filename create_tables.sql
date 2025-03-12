CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  game_id UUID REFERENCES games(id),
  player_id UUID NOT NULL,
  player_name VARCHAR(100) NOT NULL,
  hand JSONB DEFAULT '[]'::jsonb
);