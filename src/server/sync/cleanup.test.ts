import { expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'tg-rss-cleanup-test-'));

test('cleanup keeps old messages until every active subscriber has read them', async () => {
  const [{ initDb, getDb }, { cleanupOldMessages }] = await Promise.all([
    import('../db'),
    import('./cleanup'),
  ]);
  initDb();

  const db = getDb();
  db.run('INSERT INTO users (id) VALUES (9001), (9002)');
  db.run("INSERT INTO channels (id, title) VALUES (9010, 'News')");
  db.run('INSERT INTO subscriptions (user_id, channel_id) VALUES (9001, 9010), (9002, 9010)');
  db.run(
    `INSERT INTO messages (id, channel_id, tg_message_id, text, posted_at)
     VALUES
       (9100, 9010, 9100, 'read by one user', datetime('now', '-31 days')),
       (9101, 9010, 9101, 'read by all users', datetime('now', '-31 days'))`,
  );
  db.run('INSERT INTO read_status (user_id, message_id) VALUES (9001, 9100)');
  db.run('INSERT INTO read_status (user_id, message_id) VALUES (9001, 9101), (9002, 9101)');

  const deleted = cleanupOldMessages();
  const remaining = db
    .query('SELECT id FROM messages ORDER BY id')
    .all() as Array<{ id: number }>;

  expect(deleted).toBe(1);
  expect(remaining.map((row) => row.id)).toContain(9100);
  expect(remaining.map((row) => row.id)).not.toContain(9101);
});
