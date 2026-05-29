import { useEffect, useState } from 'react';
import { setToken, api } from './api/client';
import { useUiStore } from './stores/ui';
import { useTelegram } from './hooks/useTelegram';
import { FeedScreen } from './components/FeedScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { Header } from './components/Header';
import { FolderTabs } from './components/FolderTabs';
import { BottomBar } from './components/BottomBar';

const App = () => {
  const telegram = useTelegram();
  const [isAuthed, setIsAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [telegramSyncConnected, setTelegramSyncConnected] = useState(false);
  const isSettingsOpen = useUiStore((s) => s.isSettingsOpen);

  useEffect(() => {
    const initData = telegram.initData;
    if (!initData) {
      setAuthError('Открой приложение внутри Telegram.');
      return;
    }

    api.auth.verify(initData)
      .then((res) => {
        setToken(res.token);
        setTelegramSyncConnected(res.telegramSyncConnected);
        setIsAuthed(true);
      })
      .catch(() => setAuthError('Не удалось войти через Telegram.'));
  }, [telegram.initData]);

  if (authError) {
    return (
      <div className="app-empty">
        <h2 style={{ marginBottom: 12 }}>tg-rss</h2>
        <p style={{ marginBottom: 16 }}>{authError}</p>
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
      {isSettingsOpen ? (
        <SettingsScreen telegramSyncConnected={telegramSyncConnected} />
      ) : (
        <FeedScreen />
      )}
      <BottomBar />
    </div>
  );
};

export default App;
