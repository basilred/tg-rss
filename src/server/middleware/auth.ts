import type { Context, Next } from 'hono';
import { verifyJwt } from '../auth';

declare module 'hono' {
  interface ContextVariableMap {
    userId: number;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization' }, 401);
  }

  const token = authHeader.slice(7);
  const userId = verifyJwt(token);
  if (userId === null) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('userId', userId);
  await next();
}
