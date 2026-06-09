const pool = require('./config/db');
const redis = require('./config/redis');
const { fetchFixtures, fetchLiveFixtures, fixtureToMatch } = require('./services/apiSports');

const LEAGUE  = parseInt(process.env.API_SPORTS_LEAGUE || '1');
const SEASON  = parseInt(process.env.API_SPORTS_SEASON || '2026');
const LOCK_KEY = 'worker:live:lock';
const LOCK_TTL = 50; // segundos

async function runMigrations() {
  const stmts = [
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS external_id INTEGER',
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS elapsed INTEGER',
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS status_short VARCHAR(10)',
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_external_id
     ON matches(external_id) WHERE external_id IS NOT NULL`,
  ];
  for (const sql of stmts) {
    try { await pool.query(sql); } catch (e) { console.warn('[Worker] Migration:', e.message); }
  }
  console.log('[Worker] Migrations OK');
}

async function upsertFixtures(fixtures) {
  for (const f of fixtures) {
    const m = fixtureToMatch(f);
    await pool.query(
      `INSERT INTO matches
         (external_id, home_team, away_team, home_flag, away_flag, stage,
          match_date, home_score, away_score, status, elapsed, status_short)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (external_id) WHERE external_id IS NOT NULL
       DO UPDATE SET
         home_team    = EXCLUDED.home_team,
         away_team    = EXCLUDED.away_team,
         home_flag    = EXCLUDED.home_flag,
         away_flag    = EXCLUDED.away_flag,
         stage        = EXCLUDED.stage,
         match_date   = EXCLUDED.match_date,
         home_score   = EXCLUDED.home_score,
         away_score   = EXCLUDED.away_score,
         status       = EXCLUDED.status,
         elapsed      = EXCLUDED.elapsed,
         status_short = EXCLUDED.status_short`,
      [m.external_id, m.home_team, m.away_team, m.home_flag, m.away_flag,
       m.stage, m.match_date, m.home_score, m.away_score,
       m.status, m.elapsed ?? null, m.status_short ?? null]
    );
  }
}

async function autoSync() {
  console.log(`[Worker] AutoSync league=${LEAGUE} season=${SEASON}...`);
  try {
    const fixtures = await fetchFixtures({ league: LEAGUE, season: SEASON });
    if (!fixtures.length) { console.log('[Worker] Sin partidos en la API.'); return; }
    await upsertFixtures(fixtures);
    console.log(`[Worker] ${fixtures.length} partidos sincronizados`);
  } catch (err) {
    console.error('[Worker] AutoSync error:', err.message);
  }
}

async function liveSync() {
  const acquired = await redis.set(LOCK_KEY, '1', 'NX', 'EX', LOCK_TTL);
  if (!acquired) return;

  try {
    const fixtures = await fetchLiveFixtures({ league: LEAGUE });
    if (!fixtures.length) return;

    await upsertFixtures(fixtures);
    await redis.del('leaderboard:global');
    const roomKeys = await redis.keys('leaderboard:room:*');
    if (roomKeys.length) await redis.del(...roomKeys);
    console.log(`[Worker] LiveSync: ${fixtures.length} partidos en vivo`);
  } catch (err) {
    console.error('[Worker] LiveSync error:', err.message);
  }
}

async function hasLiveMatches() {
  const r = await pool.query("SELECT 1 FROM matches WHERE status='live' LIMIT 1");
  return r.rowCount > 0;
}

async function scheduleLiveSync() {
  await liveSync();
  // 60s si hay partidos en vivo, 5min si no
  const live = await hasLiveMatches();
  const delay = live ? 60_000 : 5 * 60_000;
  setTimeout(scheduleLiveSync, delay);
}

async function main() {
  console.log('[Worker] Iniciando...');
  await runMigrations();
  await autoSync();
  scheduleLiveSync();
  console.log('[Worker] Listo — live sync adaptativo (60s en vivo / 5min en espera)');
}

main().catch(err => { console.error('[Worker] Fatal:', err.message); process.exit(1); });
