-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) UNIQUE NOT NULL,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Room members
CREATE TABLE IF NOT EXISTS room_members (
  room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0,
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- Matches
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  external_id INTEGER,
  home_team VARCHAR(50) NOT NULL,
  away_team VARCHAR(50) NOT NULL,
  home_flag VARCHAR(20) DEFAULT '',
  away_flag VARCHAR(20) DEFAULT '',
  stage VARCHAR(50) DEFAULT 'Grupo',
  match_date TIMESTAMP NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  status VARCHAR(20) DEFAULT 'upcoming',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Predictions
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  base_points INTEGER DEFAULT 0,
  bonus_points INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  scored BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_external_id ON matches(external_id) WHERE external_id IS NOT NULL;

-- Admin user: password is "admin123"
INSERT INTO users (username, email, password_hash, role)
VALUES ('admin', 'admin@worldcup.com', '$2a$10$AorxJxYhtHbauKopIbOL7uxMkqYPkEj5C0Ba35T0bzXjkS6VzPXRy', 'admin')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin';

-- Sample matches
INSERT INTO matches (home_team, away_team, home_flag, away_flag, stage, match_date) VALUES
('Argentina', 'Brasil',       '🇦🇷', '🇧🇷', 'Grupo A', NOW() + INTERVAL '2 days'),
('Francia',   'Alemania',     '🇫🇷', '🇩🇪', 'Grupo B', NOW() + INTERVAL '2 days 3 hours'),
('España',    'Portugal',     '🇪🇸', '🇵🇹', 'Grupo C', NOW() + INTERVAL '3 days'),
('Inglaterra','Italia',       '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇮🇹', 'Grupo D', NOW() + INTERVAL '3 days 3 hours'),
('México',    'Uruguay',      '🇲🇽', '🇺🇾', 'Grupo E', NOW() + INTERVAL '4 days'),
('Holanda',   'Bélgica',      '🇳🇱', '🇧🇪', 'Grupo F', NOW() + INTERVAL '4 days 3 hours'),
('Croacia',   'Marruecos',    '🇭🇷', '🇲🇦', 'Grupo G', NOW() + INTERVAL '5 days'),
('Japón',     'Corea del Sur','🇯🇵', '🇰🇷', 'Grupo H', NOW() + INTERVAL '5 days 3 hours')
ON CONFLICT DO NOTHING;
