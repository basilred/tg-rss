import { expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'tg-rss-schema-test-'));

test('channels table stores MTProto access hash for sync', async () => {
  const { initDb, getDb } = await import('./index');
  initDb();

  const columns = getDb()
    .query('PRAGMA table_info(channels)')
    .all() as Array<{ name: string }>;

  expect(columns.map((column) => column.name)).toContain('access_hash');
});
