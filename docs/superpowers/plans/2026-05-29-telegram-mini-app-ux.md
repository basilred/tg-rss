# Telegram Mini App UX Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Telegram-native UX layer: Theme, BackButton, haptics, native popups, custom toast, viewport handling, closing confirmation, deep link button.

**Architecture:** Extend existing `telegram/` utilities and `useTelegram` hook. Add 3 new hooks (`useBackButton`, `useHaptics`, `useTelegramPopup`) and a Toast context system. Wire haptics into existing components. Replace `alert()` calls with toast/popup. Apply Telegram theme dynamically on mount and theme change.

**Tech Stack:** React 19, TypeScript, Telegram WebApp SDK v62, Vite, Bun (tests), Hono (server), Zustand, CSS (BEM-like)

---

### Task 1: Extend Telegram types

**Files:**
- Modify: `src/web/src/telegram/types.ts`

- [ ] **Step 1: Add popup, haptic, and misc types**

```typescript
export interface TelegramPopupButton {
  id?: string;
  type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
  text?: string;
}

export interface TelegramPopupParams {
  title?: string;
  message: string;
  buttons?: TelegramPopupButton[];
}

export type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';

export type HapticNotificationType = 'error' | 'success' | 'warning';

// Extend TelegramWebAppApi with missing properties
export interface TelegramWebAppApi {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    auth_date?: number;
  };
  themeParams: TelegramTheme;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  viewportHeight: number;
  isExpanded: boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  MainButton: {
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: HapticImpactStyle) => void;
    notificationOccurred: (type: HapticNotificationType) => void;
    selectionChanged: () => void;
  };
  showPopup: (params: TelegramPopupParams, cb?: (buttonId?: string) => void) => void;
  showAlert: (message: string, cb?: () => void) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  openTelegramLink: (url: string) => void;
  onEvent: (eventType: string, handler: () => void) => void;
  offEvent: (eventType: string, handler: () => void) => void;
  isVersionAtLeast: (version: string) => boolean;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebAppApi;
    };
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/src/telegram/types.ts
git commit -m "feat: extend Telegram types with popup, haptic, and viewport APIs"
```

---

### Task 2: Extend webApp utilities

**Files:**
- Modify: `src/web/src/telegram/webApp.ts`

- [ ] **Step 1: Add new utility functions**

Append after the existing `configureBackButton` function:

```typescript
import type { TelegramPopupParams, HapticImpactStyle, HapticNotificationType, TelegramWebAppApi } from './types';

// --- Popup helpers ---

export const showTelegramPopup = (
  webApp: { showPopup?: (params: TelegramPopupParams, cb?: (buttonId?: string) => void) => void } | undefined,
  params: TelegramPopupParams,
): Promise<string | undefined> => {
  if (!webApp?.showPopup) {
    const confirmed = window.confirm(params.message);
    return Promise.resolve(confirmed ? (params.buttons?.[0]?.id ?? 'ok') : 'cancel');
  }

  return new Promise((resolve) => {
    webApp.showPopup!(params, (buttonId) => {
      resolve(buttonId);
    });
  });
};

export const showTelegramAlert = (
  webApp: { showAlert?: (message: string, cb?: () => void) => void } | undefined,
  message: string,
): Promise<void> => {
  if (!webApp?.showAlert) {
    window.alert(message);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    webApp.showAlert!(message, () => resolve());
  });
};

// --- Closing confirmation ---

export const enableClosingConfirmation = (
  webApp: { enableClosingConfirmation?: () => void } | undefined,
): void => {
  webApp?.enableClosingConfirmation?.();
};

export const disableClosingConfirmation = (
  webApp: { disableClosingConfirmation?: () => void } | undefined,
): void => {
  webApp?.disableClosingConfirmation?.();
};

// --- Haptic feedback ---

export const hapticImpact = (
  webApp: { HapticFeedback?: { impactOccurred: (style: HapticImpactStyle) => void } } | undefined,
  style: HapticImpactStyle,
): void => {
  webApp?.HapticFeedback?.impactOccurred(style);
};

export const hapticNotification = (
  webApp: { HapticFeedback?: { notificationOccurred: (type: HapticNotificationType) => void } } | undefined,
  type: HapticNotificationType,
): void => {
  webApp?.HapticFeedback?.notificationOccurred(type);
};

export const hapticSelection = (
  webApp: { HapticFeedback?: { selectionChanged: () => void } } | undefined,
): void => {
  webApp?.HapticFeedback?.selectionChanged();
};

// --- Viewport ---

export const getViewportHeight = (
  webApp: { viewportHeight?: number } | undefined,
): number => {
  return webApp?.viewportHeight ?? window.innerHeight;
};

export const applyViewportHeight = (
  webApp: { viewportHeight?: number } | undefined,
  root = document.documentElement,
): void => {
  root.style.setProperty('--tg-viewport-height', `${getViewportHeight(webApp)}px`);
};

// --- Deep link ---

export const openTelegramLink = (
  webApp: TelegramWebAppLike | undefined,
  url: string,
): void => {
  webApp?.openTelegramLink?.(url);
};
```

