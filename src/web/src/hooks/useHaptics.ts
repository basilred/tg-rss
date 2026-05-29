import { useCallback } from 'react';
import {
  getTelegramWebApp,
  hapticImpact,
  hapticNotification,
  hapticSelection,
} from '../telegram/webApp';

export interface HapticsApi {
  light: () => void;
  medium: () => void;
  heavy: () => void;
  success: () => void;
  error: () => void;
  warning: () => void;
  selection: () => void;
}

export const useHaptics = (): HapticsApi => {
  const webApp = getTelegramWebApp();

  const light = useCallback(() => hapticImpact(webApp, 'light'), [webApp]);
  const medium = useCallback(() => hapticImpact(webApp, 'medium'), [webApp]);
  const heavy = useCallback(() => hapticImpact(webApp, 'heavy'), [webApp]);
  const success = useCallback(() => hapticNotification(webApp, 'success'), [webApp]);
  const error = useCallback(() => hapticNotification(webApp, 'error'), [webApp]);
  const warning = useCallback(() => hapticNotification(webApp, 'warning'), [webApp]);
  const selection = useCallback(() => hapticSelection(webApp), [webApp]);

  return { light, medium, heavy, success, error, warning, selection };
};
