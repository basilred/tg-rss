import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getDb } from '../db';

const folders = new Hono();
folders.use('*', authMiddleware);

folders.get('/', (c) => {
  const userId = c.get('userId');
  const db = getDb();

  const rows = db
    .query(
      `SELECT f.id, f.name,
              GROUP_CONCAT(fc.channel_id) as channel_ids
       FROM folders f
       LEFT JOIN folder_channels fc ON fc.folder_id = f.id
       WHERE f.user_id = ?
       GROUP BY f.id
       ORDER BY f.position`,
    )
    .all(userId);

  return c.json(rows);
});

folders.post('/', async (c) => {
  const userId = c.get('userId');
  const { name } = await c.req.json<{ name: string }>();
  const db = getDb();

  const { id } = db
    .query('INSERT INTO folders (user_id, name) VALUES (?, ?) RETURNING id')
    .get(userId, name) as { id: number };

  return c.json({ id, name, channel_ids: '' });
});

folders.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const folderId = Number(c.req.param('id'));
  const { name } = await c.req.json<{ name: string }>();
  const db = getDb();

  db.run('UPDATE folders SET name = ? WHERE id = ? AND user_id = ?', [
    name,
    folderId,
    userId,
  ]);

  return c.json({ ok: true });
});

folders.delete('/:id', (c) => {
  const userId = c.get('userId');
  const folderId = Number(c.req.param('id'));
  const db = getDb();

  db.run('DELETE FROM folders WHERE id = ? AND user_id = ?', [folderId, userId]);

  return c.json({ ok: true });
});

folders.post('/:id/channels', async (c) => {
  const userId = c.get('userId');
  const folderId = Number(c.req.param('id'));
  const { channelId } = await c.req.json<{ channelId: number }>();
  const db = getDb();

  const folder = db
    .query('SELECT id FROM folders WHERE id = ? AND user_id = ?')
    .get(folderId, userId);
  if (!folder) {
    return c.json({ error: 'Folder not found' }, 404);
  }

  db.run(
    'INSERT OR REPLACE INTO folder_channels (folder_id, channel_id) VALUES (?, ?)',
    [folderId, channelId],
  );

  return c.json({ ok: true });
});

folders.delete('/:id/channels/:channelId', (c) => {
  const userId = c.get('userId');
  const folderId = Number(c.req.param('id'));
  const channelId = Number(c.req.param('channelId'));
  const db = getDb();

  const folder = db
    .query('SELECT id FROM folders WHERE id = ? AND user_id = ?')
    .get(folderId, userId);
  if (!folder) {
    return c.json({ error: 'Folder not found' }, 404);
  }

  db.run('DELETE FROM folder_channels WHERE folder_id = ? AND channel_id = ?', [
    folderId,
    channelId,
  ]);

  return c.json({ ok: true });
});

export { folders };
