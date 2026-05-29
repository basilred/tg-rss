import { useEffect, useState, useCallback, useRef } from 'react';
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
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
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

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setConnectError('');

    try {
      const initData = initDataRef.current;

      // Get login token
      const { tgLoginUrl } = await api.auth.exportLoginToken(initData);

      // Open login link in Telegram (this will background the Mini App)
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openTelegramLink(tgLoginUrl);
      }

      // Show hint — user needs to confirm and reopen
      setConnectError(
        'Нажми «Разрешить» в открывшемся окне Telegram, затем вернись в ленту.',
      );
    } catch (err) {
      console.error('Connect error:', err);
      setConnectError('Ошибка подключения. Попробуй ещё раз.');
      setConnecting(false);
    }
  }, []);

  if (needsSession) {
    return (
      <div className="app-empty">
        <h2 style={{ marginBottom: 12 }}>tg-rss</h2>
        <p style={{ marginBottom: 16 }}>
          Чтобы читать каналы, нужно один раз подключиться.
        </p>
        {!connecting && (
          <button
            onClick={handleConnect}
            className="settings-btn"
            style={{ fontSize: 16, padding: '12px 24px' }}
          >
            Подключиться
          </button>
        )}
        {connecting && (
          <p style={{ marginTop: 12, color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>
            Нажми «Разрешить» в Telegram, затем вернись в ленту
          </p>
        )}
        {connectError && (
          <p style={{ marginTop: 12, color: '#e53935', fontSize: 14 }}>{connectError}</p>
        )}
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
