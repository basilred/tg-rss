import { Hono } from 'hono';
import { verifyInitData, createJwt } from '../auth';
import { getDb } from '../db';
import { getClient, getDialogs } from '../mtproto/client';

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

auth.post('/import-channels', async (c) => {
  const { initData } = await c.req.json<{ initData: string }>();
  if (!initData) return c.json({ error: 'Missing initData' }, 400);

  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) return c.json({ error: 'Invalid initData' }, 401);

  const db = getDb();
  const session = db
    .query('SELECT is_active FROM user_sessions WHERE user_id = ?')
    .get(user.id) as { is_active: number } | undefined;

  if (!session?.is_active) {
    return c.json({ error: 'No active session. Send /login to the bot first.' }, 400);
  }

  try {
    const client = getClient(user.id);
    const channels = await getDialogs(client);

    const insertChannel = db.prepare(
      'INSERT OR REPLACE INTO channels (id, username, title, photo_url) VALUES (?, ?, ?, ?)',
    );
    const insertSub = db.prepare(
      'INSERT OR IGNORE INTO subscriptions (user_id, channel_id) VALUES (?, ?)',
    );

    const tx = db.transaction(() => {
      for (const ch of channels) {
        insertChannel.run(ch.id, ch.username, ch.title, ch.photoUrl);
        insertSub.run(user.id, ch.id);
      }
    });

    tx();
    return c.json({ imported: channels.length });
  } catch (err) {
    console.error(`User ${user.id}: import error`, err);
    return c.json({ error: 'Import failed' }, 500);
  }
});

export { auth };
