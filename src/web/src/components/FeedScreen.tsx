import { useEffect, useRef } from 'react';
import { useFeed } from '../hooks/useFeed';
import { MessageCard } from './MessageCard';
import { useHaptics } from '../hooks/useHaptics';

export const FeedScreen = () => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useFeed();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const haptics = useHaptics();

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          haptics.light();
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, haptics]);

  if (isLoading) {
    return <div className="feed-empty">Загрузка...</div>;
  }

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  if (allItems.length === 0) {
    return (
      <div className="feed-empty">
        <p>Пока нет сообщений.</p>
        <p>Добавь каналы в подписки, и они появятся здесь.</p>
      </div>
    );
  }

  return (
    <main className="feed">
      {allItems.map((item) => (
        <MessageCard
          key={item.message.id}
          messageId={item.message.id}
          text={item.message.text}
          mediaUrl={item.message.mediaUrl}
          mediaType={item.message.mediaType}
          postedAt={item.message.postedAt}
          channelTitle={item.channel.title}
          channelPhoto={item.channel.photoUrl}
          isRead={item.isRead}
        />
      ))}
      <div ref={sentinelRef} className="feed-sentinel" />
      {isFetchingNextPage && <div className="feed-loading">Загрузка...</div>}
    </main>
  );
};
