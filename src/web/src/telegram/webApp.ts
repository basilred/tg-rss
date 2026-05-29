import type { TelegramWebAppApi } from './types';

type ThemeParams = Record<string, string | undefined>;

interface BackButtonApi {
  show: () => void;
  hide: () => void;
  onClick: (handler: () => void) => void;
  offClick: (handler: () => void) => void;
}

interface TelegramWebAppLike {
  BackButton?: BackButtonApi;
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
