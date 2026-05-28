import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { initDb } from './db';
import { auth } from './api/auth';
import { channels } from './api/channels';
import { subscriptions } from './api/subscriptions';
import { folders } from './api/folders';
import { feed } from './api/feed';
import { read } from './api/read';
import { startSyncWorker } from './sync/worker';
import { startCleanupWorker } from './sync/cleanup';
import { bot, setupBot } from './bot';

const PORT = Number(process.env.PORT) || 3000;

const app = new Hono();

app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.route('/api/auth', auth);
app.route('/api/channels', channels);
app.route('/api/subscriptions', subscriptions);
app.route('/api/folders', folders);
app.route('/api/feed', feed);
app.route('/api/messages/read', read);

app.post('/bot/webhook', async (c) => {
  const body = await c.req.json();
  await bot.handleUpdate(body);
  return c.json({ ok: true });
});

app.get('*', serveStatic({ root: './dist/web' }));
app.get('*', serveStatic({ path: './dist/web/index.html' }));

initDb();

const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
setupBot(BASE_URL);
startSyncWorker();
startCleanupWorker();

export default {
  port: PORT,
  fetch: app.fetch,
};
