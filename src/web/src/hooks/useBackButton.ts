import { useEffect } from 'react';
import { getTelegramWebApp } from '../telegram/webApp';

export const useBackButton = (
  handler: () => void,
  visible: boolean,
): void => {
  useEffect(() => {
    const webApp = getTelegramWebApp();
    const backButton = webApp?.BackButton;
    if (!backButton) return;

    if (visible) {
      backButton.show();
      backButton.onClick(handler);
    } else {
      backButton.hide();
    }

    return () => {
      backButton.offClick(handler);
      backButton.hide();
    };
  }, [handler, visible]);
};
