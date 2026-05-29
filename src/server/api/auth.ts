import { Hono } from 'hono';
import { verifyInitData, createJwt } from '../auth';
import { getDb } from '../db';
import { authMiddleware } from '../middleware/auth';

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

  const token = createJwt(user.id);
  return c.json({
    token,
    telegramSyncConnected: session?.is_active === 1,
    user: {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
    },
  });
});

auth.get('/status', authMiddleware, (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const session = db
    .query('SELECT is_active FROM user_sessions WHERE user_id = ?')
    .get(userId) as { is_active: number } | undefined;

  return c.json({ telegramSyncConnected: session?.is_active === 1 });
});

export { auth };
