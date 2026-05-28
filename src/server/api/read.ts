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
    'INSERT OR IGNORE INTO read_status (user_id, message_id) VALUES (?, ?)',
  );

  const batch = db.transaction(() => {
    for (const msgId of messageIds) {
      insert.run(userId, msgId);
    }
  });

  batch();

  return c.json({ ok: true });
});

export { read };
