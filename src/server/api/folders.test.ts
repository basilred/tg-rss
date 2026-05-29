import { beforeAll, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';

process.env.SERVER_SECRET = 'test-secret-with-enough-entropy';
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'tg-rss-folders-test-'));

let app: Hono;
let tokenForUserTwo: string;

beforeAll(async () => {
  const [{ initDb, getDb }, { folders }, { createJwt }] = await Promise.all([
    import('../db'),
    import('./folders'),
    import('../auth'),
  ]);
  initDb();

  const db = getDb();
  db.run('INSERT INTO users (id) VALUES (1), (2)');
  db.run("INSERT INTO channels (id, username, title) VALUES (100, 'news', 'News')");
  db.run("INSERT INTO folders (id, user_id, name) VALUES (10, 1, 'User 1 folder')");
  db.run('INSERT INTO folder_channels (folder_id, channel_id) VALUES (10, 100)');

  tokenForUserTwo = createJwt(2);
  app = new Hono().route('/folders', folders);
});

test('user cannot add a channel to another user folder', async () => {
  const res = await app.request('/folders/10/channels', {
    method: 'POST',
    body: JSON.stringify({ channelId: 100 }),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenForUserTwo}`,
    },
  });
  const { getDb } = await import('../db');
  const row = getDb()
    .query('SELECT COUNT(*) as count FROM folder_channels WHERE folder_id = 10')
    .get() as { count: number };

  expect(res.status).toBe(404);
  expect(row.count).toBe(1);
});

test('user cannot remove a channel from another user folder', async () => {
  const res = await app.request('/folders/10/channels/100', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${tokenForUserTwo}`,
    },
  });
  const { getDb } = await import('../db');
  const row = getDb()
    .query('SELECT COUNT(*) as count FROM folder_channels WHERE folder_id = 10 AND channel_id = 100')
    .get() as { count: number };

  expect(res.status).toBe(404);
  expect(row.count).toBe(1);
});
