export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS user_sessions (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    encrypted_session_data TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY,
    access_hash TEXT,
    username TEXT,
    title TEXT NOT NULL,
    photo_url TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    user_id INTEGER REFERENCES users(id),
    channel_id INTEGER REFERENCES channels(id),
    is_active INTEGER DEFAULT 1,
    added_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, channel_id)
  )`,
  `CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS folder_channels (
    folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    channel_id INTEGER REFERENCES channels(id),
    position INTEGER DEFAULT 0,
    PRIMARY KEY (folder_id, channel_id)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER REFERENCES channels(id),
    tg_message_id INTEGER NOT NULL,
    text TEXT,
    media_url TEXT,
    media_type TEXT,
    posted_at TEXT NOT NULL,
    fetched_at TEXT DEFAULT (datetime('now')),
    UNIQUE(channel_id, tg_message_id)
  )`,
  `CREATE TABLE IF NOT EXISTS read_status (
    user_id INTEGER REFERENCES users(id),
    message_id INTEGER REFERENCES messages(id),
    read_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, message_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_messages_posted ON messages(posted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_read_status_user ON read_status(user_id)`,
];
