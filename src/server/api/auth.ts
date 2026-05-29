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

// Store pending login sessions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pendingLogins = new Map<string, { client: any; token: Uint8Array }>();

auth.post('/export-login-token', async (c) => {
  const { initData } = await c.req.json<{ initData: string }>();
  if (!initData) return c.json({ error: 'Missing initData' }, 400);

  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) return c.json({ error: 'Invalid initData' }, 401);

  console.log(`[exportLoginToken] user=${user.id}, starting...`);
  try {
    const { result, client } = await exportLoginToken();
    console.log(`[exportLoginToken] user=${user.id}, success`);

    const tokenKey = Buffer.from(result.token).toString('base64url');
    const token = result.token;
    const userId = user.id;

    // Start background polling — don't await
    const db = getDb();
    db.run('INSERT OR IGNORE INTO users (id) VALUES (?)', [userId]);

    const bgPoll = async () => {
      for (let i = 0; i < 60; i++) {
        try {
          const loginResult = await importLoginToken(client, token, userId);
          console.log(`[bgPoll] user=${userId}: login complete, importing channels...`);

          // Import channels
          try {
            const dialogs = await getDialogs(client);
            const insertChannel = db.prepare(
              'INSERT OR REPLACE INTO channels (id, username, title, photo_url) VALUES (?, ?, ?, ?)',
            );
            const insertSub = db.prepare(
              'INSERT OR IGNORE INTO subscriptions (user_id, channel_id) VALUES (?, ?)',
            );
            const tx = db.transaction(() => {
              for (const ch of dialogs) {
                insertChannel.run(ch.id, ch.username, ch.title, ch.photoUrl);
                insertSub.run(userId, ch.id);
              }
            });
            tx();
            console.log(`[bgPoll] user=${userId}: imported ${dialogs.length} channels`);
          } catch (err) {
            console.error(`[bgPoll] user=${userId}: channel import failed`, err);
          }

          console.log(`[bgPoll] user=${userId}: all done, user_id=${loginResult.user.id}`);
          return;
        } catch (err: unknown) {
          const mtError = err as { error_message?: string };
          if (mtError.error_message === 'AUTH_TOKEN_EXPIRED' || mtError.error_message === 'AUTH_TOKEN_INVALID') {
            console.warn(`[bgPoll] user=${userId}: token expired`);
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      console.warn(`[bgPoll] user=${userId}: timed out`);
    };

    bgPoll(); // fire and forget

    return c.json({ tgLoginUrl: result.tgLoginUrl, expires: result.expires });
  } catch (err) {
    console.error(`[exportLoginToken] user=${user.id} error:`, err);
    return c.json({ error: 'Failed to generate login token' }, 500);
  }
});

auth.post('/import-login-token', async (c) => {
  const { tokenKey, initData } = await c.req.json<{ tokenKey: string; initData: string }>();
  if (!initData || !tokenKey) return c.json({ error: 'Missing data' }, 400);

  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) return c.json({ error: 'Invalid initData' }, 401);

  const pending = pendingLogins.get(tokenKey);
  if (!pending) return c.json({ error: 'Token expired or not found' }, 404);

  // Poll on server side for up to 60 seconds
  for (let i = 0; i < 30; i++) {
    try {
      const result = await importLoginToken(pending.client, pending.token, user.id);
      pendingLogins.delete(tokenKey);

      const db = getDb();
      db.run('INSERT OR IGNORE INTO users (id) VALUES (?)', [user.id]);

      return c.json({ ok: true, userId: result.user.id });
    } catch (err: unknown) {
      const mtError = err as { error_message?: string };
      if (mtError.error_message === 'AUTH_TOKEN_EXPIRED' || mtError.error_message === 'AUTH_TOKEN_INVALID') {
        pendingLogins.delete(tokenKey);
        return c.json({ error: 'Token expired. Try again.' }, 400);
      }
      // Token not yet accepted, keep polling
      console.log(`[importLoginToken] user=${user.id}, waiting... (${i})`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  pendingLogins.delete(tokenKey);
  return c.json({ error: 'Login not accepted. Please confirm in Telegram.' }, 400);
});

auth.post('/import-channels', async (c) => {
  const { initData } = await c.req.json<{ initData: string }>();
  if (!initData) return c.json({ error: 'Missing initData' }, 400);

  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) return c.json({ error: 'Invalid initData' }, 401);

  const userId = user.id;
  const db = getDb();

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
