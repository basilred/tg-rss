import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getDb } from '../db';

const subscriptions = new Hono();
subscriptions.use('*', authMiddleware);

subscriptions.get('/', (c) => {
  const userId = c.get('userId');
  const db = getDb();

  const subs = db
    .query(
      `SELECT c.id, c.username, c.title, c.photo_url, s.added_at,
              GROUP_CONCAT(fc.folder_id) as folder_ids
       FROM subscriptions s
       JOIN channels c ON c.id = s.channel_id
       LEFT JOIN folder_channels fc ON fc.channel_id = c.id
       WHERE s.user_id = ? AND s.is_active = 1
       GROUP BY c.id`,
    )
    .all(userId);

  return c.json(subs);
});

subscriptions.post('/', async (c) => {
  const userId = c.get('userId');
  const { channelId } = await c.req.json<{ channelId: number }>();
  const db = getDb();

  db.run(
    'INSERT OR REPLACE INTO subscriptions (user_id, channel_id) VALUES (?, ?)',
    [userId, channelId],
  );

  return c.json({ ok: true });
});

subscriptions.delete('/:channelId', (c) => {
  const userId = c.get('userId');
  const channelId = Number(c.req.param('channelId'));
  const db = getDb();

  db.run('UPDATE subscriptions SET is_active = 0 WHERE user_id = ? AND channel_id = ?', [
    userId,
    channelId,
  ]);

  return c.json({ ok: true });
});

export { subscriptions };
