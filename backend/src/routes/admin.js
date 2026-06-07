const express = require('express');
const pool = require('../config/db');
const redis = require('../config/redis');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { calculateBasePoints, calculateStreakBonus } = require('../services/scoring');
const { fetchFixtures, fetchLiveFixtures, fixtureToMatch } = require('../services/apiSports');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

// --- MATCH MANAGEMENT ---

router.get('/matches', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM matches ORDER BY match_date ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/matches', async (req, res) => {
  try {
    const { home_team, away_team, home_flag, away_flag, stage, match_date } = req.body;
    if (!home_team || !away_team || !match_date)
      return res.status(400).json({ error: 'home_team, away_team and match_date are required' });

    const result = await pool.query(
      'INSERT INTO matches (home_team, away_team, home_flag, away_flag, stage, match_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [home_team, away_team, home_flag || '', away_flag || '', stage || 'Grupo', match_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/matches/:id', async (req, res) => {
  try {
    const { home_team, away_team, home_flag, away_flag, stage, match_date, home_score, away_score, status } = req.body;
    const result = await pool.query(`
      UPDATE matches SET
        home_team  = COALESCE($1, home_team),
        away_team  = COALESCE($2, away_team),
        home_flag  = COALESCE($3, home_flag),
        away_flag  = COALESCE($4, away_flag),
        stage      = COALESCE($5, stage),
        match_date = COALESCE($6, match_date),
        home_score = COALESCE($7, home_score),
        away_score = COALESCE($8, away_score),
        status     = COALESCE($9, status)
      WHERE id = $10
      RETURNING *
    `, [home_team, away_team, home_flag, away_flag, stage, match_date, home_score, away_score, status, req.params.id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Match not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/matches/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM matches WHERE id = $1', [req.params.id]);
    res.json({ message: 'Match deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- SCORING ---

/**
 * Score all unscored predictions for a finished match.
 * Recalculates total_points per user from scratch (base + early + streak).
 */
router.post('/matches/:id/score', async (req, res) => {
  try {
    const matchRes = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
    const match = matchRes.rows[0];
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.home_score === null || match.away_score === null)
      return res.status(400).json({ error: 'Set the match result before scoring' });

    const predsRes = await pool.query(
      'SELECT * FROM predictions WHERE match_id = $1 AND scored = FALSE',
      [match.id]
    );

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Calculate and persist per-prediction points
      for (const pred of predsRes.rows) {
        const base = calculateBasePoints(pred.home_score, pred.away_score, match.home_score, match.away_score);
        const matchDate = new Date(match.match_date);
        const predDate = new Date(pred.created_at);
        const hoursAhead = (matchDate - predDate) / 3_600_000;
        const early = hoursAhead > 24 ? 1 : 0;

        await client.query(
          'UPDATE predictions SET base_points=$1, bonus_points=$2, total_points=$3, scored=TRUE WHERE id=$4',
          [base, early, base + early, pred.id]
        );
      }

      // 2. Mark match finished
      await client.query('UPDATE matches SET status=$1 WHERE id=$2', ['finished', match.id]);

      // 3. Recalculate user totals (base + early + streak) from full history
      const affectedUsers = [...new Set(predsRes.rows.map(p => p.user_id))];
      for (const uid of affectedUsers) {
        const historyRes = await client.query(`
          SELECT p.base_points, p.bonus_points
          FROM predictions p
          JOIN matches m ON p.match_id = m.id
          WHERE p.user_id = $1 AND p.scored = TRUE
          ORDER BY m.match_date ASC
        `, [uid]);

        const history = historyRes.rows;
        const totalBase = history.reduce((s, p) => s + p.base_points, 0);
        const totalEarly = history.reduce((s, p) => s + p.bonus_points, 0);
        const streak = calculateStreakBonus(history);
        const newTotal = totalBase + totalEarly + streak;

        await client.query('UPDATE users SET total_points=$1 WHERE id=$2', [newTotal, uid]);
        await client.query('UPDATE room_members SET points=$1 WHERE user_id=$2', [newTotal, uid]);
      }

      await client.query('COMMIT');

      // Invalidate caches
      await redis.del('leaderboard:global');
      const roomKeys = await redis.keys('leaderboard:room:*');
      if (roomKeys.length) await redis.del(...roomKeys);

      res.json({ message: `Scored ${predsRes.rows.length} predictions for match ${match.id}` });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- API-SPORTS SYNC ---

async function upsertFixture(client, match) {
  return client.query(`
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
    RETURNING (xmax = 0) AS inserted
  `, [match.external_id, match.home_team, match.away_team, match.home_flag, match.away_flag,
      match.stage, match.match_date, match.home_score, match.away_score, match.status]);
}

router.post('/sync-matches', async (req, res) => {
  try {
    const { league = 1, season = 2026 } = req.body;
    const fixtures = await fetchFixtures({ league, season });

    if (!fixtures.length)
      return res.json({ message: 'No se encontraron partidos en la API. Verificá tu plan o cargalos manualmente.', created: 0, updated: 0 });

    let created = 0, updated = 0;
    const client = await pool.connect();
    try {
      for (const f of fixtures) {
        const match = fixtureToMatch(f);
        const result = await upsertFixture(client, match);
        result.rows[0]?.inserted ? created++ : updated++;
      }
    } finally {
      client.release();
    }

    res.json({ message: `Sincronizados ${fixtures.length} partidos: ${created} nuevos, ${updated} actualizados`, created, updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al sincronizar' });
  }
});

router.post('/sync-live', async (req, res) => {
  try {
    const { league = 1 } = req.body;
    const fixtures = await fetchLiveFixtures({ league });

    if (!fixtures.length)
      return res.json({ message: 'No hay partidos en vivo ahora', updated: 0 });

    let updated = 0;
    const client = await pool.connect();
    try {
      for (const f of fixtures) {
        const match = fixtureToMatch(f);
        const result = await client.query(
          'UPDATE matches SET home_score=$1, away_score=$2, status=$3 WHERE external_id=$4 RETURNING id',
          [match.home_score, match.away_score, match.status, match.external_id]
        );
        if (result.rows.length) updated++;
      }
    } finally {
      client.release();
    }

    if (updated > 0) {
      await redis.del('leaderboard:global');
      const roomKeys = await redis.keys('leaderboard:room:*');
      if (roomKeys.length) await redis.del(...roomKeys);
    }

    res.json({ message: `Actualizados ${updated} partidos en vivo`, updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al actualizar en vivo' });
  }
});

// --- USERS ---

router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, role, total_points, created_at FROM users ORDER BY total_points DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
