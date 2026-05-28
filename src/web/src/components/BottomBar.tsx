import { useUiStore } from '../stores/ui';

export const BottomBar = () => {
  const sortOrder = useUiStore((s) => s.sortOrder);
  const toggleSortOrder = useUiStore((s) => s.toggleSortOrder);

  return (
    <footer className="bottombar">
      <button className="bottombar-btn" onClick={toggleSortOrder}>
        {sortOrder === 'asc' ? '↑ Старые → Новые' : '↓ Новые → Старые'}
      </button>
    </footer>
  );
};
