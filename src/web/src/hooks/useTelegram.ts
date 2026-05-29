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

    applyTelegramTheme(webApp.themeParams);
    applyViewportHeight(webApp);

    const handleThemeChange = () => {
      applyTelegramTheme(webApp.themeParams);
    };

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
