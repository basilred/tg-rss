import { afterAll, beforeAll, expect, test } from 'bun:test';
import {
  configureBackButton,
  getThemeCssVars,
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

// DOM mocks for test environment
const createMockElement = () => {
  const vars: Record<string, string> = {};
  return {
    style: {
      setProperty: (prop: string, value: string) => { vars[prop] = value; },
      getPropertyValue: (prop: string) => vars[prop] || '',
    },
  };
};

beforeAll(() => {
  globalThis.window = {
    confirm: () => true,
    alert: () => {},
    innerHeight: 768,
  } as unknown as typeof globalThis.window;
  globalThis.document = {
    createElement: () => createMockElement(),
  } as unknown as Document;
});

afterAll(() => {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).document;
});

test('getThemeCssVars maps Telegram theme params to CSS variables', () => {
  expect(
    getThemeCssVars({
      bg_color: '#111111',
      text_color: '#eeeeee',
      hint_color: '#999999',
      button_color: '#2ea6ff',
    }),
  ).toEqual({
    '--tg-theme-bg-color': '#111111',
    '--tg-theme-text-color': '#eeeeee',
    '--tg-theme-hint-color': '#999999',
    '--tg-theme-button-color': '#2ea6ff',
  });
});

test('configureBackButton shows button and removes handler during cleanup', () => {
  const events: string[] = [];
  const webApp = {
    BackButton: {
      show: () => events.push('show'),
      hide: () => events.push('hide'),
      onClick: () => events.push('onClick'),
      offClick: () => events.push('offClick'),
    },
  };

  const cleanup = configureBackButton(webApp, true, () => undefined);
  cleanup();

  expect(events).toEqual(['show', 'onClick', 'offClick', 'hide']);
});

test('showTelegramPopup uses window.confirm as fallback when showPopup is unavailable', async () => {
  const result = await showTelegramPopup(undefined, {
    title: 'Test',
    message: 'Confirm?',
    buttons: [{ id: 'ok', text: 'OK' }],
  });
  expect(result).toBe('ok');
});

test('showTelegramPopup resolves with buttonId via SDK', async () => {
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

test('disableClosingConfirmation is safe no-op when undefined', () => {
  disableClosingConfirmation(undefined);
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
