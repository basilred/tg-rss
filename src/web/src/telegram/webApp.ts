import type { HapticImpactStyle, HapticNotificationType, TelegramPopupParams, TelegramWebAppApi } from './types';

type ThemeParams = Record<string, string | undefined>;

interface BackButtonApi {
  show: () => void;
  hide: () => void;
  onClick: (handler: () => void) => void;
  offClick: (handler: () => void) => void;
}

interface TelegramWebAppLike {
  BackButton?: BackButtonApi;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  openTelegramLink?: (url: string) => void;
}

const THEME_PARAM_TO_CSS_VAR: Record<string, string> = {
  bg_color: '--tg-theme-bg-color',
  text_color: '--tg-theme-text-color',
  hint_color: '--tg-theme-hint-color',
  link_color: '--tg-theme-link-color',
  button_color: '--tg-theme-button-color',
  button_text_color: '--tg-theme-button-text-color',
  secondary_bg_color: '--tg-theme-secondary-bg-color',
};

export const getTelegramWebApp = (): TelegramWebAppApi | undefined =>
  window.Telegram?.WebApp;

export const getThemeCssVars = (
  themeParams: ThemeParams,
): Record<string, string> => {
  const vars: Record<string, string> = {};

  for (const [param, cssVar] of Object.entries(THEME_PARAM_TO_CSS_VAR)) {
    const value = themeParams[param];
    if (value) {
      vars[cssVar] = value;
    }
  }

  return vars;
};

export const applyTelegramTheme = (
  themeParams: ThemeParams,
  root = document.documentElement,
): void => {
  const vars = getThemeCssVars(themeParams);
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
};

export const configureBackButton = (
  webApp: TelegramWebAppLike | undefined,
  visible: boolean,
  onClick: () => void,
): (() => void) => {
  const backButton = webApp?.BackButton;
  if (!backButton) {
    return () => undefined;
  }

  if (visible) {
    backButton.show();
    backButton.onClick(onClick);
  } else {
    backButton.hide();
  }

  return () => {
    if (visible) {
      backButton.offClick(onClick);
      backButton.hide();
    }
  };
};

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
