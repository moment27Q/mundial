const express = require('express');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Rooms where the current user is a member
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, u.username AS owner_name,
             (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) AS member_count,
             rm.points AS my_points
      FROM rooms r
      JOIN room_members rm ON r.id = rm.room_id AND rm.user_id = $1
      JOIN users u ON r.owner_id = u.id
      ORDER BY r.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a room
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Room name is required' });

    const code = generateCode();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const roomRes = await client.query(
        'INSERT INTO rooms (name, code, owner_id, description) VALUES ($1, $2, $3, $4) RETURNING *',
        [name.trim(), code, req.user.id, description || null]
      );
      const room = roomRes.rows[0];
      await client.query('INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)', [room.id, req.user.id]);
      await client.query('COMMIT');
      res.status(201).json({ ...room, member_count: 1, owner_name: req.user.username });
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

// Join a room by code
router.post('/join', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Room code is required' });

    const roomRes = await pool.query('SELECT * FROM rooms WHERE code = $1', [code.toUpperCase().trim()]);
    if (!roomRes.rows.length) return res.status(404).json({ error: 'Room not found. Check the code and try again.' });

    const room = roomRes.rows[0];
    await pool.query(
      'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [room.id, req.user.id]
    );
    res.json({ message: 'Joined room successfully', room });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Room detail (only members can view)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const memberCheck = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!memberCheck.rows.length) return res.status(403).json({ error: 'You are not a member of this room' });

    const roomRes = await pool.query(
      'SELECT r.*, u.username AS owner_name FROM rooms r JOIN users u ON r.owner_id = u.id WHERE r.id = $1',
      [req.params.id]
    );
    if (!roomRes.rows.length) return res.status(404).json({ error: 'Room not found' });

    const membersRes = await pool.query(`
      SELECT u.id, u.username, rm.points, rm.joined_at,
             RANK() OVER (ORDER BY rm.points DESC) AS rank
      FROM room_members rm
      JOIN users u ON rm.user_id = u.id
      WHERE rm.room_id = $1
      ORDER BY rm.points DESC
    `, [req.params.id]);

    res.json({ ...roomRes.rows[0], members: membersRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Leave a room
router.delete('/:id/leave', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM room_members WHERE room_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Left room' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
