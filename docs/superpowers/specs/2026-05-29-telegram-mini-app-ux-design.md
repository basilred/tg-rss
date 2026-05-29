# Telegram Mini App UX Layer

## Scope

Add Telegram-native UX layer on top of existing web app: Telegram SDK wrapper for
theming, navigation, dialogs, haptics, viewport, and close confirmation. Replace
`window.alert()` with Telegram popups (for confirmations) and custom toast (for
info/errors). Replace text "Отправь /login боту" with deep link button.

## Architecture

```
src/web/src/
├── telegram/
│   ├── types.ts              (extend: popup params, haptic types)
│   ├── webApp.ts             (extend: showPopup, showAlert, closingConfirmation, viewport)
│   └── webApp.test.ts        (extend)
├── hooks/
│   ├── useTelegram.ts        (extend: viewportHeight)
│   ├── useBackButton.ts      (NEW)
│   ├── useHaptics.ts         (NEW)
│   └── useTelegramPopup.ts   (NEW)
├── components/
│   ├── Toast.tsx             (NEW)
│   ├── ToastProvider.tsx     (NEW)
│   ├── SettingsScreen.tsx    (modify: replace alert, deep link btn, confirmClose)
│   ├── MessageCard.tsx       (modify: haptics)
│   ├── FolderTabs.tsx        (modify: haptics)
│   ├── BottomBar.tsx         (modify: haptics)
│   └── FeedScreen.tsx        (modify: haptics on infinite scroll load)
├── App.tsx                   (modify: applyTelegramTheme, ToastProvider wrap, themeChanged listener)
├── main.tsx                  (modify: wrap with ToastProvider)
└── index.css                 (modify: remove @media dark, add viewport var)
```

```
src/server/
└── api/auth.ts               (modify: add botUsername to status response)
```

### Boundaries

- **ToastProvider** — independent React context, works without Telegram SDK (browser fallback)
- **useTelegramPopup** — depends on SDK, falls back to `window.confirm()` / `window.alert()`
- **useHaptics** — depends on SDK, no-op fallback
- **useBackButton** — depends on SDK, no-op fallback
- **Theme** — applied dynamically from Telegram SDK on mount and `themeChanged` event

## Toast System

### Context

`ToastProvider` wraps the app in `main.tsx`. Provides `useToast()`:

```ts
const toast = useToast();
toast.show('Импортировано 5 каналов', 'success');   // green, auto-hide 3s
toast.show('Ошибка импорта', 'error');               // red, auto-hide 5s
toast.show('Папка создана');                         // neutral (default)
```

### Component

Fixed at top of viewport (below Header), animated slide-down, Telegram-styled
(`--tg-*` CSS variables, border-radius 12px). Stack multiple toasts.

### Usage

Replaces all `alert()` calls for info/error notifications. Does NOT replace
confirmation dialogs (those use `useTelegramPopup`).

## useTelegramPopup

Wrapper over SDK `showPopup` / `showAlert`:

```ts
const popup = useTelegramPopup();

// Confirmation (showPopup with buttons)
const confirmed = await popup.confirm({
  title: 'Удалить папку?',
  message: 'Все каналы будут откреплены.',
  okText: 'Удалить',
  cancelText: 'Отмена',
});

// Info dialog (showAlert)
await popup.alert({ message: 'Импорт завершён.' });
```

### Fallback

When SDK is unavailable: `window.confirm()` / `window.alert()`.

### Usage

Delete folder, unsubscribe channel, reset settings — any destructive action
requiring explicit user confirmation.

## Haptics

### Hook

```ts
const haptics = useHaptics();
haptics.light();      // impact 'light'
haptics.medium();     // impact 'medium'
haptics.success();    // notification 'success'
haptics.error();      // notification 'error'
haptics.selection();  // selectionChanged
```

### Trigger Map

