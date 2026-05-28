# TG-RSS — Design Specification

## Overview

RSS-feed-like лента из Telegram-подписок пользователя. Строгий хронологический порядок с возможностью переключения asc/desc. При скролле просмотренные сообщения помечаются прочитанными в самом Telegram через MTProto API. Telegram Mini App с веб-версией.

## Key Decisions

| Решение | Выбор |
|---------|-------|
| Форм-фактор | Telegram Mini App + Web |
| Стек | Bun + Hono + React (Vite) |
| БД | bun:sqlite (файловая, персистентная) |
| Аутентификация | initData от Telegram Mini App |
| Синхронизация | MTProto client API (двусторонняя) |
| Деплой | Docker на Raspberry Pi |
| Пользователи | До 10 человек |

---

## 1. Architecture

Monolithic process — один Bun-процесс, внутри которого Hono обслуживает всё: REST API, статику React SPA, вебхук Telegram бота, MTProto-клиент для синхронизации.

```
[Browser / Telegram WebView] → [Hono Server :3000]
                                  ├── /api/*          (REST API)
                                  ├── /               (React SPA)
                                  ├── /bot/webhook    (Telegram Bot)
                                  └── sync loop       (MTProto client, setInterval)
                                            ↓
                                       [bun:sqlite]
```

### Libraries

- `hono` — web framework
- `grammY` — Telegram Bot API framework
- `@mtproto/core` или `gramjs` — MTProto client for user-level API
- `react` + `vite` — frontend
- `@tanstack/react-query` — server state management
- `zustand` — UI state management
- `bun:sqlite` — embedded database

---

## 2. Data Model

```sql
-- Users (login via Mini App initData)
CREATE TABLE users (
  id            INTEGER PRIMARY KEY, -- telegram user id
  created_at    TEXT DEFAULT (datetime('now'))
);

-- MTProto sessions (encrypted with SERVER_SECRET)
CREATE TABLE user_sessions (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id),
  encrypted_session_data TEXT NOT NULL,
  is_active     INTEGER DEFAULT 1,
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- Channels (shared across users)
CREATE TABLE channels (
  id            INTEGER PRIMARY KEY, -- negative for supergroups/channels
  username      TEXT,
  title         TEXT NOT NULL,
  photo_url     TEXT,
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- User subscriptions
CREATE TABLE subscriptions (
  user_id       INTEGER REFERENCES users(id),
  channel_id    INTEGER REFERENCES channels(id),
  is_active     INTEGER DEFAULT 1,
  added_at      TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, channel_id)
);

-- Folders
CREATE TABLE folders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER REFERENCES users(id),
  name          TEXT NOT NULL,
  position      INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Folder-channel assignments
CREATE TABLE folder_channels (
  folder_id     INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  channel_id    INTEGER REFERENCES channels(id),
  position      INTEGER DEFAULT 0,
  PRIMARY KEY (folder_id, channel_id)
);

-- Messages (shared across users)
CREATE TABLE messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id    INTEGER REFERENCES channels(id),
  tg_message_id INTEGER NOT NULL,
  text          TEXT,
  media_url     TEXT,
  media_type    TEXT, -- photo, video, document, album, none
  posted_at     TEXT NOT NULL,
  fetched_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(channel_id, tg_message_id)
);

-- Read status per user
CREATE TABLE read_status (
  user_id       INTEGER REFERENCES users(id),
  message_id    INTEGER REFERENCES messages(id),
  read_at       TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, message_id)
);

CREATE INDEX idx_messages_posted ON messages(posted_at);
CREATE INDEX idx_messages_channel ON messages(channel_id);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_read_status_user ON read_status(user_id);
```

### Security notes
- Phone number is used only during MTProto session acquisition and immediately deleted
- MTProto session is encrypted at rest with SERVER_SECRET (AES-256 via env variable)
- No user PII (names, usernames, phone) stored in DB

---

## 3. REST API

All endpoints require `Authorization: Bearer <jwt>` header.

### Authentication

```
POST /api/auth/verify
  Body: { initData: "..." }
  → { token: "jwt...", needs_session?: true }
```

### Channels & Subscriptions

```
GET    /api/channels/search?q=...    → [{ id, username, title, photo_url }]
POST   /api/subscriptions            ← { channel_id }
DELETE /api/subscriptions/:channel_id
GET    /api/subscriptions            → [{ channel, folders[] }]
```

### Folders

```
GET    /api/folders                  → [{ id, name, channels[] }]
POST   /api/folders                  ← { name }
PATCH  /api/folders/:id              ← { name }
DELETE /api/folders/:id
POST   /api/folders/:id/channels     ← { channel_id }
DELETE /api/folders/:id/channels/:channel_id
```

### Feed

```
GET /api/feed
  ?sort=asc|desc          -- asc = oldest first, desc = newest first
  &folder=3               -- optional folder filter
  &cursor=ISO_DATE        -- cursor-based pagination
  &limit=30
  → {
      items: [{ message, channel, is_read }],
      next_cursor: "ISO_DATE" | null,
      has_newer: boolean
    }
```

### Read Status

```
POST /api/messages/read
  Body: { message_ids: [1, 2, 3] }
  → { ok: true }
```

---

## 4. Authentication Flow

### First-time setup (via bot chat)

1. User sends `/login` to the bot
2. Bot asks for phone number
3. User enters phone → bot calls MTProto `sendCode`
4. User enters verification code → bot calls `signIn` → obtains MTProto session
5. Session is encrypted with SERVER_SECRET → saved to `user_sessions`
6. Phone number is deleted

### Daily login (Mini App)

