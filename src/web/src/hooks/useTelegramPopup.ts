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
