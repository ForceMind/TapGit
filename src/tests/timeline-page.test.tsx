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
  refreshConfig: async () => undefined,
  showProjectInFolder: async () => undefined,
  saveAllProgress: async () => undefined,
  uploadCloud: async () => undefined,
  getLatestFromCloud: async () => undefined,
  openIdeaCopyDialog: () => undefined
};

function createBridgeMock() {
  return {
    chooseProjectFolder: vi.fn(),
    chooseCloneDestination: vi.fn(),
    openProject: vi.fn(),
    getProjectOverview: vi.fn(),
    cloneProjectFromGitHub: vi.fn(),
    enableProtection: vi.fn(),
    getCurrentChanges: vi.fn(),
    stopTrackingFile: vi.fn(),
    discardAllChanges: vi.fn(),
    saveProgress: vi.fn(),
    listHistory: vi.fn(),
    getHistoryRecordDetails: vi.fn(),
    listSafetyBackups: vi.fn(),
    createSafetyBackup: vi.fn(),
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

  it('shows saved records in the focused history view', async () => {
    const bridge = createBridgeMock();
    bridge.listHistory.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'record-2',
          message: 'Ship dashboard',
          timestamp: 1712722500,
          changedFiles: 1,
          files: ['src/dashboard.tsx']
        },
        {
          id: 'record-1',
          message: 'Fix login save flow',
          timestamp: 1712636100,
          changedFiles: 3,
          files: ['src/login.tsx', 'src/auth.ts', 'src/api.ts']
        }
      ]
    });
    bridge.getHistoryRecordDetails.mockResolvedValue({
      ok: true,
      data: {
        id: 'record-2',
        message: 'Ship dashboard',
        timestamp: 1712722500,
        changedFiles: 1,
        files: ['src/dashboard.tsx'],
        changes: [
          {
            path: 'src/dashboard.tsx',
            changeType: 'modified',
            additions: 12,
            deletions: 4,
            diffText: '@@ -1 +1 @@\n-old\n+new'
          }
        ]
      }
    });
    bridge.listSafetyBackups.mockResolvedValue({ ok: true, data: [] });
    window.tapgit = bridge as never;

    renderTimelinePage('en-US');

    expect(await screen.findByText('Save Timeline')).toBeInTheDocument();
    expect(screen.getByText('Work point by point')).toBeInTheDocument();
    expect(screen.getAllByText('Fix login save flow').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ship dashboard').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /1Fix login save flow/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2Ship dashboard/ })).toBeInTheDocument();
    expect(screen.getByText('Changes saved in this point')).toBeInTheDocument();
    expect((await screen.findAllByText('src/dashboard.tsx')).length).toBeGreaterThan(0);
    expect(screen.getByText('files with code records')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore This Point' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try a New Path Here' })).toBeInTheDocument();

    await waitFor(() => {
      expect(bridge.listHistory).toHaveBeenCalledWith('E:/demo/project-a');
      expect(bridge.getHistoryRecordDetails).toHaveBeenCalledWith('E:/demo/project-a', 'record-2');
    });
  });
});
