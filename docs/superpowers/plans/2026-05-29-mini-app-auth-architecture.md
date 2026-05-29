# Mini App Auth Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make standard Telegram Mini App authentication the primary login path and move MTProto to optional Telegram sync.

**Architecture:** The Mini App authenticates with `window.Telegram.WebApp.initData`, the server verifies Telegram's signature and `auth_date`, then returns a local app token plus a `telegramSyncConnected` capability flag. MTProto remains available for importing subscriptions and future Telegram read-state sync, but it no longer gates entry into the app.

**Tech Stack:** Bun, TypeScript, Hono, React, TanStack Query, SQLite, grammy, MTProto.

---

### Task 1: Harden Mini App Auth

**Files:**
- Modify: `src/server/auth/verify.ts`
- Modify: `src/server/api/auth.ts`
- Modify: `src/server/auth/jwt.ts`
- Test: `src/server/auth/verify.test.ts`
- Test: `src/server/api/auth.test.ts`

- [ ] Add tests proving stale `auth_date` is rejected and valid Mini App auth returns a local token without requiring `user_sessions`.
- [ ] Update `verifyInitData` to require `auth_date` and reject values older than the configured max age.
- [ ] Update `/api/auth/verify` to return `{ token, user, telegramSyncConnected }` after valid Telegram auth.
- [ ] Remove production fallback behavior for `SERVER_SECRET`.

### Task 2: Separate Client Auth From Telegram Sync

**Files:**
- Modify: `src/web/src/App.tsx`
- Modify: `src/web/src/api/client.ts`
- Modify: `src/web/src/components/SettingsScreen.tsx`

- [ ] Remove `needsSession` as an app-entry blocker.
- [ ] Store/display `telegramSyncConnected` as a capability state.
- [ ] Make import channels call the authenticated `/api/subscriptions/import` endpoint instead of resending `initData`.

### Task 3: Close Ownership Gaps

**Files:**
- Modify: `src/server/api/folders.ts`
- Test: `src/server/api/folders.test.ts`

- [ ] Add tests proving a user cannot add/remove channels from another user's folder.
- [ ] Scope folder-channel mutations through `folders.user_id`.

### Task 4: Fix Verification Signals

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `src/server/sync/worker.ts`

- [ ] Ignore nested build outputs such as `src/web/dist`.
- [ ] Remove unused sync constants.
- [ ] Run `bun run typecheck`, `bun run typecheck:web`, and `bun run lint`.
