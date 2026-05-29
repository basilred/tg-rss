import { Hono } from 'hono';
import { verifyInitData, createJwt } from '../auth';
import { getDb } from '../db';
import { exportLoginToken, importLoginToken, getDialogs } from '../mtproto/client';
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

  console.log(`[verify] user=${user.id}, session=${JSON.stringify(session)}`);

  if (!session || !session.is_active) {
    console.log(`[verify] user=${user.id}: needsSession`);
    return c.json({ needsSession: true });
  }

  console.log(`[verify] user=${user.id}: returning token`);
  const token = createJwt(user.id);
  return c.json({ token });
});

// Store pending login tokens in memory
const pendingTokens = new Map<string, Uint8Array>();

auth.post('/export-login-token', authMiddleware, async (c) => {
  try {
    const result = await exportLoginToken();
    const tokenKey = Buffer.from(result.token).toString('base64url');
    pendingTokens.set(tokenKey, result.token);

    // Auto-expire after 5 minutes
    setTimeout(() => pendingTokens.delete(tokenKey), 300_000);

    return c.json({
      tgLoginUrl: result.tgLoginUrl,
      tokenKey,
      expires: result.expires,
    });
  } catch (err) {
    console.error('exportLoginToken error:', err);
    return c.json({ error: 'Failed to generate login token' }, 500);
  }
});

auth.post('/import-login-token', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { tokenKey } = await c.req.json<{ tokenKey: string }>();

  const token = pendingTokens.get(tokenKey);
  if (!token) {
    return c.json({ error: 'Token expired or not found' }, 404);
  }

  try {
    const result = await importLoginToken(token);
    pendingTokens.delete(tokenKey);

    const db = getDb();
    db.run('INSERT OR IGNORE INTO users (id) VALUES (?)', [result.user.id]);

    return c.json({ ok: true, userId: result.user.id });
  } catch (err) {
    console.error('importLoginToken error:', err);
    return c.json({ error: 'Login not accepted yet or failed' }, 400);
  }
});

auth.post('/import-channels', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = getDb();

  const session = db
    .query('SELECT is_active FROM user_sessions WHERE user_id = ?')
    .get(userId) as { is_active: number } | undefined;

  if (!session?.is_active) {
    return c.json({ error: 'No active session. Connect first.' }, 400);
  }

  try {
    const { getClient } = await import('../mtproto/client');
    const client = getClient(userId);
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
        insertSub.run(userId, ch.id);
      }
    });

    tx();

    return c.json({ imported: channels.length });
  } catch (err) {
    console.error(`User ${userId}: import error`, err);
    return c.json({ error: 'Import failed' }, 500);
  }
});

export { auth };
