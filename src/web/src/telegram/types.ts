export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramTheme {
  bg_color: string;
  text_color: string;
  hint_color: string;
  link_color: string;
  button_color: string;
  button_text_color: string;
  secondary_bg_color: string;
}

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