1. User opens Mini App → Telegram passes `initData`
2. Frontend sends `initData` to `POST /api/auth/verify`
3. Server validates `initData` hash
4. If session exists → returns JWT (24h TTL)
5. If no session yet → returns `{ needs_session: true }`, frontend shows "Configure bot" prompt

### Session decryption

- Server decrypts MTProto session using SERVER_SECRET only when needed for sync
- Session stays decrypted in memory during active use
- JWT is stateless, no session state stored server-side

---

## 5. Frontend

### Component Tree

```
App
├── Header (folders sidebar toggle, app name, settings gear)
├── FolderTabs (horizontal scroll, folder chips + "All" tab)
├── FeedScreen
│   ├── MessageCard[] (channel avatar, title, text, image preview, time)
│   └── InfiniteScroll (useInfiniteQuery)
├── SettingsScreen (subscription management, folders CRUD)
└── BottomBar (sort direction toggle asc/desc)
```

### State Management

- **TanStack Query (React Query):** server state — feed items, folders, channels, read status. Provides caching, infinite scroll (`useInfiniteQuery`), background refetch, optimistic updates for read marking.
- **Zustand:** UI state — active folder, sort direction, sidebar open. Minimal (~1KB) with no providers.

### Feed Interaction

- Infinite scroll via cursor-based pagination
- IntersectionObserver on message cards → when visible, batch-send message IDs to `POST /api/messages/read`
- Debounced batched marking (collect visible IDs over 500ms, send once)
- Sort direction toggle: asc (old→new) / desc (new→old)
- Empty state: "No messages yet" with CTA to add subscriptions

### Design

Modern Telegram-style UI using Telegram Mini App design patterns:
- Telegram color tokens (var(--tg-theme-bg-color), etc.)
- Telegram-native feel: rounded cards, subtle shadows, smooth transitions
- Respects Telegram theme (light/dark via WebView theme params)
- Follows latest Telegram Mini App UI conventions

---

## 6. Synchronization

### Polling Schedule

| Condition | Interval |
|-----------|----------|
| User active (Mini App open, last interaction < 5 min) | 30 seconds |
| User inactive (> 5 min) | 5 minutes |
| Session inactive > 24 hours | Skip |

### Sync Worker

```
For each user with active session:
  For each subscribed channel (sequential, 500ms delay between):
    MTProto: messages.getHistory(peer, offset_id=0, limit=20)
    → Compare with last tg_message_id in DB
    → INSERT OR IGNORE new messages
  Update channel's last_synced_at
```

- Channels processed sequentially with 500ms delays to avoid rate limits
- Shared messages deduplicated via UNIQUE constraint — multiple users syncing same channel won't create duplicates
- Skip channels synced by another user within the last 60 seconds

### Read Status Sync

When frontend sends `POST /api/messages/read`:
1. Insert into `read_status` (local DB)
2. Group messages by channel
3. For each channel, call MTProto `messages.readHistory`
4. Telegram app reflects the read status

### Cleanup Worker (hourly)

Delete messages older than 30 days that have been read by ALL subscribed users:

```sql
DELETE FROM messages
WHERE posted_at < datetime('now', '-30 days')
  AND NOT EXISTS (
    SELECT 1 FROM read_status rs
    JOIN subscriptions s ON s.user_id = rs.user_id
    WHERE rs.message_id = messages.id
      AND s.channel_id = messages.channel_id
      AND rs.read_at IS NULL
  )
```

### Error Handling

- Expired MTProto session → mark session inactive, notify user to re-login
- FLOOD_WAIT → add delay, retry
- Network error → skip cycle, retry on next interval

### Telegram Rate Limits

- ~30 requests/second per user account (unofficial, observed)
- Our sync: 2 requests/second max (sequential with 500ms delay) — well within limits
- On FLOOD_WAIT response, back off for the specified duration

---

## 7. Deployment

### Project Structure

```
tg-rss/
├── src/
│   ├── server/
│   │   ├── index.ts         # entry point
│   │   ├── api/             # Hono route handlers
│   │   ├── bot/             # grammY bot handlers
│   │   ├── mtproto/         # MTProto client wrapper
│   │   ├── sync/            # SyncWorker + CleanupWorker
│   │   └── db/              # migrations + schema
│   └── web/                 # React SPA (Vite)
│       ├── src/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── stores/      # Zustand stores
│       │   ├── api/         # API client functions
│       │   └── App.tsx
│       └── index.html
├── Dockerfile
├── docker-compose.yml
├── bun.lockb
└── package.json
```

### Dockerfile

Multi-stage: build web first, then runtime with production deps only. Uses official `oven/bun:1-alpine` image (ARM64 compatible).

### docker-compose.yml

Single service with:
- Port 3000 exposed
- Volume mount for `/data` (SQLite DB + encrypted sessions)
- `.env` file for BOT_TOKEN, SERVER_SECRET, optional MT_PROXY

### Launch

```bash
git clone <repo>
cd tg-rss
# Create .env with BOT_TOKEN and SERVER_SECRET
docker compose up -d --build
```

### Requirements (Raspberry Pi)

- Docker + docker compose
- 512MB+ RAM
- ARMv7+
- Reverse proxy (Caddy/Nginx/Cloudflare Tunnel) for external webhook access

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| BOT_TOKEN | Yes | Telegram Bot API token from @BotFather |
| SERVER_SECRET | Yes | 32-byte random string for session encryption |
| MT_PROXY | No | SOCKS5 proxy for MTProto (if needed) |
| PORT | No | Server port (default: 3000) |
| DATA_DIR | No | Path for SQLite and sessions (default: /data) |
