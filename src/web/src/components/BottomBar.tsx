import { useUiStore } from '../stores/ui';
import { useHaptics } from '../hooks/useHaptics';

export const BottomBar = () => {
  const sortOrder = useUiStore((s) => s.sortOrder);
  const toggleSortOrder = useUiStore((s) => s.toggleSortOrder);
  const haptics = useHaptics();

  return (
    <footer className="bottombar">
      <button
        className="bottombar-btn"
        onClick={() => { toggleSortOrder(); haptics.selection(); }}
      >
        {sortOrder === 'asc' ? '↑ Старые → Новые' : '↓ Новые → Старые'}
      </button>
    </footer>
  );
};
