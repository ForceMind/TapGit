import { create } from 'zustand';
import { AppConfig, ProjectSummary } from '../shared/contracts';

type NoticeType = 'success' | 'error' | 'info';

interface Notice {
  type: NoticeType;
  text: string;
}

interface AppStoreState {
  project: ProjectSummary | null;
  config: AppConfig | null;
  notice: Notice | null;
  setProject: (project: ProjectSummary | null) => void;
  setConfig: (config: AppConfig) => void;
  setNotice: (notice: Notice | null) => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  project: null,
  config: null,
  notice: null,
  setProject: (project) => set({ project }),
  setConfig: (config) => set({ config }),
  setNotice: (notice) => set({ notice })
}));
