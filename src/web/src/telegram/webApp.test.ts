import { expect, test } from 'bun:test';
import { configureBackButton, getThemeCssVars } from './webApp';

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
