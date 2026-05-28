import { useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client';

export const useReadObserver = () => {
  const visibleIds = useRef<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushIds = useCallback(() => {
    const ids = Array.from(visibleIds.current);
    if (ids.length === 0) return;
    visibleIds.current.clear();
    api.read.markBatch(ids).catch(console.warn);
  }, []);

  const observe = useCallback(
    (el: HTMLElement, messageId: number) => {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              visibleIds.current.add(messageId);
            } else {
              visibleIds.current.delete(messageId);
            }
          }
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(flushIds, 500);
        },
        { threshold: 0.5 },
      );

      observer.observe(el);
      return () => observer.disconnect();
    },
    [flushIds],
  );

  useEffect(() => {
    return () => {
      flushIds();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [flushIds]);

  return { observe };
};
