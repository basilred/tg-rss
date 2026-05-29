import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useUiStore } from '../stores/ui';
import { useHaptics } from '../hooks/useHaptics';

export const FolderTabs = () => {
  const activeFolder = useUiStore((s) => s.activeFolder);
  const setActiveFolder = useUiStore((s) => s.setActiveFolder);
  const haptics = useHaptics();

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.folders.list(),
  });

  return (
    <nav className="folder-tabs">
      <button
        className={`folder-tab ${activeFolder === null ? 'folder-tab-active' : ''}`}
        onClick={() => { setActiveFolder(null); haptics.medium(); }}
      >
        Все
      </button>
      {folders.map((f) => (
        <button
          key={f.id}
          className={`folder-tab ${activeFolder === f.id ? 'folder-tab-active' : ''}`}
          onClick={() => { setActiveFolder(f.id); haptics.medium(); }}
        >
          {f.name}
        </button>
      ))}
    </nav>
  );
};
