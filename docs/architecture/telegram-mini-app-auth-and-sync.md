# Telegram Mini App Auth And Sync

## Decision

The primary authentication path is standard Telegram Mini App auth:

1. The Mini App reads `window.Telegram.WebApp.initData`.
2. The frontend sends `initData` to `POST /api/auth/verify`.
3. The backend verifies Telegram's signature with `BOT_TOKEN` and rejects stale `auth_date` values.
4. The backend creates or finds the local user and returns an application token.

MTProto is not part of primary authentication. It is an optional Telegram sync capability.

## Capability Boundaries

Standard Mini App auth can identify the Telegram user, but it cannot read the user's channel subscriptions and cannot mark messages as read inside the user's Telegram client.

Local app read state is stored in `read_status`. This is the default read-state model.

Telegram sync via MTProto is used only for features that require acting as the user's Telegram account:

- importing the user's channel subscriptions;
- reading channel history for those subscriptions;
- future synchronization of read state back to Telegram.

## User Experience

Opening the Mini App must not require `/login` or a phone-code flow. `/login` in the bot is only for optional Telegram sync.

When Telegram sync is not connected, the app may still authenticate, show manually added subscriptions, and track local read state.

## Current Implementation

- `POST /api/auth/verify` returns `{ token, user, telegramSyncConnected }`.
- `GET /api/auth/status` returns `{ telegramSyncConnected }` for an authenticated app user.
- `POST /api/subscriptions/import` requires an authenticated app token and an active Telegram sync session.
- `POST /api/messages/read` only records local read markers for messages in the user's active subscriptions.
