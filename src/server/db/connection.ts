import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';

const DATA_DIR = process.env.DATA_DIR || './data';

let db: Database | null = null;

export const getDb = (): Database => {
  if (!db) {
    mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(`${DATA_DIR}/tg-rss.db`);
    db.run('PRAGMA journal_mode=WAL');
    db.run('PRAGMA foreign_keys=ON');
  }
  return db;
};
