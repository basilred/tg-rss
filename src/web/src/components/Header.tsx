import { useUiStore } from '../stores/ui';
import { useHaptics } from '../hooks/useHaptics';

export const Header = () => {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const haptics = useHaptics();

  return (
    <header className="header">
      <h1 className="header-title">tg-rss</h1>
      <button
        className="header-btn"
        onClick={() => { setSettingsOpen(true); haptics.selection(); }}
      >
        ⚙️
      </button>
    </header>
  );
};
