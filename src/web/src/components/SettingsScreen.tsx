import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useUiStore } from '../stores/ui';

export const SettingsScreen = () => {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const queryClient = useQueryClient();
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
    },
  });

  const deleteFolder = useMutation({
    mutationFn: (id: number) => api.folders.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] }),
  });

  const importChannels = useMutation({
    mutationFn: () => api.auth.importChannels(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      alert(`Импортировано ${data.imported} каналов`);
    },
    onError: () => alert('Ошибка импорта. Убедись, что подключился.'),
  });

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    const results = await api.channels.search(searchQuery);
    setSearchResults(results);
  };

  return (
    <main className="settings">
      <div className="settings-header">
        <h2>Настройки</h2>
        <button className="settings-close" onClick={() => setSettingsOpen(false)}>✕</button>
      </div>

      <section className="settings-section">
        <h3>Каналы</h3>
        <button
          onClick={() => importChannels.mutate()}
          disabled={importChannels.isPending}
          className="settings-btn"
          style={{ width: '100%', marginBottom: 12 }}
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