- [ ] **Step 2: Add `openTelegramLink` to `TelegramWebAppLike` interface**

Update the existing `TelegramWebAppLike` interface:

```typescript
interface TelegramWebAppLike {
  BackButton?: BackButtonApi;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  openTelegramLink?: (url: string) => void;
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/web/src/telegram/webApp.ts
git commit -m "feat: add popup, haptic, viewport, and deep link utilities"
```

---

### Task 3: Add tests for new webApp utilities

**Files:**
- Modify: `src/web/src/telegram/webApp.test.ts`

- [ ] **Step 1: Add test for showTelegramPopup with browser fallback**

Append after existing tests:

```typescript
import {
  showTelegramPopup,
  showTelegramAlert,
  enableClosingConfirmation,
  disableClosingConfirmation,
  hapticImpact,
  hapticNotification,
  hapticSelection,
  getViewportHeight,
  applyViewportHeight,
} from './webApp';

test('showTelegramPopup uses window.confirm as fallback when showPopup is unavailable', async () => {
  const result = await showTelegramPopup(undefined, {
    title: 'Test',
    message: 'Confirm?',
    buttons: [{ id: 'ok', text: 'OK' }],
  });
  expect(result).toBe('ok');
});

test('showTelegramPopup resolves with buttonId via SDK', async () => {
  let capturedButtonId: string | undefined;

  const webApp = {
    showPopup: (_params: unknown, cb?: (buttonId?: string) => void) => {
      cb?.('ok');
    },
  };

  const result = await showTelegramPopup(webApp, {
    title: 'Test',
    message: 'Confirm?',
    buttons: [{ id: 'ok', text: 'OK' }],
  });

  expect(result).toBe('ok');
});

test('showTelegramAlert uses window.alert as fallback', async () => {
  await showTelegramAlert(undefined, 'Hello');
  // No throw = pass
});

test('showTelegramAlert resolves via SDK callback', async () => {
  const webApp = {
    showAlert: (_message: string, cb?: () => void) => {
      cb?.();
    },
  };

  await showTelegramAlert(webApp, 'Hello');
  // No throw = pass
});

test('haptic functions are safe no-ops when WebApp is undefined', () => {
  hapticImpact(undefined, 'light');
  hapticNotification(undefined, 'success');
  hapticSelection(undefined);
  // No throw = pass
});

test('haptic functions call SDK methods', () => {
  const events: string[] = [];

  const webApp = {
    HapticFeedback: {
      impactOccurred: (s: string) => events.push(`impact:${s}`),
      notificationOccurred: (t: string) => events.push(`notif:${t}`),
      selectionChanged: () => events.push('selection'),
    },
  };

  hapticImpact(webApp, 'medium');
  hapticNotification(webApp, 'error');
  hapticSelection(webApp);

  expect(events).toEqual(['impact:medium', 'notif:error', 'selection']);
});

test('enableClosingConfirmation is safe no-op when undefined', () => {
  enableClosingConfirmation(undefined);
  // No throw = pass
});

test('enableClosingConfirmation calls SDK method', () => {
  let called = false;
  const webApp = { enableClosingConfirmation: () => { called = true; } };
  enableClosingConfirmation(webApp);
  expect(called).toBe(true);
});

test('disableClosingConfirmation calls SDK method', () => {
  let called = false;
  const webApp = { disableClosingConfirmation: () => { called = true; } };
  disableClosingConfirmation(webApp);
  expect(called).toBe(true);
});

test('getViewportHeight falls back to window.innerHeight', () => {
  const height = getViewportHeight(undefined);
  expect(height).toBeGreaterThan(0);
});

test('getViewportHeight uses SDK value', () => {
  const height = getViewportHeight({ viewportHeight: 800 });
  expect(height).toBe(800);
});

test('applyViewportHeight sets CSS variable on root', () => {
  const root = document.createElement('div');
  applyViewportHeight(undefined, root);
  const value = root.style.getPropertyValue('--tg-viewport-height');
  expect(value).toBeTruthy();
  expect(Number.parseFloat(value)).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run tests**

Run: `cd src/web && bun test src/web/src/telegram/webApp.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/web/src/telegram/webApp.test.ts
git commit -m "test: add tests for popup, haptic, viewport, and closing confirmation utilities"
```

---

### Task 4: Create useHaptics hook

**Files:**
- Create: `src/web/src/hooks/useHaptics.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useCallback } from 'react';
import {
  getTelegramWebApp,
  hapticImpact,
  hapticNotification,
  hapticSelection,
} from '../telegram/webApp';
import type { HapticImpactStyle, HapticNotificationType } from '../telegram/types';

