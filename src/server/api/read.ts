import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getDb } from '../db';

const read = new Hono();
read.use('*', authMiddleware);

read.post('/', async (c) => {
  const userId = c.get('userId');
  const { messageIds } = await c.req.json<{ messageIds: number[] }>();

  if (!messageIds?.length) {
    return c.json({ ok: true });
  }

  const db = getDb();

  const insert = db.prepare(
    `INSERT OR IGNORE INTO read_status (user_id, message_id)
     SELECT ?, ?
     WHERE EXISTS (
       SELECT 1
       FROM messages m
       JOIN subscriptions s ON s.channel_id = m.channel_id
       WHERE m.id = ?
         AND s.user_id = ?
         AND s.is_active = 1
     )`,
  );

  const batch = db.transaction(() => {
    for (const msgId of messageIds) {
      insert.run(userId, msgId, msgId, userId);
    }
  });

  batch();

  return c.json({ ok: true });
});

export { read };
