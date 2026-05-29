import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'neutral';
}

const AUTO_HIDE: Record<ToastMessage['type'], number> = {
  success: 3000,
  error: 5000,
  neutral: 3000,
};

interface Props {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}

export const Toast = ({ toast, onDismiss }: Props) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), AUTO_HIDE[toast.type]);
    return () => clearTimeout(timer);
  }, [toast.type]);

  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => onDismiss(toast.id), 200);
    return () => clearTimeout(timer);
  }, [exiting, toast.id, onDismiss]);

  return (
    <div
      className={`toast toast-${toast.type}${exiting ? ' toast-exit' : ''}`}
      onClick={() => setExiting(true)}
    >
      {toast.message}
    </div>
  );
};
