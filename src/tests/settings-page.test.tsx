import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppActionsContext } from '../app/app-context';
import { I18nProvider } from '../i18n';
import { SettingsPage } from '../pages/SettingsPage';
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
    openInFileManager: vi.fn(),
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

function renderSettingsPage(locale: 'en-US' | 'zh-CN') {
  render(
    <MemoryRouter>
      <I18nProvider locale={locale}>
        <AppActionsContext.Provider value={defaultActions}>
          <SettingsPage />
        </AppActionsContext.Provider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('SettingsPage', () => {
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

  it('shows a focused cloud workspace for the current project', async () => {
    const bridge = createBridgeMock();
    bridge.checkGitEnvironment.mockResolvedValue({
      ok: true,
      data: {
        available: true,
        version: '2.48.1'
      }
    });
    bridge.getCloudSyncStatus.mockResolvedValue({
      ok: true,
      data: {
        connected: true,
        remoteLabel: 'origin',
        remoteUrl: 'https://github.com/force-mind/project-a.git',
        currentPlan: 'main',
        hasTracking: true,
        pendingUpload: 2,
        pendingDownload: 1,
        statusText: 'local changes waiting'
      }
    });
    bridge.getGitHubAuthStatus.mockResolvedValue({
      ok: true,
      data: {
        available: true,
        accounts: ['force-mind'],
        activeAccount: 'force-mind'
      }
    });
    window.tapgit = bridge as never;

    renderSettingsPage('en-US');

    expect(await screen.findByText('project-a Sync')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Connect This Project' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sync Now' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'App Preferences' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Safety & Support' })).toBeInTheDocument();
    expect(screen.getByText('force-mind')).toBeInTheDocument();
    expect(screen.getByText('https://github.com/force-mind/project-a.git')).toBeInTheDocument();

    await waitFor(() => {
      expect(bridge.checkGitEnvironment).toHaveBeenCalledTimes(1);
      expect(bridge.getCloudSyncStatus).toHaveBeenCalledWith('E:/demo/project-a');
      expect(bridge.getGitHubAuthStatus).toHaveBeenCalledTimes(1);
    });
  });
});
