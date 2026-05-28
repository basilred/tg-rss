import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { initDb } from './db';
import { auth } from './api/auth';
import { channels } from './api/channels';
import { subscriptions } from './api/subscriptions';
import { folders } from './api/folders';
import { feed } from './api/feed';
import { read } from './api/read';

const PORT = Number(process.env.PORT) || 3000;

const app = new Hono();

app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.route('/api/auth', auth);
app.route('/api/channels', channels);
app.route('/api/subscriptions', subscriptions);
app.route('/api/folders', folders);
app.route('/api/feed', feed);
app.route('/api/messages/read', read);

app.get('*', serveStatic({ root: './dist/web' }));
app.get('*', serveStatic({ path: './dist/web/index.html' }));

initDb();

export default {
  port: PORT,
  fetch: app.fetch,
};