export interface HapticsApi {
  light: () => void;
  medium: () => void;
  heavy: () => void;
  success: () => void;
  error: () => void;
  warning: () => void;
  selection: () => void;
}

export const useHaptics = (): HapticsApi => {
  const webApp = getTelegramWebApp();

  const light = useCallback(() => hapticImpact(webApp, 'light'), [webApp]);
  const medium = useCallback(() => hapticImpact(webApp, 'medium'), [webApp]);
  const heavy = useCallback(() => hapticImpact(webApp, 'heavy'), [webApp]);
  const success = useCallback(() => hapticNotification(webApp, 'success'), [webApp]);
  const error = useCallback(() => hapticNotification(webApp, 'error'), [webApp]);
  const warning = useCallback(() => hapticNotification(webApp, 'warning'), [webApp]);
  const selection = useCallback(() => hapticSelection(webApp), [webApp]);

  return { light, medium, heavy, success, error, warning, selection };
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/src/hooks/useHaptics.ts
git commit -m "feat: add useHaptics hook wrapping Telegram HapticFeedback API"
```

---

### Task 5: Create useTelegramPopup hook

**Files:**
- Create: `src/web/src/hooks/useTelegramPopup.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useCallback } from 'react';
import {
  getTelegramWebApp,
  showTelegramPopup,
  showTelegramAlert,
} from '../telegram/webApp';
import type { TelegramPopupParams } from '../telegram/types';

export interface PopupApi {
  /** Returns 'ok' | 'cancel' | button.id */
  confirm: (params: TelegramPopupParams) => Promise<string | undefined>;
  alert: (message: string) => Promise<void>;
}

export const useTelegramPopup = (): PopupApi => {
  const webApp = getTelegramWebApp();

  const confirm = useCallback(
    (params: TelegramPopupParams) => showTelegramPopup(webApp, params),
    [webApp],
  );

  const alert = useCallback(
    (message: string) => showTelegramAlert(webApp, message),
    [webApp],
  );

  return { confirm, alert };
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/src/hooks/useTelegramPopup.ts
git commit -m "feat: add useTelegramPopup hook wrapping Telegram showPopup/showAlert"
```

---

### Task 6: Create useBackButton hook

**Files:**
- Create: `src/web/src/hooks/useBackButton.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useEffect } from 'react';
import { getTelegramWebApp } from '../telegram/webApp';

export const useBackButton = (
  handler: () => void,
  visible: boolean,
): void => {
  useEffect(() => {
    const webApp = getTelegramWebApp();
    const backButton = webApp?.BackButton;
    if (!backButton) return;

    if (visible) {
      backButton.show();
      backButton.onClick(handler);
    } else {
      backButton.hide();
    }

    return () => {
      backButton.offClick(handler);
      backButton.hide();
    };
  }, [handler, visible]);
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/src/hooks/useBackButton.ts
git commit -m "feat: add useBackButton hook for Telegram BackButton lifecycle"
```

---

### Task 7: Create ToastProvider and Toast component

**Files:**
- Create: `src/web/src/components/Toast.tsx`
- Create: `src/web/src/components/ToastProvider.tsx`

- [ ] **Step 1: Create ToastProvider.tsx**

```typescript
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Toast, type ToastMessage } from './Toast';

export type ToastType = 'success' | 'error' | 'neutral';

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  show: () => undefined,
});

export const useToast = (): ToastContextValue => useContext(ToastContext);

let toastId = 0;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback((message: string, type: ToastType = 'neutral') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
```

- [ ] **Step 2: Create Toast.tsx**

```typescript
import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'neutral';
}

const AUTO_HIDE: Record<ToastMessage['type'], number> = {
  success: 3000,
  error: 5000,
  neutral: 3000,
};

interface Props {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}

