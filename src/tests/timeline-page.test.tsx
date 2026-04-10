import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppActionsContext } from '../app/app-context';
import { I18nProvider } from '../i18n';
import { TimelinePage } from '../pages/TimelinePage';
import { useAppStore } from '../stores/useAppStore';

const defaultActions = {
  openProjectFolder: async () => undefined,
  openCloneProjectDialog: async () => undefined,
  openProjectByPath: async () => undefined,
  enableProtection: async () => undefined,
  refreshProject: async () => undefined,
  refreshConfig: async () => undefined
};

function createBridgeMock() {
  return {
    chooseProjectFolder: vi.fn(),
    chooseCloneDestination: vi.fn(),
    openProject: vi.fn(),
    cloneProjectFromGitHub: vi.fn(),
    enableProtection: vi.fn(),
    getCurrentChanges: vi.fn(),
    saveProgress: vi.fn(),
    listHistory: vi.fn(),
    listSafetyBackups: vi.fn(),
    restoreToRecord: vi.fn(),
    restoreToSafetyBackup: vi.fn(),
    listPlans: vi.fn(),
    createPlan: vi.fn(),
    switchPlan: vi.fn(),
    mergePlan: vi.fn(),
    resolveCollision: vi.fn(),
    completeMerge: vi.fn(),
    getConfig: vi.fn(),
    updateSettings: vi.fn(),
    checkGitEnvironment: vi.fn(),
    getGitHubAuthStatus: vi.fn(),
    loginGitHub: vi.fn(),
    logoutGitHub: vi.fn(),
    getCloudSyncStatus: vi.fn(),
    testCloudConnection: vi.fn(),
    connectCloud: vi.fn(),
    uploadToCloud: vi.fn(),
    getCloudLatest: vi.fn(),
    exportLogs: vi.fn(),
    openExternalUrl: vi.fn()
  };
}

function renderTimelinePage(locale: 'en-US' | 'zh-CN') {
  render(
    <MemoryRouter>
      <I18nProvider locale={locale}>
        <AppActionsContext.Provider value={defaultActions}>
          <TimelinePage />
        </AppActionsContext.Provider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('TimelinePage', () => {
  beforeEach(() => {
    useAppStore.setState({
      project: {
        path: 'E:/demo/project-a',
        name: 'project-a',
        isProtected: true,
        currentPlan: 'main',
        pendingChangeCount: 0
      },
      notice: null,
      config: {
        recentProjects: [],
        settings: {
          showAdvancedMode: false,
          showBeginnerGuide: false,
          autoSnapshotBeforeRestore: true,
          autoSnapshotBeforeMerge: true,
          defaultSaveMessageTemplate: '',
          language: 'en-US'
        }
      }
    });
    window.tapgit = undefined as never;
  });

  afterEach(() => {
    cleanup();
    window.tapgit = undefined as never;
  });

  it('shows automatic safety backups separately from saved records', async () => {
    const bridge = createBridgeMock();
    bridge.listHistory.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'record-1',
          message: 'Fix login save flow',
          timestamp: 1712636100,
          changedFiles: 3,
          files: ['src/login.tsx', 'src/auth.ts', 'src/api.ts']
        }
      ]
    });
    bridge.listSafetyBackups.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'safety/restore-20260409-123000',
          name: 'safety/restore-20260409-123000',
          createdAt: 1712637000,
          lastMessage: 'Before trying the older version',
          source: 'restore'
        }
      ]
    });
    window.tapgit = bridge as never;

    renderTimelinePage('en-US');

    expect(await screen.findByText('Go Back Safely')).toBeInTheDocument();
    expect(screen.getByText('Saved Points')).toBeInTheDocument();
    expect(await screen.findByText('Safety Backups')).toBeInTheDocument();
    expect(screen.getAllByText('Created before restore').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Before trying the older version').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Return to This Backup' })).toBeInTheDocument();

    await waitFor(() => {
      expect(bridge.listHistory).toHaveBeenCalledWith('E:/demo/project-a');
      expect(bridge.listSafetyBackups).toHaveBeenCalledWith('E:/demo/project-a');
    });
  });
});
