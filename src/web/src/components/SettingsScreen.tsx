import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useUiStore } from '../stores/ui';
import { useToast } from './ToastProvider';
import { useTelegramPopup } from '../hooks/useTelegramPopup';
import { useBackButton } from '../hooks/useBackButton';
import {
  getTelegramWebApp,
  enableClosingConfirmation,
  disableClosingConfirmation,
  openTelegramLink,
} from '../telegram/webApp';

interface Props {
  telegramSyncConnected: boolean;
}

export const SettingsScreen = ({ telegramSyncConnected }: Props) => {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const queryClient = useQueryClient();
  const toast = useToast();
  const popup = useTelegramPopup();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ id: number; username: string; title: string; photo_url: string }>
  >([]);
  const [newFolderName, setNewFolderName] = useState('');

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api.subscriptions.list(),
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.folders.list(),
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['auth', 'status'],
    queryFn: () => api.auth.status(),
    initialData: { telegramSyncConnected, botUsername: null },
  });

  const isTelegramSyncConnected = syncStatus.telegramSyncConnected;

  const handleClose = useCallback(() => {
    disableClosingConfirmation(getTelegramWebApp());
    setSettingsOpen(false);
  }, [setSettingsOpen]);

  useBackButton(handleClose, true);

  const addSub = useMutation({
    mutationFn: (channelId: number) => api.subscriptions.add(channelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
  });

  const removeSub = useMutation({
    mutationFn: (channelId: number) => api.subscriptions.remove(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const createFolder = useMutation({
    mutationFn: (name: string) => api.folders.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setNewFolderName('');
      toast.show('Папка создана', 'success');
    },
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: number) => {
      const confirmed = await popup.confirm({
        title: 'Удалить папку?',
        message: 'Все каналы в этой папке будут откреплены.',
        buttons: [
          { id: 'delete', type: 'destructive', text: 'Удалить' },
          { id: 'cancel', type: 'cancel', text: 'Отмена' },
        ],
      });
      if (confirmed !== 'delete') throw new Error('Cancelled');
      return api.folders.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast.show('Папка удалена', 'neutral');
    },
    onError: (err) => {
      if (err.message !== 'Cancelled') {
        toast.show('Ошибка при удалении папки', 'error');
      }
    },
  });

  const importChannels = useMutation({
    mutationFn: () => api.subscriptions.import(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      toast.show(`Импортировано ${data.imported} каналов`, 'success');
    },
    onError: () => toast.show('Ошибка импорта. Убедись, что подключился.', 'error'),
  });

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    const results = await api.channels.search(searchQuery);
    setSearchResults(results);
  };

  const handleDeepLink = () => {
    const webApp = getTelegramWebApp();
    const username = syncStatus.botUsername;
    if (username) {
      openTelegramLink(webApp, `https://t.me/${username}?start=login`);
    } else {
      openTelegramLink(webApp, `https://t.me/?start=login`);
    }
  };

  useEffect(() => {
    if (newFolderName.trim()) {
      enableClosingConfirmation(getTelegramWebApp());
    } else {
      disableClosingConfirmation(getTelegramWebApp());
    }
  }, [newFolderName]);

  return (
    <main className="settings">
      <div className="settings-header">
        <h2>Настройки</h2>
        <button className="settings-close" onClick={handleClose}>✕</button>
      </div>

      <section className="settings-section">
        <h3>Каналы</h3>
        {!isTelegramSyncConnected && (
          <details className="settings-hint-details">
            <summary className="settings-hint-summary">
              Telegram sync не подключён
            </summary>
            <p className="settings-hint">
              Для автоматического импорта подписок подключи синхронизацию.
            </p>
            <button className="settings-btn" onClick={handleDeepLink}>
              Подключить синхронизацию
            </button>
          </details>
        )}
        <button
          onClick={() => importChannels.mutate()}
          disabled={importChannels.isPending || !isTelegramSyncConnected}
          className="settings-btn"
          style={{ width: '100%', marginBottom: 12, marginTop: isTelegramSyncConnected ? 0 : 12 }}
        >
          {importChannels.isPending ? 'Импортирую...' : 'Импортировать каналы из Telegram'}
        </button>
        <div className="settings-search">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="@username или название"
            className="settings-input"
          />
          <button onClick={handleSearch} className="settings-btn">Найти</button>
        </div>
        {searchResults.map((ch) => (
          <div key={ch.id} className="settings-channel-row">
            <span>{ch.title} {ch.username ? `(@${ch.username})` : ''}</span>
            <button onClick={() => addSub.mutate(ch.id)} className="settings-btn-sm">Подписаться</button>
          </div>
        ))}
      </section>

      <section className="settings-section">
        <h3>Мои подписки ({subscriptions.length})</h3>
        {subscriptions.map((sub) => (
          <div key={sub.id} className="settings-channel-row">
            <span>{sub.title}</span>
            <button onClick={() => removeSub.mutate(sub.id)} className="settings-btn-sm settings-btn-danger">Отписаться</button>
          </div>
        ))}
      </section>

      <section className="settings-section">
        <h3>Папки</h3>
        <div className="settings-search">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Название папки"
            className="settings-input"
          />
          <button onClick={() => newFolderName && createFolder.mutate(newFolderName)} className="settings-btn">Создать</button>
        </div>
        {folders.map((f) => (
          <div key={f.id} className="settings-channel-row">
            <span>{f.name}</span>
            <button onClick={() => deleteFolder.mutate(f.id)} className="settings-btn-sm settings-btn-danger">Удалить</button>
          </div>
        ))}
      </section>
    </main>
  );
};