export const Toast = ({ toast, onDismiss }: Props) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), AUTO_HIDE[toast.type]);
    return () => clearTimeout(timer);
  }, [toast.type]);

  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => onDismiss(toast.id), 200);
    return () => clearTimeout(timer);
  }, [exiting, toast.id, onDismiss]);

  return (
    <div
      className={`toast toast-${toast.type}${exiting ? ' toast-exit' : ''}`}
      onClick={() => setExiting(true)}
    >
      {toast.message}
    </div>
  );
};
```

- [ ] **Step 3: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/web/src/components/Toast.tsx src/web/src/components/ToastProvider.tsx
git commit -m "feat: add ToastProvider and Toast component for in-app notifications"
```

---

### Task 8: Add toast CSS

**Files:**
- Modify: `src/web/index.css`

- [ ] **Step 1: Add toast styles at end of index.css**

Append after existing styles:

```css
/* Toast */
.toast-container {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  width: 100%;
  max-width: 420px;
  pointer-events: none;
}

.toast {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 15px;
  line-height: 1.4;
  color: #ffffff;
  cursor: pointer;
  pointer-events: auto;
  animation: toast-enter 0.25s ease-out;
}

.toast-neutral {
  background: var(--tg-theme-button-color);
}

.toast-success {
  background: #31a854;
}

.toast-error {
  background: #e53935;
}

.toast-exit {
  animation: toast-exit 0.2s ease-in forwards;
}

@keyframes toast-enter {
  from {
    opacity: 0;
    transform: translateY(-100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes toast-exit {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-100%);
  }
}
```

- [ ] **Step 2: Verify the CSS is valid**

Look at the file structure — no errors expected.

- [ ] **Step 3: Commit**

```bash
git add src/web/index.css
git commit -m "feat: add toast notification styles"
```

---

### Task 9: Update useTelegram hook with viewport handling and theme

**Files:**
- Modify: `src/web/src/hooks/useTelegram.ts`

- [ ] **Step 1: Add viewportHeight, theme application on mount, themeChanged listener**

Replace the file with:

```typescript
import { useEffect, useState } from 'react';
import type { TelegramWebAppApi, TelegramUser, TelegramTheme } from '../telegram/types';
import { applyTelegramTheme, applyViewportHeight, getTelegramWebApp } from '../telegram/webApp';

export interface TelegramAdapter {
  webApp: TelegramWebAppApi | null;
  initData: string | null;
  user: TelegramUser | null;
  theme: TelegramTheme | null;
  isAvailable: boolean;
  isDark: boolean;
  viewportHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
}

export const useTelegram = (): TelegramAdapter => {
  const webApp = getTelegramWebApp() ?? null;
  const [viewportHeight, setViewportHeight] = useState(
    () => webApp?.viewportHeight ?? window.innerHeight,
  );

  useEffect(() => {
    if (!webApp) return;
    webApp.ready();
    webApp.expand();

    // Apply theme on mount
    applyTelegramTheme(webApp.themeParams);

    // Initial viewport height
    applyViewportHeight(webApp);

    // Theme change listener
    const handleThemeChange = () => {
      applyTelegramTheme(webApp.themeParams);
    };

    // Viewport change listener
    const handleViewportChange = () => {
      applyViewportHeight(webApp);
      setViewportHeight(webApp.viewportHeight);
    };

    webApp.onEvent('themeChanged', handleThemeChange);
    webApp.onEvent('viewportChanged', handleViewportChange);

    return () => {
      webApp.offEvent('themeChanged', handleThemeChange);
      webApp.offEvent('viewportChanged', handleViewportChange);
    };
  }, [webApp]);

  return {
    webApp,
    initData: webApp?.initData ?? null,
    user: webApp?.initDataUnsafe?.user ?? null,
    theme: webApp?.themeParams ?? null,
    isAvailable: webApp !== null,
    isDark: webApp?.colorScheme === 'dark',
    viewportHeight,
    ready: () => webApp?.ready(),
    expand: () => webApp?.expand(),
    close: () => webApp?.close(),
  };
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/src/hooks/useTelegram.ts
git commit -m "feat: add viewport height tracking and dynamic theme application to useTelegram"
```

---

### Task 10: Update index.css — remove dark media query, add viewport variable

**Files:**
- Modify: `src/web/index.css`

- [ ] **Step 1: Remove dark theme media query; replace 100dvh with viewport variable**

Remove the entire `@media (prefers-color-scheme: dark) { ... }` block (lines 11-21).

Replace `min-height: 100dvh` with `min-height: var(--tg-viewport-height, 100dvh)` in two places:

