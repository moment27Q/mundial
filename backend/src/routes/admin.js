const express = require('express');
const pool = require('../config/db');
const redis = require('../config/redis');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { calculateBasePoints, calculateStreakBonus } = require('../services/scoring');

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
