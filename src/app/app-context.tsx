import { createContext, useContext } from 'react';

export interface AppActionsContextValue {
  openProjectFolder: () => Promise<void>;
  openCloneProjectDialog: () => Promise<void>;
  openProjectByPath: (projectPath: string) => Promise<void>;
  enableProtection: () => Promise<void>;
  refreshProject: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  showProjectInFolder: () => Promise<void>;
  saveAllProgress: () => Promise<void>;
  uploadCloud: () => Promise<void>;
  getLatestFromCloud: () => Promise<void>;
  openIdeaCopyDialog: () => void;
}

export const AppActionsContext = createContext<AppActionsContextValue | null>(null);

export function useAppActions() {
  const ctx = useContext(AppActionsContext);
  if (!ctx) {
    throw new Error('App actions context not found');
  }
  return ctx;
}
