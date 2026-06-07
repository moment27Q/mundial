const pool = require('./config/db');
const redis = require('./config/redis');
const { fetchFixtures, fetchLiveFixtures, fixtureToMatch } = require('./services/apiSports');

const LEAGUE = parseInt(process.env.API_SPORTS_LEAGUE || '1');
const SEASON = parseInt(process.env.API_SPORTS_SEASON || '2026');
const LIVE_INTERVAL_MS = 5 * 60 * 1000;
const LOCK_KEY = 'worker:live:lock';
const LOCK_TTL = 240; // segundos — menor que el intervalo para evitar bloqueo permanente

async function runMigrations() {
  try {
    await pool.query('ALTER TABLE matches ADD COLUMN IF NOT EXISTS external_id INTEGER');
    await pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_external_id ON matches(external_id) WHERE external_id IS NOT NULL'
    );
    console.log('[Worker] Migrations OK');
  } catch (err) {
    console.error('[Worker] Migration warning:', err.message);
  }
}

async function upsertFixtures(fixtures) {
  for (const f of fixtures) {
    const m = fixtureToMatch(f);
    await pool.query(
      `INSERT INTO matches
         (external_id, home_team, away_team, home_flag, away_flag, stage, match_date, home_score, away_score, status)
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
         status     = EXCLUDED.status`,
      [m.external_id, m.home_team, m.away_team, m.home_flag, m.away_flag,
       m.stage, m.match_date, m.home_score, m.away_score, m.status]
    );
  }
}

async function autoSync() {
  console.log(`[Worker] AutoSync league=${LEAGUE} season=${SEASON}...`);
  try {
    const fixtures = await fetchFixtures({ league: LEAGUE, season: SEASON });
    if (!fixtures.length) {
      console.log('[Worker] Sin partidos disponibles en la API.');
      return;
    }
    await upsertFixtures(fixtures);
    console.log(`[Worker] ${fixtures.length} partidos sincronizados`);
  } catch (err) {
    console.error('[Worker] AutoSync error:', err.message);
  }
}

async function liveSync() {
  // Lock distribuido: evita que dos instancias del worker corran el sync al mismo tiempo
  const acquired = await redis.set(LOCK_KEY, '1', 'NX', 'EX', LOCK_TTL);
  if (!acquired) return;

  try {
    const fixtures = await fetchLiveFixtures({ league: LEAGUE });
    if (!fixtures.length) return;

    await upsertFixtures(fixtures);

    // Invalida caché de leaderboard para que los puntos se recalculen
    await redis.del('leaderboard:global');
    const roomKeys = await redis.keys('leaderboard:room:*');
    if (roomKeys.length) await redis.del(...roomKeys);

    console.log(`[Worker] LiveSync: ${fixtures.length} partidos actualizados`);
  } catch (err) {
    console.error('[Worker] LiveSync error:', err.message);
  }
}

async function main() {
  console.log('[Worker] Iniciando...');
  await runMigrations();
  await autoSync();
  setInterval(liveSync, LIVE_INTERVAL_MS);
  console.log('[Worker] Listo — live sync cada 5 min');
}

main().catch(err => {
  console.error('[Worker] Error fatal:', err.message);
  process.exit(1);
});
