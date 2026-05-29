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
      // 1. Get login token
      const { tgLoginUrl, tokenKey } = await api.auth.exportLoginToken(initData);

      // 2. Open Telegram login link
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openTelegramLink(tgLoginUrl);
      } else {
        window.open(tgLoginUrl, '_blank');
      }

      // 3. Poll for login completion
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const result = await api.auth.importLoginToken(tokenKey, initData);
          if (result.ok) {
            // 4. Import channels
            try {
              await api.auth.importChannels(initData);
            } catch {
              // channels will sync via worker
            }
            // 5. Reload to get fresh JWT
            setNeedsSession(false);
            setConnecting(false);
            // Re-verify to get new token
            const initData = window.Telegram?.WebApp?.initData;
            if (initData) {
              const verifyRes = await api.auth.verify(initData);
              if (verifyRes.token) {
                setToken(verifyRes.token);
                setIsAuthed(true);
                return;
              }
            }
            setIsAuthed(true);
            return;
          }
        } catch {
          // not accepted yet, keep polling
        }
      }

      setConnectError('Время ожидания истекло. Попробуй ещё раз.');
    } catch (err) {
      console.error('Connect error:', err);
      setConnectError('Ошибка подключения. Попробуй ещё раз.');
    }
    setConnecting(false);
  }, []);

  if (needsSession) {
    return (
      <div className="app-empty">
        <h2 style={{ marginBottom: 12 }}>tg-rss</h2>
        <p style={{ marginBottom: 16 }}>
          Чтобы читать каналы, нужно один раз подключиться.
        </p>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="settings-btn"
          style={{ fontSize: 16, padding: '12px 24px' }}
        >
          {connecting ? 'Ожидание подтверждения...' : 'Подключиться'}
        </button>
        {connecting && (
          <p style={{ marginTop: 12, color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>
            Нажми «Разрешить» в открывшемся окне Telegram
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
