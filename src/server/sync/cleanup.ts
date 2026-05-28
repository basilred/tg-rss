import { getDb } from '../db';

const CLEANUP_INTERVAL = 3_600_000;

export const startCleanupWorker = (): void => {
  const runCleanup = () => {
    const db = getDb();

    const result = db.run(`
      DELETE FROM messages
      WHERE posted_at < datetime('now', '-30 days')
        AND NOT EXISTS (
          SELECT 1 FROM read_status rs
          JOIN subscriptions s ON s.user_id = rs.user_id
          WHERE rs.message_id = messages.id
            AND s.channel_id = messages.channel_id
        )
    `);

    if (result.changes > 0) {
      console.log(`Cleanup: deleted ${result.changes} old messages`);
    }
  };

  runCleanup();
  setInterval(runCleanup, CLEANUP_INTERVAL);
  console.log('Cleanup worker started');
};
