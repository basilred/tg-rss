import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.SERVER_SECRET;
const TTL = 24 * 60 * 60 * 1000; // 24 hours

if (!SECRET) {
  throw new Error('SERVER_SECRET environment variable is required');
}

const base64UrlEncode = (data: string): string =>
  Buffer.from(data).toString('base64url');

const base64UrlDecode = (data: string): string =>
  Buffer.from(data, 'base64url').toString();

const sign = (data: string): string =>
  createHmac('sha256', SECRET).update(data).digest('base64url');

export const createJwt = (userId: number): string => {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({ sub: userId, exp: Date.now() + TTL }),
  );
  const signature = sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
};

export const verifyJwt = (token: string): number | null => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  let data: { sub?: unknown; exp?: unknown };
  try {
    data = JSON.parse(base64UrlDecode(payload)) as { sub?: unknown; exp?: unknown };
  } catch {
    return null;
  }

  if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
  if (typeof data.sub !== 'number') return null;

  return data.sub;
};
