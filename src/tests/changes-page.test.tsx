import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppActionsContext } from '../app/app-context';
import { I18nProvider } from '../i18n';
import { ChangesPage } from '../pages/ChangesPage';
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
    openInFileManager: vi.fn(),
    enableProtection: vi.fn(),
    getCurrentChanges: vi.fn(),
    stopTrackingFile: vi.fn(),
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

function renderChangesPage(
  locale: 'en-US' | 'zh-CN',
  actions: typeof defaultActions = defaultActions
) {
  render(
    <MemoryRouter>
      <I18nProvider locale={locale}>
        <AppActionsContext.Provider value={actions}>
          <ChangesPage />
        </AppActionsContext.Provider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('ChangesPage', () => {
  beforeEach(() => {
    useAppStore.setState({
      project: {
        path: 'E:/demo/project-a',
        name: 'project-a',
        isProtected: true,
        currentPlan: 'main',
        pendingChangeCount: 1
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

  it('shows a focused work area and keeps partial save disabled until a file is checked', async () => {
    const bridge = createBridgeMock();
    bridge.getCurrentChanges.mockResolvedValue({
      ok: true,
      data: [
        {
          path: 'src/login.tsx',
          changeType: 'modified',
          statusLabel: 'Modified',
          additions: 12,
          deletions: 4,
          diffText: '+new line'
        }
      ]
    });
    window.tapgit = bridge as never;

    renderChangesPage('en-US');

    expect(await screen.findByText('Current Work')).toBeInTheDocument();
    expect(screen.getByText('Review first, then save.')).toBeInTheDocument();
    expect(screen.getByText('Changed Files')).toBeInTheDocument();
    expect(screen.getByText('Save This Work')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Only Checked Files' })).toBeDisabled();
    expect(
      screen.getByText('No files are checked. If you only want part of this page, check those files first.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select src/login.tsx for a partial save' }));

    expect(screen.getByRole('button', { name: 'Save Only Checked Files' })).toBeEnabled();
    expect(screen.getByText('1 files are checked for a partial save.')).toBeInTheDocument();

    await waitFor(() => {
      expect(bridge.getCurrentChanges).toHaveBeenCalledWith('E:/demo/project-a');
    });
  });

  it('shows the next action when no project is open', () => {
    const openProjectFolder = vi.fn(async () => undefined);

    useAppStore.setState({
      project: null,
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

    renderChangesPage('en-US', {
      ...defaultActions,
      openProjectFolder
    });

    expect(screen.getByText('Open a project from Home first.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Project' }));

    expect(openProjectFolder).toHaveBeenCalledTimes(1);
  });
});
