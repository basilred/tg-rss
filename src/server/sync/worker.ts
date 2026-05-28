import { getDb } from '../db';
import { getClient } from '../mtproto';

const ACTIVE_INTERVAL = 30_000;
const INACTIVE_INTERVAL = 300_000;

let isRunning = false;

const syncUser = async (userId: number): Promise<void> => {
  const db = getDb();

  const subs = db
    .query(
      `SELECT channel_id FROM subscriptions
       WHERE user_id = ? AND is_active = 1`,
    )
    .all(userId) as { channel_id: number }[];

  if (subs.length === 0) return;

  const client = getClient(userId);

  for (const { channel_id } of subs) {
    try {
      const result = await client.call('messages.getHistory', {
        peer: {
          _: 'inputPeerChannel',
          channel_id: Math.abs(channel_id),
          access_hash: 0,
        },
        offset_id: 0,
        limit: 20,
      });

      if (!result?.messages) continue;

      const insert = db.prepare(
        `INSERT OR IGNORE INTO messages
         (channel_id, tg_message_id, text, media_url, media_type, posted_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );

      const batch = db.transaction(() => {
        for (const msg of result.messages) {
          if (msg._ === 'message' || msg._ === 'messageService') {
            insert.run(
              channel_id,
              msg.id,
              msg.message || null,
              null,
              'none',
              new Date(msg.date * 1000).toISOString(),
            );
          }
        }
      });

      batch();
    } catch (err: unknown) {
      const error = err as Error & { error_message?: string };
      if (error?.error_message?.includes('AUTH_KEY')) {
        db.run('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?', [
          userId,
        ]);
        console.warn(`User ${userId}: MTProto session expired`);
        return;
      }
      console.warn(`User ${userId}, channel ${channel_id}: sync error`, error.message);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

export const startSyncWorker = (): void => {
  if (isRunning) return;
  isRunning = true;

  const tick = async () => {
    const db = getDb();
    const users = db
      .query('SELECT user_id FROM user_sessions WHERE is_active = 1')
      .all() as { user_id: number }[];

    for (const { user_id } of users) {
      await syncUser(user_id);
    }
  };

  tick();
  setInterval(tick, ACTIVE_INTERVAL);
  console.log('Sync worker started');
};