| Action | Haptic |
|---|---|
| Tap MessageCard | `light` |
| Swipe folder tabs | `medium` |
| Import success | `success` |
| Import error, network error | `error` |
| Folder created, channel subscribed | `success` |
| Toggle sort order | `selection` |
| Open/close settings | `selection` |
| Infinite scroll load | `light` |
| Message read (IntersectionObserver) | `light` |

## BackButton

Hook `useBackButton(handler: () => void, visible: boolean)`:
- `visible=true` → `show()`, `visible=false` → `hide()`
- On unmount → `hide()` + `offClick()`
- SettingsScreen: show when open, handler calls `setSettingsOpen(false)`
- Reuses existing `configureBackButton` from `webApp.ts`

## Theme

- `App.tsx`: call `applyTelegramTheme()` on mount
- Listen to `themeChanged` event via `onEvent('themeChanged', ...)` — re-apply
- Remove `@media (prefers-color-scheme: dark)` from `index.css`
- All theme colors come from dynamic `--tg-*` CSS variables on `:root`

## Viewport

- `useTelegram.ts`: handle `viewportChanged`, set `--tg-viewport-height` on `documentElement.style`
- `index.css`: replace `100dvh` usages with `var(--tg-viewport-height, 100dvh)`

## Closing Confirmation

- SettingsScreen: call `webApp.enableClosingConfirmation()` when there are unsaved
  changes (e.g., new folder name input is non-empty)
- On closing settings (BackButton / ✕ button): first call `disableClosingConfirmation()`,
  then close

## Deep Link Button (Login)

- Replace text "Отправь /login боту" with styled button "Подключить синхронизацию"
- Button calls `webApp.openTelegramLink('https://t.me/${botUsername}?start=login')`
- `botUsername` fetched from `GET /api/auth/status` (new field in response)
- Server reads bot username from bot instance (`bot.botInfo.username`)

## Files

### New

| File | Purpose |
|---|---|
| `src/web/src/components/Toast.tsx` | Toast UI component |
| `src/web/src/components/ToastProvider.tsx` | Toast context + provider |
| `src/web/src/hooks/useBackButton.ts` | BackButton lifecycle hook |
| `src/web/src/hooks/useHaptics.ts` | HapticFeedback wrapper |
| `src/web/src/hooks/useTelegramPopup.ts` | showPopup/showAlert wrapper |

### Modified

| File | Changes |
|---|---|
| `src/web/src/telegram/types.ts` | Add popup params, haptic types |
| `src/web/src/telegram/webApp.ts` | Add showPopup, showAlert, closingConfirmation, viewport helpers |
| `src/web/src/telegram/webApp.test.ts` | Tests for new helpers |
| `src/web/src/hooks/useTelegram.ts` | Add viewportHeight, theme listener |
| `src/web/src/App.tsx` | applyTelegramTheme on mount, themeChanged listener |
| `src/web/src/main.tsx` | Wrap with ToastProvider |
| `src/web/src/components/SettingsScreen.tsx` | Replace alert → toast/popup, deep link btn, confirmClose, back button |
| `src/web/src/components/MessageCard.tsx` | Add light haptic on tap |
| `src/web/src/components/FolderTabs.tsx` | Add medium haptic on tab switch |
| `src/web/src/components/BottomBar.tsx` | Add selection haptic on sort toggle |
| `src/web/src/components/FeedScreen.tsx` | Add light haptic on infinite scroll load |
| `src/web/src/index.css` | Remove dark media query, add viewport var fallback |
| `src/server/api/auth.ts` | Add `botUsername` to status response |

## Testing

- `webApp.test.ts`: extend with tests for new exported functions (showPopup, showAlert,
  enableClosingConfirmation, disableClosingConfirmation, viewport helpers)
- ToastProvider: manual verification (UI component, not easily unit-testable)
- useHaptics, useBackButton, useTelegramPopup: hook behavior, manual + implicit via component tests
- SettingsScreen: verify toast/popup appear instead of alert on import success/error
