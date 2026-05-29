import { expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { verifyInitData } from './verify';

const BOT_TOKEN = '123456:test-token';

const signedInitData = (fields: Record<string, string>): string => {
  const checkString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secretKey).update(checkString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
};

test('verifyInitData accepts signed initData with a fresh auth_date', () => {
  const initData = signedInitData({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'query-1',
    user: JSON.stringify({ id: 42, first_name: 'Ada', username: 'ada' }),
  });

  expect(verifyInitData(initData, BOT_TOKEN)).toEqual({
    id: 42,
    first_name: 'Ada',
    username: 'ada',
  });
});

test('verifyInitData rejects signed initData with a stale auth_date', () => {
  const initData = signedInitData({
    auth_date: String(Math.floor(Date.now() / 1000) - 86_400),
    query_id: 'query-1',
    user: JSON.stringify({ id: 42, first_name: 'Ada' }),
  });

  expect(verifyInitData(initData, BOT_TOKEN)).toBeNull();
});
