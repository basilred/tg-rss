import { Hono } from 'hono';
import { verifyInitData, createJwt } from '../auth';
import { getDb } from '../db';

const BOT_TOKEN = process.env.BOT_TOKEN || '';

const auth = new Hono();

auth.post('/verify', async (c) => {
  const { initData } = await c.req.json<{ initData: string }>();
  if (!initData) {
    return c.json({ error: 'Missing initData' }, 400);
  }

  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) {
    return c.json({ error: 'Invalid initData' }, 401);
  }

  const db = getDb();
  db.run('INSERT OR IGNORE INTO users (id) VALUES (?)', [user.id]);

  const session = db
    .query('SELECT is_active FROM user_sessions WHERE user_id = ?')
    .get(user.id) as { is_active: number } | undefined;

  if (!session || !session.is_active) {
    return c.json({ needsSession: true });
  }

  const token = createJwt(user.id);
  return c.json({ token });
});

export { auth };
