const express = require('express');
const pool = require('../config/db');
const redis = require('../config/redis');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const CACHE_TTL = 60;

// Global leaderboard (top 50)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const cached = await redis.get('leaderboard:global');
    if (cached) return res.json(JSON.parse(cached));

    const result = await pool.query(`
      SELECT id, username, total_points,
             RANK() OVER (ORDER BY total_points DESC) AS rank
      FROM users
      WHERE role != 'admin'
      ORDER BY total_points DESC
      LIMIT 50
    `);

    await redis.setex('leaderboard:global', CACHE_TTL, JSON.stringify(result.rows));
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Room leaderboard
router.get('/room/:id', authMiddleware, async (req, res) => {
  try {
    const memberCheck = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!memberCheck.rows.length) return res.status(403).json({ error: 'Not a member of this room' });

    const cacheKey = `leaderboard:room:${req.params.id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const result = await pool.query(`
      SELECT u.id, u.username, rm.points,
             RANK() OVER (ORDER BY rm.points DESC) AS rank
      FROM room_members rm
      JOIN users u ON rm.user_id = u.id
      WHERE rm.room_id = $1
      ORDER BY rm.points DESC
    `, [req.params.id]);

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result.rows));
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// User rank in global leaderboard
router.get('/rank/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rank FROM (
        SELECT id, RANK() OVER (ORDER BY total_points DESC) AS rank
        FROM users WHERE role != 'admin'
      ) ranked
      WHERE id = $1
    `, [req.user.id]);
    res.json({ rank: result.rows[0]?.rank || null });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
