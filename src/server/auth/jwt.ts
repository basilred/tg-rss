import { createHmac } from 'node:crypto';

const SECRET = process.env.SERVER_SECRET || 'dev-secret-change-me';
const TTL = 24 * 60 * 60 * 1000; // 24 hours

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
  if (sign(`${header}.${payload}`) !== signature) return null;

  const data = JSON.parse(base64UrlDecode(payload));
  if (data.exp < Date.now()) return null;

  return data.sub;
};
