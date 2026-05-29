import { beforeAll, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';

process.env.SERVER_SECRET = 'test-secret-with-enough-entropy';
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'tg-rss-read-test-'));

let app: Hono;
let tokenForUser: string;

beforeAll(async () => {
  const [{ initDb, getDb }, { read }, { createJwt }] = await Promise.all([
    import('../db'),
    import('./read'),
    import('../auth'),
  ]);
  initDb();

  const db = getDb();
  db.run('INSERT INTO users (id) VALUES (7001)');
  db.run("INSERT INTO channels (id, title) VALUES (7010, 'Subscribed'), (7011, 'Other')");
  db.run('INSERT INTO subscriptions (user_id, channel_id) VALUES (7001, 7010)');
  db.run(
    `INSERT INTO messages (id, channel_id, tg_message_id, text, posted_at)
     VALUES
       (7100, 7010, 1, 'subscribed message', datetime('now')),
       (7101, 7011, 1, 'other message', datetime('now'))`,
  );

  tokenForUser = createJwt(7001);
  app = new Hono().route('/messages/read', read);
});

test('read API marks only messages from active subscriptions', async () => {
  const res = await app.request('/messages/read', {
    method: 'POST',
    body: JSON.stringify({ messageIds: [7100, 7101] }),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenForUser}`,
    },
  });

  const { getDb } = await import('../db');
  const rows = getDb()
    .query('SELECT message_id FROM read_status WHERE user_id = 7001 ORDER BY message_id')
    .all() as Array<{ message_id: number }>;

  expect(res.status).toBe(200);
  expect(rows.map((row) => row.message_id)).toEqual([7100]);
});
