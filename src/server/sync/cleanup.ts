import { getDb } from '../db';

const CLEANUP_INTERVAL = 3_600_000;

export const cleanupOldMessages = (): number => {
  const db = getDb();

  const rows = db
    .query(`
    SELECT id FROM messages
    WHERE posted_at < datetime('now', '-30 days')
      AND EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.channel_id = messages.channel_id
          AND s.is_active = 1
      )
      AND NOT EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.channel_id = messages.channel_id
          AND s.is_active = 1
          AND NOT EXISTS (
            SELECT 1 FROM read_status rs
            WHERE rs.user_id = s.user_id
              AND rs.message_id = messages.id
          )
      )
  `)
    .all() as Array<{ id: number }>;

  if (rows.length === 0) {
    return 0;
  }

  const deleteReadStatus = db.prepare('DELETE FROM read_status WHERE message_id = ?');
  const deleteMessage = db.prepare('DELETE FROM messages WHERE id = ?');

  const tx = db.transaction(() => {
    for (const row of rows) {
      deleteReadStatus.run(row.id);
      deleteMessage.run(row.id);
    }
  });
  tx();

  return rows.length;
};

export const startCleanupWorker = (): void => {
  const runCleanup = () => {
    const deleted = cleanupOldMessages();

    if (deleted > 0) {
      console.log(`Cleanup: deleted ${deleted} old messages`);
    }
  };

  runCleanup();
  setInterval(runCleanup, CLEANUP_INTERVAL);
  console.log('Cleanup worker started');
};
