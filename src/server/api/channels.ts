import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getDb } from '../db';

const channels = new Hono();
channels.use('*', authMiddleware);

channels.get('/search', (c) => {
  const q = c.req.query('q') || '';
  if (q.length < 2) {
    return c.json([]);
  }

  const db = getDb();
  const results = db
    .query(
      `SELECT id, username, title, photo_url
       FROM channels
       WHERE username LIKE ? OR title LIKE ?
       LIMIT 20`,
    )
    .all(`%${q}%`, `%${q}%`);

  return c.json(results);
});

export { channels };
