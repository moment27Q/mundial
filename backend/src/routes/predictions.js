const express = require('express');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All predictions for the current user (with match info)
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.*,
        m.home_team, m.away_team, m.home_flag, m.away_flag,
        m.match_date, m.status, m.stage,
        m.home_score AS actual_home,
        m.away_score AS actual_away
      FROM predictions p
      JOIN matches m ON p.match_id = m.id
      WHERE p.user_id = $1
      ORDER BY m.match_date ASC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create or update a prediction
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { match_id, home_score, away_score } = req.body;

    if (!match_id || home_score === undefined || away_score === undefined)
      return res.status(400).json({ error: 'match_id, home_score and away_score are required' });

    if (Number(home_score) < 0 || Number(away_score) < 0)
      return res.status(400).json({ error: 'Scores cannot be negative' });

    const matchRes = await pool.query('SELECT * FROM matches WHERE id = $1', [match_id]);
    const match = matchRes.rows[0];
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const now = new Date();
    const matchDate = new Date(match.match_date);
    const minutesLeft = (matchDate - now) / 60000;

    if (match.status !== 'upcoming' || minutesLeft < 10)
      return res.status(400).json({ error: 'Predictions are closed for this match (less than 10 minutes to kickoff)' });

    const result = await pool.query(`
      INSERT INTO predictions (user_id, match_id, home_score, away_score)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, match_id) DO UPDATE
        SET home_score = $3, away_score = $4, scored = FALSE, created_at = NOW()
      RETURNING *
    `, [req.user.id, match_id, Number(home_score), Number(away_score)]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