In `.app` (line 39), change:
```css
  min-height: 100dvh;
```
to:
```css
  min-height: var(--tg-viewport-height, 100dvh);
```

In `.app-empty` (line 49), change:
```css
  min-height: 100dvh;
```
to:
```css
  min-height: var(--tg-viewport-height, 100dvh);
```

- [ ] **Step 2: Verify the CSS changes**

Read the file to confirm only the expected blocks changed.

- [ ] **Step 3: Commit**

```bash
git add src/web/index.css
git commit -m "feat: replace dark media query with dynamic Telegram theme; use viewport CSS variable"
```

---

### Task 11: Update main.tsx — wrap with ToastProvider

**Files:**
- Modify: `src/web/src/main.tsx`

- [ ] **Step 1: Add ToastProvider import and wrap**

Replace the file with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ToastProvider';
import App from './App';
import '../index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 2: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/src/main.tsx
git commit -m "feat: wrap app with ToastProvider"
```

---

### Task 12: Update App.tsx — apply Telegram theme on mount

**Files:**
- Modify: `src/web/src/App.tsx`

The theme is now applied in `useTelegram()` hook (Task 9), so App.tsx only needs the import change. Theme is automatically applied on mount and on `themeChanged` via the hook.

No changes needed to App.tsx for theme — it's handled by `useTelegram`. But we need to pass `telegram.webApp` to SettingsScreen for the deep link button.

- [ ] **Step 1: No file changes needed for App.tsx at this point**

The theme application is now self-contained in `useTelegram`. The SettingsScreen will get the webApp reference from `useTelegram` directly rather than via props.

Skip this task — App.tsx needs no modifications for theme. Theme is handled in `useTelegram` hook (Task 9).

- [ ] **Step 1: Commit** (skip — no changes)

---

### Task 13: Update server auth API — add botUsername

**Files:**
- Modify: `src/server/api/auth.ts`

- [ ] **Step 1: Import bot and add username to status response**

Replace the file with:

```typescript
import { Hono } from 'hono';
import { verifyInitData, createJwt } from '../auth';
import { getDb } from '../db';
import { authMiddleware } from '../middleware/auth';
import { bot } from '../bot';

const BOT_TOKEN = process.env.BOT_TOKEN || '';

const auth = new Hono();

auth.post('/verify', async (c) => {
  const { initData } = await c.req.json<{ initData: string }>();
  if (!initData) {
    return c.json({ error: 'Missing initData' }, 400);
  }

  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) {
    return c.json({ error: 'Invalid initData' }, 401);
  }

  const db = getDb();
  db.run('INSERT OR IGNORE INTO users (id) VALUES (?)', [user.id]);

  const session = db
    .query('SELECT is_active FROM user_sessions WHERE user_id = ?')
    .get(user.id) as { is_active: number } | undefined;

  const token = createJwt(user.id);
  return c.json({
    token,
    telegramSyncConnected: session?.is_active === 1,
    user: {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
    },
  });
});

auth.get('/status', authMiddleware, (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const session = db
    .query('SELECT is_active FROM user_sessions WHERE user_id = ?')
    .get(userId) as { is_active: number } | undefined;

  return c.json({
    telegramSyncConnected: session?.is_active === 1,
    botUsername: bot.botInfo?.username ?? null,
  });
});

export { auth };
```

- [ ] **Step 2: Update client type for status response**

File: `src/web/src/api/client.ts`

Update the `status` method response type:

```typescript
    status: () =>
      request<{ telegramSyncConnected: boolean; botUsername: string | null }>('/auth/status'),
```

- [ ] **Step 3: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/api/auth.ts src/web/src/api/client.ts
git commit -m "feat: add botUsername to /api/auth/status response"
```

---

### Task 14: Update SettingsScreen — replace alert, add deep link, back button, confirmClose

**Files:**
- Modify: `src/web/src/components/SettingsScreen.tsx`

- [ ] **Step 1: Rewrite with toast, popup, back button, confirmClose, deep link**

Replace the file content:

