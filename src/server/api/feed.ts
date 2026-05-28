import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getDb } from '../db';

const feed = new Hono();
feed.use('*', authMiddleware);

feed.get('/', (c) => {
  const userId = c.get('userId');
  const sort = c.req.query('sort') === 'desc' ? 'DESC' : 'ASC';
  const folderId = c.req.query('folder');
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit')) || 30, 100);

  const db = getDb();
  const params: (string | number)[] = [userId];

  let channelFilter = '';
  if (folderId) {
    channelFilter =
      'AND m.channel_id IN (SELECT channel_id FROM folder_channels WHERE folder_id = ?)';
    params.push(Number(folderId));
  } else {
    channelFilter =
      'AND m.channel_id IN (SELECT channel_id FROM subscriptions WHERE user_id = ? AND is_active = 1)';
    params.push(userId);
  }

  const cursorCond =
    sort === 'ASC' && cursor
      ? 'AND m.posted_at > ?'
      : sort === 'DESC' && cursor
        ? 'AND m.posted_at < ?'
        : '';

  if (cursor) {
    params.push(cursor);
  }

  const orderDirection = sort === 'ASC' ? 'ASC' : 'DESC';

  const rows = db
    .query(
      `SELECT m.id, m.channel_id, m.text, m.media_url, m.media_type, m.posted_at,
              c.username as channel_username, c.title as channel_title, c.photo_url as channel_photo,
              CASE WHEN rs.user_id IS NOT NULL THEN 1 ELSE 0 END as is_read
       FROM messages m
       JOIN channels c ON c.id = m.channel_id
       LEFT JOIN read_status rs ON rs.message_id = m.id AND rs.user_id = ?
       WHERE 1=1 ${channelFilter} ${cursorCond}
       ORDER BY m.posted_at ${orderDirection}
       LIMIT ?`,
    )
    .all(...params, limit + 1) as Array<{
    id: number;
    channel_id: number;
    text: string | null;
    media_url: string | null;
    media_type: string | null;
    posted_at: string;
    channel_username: string | null;
    channel_title: string;
    channel_photo: string | null;
    is_read: number;
  }>;

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  const result = {
    items: items.map((row) => ({
      message: {
        id: row.id,
        channelId: row.channel_id,
        text: row.text,
        mediaUrl: row.media_url,
        mediaType: row.media_type,
        postedAt: row.posted_at,
      },
      channel: {
        id: row.channel_id,
        username: row.channel_username,
        title: row.channel_title,
        photoUrl: row.channel_photo,
      },
      isRead: row.is_read === 1,
    })),
    nextCursor: hasMore ? items[items.length - 1].posted_at : null,
  };

  return c.json(result);
});

export { feed };
