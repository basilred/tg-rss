import { getDb } from './connection';
import { SCHEMA } from './schema';

export const initDb = (): void => {
  const db = getDb();
  for (const stmt of SCHEMA) {
    db.run(stmt);
  }

  const channelColumns = db
    .query('PRAGMA table_info(channels)')
    .all() as Array<{ name: string }>;
  if (!channelColumns.some((column) => column.name === 'access_hash')) {
    db.run('ALTER TABLE channels ADD COLUMN access_hash TEXT');
  }
};

export { getDb } from './connection';
