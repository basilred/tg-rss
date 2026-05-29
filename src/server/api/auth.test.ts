import { beforeAll, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { Hono } from 'hono';

process.env.BOT_TOKEN = '123456:test-token';
process.env.SERVER_SECRET = 'test-secret-with-enough-entropy';
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'tg-rss-auth-test-'));

const BOT_TOKEN = process.env.BOT_TOKEN;

const signedInitData = (fields: Record<string, string>): string => {
  const checkString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secretKey).update(checkString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
};

let app: Hono;

beforeAll(async () => {
  const [{ initDb }, { auth }] = await Promise.all([
    import('../db'),
    import('./auth'),
  ]);
  initDb();
  app = new Hono().route('/auth', auth);
});

test('Mini App auth returns a token without requiring MTProto session', async () => {
  const initData = signedInitData({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 777, first_name: 'Mini' }),
  });

  const res = await app.request('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ initData }),
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.token).toBeString();
  expect(body.telegramSyncConnected).toBe(false);
  expect(body.needsSession).toBeUndefined();
  expect(body.user).toEqual({ id: 777, firstName: 'Mini' });
});
