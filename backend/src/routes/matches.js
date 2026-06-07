const express = require('express');
const pool = require('../config/db');
const redis = require('../config/redis');
const { authMiddleware } = require('../middleware/auth');
const { analyzeMatch } = require('../services/gemini');

const router = express.Router();

router.get('/recent-public', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, home_team, away_team, home_flag, away_flag, stage, home_score, away_score, status, match_date
       FROM matches
       WHERE status = 'finished' AND home_score IS NOT NULL
       ORDER BY match_date DESC
       LIMIT 2`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM matches';
    const params = [];
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      query += ` WHERE status = ANY($1)`;
      params.push(statuses);
    }
    query += ' ORDER BY match_date ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/trends', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;

    const topRes = await pool.query(`
      SELECT home_score, away_score, COUNT(*) AS cnt
      FROM predictions
      WHERE match_id = $1
      GROUP BY home_score, away_score
      ORDER BY cnt DESC
      LIMIT 6
    `, [id]);

    const recentRes = await pool.query(`
      SELECT u.username, p.home_score, p.away_score, p.created_at
      FROM predictions p
      JOIN users u ON p.user_id = u.id
      WHERE p.match_id = $1
      ORDER BY p.created_at DESC
      LIMIT 6
    `, [id]);

    const total = topRes.rows.reduce((s, r) => s + parseInt(r.cnt), 0);

    const trends = topRes.rows.map(r => ({
      score: `${r.home_score}-${r.away_score}`,
      home: r.home_score,
      away: r.away_score,
      count: parseInt(r.cnt),
      pct: total > 0 ? Math.round((parseInt(r.cnt) / total) * 100) : 0,
    }));

    // winner tendency
    let homeWins = 0, draws = 0, awayWins = 0;
    topRes.rows.forEach(r => {
      const c = parseInt(r.cnt);
      if (r.home_score > r.away_score) homeWins += c;
      else if (r.home_score === r.away_score) draws += c;
      else awayWins += c;
    });

    res.json({
      trends,
      total,
      winner: { home: homeWins, draw: draws, away: awayWins },
      recent: recentRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Match not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/analysis', authMiddleware, async (req, res) => {
  try {
    const cacheKey = `analysis:match:${req.params.id}`;

    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ analysis: cached });

    const result = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Match not found' });

    const match = result.rows[0];
    const analysis = await analyzeMatch(match);

    // Partidos finalizados → cache 24h. Live/upcoming → cache 1h.
    const ttl = match.status === 'finished' ? 86400 : 3600;
    await redis.setex(cacheKey, ttl, analysis);

    res.json({ analysis });
  } catch (err) {
    console.error('[Gemini]', err.message);
    res.status(500).json({ error: 'No se pudo generar el análisis. Intentá de nuevo.' });
  }
});

module.exports = router;
