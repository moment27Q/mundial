const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const matchRoutes = require('./routes/matches');
const predictionRoutes = require('./routes/predictions');
const roomRoutes = require('./routes/rooms');
const leaderboardRoutes = require('./routes/leaderboard');
const adminRoutes = require('./routes/admin');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3001;

async function runMigrations() {
  try {
    await pool.query('ALTER TABLE matches ADD COLUMN IF NOT EXISTS external_id INTEGER');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_external_id ON matches(external_id) WHERE external_id IS NOT NULL');
  } catch (err) {
    console.error('Migration warning:', err.message);
  }
}


async function upsertFixtures(fixtures) {
  const { fixtureToMatch } = require('./services/apiSports');
  for (const f of fixtures) {
    const m = fixtureToMatch(f);
    await pool.query(`
      INSERT INTO matches (external_id, home_team, away_team, home_flag, away_flag, stage, match_date, home_score, away_score, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (external_id) WHERE external_id IS NOT NULL
      DO UPDATE SET
        home_team  = EXCLUDED.home_team,
        away_team  = EXCLUDED.away_team,
        home_flag  = EXCLUDED.home_flag,
        away_flag  = EXCLUDED.away_flag,
        stage      = EXCLUDED.stage,
        match_date = EXCLUDED.match_date,
        home_score = EXCLUDED.home_score,
        away_score = EXCLUDED.away_score,
        status     = EXCLUDED.status
    `, [m.external_id, m.home_team, m.away_team, m.home_flag, m.away_flag,
        m.stage, m.match_date, m.home_score, m.away_score, m.status]);
  }
}

async function autoSyncMatches() {
  const { fetchFixtures } = require('./services/apiSports');
  const league = parseInt(process.env.API_SPORTS_LEAGUE || '1');
  const season = parseInt(process.env.API_SPORTS_SEASON || '2026');
  try {
    console.log(`[AutoSync] Sincronizando league=${league} season=${season}...`);
    const fixtures = await fetchFixtures({ league, season });
    if (!fixtures.length) {
      console.log('[AutoSync] Sin partidos disponibles. Verificá tu plan de API-Sports o cargá partidos manualmente desde el panel admin.');
      return;
    }
    await upsertFixtures(fixtures);
    console.log(`[AutoSync] ${fixtures.length} partidos sincronizados`);
  } catch (err) {
    console.error('[AutoSync] Error:', err.message);
  }
}

async function syncLiveMatches() {
  const { fetchLiveFixtures } = require('./services/apiSports');
  const redis = require('./config/redis');
  const league = parseInt(process.env.API_SPORTS_LEAGUE || '1');
  try {
    const fixtures = await fetchLiveFixtures({ league });
    if (!fixtures.length) return;
    await upsertFixtures(fixtures);
    await redis.del('leaderboard:global');
    const roomKeys = await redis.keys('leaderboard:room:*');
    if (roomKeys.length) await redis.del(...roomKeys);
    console.log(`[LiveSync] ${fixtures.length} partidos en vivo actualizados`);
  } catch (err) {
    console.error('[LiveSync] Error:', err.message);
  }
}

app.set('trust proxy', 1);
app.use(cors({ origin: '*' }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', instance: process.env.HOSTNAME || 'local', ts: Date.now() });
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

runMigrations().then(async () => {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT} [${process.env.HOSTNAME || 'local'}]`);
    require('./services/gemini').listModels().catch(() => {});
    autoSyncMatches();
    // Actualiza partidos en vivo cada 5 minutos
    setInterval(syncLiveMatches, 5 * 60 * 1000);
  });
});
