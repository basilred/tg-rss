import { useUiStore } from '../stores/ui';

export const Header = () => {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  return (
    <header className="header">
      <span className="header-title">tg-rss</span>
      <button className="header-btn" onClick={() => setSettingsOpen(true)}>
        ⚙️
      </button>
    </header>
  );
};
