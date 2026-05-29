import { useEffect } from 'react';
import type { TelegramWebAppApi, TelegramUser, TelegramTheme } from '../telegram/types';

export interface TelegramAdapter {
  webApp: TelegramWebAppApi | null;
  initData: string | null;
  user: TelegramUser | null;
  theme: TelegramTheme | null;
  isAvailable: boolean;
  isDark: boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
}

export const useTelegram = (): TelegramAdapter => {
  const webApp = (typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined) ?? null;

  useEffect(() => {
    if (!webApp) return;
    webApp.ready();
    webApp.expand();
  }, [webApp]);

  return {
    webApp,
    initData: webApp?.initData ?? null,
    user: webApp?.initDataUnsafe?.user ?? null,
    theme: webApp?.themeParams ?? null,
    isAvailable: webApp !== null,
    isDark: webApp?.colorScheme === 'dark',
    ready: () => webApp?.ready(),
    expand: () => webApp?.expand(),
    close: () => webApp?.close(),
  };
};
