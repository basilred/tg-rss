interface TelegramWebApp {
  initData: string;
  themeParams: Record<string, string>;
  ready: () => void;
  expand: () => void;
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
