import { create } from 'zustand';

interface UiState {
  activeFolder: number | null;
  sortOrder: 'asc' | 'desc';
  isSettingsOpen: boolean;
  setActiveFolder: (folderId: number | null) => void;
  toggleSortOrder: () => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeFolder: null,
  sortOrder: 'asc',
  isSettingsOpen: false,
  setActiveFolder: (folderId) => set({ activeFolder: folderId }),
  toggleSortOrder: () =>
    set((s) => ({ sortOrder: s.sortOrder === 'asc' ? 'desc' : 'asc' })),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
}));
