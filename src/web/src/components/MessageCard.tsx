import { useEffect, useRef } from 'react';
import { useReadObserver } from '../hooks/useReadObserver';
import { useHaptics } from '../hooks/useHaptics';

interface Props {
  messageId: number;
  text: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  postedAt: string;
  channelTitle: string;
  channelPhoto: string | null;
  isRead: boolean;
}

export const MessageCard = ({
  messageId,
  text,
  mediaUrl,
  postedAt,
  channelTitle,
  channelPhoto,
  isRead,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const { observe } = useReadObserver();
  const haptics = useHaptics();

  useEffect(() => {
    if (ref.current && !isRead) {
      return observe(ref.current, messageId);
    }
  }, [messageId, isRead, observe]);

  const time = new Date(postedAt).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      ref={ref}
      className={`message-card ${isRead ? 'message-card-read' : ''}`}
      onClick={() => haptics.light()}
    >
      <div className="message-header">
        <div className="message-channel">
          {channelPhoto ? (
            <img src={channelPhoto} alt="" className="message-avatar" />
          ) : (
            <div className="message-avatar message-avatar-placeholder" />
          )}
          <span className="message-channel-name">{channelTitle}</span>
        </div>
        <span className="message-time">{time}</span>
      </div>
      {text && <p className="message-text">{text}</p>}
      {mediaUrl && (
        <img src={mediaUrl} alt="" className="message-media" loading="lazy" />
      )}
    </div>
  );
};