```tsx
import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useUiStore } from '../stores/ui';
import { useToast } from './ToastProvider';
import { useTelegramPopup } from '../hooks/useTelegramPopup';
import { useBackButton } from '../hooks/useBackButton';
import {
  getTelegramWebApp,
  enableClosingConfirmation,
  disableClosingConfirmation,
  openTelegramLink,
} from '../telegram/webApp';

interface Props {
  telegramSyncConnected: boolean;
}

export const SettingsScreen = ({ telegramSyncConnected }: Props) => {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const queryClient = useQueryClient();
  const toast = useToast();
  const popup = useTelegramPopup();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ id: number; username: string; title: string; photo_url: string }>
  >([]);
  const [newFolderName, setNewFolderName] = useState('');

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api.subscriptions.list(),
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.folders.list(),
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['auth', 'status'],
    queryFn: () => api.auth.status(),
    initialData: { telegramSyncConnected, botUsername: null },
  });

  const isTelegramSyncConnected = syncStatus.telegramSyncConnected;

  // Closing confirmation when new folder name is non-empty
  const handleClose = useCallback(() => {
    disableClosingConfirmation(getTelegramWebApp());
    setSettingsOpen(false);
  }, [setSettingsOpen]);

  // BackButton
  useBackButton(handleClose, true);

  const addSub = useMutation({
    mutationFn: (channelId: number) => api.subscriptions.add(channelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
  });

  const removeSub = useMutation({
    mutationFn: (channelId: number) => api.subscriptions.remove(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const createFolder = useMutation({
    mutationFn: (name: string) => api.folders.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setNewFolderName('');
      toast.show('Папка создана', 'success');
    },
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: number) => {
      const confirmed = await popup.confirm({
        title: 'Удалить папку?',
        message: 'Все каналы в этой папке будут откреплены.',
        buttons: [
          { id: 'delete', type: 'destructive', text: 'Удалить' },
          { id: 'cancel', type: 'cancel', text: 'Отмена' },
        ],
      });
      if (confirmed !== 'delete') throw new Error('Cancelled');
      return api.folders.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast.show('Папка удалена', 'neutral');
    },
    onError: (err) => {
      if (err.message !== 'Cancelled') {
        toast.show('Ошибка при удалении папки', 'error');
      }
    },
  });

  const importChannels = useMutation({
    mutationFn: () => api.subscriptions.import(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      toast.show(`Импортировано ${data.imported} каналов`, 'success');
    },
    onError: () => toast.show('Ошибка импорта. Убедись, что подключился.', 'error'),
  });

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    const results = await api.channels.search(searchQuery);
    setSearchResults(results);
  };

  const handleDeepLink = () => {
    const webApp = getTelegramWebApp();
    const username = syncStatus.botUsername;
    if (username) {
      openTelegramLink(webApp, `https://t.me/${username}?start=login`);
    } else {
      openTelegramLink(webApp, `https://t.me/?start=login`);
    }
  };

  useEffect(() => {
    if (newFolderName.trim()) {
      enableClosingConfirmation(getTelegramWebApp());
    } else {
      disableClosingConfirmation(getTelegramWebApp());
    }
  }, [newFolderName]);

  return (
    <main className="settings">
      <div className="settings-header">
        <h2>Настройки</h2>
        <button className="settings-close" onClick={handleClose}>✕</button>
      </div>

      <section className="settings-section">
        <h3>Каналы</h3>
        {!isTelegramSyncConnected && (
          <details className="settings-hint-details">
            <summary className="settings-hint-summary">
              Telegram sync не подключён
            </summary>
            <p className="settings-hint">
              Для автоматического импорта подписок подключи синхронизацию.
            </p>
            <button className="settings-btn" onClick={handleDeepLink}>
              Подключить синхронизацию
            </button>
          </details>
        )}
        <button
          onClick={() => importChannels.mutate()}
          disabled={importChannels.isPending || !isTelegramSyncConnected}
          className="settings-btn"
          style={{ width: '100%', marginBottom: 12, marginTop: isTelegramSyncConnected ? 0 : 12 }}
        >
          {importChannels.isPending ? 'Импортирую...' : 'Импортировать каналы из Telegram'}
        </button>
        <div className="settings-search">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="@username или название"
            className="settings-input"
          />
          <button onClick={handleSearch} className="settings-btn">Найти</button>
        </div>
        {searchResults.map((ch) => (
          <div key={ch.id} className="settings-channel-row">
            <span>{ch.title} {ch.username ? `(@${ch.username})` : ''}</span>
            <button onClick={() => addSub.mutate(ch.id)} className="settings-btn-sm">Подписаться</button>
          </div>
        ))}
      </section>

      <section className="settings-section">
        <h3>Мои подписки ({subscriptions.length})</h3>
        {subscriptions.map((sub) => (
          <div key={sub.id} className="settings-channel-row">
            <span>{sub.title}</span>
            <button onClick={() => removeSub.mutate(sub.id)} className="settings-btn-sm settings-btn-danger">Отписаться</button>
          </div>
        ))}
      </section>

      <section className="settings-section">
        <h3>Папки</h3>
        <div className="settings-search">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Название папки"
            className="settings-input"
          />
          <button onClick={() => newFolderName && createFolder.mutate(newFolderName)} className="settings-btn">Создать</button>
        </div>
        {folders.map((f) => (
          <div key={f.id} className="settings-channel-row">
            <span>{f.name}</span>
            <button onClick={() => deleteFolder.mutate(f.id)} className="settings-btn-sm settings-btn-danger">Удалить</button>
          </div>
        ))}
      </section>
    </main>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/src/components/SettingsScreen.tsx
git commit -m "feat: replace alert with toast/popup, add deep link button, back button, closing confirmation"
```

---

### Task 15: Add haptics to MessageCard

**Files:**
- Modify: `src/web/src/components/MessageCard.tsx`

- [ ] **Step 1: Add light haptic on mount (when message becomes visible — read tracking)**

Add import and call `haptics.light()` in the `useEffect` that marks as read:

```tsx
import { useEffect, useRef } from 'react';
import { useReadObserver } from '../hooks/useReadObserver';
import { useHaptics } from '../hooks/useHaptics';

interface Props {
  messageId: number;
  text: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  postedAt: string;
  channelTitle: string;
  channelPhoto: string | null;
  isRead: boolean;
}

export const MessageCard = ({
  messageId,
  text,
  mediaUrl,
  postedAt,
  channelTitle,
  channelPhoto,
  isRead,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const { observe } = useReadObserver();
  const haptics = useHaptics();

  useEffect(() => {
    if (ref.current && !isRead) {
      return observe(ref.current, messageId);
    }
  }, [messageId, isRead, observe]);

  const time = new Date(postedAt).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      ref={ref}
      className={`message-card ${isRead ? 'message-card-read' : ''}`}
      onClick={() => haptics.light()}
    >
      <div className="message-header">
        <div className="message-channel">
          {channelPhoto ? (
            <img src={channelPhoto} alt="" className="message-avatar" />
          ) : (
            <div className="message-avatar message-avatar-placeholder" />
          )}
          <span className="message-channel-name">{channelTitle}</span>
        </div>
        <span className="message-time">{time}</span>
      </div>
      {text && <p className="message-text">{text}</p>}
      {mediaUrl && (
        <img src={mediaUrl} alt="" className="message-media" loading="lazy" />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/src/components/MessageCard.tsx
git commit -m "feat: add light haptic on message card tap"
```

---

### Task 16: Add haptics to FolderTabs

**Files:**
- Modify: `src/web/src/components/FolderTabs.tsx`

- [ ] **Step 1: Add medium haptic on tab switch**

Replace the file with:

```tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useUiStore } from '../stores/ui';
import { useHaptics } from '../hooks/useHaptics';

export const FolderTabs = () => {
  const activeFolder = useUiStore((s) => s.activeFolder);
  const setActiveFolder = useUiStore((s) => s.setActiveFolder);
  const haptics = useHaptics();

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.folders.list(),
  });

  return (
    <nav className="folder-tabs">
      <button
        className={`folder-tab ${activeFolder === null ? 'folder-tab-active' : ''}`}
        onClick={() => { setActiveFolder(null); haptics.medium(); }}
      >
        Все
      </button>
      {folders.map((f) => (
        <button
          key={f.id}
          className={`folder-tab ${activeFolder === f.id ? 'folder-tab-active' : ''}`}
          onClick={() => { setActiveFolder(f.id); haptics.medium(); }}
        >
          {f.name}
        </button>
      ))}
    </nav>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/src/components/FolderTabs.tsx
git commit -m "feat: add medium haptic on folder tab switch"
```

---

### Task 17: Add haptics to BottomBar

**Files:**
- Modify: `src/web/src/components/BottomBar.tsx`

- [ ] **Step 1: Add selection haptic on sort toggle**

Replace the file with:

```tsx
import { useUiStore } from '../stores/ui';
import { useHaptics } from '../hooks/useHaptics';

export const BottomBar = () => {
  const sortOrder = useUiStore((s) => s.sortOrder);
  const toggleSortOrder = useUiStore((s) => s.toggleSortOrder);
  const haptics = useHaptics();

  return (
    <footer className="bottombar">
      <button
        className="bottombar-btn"
        onClick={() => { toggleSortOrder(); haptics.selection(); }}
      >
        {sortOrder === 'asc' ? '↑ Старые → Новые' : '↓ Новые → Старые'}
      </button>
    </footer>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/src/components/BottomBar.tsx
git commit -m "feat: add selection haptic on sort order toggle"
```

---

### Task 18: Add haptics to FeedScreen (infinite scroll)

**Files:**
- Modify: `src/web/src/components/FeedScreen.tsx`

- [ ] **Step 1: Add light haptic on infinite scroll fetch**

Replace the file with:

```tsx
import { useEffect, useRef } from 'react';
import { useFeed } from '../hooks/useFeed';
import { MessageCard } from './MessageCard';
import { useHaptics } from '../hooks/useHaptics';

export const FeedScreen = () => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useFeed();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const haptics = useHaptics();

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          haptics.light();
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, haptics]);

  if (isLoading) {
    return <div className="feed-empty">Загрузка...</div>;
  }

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  if (allItems.length === 0) {
    return (
      <div className="feed-empty">
        <p>Пока нет сообщений.</p>
        <p>Добавь каналы в подписки, и они появятся здесь.</p>
      </div>
    );
  }

  return (
    <main className="feed">
      {allItems.map((item) => (
        <MessageCard
          key={item.message.id}
          messageId={item.message.id}
          text={item.message.text}
          mediaUrl={item.message.mediaUrl}
          mediaType={item.message.mediaType}
          postedAt={item.message.postedAt}
          channelTitle={item.channel.title}
          channelPhoto={item.channel.photoUrl}
          isRead={item.isRead}
        />
      ))}
      <div ref={sentinelRef} className="feed-sentinel" />
      {isFetchingNextPage && <div className="feed-loading">Загрузка...</div>}
    </main>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/src/components/FeedScreen.tsx
git commit -m "feat: add light haptic on infinite scroll fetch"
```

---

### Task 19: Add haptics to Header (open/close settings)

**Files:**
- Modify: `src/web/src/components/Header.tsx`

- [ ] **Step 1: Read Header.tsx first to see the current code**

Read the file to identify the settings button.

- [ ] **Step 2: Add selection haptic on settings toggle**

```tsx
import { useUiStore } from '../stores/ui';
import { useHaptics } from '../hooks/useHaptics';

export const Header = () => {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const haptics = useHaptics();

  return (
    <header className="header">
      <h1 className="header-title">tg-rss</h1>
      <button
        className="header-btn"
        onClick={() => { setSettingsOpen(true); haptics.selection(); }}
      >
        ⚙️
      </button>
    </header>
  );
};
```

- [ ] **Step 3: Verify types compile**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/web/src/components/Header.tsx
git commit -m "feat: add selection haptic on settings open"
```

---

### Task 20: Add settings hint CSS for the new details/summary UI

**Files:**
- Modify: `src/web/index.css`

- [ ] **Step 1: Add hint details/summary styles after `.settings-hint` block**

Replace the existing `.settings-hint` style block with:

```css
.settings-hint {
  margin-bottom: 10px;
  color: var(--tg-theme-hint-color);
  font-size: 14px;
  line-height: 1.4;
}

.settings-hint-details {
  margin-bottom: 12px;
  border: 1px solid var(--tg-theme-secondary-bg-color);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--tg-theme-secondary-bg-color);
}

.settings-hint-summary {
  font-size: 14px;
  color: var(--tg-theme-link-color);
  cursor: pointer;
  margin-bottom: 8px;
}

.settings-hint-details .settings-btn {
  margin-top: 8px;
  width: 100%;
}

.settings-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Verify the CSS**

No build step needed for CSS.

- [ ] **Step 3: Commit**

```bash
git add src/web/index.css
git commit -m "feat: add settings hint details/summary and disabled button styles"
```

---

### Task 21: Final verification — lint, typecheck, tests

**Files:** All

- [ ] **Step 1: Run typecheck**

Run: `cd src/web && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 2: Run server typecheck**

Run: `cd src/server && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Run tests**

Run: `cd src/web && bun test src/web/src/telegram/webApp.test.ts`
Expected: All tests pass.

- [ ] **Step 4: Run lint**

Run: `cd /Users/basilred/sandbox/tg-rss && bunx eslint src/`
Expected: No lint errors.

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "chore: final verification passed — typecheck, tests, lint"
```

---

### Task 22: Run server typecheck

**Files:**
- Check: `src/server/`

- [ ] **Step 1: Run server typecheck**

Run: `bun run --cwd src/server tsc --noEmit` (or equivalent)
Expected: No type errors.

Note: Server typecheck was also covered in Task 21. This is a redundant check for safety.

- [ ] **Step 2: Commit** (skip if no changes)
