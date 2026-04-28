import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppActionsContext } from '../app/app-context';
import { I18nProvider } from '../i18n';
import { HomePage } from '../pages/HomePage';
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

function renderHomePage(
  locale: 'en-US' | 'zh-CN',
  actions: typeof defaultActions = defaultActions
) {
  render(
    <MemoryRouter>
      <I18nProvider locale={locale}>
        <AppActionsContext.Provider value={actions}>
          <HomePage />
        </AppActionsContext.Provider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    useAppStore.setState({
      project: null,
      notice: null,
      config: null
    });
    window.tapgit = undefined as never;
  });

  afterEach(() => {
    cleanup();
    window.tapgit = undefined as never;
  });

  it('shows two clear entry cards in Chinese mode when no project is open', () => {
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
          language: 'zh-CN'
        }
      }
    });

    renderHomePage('zh-CN');

    expect(screen.getByText('\u5148\u83b7\u53d6\u6216\u521b\u5efa\u4e00\u4e2a\u9879\u76ee')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '\u4ece GitHub \u83b7\u53d6' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '\u6253\u5f00\u6216\u521b\u5efa\u672c\u5730\u9879\u76ee' })).toBeInTheDocument();
    expect(screen.getByText('\u6700\u8fd1\u9879\u76ee')).toBeInTheDocument();
  });

  it('opens the GitHub import flow from the primary entry card', async () => {
    const user = userEvent.setup();
    const openCloneProjectDialog = vi.fn(async () => undefined);

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

    renderHomePage('en-US', {
      ...defaultActions,
      openCloneProjectDialog
    });

    await user.click(screen.getByRole('button', { name: 'Get from GitHub' }));

    expect(openCloneProjectDialog).toHaveBeenCalledTimes(1);
  });

  it('shows a project dashboard with one clear next step after a project is already open', async () => {
    const bridge = createBridgeMock();
    bridge.listHistory.mockResolvedValue({ ok: true, data: [] });
    bridge.getProjectOverview.mockResolvedValue({
      ok: true,
      data: {
        files: [
          {
            name: 'src',
            path: 'src',
            type: 'folder',
            size: null,
            modifiedAt: 1710000000
          },
          {
            name: 'README.md',
            path: 'README.md',
            type: 'file',
            size: 1200,
            modifiedAt: 1710000000
          }
        ],
        projectSizeBytes: 2400000,
        savedRecordCount: 2,
        recentRecords: [
          {
            id: 'a1b2c3d4e5f6',
            message: 'Test save',
            timestamp: 1710000000,
            changedFiles: 2,
            files: ['README.md']
          }
        ],
        lastSavedAt: 1710000000,
        lastSavedMessage: 'Test save'
      }
    });
    window.tapgit = bridge as never;

    useAppStore.setState({
      project: {
        path: 'E:/demo/project-a',
        name: 'project-a',
        isProtected: true,
        currentPlan: 'main',
        pendingChangeCount: 3
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

    renderHomePage('en-US');

    expect(screen.getByText('project-a')).toBeInTheDocument();
    expect(screen.getByText('Local project')).toBeInTheDocument();
    expect(screen.getByText('Current copy')).toBeInTheDocument();
    expect(screen.getByText('Saved points')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review Changes' })).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Recent Saves')).toBeInTheDocument();
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.queryByText('Recent Projects')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(bridge.listHistory).toHaveBeenCalledWith('E:/demo/project-a');
      expect(bridge.getProjectOverview).toHaveBeenCalledWith('E:/demo/project-a');
      expect(screen.getByText('README.md')).toBeInTheDocument();
      expect(screen.getAllByText('Test save').length).toBeGreaterThan(0);
    });
  });
});
