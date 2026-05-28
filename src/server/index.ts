import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { initDb } from './db';

const PORT = Number(process.env.PORT) || 3000;

const app = new Hono();

app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.get('*', serveStatic({ root: './dist/web' }));
app.get('*', serveStatic({ path: './dist/web/index.html' }));

initDb();

export default {
  port: PORT,
  fetch: app.fetch,
};
