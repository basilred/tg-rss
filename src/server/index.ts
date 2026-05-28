import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';

import { initDb } from './db';
import { auth } from './api/auth';
import { channels } from './api/channels';
import { subscriptions } from './api/subscriptions';
import { folders } from './api/folders';
import { feed } from './api/feed';
import { read } from './api/read';
import { bot, setupBot } from './bot';
import { startSyncWorker } from './sync/worker';
import { startCleanupWorker } from './sync/cleanup';

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const app = new Hono();

app.use('*', cors());

app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.post('/bot/webhook', async (c) => {
  const body = await c.req.json();
  await bot.handleUpdate(body);
  return c.json({ ok: true });
});

app.route('/api/auth', auth);
app.route('/api/channels', channels);
app.route('/api/subscriptions', subscriptions);
app.route('/api/folders', folders);
app.route('/api/feed', feed);
app.route('/api/messages/read', read);

app.get('*', serveStatic({ root: './dist/web' }));
app.get('*', serveStatic({ path: './dist/web/index.html' }));

initDb();
setupBot(BASE_URL);
startSyncWorker();
startCleanupWorker();

export default {
  port: PORT,
  fetch: app.fetch,
};
