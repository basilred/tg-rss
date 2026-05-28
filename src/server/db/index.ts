import { getDb } from './connection';
import { SCHEMA } from './schema';

export const initDb = (): void => {
  const db = getDb();
  for (const stmt of SCHEMA) {
    db.run(stmt);
  }
};

export { getDb } from './connection';
