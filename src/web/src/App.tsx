import { useEffect, useState, useRef } from 'react';
import { setToken, api } from './api/client';
import { useUiStore } from './stores/ui';
import { FeedScreen } from './components/FeedScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { Header } from './components/Header';
import { FolderTabs } from './components/FolderTabs';
import { BottomBar } from './components/BottomBar';

const App = () => {
  const [isAuthed, setIsAuthed] = useState(false);
  const [needsSession, setNeedsSession] = useState(false);
  const isSettingsOpen = useUiStore((s) => s.isSettingsOpen);
  const initDataRef = useRef('');

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;
    initDataRef.current = initData || '';
    if (!initData) {
      setToken('dev-token');
      setIsAuthed(true);
      return;
    }

    api.auth.verify(initData).then((res) => {
      if (res.token) {
        setToken(res.token);
        setIsAuthed(true);
      } else if (res.needsSession) {
        setNeedsSession(true);
      }
    });
  }, []);

  if (needsSession) {
    return (
      <div className="app-empty">
        <h2 style={{ marginBottom: 12 }}>tg-rss</h2>
        <p style={{ marginBottom: 16 }}>
          Чтобы читать каналы, нужно один раз подключиться.
        </p>
        <p style={{ color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>
          Отправь <b>/login</b> боту в чате.
        </p>
      </div>
    );
  }

  if (!isAuthed) {
    return <div className="app-empty">Загрузка...</div>;
  }

  return (
    <div className="app">
      <Header />
      <FolderTabs />
      {isSettingsOpen ? <SettingsScreen /> : <FeedScreen />}
      <BottomBar />
    </div>
  );
};

export default App;
